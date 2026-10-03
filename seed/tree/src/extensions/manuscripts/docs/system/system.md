# Manuscripts

## Purpose

- This document is the entry point of `manuscripts`, the extension that makes a manuscript of a
  document using the built-in *Format* as a PDF: the LaTeX source with its `.bib` and the PDF
  typeset from them, in a venue's format, projected from the accepted reading order at a
  revision, and kept on that document. Every figure in it comes from a block, every citation from a
  work of the bibliography, every equation from the TeX its block stores; nothing is typed a
  second time, so a manuscript can never say what the record does not (`calliopa-bootstrap`'s
  `BO_0293`, requested and decided by the user on 2026-09-23, and `BO_0312`, which made
  manuscripts formats on 2026-10-01).
- It is `bundled` and active on a fresh install and needs no credential. The typesetting is the
  stack's [Typesetting Service](../../../../../docs/system/typesetting-service.md) — Pandoc and
  TeX Live behind a front — which only the kernel's `make_manuscript` reaches, because a TeX
  distribution is a container and an extension cannot ship one.
- It depends on `documents`, whose document it projects and whose `abstract` structure it reads
  ([Block Document Model](../../../documents/docs/system/documents/block-document-model.md#a-manuscript-out-of-the-record)),
  on `structures`, whose built-in *Format* marks the document and whose structures carry the venue and
  the front matter, on `bibliography`, whose works a manuscript cites, on `keywords`, whose
  mentions make its glossary, and on `ui.shell`, whose frame it contributes into.
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
* *Format* is a built-in structure whose type is text, table, image, video, PDF or structured. Making a
  manuscript is an instruction that produces a PDF, saying how to evaluate the document using
  *Format* and its reading order. *Venue* is a structure the person creates (`BO_0308`).
* *Format* is used by documents alone, and its unit is the whole document: the output is made
  from the document using *Format*, its reading order, and kept on that document. A part that
  should be formatted on its own becomes focused work, and its document uses *Format*. User
  decision, 2026-10-01 (`calliopa-bootstrap`'s `BO_0332`, `RO_0003_Q2`), revising the block and
  its children above.
* No instruction ships. A fresh install makes no manuscript until the person writes one (`BO_0312_Q1`).
  An instruction produces its output through the agent's tools, and its own code cannot reach the stack's
  services (`BO_0312_Q5`).
* A PDF keeps its LaTeX and `.bib` beside it, and the `.docx` once the service makes one
  (`BO_0312_Q2`; `.docx` stays this extension's second cut, as above).
* Front matter moves to a structure the person owns: the migration creates *Paper* and moves the values
  there (`BO_0312_Q3`). Manuscripts already kept are deleted (`BO_0312_Q4`). Both are applied
  automatically (`BO_0312_Q7`).

## Formats

Under `calliopa-bootstrap`'s `BO_0312` (part 4 of `BO_0308`), landed 2026-10-01: a manuscript is
the output of a document using *Format* (*Formats Per Document*), made by the agent's
typesetting tool under an instruction the person writes. The kernel's half is `calliopa-bootstrap`'s `ui-kernel.md`, *Formats, Migrations
And Spending*; *Format*'s fields are `structures`' ([Structures](../../../structures/docs/system/system.md)).

- The tool reads front matter and venue by field key, from the structures the run names: `authors`,
  `affiliations` and `keywords` from the paper structure, and `template` and `citationStyle` from the
  venue structure. It answers the keys it read and the ones missing, so an instruction's words can say which
  structures to name. A key is minted once from a field's first name (`structures`), so renaming a
  field keeps it. Technical decision at transfer, 2026-09-30, since *Venue* and *Paper* are the
  person's structures and nothing may look a structure up by name.
- The projection's structures (`BO_0312_020`, landed 2026-10-01; `server/tools.ts`,
  `server/structures-read.ts`, `lib/front.ts`). What is projected is the document (`BO_0332_030`). The
  structures are read through `structures`' `structuresOf` at the pin, on the document; a value is found
  by its key, or for a field made before keys were minted from names by the key its name would
  mint. The venue template is the venue structure's `template`, else `generic`. The service sets
  citations by the template's own style, so a `citationStyle` read is said in what was left out
  rather than dropped silently. The front matter is the paper structure's: an author per line, its
  address in angle brackets; one affiliation is every author's, as many as there are authors pair
  in order, otherwise each author uses them all; keywords split at commas and semicolons. The
  answer carries `read` and `missing` beside what it carried before.
- The kept output is a rendition (`BO_0312_021`, landed 2026-10-01; `lib/rendition.ts`,
  `server/make.ts`, `server/renditions.ts`). Its type is `formatRendition`, an `ext.blocktype`
  member (technical decision at implementation). A root node requiring `id`, `of` (the document using *Format*; a block's id
  on one kept on a block before `BO_0332`), `document`, `revision`, `type` (text, table, image, video, pdf or structured),
  `files`, `made`, `by` and `outcome`, and permitting `title`, `venue`, `log` and `omitted`; the
  files are blob references with their filenames in a top-level list, as before. The `kept`
  callback takes `type` (`pdf` when absent) and answers `renditionWrite`'s statement,
  with no status, which the kernel stages into the run's group as the run. `manuscript` stays
  declared, read by the migration alone, until every install has run it (`BO_0312_062` in
  `calliopa-bootstrap`).
- The surfaces (`BO_0312_022`, landed 2026-10-01; `views/provider.tsx`, `views/renditions.tsx`).
  The extension draws nothing in the bar, has no library category and no page, and a person makes
  no manuscript by a press: an instruction asks the agent for one. A provider reads a document's renditions
  once per read of the document (`GET /api/x/manuscripts/renditions?document=`) and shares them;
  the document's `end` place lists them (`BO_0332_031`): when, by whom, the
  revision, the outcome, each file as a link (`GET …/renditions/[id]/files/[name]`, the PDF inline,
  the source and references downloaded), what was left out and what the typesetting said, the last
  two folded.
- The migration (`BO_0312_023`, landed 2026-10-01; `server/migrations.ts`, the member
  `migration-bo-0312-formats`, route `kernel/migrations/formats`, after
  `migration-bo-0309-one-role-type`): an executable `ext.migration` (`calliopa-bootstrap`'s
  `BO_0312_001`). It retires every `manuscript` node, its blobs left to the store's collection.
  When any document holds front matter, it creates one ordinary structure *Paper* with *Authors* and
  *Affiliations* (long text, one per line) and *Keywords* (text), keyed `authors`,
  `affiliations` and `keywords`, placed after the structures already there; each such document uses it
  with its values written in — an author per line with the corresponding mark and the address as
  the manuscript printed them, an affiliation per line, keywords joined by commas — and its four
  properties are cleared, every clearing before every relation. The venue was a template id and
  has no field on *Paper*; a person's venue structure says it now. An instance with nothing to move
  answers an empty statement.
- The skill `manuscripts.making` (`BO_0312_024`, landed 2026-10-01): read the document's structures first;
  propose *Format* on the document where it is missing rather than calling the tool (`BO_0332_032`); name the venue and paper structures
  the instruction points at; make one rendition; read the omissions, then the missing fields, then the
  warnings, then the source; and say what the venue still needs as a proposal, never by editing
  the source.
- Verified 2026-10-01 (`BO_0312_025`, the code half): `lib/front.test.ts` for the front matter's
  lines; `server/project.test.ts` for the head from the paper structure and none without one;
  `server/tools.test.ts` for the block's input and the rendition write; `server/migrations.test.ts`
  for the statement — manuscripts retired, *Paper* made once, each document cleared before it uses
  *Paper*, nothing without front matter; `views/views.test.ts` for the provider's one read, a
  block's renditions only while turned to, newest first with their links, and the document's at
  its end; `tests/behavior/manuscripts.test.ts` over CCGW for a block's projection at its pin with
  the venue and the paper read by key and the missing keys answered, each refusal in words, the
  rendition composed and read back on its document, a whole document typeset as IEEE by the
  stack's real service with its four files kept (run 2026-10-01 against the dogfood stack's
  service), and the migration moving a document's front matter to *Paper* once, which the person
  can rename.
- Walked by the user on the served build at pin 3483, 2026-10-01 (`BO_0312_025`, "worked"): a
  *Manuscript* instruction the user wrote, a venue structure with its template, *Paper*, and *Format* (PDF)
  on the document; a command sent with the instruction made the PDF with its LaTeX and `.bib`, kept on
  the block and listed below it. The migration had run once at 3486, leaving no kept manuscript and
  the front matter on *Paper*.

## Formats Per Document

- Under `calliopa-bootstrap`'s `BO_0332` (`docs/changes/BO_0332_FEAT_document-roles-and-block-roles.md`),
  set to draft by the user on 2026-10-01 and transferred here the same day: *Format* is used by
  documents alone (`structures`' [Structures](../../../structures/docs/system/system.md#document-structures-and-block-structures)),
  so a manuscript is made from the document using it, never from a block. The kernel's half is
  `make_manuscript`'s input (`calliopa-bootstrap`'s `ui-kernel.md`, *Document Structures And Block
  Structures*, `BO_0332_001`).
- A rendition kept on a block before this change keeps its `of`, and is listed at its document's
  end with the document's own, since no block draws renditions any more; nothing is migrated, as
  no structure assignment is (`RO_0003_Q3`). Technical decision at transfer.
- The projection from the document (`BO_0332_030`, landed 2026-10-01; `server/tools.ts`,
  `server/structures-read.ts`): the kernel's `project` callback takes `{document, venueStructure?,
  paperStructure?}` and the run, and projects the document's whole reading order at the pin, its
  numbers its own. A `block` the input still names is not read. It is refused in words, before
  anything is projected, when the document uses no *Format* — the refusal says to propose
  *Format* on the document, and that a part formatted on its own is a block's focused work — when
  it uses *Format* as anything but PDF, or when a structure the run names is not used on the
  document. The `kept` callback takes no block, and the rendition's `of` is the document.
- The surfaces (`BO_0332_031`, landed 2026-10-01; `views/renditions.tsx`, `contributions.ts`): no
  block place is contributed; the document's `end` place lists every rendition whose `document` is
  it, newest first as the route answers them, one kept on a block before included.
- The skill (`BO_0332_032`, landed 2026-10-01; the member `manuscripts.making`): its goal, output,
  operations, precondition and conventions name the document using *Format*; `readTheRolesFirst`
  says to propose *Format* on the document, never on a block, and that a part formatted on its own
  is opened as a block's focused work, whose document uses *Format*.
- Verified 2026-10-01 (`BO_0332_033`): `server/tools.test.ts` — the document's input, a `block`
  handed to `kept` not read, the rendition on the document; `views/views.test.ts` — every
  rendition of the document at its end, one kept on a block included and another document's left
  out, nothing for a document with none, and no block place contributed;
  `tests/behavior/manuscripts.test.ts` over CCGW under the kernel harness — a document using
  *Format* (PDF), the venue and the paper projected whole at its pin with the abstract in the head,
  a `block` named and not read, *Format* refused on a block, the refusals for a document without
  *Format*, a structure it does not use and *Format* as image, the rendition read back on the
  document and a rendition kept on a block before listed beside it. The real-service case runs
  when `CALLIOPA_TYPESET_TEST_URL` names a service and was skipped in this run.

## The Projection

- The projection (`BO_0293_019`, `server/project.ts`, pure) turns the read and its
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
    table's rows past the first hundred its file holds. A prompt is not in
    the reading order and says nothing.
- The supplementary code is handed to Pandoc as code, not as raw LaTeX (`BO_0296_020`, 2026-09-25, `server/project.ts`): a `sourcecode` block under *Supplementary Material* becomes a `CodeBlock` carrying its language as a class, in place of the `RawBlock` holding `\begin{lstlisting}` it wrote before, so Pandoc's own highlighter sets it in colour through the macros the venues' templates carry, with shell escape still off (`calliopa-bootstrap`'s `BO_0296_008`). A block with no language becomes a `CodeBlock` with no class, which Pandoc sets plainly rather than refusing. Proven in `server/project.test.ts`: the AST holds a code block with its language, and no `lstlisting` remains.
- The supplementary code is numbered as the document numbers it (`BO_0302_010`, 2026-09-25, `server/project.ts`, `calliopa-bootstrap`'s `BO_0302`): with the document's `lineNumbers` on, the `CodeBlock` carries the `numberLines` class, and `startFrom` with the block's `firstLine` when it is not one, so Pandoc's own highlighter numbers the lines through `fancyvrb`, which the venues' templates already load — checked on the typeset image, which writes `numbers=left` and `firstnumber=40` into the `Highlighting` options; with the switch off, neither is written. The supplementary material prints only the code that produced a figure or a table, so a printed block may start at forty with no block before it on the page: the numbers are the document's, and the print shows them as they are. Proven in `server/project.test.ts`: a numbered document's block carrying the class, a continued one carrying `startFrom`, and a document switched off carrying neither.
- The supplementary code is handed to Pandoc as code, not as raw LaTeX (`BO_0296_020`, 2026-09-25, `server/project.ts`): a `sourcecode` block under *Supplementary Material* becomes a `CodeBlock` carrying its language as a class, so Pandoc's own highlighter sets it in colour through the macros the venues' templates carry, with shell escape still off (`calliopa-bootstrap`'s `BO_0296_008`). A block with no language becomes a `CodeBlock` with no class, which Pandoc sets plainly rather than refusing. Proven in `server/project.test.ts`.
- The supplementary code is numbered as the document numbers it (`BO_0302_010`, 2026-09-25, `server/project.ts`, `calliopa-bootstrap`'s `BO_0302`): with the document's `lineNumbers` on, the `CodeBlock` carries the `numberLines` class, and `startFrom` with the block's `firstLine` when it is not one, so Pandoc numbers the lines through `fancyvrb`, which the venues' templates already load; with the switch off, neither is written. Proven in `server/project.test.ts`.
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

- The manuscript prints a numbered listing (`BO_0303_016`, landed 2026-09-25; `server/project.ts`, `codeBlockOf`, `calliopa-bootstrap`'s `BO_0303`): a `sourcecode` block the read numbers becomes, where it stands in the body, `\begin{listing}[htbp]`, the `CodeBlock` the supplement already got — language, `numberLines` and `startFrom` as before — and `\caption{…}\label{lst:<id>}\end{listing}`, the caption the block's or empty; `blockReference` prints a `blockRef` to it as `Listing~\ref{lst:<id>}` and one to a code block nobody numbers as gone, named in `omitted`. A figure or a table a numbered listing produced ends its caption *Produced by Listing~\ref{lst:<id>} at revision R.* in place of the cell's number — the provenance line reaches `captionOf` as LaTeX now, escaped by its caller — and the supplement's loop skips the listing, so the code prints once; producing code nobody numbers keeps its supplementary subsection, and unnumbered code that produced nothing is still said by name. The float is the venues' (`calliopa-bootstrap`'s `BO_0303_006`). Proven in `server/project.test.ts`, *a numbered listing*: the float at its place after the table before it, the reference and the gone one, the produced figure's line naming the listing with no supplement left, and the base fixture's unnumbered producing block still in the supplement.

- The glossary (`BO_0301_020`, landed 2026-09-25; `server/project.ts`, `server/make.ts`): this
  extension declares `keywords` as a dependency, as it declares `bibliography`, and `glossaryOf`
  reads `mentionsOf` for the document at the manuscript's revision through the keywords
  extension's own module, one process and no HTTP hop; every keyword mentioned in the accepted
  reading order — a retired block counting for nothing, since the read takes the
  reading order — is one entry of a *Glossary* section after the body, once, alphabetically by
  title, the entry's words the definition `keywordsOf` answers as inline content with its marks
  and a keyword with no definition listed by its title alone. The section goes to the typesetting
  front as an unnumbered `Header` and a `DefinitionList` in the Pandoc AST it already takes, so
  every venue's template uses it without a package the service would have to add; the
  references the template sets last follow it. `make_manuscript` carries the glossary. With `keywords` switched off, no document using
  *Keyword* or no keyword mentioned, the read answers nothing and the manuscript has no glossary section
  and says nothing about one; the paper structure's own keywords are untouched. Proven in
  `server/project.test.ts`, *the glossary*.
- The manuscript carries every reference (`BO_0300_012`, landed 2026-09-25; `server/project.ts`, `blockReference`, `remarked`): a `blockRef` — and the three older keys as before — to a numbered figure, table or equation prints as its number; to a heading as `Section~\ref{<id>}`, the label Pandoc writes for a `Header` from the block's identity; to a paragraph or quote another sentence refers to as `Remark~\ref{par:<id>}`, that block set in the `remark` environment the venues' templates define (`calliopa-bootstrap`'s `BO_0300_013`) with `\label{par:<id>}`, numbered by LaTeX in reading order as the read numbers them (`remarkNumbers`, derived here the same way when a read did not answer them); and a reference to a block outside the reading order, or to one a paper cannot name — an abstract, an unnumbered float or equation, code — prints *(gone)* and is named in `omitted`. Proven in `server/project.test.ts` on the fixture, which gained a heading reference, a referred-to paragraph and a gone one, and in the integration test's manuscript under both venues.
- The projection reads a cited source's CSL item from its source document (`calliopa-bootstrap`'s
  `BO_0313_040`, landed 2026-10-01; `server/make.ts` `citedWorks`): through `bibliography`'s
  `readWork`, which composes the record from the source document's title and *Source*'s fields,
  keyed by the document's identity, in place of the `work` node, so nothing here changed but the
  record's origin. The item carries the source's own CSL type, and the typesetting service's
  Pandoc converts it to the `.bib` as its BibTeX type, `@misc` for a type BibTeX has none for —
  checked 2026-10-01 against the instance's service: an interview, a conversation, a dataset, a
  web page and software each become `@misc` with their authors, title, date and publisher.
- [ ] BO_0313_041 A `@misc` entry carries its address and its DOI: Pandoc's BibTeX writer drops
      `URL` and `DOI` from a `@misc` (found 2026-10-01 with `BO_0313_040`), so a web page or a
      dataset cited in a manuscript reaches the `.bib` without where to find it. The projection,
      or the service's conversion, puts them in `howpublished` or `note`, as the venue's
      bibliography style reads them.
- The run's path is the kernel's `make_manuscript` (`calliopa-bootstrap`'s `BO_0293_026`, `BO_0312_005`): a tool of the kernel's own, because a tool's callback holds no person's session and the gate admits a run's grant on no typesetting path (user decision, 2026-09-25). It asks `project`, posts the projection to the service, puts the files as blobs and asks `kept`, both routes `kernelCallback` and refusing in words what is not a block's or a rendition's (`422`). `server/typeset.integration.test.ts` posts the fixture's projection to a running service as the generic article and as IEEE when `CALLIOPA_TYPESET_TEST_URL` names one.

## Roles Become Structures

Under `calliopa-bootstrap`'s `BO_0338`, promoted to draft by the user on 2026-10-02 and transferred
here the same day: roles become structures and profiles become instructions, with every stored
identifier and route, and `doc-block-roles` and `profiles` become `structures` and `instructions`
([Roles Become Structures](../../../structures/docs/system/system.md#roles-become-structures)).

- `make_manuscript`'s callbacks take `venueStructure` and `paperStructure` (`BO_0338_090`,
  2026-10-02; `server/tools.ts`, `server/structures-read.ts`), as the kernel names them
  (`calliopa-bootstrap`'s `BO_0338_004`).
- The `manuscripts.making` skill says a document *uses* *Format* and speaks of structures and
  instructions, and `make_manuscript`'s refusals say structure (*the document uses no Format
  structure …*, *the venue structure … is not used on the document …*) (`BO_0338_091`,
  2026-10-02). The executed migration `migration-bo-0312-formats` keeps its id.
- This extension's code and docs speak the new terms (`BO_0338_092`, 2026-10-02):
  `server/structures-read.ts` reads the structures a manuscript is made under, and this document
  says a document *uses* *Format* and names the venue and paper structures. Verified by the unit
  suites, 46 tests.

## A Structure Is A Document

Under `structures`' `RO_0005` (2026-10-02): every structure becomes a document and *Format* takes a
fixed id `structures` names
([A Structure Is A Document](../../../structures/docs/system/system.md#a-structure-is-a-document)).

- A manuscript reads *Format* by `FORMAT_STRUCTURE` and a venue's and a paper's values by key as
  before (`RO_0005_070`, landed 2026-10-02). The migration `formats` (`BO_0312`) makes *Paper* as
  a node only where front matter from before `BO_0312` stands, which no fresh install holds and
  every instance an update reaches moved on the release carrying it; the kernel runs it after
  `structures-as-documents`, as every migration of an extension depending on `structures`. The
  suite over CCGW runs `formats` and then the move, proving both.

## A Run's Tools Read What The Run Proposed

- Under `BO_0344` (`calliopa-bootstrap`'s `docs/changes/completed/BO_0344_FIX_extension-tools-read-the-runs-own-proposals.md`),
  transferred 2026-10-03: the projection reads the run's document at the run's pin outside its
  group, so a manuscript made after the run proposed into its document leaves those proposals out.
  The shell's read scope (`ui.shell`'s *A Run's Callback Reads What The Run Proposed*,
  `BO_0344_004`) is the fix.
* The projection a run asks for reads as the kernel's own tools do: at the run's pin with the run's
  own group laid over truth. User decision, 2026-10-03.
- The projection reads in the shell's scope (`BO_0344_010`, landed 2026-10-03; `server/tools.ts`):
  `projectForKernel` drops `pinned` and its own `dataRevision`; the revision it answers is the
  document's as read, the run's pin. Proven in `tests/behavior/manuscripts.test.ts` under the
  kernel harness: a block proposed in a run's group stands in the run's projection and not in one
  outside the run.
