# CA_0044_FEAT_library-side-bar

Status: completed

Requested: 2026-09-11 by the user. *Redesign the left panel. Make sure the top-level categories really "divide" the panel. Use the VS Code design here. Also make sure the indentation is OK (subitems are never more left than parents). Use horizontal lines where appropriate, and decrease the spacing between items within a top-category (both padding and margin of the items).* User statement.

## Where This Starts

At dataRevision 356, measured in Chromium on the drawer's markup with the served stylesheet (`DOY5-Zdx-style.css`) at the desktop's 16rem.

- **The categories divide nothing.** `.drawer` is padded 1rem all round. A category is a header row followed by its body: an uppercase toggle with a `▾`/`▸` glyph drawn in `::before`, and a text `+`. No rule and no band separate one category from the next. Only the heading's case and colour set it apart.

- **Children start left of their parents.** A category title's text starts at 32px, which is the 16px padding plus the glyph's 1rem. Documents rows start at 24.2px. In Extensions, the group labels *Core* and *Yours* start at 16px and the extension rows at 24.2px. Only a change row's status icon (41.8px) sits right of the title.

- **Rows are loose.** A row is 32.6px tall: 0.3rem padding, a 1px border and a 0.4rem radius. The list puts 2.4px between rows (`gap: 0.15rem`) and 0.4rem above itself. Each extension row carries its own bordered `+`.

- **The Extensions controls take a row of their own.** ↻, `+`, the funnel and the import sit in `.library-section-actions`, a row under the header, before the tree.

## Intent

* The library reads as VS Code's side bar. Each top-level category is a band that divides the drawer: a header bar that reaches both edges, ruled off from the category above by a horizontal line.

* The drawer scrolls as one, and a category's header stays at the top while its list scrolls under it, until the next category's header takes its place. User decision, 2026-09-11 (one scroll with sticky headers, over VS Code's split panes and a plain single scroll).

* Nothing starts left of its parent. A category's rows start on its title's line. Each tree level below starts one step further in.

* Rows within a category sit close: no space between rows and little padding in them.

* Horizontal lines separate the categories, the groups inside a category (*Core*, *Yours*, *Other*), and an open filter row or create form from the tree below it.

* A row's own action, the extension row's *New change* `+`, shows while the pointer or the focus is on that row, as VS Code shows a row's inline actions. Where there is no hover, as on a phone, it always shows. User decision, 2026-09-11.

* A component section's own controls sit on its header's line, at the right, as a VS Code view's title actions do. They stay with the header while it is sticky and go away with the body when the category collapses. User decision, 2026-09-11.

## The Shape

- **One inset grid.** `.drawer--left` loses its padding, so bands, hovers and the current row reach both edges. Custom properties on it name the grid:

- a 0.25rem gutter and a 1rem caret, so the text inset is 1.5rem;

- a 1rem step per level;

- a 1.375rem (22px) row and a 1.625rem (26px) header.

The drawer's text is 0.8125rem (13px), and a title is 0.6875rem, uppercase and bold.

- **The header.** Phosphor `caret-right` replaces the glyph and turns 90° while the category is expanded. The create control becomes Phosphor `plus` as an icon button, and its accessible name does not change. The bar's ground is a mix of `--panel-raised` into `--panel`, with a 1px `--border` rule above every category but the first. The header is `position: sticky` at the top of the drawer.

- **The rows.** A row loses its border and radius. It keeps a 22px minimum height and gets no gap between rows. Hover paints `--panel-raised` across the full width, and the current row paints `--selection` and keeps its marker dot and `aria-current`; it is no longer bold. An empty-state line sits on the text inset.

- **Extensions.**

- *Core*, *Yours* and *Other* sit on the inset, followed by a rule to the right edge.

- Extension rows sit on the inset, and change rows one step in. For *Other*, the id it names is one step in and its change two steps in.

- ↻ becomes Phosphor `arrow-clockwise`, and its name does not change.

- The row's `+` is hidden until the row is hovered or holds focus, under `(hover: hover)`.

- A hovered or current extension row paints across the whole row, its `+` included.

- **Controls on the header's line.** A component section whose body starts with `.library-section-actions` has those controls drawn on its header's line. They are sticky in the body and pulled up by the header's height, so they take no row, follow the sticky header, and go with the body when it collapses. This keeps the contribution contract as it is. The filter row and the create form open under the header, on the inset, with a rule below them.

- **Touch.** Under `(pointer: coarse)`, rows and header controls keep the shell's 2.75rem touch height, so the phone sheet stays usable. The phone sheet's close control keeps its own line above the first band.

- **Icons.** `caret-right` and `arrow-clockwise` join `src/components/shell/icons.tsx`, with path data unaltered from `@phosphor-icons/core@2.1.1`.

- **Files.** `src/components/shell/shell.css`, the header markup in `src/components/shell/shell.tsx`, and `src/components/library/extensions-section.tsx`. The drawer's tests keep their names and data attributes.

- **Docs.**

- `workspace/layout.md` gains the side bar's truth, and its *small `+`* and icon-table lines follow.

- `workspace/contribution-contract.md` gains the rule for a component body's leading controls.

## Proposed Tasks

- `CA_0044_001` (`workspace/layout.md`): the bands and the sticky headers. The caret and the `plus` icon in the header, the header's ground and the rules between categories.

- `CA_0044_002` (`workspace/layout.md`): the inset grid and the close rows for every uniform section. Rows and empty lines start on the title's line, rows are 22px with no gap, and hover and current paint the full width.

- `CA_0044_003` (`workspace/layout.md` and `workspace/contribution-contract.md`):

- the Extensions tree on the grid;

- the group labels ruled;

- the change rows one step in;

- the row `+` shown on hover or focus;

- the controls on the header's line;

- `arrow-clockwise`;

- the filter row and the form ruled off.

- `CA_0044_004` (`workspace/layout.md`): coarse pointers and the phone sheet. Touch heights are kept, the row `+` always shows, and the close control stays on its own line.

- `CA_0044_005` (`workspace/layout.md`): the proof. A Playwright layout measurement on the drawer's markup with the built stylesheet, in both themes at 1280 and 360 CSS px, using the CA_0041 fixture-host recipe. It shows that:

- every row's text starts at or right of its parent's title;

- rows are 22px with no gap on a fine pointer and 2.75rem on a coarse one;

- after a scroll, the header and its controls sit at the drawer's top;

- a collapsed category's controls are gone.

`extensions-section.test.ts` still presses its controls by name. The walk-through on the served build follows.

## Material

The mockups (the served drawer now, and this design in both themes, with the filter open and scrolled) were rendered from the drawer's markup with the served stylesheet and sent to the user on 2026-09-11.
