# CA_0027_STYLE_editor-bar-flush-to-tab

Status: completed

## Summary

In a document tab the block editor's bar is docked to the top edge of the tab's region,
meeting the region's top, leading, and trailing edges with no gap, and the document
reads from the top of the region and scrolls beneath the bar's full height.

## Current Truth

- `.workspace` in `src/components/shell/shell.css` insets every view by `2rem`, and by
  `1.25rem` below 640px.
- `.block-toolbar` in `src/components/views/block-editor.css` is out of flow at `top: 0`
  and `inset-inline: 0` of `.view--block-editor`, so today it is flush to the *view*,
  which is already inset by the workspace padding. The reader sees a gap above and to
  each side of the bar.
- The bar carries a `1px` border on all four edges and a `0.5rem` radius on
  `--panel-raised`, which reads as a floating panel.
- `.shell-header` is `--panel-raised` with a `border-bottom`, and `.dock` is
  `--panel-raised` with a `border-top` and no radius. A bar docked at the top of the
  region is `.dock` mirrored.
- [Block Editor View](../../system/documents/block-editor.md) fixes that the bar sits at the top
  edge of the editor area, spans its width, is opaque, is one row high, and is present
  only while a block is active, and that block rows clear it through
  `--block-bar-height`. None of that changes here; the editor area becomes the whole
  region, so the rules finally describe what the reader sees.

## Intended Outcome

- While a block is active, the bar's top, leading, and trailing edges meet the tab
  region's edges. Nothing of the region's background shows above or beside it.
- The document reads from the top of the region, so the bar covers document content
  rather than empty padding, and the surface scrolls beneath the bar's full height.
- The reading column keeps the horizontal inset it has today. Line length does not
  change; only the vertical arrangement does.
- The bar carries a border on its bottom edge alone and no radius, mirroring `.dock`.
  Its top edge needs no border because `.shell-header` already draws one, and a second
  line one pixel below it would read as a doubled seam. Its sides need none because they
  are the region's edges.
- Reading presentation stays the resting state: with no block active there is no bar,
  and no document content moves when one appears or goes.
- The settings tab and the fallback views keep the inset they have. This is the block
  editor negating the region's padding for itself, not the region losing it.

## System Work

The specification lives in `docs/system/`. This section is the coordination record only.

- `CA_0027_001` in [Workspace Shell](../../system/workspace/frame.md), Frame And Scrolling: the
  region publishes its inset as a named value.
- `CA_0027_002` in [Block Editor View](../../system/documents/block-editor.md), Presentation: the
  editor negates that inset, the bar meets the region's edges, and the document reads from the
  top of the region. Depends on `CA_0027_001`.
- `CA_0027_003` in the same section: the docked bar's border and corners. Depends on
  `CA_0027_002`.

## Out Of Scope

- The editor's notice renders where the bar sits, so a notice raised while a block is active is
  covered. True today and not caused by this change, though docking the bar makes it certain.
  It is an unowned open line in [Block Editor View](../../system/documents/block-editor.md), Editing And
  Saving, waiting for a change document to own it.
