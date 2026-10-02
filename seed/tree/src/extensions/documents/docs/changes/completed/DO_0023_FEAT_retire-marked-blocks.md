# Retire Marked Blocks

Status: completed

Requested: 2026-09-29, by the user: marking text across several blocks at once works when the drag starts in an accepted block, and does not when it starts in a proposal or a fixated block. Marking should work from any block; while it spans several blocks no single block shows its controls; and *Retire* in the bar retires every marked block.

## Behavior

- A text selection may start in any block the reading order draws — an accepted block, a fixated block, or a proposal — and extend across the blocks after or before it, the way it already does from an accepted block.
- A block counts as marked when the selection touches it, including the first and last blocks it covers only in part. User decision, 2026-09-29.
- While the selection covers more than one block, no individual block shows its controls: no block is the bar's subject, no chip opens, and no row takes the active or focused look from the selection alone.
- While the selection covers more than one block, the bar keeps its single-block controls — *Turn into*, the *Add* buttons, *Number*, *Standing* — visible and disabled; *Retire* alone is enabled. User decision, 2026-09-29.
- The bar's *Retire* acts on the selection: pressing it retires every marked block in one write, fixated blocks included, and each lands in the document's retired list, restorable one by one as today. Fixation guards the words against rewriting, not the block against removal. User decision, 2026-09-29.
- An open proposal in the selection is declined by the same press, since a proposal is not yet in the document and declining is how it leaves the reading order. User decision, 2026-09-29.
- Once *Retire* has run, the selection clears and no block is focused. User decision, 2026-09-29.
- This is the editor's text selection in reading, separate from command mode's marks (`command-mode.md`): it sets no command-mode mark, and command mode's marks keep their own gesture and meaning. User decision, 2026-09-29.
- A selection inside one block keeps today's behavior: that block is the subject and *Retire* retires it alone.

## Notes

- The Retire button today is `block-retire` in the *Block* group of `views/block-editor.tsx`, running `press$({ act: "retire" })` on the single subject block; retirement is `server/documents.ts` (one `retired` relation per block, containment closed in the same mutation). Retiring several in one mutation is the same script repeated per block under one base; declining the covered proposals belongs in the same press, and whether it can share that one write or follows it is a technical choice for the implementation.
- Why a drag from a proposal or a fixated row does not extend across blocks is to be found in the implementation (their rows and cards answer the press differently from an accepted row — `views/press.ts`, the card and chip handlers).
