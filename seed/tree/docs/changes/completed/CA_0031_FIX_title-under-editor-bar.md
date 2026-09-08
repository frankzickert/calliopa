# CA_0031_FIX_title-under-editor-bar

Status: completed

Requested: 2026-09-03

## Intent

With the document scrolled fully to the top, activating a block puts the bar over
the document's title. The headline is the largest text in the tab and the name of
the thing being written, and it disappears at the exact moment the reader starts
writing in it.

The document should reserve enough space before the headline that the bar, when it
appears, covers the reserved space rather than the title.

## What Happens

[Block Editor View](../../system/documents/block-editor.md), Presentation, records the
arrangement `CA_0027` left: the bar is docked to the tab region, out of the
document's flow, and the document reads from the top of the region, "so what the
bar covers is content rather than the inset above it". At the top of the document
that content is the title.

- `.view--block-editor[data-editor-mode]` negates the region's inset on its top
  edge (`block-editor.css:36`), so the editor's own top edge is the region's.
- `.block-toolbar` is `position: absolute; top: 0` with
  `min-height: var(--block-bar-height)`, which is `2.5rem`
  (`block-editor.css:12`, `block-editor.css:56`).
- `.block-surface` is the scrolling element and its only top offset is the
  `0.5rem` of its `padding` shorthand (`block-editor.css:155`).
- `.document-title` is the surface's first content, `2rem` at `line-height: 1.2`
  (`block-editor.css:161`).

So at scroll offset zero the title occupies roughly the first `0.5rem` to `3rem`
of the surface and the bar covers `0` to `2.5rem` plus its border. Nearly the
whole headline is behind an opaque `--panel-raised` background.

- `.block-row` already carries `scroll-margin-top: calc(var(--block-bar-height) +
  0.5rem)`, so an activated *block* is scrolled clear of the bar. The title
  carries no such margin and is never scrolled to, so nothing clears it.
- The title is a tabbable `contentEditable` `textbox`, so the browser scrolls it
  into view when focus reaches it from further down the document. With no scroll
  margin it can land under the bar there too.
- The behaviour is a consequence of `CA_0027`, not a defect introduced by an
  incomplete implementation of it. Before the bar docked over the document, the
  region's `2rem` inset sat above the title and absorbed the overlap.

## Intended Outcome

- The document reserves space before its headline, and the bar lands on that
  space rather than on the title. With the surface scrolled to the top, the
  headline is fully readable with a block active.
- The space is reserved whether or not a block is active. A gap that appeared
  with the bar would move the whole document down on activation, which is the
  reason the bar was taken out of flow in the first place; the resting reading
  surface would still shift, only later.
- The title clears the bar on every route into it, not only at scroll offset
  zero: it carries the same scroll margin a block row carries, so focus arriving
  from further down the document stops the title below the bar rather than under
  it. A wheel or touch scroll that stops mid-title is untouched — that is content
  passing under an opaque bar, which is what the bar is for.
- Nothing else about the bar changes: it still renders over the surface rather
  than in flow, showing and hiding it still moves no document content, and its
  top, leading, and trailing edges are still the region's own.

## How The Space Works

These are technical decisions, recorded here so the implementation does not
re-open them.

- The space is `calc(var(--block-bar-height) + 0.5rem)` on `.block-surface`'s top
  padding, and the title's scroll margin is the same expression, which is already
  what `.block-row` uses. One number governs the bar's height, a block row's
  clearance, and the headline's, so none of the three can drift into the others.
- It is padding inside the scrolling surface rather than an offset that starts the
  surface lower. The surface reaching the region's edges is what lets the document
  scroll under the full height of the bar, and that stays true.
- The visible consequence is that every document, including one nobody is
  editing, begins with a bar's height of empty space above its headline. That is
  close to what the region's inset gave the document before `CA_0027`, so the
  resting surface reads much as it did then; only the bar's own edges stay flush
  to the region.
- The per-tab scroll offsets are an in-memory map living for the page's lifetime
  (`block-editor.tsx:1271`), so no stored position goes stale when the content
  shifts down.

## Coordination

- The unowned line in [Block Editor View](../../system/documents/block-editor.md),
  "Move the editor's notice clear of the bar", is the same overlap from the other
  side and stays out of this change. The notice renders in flow above
  `.block-surface`, so space reserved inside the surface does not reach it, and
  deciding where a notice goes once the top edge belongs to the bar is its own
  question. This change must not make that line harder to answer: it moves
  nothing above the surface.
- `CA_0028` and `CA_0029` are completed in the same view and the same files. Neither
  touched the surface's top offset or the title's box. `CA_0028_003`, the press on the
  title that ends an edit, is the open task that waits on this one: the resolution and
  the restoration are built, and what is missing is a title a reader can press.

## Docs This Will Touch

- [Block Editor View](../../system/documents/block-editor.md), Presentation, the line
  reading "The bar renders over the surface rather than in the editor area's
  flow, so showing and hiding it moves no document content. Reserving a permanent
  gap instead would shape the resting reading surface around a control that is
  not there." The first sentence stays true and is the reason this change is
  shaped the way it is. The second stops being true and has to be rewritten: the
  space is the headline's own rather than a slot held for the bar, it is there
  whether or not a bar ever appears, and that is exactly why showing and hiding
  the bar still moves nothing.
- The same document's line saying the document reads from the top of the region
  so what the bar covers is content. Half of that stays true — the bar's edges
  are still the region's — and the half about what it covers has to say that the
  title is not among it.
- The same document's account of the editable title, which gains the clearance it
  keeps from the bar.

## Verification Impact

- `tests/browser/block-editor.spec.ts` is where this belongs, beside the bar
  scenarios.
- The scenario worth having: with the surface scrolled to the top, activate the
  first block and compare the title's box against the bar's, on both form
  factors. `CA_0012_006` is the open task proving the same for a block row, and
  the two are the same measurement against the same bar.
- A second scenario for the focus route: from a scroll position deep in the
  document, move focus to the title and compare the same two boxes.
- `pnpm run verify` gates the result.

## System Work

The specification lives in `docs/system/`. This section is the coordination record only.

- `CA_0031_001` in [Block Editor View](../../system/documents/block-editor.md), Presentation: the
  surface reserves the headline's space at its top, so the bar lands on that space rather
  than on the title, and the Presentation lines about the permanent gap and about what the
  bar covers are rewritten with it.
- `CA_0031_002` in the same section: the title carries the scroll margin a block row
  carries, so focus arriving from further down the document stops it below the bar.
- `CA_0028_003`, the press on the title that ends an edit, stays open and waits on
  `CA_0031_001`. It is not part of this change.

## Out Of Scope

- The bar's own height, position, border, and docking. `CA_0027` settled those
  and this change reads `--block-bar-height` rather than changing it.
- The editor's notice, which keeps its unowned line in the view document.
- The reading inset on the surface's other three edges.
