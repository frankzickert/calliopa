# BO_0229_FEAT_command-file-attachments

Status: completed

Completed 2026-09-17. The kernel half (`BO_0229_001`–`BO_0229_006`) is truth in
`docs/system/ui-kernel.md`; the image table is set from the walk and recorded in
`docs/system/hermes.md`, Images Through Tools. The shell half (`BO_0229_007`–`BO_0229_014`) is
truth in `ui.shell`'s `workspace/commands-and-runs.md` and `workspace/processes.md`, served since pin
1264 with the walk fix at 1284. The walk (`BO_0229_014`) ran on this instance on all three
agents and in a browser, and found one defect — attachment nodes written without
`status: "established"` — fixed in the graph before completion.

Requested: 2026-09-10, while shaping the command bar's redesign (`CA_0039`, a `ui.shell`
change). Asked what the mockup's paperclip should do, the user answered: **leave it out for
now, but create a change for** *"Attach a file — uploads a file as context for the run. That
needs storage and kernel intake, so a much bigger change."*

## Where This Starts

- **The composer has an attachment that goes nowhere.** Dragging a process onto the composer
  shows it as a chip with a remove button, but `sendGoal$` never posts it: the run receives
  `goal`, `agent` and the command target alone. `CA_0039` removes that drag attachment, so
  the command bar starts this change with no attachment at all.
- **What a run can receive is a fixed set of fields.** The kernel's intake (`BO_0226`) takes
  `goal`, `agent`, `artifact`, `delivery` and `references`, and refuses an incoherent
  combination by name. A file has no field.
- **Binary content already has a door.** `PUT /v1/blobs` stores an object through CCGW,
  content-addressed and hashed server-side, and `GET /v1/blobs/{hash}` streams it back
  (`ccgw.md`, `BO_0091`).
- **No agent can read a blob today.** The kernel toolset (`internal/kernel/agenttools`) reads
  documents, the workspace and standing, and has no tool for an object. Claude under
  `BO_0228` holds no file or terminal tools at all, so a file can reach a run only through the
  kernel toolset or through the run's input.

## Intent

* The paperclip in the command bar attaches a file to the next command as context for the
  run.
* The run can read what was attached, whichever agent receives it.
* The bar shows what is attached before *Run*, and each attachment can be taken off, so AI
  context stays visible and inspectable (`calliopa-ui.md`, *Direct, reversible, and honest*).
* Any file can be attached, up to 10 MB per file and 10 files per command.
* The run gets the contents of text (plain text, Markdown, code, CSV), of a PDF as its
  extracted text, of an image as an image, and of an Office document (`docx`, `xlsx`, `pptx`)
  as text. For any other file, and for an image sent to an agent that cannot take one, the
  run gets the name, type and size, and the run's record says that is all it got.
* An attachment is kept with the run, its bytes stored in Garage. Reading a run back shows
  what it was given.
* Whoever can see the run can open its attachments. There is no separate permission.

## The Shape

- **Upload at attach time, through the one door.** The paperclip uploads each file through
  the kernel to CCGW's blob door, `PUT /v1/blobs`, which stores it in Garage by its hash. The
  bar shows it as a chip with its name and a `×` before *Run*. A file over the bound, or one
  past the tenth, is refused in words beside the paperclip, never silently dropped.
- **Text is extracted once, when the file is attached.** For a PDF or an Office document the
  kernel extracts the text and stores it as a blob of its own beside the original, so no run
  extracts it twice. A scanned PDF with no text layer extracts nothing, and the chip says so.
  PDFs go through `pdftotext` from `poppler-utils`, added to both kernel images, which run
  Debian. Office documents are read in Go with `archive/zip` and `encoding/xml`, with no
  library.
- **An attachment is a graph node, written when the command is sent.** Garage keeps a blob
  only while a committed revision references it; an unreferenced upload is swept after the
  staging TTL (7 days), and a run record on the kernel's data volume references nothing. So
  on *Run* the shell writes one `attachment` node per file as the signed-in person, whose blob
  references keep the bytes, and the intake takes the node ids. A file taken back before
  *Run* is never written and lapses with the TTL.
- **The intake gains `attachments`**, a list of those node ids, read at the run's pin. The
  intake refuses by name an id it cannot resolve, and one past the tenth.
- **The run reads an attachment through a kernel tool, `read_attachment`,** bound to the run
  as every kernel tool is. It works for all three agents, including Claude under `BO_0228`,
  which holds no file tools. It answers text in pages, so a large file does not flood a run's
  context. It answers an image as MCP image content. The run's instructions list what is
  attached, with names and sizes, so the run knows to read it.
- **The record names the attachments,** and the run's process detail in the inspector lists
  them, each opening its file under the run record's own access rule.
- Whether every agent takes MCP image content through the kernel toolset (Codex through the
  gateway, Hermes's own loop, the Claude runner) is verified on the instance. An agent that
  does not take it gets the fallback described above. The kernel keeps that as a table per
  agent, `false` until verified, and fixes what each attachment delivers at the run's start, so
  the record and the tool agree.
- **The file opens as a download.** An attachment is served with `Content-Disposition:
  attachment` and `nosniff`, so an HTML or SVG file never renders in the shell's origin.

## Decided

Decided by the user on 2026-09-10:

- **Any file, up to 10 MB per file and 10 per command.** Text-only, a list of accepted types,
  and 2 MB per file with 5 per command were the alternatives.
- **The contents reach the run for text, PDF, images and Office documents.** For the rest,
  only the name, type and size do.
- **An attachment is kept with the run and stored in Garage.** Making attachments reusable
  workspace material, and dropping the contents after the run, were the alternatives.
- **Access follows the run.** Sender-only and instance-wide were the alternatives. At the
  transfer it turned out that runs are instance-wide, so every signed-in person can open every
  attachment. The user accepted that for this change and asked for a follow-up for instances
  with several people, `BO_0232`.
- **A process's result is not attachable here.**

## Out Of Scope

- The command bar's layout. `CA_0039` settles where the paperclip sits, and this change only
  gives it something to do.
- Attaching a finished process's result, which the old drag attachment promised. It can be
  a change of its own.
- Reusing an attachment in a later command.

## Transfer

Transferred on 2026-09-10 as `BO_0229_001`–`BO_0229_014`, each under a section *Command File
Attachments*:

- **The kernel**, in `docs/system/ui-kernel.md` (`_001`–`_006`): `poppler-utils` in both kernel
  images, the upload and extraction route, the intake and the record, `read_attachment` with
  the per-agent image table, the vocabulary fixture, and their verification.
- **The shell**, in `docs/system/ui-shell.md` (`_007`–`_014`): the `attachment` vocabulary,
  the upload route, the run route writing the nodes, the paperclip and chips, the process
  detail and the file route, the graph's docs, the tree tests, and the on-instance
  verification, which also sets the image table.

The transfer found two things this document did not know, both recorded in `ui-kernel.md`:

- **Garage's staging sweep** is why an attachment is a graph node, above.
- **Runs have no owner.** In prod every signed-in account can read every run, so *access
  follows the run* means instance-wide today. The user accepted that for this change, and
  narrowing it is `BO_0232`.

The transfer also found, outside this change, that the bridge's run routes refuse no
cross-origin browser, although `proxy.go` says they do. It is an open line in `ui-kernel.md`.

Order:

- `_001` needs nothing.
- `_002` needs `_001` for PDFs.
- `_003` and `_004` change `bridge.go`'s intake and instructions (`BO_0228` has landed).
- `_005` goes with `_007`.
- `_007`–`_011` need the kernel rows. `_010` places the paperclip in `CA_0039`'s bar.
- `_014` needs everything: a rebuilt kernel image, a hermes restart, and the shell accepted and
  promoted.

## Review For A General Workplace

Reviewed 2026-09-16 for Calliopa's purpose as a general workplace: kept whole. Attaching a file to
a command is general and touches nothing of the decision system.

## Re-Transfer

Re-transferred on 2026-09-16, after the split of `ui.shell` into the frame, `documents` and
`calliopa-refine` (`BO_0253`) and the move of graph change documents to members (`BO_0254`):

- **The shell half is `ui.shell`'s and lives in its graph docs.** The command bar, the run routes
  and the process detail are the frame's; nothing here is `documents`'s or `calliopa-refine`'s.
  `BO_0229_007`–`_010` and `_012`–`_014` are in `workspace/commands-and-runs.md`, *Command File
  Attachments*, and `_011` in `workspace/processes.md`; `docs/system/ui-shell.md` keeps a pointer.
- **`attachment` is the first type `ui.shell` declares** since `BO_0255` moved the document
  vocabulary to `documents`; `_007` rewrites the shell's *does not define a content model* line
  when it lands.
- **The kernel's fixture is new.** `ui-shell-vocabulary.json` became `documents-vocabulary.json`
  in the split, so `_005` creates a `ui-shell-vocabulary.json` holding `attachment` alone rather
  than widening the documents fixture.
- **The paperclip sits in `CA_0039`'s bar**, which has landed; the *beside the field until then*
  fallback is gone.
- **This document is a member of `ui.shell`**, `docs/changes/BO_0229_FEAT_command-file-attachments.md`,
  carried in at `draft` with the re-transfer and following every status the change takes here.
