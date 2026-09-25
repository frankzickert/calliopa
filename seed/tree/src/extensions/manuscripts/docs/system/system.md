# Manuscripts

## Purpose

- This document is the entry point of `manuscripts`, the extension that turns a document into a
  manuscript: the LaTeX source with its `.bib` and the PDF typeset from them, in a venue's
  format, projected from the document's accepted reading order at a revision, and kept. Every
  figure in it comes from a block, every citation from a work of the bibliography, every
  equation from the TeX its block stores; nothing is typed a second time, so a manuscript can
  never say what the record does not (`calliopa-bootstrap`'s `BO_0293`, requested and decided by
  the user on 2026-09-23).
- It is `bundled` and active on a fresh install and needs no credential. The typesetting is the
  stack's [Typesetting Service](../../../../../docs/system/typesetting-service.md) — Pandoc and
  TeX Live behind a front — reached through the kernel's `/__kernel/typeset/` forward, because a
  TeX distribution is a container and an extension cannot ship one.
- It depends on `documents`, whose document it projects and whose front matter and `abstract`
  role it reads ([Block Document Model](../../../documents/docs/system/documents/block-document-model.md#a-manuscript-out-of-the-record)),
  on `bibliography`, whose works a manuscript cites, and on `ui.shell`, whose frame it contributes
  into. The document's front matter and the abstract are `documents`', so a document stays a
  document with this extension switched off.
- Its change documents carry the prefix `MA`. A change that alters what a release ships writes
  its line in `calliopa-bootstrap`'s `docs/release-notes/unreleased.md`, as every change of a
  `bundled` extension does.

## What This Extension Holds

* PDF and LaTeX with its `.bib` ship first, from one pipeline; `.docx` is a second cut. User
  decision, 2026-09-23.
* A generic article and IEEE ship as venues; adding one is adding a template to the service,
  never code here. User decision, 2026-09-23.
* An execution's output enters as what it is — a picture a figure, an HTML table a table — with a
  last caption line naming the code cell and the revision that produced it; the producing code
  goes to *Supplementary Material*; text output and tracebacks stay out, said by name. User
  decision, 2026-09-23.
* Every manuscript made is kept, pinned to the revision it projects and the venue. User
  decision, 2026-09-23.
* A run may make and keep a manuscript through a tool; a run's manuscript is never anything but a
  file, proposing no block and changing no property. User decision, 2026-09-23.
- The type is `manuscript` (`BO_0293_018`): an `ext.blocktype` member of this extension, a root
  node with no parent and no block flag, as a bibliography's `work` is. It requires `id`, `of`,
  `revision`, `venue`, `files`, `made`, `by` and `outcome`, and permits `title`, `log` and
  `omitted`. `outcome` is one of `ok`, `errors`, `failed` and `timed out`. The files are the core's
  blob references with their filenames, hoisted to a top-level list so the core recognizes them
  as live references. The plural id beside the singular type follows `documents` and `document`,
  since a declaration and a manifest share the `node:<id>` namespace.
- The projection (`BO_0293_019`, `server/project.ts`, pure) turns the document's read and its
  cited works into a Pandoc JSON AST (API `1.22.1`, the image's Pandoc), the cited works as
  CSL-JSON keyed by their identity, the figures to send and what was left out:
  - A `text` block becomes a paragraph, a section at three depths or a block quote, with its marks,
    links, line breaks and inline mathematics; an `abstract` goes to the head wherever it stands.
  - A citation becomes a `\cite` of the work's identity with its locator, and `bibtex` numbers
    the citations in first-citation order with the venue's style, as the document numbers them.
    The locator goes to Pandoc as its own words after the comma: the image's Pandoc keeps the
    leading space of a suffix written as one string, and natbib then set `[1,  pp. 233–239]`
    with two spaces (found in the dry walk, 2026-09-25).
  - Figures, tables and equations are written as LaTeX with labels, and only the ones the
    document numbers carry a numbered caption (`\caption`, `equation`); the rest take
    `\caption*` or `equation*`. LaTeX therefore numbers exactly the blocks the document numbers,
    in the same order, and a reference points at the label.
  - A table wider than the line is shrunk to it: the tabular is set in a box the source
    defines itself and measured, and only one that overflows is scaled down, so a narrow
    table keeps its size and no venue template loads a package for it. A seven-column table
    had run off the page in both venues (dry walk, 2026-09-25); in IEEE's column such a
    table comes out small, and the source is the author's to widen to `table*`.
  - An output's first picture, or failing that an HTML table in its bundle — the shape a data
    frame renders as — enters as a figure or a table whose caption ends *Produced by code cell N
    at revision R.*; the code block that produced one is appended under *Supplementary
    Material*.
  - Left out and said by name in `omitted`: a video, a divider, a picture not made yet or in a
    format TeX does not read, an output with neither picture nor table, code that produced
    neither, a citation of a work the bibliography no longer holds, an equation's caption, and a
    table's rows past the first hundred its file holds. A discarded block and a prompt are not in
    the reading order and say nothing.
- The supplementary code is handed to Pandoc as code, not as raw LaTeX (`BO_0296_020`, 2026-09-25, `server/project.ts`): a `sourcecode` block under *Supplementary Material* becomes a `CodeBlock` carrying its language as a class, in place of the `RawBlock` holding `\begin{lstlisting}` it wrote before, so Pandoc's own highlighter sets it in colour through the macros the venues' templates carry, with shell escape still off (`calliopa-bootstrap`'s `BO_0296_008`). A block with no language becomes a `CodeBlock` with no class, which Pandoc sets plainly rather than refusing. Proven in `server/project.test.ts`: the AST holds a code block with its language, and no `lstlisting` remains.
- The supplementary code is numbered as the document numbers it (`BO_0302_010`, 2026-09-25, `server/project.ts`, `calliopa-bootstrap`'s `BO_0302`): with the document's `lineNumbers` on, the `CodeBlock` carries the `numberLines` class, and `startFrom` with the block's `firstLine` when it is not one, so Pandoc's own highlighter numbers the lines through `fancyvrb`, which the venues' templates already load — checked on the typeset image, which writes `numbers=left` and `firstnumber=40` into the `Highlighting` options; with the switch off, neither is written. The supplementary material prints only the code that produced a figure or a table, so a printed block may start at forty with no block before it on the page: the numbers are the document's, and the print shows them as they are. Proven in `server/project.test.ts`: a numbered document's block carrying the class, a continued one carrying `startFrom`, and a document switched off carrying neither.
- The venues are the service's (`BO_0293_020`, technical decision at implementation,
  2026-09-23). The service's `/health` answers each venue's id and name, and this extension
  offers them from there. The service is the one list, so no copy of a template lives here to
  drift from it; this replaces the copy held equal by a test that the transfer named.
- A manuscript is made and kept (`BO_0293_021`, `server/make.ts`, `server/manuscripts.ts`). `POST
  /api/x/manuscripts/make` with `{document, venue?, branch?}` reads the document as it stands,
  in the tab's branch when it is in one. It reads the cited works from the bibliography, projects,
  reads each figure's bytes from the store and sends all of it through the kernel forward. It
  keeps the answered `manuscript.tex`, `references.bib` and `manuscript.pdf` with `putBlob`, the
  figures beside them as references to the blocks' own blobs under the names the source includes
  them by — no new bytes, so the LaTeX a person downloads typesets by hand and a venue takes it
  whole (found by the walk, 2026-09-25) — and writes one `manuscript` node as the person's truth: `revision` is the dataRevision the read was
  made at, `by` the signed-in person's name. A typesetting that failed is kept with its source.
  A service that does not answer is refused in its own words and keeps nothing. The venue is
  the one asked for, else the document's own, else `generic`. `GET /api/x/manuscripts/manuscripts`
  lists every kept manuscript newest first, a document's with `?document=`;
  `GET .../manuscripts/[id]` reads one; `GET .../manuscripts/[id]/files/[name]` streams a file
  typed and named, the PDF inline and the others as downloads, immutable. `GET
  /api/x/manuscripts/venues` answers the service's venues. Proven in `server/project.test.ts`
  (fourteen cases on one document holding every block kind). `server/typeset.integration.test.ts`
  posts that document's projection to a running service as the generic article and as IEEE, both
  answering `ok`; it runs when `CALLIOPA_TYPESET_TEST_URL` names one. `tests/behavior/manuscripts.test.ts`
  runs over the one graph under the kernel harness: a document with front matter, an abstract, a
  cited work, a numbered picture and a numbered table is made into an IEEE manuscript by the real
  service and kept, and its three files read back from the store. A service that does not
  answer is refused and nothing is kept. Run on 2026-09-23 against the built image, both passed.
- The surface (`BO_0293_022`, technical decision at implementation, 2026-09-23). A document
  decoration's provider adds a *Manuscript* group to the document's bar: a *Venue* choice among
  the service's venues or the document's own, and *Make manuscript*, which makes one and opens it
  in its own tab, or says the refusal as a message. The kept manuscripts are the library category
  *Manuscripts*, each opening as the kind `manuscript`, whose page shows the document, the
  revision, the venue, when and by whom, the outcome, the files, what was left out and what the
  typesetting said. The transfer placed the list in a panel of the bar; the bar's popover carries
  text only, so the files, which are links, live on the manuscript's own page. Proven in
  `views/views.test.ts` in Qwik's render harness with the shell's own controls drawing the group:
  the section's rows and its two empty states, the page's links and lists, the group's options,
  and the press sending the make and opening the tab. With the service unreachable the group is
  absent.

* A code block its author numbers is body material: it prints where it stands as a `listing`
  float holding the coloured code, captioned and labelled, and a reference to it prints *Listing
  N*; the author's number is the author's word that this code is part of the paper. Code nobody
  numbers keeps the rule above. User decision, 2026-09-25 (`calliopa-bootstrap`'s `BO_0303_Q1`).
* Code prints once: a numbered listing that produced a figure or a table is not repeated under
  *Supplementary Material* — that figure's or table's provenance line names the listing in place
  of the code, and the supplement carries only the producing code nobody numbered. User decision,
  2026-09-25 (`BO_0303_Q2`).
* Code alone is a listing; an execution's text output and a traceback stay out, as above. User
  decision, 2026-09-25 (`BO_0303_Q3`).

## Open Work

Transferred from `calliopa-bootstrap`'s `BO_0293` on 2026-09-23 and moved here from
`documents`' [Block Document Model](../../../documents/docs/system/documents/block-document-model.md#a-manuscript-out-of-the-record)
when this extension came into being (`BO_0293_017`).

- The run's manuscript is made through the kernel (`BO_0293_023`, landed 2026-09-25; `server/tools.ts`, the callback routes `kernel/manuscripts/project` and `kernel/manuscripts/kept`, the member `manuscripts.making`; `make_manuscript` itself is `calliopa-bootstrap`'s `BO_0293_026`, a tool of the kernel's own, because a tool's callback holds no person's session and the gate admits a run's grant on no typesetting path — user decision, 2026-09-25). `project`, marked `kernelCallback`, takes `{document, venue?}` and the run and answers what a press sends the service — the AST, the references, the figures' bytes — read at the run's pin through `atDataRevision` as a press reads at head, with the venue resolved as a press resolves it (`venueOf`), the revision, what was left out and the figures as blob references (`figuresOf`, shared with the press), so the projection is `project.ts`'s and nothing is projected twice. `kept` takes the outcome, the log, what was left out, the blob references the kernel put and the figures, and answers the `stage` statement of one `manuscript` node — `manuscriptWrite`, the write a press commits, said with no status, since a proposal-scoped write stages a candidate and refuses an explicit `established` (found by the instance check, 2026-09-25; the press's write says `established`) — `by` the run's principal, which the kernel stages into the run's group as the run, so a run's manuscript is the node a press writes, listed under *Manuscripts* with its process, and proposes no block and changes no property. Both refuse in words what is not a document's or a manuscript's (`422`). The skill says to read the document first, to read the omissions before the warnings before the source, to make one manuscript and say what it needs in the document as a proposal, never by editing the source, and that a run's manuscript is a file, not a change. Proven in `server/tools.test.ts` — the inputs and their refusals, the write composed by the run's principal, the figures appended — and in `tests/behavior/manuscripts.test.ts` under the kernel harness: a document projected at a pin it has moved past, its venue and title, a video said in `omitted`, its picture among the figures, a venue given honoured, and the composed write kept and read back as a press's manuscript is. The run's path on the instance is `calliopa-bootstrap`'s `BO_0293_005`.
- The run's path is verified on the instance (`calliopa-bootstrap`'s `BO_0293_005`, 2026-09-25, pin 2918, from the user's own use in *Ice loss walk*): a run asked to make an IEEE manuscript made one through `make_manuscript` — `typeset` on its record, the manuscript in its group at revision 2920 by the run's principal, `ok`, with its source and PDF, listed under *Manuscripts* with the run's process — and answered what the venue still needs from the source and the omissions.
- A dry walk ran on 2026-09-25 against the instance at head 2538, read-only and
  credential-free: every document holding more than text — six, among them a numbered
  equation referred to from a sentence, three citations with locators, tables of two to seven
  columns and a nine-megabyte picture — was projected by this code from the live graph and
  typeset by the service as both venues, twelve answers `ok`; the Greenland source and its
  `.bib` were typeset again by hand with `latexmk`. It found the two faults folded above and no
  other. No document on the instance carries front matter, an output's picture or a video, so
  the document `BO_0293_024` names has to be made first.
- The glossary (`BO_0301_020`, landed 2026-09-25; `server/project.ts`, `server/make.ts`): this
  extension declares `keywords` as a dependency, as it declares `bibliography`, and `makeManuscript`
  reads `mentionsOf` for the document at the manuscript's revision through the keywords
  extension's own module, one process and no HTTP hop; every keyword mentioned in the accepted
  reading order — a retired or discarded block counting for nothing, since the read takes the
  reading order — is one entry of a *Glossary* section after the body, once, alphabetically by
  title, the entry's words the definition `keywordsOf` answers as inline content with its marks
  and a keyword with no definition listed by its title alone. The section goes to the typesetting
  front as an unnumbered `Header` and a `DefinitionList` in the Pandoc AST it already takes, so
  every venue's template carries it without a package the service would have to add; the
  references the template sets last follow it. `make_manuscript` (`BO_0293_023`) carries the
  glossary because it is the same projection. With `keywords` switched off, no keyword role chosen
  or no keyword mentioned, the read answers nothing and the manuscript has no glossary section
  and says nothing about one; the front matter's own `keywords` list is untouched. Proven in
  `server/project.test.ts`, *the glossary*.
- The manuscript carries every reference (`BO_0300_012`, landed 2026-09-25; `server/project.ts`, `blockReference`, `remarked`): a `blockRef` — and the three older keys as before — to a numbered figure, table or equation prints as its number; to a heading as `Section~\ref{<id>}`, the label Pandoc writes for a `Header` from the block's identity; to a paragraph or quote another sentence refers to as `Remark~\ref{par:<id>}`, that block set in the `remark` environment the venues' templates define (`calliopa-bootstrap`'s `BO_0300_013`) with `\label{par:<id>}`, numbered by LaTeX in reading order as the read numbers them (`remarkNumbers`, derived here the same way when a read did not answer them); and a reference to a block outside the reading order, or to one a paper cannot name — an abstract, an unnumbered float or equation, code — prints *(gone)* and is named in `omitted`. Proven in `server/project.test.ts` on the fixture, which gained a heading reference, a referred-to paragraph and a gone one, and in the integration test's manuscript under both venues.
- Walked by the user on 2026-09-25 (`BO_0293_024`) on the dogfood instance from pin 2552 to 2848, in the document *Ice loss walk* made for it and in *Greenland*: the front matter set — its first shape refused an authors line saved before its affiliations and was reshaped the same day as chips and author rows (`documents`' `BO_0293_025`) — the abstract, the sections, a numbered figure with a caption and a table (`BO_0295`), an equation and a paragraph referred to from a sentence (`BO_0300`), citations, and *Make manuscript* as the generic article (Ice loss walk, revision 2875) and as IEEE (Greenland, revision 2877), both `ok` and kept, opened and read by the user. The kept sources typeset again by hand with `latexmk` inside the service's container: the generic article, exit 0, a PDF of the same 119594 bytes the service kept; the IEEE source stopped at its missing picture, because the figures were sent to the service but not kept — folded the same day into `figuresOf` above, for a press and a run alike. A video left out and said so stands on the projection's tests and the dry walk, since no walk document carried one. The run's half joins with `calliopa-bootstrap`'s `BO_0293_005`.
- The manuscript prints a numbered listing (`BO_0303_016`, landed 2026-09-25; `server/project.ts`, `codeBlockOf`, `calliopa-bootstrap`'s `BO_0303`): a `sourcecode` block the read numbers becomes, where it stands in the body, `\begin{listing}[htbp]`, the `CodeBlock` the supplement already got — language, `numberLines` and `startFrom` as before — and `\caption{…}\label{lst:<id>}\end{listing}`, the caption the block's or empty; `blockReference` prints a `blockRef` to it as `Listing~\ref{lst:<id>}` and one to a code block nobody numbers as gone, named in `omitted`. A figure or a table a numbered listing produced ends its caption *Produced by Listing~\ref{lst:<id>} at revision R.* in place of the cell's number — the provenance line reaches `captionOf` as LaTeX now, escaped by its caller — and the supplement's loop skips the listing, so the code prints once; producing code nobody numbers keeps its supplementary subsection, and unnumbered code that produced nothing is still said by name. The float is the venues' (`calliopa-bootstrap`'s `BO_0303_006`). Proven in `server/project.test.ts`, *a numbered listing*: the float at its place after the table before it, the reference and the gone one, the produced figure's line naming the listing with no supplement left, and the base fixture's unnumbered producing block still in the supplement.
