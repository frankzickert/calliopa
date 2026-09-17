# BO_0251_FEAT_start-a-document-from-a-command

Status: completed

Requested: 2026-09-13 as *cold start*, the ninth part of `BO_0243`. Rescoped 2026-09-16, when the
user retired `BO_0243` for Calliopa's purpose as a general workplace: this change keeps only what
any workplace needs — a command given with nothing open can start a document and open it. The
decision-specific half (a work root with kinds, frontier and next move, and the `refine.neutral`
skill that exposes unknowns without framing them) belongs to `calliopa-refine` and is not part of
this change.

## Where This Starts

- **A command with no document open answers in the console.** The composer sends `artifact`,
  `delivery` and `references` for a document tab and none of them otherwise; the kernel's
  intake refuses a delivery without a document (`BO_0226_004`). A run started from an empty
  workspace can `create_document` (`BO_0222_002`), and nothing opens what it created.
- **Delivery is propose or answer.** *The delivery is the reader's explicit choice and is stated
  to the run as one* (`ui-kernel.md`, fixed). There is no delivery meaning *start a document*.
- **A run's end tells the view showing its document** (`proposed` on the view bridge,
  `BO_0226_007`); a document that did not exist when the run started has no view.
- **The document surface is the `documents` extension** (`BO_0255`); the composer, its strip and
  the tabs are the frame, `ui.shell` (`BO_0253`).

## Intent

* **A command with nothing open can start a document.** *Draft an onboarding checklist for new
  support staff* creates a document titled for the work, whose body is the run's draft, and opens
  it in a tab when the run ends.
* **The reader chooses it.** Starting a document is a delivery the reader states, as propose and
  answer are; answering in the console stays one press away.
* **Nothing the run wrote is truth until a person accepts it.** The document and its blocks are
  the run's proposal, drawn and answered in the document the way any run's proposal is
  (`BO_0233`).

## The Shape

- **Delivery `start`.** The composer sends `delivery: start` when no document tab is active and
  the reader has not dismissed the strip; the strip reads *Start a document* with a × that turns
  it into *Answer in the console* as the propose strip does (`CA_0039_001`). The kernel's intake
  admits `start` with no artifact and refuses it with one; the instructions say the run's work
  goes into one document it creates.
- **The run.** Any agent, with the `documents` skill it already reads for work in a document:
  it creates one document with a title for the work, stages the body as ordinary blocks, and
  finishes naming the document. No extension-specific skill is required. Under `start` the
  document tools refuse a second `create_document` in words (*a run started from a command
  creates one document*).
- **Opening it.** The run's terminal event carries the document it created; the shell opens it
  in a new tab when the run ends, revealed rather than duplicated. A run that created nothing is
  answered in the console as today.
- **Taking it.** The general rule of `BO_0233` — typing into a proposed block accepts it with the
  typing on top — applies to a started document, and the document node is accepted with the
  first block the reader accepts, by typing or by its ✓. *Accept all* accepts the document and
  every block. Rejecting every item discards the document.
- **Finding it again.** Until it is taken, the started document is listed in the library as
  proposed, with its proposer's mark, so a reader who closed its tab reopens it from there.
- **Kernel half.** `start` in `RunRequest`, `readCommandTarget` and `validateTarget`; the
  instructions' delivery note; the run record's `created` documents from the group's touched
  set; the event.
- **Shell half.** The strip and the composer's target in `ui.shell`; the open-on-end through the
  view bridge; how `documents` draws a document none of whose blocks is established yet; the
  library's proposed entry.
- **Verification.** Behaviour tests for the intake; the render harness for the strip and the
  open-on-end; one live run from an empty workspace on the served build, its document opened and
  answered.

## Decided

- **A person takes a started document by editing it or by *Accept all*** (user decision,
  2026-09-16). The rule is the general one from `BO_0233` that already lives in `documents`, not
  `calliopa-refine`'s answer-by-use: the document node is accepted with its first accepted block,
  and rejecting every item discards the document.
- **One command starts at most one document** (user decision, 2026-09-16). A second
  `create_document` under `start` is refused in words, so the document that opens is never in
  doubt.
- **A started document nobody has taken stays findable** (user decision, 2026-09-16): the library
  lists it as proposed, so closing its tab loses nothing.

## Transferred

- 2026-09-16. Kernel: `docs/system/ui-kernel.md`, *Starting A Document From A Command* —
  `BO_0251_001` intake, `_002` instructions, `_003` one document per started run in the tools,
  `_004` record and terminal event, `_005` verification; pointer in `docs/system/ui-shell.md`.
- Graph (staged from a checkout at head 1167): `ui.shell` `docs/system/workspace/command-dock.md`
  `_006` strip and target, `_007` open-on-end, `_013` verification; `layout.md` `_012` the
  library's proposed entry; `documents` `block-document-model.md` `_008` reading a started document
  and `_011` the listing, `proposed-changes.md` `_009` the node going with the first acceptance,
  `block-editor.md` `_010` drawing it. This document stands in `ui.shell`'s `docs/changes/`.

## Depends On

- `BO_0226` (delivery), `BO_0233` (proposals drawn in the document), `BO_0255` (`documents`).
