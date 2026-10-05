# Drag And Drop

## Drag And Drop

* One shared drag model spans tabs, drawers, the workspace and the panels.
* Every draggable carries stable item identity, item kind, source context, supported operations, and an optional preview representation.
* Drop targets declare accepted operations: move, copy, link/reference, open in tab, attach to command, or use as process input.
* Potentially destructive moves use optimistic feedback with undo.
* On mobile, long-press begins the drag and targets enlarge while dragging.

* A drag held near the top or the bottom of the area it began in scrolls that area toward the edge, on a desktop and a phone alike, so every place is in reach. User decision, 2026-09-18 (`calliopa-bootstrap`'s `BO_0263`).
- A coarse pointer must hold still before drag begins; ordinary touch movement remains scrolling.
- The shell's placeholder interactions prove tab reorder on desktop and mobile.
- No surface takes a process as context, by the user's decision of 2026-09-10 in `CA_0039`: a process dragged onto the command surface showed as a chip the run was never sent, promising context the run did not receive. Files as context are `BO_0229`'s, and process results are not attached. The drag model keeps `attach-to-command` in its vocabulary, as the fixed line above lists it; no shell target accepts it (`CA_0039_006`).
- Later tools must remain able to drag a scene into the tab bar, media onto a storyboard frame, a character onto a scene, and an open tab into the story tree.
- A library icon is a draggable of kind `panel-icon` offering `move`, its source the panel; the icon column is its one target and takes that kind alone. `resolveDrop` in `src/lib/drag.ts` is `resolveOperation` once payload and target agree — an icon over anything but a `panel-icon:` target, or any other kind over one, resolves nothing — and the shell resolves every drop through it, so a tab never lands on the icon column and an icon never on a tab, a document or the inspector (`CA_0068_008`).

## Implementation

- `src/lib/drag.ts` holds the shared drag model: a payload of item identity, item kind, source context, offered operations, and preview; a target that declares what it accepts; and the resolution that takes the first offered operation a target accepts. `pointerIntent` decides between dragging, scrolling, and waiting, so a mouse drags on movement while a coarse pointer must hold still for the long press. The shell coordinates pointers without capturing them, reading the target under the pointer, showing a preview that follows it, marking the hovered target, and enlarging every target on coarse pointers. A move applies optimistically before the workspace save. Desktop and mobile scenarios prove tab reorder (`CA_0002_020`).
- `pointerIntent` answers `swipe` too, for a target that offers one by passing the travel's axes: a coarse pointer that has moved 12px (`SWIPE_LOCK_PX`) with horizontal travel at least 1.4 times its vertical (`SWIPE_DOMINANCE`) before the long press. A caller that offers no swipe — the tab strip, the library — reads early touch movement as a scroll exactly as before, and a mouse never swipes. One arbiter, so the shell's drag and a view's swipe cannot disagree about one press (`BO_0227_007`).
- Scrolling while dragging (`BO_0263_017`): `edgeScroll` in `src/lib/drag.ts` answers how far a frame scrolls for the pointer's height over the visible part of an area — nothing in the middle, toward an edge within `EDGE_SCROLL_ZONE_PX` (56px, at most a quarter of the area) at up to `EDGE_SCROLL_MAX_PX` (16px) a frame, faster the nearer the edge, and at full speed past it. While `drag.payload` is set, a frame loop in `shell.tsx` scrolls the area the drag began in — the nearest vertically scrolling ancestor of the point it started at, or the page (`scrollerAt`) — by that much, and reads the target under the pointer again when the content moved, so the drop mark follows. It runs off the last pointer position, so a pointer held still near an edge keeps scrolling, and stops with the drag. `src/lib/drag.test.ts` proves the speeds and the zone; the loop itself is the walk's.
- Walked by the user on the served build at pin 140 on 2026-09-18, on a desktop and a phone: a block, a proposal and a retired row dragged from the top of a long document to its end and back, the area scrolling at the edge and the drop landing there (`BO_0263_018`).


## Holding Over A Place Opens It

- `CA_0072_FEAT_drag-blocks-into-blocks-tabs-and-documents` is the originating change. [Tabs](./tabs.md), [Layout](./layout.md) and [Focused Work](./focused-work.md) carry the targets it opens, and `documents`' [Block Editor](../documents/block-editor.md) the drops a view receives.
* A dragged block held over a tab of another document, a tab edge, the library's icon or a document in the library for 600 ms opens it, and the drag goes on in what it opened. The target is marked while the hold runs; a pointer that leaves before the hold ends opens nothing, so a drag can cross the header and the panels on its way elsewhere. The hold is the same on a desktop and a phone. User decision, 2026-09-29.
* A block dropped into another document is moved, not copied. User decision, 2026-09-29.
- A block move is not destructive — the block keeps its identity and a drag back returns it — so it takes the drag model's optimistic feedback and no separate undo control, as a move within one document does today (the editor's Undo keeps saved structural operations out of the undo keystroke).
- A spring-loaded place (`CA_0072_001`): a tab, a tab edge, a library icon, a library entry and the phone's library handle carry `data-spring` with what they open, and a dragged item that `springs` — one whose `source` is `workspace`, dragged out of a view's content; a tab or a library icon never springs — held over one opens it. `holdOver` in `src/lib/drag.ts` keeps a hold's start while the pointer stays and starts again where it arrives, `springDue` says when `SPRING_HOLD_MS` (600) has passed, and `springAction` names what an id opens. The shell keeps the hold on its drag store (`hold`), set as the pointer moves in `trackDrag$` and cleared with the drag, and `armSpring$` checks it after the hold: still there and still dragging, it opens the place through `openSpring$` once — a hold that opened carries `since: null` — while a tab edge (`springRepeats`) steps again after each further hold. The place carries `data-spring-hold` while its hold runs (`holdMark`), and the shell's stylesheet fills it from its leading edge over the hold's length, at once under reduced motion. A place that also accepts the payload as a drop target still takes the drop at once. `drag.test.ts` proves the springing kinds, the hold before, at and after its length, a leave and another place starting again, opening once, and each id's action; the timer itself is the walk's, as the edge scroll's frame loop is.
- While a drag runs the pointer is the drag's (`shell.css`, `.shell[data-dragging]`): the grabbing hand over everything in the shell, never the text cursor a block's words or an editor would show beneath it, and a drag crossing words selects none of them. Found in the `CA_0072` walk, 2026-09-30.
- A drag outlives the view it began in (`CA_0072_002`): the drag store is the shell's, so a tab a held place activates leaves the payload, the preview and the pointer tracking whole, and the target under the pointer is read from whatever the workspace now shows. A block's payload names the document it came from in `from` (`DragPayload`), so the receiving view tells another document's block from its own. A view answers a drop once: the shell keeps the last drop after its gesture, and a view takes the drop's `seq` at mount and answers only a later one, so a view a held drag mounted never replays the drop that ended an earlier drag. A target may name a second target for its middle, `data-drop-middle`: over the middle half of its height (`inMiddle`, `DROP_MIDDLE_FROM`) the drop means that one, over its quarters above and below the target itself; `documents`' text rows use it for nesting. Proven in `drag.test.ts` for the middle band and in `documents`' render harness for a drop naming another source document; the walk proves the tab switch under a live drag.

## Curation By Drop

- `calliopa-bootstrap`'s `BO_0349` is the originating change; the drops a view receives are `documents`'
  [Block Editor](../../../src/extensions/documents/docs/system/documents/block-editor.md#curation-by-drop), Curation By Drop.
* A drop that starts a run lights its target red, distinct from every other drop mark, so the person
  sees before releasing that letting go starts something. User decision, 2026-10-05 (`BO_0349_Q8`).
* A structure or an instruction is dragged out of the *Structures* sheet into the work. User
  decision, 2026-10-05 (`BO_0349_Q5`).
- A drop that starts a run is marked red by the view that owns the target (`BO_0349_001`, landed
  2026-10-05, as views drew it rather than the shell): a view reads what a release would do from
  `ViewDragState.operation` and what is dragged from `payload`, so `documents`' header mark, its body
  while a structure would be applied, and `structures`' field choice light red where a run would
  start, and nothing lights where a drop would not land. The shell adds no mark of its own.
- A structure is dragged out of the *Structures* sheet (`BO_0349_002`, landed 2026-10-05): a row of
  `structures`' section starts the drag from its own press through `startDrag$`, carrying the kind
  `structures:structure`, the source `library` and the one operation `link`; a mouse drags once it
  moves, so a click still opens the row, and *Structure*, never used by hand, drags nothing. The view
  a drag reaches sees what is dragged (`ViewDragState.payload`), so its mark can say what a release
  would do. A target's middle may accept more than its edges (`data-middle-accepts`, read by
  `targetUnder` over the middle half): a block row's middle takes a block or a library item, its
  edges a block alone, so a structure held between rows marks nothing.
- A library item dragged on a phone (`BO_0349_003`, landed 2026-10-05; `springs`, `leavesSheet` in
  `src/lib/drag.ts`): a structure or an instruction dragged out of the library springs over a tab as
  a block does, and the phone's library sheet closes once the pointer leaves it, so the work beneath
  is reached and the shield over it is gone. A library icon only moves, as before. Proven in
  `src/lib/drag.test.ts`.

## An Inbox Of Decisions

- `calliopa-bootstrap`'s `BO_0350` is the originating change; the cards and what a drop on the pile does
  are `documents`' [Block Editor](../../../src/extensions/documents/docs/system/documents/block-editor.md#an-inbox-of-decisions), An Inbox Of Decisions.
* The person defers a card by dragging it onto a pile at the screen's edge, shown only while a card
  is dragged and gone when the drag ends. It is no button: nothing else opens it. User decisions,
  2026-10-05 (`BO_0350_Q5`, `BO_0350_Q12`).
- The edge pile (`BO_0350_020`, landed 2026-10-05; `LATER_TARGET` and `showsLater` in `src/lib/drag.ts`).
  `defer` is a drag operation. While the dragged payload offers it — a view's card does, nothing
  else — the shell draws *Later*, with the `clock` glyph, along the workspace's trailing edge as a
  drop target (`data-drop-target="later"`, accepting `defer`), lit while the pointer is over it, and
  removes it when the drag ends. The pile is no shell target, so a drop on it is handed to the view
  as every view drop is. On a phone it stands 24px in from the edge, clear of the system's back
  gesture. Proven in `documents`' `views/proposals/inbox.test.ts`: shown for a card and not for a
  block, and `defer` resolved for a card and nothing for a block.
