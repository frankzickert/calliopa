# CA_0023_FEAT_proposal-writes

Status: completed

Requested: 2026-08-30

## Intent

[Revisioned Graph](../../system/content-store/revisioned-graph.md) already fixes a four-state
revision lifecycle — `candidate`, `established`, `archived`, `rejected` — and
records that the graph writes only two of them: *"`candidate` and `rejected` are
storable, and no operation reaches them until a proposal-review change opens
that path."* This is that change.

It exists because of a decision made on 2026-08-30 for
[CA_0022_FEAT_agent-layer](./CA_0022_FEAT_agent-layer.md): an agent write is
proposal-only. The agent stages content and a human accepts it, item by item, in
the document the items concern. Nothing an agent produces becomes truth on its
own.

The path was anticipated, so this is not a new concept bolted onto the graph. It
is the operations, the read overlay, and the review treatment that reach a state
the store already holds.

## Why It Is Its Own Change

- It is a graph and gateway concept, not an agent concept. Any untrusted writer
  wants it — an import, a bulk transform, a second person later. Building it
  inside the agent change would tie a general capability to one consumer.
- CA_0022 is already the largest change proposed for this repo. Adding a
  proposal model, an overlay read path, and a review treatment to it would make
  it undeliverable.
- It has a testable deliverable with no agent present: a proposal staged through
  the existing authenticated API, read back by its author, accepted item by item
  by a human, and visible as truth afterwards.

* The order is CA_0021, then this change, then CA_0022. The agent cannot write
  until this exists, because proposal-only is what it is allowed to do.

## Prior Art

- `/home/calliopa/projects/studio` **built** this half, unlike its agent layer:
  `migrations/0043_document_proposal.sql`, `src/server/block-proposals.ts`,
  `block-proposal-decisions.ts`, and `tests/browser/document-proposals-api.spec.ts`.
  Its items are typed document operations, review shows in place against the
  block each item concerns, and the human accepts or rejects per item with
  `Accept all` as a shortcut. That shape is adopted here.
- `/home/calliopa/projects/_calliopa-old/calliopa-bootstrap` accepted whole
  groups instead. Its contribution here is the authority model — agent identity
  is proposal-only, enforced at the gateway rather than by convention — not the
  granularity.

* Where the two disagree, the built one wins on shape and the dogfooded one wins
  on authority. Both were verified in their own repos on 2026-08-30.

## What A Proposal Is

* A proposal group is one coherent change, staged by one caller against one
  document.
* A group holds **typed items**, not raw revisions. An item is one of `replace`
  (a block's text), `insert` (a block with its text and its position), `remove`
  (a block), or `move` (a block to a position).
* Every item is self-contained: it carries everything its operation needs,
  including the position an inserted block takes.
* A group pins the data revision it was staged against, so acceptance can tell
  whether the graph moved underneath it.
* Nothing accepts on a caller's behalf. Acceptance is a human action.

- The typed item is what makes per-item acceptance safe, and it is the reason
  items are not raw candidate revisions. Accepting an inserted block while
  rejecting the containment relation that places it would orphan the block and
  violate the containment validity [Block Document Model](../../system/documents/block-document-model.md)
  fixes. An item that carries its own position cannot be half-accepted.
- How an item is stored is a technical matter with no consumer-visible
  consequence, decided here: an item that introduces content stages it as a
  `candidate` revision, and acceptance establishes it. `replace` and `insert`
  carry candidate content; `remove` and `move` carry intent only, because
  archiving a revision and reopening a containment introduce no new content.
  This keeps the staged content in the graph, which is what lets the overlay
  below be a graph read rather than a second assembly path.
- A group carries who staged it and why: the resolved client identity from
  [API Authentication](../../system/identity/api-authentication.md), and the request that
  produced it.

## Acceptance

* The human accepts or rejects each item independently. `Accept all` is a
  shortcut, not a different operation.
* Accepting an item performs its operation and establishes any candidate content
  it carries. Rejecting moves that content to `rejected`.
* A group closes when no item is unanswered. A group with items still unanswered
  stays open, and that is the whole of what a partially answered group means.

- Rejection keeps the content rather than deleting it. `rejected` is a lifecycle
  state the store already carries, and a rejected item that vanished would lose
  the record of what was asked for.
- An item whose block no longer exists when it is answered is refused as stale
  rather than applied to something else. The item names the block it was staged
  against, and a block that has been removed underneath it is a conflict, not a
  target.
- Accepting items one at a time means the document changes under the reader as
  they work. That is the intended behavior — an accepted item is truth — and it
  is why acceptance is per item rather than a queue answered at the end.

## Reading Your Own Proposal

* A caller reading at a pin sees established truth. A caller reading with its own
  group as an overlay sees truth with its own staged items laid over it.
* A proposal is never visible in another caller's ordinary reads. Staged content
  is not truth and must not read as truth anywhere it was not asked for.

- The overlay is what makes incremental staging usable: a writer that stages a
  block and then reads the document back has to see what it just staged, or it
  cannot build on its own work.
- The overlay is scoped to one group. There is no view of all open proposals
  merged together, because two proposals may contradict each other and a merged
  view would have to invent a resolution.

## Conflict

- A group pins a base data revision. If the established truth an item was staged
  against has moved by the time a human answers it, acceptance reports the
  conflict naming what moved rather than silently overwriting.
- This is the same shape [Graph Gateway](../../system/content-store/graph-gateway.md) already
  uses for direct mutations, where a `reviseNode` whose base revision is no
  longer established conflicts and commits nothing. Proposals extend the window
  between write and commit from milliseconds to however long review takes, which
  makes the conflict likelier but not different.
- Per-item acceptance makes the window per item: answering the first item can
  move truth underneath the fifth. Conflict is therefore reported per item, and
  a conflicted item is answerable after the reader has seen what changed rather
  than being dropped.
- Automatic conflict resolution stays out of scope, as it already is in both
  system documents.

## Who Must Propose

* A caller's identity class decides whether it may write truth directly or may
  only stage. It is enforced at the gateway boundary, not by convention and not
  by the caller's own good behavior.

- [API Authentication](../../system/identity/api-authentication.md) resolves every request
  to one client identity. This change gives a client a class, and the agent's
  client is the first one that may only propose.
- The browser is not affected. A human editing a document in the block editor
  writes truth directly, as they do today. Introducing review between a person
  and their own typing would be a different product.
- The class is a property of the client record, so switching a caller between
  proposing and writing is an operator action on a record that already exists,
  not a redeploy.

## Review Happens In The Document

* An item is reviewed at the block it concerns, with the proposed text beside
  the current one, and is accepted or rejected there.
* A `Show proposed changes` toggle in the document metadata panel is how the
  reader reveals them, beside the retired-blocks toggle and off by default, and
  the panel says how many items stand unanswered whether or not it is on.

- The block editor is already the document surface and already treats blocks
  individually — activation, retired blocks shown in place, and the marks
  [CA_0020](./completed/CA_0020_FEAT_command-mode-block-references.md) adds. A proposed
  change against a block is the same kind of treatment, and judging a rewrite
  means seeing it against what it replaces, in the document it belongs to.
- The inspector was considered and rejected as the place the items live.
  [Workspace Shell](../../system/workspace/frame.md) fixes what the shell renders
  from a view's contribution — a save state, a time, a count, a line of text, a
  button, and a toggle — and none of that expresses proposed text against
  current. Review there would mean growing the contribution vocabulary
  substantially for one consumer.
- The inspector keeps the job it is already shaped for. A selected process takes
  the inspector today, and an agent run is a process, so "which documents did
  this run touch, and what is still unanswered" is the summary it already knows
  how to render. That index moved to
  [CA_0022](./CA_0022_FEAT_agent-layer.md) on 2026-08-31 and is `CA_0022_014`
  there: nothing produces a process and no group references a run until that
  change, so the index cannot exist before it. The toggle is what this change
  gives the reader instead, and a count in the panel is what stops unanswered
  work from being invisible while the toggle is off.
- A review tab of its own was rejected for the same reason the inspector was:
  it judges a block's text away from the document that block lives in.
- Coordination with CA_0020: both put a block-level treatment in the editor,
  marks and proposed changes. Whichever lands second states how the two read
  together rather than discovering it. Neither depends on the other.

## What This Is Not

- Not authorization. A caller that may propose may propose anything; per-record
  and per-scope permissions remain out of scope in both system documents.
- Not automatic conflict resolution, ranking, enrichment, or embeddings — the
  rest of the out-of-scope line this change narrows.
- Not review of human edits. Direct writes stay direct.
- Not a diff or merge tool. The reader sees each proposed item against what it
  would change; reconciling two contradicting proposals is not offered.
- Not proposals across several documents in one group. A group is staged against
  one document, and a run touching three documents stages three groups the
  process lists together. Cross-document atomicity is a promise nothing has
  asked for yet.
- Not the agent. [CA_0022](./CA_0022_FEAT_agent-layer.md) is the first consumer
  and arrives after this.

## Verification Impact

- Provable in the gate against real Postgres: a group staged through the
  authenticated API changes no established truth; the author reads its own group
  and sees its staged items, and another caller's ordinary read does not;
  accepting one item establishes exactly that item and leaves the rest open;
  rejecting one leaves `rejected` content and truth untouched; a group closes
  when its last item is answered; an item whose block moved underneath it
  reports a conflict instead of overwriting; an item naming a removed block is
  refused as stale; a propose-only client is refused a direct mutation.
- The lifecycle invariant already in [Revisioned Graph](../../system/content-store/revisioned-graph.md)
  — at most one `established` revision per node — must survive acceptance of
  every item kind, and is worth asserting directly rather than trusting.
- Browser scenarios: a proposal showing against the block it concerns with the
  proposed text beside the current one, one item accepted and the block holding
  the new text, one item rejected and the block unchanged, `Accept all` closing
  the group, and the axe scans clean on both form factors with a proposal
  showing.
- Containment validity after every per-item acceptance order is the property
  most likely to break and least likely to be noticed. Accepting an `insert` and
  a `move` against the same parent in either order must leave a valid document,
  and that is worth proving both ways round rather than once.
- `pnpm run verify` gates the result.

## System Work

Transferred on 2026-08-31 as `CA_0023_001`-`CA_0023_013`, and completed the
same day. Every task has become truth in the document that owns it; none
remains claimed.

- [Revisioned Graph](../../system/content-store/revisioned-graph.md) gained staging, acceptance
  and rejection, the rule that a candidate is never truth in any read at any
  point, and the establishment stamp history resolves through.
- [API Authentication](../../system/identity/api-authentication.md) gained the client's
  identity class and the operator action that sets it.
- [Graph Gateway](../../system/content-store/graph-gateway.md) gained a `Proposals` section with
  reading a group, answering one, conflict and staleness, and who may write
  truth; a `refused` outcome answered as 403; and the propose endpoint.
- [Block Document Model](../../system/documents/block-document-model.md) gained the four
  item kinds as operations on a document, what a stale item is, and the rule
  that staging moves neither the document nor its change count.
- [Block Editor View](../../system/documents/block-editor.md) gained proposed changes
  in place behind a panel toggle, and answering them where they are read.
- [Workspace Shell](../../system/workspace/frame.md) is untouched by this change.
  The process index moved to `CA_0022_014` there.

Three questions the sections could be read either way on were settled on
2026-08-31:

- A reader reveals proposed items with a panel toggle rather than having them
  shown whenever a document opens, which is the treatment retired blocks
  already have. The panel states the unanswered count with the toggle off, so
  the toggle hides the items and never the fact that there are some.
- The process inspector index belongs to the change that gives a group a run to
  be indexed by, which is CA_0022 rather than this one.
- `move` stages candidate content after all. The order key lives on the block,
  so moving one revises its content like any other edit; only `remove` is
  intent alone. What this section originally said — that `move` carries intent
  only — was wrong about where a position is stored.

Five decisions with no product consequence were taken while building:

- A revision records the data revision *and the time* it became truth. The
  creation state alone cannot tell a candidate's staged phase from its
  established phase, because a revision that was staged, established and then
  superseded has moved twice while carrying one lifecycle stamp.
- A change to a document is counted where content became truth rather than
  where it was written, so staging moves no count and acceptance counts as the
  write it performs.
- The gateway knows an item as at most one staged candidate plus the relations
  its acceptance writes. The domain names the kinds and compiles them; the
  gateway carries no document vocabulary.
- Order keys are minted as an item is staged, each insert of a group counting
  the ones staged before it. Minting at acceptance would make an item's own
  content depend on when it was answered.
- A propose-only refusal is its own outcome answered as 403. The caller
  authenticated correctly, and a 401 would send it to rotate a working secret.

One product surface was added beyond what this document named: `propose` is a
command on the document transport, beside the structural gestures already
there. An in-application proposer — an import, a bulk transform, which this
document names as the reason the model is not the agent's — reaches a document
through the same transport its editor does, and it is what lets the browser
scenarios stage a proposal without a surface that stages one.
