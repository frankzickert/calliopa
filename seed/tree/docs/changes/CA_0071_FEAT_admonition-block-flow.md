# CA_0071_FEAT_admonition-block-flow

Status: ready

Requested: 2026-09-28, by the user: refine admonition rendering, pattern selection, and paragraph creation after creating and trying an admonition pattern.

## Behavior

- Center an admonition's selected image on the left edge of the full callout: the image's horizontal midpoint sits on the edge, and its vertical midpoint aligns with the callout's vertical midpoint. Fit it in a fixed square image area, cropped to fill and centered within the square.
- Use a lighter tint of the selected pattern color as the background across the entire admonition block.
- Put the exact pattern choice in the block-type picker alongside paragraph and heading types. Each saved admonition pattern is its own picker entry, labeled with that pattern's saved name. Choosing one creates a callout bound to that pattern.
- Remove the pattern selector from an existing admonition block.
- Remove the separate *Add paragraph* button. Use the editor's normal paragraph-creation behavior: a paragraph created after a child paragraph remains inside the admonition.
- When the final child block inside an admonition is already empty and the user creates another block from it, create the new block immediately below the admonition, outside the container.

## Tasks

- `CA_0071_001` — documents block editor: center the image in a fixed square at the callout's left edge and apply a lighter selected-color background across the full block.
- `CA_0071_002` — documents block editor: show each saved pattern as a block-type choice that creates a callout bound to that pattern; remove the in-callout pattern selector.
- `CA_0071_003` — documents block editor: remove the separate paragraph button and support normal paragraph creation inside the callout, exiting below it from an already-empty final child.

The implementation tasks are enumerated in the documents extension's Block Editor View system document.
