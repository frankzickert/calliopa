# Code Listings Are Numbered

Status: completed

Requested: 2026-09-25, at the end of the walk of `BO_0300`. In the user's words: *also allow to
enumerate code listings. same behaviour like the other.* This document shapes the change; it
authorizes no implementation.

## What Is Asked

* A code block can be numbered on request, as a picture, a table and an equation can
  (`BO_0295`, `BO_0290`): *Number this listing* in the bar, the label *Listing 1.* drawn with the
  block, a caption a person types beneath it, the number the document's order and stored nowhere.
* A sentence refers to a numbered listing the way it refers to every other block — `#` in the
  sentence (`BO_0300`) — and the reference reads *Listing 2*, follows the block, and reads as gone
  when the block leaves the reading order.
* A manuscript prints a numbered listing as a listing: numbered, captioned, referable, the code
  set as the manuscript sets code.

## Where This Starts

At head 2855 of the dogfood instance.

- **Every other numbered kind is one idiom.** `image`, `output` and `table` permit `numbered` and
  (but for the table's own) `caption`; the read numbers them in reading order, figures and tables
  apart (`numberFiguresAndTables`); the bar offers *Number this figure/table* under the `hash`
  icon; a caption line stands beneath the block; the kernel's document tools read and propose
  the two properties (`captionedContentOf`); the manuscript labels the float and prints the
  reference (`BO_0295`, completed). Since `BO_0300`, a reference is one run kind, `blockRef`,
  and the read answers what it is drawn as by the block's kind — so a numbered listing needs no
  new run kind, only a label: *Listing N*.
- **A `sourcecode` block permits neither `numbered` nor `caption`** (`BO_0289`); it carries
  `language` and `source`, and since `BO_0302` its line numbers (`docs/changes/BO_0302_FEAT_code-blocks-carry-line-numbers.md`).
- **A manuscript keeps code out of the body.** By `BO_0293_Q5`, code that produced a figure or a
  table goes to *Supplementary Material* and other code is left out and said so; `BO_0296_020`
  will hand it to Pandoc as a `CodeBlock` so Pandoc colours it. Nothing prints a code block in
  the body today.
- **LaTeX has no listing float of its own.** `listings`' `lstlisting` numbers and captions but
  sets the code itself, without Pandoc's colour; the `float` package's `\newfloat{listing}` gives a
  numbered, captioned float that can hold Pandoc's coloured `Shaded` block. `float.sty` is in
  `texlive-latex-recommended`, which the image installs.

## The Shape

- **The same idiom, a fourth kind.** `sourcecode` permits `numbered` and `caption`; the read
  numbers listings in their own sequence (`listingNumbers`), labels a reference *Listing N*, and
  the `#` list offers a numbered listing as *Listing 2 — its caption or first line*; the bar's
  *Number this* toggle and the caption line reach a code block; the kernel reads and proposes
  the two properties and labels the reference.
* **A numbered listing is body material** (`BO_0303_Q1`). A code block its author numbers is
  printed where it stands, as a `listing` float holding the coloured code, with its caption and
  label — the author's number is the author's word that this code is part of the paper. A
  reference *Listing 2* points at the page the code is on. Code nobody numbers keeps
  `BO_0293_Q5`'s rule: to *Supplementary Material* when it produced a figure or a table, left
  out and said so otherwise. This narrows `BO_0293_Q5`. User decision, 2026-09-25.
* **Code prints once** (`BO_0303_Q2`). A numbered listing that produced a figure or a table is
  not repeated under *Supplementary Material*: the provenance line beneath that figure or table
  names the listing — *produced by Listing 2* — in place of the code, and the supplement carries
  only the code nobody numbered. User decision, 2026-09-25.
* **Code alone is a listing** (`BO_0303_Q3`). Only a `sourcecode` block permits `numbered`; an
  execution's text output and a traceback stay out of the manuscript as `BO_0293_Q5` has them.
  Widening this to text outputs is a change of its own, if ever asked. User decision, 2026-09-25.
- **The templates define the float.** `\usepackage{float}\newfloat{listing}{htbp}{lol}
  \floatname{listing}{Listing}` in both venues, the way `remark` was defined for `BO_0300`.

## Open Questions

None. `BO_0303_Q1`–`BO_0303_Q3` are decided in The Shape above.

## Transferred

Promoted to draft by the user on 2026-09-25 and transferred the same day.

- `docs/system/ui-kernel.md`, *Code Listings Are Numbered*: `BO_0303_001`–`BO_0303_005` — the
  harness fixture, the reads numbering listings and labelling *Listing N*, a run proposing a
  caption and the ask, the verification, the rebuild with the release note under *Added* after
  the walk.
- `docs/system/typesetting-service.md`: `BO_0303_006` — the venues' templates define the
  `listing` float. Proven before the transfer: both venues built a float holding Pandoc's
  coloured, line-numbered block under `-no-shell-escape` in the running image.
- `documents`' `block-document-model.md`, *Code Listings Are Numbered*: `BO_0303_007`–`BO_0303_010`
  — the declaration, `setFigure` and the read with `listingNumbers`, the skill's convention, the
  verification.
- `documents`' `block-editor.md`, *Code Listings Are Numbered*: `BO_0303_011`–`BO_0303_015` — the
  caption line, *Number this listing*, the `#` entry, the harness verification, the walk.
- `manuscripts`' `system.md`: the three decisions and `BO_0303_016` — the listing float in the
  body, the reference, the provenance line naming the listing, the supplement without it.
- This document stands in the graph as a change of `documents`, whose block the listing is, at
  the same status.

### Technical decisions taken at transfer

- Listings are a sequence of their own, `listingNumbers`, after figures and tables in the read.
- The caption and the ask are written by `setFigure`, widened to a code block, never through
  `reviseCode`, so a settled edit stays the one whole-block revision the send gate depends on.
- A run may caption and number a code block it inserts or replaces, as it may a picture; a
  replace leaving the two out clears them, as it clears the language.
- The `#` list shows a numbered listing by its caption's opening words, or its first source
  line's when it has none.
- A produced figure's or table's provenance line names the listing by `\ref`, so the print says
  *Produced by Listing 2 at revision R.* and the supplement has no section for that block.

## Implemented

Set to ready by the user on 2026-09-25 and implemented the same day.

- **The fixed layer, here:** `BO_0303_001`–`BO_0303_004` landed — the fixture, `readCodeContent`
  carrying the caption and the ask, a third sequence in `numberFiguresAndTables`, *Listing N* in
  `labelReferences`, `codeContentOf` and the replace admitting the two properties with the code
  block among `caption`'s and `numbered`'s owners, and `agenttools/listings_test.go` over a real
  CCGW. `BO_0303_006` landed — both templates define the `listing` float, and `test_front.py`'s
  fifteen cases pass inside the running image, the new one typesetting a numbered, line-numbered
  listing under both venues with *As Listing 1 shows* among the PDF's words; the PDF-words helper
  now skips a font's binary stream, which had passed its `BT`/`ET` filter by chance and carried
  a `??` of its own. Open here: `BO_0303_005` (the rebuild, the user's, and the release note
  after the walk).
- **The graph:** `BO_0303_007`–`BO_0303_010` in `documents`' model, `BO_0303_011`–`BO_0303_014`
  in its editor and `BO_0303_016` in `manuscripts`' projection, each folded to truth in its
  document. Open there: `BO_0303_015`, the walk.
- **Found on the way:** a produced figure's provenance line went through `latexText`, which
  would have escaped the `\ref` to the listing; the line reaches `captionOf` as LaTeX now, the
  cell form escaped by its caller.

## Walked

2026-09-25, at pin 2881, by the user: "works". Three findings, none a fault of the listing itself —
a tab from before the pin keeps the old client until reloaded; with both panels open and the
browser zoomed, the `#` group stands past the bar's faded right edge until the bar is scrolled or
a panel closed (`CA_0060`); and while a paragraph is being edited, resting on the code row takes
nothing (`DO_0006_003`). The one gap left open is `BO_0303_017` in `documents`' `block-editor.md`:
a click into a code block's source while a paragraph is edited leaves the bar with no block group
until the pointer leaves and returns. A probe in its own branch (`.local/walk-0303/`) had shown the
build numbering and captioning every code row of *Eln* at every width and by every pointer path
before the walk, which is how the bar's width and the editing rule were told apart from a fault.

## Depends On

Every dependency has landed; nothing blocks the transfer.

- `BO_0300` (references from the hash), completed: the reference and its label.
- `BO_0295` (figures and tables numbered), completed: the idiom.
- `BO_0296` (code blocks formatted and highlighted), completed: `BO_0296_020` hands supplementary
  code to Pandoc as a `CodeBlock` (`manuscripts`' `docs/system/system.md`), which is what a
  listing float holds.
- `BO_0302` (code blocks carry line numbers), completed: the other change of the same block kind;
  a listing float prints the gutter the way the block carries it.
