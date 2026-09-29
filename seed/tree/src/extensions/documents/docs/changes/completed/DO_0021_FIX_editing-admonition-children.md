# Edit Admonition Child Blocks

Status: completed

Requested: 2026-09-29, by the user: fix editing behavior for text blocks inside admonitions. Enter creates a child block without placing the cursor in it; up/down cursor navigation and Backspace/Delete merging do not work between child blocks.

## Behavior

- Pressing Enter in an admonition child splits its text at the caret, creates the next ordered child block and places the caret in that block.
- Up and Down move within the current child first. At its visual top or bottom edge, they move to the adjacent child and retain the expected horizontal caret position.
- Backspace at the start of a child and Delete at its end merge it with the adjacent child, preserving text order and placing the caret at the merge point. Elsewhere, both keys delete text normally.
- Merging the only remaining child down to empty leaves one empty child in the admonition; the last child cannot be removed by merging.
- A child absorbed by a merge is retired into the document-wide retired blocks, matching a top-level merge.
- Editing child blocks keeps the caret within the admonition and preserves their order in the document.
