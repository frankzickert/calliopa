# CA_0012_FEAT_active-block-toolbar

Status: completed

Requested: 2026-08-30

## Intent

The block editor's button bar is always present. With no block active it renders
as a full row of disabled buttons above the document, so the resting reading
surface carries control chrome for a block nobody is editing, and the document
starts a toolbar's height down the tab.

This change makes the button bar appear only while a block is active, places it
at the very top of the editor area, and makes its appearance and disappearance
cost the document no movement. The save status it carries today does not go with
it; it moves up into the shell header, where the tab already says whether its
work is saved.

## Toolbar Presence

* The button bar sits at the very top of the editor area.
* The button bar is present only while a block is active.
* Showing or hiding the button bar must not move the document content.

- Reading presentation is the resting state, so with no block active the editor
  area shows the document and nothing else. This is the same reason the surface
  carries no block borders until a block is reached.
- The bar therefore renders over the top of the editor area rather than in the
  column's flow: reserving a permanent gap for it would leave the resting
  surface shaped by a control that is not there, and letting it take flow space
  would push the document down the moment a block is activated.
- The bar spans the editor area's width at its top edge and stays there while
  the surface scrolls under it, so it is found in one place rather than tracking
  the active block.
- The bar is opaque against the surface scrolling beneath it, so text passing
  under it does not read through the controls.
- The bar's controls are the ones the view already carries: formatting marks,
  the link control, role conversion, undo and redo, and done editing. This
  change moves and conditions the bar; it does not add or remove a control.
- With the bar present only when a block is active, its controls are never
  disabled for want of a block. The disabled state stays only where a control is
  genuinely unavailable, such as undo with no history.

## Keeping The Active Block Visible

- The active block carries a scroll margin equal to the bar's height, so
  activating a block that would otherwise sit under the bar scrolls the surface
  just far enough to clear it.
- Activating a block that is already fully visible scrolls nothing. The
  correction is a response to being covered, not a routine of activation.
- This is the one movement the change permits, and it moves the surface's scroll
  rather than the document's layout. Nothing is pushed; the reader is taken to
  where the text is.

## Save Status

- The save status leaves the button bar. A bar that exists only while a block is
  active cannot be where the reader learns whether their work is safe.
- Save state reaches the shell header, which shows the active tab's state
  whether or not a block is active.
- It travels the view bridge channel that already carries the tab's unsaved
  marker, widened from "unsaved or not" to the save state the editor knows:
  saving, saved, or unsaved. The header must not grow a second, competing notion
  of whether a tab holds unsaved work.
- The tab's existing round unsaved marker keeps its job of saying which tabs
  hold unsaved work, including tabs that are not active.
- The conflict outcome stays on the affected block, unchanged. That is a fixed
  line in [Block Editor View](../../system/documents/block-editor.md): a failed or
  refused save names the block it happened to, which a tab-level status cannot
  do.
- One functional question remains open and is carried as a `[ ]` line in
  [Workspace Shell](../../system/workspace/frame.md): whether the active tab keeps
  its round unsaved marker once the header names its save state in words. The
  header state is built either way, so nothing waits on the answer but the
  marker.

## Narrow Viewports

- The bar does not wrap. Where its controls do not fit the width, it scrolls
  horizontally.
- One bar height on every viewport is what keeps the overlay rule and the
  scroll-margin above true everywhere, rather than true on desktop and
  approximate on a phone.
- Every control stays reachable by scrolling the bar, so no viewport loses a
  formatting mark or a role.
- The bar stays at the top of the editor area on touch viewports too. It does
  not become a keyboard-anchored bottom bar.

## Supersedes

- [Block Editor View](../../system/documents/block-editor.md) describes the action
  surfaces without saying where they live or when they appear. Its presentation
  section gains the bar's placement, its activation-conditioned presence, and
  the scroll margin that keeps the active block visible.
- Its implementation line describing the toolbar as a sibling of the block
  surface, and its disabled-for-want-of-a-block behaviour, change with the bar.
- Its line placing save state on the affected block splits: the conflict outcome
  stays on the block as the fixed line requires, and ordinary save state moves to
  the shell header.
- [Workspace Shell](../../system/workspace/frame.md) gains the header's save-status
  region and the widened bridge channel behind it. Its bridge line currently
  names "set its unsaved marker" as the whole of that channel.
- [Workspace View Types](../../system/workspace/view-types.md) owns the view
  contract the widened channel belongs to.

## Verification Impact

- `tests/browser/block-editor.spec.ts` reaches the toolbar and the save status
  while reading, and must reach them under the new rules instead.
- Scenarios belonging with this change: no bar with no block active; the bar
  present at the top of the editor area once a block is activated; the document
  occupying the same position before and after activation; activating the
  topmost block leaving it visible rather than covered; and the header reporting
  the save state that used to be reported in the bar.
- The formatting, role, undo, and retire scenarios drive controls in this bar
  and must keep passing unchanged.
- The conflict scenario must still find its outcome on the affected block.
- The axe scans must stay clean with the bar present and absent, on desktop and
  on mobile.
- `pnpm run verify` gates the result.

## System Work

Implemented as `CA_0012_001`-`CA_0012_005`, each folded into truth in the
document that owns it.

- [Block Editor View](../../system/documents/block-editor.md) carries the bar's
  placement and presence, the scroll margin, and the split between the tab's
  save state and the block's refusal.
- [Workspace Shell](../../system/workspace/frame.md) carries the header's save
  state and the tab marker projected from it.
- [Workspace View Types](../../system/workspace/view-types.md) carries the widened
  bridge channel.

Two things outlived the change and are open in `docs/system/`:

- `CA_0012_006` in [Block Editor View](../../system/documents/block-editor.md). The
  scroll margin is in place and activation scrolls with it, but no region
  scrolls under the bar yet: the editor's surface has never scrolled, because no
  ancestor bounds its height, so today the page scrolls and the bar travels with
  it. The covered-block scenario becomes reachable when `CA_0014_002` bounds the
  regions.
- The functional question in [Workspace Shell](../../system/workspace/frame.md)
  about whether the active tab keeps its round unsaved marker now that the
  header names its state in words.
