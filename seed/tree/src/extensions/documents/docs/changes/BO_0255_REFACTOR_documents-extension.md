# BO_0255_REFACTOR_documents-extension

Status: completed

Requested: 2026-09-16, the second part of `BO_0253` (documents and decision extensions). The
block document model, the block editor and the Documents section leave `ui.shell` for `documents`,
a `bundled` extension of its own. Behaviour-preserving throughout.

The decision surfaces move with them and leave again in `BO_0256`. Splitting the move in two is
what keeps each step verifiable: this part proves the document surface works from outside the
shell, and `BO_0256` proves the decision surface works from outside `documents`.

## Where This Starts

- **`ui.shell` contributes the Documents section and the `document` kind** through
  `src/contract.ts` like every extension, with the block editor as the kind's view and
  `/api/x/ui.shell/documents/**` as its table (`contributions.ts`, `contributions.server.ts`).
- **The frame barely touches the model.** Across `src/components/shell`, `src/routes` and
  `src/server/*.ts`, only `reference-chips.tsx` (`~/lib/pointing`) and
  `src/routes/api/agent/refinement/` (`~/lib/refinement`) reach into it.
- **`calliopa-video` is the precedent** (`BO_0203`): episodes, standing assets, destinations and
  two channels left the shell for an extension, with 21 vocabulary members moved by the
  materializer's move case through the members sidecar.
- **The contract already carries everything this needs**: sections with a create control, kinds
  with views, readers, a route table, and — since `CS_0001_005` — an extension importing another
  extension's server modules under a declared dependency.
- **Vocabulary is declared, not contributed.** `ui.shell`'s six `ext.blocktype` and seven
  `ext.relationtype` members move by the sidecar; `BO_0202_007`'s dependency rule means an
  extension whose vocabulary leans on another's cannot be present without it.
- **The kernel's tools read their enumerations from `GET /v1/schema`** (`ui-kernel.md`
  `BO_0207_004`), so block types and roles follow the declaration wherever it is attached. What
  is hard-coded is the fixture names — `serve/testdata/ui-shell-vocabulary.json` — and the skill
  the run instructions name.

## Shape

- A `documents` extension: `category: bundled`, prefix `DO`, `capabilities.renders` covering
  routes and views, a dependency on nothing, and both entrypoint halves.
- Vocabulary moved to it by the sidecar: `document`, `text`, `divider` and the `retired` relation
  type. `claim`, `relation`, `policy` and the five decision relation types move with them and
  leave in `BO_0256`.
- Contributed: the Documents section with its create control, the `document` kind with the block
  editor as its view, and a route table under `/api/x/documents/` — names inside the table are
  the extension's, so `d/[id]` rather than `documents/[id]` where the repetition reads badly.
- Moved source: `src/components/views/` (the block editor and its reading surfaces, `marking/`,
  `passages/`, `proposals/`, and for now `depth/`, `phase/`, `standing/`),
  `src/server/documents/`, and the `src/lib/` modules that are document work — `order`,
  `passage`, `pointing`, `proposals`, `references`, `disposition`, and for now `depth`,
  `judgements`, `phase`, `refinement`.
- `reference-chips.tsx` keeps its place in the frame and reaches `pointing` through the
  extension, or the shape it needs moves into `src/contract.ts`. `/api/agent/refinement` leaves
  the frame's routes for the extension's table.
- The `ui.shell.documents` skill becomes `documents`'s, and the run instructions name it there.
- `ui.shell` keeps the frame, the Extensions section, the `extension` and `extension-import`
  views, `readExtensionDocument` and `src/lib/owner-docs/` — and, after `BO_0254`, declares no
  dependency on `documents`.
- The shell's graph docs move with the code: the `documents` area of `docs/system/` becomes the
  new extension's own `docs/`, and the shell's `system.md` links the topics rather than listing
  them, as it already does for `calliopa-video`'s.

## Decided

Inherited from `BO_0253`, Decided. The ones that govern this part:

* **`documents` is `category: bundled`**, Apache-2.0, prefix `DO`, contributing through the same
  contract as `settings` and `publishing`. User decision, 2026-09-16.
* **`documents` does not join the code-registered required set.** Every release carries it and an
  instance may still switch it off; `ui.shell` declares no dependency on it. User decision,
  2026-09-16.
* **The move preserves behaviour** (`BO_0253`, Intent): every acceptance expectation
  `BO_0243`'s parts established stays true, in the same words, in the extension that now owns it.

## Open

Nothing is open. The three questions this document carried at `idea` were answered on 2026-09-16
by reading the code and by `BO_0254` landing:

- `reference-chips.tsx` needs neither a widened contract nor a contributed component. `pointing.ts`
  splits exactly where its consumers already split it: the views use `pointingOf`,
  `PointableBlock` and `openingWords`, the frame uses `chipName` and `pinnedChipName`, and the
  types those two take — `PointedReference` and `PinnedBlock` — are declared in
  `src/lib/command-target.ts`, which stays. Recorded as a technical decision in `BO_0255_007`.
- The release verification is `distribution.md` `BO_0255_004`: the first cut after the carve-out
  reads the *installed* side, because a dropped member kind is invisible to a build-and-serve
  check.
- The `CA` change documents stay where they were made. `BO_0254` landed and the Extensions
  section lists an extension's changes from its own subtree, so a change of `ui.shell` reads
  correctly under `ui.shell` and `documents` starts with its own.

## Transferred

Enumerated 2026-09-16, the day the user promoted this to draft.

- `calliopa-bootstrap`: `extension-model.md` `BO_0255_001` (the manifest, the entrypoints and the
  vocabulary moved by the sidecar) and `BO_0255_002` (the prefix `DO`); `ui-kernel.md`
  `BO_0255_003` (the fixture, the skill the instructions name, the comments that point at the
  moved modules); `distribution.md` `BO_0255_004` (the fifth bundled extension and the
  clean-install verification); `ui-shell.md` `BO_0255_005` (this repository stops describing the
  shell as the document model's owner).
- `ui.shell`'s graph docs, staged as `node:chg-42dc8296a846055d` from a checkout at dataRevision
  1120, docs only: `workspace/contribution-contract.md` `BO_0255_006` (what the shell contributes
  and the tab kind's rewrite), `BO_0255_007` (the source move and the `pointing` split) and
  `BO_0255_008` (the tests); `system.md` `BO_0255_009` (the documents area becomes the
  extension's own docs); `foundation/verification.md` `BO_0255_010` (verification) and
  `BO_0255_011` (the release-notes line).

## Implementation

Implemented, verified and walked 2026-09-16. The proposal was accepted and the promotion gate
built the graph's own projection of all 232 files and advanced the pin to 1124; the user walked
the Documents section, the editor, the run detail and the Extensions section and found them as
before.

- **Repository, uncommitted**: `serve/testdata/documents-vocabulary.json` with its members attached
  to `documents` and the seeders writing a manifest per extension before its members; the four
  system docs' tasks folded into truth, with `BO_0255_012` left open for the next release cut.
- **Graph, staged**: `node:chg-1752211cd92c5b00` — 232 files and 14 members. The extension with
  its manifest, entrypoints, `views/`, `server/`, `lib/`, `docs/` and eight behaviour suites; the
  vocabulary and the documents skill re-attached to its manifest; `publishing` and
  `calliopa-video` declaring a dependency on it; `ui.shell` reduced to the frame and extension
  administration.
- **What the absence check found**, and what this change is better for: three things in the frame
  still reached into the model. The `extension` and `extension-import` views had travelled with
  the rest of `src/components/views/` and came back — they are extension administration.
  `src/server/agent/proposed.ts` read what a run staged into documents for the run detail, and
  became the contract's one new reader, `proposedTargets`, which each extension answers for its
  own content. `src/server/processes.ts` named a refinement process after its document, and
  became `labelOf`, which asks the sections that list a kind what an item is called. Neither
  widening was foreseen at transfer time; the chips question that was, dissolved.
- **Four modules stayed** where their consumers put them: `order`, `runs` and `library` are
  primitives other extensions read; `passage` because `command-target` validates a stored
  reference with it; `refinement` because it is the agent's settings, not the document model;
  and the CCGW node helpers left for `src/server/ccgw/nodes.ts`, so no extension needs a
  dependency to read a node.
- **Verification**: `tsc` clean, 762 unit tests, the production build, the behaviour project green
  under the kernel harness (22 files, 106 tests), and the absence case typechecking and building
  with `documents` and its three dependents removed. In `calliopa-bootstrap`, `go build`, `go vet`
  and the touched packages green. The Garage- and Postgres-gated suites and
  `internal/architecture`'s kernel-boundary test fail for reasons that predate this change.
- **One defect of `BO_0254` closed on the way**: its migration wrote `calliopa-video`'s four
  change documents into `docs/changes/completed/` while that extension's two pre-`BO_0222` file
  members stayed at `docs/changes/`, so `BO_0203` and `CA_0037` each stood twice with different
  text — `CA_0037` reading `wip` as a file and `rejected` as the document. The document was the
  live one since `BO_0222`, so the stale files are removed here. `calliopa-video` was the only
  extension holding file members the import had never converted, which is why it was the only
  collision.

## Out Of Scope

- Separating the decision half. It travels inside `documents` here and leaves in `BO_0256`.
- Any behaviour change. Where the move makes a surface awkward, the awkwardness is recorded as
  open work.
