# BO_0233_FEAT_proposals-by-their-agent

Status: completed

Requested: 2026-09-10, at the `BO_0228` walk-through, after a Claude run's proposal read *Proposed rewrite · staged by agent:hermes*. **Create a change doc for that. I want to see which agent proposed a change. This should also be visible by a different background color. Show a small icon head centered over the left border of the block. Remove "Proposed rewrite · staged by agent:hermes". Also, change the accept/reject buttons: use Phosphor icons, and show them at the top (right-aligned) of the block. The text should use the same space as the accepted blocks. I also want to be able to edit them right away; editing leads to acceptance. I also want to drag-reorder them; this doesn't accept them.** User statement.

## Where This Starts

- **The row names the account, not the agent.** `ProposalRowView` (`src/components/views/block-editor.tsx`) prints a kind label from `PROPOSED` (*Proposed rewrite*, *Proposed new block*, *Proposed removal*, *Proposed move*) and *· staged by* the group's `stagedBy`. `readDocumentProposals` (`src/server/documents/documents.ts`) builds `stagedBy` from the candidates' `createdBy` stamps (`BO_0209_006`). Every agent run stages under one account, `agent:hermes`, which the kernel binds whatever the agent (`BO_0206_008`). So Codex, Claude Code and Hermes all read as *agent:hermes*. On the `BO_0228` walk-through the reader took a Claude run's proposal (`arun-76bab81a2d197c5e`) for Hermes's work.

- **Which agent it was is already in the group.** When a run stages anything, the bridge stages an `agent.run` provenance node into the same group before the run closes (`stageRunSummary`, `internal/kernel/agentbridge/bridge.go`). That node carries `agent` (`codex`, `claude-code`, `hermes`, `provider`) and `executedBy`, for example `claude-code (claude-sonnet-5)` (`BO_0228_006`). `readDocumentProposals` already reads every node in the group (`MATCH (n) WHERE n._proposal = $g … INCLUDE CANDIDATES`), so the agent is among the nodes it fetches and ignores. A group a person staged has no `agent.run` node.

- **The faces exist.** `AGENT_FACES` in `src/lib/agent-menu.ts` holds the three characters' crops that `BO_0228` added (Codey, Clauderic, the barista robot), served from `public/agents/`.

- **The row is laid out as a row, not a block.** `.proposal-row` (`src/components/views/block-editor.css`) is a wrapping flex line: the uppercase label, the text as a flex item from 12rem, and *Accept*, *Reject* and *Accept all* as text buttons after it. An accepted block is a `.block-row` with the grip gutter held open on both sides (`--block-grip-gutter: 1.75rem`) and its role's typography. A proposed heading therefore reads as a line of body text beside a label, narrower than the heading it would become.

- **Its colour is one accent for everything.** Every proposal takes the accent edge and `color-mix(… var(--accent) 8%, var(--panel))`. The theme is a fixed token table (`THEME_TOKENS`, `src/lib/theme.ts`), and the behavior suite refuses any literal colour in a stylesheet (`tests/behavior/theme-tokens.test.ts`), so a colour per agent means new tokens.

- **Answering is one decision per member, through the kernel.** `answerProposal$` calls `answerDocumentProposal`, which asks the kernel to accept or reject each member of the item and re-reads the document. `acceptGroup$` accepts the group's items one by one. The shell already has Phosphor's `check-circle` and `x-circle` in its icon set (`src/components/shell/icons.tsx`, taken unaltered from `@phosphor-icons/core@2.1.1`).

- **Established blocks already move by drag, key and button.** A drop compiles into the same `move` command the *Move block up/down* buttons issue (`dropOn$`, `block-editor.tsx`). Proposal rows take no part in it.

- **Three rules this request reverses** are written in `docs/system/documents/proposed-changes.md`:

- *"A proposed item is not markable and not activatable."* Editing needs it activatable.

- *`.proposal-row` … carries a standing label naming what is proposed. Three signals rather than a tint.* The label goes, and a tint per agent comes.

- *"Nothing here stages a proposal. The editor answers what another caller staged."* Dragging a proposal changes where it would land, and that place is kept in the proposal (Decided), so the reader stages it.

## Intent

* A proposed change says which agent proposed it, at a glance: by the agent's face on the block's left border, and by a background colour of its own. A person's proposal says who.

* A proposal reads like the block it would become: the same width, the same role typography, in the place it would take. What marks it as unanswered is its colour, its face and its answer icons — not a line of label text.

* Accepting and rejecting are Phosphor icons at the block's top right.

* Editing a proposed block is accepting it: the reader's first change establishes the proposal, and the edit is saved on top as the reader's own revision.

* Dragging a proposal to another place changes where it would land. It does not accept it.

* Colour is never the only signal: the face and each block's accessible name say the same.

## The Shape

### Who proposed it

- **`readDocumentProposals` names the proposer per group.** Beside `stagedBy`, each group gains `proposer`:

- `{kind: "agent", agent, executedBy}` from the group's `agent.run` node;

- `{kind: "person", name}` from `stagedBy` when a person staged it (no `agent.run` node);

- `{kind: "agent", agent: null}` when the stamp is an agent account but no provenance node was staged — a run whose provenance write failed. It says *an agent*, never a guess.

- **A run from before `BO_0228`** reads through its record's `agent`: a `claude-code` run from when Claude was a worker under the API-key controller shows as Claude Code only if its `executedBy` says it was observed delegating; otherwise it shows the controller that reasoned. The provenance node already says which, so nothing is inferred.

### The block

- **A proposal is drawn as a block.** It takes `.block-row`'s geometry and its role's typography: the text column is the accepted blocks' column, and a proposed heading looks like the heading it would be. The current label line (*Proposed rewrite · staged by …*) is removed.

- **The face sits centred on the left border.** A small circle — 24px, the agent's crop from `AGENT_FACES`, a person's Phosphor `user` glyph — straddles the block's left edge, half in the gutter and half over the border, so it takes none of the text's width. It carries the proposer's name as its accessible name (*Proposed by Claude Code (claude-sonnet-5)*), and the block's own accessible name says what it proposes and by whom.

- **Each proposer has a background colour.** New theme tokens, in both themes: `proposal-codex`, `proposal-claude`, `proposal-hermes` and `proposal-person`, each a ground tint with the matching border colour, chosen so body text keeps AA contrast on it. An agent with no known name takes `proposal-person`'s neutral treatment with the robot glyph.

- **The kind is still told, without the label.** A replace sits right after the block it rewrites, so the pair is read as before and after. A new block sits where it would land. A removal draws the block it would retire in the proposer's colour with its text struck through. A move is marked where it stands, in the proposer's colour, with Phosphor's `arrows-down-up` beside the answer icons; where accepting would put it is said in its accessible name (Decided). Each block's accessible name keeps the kind in words.

- **It must not collide with the gutter.** `BO_0231` is placing standing icons in the leading gutter in command mode, and the grip lives there too. A proposal is not markable and has no standing, so its face takes the gutter's place on that row alone. This lands after `BO_0231`, or coordinates with it if both are open.

### Answering

- **The answer icons sit on the block's top edge, right-aligned**, half above it like the face on the left, so they take no line of their own and none of the text's width:

- Phosphor `check` — *Accept*;

- Phosphor `x` — *Reject*;

- Phosphor `checks` — *Accept all*, only when the group holds more than one item.

Each is a button named in words with the kind and the proposer (*Accept Claude Code's rewrite*). Targets are at least 32px with a pointer and 44px on touch. The paths are taken unaltered from `@phosphor-icons/core@2.1.1`, as the icon module requires. A stale item keeps *Reject* alone, as today.

### Editing accepts

- **A replace or a new block is editable in place.** Clicking into its text places the caret and accepts nothing: a reader may select or read. **The first change to the text accepts the item** — the kernel's member decisions, as the check icon does — and the edit is then saved on the now-established block as the reader's own revision, through the editor's ordinary save. The acceptance waits until the typing pauses or the reader leaves the text, so the proposal never turns into the block under a typing hand (`BO_0233_014`, found on the walk-through).

- **Nothing typed is lost across the acceptance.** The keystroke that caused it is held, the caret is carried across the re-read as a structural move already carries it (`dropOn$`), and the held input is applied to the established block. If the acceptance is refused — a conflict, or a decision the kernel keeps behind its confirmation — the edit is not applied, the proposal stays as it was, and the notice says why.

- **Only that item is accepted.** Editing one item of a group leaves the rest of the group unanswered.

- **A removal is not accepted by editing.** It marks an established block, which stays readable and editable as the proposed-changes rules already say; editing it answers nothing, and the icons answer the removal.

### Dragging does not accept

- **A new block, a replace and a move can be dragged** to another place among the blocks. A removal cannot, since it proposes no place.

- **The face is the handle.** Pressing and dragging it moves the proposal with the editor's own drag, drop marks included. For a keyboard and for a pointer that will not drag, the face is focusable and `ArrowUp`/`ArrowDown` move the proposal one place, since no gesture is the only path to a lasting action (`BO_0227`).

- **Nothing is accepted.** After the drop the proposal stands unanswered in its new place, in its proposer's colour; accepting later lands it where the reader put it.

- **The new place is kept in the proposal.** The reader stages the item's new `order` into the same group through the existing `propose` path, so the place survives a reload and shows on every device. The proposer stays the agent — the face and colour come from the group's `agent.run` node, not from who wrote last — and the reader's reorder shows in the group's record as the reader's candidate. The proposed-changes rule *"Nothing here stages a proposal"* becomes *"a reader stages only a proposal's place"*.

### Server and records

- **`ProposedChange` and the group shape** carry the proposer. The route `GET /api/x/ui.shell/documents/[id]/proposals` answers it.

- **Accept on edit** reuses `answerProposal` and the editor's save path; no new route.

- **Reordering** stages the new `order` into the item's own group through the existing `propose` path: a candidate revision of the inserted, rewritten or moved block, and nothing else.

## Out Of Scope

- **A different account per agent.** The kernel binds one agent account for every run (`BO_0206_008`), and changing who may stage is an authority change, not a display one. The proposer is read from the provenance the run already writes.

- **Changing what an agent may propose,** or who may accept (`BO_0212`).

- **Acceptance by anything but a person's act.** Editing is the reader's act on the proposal, so it is acceptance; dragging is not, and neither is opening or selecting.

- **Proposals outside documents** (extension source), which are reviewed in the graph browser.

- **Undoing an acceptance** by the undo keystroke — unchanged: answering is a saved operation.

## Decided

Decided by the user on 2026-09-10, on the two points this change could not settle for itself:

- **A dragged proposal's place is kept in the proposal.** The reader stages the new `order` into the same group, so it survives a reload and shows on the phone, and accepting lands it there. Keeping it on the device only, applied as a move after acceptance, was the alternative and was not chosen.

- **A proposed move is marked where it stands.** Tinted in its proposer's colour at its current place, with Phosphor's `arrows-down-up` beside the answer icons; where it would go is in its accessible name. Drawing it once at its destination with the face at its origin, and drawing it twice, were the alternatives and were not chosen.

## Verification

- **Server:** `readDocumentProposals` over the scratch graph (`TestShellDocumentsOverCCGW`): a group with an `agent.run` node names its agent and `executedBy`; a person's group names the person; an agent-stamped group without the node says an agent; a pre-`BO_0228` Claude run names the controller or Claude as its provenance says.

- **Pure functions** (`src/lib/`): the proposer's face, colour token and accessible name; where a dragged or arrow-moved proposal lands; which input accepts (the first change, not a caret or a selection).

- **Render harness,** through a real `.tsx` host, with the proposals arriving after mount (the lesson in `qwik-member-props-freeze`): the face on the left border with its name, the colour per proposer, no label line, the three icons named in words at the top right, *Accept all* only for a group, typing into a proposal sending the acceptance then the save, a refused acceptance leaving it standing with a notice, the arrow keys on the face moving it without accepting. Each shown to bite.

- **Theme:** the four tokens in both themes, AA contrast for body text on each, and the theme-token check green.

- **On the instance:** one proposal each from Codex, Claude Code and Hermes in one document, each with its own face and colour and no *staged by* line; accept one with the icon, reject one, edit the third and find it accepted with the edit on top; drag a fourth elsewhere, reload on the phone and find it still unanswered in its new place, then accept it there and find it landed where it was dragged.

## Transfer

Transferred on 2026-09-10 as `BO_0233_001`–`BO_0233_010`, all in `docs/system/ui-shell.md` under *Proposals By Their Agent*, since every part is `ui.shell` content. Checked before transfer: CCGW admits a person's staging into any open group — `proposalScope` (`internal/ccgw/service.go`) checks only that the group exists and is open — so keeping a dragged place in the proposal needs no kernel or CCGW change. The kernel's `stage` verb refuses a node restaged within 250 ms (`stageFloor`, `internal/kernel/serve/stage.go`), which is why arrow moves are staged once they pause.

- `_001` the proposer per group, and `_002` the colour tokens.

- `_003` the pure decisions.

- `_004` the block and `_005` the icons.

- `_006` editing accepts, and `_007` dragging does not.

- `_008` the graph's docs, `_009` the tests, `_010` the walk-through.

Order: `_001`–`_003` need nothing. `_004` and `_005` need them. `_006` and `_007` need `_004`. `_008` and `_009` go with their rows. `_010` needs everything, accepted and promoted. The change lands after `BO_0231`, which is in the same gutter. This document travels into the graph through `kernel import-changes --file` when the work lands (`BO_0222_013`).

## Implementation

- 2026-09-10. Claimed on the user's promotion to ready; `Status: wip`. `BO_0231`'s proposal was open on the same files (`block-editor.tsx`, its CSS and test, `block-editor.md`), so the work was built on a checkout of head with that proposal overlaid, and staged only once `BO_0231` was accepted — rebased onto head 247 as a patch that applied without fuzz, and checked afterwards: none of its nineteen files changed between 247 and 252.

- 2026-09-10. `BO_0233_001`–`_009` staged as proposal `node:chg-d74a78de18db4583`, nineteen files, as `claude` from inside the kernel container. Its overlay checkout compared equal to the tree. On the rebased tree: the typecheck, 568 unit tests, both bundles, and 52 behavior scenarios over CCGW.

- 2026-09-10. What the work found:

- Qwik's render harness had never typed into an activated block: the editor reached the global `document` and `window` on that path, which the harness does not have. Moving those reaches onto the element's own document and the global timer changes nothing in a browser and lets the accept-on-edit path be pressed end to end.

- Stubbing a global `document` for the harness breaks Qwik's own rendering (`doc.createComment is not a function`), so that is not the way in.

- A misdiagnosis, corrected before staging: a first over-CCGW run seemed to show a key staged alone losing a rewrite's words, and a fix was written; the run had targeted a divider. With a text block the key alone keeps the words, the fix did nothing a mutation could detect, and it was removed.

- 2026-09-10. Accepted and promoted at **release pin 260**. The served stylesheet carried the new treatment and no `.proposal-row`. On the walk-through the user could not accept Claude's rewrite of statement #6: the shell said *This block changed somewhere else. Reload the document…*. The kernel had refused it as `member_drift_conflict` past base 207, and the block's history showed why: its words had not changed since, only its standing (keep, discard, resolve, pin, neutral — `BO_0231`'s toolbar under test). CCGW judges drift by revision, so a standing strands every pending text proposal on the block. With the user's go-ahead, fixed as `BO_0233_011`, staged as `node:chg-4b4b9b0a7362da86`.

- 2026-09-10. `_011` accepted and promoted (**pin 263**); the pinned block's rewrite was accepted. The walk-through then found typing into a proposal slow and lossy (*abc* became *a*, three seconds on), and no drag on the phone — a long press opened the text. Fixed as `BO_0233_012`, staged as `node:chg-9124d5c239114ce5` after rebasing onto head 279.

- 2026-09-10. `_012` accepted and promoted (**pin 281**). Typing into a Codex run's new block then failed with *not an undecided member*: a slow proposals read begun before the acceptance drew the accepted proposal again, and the copy asked for a second acceptance. Fixed as `BO_0233_013`, staged as `node:chg-7c426274ee40dc64`.

- 2026-09-10. `_013` accepted and promoted (**pin 287**). Typing then showed at once, but the proposal turned into the block, with the block's look, as soon as the acceptance answered, and the caret was lost. The user suggested waiting for the typing to pause, as the save does. Fixed as `BO_0233_014`, staged as `node:chg-d4d9c5d2f4669430`: a proposal is accepted and handed over once the typing pauses or the reader leaves it. Its tests also found the answer icons broken since pin 281. `answerProposal$` called `dropProposal$` before it was declared, which the optimizer leaves as a free name in the built bundle, so ✓ and ✗ threw after CCGW had recorded the answer.

- 2026-09-11. `_014` accepted and promoted (**pin 312**). The user walked `_010` on it and found it good. `_001`–`_014` folded into truth in `ui-shell.md`; `Status: completed`. This document goes into the graph as a `ui.shell` change document at `completed` through `kernel import-changes`, and the graph export follows.
