# CA_0020_FEAT_command-mode-block-references

Status: completed

Requested: 2026-08-30

## Intent

The block editor presents a document for reading and turns one block at a time
into an editor in place. There is no way to point at a block. Everything a
command could be told about the document would have to be described in prose to
a composer that does not know which document is open, let alone which paragraph
is meant.

This change gives the block editor a command mode. In it, a click marks a block
as a reference instead of activating it — and clicking it again takes the mark
back. That inversion is the mode. Several blocks can be marked across a
document, each carrying its own number, and what is marked is inspectable
before anything is done with it.

Nothing is sent. No command runs, no AI is contacted, no proposal is reviewed.
The deliverable is the pointing itself: being able to say *these three
paragraphs* and read back exactly which three, on a document that has not been
touched.

## The Prior Art

The old `calliopa-bootstrap` artifact editor shipped this as `BO_0136`, and
`docs/changes/completed/BO_0136_FEAT_command-mode-activation.md` there is the
record. That editor is not this one — it was extension source materialized out
of a graph, and this view is native application code — so the implementation
does not carry across. Three of its findings do, and they are why this change
is shaped the way it is.

- **The mode model is what activation actually introduces.** That editor built
  editing as a property of a block rather than a state of the surface, and had
  to make the mode explicit before a third one could exist. This view has the
  same shape today: it knows which block is active, not which mode it is in.
- **Stopping before send is a direction decision, not an effort one.** The path
  to a run existed there and was deliberately not wired, because the results
  would have landed on a surface away from the document. Here there is no
  backend to wire at all, so the cut costs nothing and the question of where
  results land stays open for the change that answers it.
- **Two handlers may never arbitrate the same event.** That editor relearned it
  three times — pointer deactivation, then `Escape`, then the mode — and each
  time the correction was the same: the surface that owns the mode decides what
  a gesture means, and the block does not. This view already decides activation
  centrally; a mode has to be decided in the same place.

What does not carry: that editor put the command's card inside the reading
column because its shell had no room for one. This change renders no card at
all, and takes the dock this shell already has as the way into the mode.

## The Mode Model

* The block editor surface holds exactly one mode: reading or command. The
  active block stays a fact within reading presentation rather than a third
  mode of its own.

- Reading presentation stays the resting state and is still not a mode the
  reader selects, which is what [Block Editor View](../../system/documents/block-editor.md)
  fixes. Command mode is a mode the reader enters and leaves back to reading;
  it does not make reading into a chosen state, and that fixed line stays true
  as written.
- Two modes rather than three, because this view does not need editing to be
  one. `At most one block is active per tab` already tells activation apart
  from everything else, and a third name for a state one signal describes would
  be a model kept agreeing with itself for no gain. Command mode is the first
  state that cannot be inferred from whether a block is active, which is
  exactly why it has to be held.
- Entering command mode ends any active edit first, and the flush that already
  runs when a block is left is what commits it. The transition owns the commit
  rather than inheriting it from a click that happened to land elsewhere.
- No block is active in command mode. Marking is not activation, so the
  document holds no editor and the bar at the top of the editor area is not
  there — it is present only while a block is active, and nothing here changes
  that.
- Entering and leaving move no document content, which is the rule the bar
  already keeps. The reader's scroll position and every block's position on
  screen are the same before and after.

## Marking A Block

* In command mode a click marks a block as a reference, and clicking it again
  removes the mark. Marking never makes a block editable.

* A reference identifies a block by its identity. Its number is a human-facing
  alias, never the thing the reference points at, so reordering or restructuring
  the document must not silently retarget a reference.

* Numbers are assigned in the order the reader marked, not in document order.

- A marked block carries a visible treatment and its number, so the state never
  rests on colour alone. The treatment is visibly not the active-block
  treatment and visibly not authored formatting, and it leaves no trace when the
  mode ends.
- Several blocks can be marked across the document, and the marks survive
  scrolling.
- A reference whose block has since gone from the document is dropped. There is
  nowhere for an unavailable reference to appear, because a mark on nothing
  cannot be drawn, and nothing has been sent that would depend on it having
  survived.
- A retired block is not markable. It is read-only where it is revealed, offers
  only `Restore`, and is not part of the reading order; a reference into one
  would point at something the document does not currently say.
- Marking is device-local presentation state per document. It survives a reload
  and never becomes graph truth, the posture [Block Editor View](../../system/documents/block-editor.md)
  already takes with editor state and per-tab scroll. Nothing here writes a
  revision, so a document that was only marked has the same change count it had
  before.

## Reading The References Back

* There is no references list. The document is the list: a marked block carries
  its number in place, and reading the document is reading back what was marked.

- This is the call [Block Editor View](../../system/documents/block-editor.md) already
  made once. There is no separate retired list either, and the reason given
  there is the reason here: the document itself is the list, which is what makes
  the position mean anything. A second surface enumerating blocks that are
  already on screen, numbered, would say the same thing twice and could disagree
  with itself.
- It is also why the numbers are assigned in mark order. Read top to bottom, a
  document showing `#2`, `#1`, `#3` says both which blocks were marked and the
  order they were marked in, which a list is otherwise needed to carry.
- Nothing renders in the command dock's composer. That is where the references
  belong once something can consume them, and this change sends nothing, so
  feeding a composer that cannot run would build a shape the first real command
  has not had a chance to decide. Moving the list there later does not disturb
  the marking model, which is the part being settled now.
- Nothing renders in the editor area either. A panel there would be a second
  command surface in a product whose dock is already designated for commands,
  and the marks make it unnecessary.

## Entering And Leaving

* The command dock carries the control that opens and closes the mode. The view
  contributes it and supplies its handler; the shell renders it, the way it
  already renders the inspector's contributed actions.

* Whatever opens the mode is reachable by pointer, keyboard, and touch. A mode
  reachable only from a keyboard does not exist on a phone.

- The dock is chosen over a control on the reading surface and over a toggle in
  the inspector. The reading surface stays content-only, which
  [Block Editor View](../../system/documents/block-editor.md) bought deliberately when
  the per-block edit control was removed and the reading block became its own
  affordance. The inspector would need no new mechanism at all, its
  retired-blocks toggle being the precedent, but on a phone it is an edge sheet
  that has to be opened, toggled, and closed before a single block can be
  marked. The dock is visible on both form factors and is one tap.
- It also puts the way into the mode where the command will eventually be
  written, so the reader is not asked to learn one place to start pointing and
  another to say what the pointing was for.
- The dock gains a place for a view-contributed action, which it does not have
  today: it holds the handle, the composer, the attachment, undo, and the
  console. This is the one piece of new shell surface the change adds. A view
  that contributes no action shows nothing there, as a placeholder view already
  shows nothing in the inspector.
- The action area rides with the composer, so it is present at the dock's
  composer and console positions and not at the collapsed handle. The keyboard
  shortcut still opens the mode from a collapsed dock, and raising the dock is
  one tap on the handle it collapsed to.
- The control reads as pressed while the mode is open, so it says which mode the
  surface is in rather than only offering a way in.
- `Ctrl`/`Cmd`+`Enter` is the shortcut. It is unbound in this editor, which
  binds `Ctrl`/`Cmd`+`Z`, `Y`, `B` and `I` along with `Escape`, `Enter`,
  `Backspace`, `Delete` and the arrows. Pressed while a block is active it ends
  the edit and opens the mode, and must not also split the block on its way.
- The mode is never ambiguous. At any moment the surface is reading or command,
  a click does what the current mode says it does, and entering the mode is
  announced to assistive technology.
- Leaving preserves what was marked, so closing the mode by accident costs
  nothing.
- `Escape` leaves the most local surface first and then the mode, decided in one
  place. The shell's message surface holds the floor and takes `Escape` before
  anything in a view sees it once `CA_0018_002` lands, and that ordering stays
  the shell's.

## What This Is Not

* No send, no run, no AI contact, no proposal review. Nothing leaves the
  browser, and no process is produced.

- Not a passage reference. Marking a range inside a block, anchoring it, and
  deciding what a stale anchor means is substantial work of its own, and whole
  blocks are what make the mode usable at all.
- Not comments, not annotations, not disposition. Those are named in
  [Block Editor View](../../system/documents/block-editor.md)'s later slices and none of
  them is needed to point at a block.
- Not a change to what a document stores. [Block Document Model](../../system/documents/block-document-model.md)
  gains nothing; there is no reference node, no stored context, and no new
  vocabulary.
- Not a reading-surface toolbar, and not chrome on the reading surface at all.
  The entry is in the dock precisely so the resting surface keeps showing the
  headline, the blocks, and nothing else of its own.
- Not a command context in the composer, and not a `Run` that runs. The dock
  gains one contributed control and nothing else; what the composer does with
  references, and what `Run` says while it cannot run, belong to
  [CA_0022_FEAT_agent-layer](./CA_0022_FEAT_agent-layer.md), which gives the
  composer its first backend. The two changes meet at the dock and neither
  depends on the other, so whichever lands second inherits the other's account
  of it.
- Not a weakening of any fixed line. Reading stays the resting state, at most
  one block is active per tab, and the bar stays present only while a block is
  active.

## Verification Impact

- Scenarios belonging with this change, on desktop and mobile: entering the mode
  ending an active edit and moving no document content; a click marking a block
  rather than activating it, and a second click unmarking it; three blocks
  marked across a document reading back as the three that were marked, in the
  order they were marked; the marks surviving a scroll and a reload; leaving the
  mode leaving no treatment behind on any block; and the document's change count
  unmoved by a session that only marked.
- The dock's control opens the mode on desktop and mobile, reads as pressed while
  the mode is open, and closes it again. A tab whose view offers no such action
  shows nothing in its place, which the placeholder views are the case for.
- `Ctrl`/`Cmd`+`Enter` opens the mode from a collapsed dock, and pressed while a
  block is active it ends the edit without splitting the block.
- A marked block's accessible name says it is marked and which reference it is,
  and marking is reachable from the keyboard. The axe scans stay clean on both
  form factors with blocks marked.
- The blank-page placeholder must not create a block in command mode. Clicking
  empty space below the last block appends a paragraph today; in this mode the
  surface is for pointing and a click there does nothing.
- `pnpm run verify` gates the result.

## System Work

Done. `CA_0020_001` is folded into [Workspace Shell](../../system/workspace/frame.md)
and `CA_0020_002`-`CA_0020_004` into
[Block Editor View](../../system/documents/block-editor.md), all as current truth.

- [Block Editor View](../../system/documents/block-editor.md) gained a `Command Mode`
  section carrying the mode model, marking, reading the references back from the
  document, and what marking is not. Its `Later Editor Slices` line about AI
  commands is narrowed to what remains once the pointing exists, its
  passage-references line now says passage-level, and its reload line in
  `Shell Integration` is narrowed to the active block, because the mode is not
  that kind of fact.
- [Workspace Shell](../../system/workspace/frame.md) gained a `Command Dock`
  section for the view-contributed action. The `Qwik Boundaries` bridge line
  names the dock action contribution alongside the inspector contribution.
- [Workspace View Types](../../system/workspace/view-types.md) names `ViewAction`
  as the one named-action vocabulary, rendered by the inspector and the dock.

Two questions the sections could be read either way on were settled on
2026-08-31:

- A reload comes back in command mode with its marks showing, rather than back
  in reading with the marks kept but invisible. The mode and the marks are one
  piece of device-local state per document, and marks nobody can see would not
  be marks that survived.
- Unmarking leaves the standing references the numbers they already carry,
  rather than closing the gap. A block's number never changes under a reader who
  did not touch it, and a freed number is not reissued while any mark stands.

`CA_0020_001` and `CA_0020_002` were taken as one closure, the way `CA_0018_001`
was: the dock's action area cannot be proven without a view that contributes
one, and command mode is its first.

The tab-context scenario in `tests/browser/tabs.spec.ts` failed intermittently
on three of six completion-gate runs during this change, on a different form
factor each time, and passes unchanged on the runs either side. Nothing here
touches tabs or the tab strip. It is recorded as an unowned note in
[Workspace Shell](../../system/workspace/frame.md).
