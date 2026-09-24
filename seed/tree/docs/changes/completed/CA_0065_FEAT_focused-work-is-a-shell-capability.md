# Focused Work Is A Shell Capability

Status: completed

Opening a block as its own work root belongs to the frame. Today the capability is spread across
three extensions — the shell declares the relation, carries the route and moves the tab;
`documents` writes the child, draws the route line and installs the pinch; `calliopa-refine` draws
the control that opens it and the face the parent wears, and reaches across the boundary to call
`documents`' server function — so no view but the block editor can offer it, and whether a reader
can reach it at all depends on which extensions are active. Since `BO_0285` took refinement out of
what a release carries, **no install has a visible way in**. This change makes focused work one
capability of the shell, offered to every view through the view bridge, leaving each view only the
invitation it renders and the landing it performs. Requested by the user, 2026-09-23. Set to draft
by the user the same day and transferred: the tasks are `CA_0065_001`–`CA_0065_007` in the shell's
`docs/system/workspace/focused-work.md`, `CA_0065_008`–`CA_0065_012` in `documents`'
`block-editor.md` and `block-document-model.md`, and `CA_0065_013`–`CA_0065_014` in
`calliopa-refine`'s `system.md`. Set to ready by the user and claimed the same day. **Implemented 2026-09-23**, in two
proposals: the server half — the contribution, the shell's capability, `documents`' child, the
reach's import and the behaviour suite's move — and then the client half: the frame's own endpoint
and the three bridge calls, the contract's one widening (`ActionSurface` gained `block`),
`documents` drawing the control, the face and the pinch, and `calliopa-refine` drawing neither. Walked on the served build and
accepted by the user on 2026-09-23, from pin 1902 to pin 1931, with one thing changed on the way:
the standing scale had lost its own placing to the new wrapper, so a proposal row pushed the
content down. **Completed 2026-09-23.**

## Scope

- The owner is `ui.shell`: the subject is what the frame offers every view, the relation is already
  its declaration, and the route, the tab and `retarget$` are already its code. So this change
  document is its member and the prefix is `CA` (`change-process.md`, Change Documents: a change
  touching several extensions belongs to the one whose contract or subject it is).
- The halves in `documents` and `calliopa-refine` are enumerated in those extensions' own docs with
  task lines pointing at the shell's topic, the way `DO_0013`'s refine half is.
- There is no `BO` half. The behaviour suite moves to the tree root's `tests/behavior/`, and the
  kernel harness runs `vitest run --project behavior` over the whole project rather than a named
  list (`internal/kernel/serve/shell_documents_verification_test.go`), so nothing in the fixed
  layer follows. The `focuses` declaration is already `ui.shell`'s and does not move.
- Out of scope: what focused work *returns* to its parent (`BO_0262`'s open question, still open);
  the route's move into the frame's line, which is `CA_0048`'s; the depth categories and the
  gestures beside the control, which stay `calliopa-refine`'s; `BO_0256`'s wider question of what
  else moves between `documents` and `calliopa-refine`.

## What This Reverses

* **Focused work becomes a shell capability.** `BO_0262` decided on 2026-09-18: *Focused work stays
  in `calliopa-refine`. Opening a block as focused work, and the child's face on the parent block,
  remain Refine's. The default editor gets only the return* — decided then over moving focused work
  into `documents`. That is reversed. The third option, which `BO_0262` did not weigh, is the one
  taken: neither extension owns it, the shell does. User decision, 2026-09-23.
- `BO_0262` is superseded and sits in `calliopa-bootstrap`'s `docs/changes/superseded/`; its other
  decisions were carried by `BO_0265`, `BO_0267` and the `DO` line and are untouched here. Its
  companion decision — *what the child's work means for the parent comes back as proposals on the
  parent, never as a silent overwrite* — still stands and is not in this change's scope.

## Where This Starts

At head 1812. The capability is in three places at once, and this is what each holds.

**The shell already owns** the durable half:

- `focuses` is an `ext.relationtype` declared by `ui.shell` through `kernel commit --members`
  (`CA_0047_001`; the kernel harness's fixture mirrors it).
- `src/lib/tabs.ts` — `RouteEntry`, `routeOf`, `retargetTab`; `src/server/workspaces.ts` —
  `parseTab` validating a stored route; the route travels in the workspace record and follows the
  person across devices ([Tabs](../system/workspace/tabs.md)).
- `src/components/shell/view-bridge.ts` — `retarget$`, by which a view moves its own tab, and the
  `focus` store the shell writes for the landing ([View Types](../system/workspace/view-types.md)).
- `src/lib/pinch.ts` — the pinch physics, pure and unit-tested.

**`documents` holds** the write and the drawing:

- `server/focus.ts` — `openFocusedWork` (the atomic script creating the child, its first block and
  the `focuses` edge, answering the existing child when the block has one) and `focusedWorkOf` (the
  faces); `server/api.ts` — the `openFocusedWork` command and `GET …/documents/[id]/focused`;
  `views/documents-client.ts` — the client call.
- `views/block-editor.tsx` — `focus$`, `back$`, the route line (`data-document-route`), the landing
  from the bridge's `focus` store, and `installPinch` from `views/block-pinch.ts`.
- The `## Focused Work` section of its `block-editor.md`, and the model in
  `block-document-model.md`.

**`calliopa-refine` holds** both ways in that a reader can see:

- `views/depth/block-depth.tsx` — the control in a focused block's icon row, *Open as focused work*
  when the block has no child and *Focused work* when it has (`CA_0047_005`, `BO_0258_021`).
- `views/decision/places.tsx` — the parent's face (`data-block-face`), the muted line carrying the
  child's synthesis, which opens the child when pressed.
- `server/gesture.ts` — `import { openFocusedWork } from "~/extensions/documents/server/focus"`,
  one extension calling another's server function directly.
- `views/depth/focused-work.test.ts` and `tests/behavior/focus.test.ts`, the suites that prove it.

## Why It Cannot Stay There

- **An install cannot reach it.** `BO_0285` (2026-09-23) took `calliopa-refine` out of what a
  release carries, and the two affordances a reader can see are refine's. On a release that ships
  `ui.shell`, `documents`, `settings`, `publishing`, `calliopa-base` and `calliopa-extension`, the
  write exists, the route works and the tab retargets — and nothing draws a way in. What survives
  is the pinch, which is `documents`', on touch only and discoverable by nobody. The same is true
  of the dogfood instance whenever refine is inactive, as it was from dataRevision 1597.
- **It is already the shell's by shape.** What focused work does is retarget a tab, push a route
  and land on a block — three things the shell owns and no view may do for itself. A view never
  takes ownership of a shell surface ([View Types](../system/workspace/view-types.md), fixed line);
  the inverse holds too, and a capability whose whole effect is on the frame should not be an
  extension's to offer or withhold.
- **It is offered to one view.** Any future view over any target kind has the same need — open one
  part of what I am reading as its own root, and come back — and today it would have to import two
  other extensions to get it.
- **The boundary is already broken.** `calliopa-refine/server/gesture.ts` imports `documents`'
  server function directly, noted as a technical decision at implementation under `RF_0005_002`.
  That import is the symptom: the capability has no home to be called from. An extension importing
  a *shell* host module under `~/server/` or `~/lib/` is ordinary and both extensions already do it.

## Decided

The three questions this change opened, answered by the user on 2026-09-23. Each is written as
fixed truth in the shell's [Focused Work](../system/workspace/focused-work.md), *What Belongs
Where*, and the tasks below are shaped by them.

* **The shell asks the target's own extension for the child.** `document`, `text` and `contains`
  are `documents`' vocabulary and only `focuses` is the shell's, so the shell never writes another
  extension's types: the extension contributing a target kind contributes how a child of that kind
  is made, and the shell calls it inside its own atomic script. Decided over the smaller option of
  the shell writing `documents`' vocabulary directly, which would have kept focused work
  document-shaped until a second real view arrived. The capability is therefore general from the
  start, and `CA_0065_001` designs the contract rather than deferring it.
* **The shell contributes the control, the view renders it.** *Open as focused work* is a
  shell-contributed action in the view's own block row, in the named-action vocabulary the bar and
  the inspector already share. Decided over `documents` drawing its own control with refine
  dropping its, and over both drawing one. This is the option that makes the way in the frame's
  rather than any extension's — and it widens the view contract, which has so far carried a view's
  contributions to the shell and nothing the other way. `CA_0065_004` is that widening.
* **The parent's face is the view's to draw, from a read the shell answers.** The shell owns the
  read and hands the faces to the view as it hands over `focus` and `reveal`; `documents` renders
  the muted line. Decided over leaving the face with `calliopa-refine`, which would have left a
  shipping install with nothing to say that a block has focused work.

## Direction

- **The shell owns the capability**: the child's creation through the contribution, the edge, the
  read that answers a block's child and the read that answers a target's faces, the retarget, the
  route and the landing. One bridge call opens a block as focused work and answers what happened.
- **A view owns the invitation and the landing.** The shell draws nothing inside a view's content:
  it hands the view a typed action and the faces, and the view renders them in its own row through
  `ActionControl`, as it renders the bar's and the inspector's. The gesture that means it — the
  pinch — stays the view's adapter over the shell's physics.
- **Refine keeps what is refine's.** The depth icon row, its categories and the gestures beside
  them stay where they are. What leaves refine is the capability, not the taste of how a block
  presents itself.
- **Nothing about the model changes.** A focused work is still a `document` that `focuses` a block,
  a block is focused by at most one document, the child is parentless in the library's sense, and
  retiring a focused block is still refused. The route stays navigation only, with no governance,
  ownership or containment meaning.

## Technical Decisions

- The behaviour suite moves to the tree root's `tests/behavior/` beside the shell's others. The
  kernel harness runs the whole behaviour project rather than a named list, so no fixed-layer change
  follows. 2026-09-23.
- The pinch adapter stays each view's. `src/lib/pinch.ts` is already the shell's and pure; a view
  that wants the gesture installs the adapter and calls the bridge. 2026-09-23.
- `server/focus.ts` comes out of `BO_0256_008`'s list of files moving to `calliopa-refine`: it goes
  to the shell instead, split into the shell's capability and `documents`' child contribution. The
  line is corrected in `documents`' `block-editor.md` in this transfer. 2026-09-23.

## Depends On And Touches

- `BO_0285` (completed, `calliopa-refine`): the fact that makes this urgent rather than tidy — the
  extension drawing both affordances no longer ships.
- `BO_0256_008` and `BO_0256_012` (open, `documents`): the unfinished half of the decision-extension
  split. `focus.ts` is out of `BO_0256_008`'s list as of this transfer; the rest of that task is
  untouched, and `BO_0256_012`'s question about proposal atomicity is unaffected.
- `CA_0048` (idea, `ui.shell`): plans the route's move from the view's first line into the frame's.
  This change keeps the route where it is; if `CA_0048` lands first, this one inherits its place.
- `BO_0262` (superseded): the decision reversed above, and the open question of what focused work
  returns to its parent, which stays open and out of scope.
- `CA_0047` (completed, `ui.shell`): the change that built focused work, whose tasks named every
  file above. `CA_0047_007`, its Playwright scenarios, is still open in `documents`'
  `block-editor.md` and is answered by `CA_0065_007`'s walk.
