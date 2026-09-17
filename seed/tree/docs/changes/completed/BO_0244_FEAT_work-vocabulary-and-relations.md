# BO_0244_FEAT_work-vocabulary-and-relations

Status: completed

Implemented 2026-09-13. The kernel half (`BO_0244_001`–`BO_0244_005`) is in this repository, its tasks converted to truth in `docs/system/ui-kernel.md`, and its verification passes (`go test ./internal/kernel/...`; the shell's behaviour suite through the kernel harness, 60 tests). The shell half (`BO_0244_006`–`BO_0244_012`) is staged as proposal `node:chg-a64276fb6dfc7aeb` — 16 files and 9 members: the seven vocabulary members and the two revised skills — with the three graph docs carrying the tasks as truth; the transfer proposal `node:chg-252f39fae6991892` is superseded by it and is to be rejected. The user rejected the transfer, accepted the implementation and promoted it on 2026-09-13: served from pin 404, the widened vocabulary answered by `GET /v1/schema` at head 405, the kernel rebuilt with `scripts/stack-up.sh`. The graph was exported at head 405 and this document carried into the graph at completion.

Requested: 2026-09-13, the first part of `BO_0243` (decision and refinement). The material's sections 4, 7, 10, 28, 29, 31, 32 and 33: the block as the one primitive, stable assertion identity, body depth, reason-bearing relations, their origins, provenance and lifecycle.

## Where This Starts

- **A relation carries no properties.** `Relation` is type, two endpoints anchored at revisions, polarity and a validity window (`data-model.md`); its type is resolved against the schema; changing a target or polarity is close-and-create (`BO_0027_002`). *The semver range stays content, because a Relation stores no properties* (`ui-kernel.md` `BO_0118_001`). The reason a relation exists has nowhere to live on the edge.

- **An enrichment is a node.** *An enrichment (trust score, source authority, entity-resolution link, conflict flag) is itself a Node + NodeRevision, connected to the content it describes by an ordinary Relation — not a separate mechanism* (`data-model.md` `BO_0029_003`, `BO_0029_004`). That is the shape a reason-bearing relation takes.

- **The shell's vocabulary is its own.** `document`, `text`, `divider` and the relation type `retired` are `ui.shell` members declared as `ext.blocktype` and `ext.relationtype`, staged through `kernel commit --members`, enforced by CCGW's Validation on every write (`BO_0207_011`). Widening a permitted set is an ordinary change; narrowing is breaking ([Block Document Model]). `text` permits `role` and `disposition`; `document` permits `intention`, `record`, `change` and `changeStatus`.

- **Staged relations anchor at candidates.** Under proposal scope a `RELATE` anchors at the group's candidate of its origin, staging a content-unchanged carry-forward of the origin when nothing else revised it; the target gains no revision (`BO_0084_004`, `BO_0130_002`). Accepting the member re-anchors the relation onto the endpoint's current established revision (`BO_0113_006`). A relation whose origin is a fresh node therefore touches no existing block's single open candidate.

- **The document tools know four item kinds and a status.** `propose_document_changes` stages `replace`, `insert`, `remove`, `move` and `status` into the run's group (`internal/kernel/agenttools/documents.go`, `BO_0207_004`, `BO_0222_002`); `read_document` answers the blocks with their runs, role and disposition (`BO_0227_004`). The shell's `readDocumentProposals` derives a document's items from each open group's touched set and knows the same four kinds ([Proposed Changes]).

- **The shell reads one hop.** A document read is rooted at the document over `CONTAINS` and `retired`, bounded by relation type and one hop, so it never walks into the rest of the graph ([Block Document Model], Implementation).

- **Provenance is already recorded, unread.** Every revision carries `createdBy` and its lifecycle; `INCLUDE HISTORY` answers the chain (`ccgw.md` `BO_0002_015`). Whether a block was written by a person, drafted by a run and accepted, or accepted and then edited, is in the graph and drawn nowhere.

## Intent

* **A relation between two blocks is a node that says why.** It carries its kind, its reason in the reader's or the run's words, its origin — declared, derived or inferred — and its lifecycle state, and it is joined to its source and its target by edges. A reason is what makes propagation precise; a bare edge is too coarse to carry consequence (material §28).

* **Inferred is proposed.** A relation a run infers is a candidate until a person confirms it; confirming it does not turn the drafted reason into human-authored truth. Its origin, its reason's authorship, who confirmed it and every later edit stay readable (material §31).

* **A block asserts one or more claims, each with an identity of its own.** Wording changes on the block; meaning lives in its claims, stated in canonical words distinct from the wording, and relations are anchored to claims, so a rewording and a change of meaning can be told apart and a block that says two things can be depended on for one of them (material §7). User decision, 2026-09-13, over one claim per block.

* **Prose over taxonomy.** A block's kind and claim, and a relation's origin and state, are never drawn as permanent badges on the reading surface. They are read by the layers that unfold on focus and by the runs that reason over them (material rule 13).

* **Every write of these is an ordinary document operation**: compiled by the shell into one atomic mutation through the kernel bridge, proposed by a run through the document tools, answered per item where it is read, and refused with a reason. Nothing here adds a primitive.

## The Shape

A proposal for the transfer; the kinds and sets below are mutable and start small.

- **`text` gains `kind`**, optional, permitted with the material's full list: `assertion`, `question`, `observation`, `assumption`, `alternative`, `argument`, `evidence`, `concern`, `consequence`, `requirement`, `proposal`, `decision`, `synthesis`, `tension`, `frontier` and `next`. Absent means plain prose. `synthesis`, `tension`, `frontier` and `next`, and the `alternative` and `consequence` blocks a run derives, are what `BO_0246` maintains — a derived block is told by its `derivedFrom` edges and its provenance, not by a kind of its own; the rest are what a reader or a run says a block is. User decision, 2026-09-13, over a small starting set.

- **A `claim` node type**, declared by `ui.shell` as a non-block member with `id` and `text` (runs) required: an assertion in canonical words. An `asserts` edge from a `text` block to each claim it makes, in the block's order. A block gets its claims when a relation is declared on it or when a run drafts them; a block with no relations needs none. A claim belongs to one block; a split or merge of the block moves its claims with the words that carry them, which the shell decides as it decides the role. `BO_0248` is what compares a claim's revisions.

- **A `relation` node type**, declared by `ui.shell` as a non-block member with `id`, `kind`, `reason` (runs) and `origin` required, `state` optional. `kind` is permitted with the material's full list: `dependsOn`, `supports`, `contradicts`, `qualifies`, `constrains`, `implements`, `supersedes`, `evidences`, `opensQuestionIn`, `affectedBy` — *derives from* is the `derivedFrom` provenance edge below and not a reasoned relation (user decision, 2026-09-13, on the full list); `origin` is `declared`, `derived` or `inferred`; `state` is `declared`, `exercised`, `needsReview`, `orphaned` or `retired`, absent meaning `declared`. *Proposed* is not a state: it is the node being a candidate. `singleOpenCandidate` holds, as on every block type.

- **Two edges**, `source` and `target`, from the `relation` node to a claim. From the relation node, so staging a relation revises neither claim nor block: the group's candidate is the relation node alone, the edges anchor at it, and a block with an open proposal of its own still takes a relation. Declaring a relation on a block that asserts no claim yet drafts the claim in the same mutation, so the anchor exists before the edge. A relation may cross documents; it may not target a claim of a retired or discarded block.

- **`derivedFrom`**, an edge from a block to a block it was derived from, so *system-maintained from two accepted blocks* is a fact the graph holds. A run stages it beside the block it drafts.

- **Reads.** The document read gains a second bounded read: the document's blocks' claims, and the `relation` nodes whose `source` or `target` is one of them, with the other endpoint's claim, block, document, words and acceptance state. It is its own request, as the change count is, so a document that has no relations pays nothing.

- **Provenance is read, not stored.** `readBlockProvenance` walks a block's history: authored by a person; drafted by a run and accepted by a person; drafted, accepted and edited since; or maintained — a block whose every revision a run drafted and that carries `derivedFrom`. The words come from the same table wherever provenance is drawn (`CA_0046`).

- **Operations** in `src/server/documents/documents.ts` and one command each on the command route: set a block's kind, add, revise or drop a claim of a block, declare a relation, edit a relation's reason, set its state, retire it. Retiring is a state, never `RETIRE`: a retired relation stays readable with its record (material §32), where the core's `RETIRE` hides a node from every read.

- **The document tools** — kernel half. `read_document` answers each block's kind, claims and provenance and the document's relations. `propose_document_changes` gains item kinds `relate` (kind, reason, origin, source claim, target claim), `reason` (a relation's new reason), `kind` (a block's), `claim` (add or revise a claim of a block), and `derive` (`derivedFrom` edges on a block the same group inserts). The item vocabulary is read from `GET /v1/schema` at `tools/list` as the existing sets are.

- **Review in place** — shell half. A proposed relation is an item of the document each end sits in, drawn under its source block in the proposer's idiom with the target quoted and the reason shown, answered by the same icons every item has ([Proposed Changes In Place]); editing its reason accepts it, as editing a rewrite does. A declared relation is drawn only in the block's depth (`CA_0046`), never on the resting surface.

- **The confirmation gate** classifies `claim`, `asserts`, `relation`, `source`, `target` and `derivedFrom` as content: a member of these executes without the confirmation round-trip, as a block does (`BO_0207_001`, `BO_0235_001`).

- **The base skill** (`calliopa-base.working`) and `ui.shell.documents` learn the item kinds, and that a relation needs a reason before it is proposed and a claim before it is anchored.

## Decided

Answered by the user on 2026-09-13.

* **The material's full kind and relation-kind lists from the first day**, as the permitted sets above; a small starting set was the alternative. The `refine` skills carry the discipline of naming one precisely.

* **Several claims per block**, each a `claim` node with its own identity, joined to its block by `asserts`; relations anchor on claims. One claim per block, with a split for a block that says two things, was the alternative.

* **A person's declared relation is truth**, written through the block's depth as every human content write is; a run only proposes. Treating every relation as a proposal was the alternative; `BO_0250` may revisit it for a branch.

## Depends On

- Nothing in the set. `CA_0046` renders what this declares, and every later part anchors on it.
