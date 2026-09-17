# BO_0231_FEAT_standing-in-command-mode

Status: completed

Requested: 2026-09-10, at the close of `BO_0227`'s walk-through. **The standing must sit somewhere else, because the toolbar is only visible in edit mode. When in command mode, show the standing options as icon buttons at the border of a block on hover.** User statement.

## Where This Starts

- **`BO_0227` put the non-gesture path to the disposition scale in the bar** (`StandingControl`, `src/components/views/standing/standing-control.tsx`), because every control acting on the active block lives there (`block-editor.md`, *Presentation*). The bar exists only while a block is active, and command mode activates no block — so in the mode where standing matters most, the pointer has no path to it. `BO_0227` decided a pointer in command mode needed none, leaning on the chord (`Alt`+`Shift`+arrow on a focused row) and on leaving the mode to use the bar. Use says otherwise: this change reverses that decision.

- **Every change of standing already goes through one write** (`setStanding$`, `use-standing.ts`), with its undo and announcement, so a new control needs no new write path.

- **A command-mode row is itself a button** (`role="button"`, `aria-pressed`, the whole row marks the block, `CA_0020_003`). Buttons placed inside it would be interactive controls nested in a button, which assistive technology cannot reach reliably and axe refuses. The icons therefore cannot simply be children of today's row element.

- **The reading surface is content-only by rule.** *"An inactive block shows its content and nothing else. No hover border, no control gutter, and no per-block chrome renders around a block nobody is editing"* (`block-editor.md`). This change is about command mode, which already draws per-block treatment (the marking outline and numbers); reading mode stays as it is.

## Intent

* In command mode a reader with a pointer sets a block's standing where the block is, without leaving the mode: icon buttons for keep, pin, resolve and discard appear at the block's border while the pointer is over it, the current standing shown as pressed.

* The same controls are reachable from the keyboard — shown when the block has focus — so hover is never the only way to them.

* Touch keeps the swipe; the icons are for pointers that hover.

## The Shape

- **A standing toolbar beside the marking target, not inside it.** The command-mode row splits into the element that marks (today's `role="button"` behaviour, unchanged) and a sibling toolbar of four icon buttons riding the row's top border, like a tab, out of the flow so it moves no text. Each button is named from `LABEL` (`Keep`, `Pin`, `Resolve`, `Discard`), carries its glyph from `standing-mark.tsx` (◇ ◆ ✓ and one for discard), and `aria-pressed` for the current standing; pressing the pressed one returns the block to neutral. Each writes through `setStanding$`, so the undo line and the announcement follow.

- **Shown on hover and on focus.** Visible while the pointer is over the row (`@media (hover: hover)`) or while focus is within it, never otherwise; the space is reserved so showing it moves nothing. On a pointer that cannot hover, it is not drawn — the swipe is the path.

- **Its own component** (`standing/standing-toolbar.tsx`), reading `StandingContext`, so a standing written re-renders it alone.

- **The bar's control stays** for the block being edited, and the chord stays on a focused row.

## Decided

Decided by the user on 2026-09-10:

- **The top border.** The toolbar rides the block's top edge, like a tab — clear of the leading gutter, which holds the reference number and the standing mark, and clear of the words. Declined: the trailing edge and the leading gutter.

- **Neutral by pressing the pressed button again.** Four buttons, not five.

- **Command mode only.** The reading surface's content-only rule stands; reading keeps the chord and the bar.

## Verification

In Qwik's render harness through a real `.tsx` host (`qwik-member-props-freeze`): in command mode the toolbar is present for a hovered or focused row and absent otherwise; each button writes its standing through the harness's documents API; the pressed state follows the standing; pressing the pressed button returns to neutral; a press on a toolbar button never marks the row. An axe-shaped check that no interactive element is nested in the marking button. On the instance, with a mouse: hover a block in command mode, keep it, pin it, discard it and take it back from the dock's undo line.

## Transfer

Transferred on 2026-09-10 as `BO_0231_001`–`BO_0231_007` under *Standing In Command Mode* in `docs/system/ui-shell.md`: the marking control and the toolbar as siblings, the toolbar component, the press decided once, its place and its showing, the graph's docs, the tree tests and the verification on the instance. The transfer confirmed that a command-mode row is itself the `role="button"` today, which is why `_001` moves the marking role onto a text block's reading text. Order: `_001` before `_002`–`_004`; `_005` and `_006` go with them; `_007` needs a promotion.

## Closed (2026-09-10)

**Completed on the user's word — "accepted" — after promotion to pin 228.** Staged as `node:chg-537274d9b6800dc0` and read back identical to the tested tree, accepted by the user and promoted with `BO_0230` at pin 228, where the combined tree type-checks and passes 526 tests. On the way, the words' marking attributes never updated while the reading element's tag was held in a variable: the optimizer compiles `<Tag>` with a string type as `_jsxC`, which takes every prop as immutable, so the marking control is a literal wrapper `div` around the reading element.

No follow-up is open.
