# Proposals Land As Structure

Status: completed

An agent's proposal should reach the reader as the structure of what it wrote — headings as heading blocks, sections as their own blocks — instead of one block holding the whole answer. The rule belongs in a guide inside Calliopa: the `ext.skill` member the run reads, not prose the kernel composes. The kernel's own instruction contradicts it today and is the only fixed-layer part of this change.

## What Is Wrong Today

- A run aimed at a document answers with one block: the documents skill's `prompts` convention says *the answer is one insert placed directly after the block the command was sent from*, and the kernel says the same in the run's instructions (`internal/kernel/agentbridge/bridge.go`, `deliveryNote` under a source; `ui-kernel.md`, Blocks As Commands, `BO_0267_003`). A long answer therefore lands as a wall of text a reader cannot accept, reject, mark or relate in parts.
- The block model already carries the structure the answer needs: a `text` block's role is one of `paragraph`, `h1`, `h2`, `h3` or `quote`, one block per paragraph, and each item of a proposal is answered on its own in the editor (`documents`' [Block Document Model](../../graph/tree/src/extensions/documents/docs/system/documents/block-document-model.md); the skill's `readerAnswersPerItem` convention). Nothing renders Markdown inside a block, so `## Heading` written into a block's runs stays literal `#` characters in the document.
- Guidance on what a run stages lives in `ui.shell.documents`, the `ext.skill` member of `documents` in the graph — the guide a run aimed at a document reads (`ui-kernel.md`, `skillsForRun`). That is where this rule goes.

## Scope

* An agent's proposal lands as the structure of its content, not as one block. User request, 2026-09-20.
* The rule is carried by a guide inside Calliopa — an `ext.skill` member — rather than by kernel-composed prose. User request, 2026-09-20.
* Content is split at its headings (h1, h2, and the levels below) where the content has any. User request, 2026-09-20.
* One block per paragraph: under a heading, each paragraph of the section is its own `text` block, as the editor reads a block. User decision, 2026-09-20.
* A list becomes one block per item, its marker left as plain text; a fenced code block and a table each stay one block, because each is one unit. User decision, 2026-09-20.
* A rewrite carries the same structure: a run rewriting one block into content with headings stages the replace beside the inserts, and the rationale says the items belong together. User decision, 2026-09-20.
* The rule reads the same at every length. There is no size below which a run keeps the answer in one block: short content carries no heading and is one paragraph, so it lands as one block by the rule rather than by an exception. User decision, 2026-09-20.
- The guide is `ui.shell.documents`, the `documents` extension's skill: it teaches the document tools, and every run working in a document reads it whatever the document's intention.
- The guide's rule covers every staged body of new content, not the answer to a question alone: the content an insert adds anywhere, and the body a run stages into a document it creates while the `start` delivery stands (`ui-kernel.md`, Starting A Document From A Command, where retiring `start` is open work of its own).
- A heading becomes its own `text` block with the matching role, never `#` characters in a block's runs; the blocks under it follow it in reading order.
- The guide says nothing about inventing structure: content that carries no heading is not given one.
- The kernel stops prescribing the shape. `deliveryNote`'s *answer it with one insert placed directly after that block* becomes a placement rule that says where the answer goes and leaves what it is made of to the guide, so the instructions and the guide no longer contradict each other.
- A list role for the block vocabulary is out of this change: the role set stays `paragraph`, `h1`, `h2`, `h3`, `quote`, so a list item's marker is plain text in its block. Widening the vocabulary and teaching the editor to render a list is its own change.
- The reader can reject a rewrite's replace and accept its inserts, leaving the rewritten block beside the new sections. This change accepts that: the rationale is what tells the reader the items are one change, and nothing here makes a group answerable as a unit.

## Where The Halves Land

- Transferred 2026-09-20. The fixed-layer half is `docs/system/ui-kernel.md`, *Proposals Land As Structure*: the `deliveryNote` sentence (`BO_0270_001`), the golden renderings (`BO_0270_002`), the release-notes line (`BO_0270_003`) and the kernel rebuild that serves it (`BO_0270_006`).
- The guide half is `documents`' [Proposed Changes](../../graph/tree/src/extensions/documents/docs/system/documents/proposed-changes.md), *Proposals Land As Structure*: the revision of the `ui.shell.documents` member through `kernel commit --members` (`BO_0270_004`) and the live walk that verifies it (`BO_0270_005`). Staged into the graph as proposal `node:chg-e2288066cfa3d231` for the user to accept.
- Implemented 2026-09-20. The kernel half is landed and verified (`BO_0270_001`–`BO_0270_003` are truth); the guide revision and the fold of `BO_0270_004` are staged in the graph as proposal `node:chg-f5c160533891a174`. What remains is the user's accept, the kernel rebuild (`BO_0270_006`) and the live walk (`BO_0270_005`), which the change cannot complete without.
- `BO_0271` revises the same guide and the same `deliveryNote` branch. The two are independent in what they ask for; whichever lands second folds the other's words rather than replacing them.
- The change document is carried into the graph as a member of `documents`, at the status it holds here, no later than completion.

## Verification

- Walked live on the instance on 2026-09-20 at pin 664–670, four runs on Claude Code through a retired probe account, each aimed at the `Test` document.
  - A command whose answer has two sections and a list (`arun-2c8f0c6459bb6774`) staged eight blocks: two `h2` heading blocks, a paragraph under each, and one block per list item with its `-` marker as plain text. No `#` characters in any block's runs.
  - A one-sentence question (`arun-8d4951df266c1d42`) staged one block, by the rule rather than by an exception.
  - A rewrite into sections (`arun-6b230e82882752dd`) staged the replace of the named block beside a new `h2` and a new paragraph, all in one group.
  - A run sent from a block (`arun-c152578638c2ac8b`, from the prompt *what does #1 mean?*) staged its answer at order key `t`, directly after that block at `r`: the reworded instruction places the answer and the guide decides what it is made of.
- The kernel half is verified in `agentbridge`: the new sentence in `source_test.go`, the golden renderings byte-identical, and the assertion shown to bite with the old sentence restored.

## Graph And Release Notes

- This change lands in the graph — the guide is a member of `documents` — so it closes with `scripts/export-graph.sh` and leaves `graph/` in the working tree.
- `documents` is `bundled` and the kernel is the fixed layer, so a release carries both: the change writes a line into `docs/release-notes/unreleased.md` before it completes.
