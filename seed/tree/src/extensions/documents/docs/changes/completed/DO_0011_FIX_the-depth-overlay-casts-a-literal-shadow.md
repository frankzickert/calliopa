# DO_0011_FIX_the-depth-overlay-casts-a-literal-shadow

Status: completed

Found: 2026-09-22, while verifying `CA_0061`: the behavior project's theme-token check fails at
head, on a line this extension's stylesheet carries.

One rule in `views/block-editor.css` paints with a literal colour, so the check that keeps every
stylesheet on semantic tokens fails for the whole tree. It is one line, and while it stands the
check says nothing about any stylesheet: the next literal colour lands behind a suite that is
already red.

## Where This Starts

- **The rule.** `.block-depth__rail[data-depth-overlay]` (`views/block-editor.css`, the depth
  overlay `RF_0001_004` gave a place of its own) ends with
  `box-shadow: 0 6px 20px rgb(0 0 0 / 22%)`.
- **The check.** `tests/behavior/theme-tokens.test.ts` reads every `.css` under `src` and refuses
  any line matching `#rgb`, `rgb(`, `rgba(`, `hsl(` or `hsla(`. It fails today with that one line,
  and it is the only offender in the tree.
- **The idiom already here.** The command control's menu, eleven rules above it in the same file,
  casts its shadow as `box-shadow: 0 2px 8px color-mix(in srgb, var(--text) 18%, transparent)` —
  a shadow mixed from a token, which is what the check asks for.
- **This extension owns the stylesheet.** `views/block-editor.css` is the only stylesheet any
  extension carries; `calliopa-refine` draws the rail (`views/depth/block-depth.tsx`) but has no
  stylesheet of its own, so the rule stands here.

## What Should Change

- The overlay's shadow is mixed from a token, as the menu's is, and no stylesheet in the tree
  carries a literal colour.
- The behavior project's theme-token check passes, so the next literal colour is caught by a suite
  that is green.

## Technical Notes

- A shadow mixed from `--text` follows the theme: dark under a light theme, light under a dark one.
  That is the point of the rule — `rgb(0 0 0 / 22%)` is a black shadow under a dark panel, which is
  no shadow at all — and it is what the menu beside it already does, so the two lift the same way.
  The depth of the shadow (`0 6px 20px`) is the overlay's own and does not change.
- Nothing else about the overlay changes: its place, its size, its scrolling and its edge are
  `RF_0001_004`'s.
- The fix is one line, so the task belongs in this extension's [Block Editor
  View](../system/documents/block-editor.md) beside the rules it describes, and the verification is
  the behavior project passing its theme-token check with the unit suite still green.
- It ships in a release only as a look: the release note line, if the user wants one, belongs under
  *Fixed*. A shadow that was invisible in the dark theme now lifts the overlay there.
