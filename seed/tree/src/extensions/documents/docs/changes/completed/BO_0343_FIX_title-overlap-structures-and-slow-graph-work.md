# Title Overlap, Structures From A Command, And Slow Graph Work

Status: completed

The user reported four problems on 2026-10-03. The work spanned the shell and extensions in the
graph (`documents`, `structures`) and the kernel, so it was a `BO` change, carried into the graph
as a change document of `documents`. Its outcome is below.

## What Is Reported

* A document's sticky title overlaps the left drawer and the inspector on a phone. Reported by the
  user, 2026-10-03.
* An agent asked by a command to create structures says it did. A run chip appears, but accepting
  it gives no new structure. Seen on the user's live install (`0.5.0`). Reported by the user,
  2026-10-03.
* Structures still do not use the document format on the user's live install (`0.5.0`).
  Reported by the user, 2026-10-03.
* Graph work takes very long: *Accept all*, *Reject all*, a run staging its proposals, and
  opening a document. Reported by the user, 2026-10-03.
* *Accept all* on a typical run finishes in under one second. User decision, 2026-10-03.
* The structure problems stay in this change, beside the sticky title and graph speed. User
  decision, 2026-10-03.

## Where This Starts

### The Sticky Title

- The sticky title is `documents`' compact line (`DO_0030_003`, `views/document-header.tsx`). It
  appears once the header has scrolled out of view, hangs from `.document-header-anchor` (a sticky
  box of no height at `top: -0.5rem`), sits directly under the view bar, is opaque and is 36px
  high ([Block Editor](../../../graph/tree/src/extensions/documents/docs/system/documents/block-editor.md)).
  It was measured in the render harness's DOM at 360, 390 and 1280 CSS px with no drawer or
  inspector open. On a phone both open over the document, so the compact line probably sits
  above them in the stacking order.

### Structures

- `0.5.0` was cut at pin 4095. `RO_0005` (*A Structure Is A Document*, in `structures`' graph
  docs) landed after that. At graph head 4107 (checked 2026-10-03) its model, migration, acts,
  page and run tools are truth (`RO_0005_001`–`005`, `007`). The served check and the user's walk
  (`RO_0005_006`) and the change document's own status (`RO_0005_008`) are still open, and the
  change is `wip`.
- On `0.5.0`, `propose_structures` only gives existing structures to a document or its blocks and
  sets their values; nothing creates a structure. So the run chip the user accepted could not
  have held a new structure, yet the agent said it had created one. At head 4107 a run proposes
  a structure as a document that uses *Structure* (`RO_0005_005`, the skill's convention
  `aStructureIsADocument`). The structure stands once the person accepts it.
- So the document format reaches the user with the release that carries `RO_0005`. Two things
  remain for this change: a command asking for structures must actually produce them at head,
  and an agent's summary must never claim something its run did not stage.

### Slow Graph Work

- *Accept all* on a run chip or a proposal chip answers every item of a group (`answerAll`,
  [Agent Activity](../../../graph/tree/docs/system/workspace/agent-activity.md)). It is not yet known
  whether that is one kernel acceptance for the group or one per item, with a refresh after each.
- Earlier speed work: `BO_0257` (reads select what they serve) and `BO_0269` (concurrent and
  faster agent runs). Neither measured an act that answers many proposals at once.

## Outcome

Completed 2026-10-03. The truth stands in [CCGW](../../system/ccgw.md) (The Time Graph Work Takes),
[UI Kernel](../../system/ui-kernel.md) (A Run Reports What It Staged), and in the graph: `documents`'
Block Editor (The Compact Line Beside The Drawer And Inspector) and Proposed Changes (The Time It
Takes), and `structures`' system doc.

- The compact title stands at `z-index: 5`: over every layer of the document, under the phone's
  drawer and inspector (`BO_0343_010`, `_011`).
- The base skill's `reportWhatStaged` holds a run's closing words to what it staged (`BO_0343_030`,
  `_031`). Since `RO_0005`, a command asking for structures makes them (`BO_0343_020`).
- *Accept all* and *Reject all* answer a group in one request, over the review bridge's batch of
  member decisions; whole-group acceptance keeps its confirmation, as the user chose
  (`BO_0343_002`, `_012`). The typical run of 20 items went from 1.6 s to 0.14 s.
- Opening a document and staging already met the one-second line (`BO_0343_013`).
- Graph proposals: `node:chg-0853411198a63235` (transfer), `node:chg-c84599f46c3aba6b`,
  `node:chg-c725c3ed87369c34`, and the close. The user walked all of it on the dev instance at
  pin 4296.

