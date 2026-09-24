# A Manuscript Out Of The Record

Status: wip

Requested: 2026-09-23; its questions answered by the user the same day. In the user's words:
*create a change for journal-formatted manuscript out of the state graph — or you are a side
tool.* The line comes from the positioning review of the same day: if Calliopa is to be the go-to
tool for scientific research, the paper is still the output that matters, and a record that links
data, code, figures, claims and sources but cannot emit the manuscript a journal accepts is a side
tool that dies when the grant ends. This document shapes the change; it authorizes no
implementation.

## What Is Asked

- A person opens a document and gets a manuscript out of it: a file in a journal's or a
  conference's format, ready to submit — its title and front matter, its sections in reading order,
  its figures, tables and equations numbered and captioned, its citations drawn in the venue's
  style and its reference list at the end.
- The manuscript is a projection of the record at a revision. Every figure in it comes from a block,
  every citation from a source the bibliography holds, every equation from the TeX the block
  carries. Nothing in the manuscript is typed a second time, so the manuscript can never say what
  the record does not.
- The formats a venue asks for: PDF to read and submit, LaTeX source with its `.bib` for a venue
  that typesets it, and Word for a venue that wants a `.docx`.

## Where This Starts

At head 2041 of the dogfood instance, release 0.3.11.

- **A document already holds most of what a manuscript is made of.** `text` blocks in the roles
  `paragraph`, `h1`–`h3` and `quote`, with the marks `bold`, `italic`, `strikethrough`, `code`, a
  link and line breaks; `image` and `video` blocks (`BO_0273`); a `table` block with a caption
  (`BO_0287`); a display equation with an optional caption, numbered on request and referred to by
  a run that follows its number (`BO_0290`, `wip`); a citation as a `cite` run over a source held in
  CSL-JSON, numbered in first-citation order, the reference list derived and never written by hand,
  IEEE by default with APA and Chicago author-date chosen in Settings, rendered by `citeproc-js`
  (`BO_0291`, draft); a code block and the output a runtime produced after it (`BO_0289`, `wip`).
- **A document already knows what is in the reading order.** Retired and discarded blocks count for
  nothing in numbering; a prompt block leaves the reading order unless kept; an open proposal is a
  candidate, not the document. The manuscript is the accepted reading order at the pin, the same
  set the citation numbering already resolves over (`BO_0291_013`).
- **Nothing exports a document.** The only exports today are an extension's archive (`BO_0224`) and
  a table's `.csv`. No route serves a document as a file in any format.
- **The stack already renders and converts, in the pattern this needs.** The capture service renders
  a page to PDF with Chromium; the Zotero translation server exports `bibtex`, `ris` and `csljson`
  from the same records the bibliography stores; both are fixed-layer containers, internal network
  only, reached through the kernel's `/__kernel/<svc>/` forward with a bearer, and each has one
  consumer in the graph owning its surfaces (`docs/system/page-capture-service.md`,
  `docs/system/bibliography-service.md`). A typesetting engine is a container of the same kind.
- **A document has no front matter.** No property or block carries authors, affiliations, an
  abstract, keywords or the venue. `document` carries `title`, `intention`, `record`, `phase` and
  `supersededBy`. A manuscript needs the rest.
- **Figures and tables are not numbered, and images carry no caption.** Equations are the one
  numbered thing, and the run that refers to one is the idiom for a figure reference to follow
  (`BO_0290`). A table carries a caption; an `image` block carries none.
- **The record's storage shapes line up with the engines.** CSL-JSON is what `citeproc-js` consumes
  and what Pandoc's citeproc consumes; a display equation stores TeX; a table stores columns and
  rows. Pandoc reads a document AST and writes LaTeX, `.docx` and, with a TeX distribution, PDF,
  with a CSL style file per venue and a LaTeX template per venue. Whether Pandoc is the engine is a
  technical decision at transfer; that the projection is *record → AST → format*, with no
  hand-written markup in between, is the shape whatever engine is chosen.

## The Shape

- **The manuscript is kept.** Producing one is a write: the file is attached to the document with
  the revision it projects and the venue it was made for, and the person downloads it from there.
  Every earlier manuscript stays findable, so what was submitted and what a reviewer saw is on the
  record, and *this figure comes from this cell on this data* is answerable after the fact.
  Whether it lands the way `BO_0289`'s written files land — blob references on a node, no
  `attachment` node — or as a member of its own is a technical decision at transfer.
- **The projection walks the accepted reading order and refuses nothing silently.** A block the
  format cannot carry — a video, a code block, an output that is not an image or a table — is
  either left out under a rule the person sees, or placed in supplementary material, and the
  manuscript says which. Nothing is dropped without a word.
- **Front matter is the record's, not the export's.** Authors, affiliations, keywords and the
  venue are properties of the `document` node, drawn by the editor above the first block; the
  abstract is a block of a new role `abstract` in the reading order, where a reader expects it and
  where a run proposes it like any block. Two exports of one document agree, and a run reads both.
- **A venue is a style.** A venue names a CSL style for citations and a template for the body:
  a LaTeX class and its options, or a `.docx` reference document. Adding one is adding a template,
  never code.
- **A fixed-layer service typesets.** The engine runs as its own container: internal network only,
  no route to the graph, a bearer from the secrets volume, reached through the kernel, and answering
  `502` in words when down, as capture and search do. The extension sends it the document's
  projection and the sources' records; the service never reads the graph. Which extension owns the
  export surface — `documents`, since the manuscript is a document's projection, with
  `bibliography` answering the citations — is a technical decision at transfer.
- **A round trip is not this change.** Importing a LaTeX or Word manuscript into a document is a
  change of its own, as importing a Zotero, BibTeX or RIS library is beside `BO_0291`.

## Decided

Answered by the user on 2026-09-23. Each line is a requirement of the change and is transferred
as tasks at draft.

* **Formats: PDF and LaTeX with its `.bib` ship first, from one pipeline** (`BO_0293_Q1`). The
  projection writes LaTeX source and the `.bib` beside it, and the PDF is that source typeset; a
  person takes either. `.docx` is a second cut with its own writer and reference document.
* **Venues: a generic article and IEEE ship as templates** (`BO_0293_Q2`). The generic article is
  the one-column, numbered-section floor; IEEE is `IEEEtran` with the IEEE CSL that is already the
  default citation style. The two prove the mechanism; every other venue is a template added later.
* **Front matter: properties for the structured part, a block for the abstract** (`BO_0293_Q3`).
  Authors, affiliations, keywords and the venue are properties of `document`; the abstract is a
  block of the new role `abstract`. The Shape above carries it.
* **Figures and tables are numbered, captioned and referable in the document** (`BO_0293_Q4`). A
  caption on `image`, a number on request for images and tables, and a reference run that follows
  the number, on `BO_0290`'s `equationRef` idiom. This is a change of `documents` of its own in the
  graph, and this change depends on it; the manuscript never numbers what the record does not.
* **An execution's output enters as what it is, and its code goes to supplementary material**
  (`BO_0293_Q5`). An image output is a figure and a table output a table, each with a caption whose
  last line names the cell and the revision that produced it. Every code block that produced a
  figure or a table is appended as a supplementary section under that provenance line. Text output
  and tracebacks stay out, and the manuscript says so where a block was left out.
* **Every produced manuscript is kept** (`BO_0293_Q6`). The Shape above carries it: a write, pinned
  to the revision and the venue, listed on the document, downloaded from there.
* **A run may produce and keep a manuscript** (`BO_0293_Q7`). A tool projects the open document at
  its revision for a venue and attaches the result the way a person's export is attached, so a run
  can read the manuscript it is helping to write and check it against the venue's rules. A run's
  manuscript is listed with its process, as an execution's output is, and is never anything but a
  file: it proposes no block and changes no property.

## Transferred

Promoted to draft by the user on 2026-09-23 and transferred the same day.

### The fixed layer, in this repository

- `docs/system/typesetting-service.md`, new: `BO_0293_001`–`BO_0293_005`. The service — Debian's
  own Pandoc and TeX Live on the cell recipe's base, a Python front on `8094` with the bearer, the
  one route taking the AST, the references and the figures and answering the `.tex`, the `.bib`,
  the PDF and the log, the paranoid TeX settings — its compose entry and bearer, the kernel
  forward `/__kernel/typeset/<rest>`, the release recipe and `THIRD-PARTY.md`, and the
  verification on the instance. Read on 2026-09-23: bookworm ships `pandoc 2.17.1.1` and TeX
  Live 2022; Pandoc reads `csljson`, writes `bibtex` and `--natbib` citations. `.docx` stands as
  the open follow-up there.
- `docs/system/ui-kernel.md`, *A Manuscript Out Of The Record*: `BO_0293_006`–`BO_0293_009`. The
  document tools answering the front matter and accepting the `abstract` role, the harness copy,
  the verification, the rebuild; a run proposing front matter as the open follow-up.
- `docs/system/distribution.md`, *Typesetting*: `BO_0293_010` (`release-extensions.json`, the
  Licences enumeration and `THIRD-PARTY.md` naming Pandoc, TeX Live and `IEEEtran`) and
  `BO_0293_011` (the release note).
- `docs/changes/BO_0295_FEAT_figures-and-tables-numbered.md`, new at `idea`: the dependency
  `BO_0293_Q4` named, shaped from `BO_0290`'s idiom with two questions of its own.

### The graph, staged 2026-09-23

- Staged from a checkout at dataRevision 2179 as `node:chg-b5c3a6761d9a71fa` — after two stagings at 2152 and 2174 drifted under concurrent folds of `block-editor.md`, rejected — three files of
  `documents` and nothing else. `block-document-model.md` gains *A Manuscript Out Of The Record*
  with the seven decisions, the extension named and the shape of the `manuscript` node and the
  projection, and `BO_0293_012`, `BO_0293_013` (the `document` widening and the `abstract` role,
  this extension's) and `BO_0293_017`–`BO_0293_024` (the `manuscripts` extension's creation,
  after which `_018`–`_024` move into its own `system.md` in the same proposal: the type, the
  projection, the venues, the make route with the kept manuscript and the downloads, the bar
  control and its panel, the tool and the skill, the walk). `block-editor.md` gains
  `BO_0293_014` and `BO_0293_015` (the abstract drawn and set, and where it stands);
  `document-panel.md` gains `BO_0293_016` (the front matter edited in the panel). Tasks only —
  nothing in the proposal implements anything. Accepted by the user on 2026-09-23, so the graph's docs list the work.
- The change document is not carried into the graph yet: its owner is `manuscripts`, which
  `BO_0293_017` creates, and that task carries the document into the extension's `docs/changes/`
  in the same proposal. Until then the graph lists the work under `documents`.

### Technical decisions taken at transfer

- The extension is `manuscripts` (prefix `MA`, `bundled`, active), its type `manuscript` — the
  plural id beside the singular type, as `documents` and `document` stand, because a declaration
  and a manifest share one node namespace (`BO_0289`'s `sourcecode` lesson).
- A kept manuscript is a root node with no block flag, as a `work` is, its files hoisted top-level
  blob references, written as truth by a person's press and staged in a run's group by the tool.
- The engine is the Debian distribution's own Pandoc and TeX Live rather than an upstream commit
  or a third-party image, so the pin is the base digest and the package set, and the service
  makes no request to the web at all.
- The `.bib` is Pandoc's own conversion of the cited works' CSL-JSON, and the citations are
  `\cite` commands typeset by `bibtex` with the venue's `.bst`, so the LaTeX a venue takes is
  self-contained and the PDF is built from it and nothing else.
- The venues' templates are the extension's data files, copied into the image at build time and
  held equal by a test, so adding a venue is a change of the extension and a rebuild.

## Implemented

Set to ready by the user on 2026-09-23 and implemented the same day, after `BO_0295`.

### The fixed layer, in this repository

- `BO_0293_001`–`BO_0293_004` landed: the typesetting service in `infra/typeset/` (Debian's
  Pandoc 2.17 and TeX Live 2022, 1.31 GB, a Python front on port 8094). Its twelve tests pass
  inside the image, and an IEEE manuscript was read as a page. With it came the compose service,
  its bootstrap bearer, the kernel forward `/__kernel/typeset/`, the release recipe,
  `THIRD-PARTY.md`, the README paragraph and the contract tests. Port 8097, named at transfer, is
  the search service's; 8094 is free.
- `BO_0293_006`–`BO_0293_008` landed: `read_document` answers the front matter, and the
  `abstract` role reaches the run schema through the graph's declaration.
- Open here: `BO_0293_005` and `BO_0293_009` (the stack rebuilt with the service, then the
  instance checks), `BO_0293_010` (`release-extensions.json` once the extension is at the pin),
  `BO_0293_011` (the release note after the walk), and the functional question below.

### The graph, built on BO_0295 and waiting to be staged

- `BO_0293_012`–`BO_0293_022` are implemented in a tree built on `BO_0295`'s staged proposal, and
  stage once that proposal is accepted, since a member holds one open proposal. The work:
  - `documents`: the front matter and `setFrontMatter`, the `abstract` role, the head's fields.
  - The new `manuscripts` extension: the projection, the make and the keeping, the section, the
    page and the bar group.
  - The members: `document`, `text`, the skill and the `manuscript` type.

  The proof:
  - Every touched suite passes one file at a time, `tsc` is clean and the client builds.
  - Two behaviour cases pass under the kernel harness, one making a real IEEE manuscript through
    the real service and keeping it.
  - The integration test posts the fixture's projection to the running service as both venues,
    and both answer `ok`.
- Three placements the transfer named changed at implementation:
  - **The front matter's fields stand in the document's head, not the panel.** The panel's fixed
    line says the inspector contributes no action (`CA_0053`), and the user's answer to
    `BO_0293_Q3` says the front matter is drawn above the first block. The transfer's `*` line
    *set by a person here* misstated that answer and now reads as the user said it.
  - **The venues are the service's own list, answered by its `/health`.** No template copy is
    held equal by a test.
  - **Kept manuscripts are a library category, each opening as its own tab.** The bar's popover
    carries text only, so the file links could not live there.
- The make keeps the manuscript at the dataRevision the read was made at. It does not check the
  document node's base revision, since editing a block does not move that revision.

### Found on the way

- **A run's tool cannot reach the typesetting service as the fixed line says.** A tool's
  callback holds no person's session, and the gate admits a run's grant only on a party's request
  path. `BO_0293_023` waits on the functional question in `typesetting-service.md`. The same
  question stands for `bibliography`'s `propose_work`.
- **`bibliography`'s `addWork` cannot write a work with a hyphenated CSL field.** Fields such as
  `container-title` and `publisher-place` are quoted in backticks, which CCGW's parser refuses
  (`unexpected character '`'`). This is why `works.test.ts` (`BO_0291_032`) is red under the
  harness, and a work fetched from a DOI almost always carries `container-title`. It belongs to
  `BO_0291`; this change's behaviour case leaves the field out and says why.

## Depends On

- `BO_0291` (sources and citations), draft: without citations there is no reference list and no
  style to draw them in. The manuscript projects what `BO_0291_013` numbers and `BO_0291_020`
  renders.
- `BO_0290` (math in documents), wip: equations enter the manuscript as the TeX the block stores.
- `BO_0289` (run code from a document), wip: an execution's output is where a computed figure comes
  from (`BO_0293_Q5`).
- `BO_0295` (figures and tables are numbered), idea: captions on images, numbers on request for
  images and tables, and `figureRef`/`tableRef` runs (`BO_0293_Q4`). A `BO` change rather than
  a `DO` one because the kernel's run schema must name the references, `BO_0290`'s reason; it
  lands first, and the projection reads the numbers it resolves.
- `BO_0294` (the record, not the document): what a manuscript projects is decided there — whether
  the unit a manuscript draws from is one document's blocks or the record around it.
