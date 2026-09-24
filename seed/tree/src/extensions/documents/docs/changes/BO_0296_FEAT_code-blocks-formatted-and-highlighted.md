# Code Blocks Are Formatted And Highlighted

Status: wip

Requested: 2026-09-23. In the user's words: *i want code-blocks formatted and highlighted.* A code
block in a document is plain text today, in a monospace face and nothing more, which is the one
thing `BO_0289`'s shape promised and did not land. The open points were answered by the user the
same day (Decided, below). This document shapes the change; it authorizes no implementation.

## Where This Starts

At head 2198 of the dogfood instance.

- **The code block exists and is uncoloured.** `BO_0289` landed the `sourcecode` block type and
  `documents`' `views/code-block.tsx`: while the reader may write, the source sits in a
  `<textarea>` that grows with it, Tab indents four spaces, a settled edit is one `reviseCode` of
  the whole block; while the reader may not — a proposed block, one in command mode — it is a
  `<pre><code>` holding the same characters. The language is a word typed freely into a small
  field beside it, carried as `data-code-language` and drawn nowhere else.
- **The promise was quietly dropped.** `BO_0289`'s shape and its `BO_0289_018` both say the editor
  draws a code block *with the language's highlighting*. What landed carries no highlighter, no
  grammar and no markup, and the truth line in `documents`' `block-editor.md`, *Code And Its
  Output*, records the monospace field without mentioning colour. So highlighting was never
  decided against; it was left behind, and this change is where it is decided.
- **Mathematics already settled how markup reaches a block.** Under `BO_0290` the server sets the
  markup as it assembles the block (`server/assemble.ts`), the reader loads no engine at all
  (`lib/mathjax-boundary.test.ts` pins that only the assembler imports it outright), and the
  editing surface pays for the engine through a lazy import because editing is the one place
  already paying. A highlighter either follows that road or states why it cannot.
- **A textarea cannot carry colour.** The writable field is a single text control, so the
  coloured reading view is not the writing view. The two shapes are a highlighted `<pre>` behind a
  transparent textarea with the scroll and the metrics kept in step, or a painted surface of the
  editor's own, the way inline mathematics paints atoms. This is the change's one real mechanism
  question and it is technical, not functional.
- **The tree now carries runtime dependencies, and a release must say what covers them.**
  `@mathjax/src` 4.1.3 (Apache-2.0) is the first (`BO_0290_023`), `citeproc-js` the second
  (`BO_0291_029`). `distribution/THIRD-PARTY.md` names the images the compose file references and
  nothing else; what it says about a library bundled into the served tree is `BO_0290_021`, still
  open and the user's, because it touches published licence texts. A highlighter is the third such
  library, and the formatter below is a fourth image.
- **The code service is root on the host.** It is the only holder of `/var/run/docker.sock`, which
  is why it answers the kernel alone with its bearer and takes code from the kernel only
  (`docs/system/code-service.md`). Whatever it is asked to format, it does not parse in its own
  process.

## Decided

Answered by the user on 2026-09-23. These are the fixed requirements the transfer enumerates.

* **Formatted means pretty-printed, on every settle.** A settled edit of a code block formats the
  source and writes the formatted text: `prettier` for the web languages, `black` for Python,
  `gofmt` for Go, and so on per language. Each edit is one whole-block revision, as it is today.
  The block is also *laid out* as code — code face, preserved indentation, a frame, long lines
  scrolling inside the block rather than widening the page — which is presentation and holds
  whether or not a formatter exists for the language.
* **The formatter runs in the code service, never in its own process.** The service that already
  holds the docker socket runs the formatter inside a container, so formatting works whether or
  not the document is connected to a runtime, and a parser fed arbitrary source never runs beside
  the socket. One more image for a release to carry.
* **What cannot be formatted settles unchanged and silently.** A fragment that does not parse — an
  unclosed brace, three lines lifted out of a file — and a language with no formatter are saved
  exactly as typed, with no message and no marker. This is the common case, not the edge, and it
  must be invisible.
* **Formatting is switched off per document.** One control in the document's bar governs every
  code block in that document. There is no per-block flag.
* **The colour reaches a proposed code block and an output block's traceback.** A code block a run
  proposed is coloured on its chip's row exactly as an accepted one is, so accepting a proposal
  does not change how the code looks. An error's traceback is coloured again — the file, the line
  and the exception — having had its escape sequences stripped on the way in.
* **An inline `code` mark takes no syntax colour.** It keeps the code face it has today, monospace
  and set apart. Colour inside a running sentence is noise, and a run carries no language word to
  colour it by.
* **A language is guessed once, as a suggestion.** A code block created without a language — a run's,
  or a pasted one — has its language field filled in by a guess, visibly and editably, and is
  never re-guessed afterwards. A block whose field is emptied stays empty and draws plain.
* **A manuscript's code carries its colours** (`BO_0293`, Supplementary Material), set by Pandoc's
  own highlighter, with the typesetting service's shell escape still off. This was decided twice:
  `minted` on 2026-09-23, on the agent's reading that colour in print costs either a coarse
  `listings` scheme or Pygments behind shell escape — and the fixed constraint was narrowed to
  admit `pygmentize`; then, on 2026-09-24, the reading turned out to be wrong about this engine.
  Pandoc 2.17.1.1, the image's own, writes `\begin{Shaded}\begin{Highlighting}` with per-token
  macros for any code block carrying a language class, and a PDF was built from it under
  `-no-shell-escape` before the user was asked again. The user restored the fixed line verbatim
  and took Pandoc's colouring. User decisions, 2026-09-23 and 2026-09-24.
* **Accepted code is formatted as it lands.** A code block a run proposed does not stay as the run
  wrote it: accepting it formats it, so every code block in a document is formatted however it
  arrived. What is accepted and what the document then holds are therefore not the same text, which
  is the price the user chose over documents holding unformatted code nobody touched.

## The Shape

A mutable starting point for the transfer, not a decision.

- **One highlighter, chosen for what a release may ship.** The candidates and the licences that
  matter to `THIRD-PARTY.md`: `highlight.js` (BSD-3-Clause, ~190 languages, small, coarse
  colouring), `prismjs` (MIT, small, per-language files), `shiki` (MIT, VS Code's TextMate
  grammars and themes — the best colouring, the largest payload, and each carried grammar has a
  licence of its own that the third-party statement would have to account for). The choice is
  technical except where it lands in the published licence texts, which is the user's. Nothing in
  print depends on it: a manuscript is coloured by Pandoc's own highlighter, so the screen and the
  PDF are allowed to disagree in detail and the library is chosen for the screen alone.
- **The read sets the markup.** `assemble.ts` colours a `sourcecode` block as it reads it, as it
  sets an equation, so a reader downloads a coloured document and no highlighter. The editing
  surface takes the engine through a lazy import, as the equation popover does.
- **The writing field keeps its behaviour.** Whatever carries the colour, the edit still settles
  as one `reviseCode` on the base revision, Tab still indents, Escape still settles, and
  `data-code-sending` still gates the send — otherwise `BO_0289`'s guarantee that what runs is
  what was typed stops holding. What runs after a settle is the formatted text, which is what the
  graph then holds.
- **The formatter container is warm, not thrown away.** A settle happens often enough that starting
  a container per edit would be felt; the service keeps one formatter container, with the
  formatters installed, code handed in and taken back over its standard streams. It carries no
  network, no mount of the stack and no credential — the runtime isolation rule of
  `docs/system/code-service.md` applies to it unchanged, and more strictly, since it has no reason
  to reach the internet either. A formatter that fails, times out or returns nothing leaves the
  source as typed (Decided).
- **Acceptance formats in a revision of its own.** What was proposed stays what was proposed: the
  acceptance promotes the staged revision unchanged, as every acceptance does, and the formatted
  text lands as the next revision, authored by whoever accepted. The ledger keeps saying what was
  offered and what was agreed to, the history shows the format as the separate act it is, and the
  decided requirement holds — an accepted code block is formatted. Rewriting the staged revision
  in place would make an acceptance mean something other than *this text, agreed*, which is the one
  thing the graph exists to say.
- **Formatting is a route of the kernel and a property of the document.** `documents`' server
  formats through the kernel before it writes the revision, so the rule holds wherever a settled
  edit comes from; the per-document switch is a root property the bar control sets, and it governs acceptance as it
  governs a settle — a document with formatting off accepts code as proposed.
- **The language field suggests.** The languages the highlighter knows are offered, with a free
  word still typable, the way the Runtimes form suggests images (`BO_0289_022`). An unknown word
  stays a word and the block draws plain. The guess runs once, where the block is created.
- **The colours are theme tokens**, answering in light and dark like every other surface, never
  literal hex in the view (`DO_0011`).
- **A manuscript is coloured by the engine, not by a program TeX runs** (landed, `BO_0296_008`).
  The venues' templates carry `$highlighting-macros$` and `fancyvrb`; Pandoc writes the tokens;
  shell escape stays off. The `minted` route the transfer recorded — Pygments behind restricted
  shell escape with `pygmentize` whitelisted — was not taken, and the fixed constraint it would
  have narrowed is intact.
- **The fixed layer's half**: the highlighter named in the graph's
  `docs/system/foundation/runtime.md`, the formatter image and the format route in
  `docs/system/code-service.md`, Pygments and the restricted whitelist in
  `docs/system/typesetting-service.md`, the image and the library in `distribution.md` and in the
  line `THIRD-PARTY.md` takes under `BO_0290_021`, and the release note.

## Transferred

Promoted to draft by the user on 2026-09-23 and transferred the same day.

### The fixed layer, in this repository

- `docs/system/code-service.md`, *Formatting*: the formatter as a second container the code
  service owns, its posture, its formatters and its caps — `BO_0296_001`–`BO_0296_003` and
  `BO_0296_010`. The one technical decision recorded there: the formatter is a compose service of
  the settled shape rather than a container started through the socket, since that costs no
  image-presence trick and the Decided requirement holds either way.
- `docs/system/ui-kernel.md`, *Code Is Formatted And Highlighted*: the format route,
  `BO_0296_004`, and the two rules the kernel states and no extension revises — acceptance formats
  in a revision of its own, and the switch is a property of the document's root.
- `docs/system/distribution.md`, *Code Formatting*: `BO_0296_006` the image in the release,
  `BO_0296_007` the third-party statement for the highlighter and the four formatters, and
  `BO_0296_009` the release note.
- `docs/system/typesetting-service.md`: `BO_0296_008`, the manuscript's coloured code. The
  transfer narrowed the fixed constraint to admit `pygmentize` for `minted`; on 2026-09-24 the
  agent found that Pandoc colours code itself, proved it on the built image, and the user restored
  the constraint verbatim and took Pandoc's. The line is the one it always was.

### The graph

Staged from head 2264 as `node:chg-3e0e1a429fee24de` (4 files, 0 removals): `ui.shell`'s
`docs/system/foundation/runtime.md` gains `BO_0296_011` the highlighter as the tree's third runtime
dependency and `BO_0296_012` its boundary rule; `documents`' `block-document-model.md` gains the
Decided lines, the acceptance rule and `BO_0296_013`–`BO_0296_017` and `BO_0296_020`;
its `block-editor.md` gains the overlay mechanism and `BO_0296_018`, `BO_0296_019`, `BO_0296_021`
and the walk `BO_0296_022`; and this document stands as a member of `documents` at `draft`.

## Depends On

- `BO_0289` (wip): the `sourcecode` block, its field, its revise and the code service are what
  this change draws differently and formats through. This change must not land before `BO_0289`'s
  walk, or the walk judges a surface that is about to move.
- `BO_0290_021`: the third-party statement for a bundled library. The highlighter is the third such
  library and takes whatever that decision settles.
- `BO_0293` (its service and its extension landed 2026-09-23/24): the manuscript's Supplementary
  Material is where a code block's colour lands. The service half of that is done here
  (`BO_0296_008`); the projection half is `manuscripts`' `BO_0296_020` in the graph.
- It spans this repository and the graph: the drawing, the language field, the per-document switch
  and the read are `documents`', the highlighter is `ui.shell`'s `package.json`, and the formatter
  image, the format route, the typesetting whitelist, the licence line and the release note are the
  fixed layer's — so it is a `BO` change here, with its graph half standing as a change document of
  `documents` at the same status.
