# BO_0254_REFACTOR_change-documents-as-members

Status: completed

Requested: 2026-09-16, the first part of `BO_0253` (documents and decision extensions). An
extension's change documents stop being block documents and become its own `ext.source` members
under `docs/changes/`, rendered read-only by the Extensions section.

This part is first, and the order is the reason it exists separately. While a change row opens as
`ui.shell:document`, moving the document surface out of the shell would force `ui.shell` to
declare a dependency on `documents`. Doing this first means that dependency never exists, and the
Extensions section ends up needing neither of the two extensions `BO_0255` and `BO_0256` create.

## Where This Starts

- **A change document is a `document` node** carrying `change` — the extension's id — and
  `changeStatus`, listed under its extension in the Extensions section, created by the row's `+`
  or by an agent's `create_document`, shaped in the block editor, its status chosen from the
  control the editor draws (`block-editor.tsx:2149`) or proposed by an agent's `status` gesture
  and moved by acceptance (`BO_0222`).
- **The section reads them through a second path.** `readExtensionDocument` builds the
  extension's network from its `docs/` members and then calls `listChangeDocuments()`, a separate
  read over document nodes, grouping the result with `groupChanges` from `src/lib/changes.ts`.
  Two reads, two shapes, one section.
- **An extension's topics are already members.** `ext.source` under `docs/system/<area>/`,
  rendered by `src/lib/owner-docs/` in the `extension` view with no editor anywhere on the path.
- **The conversion ran once in the other direction.** `kernel import-changes`
  (`internal/kernel/changeimport/`) turned every extension's `docs/changes/` files into document
  nodes, and `AGENTS.md` records that a second import cannot revise a document already there
  (`BO_0224_016`).
- **The Markdown already exists.** `scripts/export-graph.sh` writes each change document as the
  Markdown it reads as, under `graph/documents/<extension>/`. The migration's input is what the
  export already produces.
- **The protocol is fixed in three places**: `AGENTS.md` (The Docs In The Graph), 
  `docs/process/change-process.md` (Documentation Structure, Change Documents) and
  `docs/changes/README.md`.

## Shape

- An extension's change documents are `ext.source` members at `docs/changes/<PREFIX>_NNNN_TYPE_<short-name>.md`
  in its own subtree — the form this repository uses — with the `Status:` line carrying what
  `changeStatus` carries today.
- The Extensions section lists them from the extension's members, filtered and grouped by the
  `Status:` line its parse reads. `src/lib/changes.ts` keeps the filter rules and loses the
  grouping over document summaries; the status parse joins `src/lib/owner-docs/parse.ts`.
- A change opens in the `extension` view by its member path, **read-only**, the way a topic does.
  `listChangeDocuments()` and the `ui.shell:document` row target go.
- The `document` declaration drops `change` and `changeStatus`; the block editor drops its status
  control; `setChangeStatus` and the `documents/[id]` status route go with them.
- The kernel's `create_document` drops `change` and `status`, and `propose_document_changes` drops
  the `status` gesture. A change document is written by the same tools that write any other docs
  member, in the proposal that carries the code.
- A status is set by accepting the proposal that changes the `Status:` line. The protocol's words
  become *only the user may establish* a `draft` or `ready` status rather than *only the user may
  set* it, and the rule that an agent never promotes is unchanged.
- The 45-odd existing change documents across `ui.shell`, `settings`, `publishing`,
  `calliopa-video` and `calliopa-show` are converted to members in one migration and their
  document nodes retired. Completed documents stay under the extension they were made against.
- `scripts/export-graph.sh` stops writing `graph/documents/<extension>/`: a change document is a
  tree file and appears under `graph/tree/` like every other member. `graph/README.md` follows.

## Decided

Inherited from `BO_0253`, Decided. The two that govern this part:

* **Change documents stop being block documents**, becoming `ext.source` members rendered
  read-only by the Extensions section through `src/lib/owner-docs/`, reversing `BO_0222`'s move
  from files to documents. User decision, 2026-09-16.
* **A status is set by accepting the proposal that changes it.** A status control on the row and
  a CLI-only path were both rejected: acceptance is already the one non-delegable human action in
  the architecture, and a second path would weaken it. User decision, 2026-09-16.
* **The section's `+` goes.** A change document is created the way every other docs member is:
  an agent stages the file and the user accepts it. User decision, 2026-09-16.
* **A composer run cannot write a change document.** `create_document` loses `change` and
  `status` entirely; a change document belongs to its extension's subtree and is written in the
  proposal that carries the code, which is a checkout-based flow. User decision, 2026-09-16.
* **No `kernel export-changes` verb.** The inverse of `import-changes` is a checkout, a write and
  a commit, which the tool already has, and nothing has asked to run it twice. Agent decision,
  2026-09-16, no product consequence.

## Open

Nothing is open in this document. The two questions it carried at `idea` were answered on
2026-09-16 and stand in Decided above; the third is now `validation.md`
`BO_0254_007` in `calliopa-bootstrap` — whether dropping `change` and `changeStatus` from the
`document` declaration while established content carries them is a class the compatibility check
refuses — which is established during implementation rather than guessed here.

## Transferred

Enumerated 2026-09-16, the day the user promoted this to draft.

- `calliopa-bootstrap`: `extension-model.md` `BO_0254_001` (the protocol in `AGENTS.md`,
  `change-process.md` and `docs/changes/README.md`), `BO_0254_002` (the three skills that teach
  it), `BO_0254_003` (the migration); `ui-kernel.md` `BO_0254_004` (the document tools lose every
  change-document gesture), `BO_0254_005` (`kernel import-changes` retired);
  `repo-structure.md` `BO_0254_006` (the export stops writing `graph/documents/`);
  `validation.md` `BO_0254_007` (the compatibility class).
- `ui.shell`'s graph docs, staged as `node:chg-42f09ce1255fe058` from a checkout at dataRevision
  1109, docs only: `documents/block-document-model.md` `BO_0254_008` (the declaration and the
  server functions), `workspace/layout.md` `BO_0254_009` (the Extensions category over members)
  and `BO_0254_010` (`readExtensionDocument` and the owner document),
  `documents/document-panel.md` `BO_0254_011` (the change panel goes),
  `workspace/contribution-contract.md` `BO_0254_012` (the section stops declaring
  `kind: "document"`), `foundation/verification.md` `BO_0254_013` (verification) and
  `BO_0254_014` (the release-notes line).

## Implementation

Implemented, verified and walked 2026-09-16. The three proposals were accepted, the stack
rebuilt and the release pin advanced to 1117; the user walked the Extensions category and the
Documents category and found them as specified.

- **Repository, uncommitted**: the protocol in `AGENTS.md`, `docs/process/change-process.md` and
  `docs/changes/README.md`; the document tools stripped of every change gesture and
  `kernel import-changes` retired with `internal/kernel/changeimport`, whose render half is now
  `internal/kernel/docrender`; `extarchive` no longer carrying `document` nodes, an older
  archive's naming each under `documentsSkipped`; the graph export's per-extension document
  directories gone; `validation.md`'s answer to `BO_0254_007` with the test that pins it; the
  release-notes line; `.local/retire-change-documents`, the one-time migration.
- **Graph, staged**: `node:chg-4b31d060950e41c7` — the shell half (the declaration, the server,
  the section, the editor, the owner document and their tests), the 85 change documents as
  members of their five extensions, this document among them, and the three skills;
  `node:chg-c6a0561873915fae` — the verification and release-notes fold;
  `node:chg-0e1d679c884be040` — the 85 `document` nodes retired, one `RETIRE` each.
- **Verification**: `tsc` clean, 762 unit tests, the production build, the behaviour project
  green under the kernel harness (106 tests, seven consecutive runs after one unreproduced
  failure), `go build`/`go vet` and the touched Go packages including the archive
  create/export/import verification. The Garage-gated blob tests and `internal/architecture`'s
  kernel-boundary test fail for reasons that predate this change.
- **On the instance**: after the acceptances the graph holds no change document as a node and
  88 as members across the five extensions; the `document` declaration carries `intention`,
  `record`, `phase` and `supersededBy` and a permitted set for `phase` alone; the rebuilt kernel
  offers no `import-changes`; the promotion gate built the tree and advanced the pin to 1117.

## Out Of Scope

- Moving any part of the document surface. `documents` leaves the shell in `BO_0255`; this part
  only stops extension administration from depending on it.
- This repository's own `docs/changes/` files, which are already what this part makes the graph's
  change documents into.
