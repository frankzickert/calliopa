# Math In Documents

Status: completed

A document can hold mathematics: an equation of its own as a block, mathematics inside a sentence
as part of a paragraph's runs, and a sentence that refers to a numbered equation by its number.
Both kinds of equation are always drawn typeset — never as their source, never as a placeholder
replaced once a renderer wakes up — so nothing a reader is reading moves under them. Editing is a
popover over the equation, holding its exact source, which is why the source never has to enter the
text flow. The engine is MathJax. The block type, the run attributes and their presentation are
`documents`'; the renderer is a dependency of the tree. Requested by the user on 2026-09-23, promoted to draft, ready and completed the same day.
Completed at pin 2262, walked by the user. The work was enumerated as `BO_0290_001`–`BO_0290_023`
and grew `_024`–`_030` while implementing, where one task turned out to carry more than one closure
and where the walk found defects. One task stays open as shaped follow-up work: `BO_0290_026`, the
four measurements only a browser can make, which needs tooling this repository does not carry.

## What Is Asked

- Mathematics as a block: a display equation standing among the blocks, with its grip, its place,
  its standing and its proposals like any other.
- Mathematics inside a sentence: an equation set in the line, part of the block's authored words.
* The equations must not cause the text around them to jump. They are always rendered. User
  requirement, 2026-09-23.
* Editing an equation happens in a popover. User requirement, 2026-09-23.
* The engine is MathJax. User requirement, 2026-09-23.

## Decided

User decisions of 2026-09-23, taken on the questions this document first carried.

* An equation stores its TeX and nothing else. The typeset SVG is never stored: the server
  typesets on every read, memoized per process by the source string, so there is one source of
  truth and nothing to go stale when the engine is upgraded.
* Inline mathematics is authored both ways: from a control on the bar and its keyboard shortcut,
  which turn the caret or the selection into an equation and open the popover, and by typing `$…$`
  in the flow, which converts as the closing `$` lands. Undo restores the literal characters.
  Pasted text carrying `$…$` converts the same way.
* A display equation carries an optional caption, and it can be numbered.
* An equation is numbered only when its author asks for it, from a toggle in the popover. Numbers
  run in document order over the numbered equations alone — LaTeX's own split between `equation`
  and `equation*` — so a note holding one incidental formula carries no stray number.
* A sentence can refer to a numbered equation, in this change rather than the next: a reference
  draws that equation's current number and follows it when the numbering shifts.
* Every TeX package MathJax's full TeX input carries ships, with on-demand loading off so no render
  reaches a CDN. Nothing an author writes is silently unsupported, which is the reason KaTeX was
  rejected in `BO_0163`.

## What The System Already Holds

Nothing here is new work. These are the parts this change rests on.

- A block type is an extension's declared vocabulary, an `ext.blocktype` member enforced by CCGW's
  Validation, and adding one migrates nothing: a build that predates it draws the block as
  unsupported content and never drops it
  ([Schema Evolution](../../graph/tree/src/extensions/documents/docs/system/documents/schema-evolution.md)).
  That document already names an equation block among the types that need their own content shape
  and enter in the smallest slice the editor needs.
- The precedents are the picture (`BO_0273`) and the table (`BO_0287`): a type requiring `id` and
  `order`, `document` widened to permit it as a child, `NewMediaBlock`/`NewTableBlock` beside
  `NewBlock` for the write, and `BlockRow` drawing it where a divider is, with no text editor.
* The block types belong to `documents`, not to whatever makes or renders their content. User
  decision, 2026-09-21, under `BO_0273`.
- A run may carry more than `text` and `marks`. `link` is the precedent: the core's run-shape
  validation is a minimum and never an exact-shape match — it refuses a run carrying no `text`
  string and tolerates every other key (`internal/validation/run_shape.go`, `BO_0185_001`) — so a
  run attribute costs the graph model nothing.
- Runs carry no character offsets and are normalized on the way in: empty runs are dropped, marks
  are ordered, and adjacent runs carrying the same marks and link are joined (`src/lib/runs.ts`),
  so equal content compares equal and an editor that rebuilds its runs writes no revision saying
  nothing new.
- The editing surface builds its DOM from runs and reads runs back out of it (`views/editor-dom.ts`),
  with a run's link already carried by a real element in the flow — an anchor the reader's caret
  moves through. A marked run is drawn by `Marked` (`views/block-text.tsx`), shared by the reading
  rows and the proposals drawn beside them.
- Block identity survives content edits, role changes, splits, merges, moves, retirement and
  restore, which is what a reference to an equation can be anchored on.
- The shell builds and serves an SSR bundle (`vite build && vite build -c adapters/node-server/vite.config.ts`),
  so markup a view can produce on the server arrives in the first response.
- The tree's `package.json` and `pnpm-lock.yaml` are `ui.shell`'s root-mapped members, and the
  kernel installs them with `pnpm install --frozen-lockfile` at materialization. The tree carries
  no runtime dependency today; every entry is a dev dependency. Adding one is a write against the
  elevated extension, which `BO_0134` and `BO_0163` both walked without friction.

## What This Repository Learned The Last Time

`BO_0163` (completed 2026-08-14, at pin 4206) built display and inline mathematics on the retired
Lexical shell. The shell it was built in is gone; the findings it paid for are not, and this change
inherits them rather than rediscovering them.

- **MathJax's own on-demand loader fetches macro packages from a CDN.** Left on, an instance would
  reach outside itself at render time, silently and only for the equations that happen to need a
  package. What an instance can render is fixed at build time.
- **MathJax reports unreadable TeX inside its output rather than by throwing**, as an `merror`
  node. A renderer that only catches exceptions renders an error graphic and calls it success, so
  the outcome is checked for the node.
- **The block owns the failure presentation, not the engine.** One failure shape — the source
  shown with one restrained diagnostic — covers unsupported syntax, a parse error and an engine
  that never loaded. Nothing is ever auto-repaired and no correction is guessed.
- **A renderer that runs after hydration moves the page under the reader** unless the block settles
  its own height first. `BO_0163` wrote this down as a prediction to confirm on a real origin; it
  is the very thing the user now states as a requirement, so this change answers it by construction
  rather than by measurement afterwards.
- **KaTeX was rejected** because its documented subset would become a reader-visible limit on what
  an author may write, and **Temml** because it leaves typographic quality to each browser's MathML
  implementation. The cost accepted with MathJax is weight and asynchronous rendering. User
  decision, 2026-08-14, and the user names MathJax again in this request.

## What Is Wrong Today

- **There is no mathematics.** An equation in a document is a paragraph of characters that mean
  something to a person reading them and nothing to anything else. Inline mathematics is the same
  paragraph with worse typography.
- **A run may carry only `text`, `marks` and `link` through the agent's tools.** The kernel's
  document tools declare the run schema with `additionalProperties: false`
  (`internal/kernel/agenttools/documents.go`), so a run attribute a person can author is one a run
  can neither read nor propose until that schema names it. The block kinds come from the graph, but
  a kind's content shape does not.
- **The kernel harness carries its own copy of the vocabulary.** A block type added to the graph
  without `internal/kernel/serve/testdata/documents-vocabulary.json` makes every behaviour test
  writing one fail validation, which `BO_0273` found and `BO_0287` paid again. That copy and the
  tool schema are why this is a `BO` change rather than a `DO` one.

## How Nothing Jumps

The requirement is one sentence and it decides most of the design, so the mechanism is written out
rather than assumed.

- An equation moves the page in two ways: a renderer that runs after hydration replaces a
  placeholder with typeset output of a different size, and an output format whose glyphs come from
  web fonts reflows again when the fonts land.
- Both are closed by typesetting **on the server, into SVG**. MathJax's SVG output draws its glyphs
  as paths and needs no font file, and SSR puts the typeset equation in the first response, so the
  markup that arrives already *is* the equation and nothing arrives later to change it. The browser
  never sees a placeholder and never sees the source.
- The engine reaches the browser only when a person edits: the popover's live preview and a block
  the client re-draws after a write typeset there, from a lazily loaded module, the way the editor's
  own attachment already loads. A reader who never edits never downloads MathJax.
- **Inside the editing surface an inline equation stays rendered**, as one atomic, non-editable
  element the caret steps over, the way the anchor behind a link is already an element in the flow.
  This is the whole reason the editing popover exists: were the source to take the equation's place
  while its block is edited, the sentence would reflow on every entry and exit — which is what the
  retired shell did, forced there by Lexical, and what this change refuses.
- Numbers and references are derived at read time from the document's own order, so they are in the
  same first response as the equations and nothing resolves late either.

## Proposed Shape

Written as a proposal, not as truth. Nothing is implemented until the user sets this change to
draft and the work is enumerated in the documents the last section names.

### The equation block

- An `equation` block type, declared by `documents` as `image`, `video` and `table` are: requiring
  `id`, `order` and `tex`, permitting `caption`, `numbered` and `source`; `document` permits it as a
  child beside `text`, `divider`, `image`, `video` and `table` — a widening, which migrates nothing.
- `tex` is the exact authored TeX, a plain string property and deliberately not a run property:
  runs canonicalize, and a mark over source syntax would mean nothing. Source is truth — the
  renderer enriches the presentation and never replaces, normalizes away or hides what was written.
- `numbered` is the author's ask, absent meaning no number, as an absent role means paragraph.
- TeX is the one notation. No `syntax` property: a second notation is a widening when something
  needs one.

### Numbering

- A number is **derived, never stored**: the document's read numbers its `numbered` equations in
  reading order, so inserting, retiring or restoring an equation renumbers the rest by itself and
  there is no renumbering write, no migration and no stale number anywhere. This follows the same
  rule as the decision above — what can be derived from the source is not stored beside it.
- Retired and discarded equations are not numbered and do not consume a number, since they are not
  in the reading order a reader reads. An equation inside an open proposal is numbered as it would
  be were the proposal accepted, so the reader sees what they would be accepting.
- The number is drawn at the equation's trailing edge, outside the equation's own box, so a long
  equation scrolling inside its block never scrolls its number out of sight.

### Referring to an equation

- A reference is a run carrying `equationRef`, the identity of the equation block it names. It is
  drawn as that equation's current number and follows it when the numbering shifts, which costs
  nothing to keep true because the number was never stored.
- The run's `text` is empty, and normalization is taught to keep a run carrying `equationRef` — the
  same exception it needs for inline mathematics, for the same reason. Storing the number in `text`
  as a fallback was rejected: it would be the one stale copy of a thing this design deliberately
  derives.
- A reference names an equation in its own document. Its target is resolved against the document
  being read, and a reference whose equation has been retired, discarded or has lost its number
  draws as a plain marker saying its equation is gone — in words, never as a stale number and never
  as nothing at all.
- One is authored from the bar: *Reference an equation* offers the document's numbered equations by
  number with a glimpse of each, and inserts the reference at the caret. Pressing a reference takes
  the reader to its equation.

### Inline mathematics

- Inline mathematics is a run carrying `math: true`, whose `text` is the exact TeX. The source
  lives in `text` because the core requires a run to carry a `text` string, so the shape a link
  takes — words beside an attribute — carries nothing that has no words of its own, and a reader's
  plain-text reading of the runs is then the source rather than a blank.
- Normalization is taught not to join two adjacent math runs, which today's rule would merge into
  one equation.
- `$…$` converts as the closing `$` lands, undo restores the literal characters, and the conversion
  requires no space after the opening `$` so that a sentence about money is not an equation.

### The renderer and the surfaces

- The tree gains `mathjax-full` as its first runtime dependency, in `ui.shell`'s root-mapped
  `package.json` and `pnpm-lock.yaml`, with on-demand package loading off so no render reaches a
  CDN. MathJax is Apache-2.0, which is the licence of the body the distribution ships.
- A `documents` module owns the one outcome shape — markup to show, or a sentence saying why not —
  and both draw sites use it: the SSR reading path and the browser's editing path typeset the same
  source the same way. MathJax's own `merror` output is suppressed in favour of the source plus one
  restrained diagnostic.
- The editor draws an `equation` block where `BlockRow` draws a divider, carrying no text editor
  and no runs, keeping its grip, its drag, its standing, its card and its chip like any row. A long
  equation stays usable at phone width by scrolling inside its own block, never by widening the
  page.
- Pressing an equation — a block or an inline one — opens the popover: its exact TeX in a plain
  source editor, the typeset result beside it as it is typed, and for a block its caption and its
  *Number this equation* toggle. Closing saves, as the editor's pause save does, and an equation
  whose TeX cannot be read is saved all the same and drawn as its source with its diagnostic,
  because refusing to save would lose what the person wrote.
- The kernel's document tools gain all three shapes: `read_document` answers an `equation` block's
  `tex`, `caption` and `numbered` with the number it resolved, and answers a run's `math` and
  `equationRef` beside its `text` and `marks`; an `insert` or `replace` of kind `equation` takes
  `tex`, `caption` and `numbered`; and the run schema admits both attributes, so a run can propose a
  sentence with an equation in it and a sentence that refers to one. A reference naming a block that
  is not a numbered equation in that document is refused by name at the stage. The harness's
  vocabulary copy gains the type in the same change as the graph member.
- `ui.shell.documents`' `structure` convention names an equation as one block and inline
  mathematics as a run, where it already says a fenced code block and a table stay whole.

## What Is Not In This Change

- Source code blocks and diagrams. `BO_0163` carried all three together; this change is asked for
  mathematics, and a second bundled renderer waits for its own request.
- A reference across documents, and a reference to anything but an equation. The run attribute's
  shape would generalize to a table or a figure; nothing else is numbered yet.
- An author-chosen tag or label on an equation — `\tag`, and a name a reference could use instead
  of a number. An equation's number is its position.
- MathML and AsciiMath as authored notations, and MathML as an output. TeX in, SVG out.
- Assistive MathML and a spoken rendering of an equation. The first slice gives the SVG the
  equation's own source as its accessible name; speech output is its own slice with its own
  verification.
- Mathematics inside a table cell, a caption or a document title. Runs are where mathematics lives,
  and a cell is a plain string.
- Anything evaluating an equation. This change renders mathematics; it does not compute it. Running
  code is `BO_0289`'s.
- A macro or definition set shared across a document, and any authored preamble.

## Functional Questions

None open. The four this document carried, and the two that numbering raised, were answered by the
user on 2026-09-23 and stand under Decided.

## Where The Halves Land

- The kernel's: the `equation` content shape and the two run attributes in `read_document`,
  `insert` and `replace`, the refusal of a reference that names no numbered equation
  (`internal/kernel/agenttools/documents.go`), and the harness vocabulary copy. Enumerated in
  `docs/system/ui-kernel.md` when this change reaches draft.
- The distribution's: the release notes line, and whether the first bundled third-party JavaScript
  library is named where the distribution states what it ships (`docs/system/distribution.md`,
  Licences — `THIRD-PARTY.md` names images today).
- `documents`' in the graph: the `equation` member and the `document` widening, the two run
  attributes and normalization's rules for them, derived numbering in the document read, the
  renderer module and both draw sites, the block view, the popover, the authoring gestures and the
  `structure` convention's line. Enumerated in
  [Block Document Model](../../graph/tree/src/extensions/documents/docs/system/documents/block-document-model.md)
  and [Block Editor View](../../graph/tree/src/extensions/documents/docs/system/documents/block-editor.md).
- `ui.shell`'s in the graph: the dependency in the root-mapped `package.json` and `pnpm-lock.yaml`.
- The change document is carried into the graph as a member of `documents`, at the status it holds
  here, no later than completion.

## Verification

- In the kernel, over a real CCGW on the memory store through the widened harness fixture: an
  `equation` inserted with its TeX and read back with its caption and its resolved number, a
  replace keeping the block's identity, a run proposing a sentence carrying a math run and a
  reference run and reading both back, a reference naming a block that is not a numbered equation
  refused by name, and a document with no mathematics reading exactly as today.
- In `documents`, in the render harness beside the renderer's unit tests: an equation drawn as
  typeset SVG from the server's own markup with no request of its own, a paragraph's inline
  equation drawn in the line, the same inline equation still typeset while its block is being
  edited and the caret stepping over it, the popover opening on a press with the exact source and
  saving on close, unreadable TeX saved and drawn as its source with one diagnostic, two adjacent
  math runs staying two, `$…$` converting and undo restoring the literal characters, a long
  equation scrolling inside its block at phone width, and a stored type the build does not know
  still drawn as unsupported content.
- Numbering and references, in the same harness: only the equations asking for a number carrying
  one, the numbers running in reading order, an equation inserted above renumbering those below it
  and every reference to them following without a write, a retired equation consuming no number,
  and a reference whose equation is gone saying so in words.
- The no-jump requirement is verified as the requirement is stated: on a built origin, a document
  of prose and equations rendered with its layout measured at first paint and after hydration, the
  two identical, and no network request for a font or a macro package in either.
- On the instance: an equation authored from the bar and numbered from its popover, inline
  mathematics authored in a sentence both from the control and by typing `$…$`, a sentence
  referring to an equation and following it when an equation is inserted above, and a run asked to
  write a sentence with an equation in it proposing one the person accepts from the chip.

## Graph And Release Notes

- The block type, the run attributes and the editor half are members of `documents`, and the
  dependency is `ui.shell`'s, so the change closes with `scripts/export-graph.sh` and leaves
  `graph/` in the working tree.
- `documents` is `bundled` and the kernel is the fixed layer: the change writes a line under
  *Added* in `docs/release-notes/unreleased.md` before it completes.
