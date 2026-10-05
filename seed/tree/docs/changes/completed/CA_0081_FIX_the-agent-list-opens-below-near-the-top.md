# CA_0081_FIX_the-agent-list-opens-below-near-the-top

Status: completed

Requested: 2026-10-05, by the user: "when the command bar sits too far to the top to show the agent
selection, expand it to the bottom".

## The Defect

- A block's command control near the top of a document opens its agent list upward, and the list's
  top — where the agents are — is cut off, so the agent cannot be chosen.
- [The Agent List Fits The Screen](../../system/workspace/commands-and-runs.md#the-agent-list-fits-the-screen)
  already says the list opens on whichever side of its button has more room. The rule is right; the
  room it is given is wrong.
- `agent-menu.tsx`'s `fit` measures the room against the window (`window.innerHeight`, the button's
  `getBoundingClientRect()`), but the list is absolutely positioned inside the region the document
  scrolls in, which clips it (`overflow-y: auto` in `shell.css`). Above a control at the top of a
  document the window still has the header and the document's bar, so `roomFor` counts their height
  as room, chooses *above*, and the region's top edge cuts the list off.

## The Change

- The room on each side is measured to the edge that actually clips the list: the nearest ancestor
  that clips its overflow, intersected with the window. A control at the top of a document then has
  little room above, more below, and the list opens downward and scrolls inside what it has.
- `roomFor` stays pure; it is handed the clipping bounds (top and bottom, left and right) rather than
  the window's size, and `agent-menu.tsx` finds them when the list opens.
- Proven in `src/lib/agent-menu-room.test.ts`: a button low in the window but near the top of its
  clipping region opens below; the existing cases hold with the window as the bounds.
- Walked on the dev instance: a block at the top of a document, scrolled to the top and with the
  document's bar in view, on a desktop and a phone — the list opens below and every agent can be
  chosen; a block at the foot still opens upward.

## Open

- Owner: `ui.shell` (the agent menu is the shell's `src/components/shell/agent-menu.tsx` and
  `src/lib/agent-menu.ts`); the command control that hosts it is `documents`', unchanged.
- Release notes: a Fixed line, since `ui.shell` is bundled.
- Transferred on 2026-10-05 as `CA_0081_001`–`CA_0081_004` in
  [Commands And Runs](../../system/workspace/commands-and-runs.md#the-agent-list-fits-the-screen),
  The Agent List Fits The Screen.
- Completed on 2026-10-05: implemented at pin 4595, walked by the user on a desktop and a phone, and
  the Fixed line added to `calliopa-bootstrap`'s `docs/release-notes/unreleased.md`.
