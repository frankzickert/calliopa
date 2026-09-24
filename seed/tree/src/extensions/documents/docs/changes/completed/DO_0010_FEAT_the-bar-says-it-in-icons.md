# DO_0010_FEAT_the-bar-says-it-in-icons

Status: completed

Requested: 2026-09-22, by the user, from reading the served document bar: the two acts that decide
what a document *is* are buried at its trailing end, the block controls stand in an order nobody
chose and half of them are words where the rest of the bar is icons, and the *Standing* explanation
opens a panel the reader cannot see.

## The Ask

1. **The document's two acts lead the bar.** *Work in a proposal* and *Establish…* move from the
   trailing *Document* group to the bar's leading edge, in that order, before *View*. *Establish…*
   loses its words and becomes an icon button: Phosphor `lighthouse`.
2. **The block controls stand in one settled order, in icons.** The text role becomes a dropdown
   with no words, wearing the current role as its symbol — `article-ny-times` for a paragraph,
   `text-h-one`, `text-h-two`, `text-h-three` for the headings, `quotes` for a quote. After it a
   `plus` icon button, which adds a paragraph. *+ Divider* goes. *Retire* becomes `archive`.
3. **Standing becomes an icon-driven dropdown** wearing the mark its blocks carry, with the *i*
   right beside it.
4. **The *i*'s panel really lies over what is under it.** Pressing it today opens a panel the reader
   cannot see.

## Where This Starts

Read from `documents`, `ui.shell` and `calliopa-refine` at dataRevision 1253.

**The bar as it stands** (`views/block-editor.tsx`, the bar task at ~2500–2870), in drawn order:

| group | holds | drawn when |
| --- | --- | --- |
| `view` | *Show retired blocks* `archive`, *Show discarded blocks* `eye-slash`, *Show prompts* `terminal-window`, *Show proposed changes* `git-pull-request` | always |
| `standing-help` | the *i* popover, *What a standing means* | always |
| `format` | the four marks and *Link*, and the link field while it is open | a block is being edited |
| `turn-into` | *Text role*, a labelled `choice` over `TEXT_ROLES` | a block is the subject |
| `block` | *+ Paragraph*, *+ Divider*, *Retire* — three word buttons | a block is the subject |
| `standing` | *Standing*, a labelled `choice` over `SCALE` (and `prompt` where the block is one) | the subject is a text block |
| `history` | *Undo*, *Redo*, *Done editing* | a block is being edited |
| `document` (trailing) | *Take back* `arrow-counter-clockwise`, *Work in a proposal* `git-branch`, *Delete* `trash`, and `calliopa-refine`'s *Establish…* in words | always |

- **`calliopa-refine` contributes *Establish…* through the decoration bar** (`views/decision/provider.tsx`,
  `BO_0274_004`): a group of its own, `id: "document"`, `trailing: true`, whose one button reads
  *Establish…* — *Re-establish…* on a root whose claims have moved. It is folded into the view's
  group of the same id by `merged` in the shell's `view-bar.tsx`, which appends a decoration's
  actions to a group the view already has and stands a group the view lacks *after* the view's.
  So a decoration cannot reach the bar's leading edge on its own: the group it joins has to be one
  the view contributes, and the view has to contribute it first.
- **A `choice` already carries icons** (`view-bridge.ts`): each option may name one, and
  `ChoiceControl` in `inspector.tsx` draws the current option's icon beside a visible
  `choice-control__label`. Neither the role options nor the standing options name one today.
- **The bar's icon table is the shell's** (`components/shell/icons.tsx`): Phosphor regular, paths
  inlined by hand. `plus`, `x`, `archive`, `terminal-window` and `info` are there. `lighthouse`,
  `article-ny-times`, `text-h-one`, `text-h-two`, `text-h-three`, `quotes`, `circle` and `diamond`
  are not.
- **A block's marks are glyphs, not icons** (`lib/disposition.ts`): `GLYPH` is `◆` for fixated and
  `✕` for discarded, `CONTROL_GLYPH` adds `○` for keep, and a prompt and a retired block wear
  `terminal-window` and `archive` instead (`standing-mark.tsx`). Keep carries no mark at all.
- **Why the *i*'s panel is not seen** (`shell.css`): `.popover-control__panel` is
  `position: absolute` and hangs `calc(100% + 0.35rem)` below its control, but its containing block
  is inside `.view-bar`, which is `height: var(--view-bar-height)` with `overflow-x: auto` and
  `overflow-y: hidden`. A scrollport clips its absolutely positioned descendants, so the panel is
  cut off at the bar's 40px. Its `z-index: 6` cannot help: the bar is `z-index: 4` and a stacking
  context, so the panel can never rise above what stands outside the bar either. The clip is the
  first cause and the stacking context the second; both have to go.

## Shaped

- **A leading group the decoration can join.** The view contributes a new leading group — `work`,
  labelled *Work* — holding *Work in a proposal*, and `calliopa-refine` contributes *Establish…*
  under the same id with no `trailing`. `merged` then appends it in place and the two stand together
  at the bar's leading edge, *Work in a proposal* first. The trailing *Document* group keeps
  *Take back* and *Delete*. Nothing about the merge rule, the ruled line or the trailing edge
  changes.
- **`lighthouse` for *Establish…***, with the words kept as the button's accessible name, which is
  what every other icon button in the bar does. *Re-establish…* wears the same icon and says so in
  its name.
- **The block groups in the asked order**, all icons:
  *Format* (the four marks and *Link*, unchanged) → the role dropdown → `plus` → `archive` →
  *Standing* with its *i* → *History* (*Undo*, *Redo*, *Done editing*, unchanged).
- **A bar `choice` whose current option carries an icon draws the icon alone**, with its label as
  the accessible name of the select — the rule a bar button already follows. The inspector keeps
  the visible label, since it has the room and no icon idiom. This needs no new field on the
  contract: the surface decides, as it does for the control ids.
- **`plus` adds a paragraph** where *+ Paragraph* did, after the subject. *+ Divider* is taken out
  of the bar and nothing replaces it there; a divider stays a block kind, existing ones are drawn
  and moved as before, and `insert$`'s `divider` arm stays for the paths that still reach it. User
  decision, 2026-09-22.
- **The standing dropdown wears Phosphor icons of the marks' own shapes**: `x` for discard,
  `circle` for keep, `diamond` for fixate, `terminal-window` for a prompt — the same faces, drawn
  from the icon family the bar is drawn from, so the control and the mark on the block read as one
  thing. The glyph tables in `lib/disposition.ts` keep the glyphs for the card label and the
  command-mode toolbar, which are not the bar. User decision, 2026-09-22.
- **The *i* joins the *Standing* group and is drawn only while a block is the subject.** This
  rewrites the fixed line `BO_0272_009` left — the *i* standing wherever the bar stands, so a reader
  can decide before they swipe — on the ground the user gave: the explanation belongs beside the
  control it explains. The `standing-help` group goes with it. User decision, 2026-09-22.
- **The panel escapes the bar.** It has to leave `.view-bar`'s scrollport and `.view-bar`'s stacking
  context, which no `z-index` inside them can do. The way that costs nothing is the platform's top
  layer: the panel carries `popover` and the control `popovertarget`, so the browser draws it above
  every stacking context and outside every clip, and `PopoverControl` keeps its own `Escape` and
  press-outside handling or hands it to the platform's light dismiss. Its place beside the control
  is then set from the control's box. The alternative, a fixed-position panel measured on each open,
  is the fallback if the top layer costs us the control of position; either way the panel is no
  longer a descendant the bar can clip.
- **Both surfaces stay one control.** The `i` renders in the inspector too, where nothing clips it;
  whatever the panel becomes has to keep working there.

## Where This Lands

- `documents`' [Block Editor View](../system/documents/block-editor.md): the bar's groups, their
  order, what each control wears, the *i* beside the *Standing* control, and the divider leaving the
  bar.
- `ui.shell`'s [Layout](../../../../../docs/system/workspace/layout.md), *The View Bar*: the icon-only
  choice on the bar, the popover leaving the bar's clip and stacking context, and the eight icons
  the table gains.
- `calliopa-refine`'s [system.md](../../../calliopa-refine/docs/system/system.md): *Establish…* as an
  icon in a leading group.
- `docs/release-notes/unreleased.md` in `calliopa-bootstrap`, under *Changed* — the bar is a
  `bundled` extension's surface and the reader sees it move — with the *i*'s panel under *Fixed*.

## Transferred

Transferred on 2026-09-22, append-only over three documents.

- `documents`' [Block Editor View](../system/documents/block-editor.md#the-bar-says-it-in-icons)
  gained *The Bar Says It In Icons*: `DO_0010_001` (the leading *Work* group), `_002` (the block
  groups in order, the role choice's icons, `plus` and `archive`), `_003` (the divider leaving the
  bar), `_004` (the standing choice's icons), `_005` (the *i* joining the *Standing* group), `_006`
  (`views/bar.test.ts`), `_007` (the user's walk) and `_008` (the release-notes lines).
- `ui.shell`'s [Layout](../../../../../docs/system/workspace/layout.md#the-view-bar) gained, at the
  end of *The View Bar*: `DO_0010_009` (a bar choice drawn icon-only), `_010` (the popover leaving
  the bar's clip and stacking context), `_011` (the eight Phosphor paths) and `_012`
  (`view-bar.test.ts` and the Chromium measurement).
- `calliopa-refine`'s [system.md](../../../calliopa-refine/docs/system/system.md) gained *Establish
  Leads The Bar*: `DO_0010_013` (the button contributed under `work` with `lighthouse`).

Four lines already standing are rewritten by the tasks that make them untrue, rather than left to
drift: the fixed *Block* (*+ Paragraph*, *+ Divider*, *Retire*) line and the *Action Surfaces*
line offering a divider (`_003`), *The bar also carries an info control … wherever the bar stands*
(`BO_0272_009`) and *the info control stays in a group of its own* (`_005`), and `BO_0274_010`'s
account of *Establish…* going to the bar's *Document* group (`_013`).

## Implemented

- Implemented 2026-09-22 on the tree at dataRevision 1276 (`DO_0010_001`–`_006`, `_008`–`_013`,
  folded into truth where they stood). `documents` contributes a leading `work` group and
  `calliopa-refine` joins it, the block controls stand in the asked order wearing `plus`, `archive`
  and a symbol per choice option, the divider button is gone from the bar, and the *i* is in the
  *Standing* group. `ui.shell` draws a bar choice as its symbol, takes the popover's panel out of
  the bar's clip and stacking context, and gained the eight Phosphor paths.
- The two causes behind *the layover is not visible*, measured rather than guessed: `.view-bar` is
  40px with `overflow-x: auto`, and a scrollport clips its absolutely positioned descendants, so
  the same fixture with the old rule restored lets **0px of a 225.5px panel** through and answers
  `elementFromPoint` with the view host; and `.view-bar`'s `z-index: 4` is a stacking context, so
  the panel's own `z-index: 6` could never reach past it. Fixed placement answers the first and the
  top layer the second.
- One thing the measurement found that the shaping had not: the panel is `content-box`, so
  `max-inline-size: min(22rem, calc(100vw - 2rem))` capped only its content and a phone's panel came
  out 352px in a 360px viewport, 8px past the edge. `box-sizing: border-box` is part of the fix.
- Verified: `tsc --noEmit` clean; the whole unit project green at 135 files and 1208 tests; both
  bundles built with no warning of ours and no free QRL name in any chunk. Measured in Chromium at
  360 and 1280 in both themes: the panel fixed, below the bar's 40px, inside the viewport and the
  element at its own point in all four; the role dropdown 43.6px wide with no words, two glyphs and
  a transparent select. Axe clean in all eight cases, panel open and closed.
- Three suites encoded what this change replaces and were rewritten rather than patched around:
  `documents`' `views/bar.test.ts` (the *i* with no block active, which was `BO_0272_009`) and
  `views/branch/branch.test.ts` (the *Document* group's order), and `calliopa-refine`'s
  `views/phase/phase-card.test.ts` (*Establish…* read by its words).
- `tests/behavior/theme-tokens.test.ts` fails on `documents`' `block-editor.css:1325`
  (`rgb(0 0 0 / 22%)`). It fails the same way on a pristine checkout at 1274: it is head's, not
  this change's.
- Rebased onto dataRevision 1299 and re-verified there: `CA_0062` had landed in `shell.css` and
  `view-bar.test.ts` and `RF_0002` in `calliopa-refine`'s `system.md` while this was being built, so
  those three edits were re-applied on head's copies rather than committed from the older tree.
  Nothing else this change touches had moved since 1274. On the rebased tree: `tsc --noEmit` clean,
  the unit project 137 files and 1224 tests all passing with no unhandled error, both bundles built
  and no free QRL name in any chunk.
- Walked on the served build at pin 1304 on 2026-09-22 and reported working (`DO_0010_007`): the
  two acts lead the bar with *Establish…* under its lighthouse, the block controls read as icons in
  the asked order, the role and standing dropdowns wear the symbol of what they hold, and pressing
  the *i* opens a panel that lies over the document. No walk asked for anything back.

## Open Questions

- None.
