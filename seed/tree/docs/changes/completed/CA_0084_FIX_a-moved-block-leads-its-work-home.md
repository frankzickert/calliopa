# A Moved Block Leads Its Work Home

Status: completed

The user reported on 2026-10-06: they moved a block that has focused work from one document into
another, and the focused work, opened, still shows the route through the old parent. The move
itself is right — the block keeps its identity and its `focuses` edge, so the work now stands
under the new document — but the route line does not follow it.

## What The System Already Holds

- `moveBlockIn` in `documents`' `server/documents.ts` (`CA_0072_006`) moves a block into another
  document in one write, its identity, content and `focuses` edge kept: a block with focused work
  takes the work along.
- A tab's `route` is stored with the tab in the workspace record and is navigation only — the path
  the reader came by, with no containment meaning ([Tabs](../../system/workspace/tabs.md),
  `CA_0047_003`). Nothing reads it back from the graph.
- Opening focused work from a block builds the route from the parent tab's route with the block,
  the child last (`pressBlockControl$` in `src/components/shell/shell.tsx`), and hands it to
  `openAlongRoute` in `src/lib/tabs.ts`, which goes through `openTabBeside`: a tab already showing
  the child becomes active "as it stands, its own route kept". So the child's tab opened under the
  old parent — open, or stored in the workspace record — keeps the old route when the reader opens
  the work again from the new parent.
- A crumb (`back$` in `documents`' `views/block-editor.tsx`) opens the document it names and lands
  on the block stored with it; after a move that document no longer holds the block.
- [Focused Work](../../system/workspace/focused-work.md) holds the fixed line *The child's tab keeps
  the route line, unchanged: it is the path the reader came by …* (user decision, 2026-09-30,
  `CA_0073`).

## What Is Asked

* Opening focused work from a block gives its tab the route the reader just came by, also when a
  tab already shows the work: the stored route is replaced with the new one, and the tab becomes
  active. User decision, 2026-10-06, choosing this over rewriting routes on a move and over
  deriving the route from the graph.
* A route step whose block is no longer in that document is shown as such, so a crumb never sends
  the reader back into a document as though the block were still there. User decision,
  2026-10-06.

## Shape Of The Change

- `openAlongRoute` takes, for an open from a block, the new route onto a tab already showing the
  target; *Back* and a crumb keep revealing a tab as it stands, as today. The parent's tab stays
  as it was.
- The fixed line in [Focused Work](../../system/workspace/focused-work.md) and the matching sentence
  in [Tabs](../../system/workspace/tabs.md) change with the user's decision above — the route stays
  the path the reader came by, now the latest one.
- Whether a crumb's block still stands is read where the route line renders, from the document
  the crumb names.
- `tabs.test.ts` proves an open child's tab taking the new route on an open from a block and
  keeping its route on *Back*; `documents`' render harness proves the crumb whose block moved
  away.
- The release notes say under *Fixed* that focused work opened from a block shows the route it
  was opened by, also after its block moved to another document.

## System Work

- Set to draft by the user on 2026-10-06, transferred the same day, and set to ready by the user the
  same day. `CA_0084_001` (an open from a block gives an open tab the route just come by,
  [Tabs](../../system/workspace/tabs.md)) and `CA_0084_002` (a crumb whose block moved away is dimmed
  and opens its document at the top, `documents`' [Block Editor](../../../src/extensions/documents/docs/system/documents/block-editor.md))
  landed on 2026-10-06; `structures`' field child passes the same `fromBlock`.
- `CA_0084_003`, the user's walk on the served build at pin 4982, passed on 2026-10-06 ([Focused Work](../../system/workspace/focused-work.md)), and the change completed.
