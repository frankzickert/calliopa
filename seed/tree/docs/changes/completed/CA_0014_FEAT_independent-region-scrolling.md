# CA_0014_FEAT_independent-region-scrolling

Status: completed

Requested: 2026-08-30

## Intent

The shell is one long page. `.shell` sets `min-height: 100vh` and then grows,
so a document taller than the viewport pushes the header off the top and the
command dock off the bottom, and the two drawers stretch downward with it. The
library and the inspector are dragged along by content they do not hold, and
the reader loses the tab strip exactly when a long document makes tabs worth
reaching.

The pieces that would fix this are already written and inert. `.drawer` declares
`overflow: auto` and `.block-surface` declares `overflow-y: auto`, but neither
ever scrolls, because no ancestor bounds their height. `CA_0012_001` already
says its bar "stays at that edge while the surface scrolls under it", and
`CA_0012_002` already moves "the surface's scroll". They are describing a scroll
container that does not exist yet.

This change bounds the frame to the viewport and gives the left drawer, the
workspace, and the right drawer each its own scroll. The header and the dock
stay where they are put.

## The Frame

* The shell occupies the viewport height and does not scroll as a whole.
* The header and the command dock remain visible whatever any region holds.

- The frame is measured in dynamic viewport units, so a phone browser collapsing
  its own chrome does not leave the dock beneath the address bar.
- The document itself no longer scrolls. Page scroll becoming impossible is what
  makes "independently" mean anything: while the page can scroll, every region
  moves together no matter what each one declares.
- The header keeps its own horizontal tab-strip scroll, unchanged. That strip
  scrolls sideways inside a header that does not move.

## Independent Regions

* The left drawer, the workspace, and the right drawer each scroll their own
  content.
* Scrolling one of them moves nothing in the other two.

- A region whose content fits does not scroll and shows no scrollbar. Scroll
  arrives from overflow, not from being a region.
- The regions scroll vertically. Horizontal overflow stays the business of the
  content that has it — the tab strip, the formatting bar, a wide table — rather
  than of the region around it.
- The region is the scroll container, so a mounted view is handed a bounded
  height and can size itself against it. This is the height `.block-surface`
  and `CA_0012_001` already assume.
- The region has no chrome of its own that stays put. Everything the workspace
  holds, including the `Open in <view>` group and the context actions that render
  after the host, scrolls with the view. A bar that stays at the top edge while
  content passes under it belongs to the view that owns the content, which is
  where `CA_0012_001` already puts it.
- Those controls sit below the view, so a long document leaves them below the
  fold. That is today's behaviour under page scroll and this change neither
  causes it nor fixes it. Where the workspace region's own controls belong is a
  question for the surface `CA_0013_001` is reshaping, and answering it in two
  changes at once would be worse than answering it once there.
- A drawer in its `compact` state scrolls the same way. Narrow is not short.

## Mobile

- The drawers are already fixed sheets with their own scroll and keep it
  unchanged.
- The workspace is the only middle region on a phone, and it becomes the scroll
  container there too.
- The dock is `position: sticky` on mobile today, which is the page-scroll
  workaround for a dock that would otherwise be pushed away. With a bounded
  frame it is simply the bottom row, and the sticky rule goes.
- The compact header keeps both its rows pinned above the scrolling workspace,
  identity row and tab strip alike. The frame is the frame on both form factors,
  and the tab strip is the primary navigation on a phone, so the row that is
  worth reaching mid-document is exactly the one a collapsing header would take
  away. It costs roughly two rows of a short viewport, and that is the price.
- The frame follows the visual viewport, so an on-screen keyboard shrinks it
  rather than covering the dock, and the pinned rows stay above the keyboard
  instead of being pushed off the top.

## Reaching A Scrolled Region

* A region that scrolls must be scrollable from the keyboard.

- Both drawers already carry `tabIndex={0}`. The workspace section does not, and
  becomes scrollable in this change, so it gains the same reach. Without it a
  keyboard-only reader cannot move a document that no longer moves with the page,
  and the axe scans fail on it.
- Focus moving into a region must not scroll a different one. Activating a
  library entry scrolls the library to nothing.

## Supersedes

- [Workspace Shell](../../system/workspace/frame.md) gains the frame rule and the
  per-region scroll in its desktop and mobile layout sections. Its layout truth
  today names the regions and their states and says nothing about who scrolls.
- Its mobile line placing the dock in a sticky position is replaced by the dock
  being the frame's bottom row.
- [Block Editor View](../../system/documents/block-editor.md) changes in no way.
  `CA_0012_001`, `CA_0012_002`, and `CA_0013_006` keep their wording; this change
  supplies the scrolling surface they already describe.
- [Workspace View Types](../../system/workspace/view-types.md) keeps its host
  boundary unchanged. The host is handed a bounded region rather than an
  unbounded one, which is a property of the region, not of the contract.
- The fixed line giving each tab its own scroll position is unaffected in
  meaning and becomes implementable for the first time, because there is now a
  scroll position to keep. Restoring it across a tab switch is not this change:
  it carries its own decisions — browser-local or persisted, and what a restored
  offset means once the document changed underneath — that have nothing to do
  with bounding a region.

## Verification Impact

- `tests/browser/layout.spec.ts` proves the regions and their state cycle today
  and is where the scroll scenarios belong.
- Scenarios: with content taller than the viewport, the page itself does not
  scroll; the header and the dock stay in view while the workspace scrolls; the
  library scrolls without moving the workspace, and the workspace scrolls without
  moving the library; a region whose content fits does not scroll; the workspace
  scrolls from the keyboard; on mobile the identity row and the tab strip both
  stay in view while the workspace scrolls, and a tab stays selectable from a
  scrolled document; and on mobile the left sheet scrolls its own list while the
  workspace stays where it was left.
- The axe scans must stay clean on desktop and mobile with every region both
  scrolled and unscrolled, including the scrollable-region-focusable rule the
  workspace newly falls under.
- `pnpm run verify` gates the result.

## System Work

Transferred. The tasks below are the authoritative work; this document does not
duplicate them.

- `CA_0014_001` in [Workspace Shell](../../system/workspace/frame.md) bounds the
  shell frame to the viewport, keeps the header and the dock in view, and
  removes the mobile dock's sticky position.
- `CA_0014_002` gives the left drawer, the workspace, and the right drawer each
  its own vertical scroll inside that frame.
- `CA_0014_003` makes the workspace region keyboard-scrollable, which it must be
  once it scrolls and the page does not.
- `CA_0014_004` keeps both rows of the compact header pinned on a phone.
- `CA_0014_005` restores each tab's scroll position across a tab switch. It is
  enumerated alongside the others so it is claimable, and it is deliberately
  outside this change's closure.

The frame and scrolling rules land in a `Frame And Scrolling` section of
[Workspace Shell](../../system/workspace/frame.md) rather than being repeated in
its desktop and mobile layout sections. The rule is one rule on both form
factors, and stating it twice would be two places to disagree.

The line about the workspace region's own controls scrolling with the view is
transferred as truth rather than as a task. It states where those controls sit
and does not move them; where they belong is a question for the surface
`CA_0013_001` is reshaping.
