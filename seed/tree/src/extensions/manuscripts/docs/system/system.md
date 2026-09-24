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
  - Figures, tables and equations are written as LaTeX with labels, and only the ones the
    document numbers carry a numbered caption (`\caption`, `equation`); the rest take
    `\caption*` or `equation*`. LaTeX therefore numbers exactly the blocks the document numbers,
    in the same order, and a reference points at the label.
  - An output's first picture, or failing that an HTML table in its bundle — the shape a data
    frame renders as — enters as a figure or a table whose caption ends *Produced by code cell N
    at revision R.*; the code block that produced one is appended under *Supplementary
    Material*.
  - Left out and said by name in `omitted`: a video, a divider, a picture not made yet or in a
    format TeX does not read, an output with neither picture nor table, code that produced
    neither, a citation of a work the bibliography no longer holds, an equation's caption, and a
    table's rows past the first hundred its file holds. A discarded block and a prompt are not in
    the reading order and say nothing.
- [ ] BO_0296_020 The supplementary code is handed to Pandoc as code, not as raw LaTeX (`server/project.ts`): a `sourcecode` block under *Supplementary Material* becomes a `CodeBlock` carrying its language as a class, in place of the `RawBlock` holding `\begin{lstlisting}` it writes today, so Pandoc's own highlighter sets it in colour. The venues' templates already carry the macros that define those tokens and the service is already proven to build a coloured PDF under `-no-shell-escape` (`calliopa-bootstrap`'s `BO_0296_008`, landed 2026-09-24); this is the half that gives it something to colour. A block with no language becomes a `CodeBlock` with no class, which Pandoc sets plainly rather than refusing. Proven in the projection's own fixture: the AST holds a code block with its language, and no `lstlisting` remains.
- The venues are the service's (`BO_0293_020`, technical decision at implementation,
  2026-09-23). The service's `/health` answers each venue's id and name, and this extension
  offers them from there. The service is the one list, so no copy of a template lives here to
  drift from it; this replaces the copy held equal by a test that the transfer named.
- A manuscript is made and kept (`BO_0293_021`, `server/make.ts`, `server/manuscripts.ts`). `POST
  /api/x/manuscripts/make` with `{document, venue?, branch?}` reads the document as it stands,
  in the tab's branch when it is in one. It reads the cited works from the bibliography, projects,
  reads each figure's bytes from the store and sends all of it through the kernel forward. It
  keeps the answered `manuscript.tex`, `references.bib` and `manuscript.pdf` with `putBlob`, and
  writes one `manuscript` node as the person's truth: `revision` is the dataRevision the read was
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

## Open Work

Transferred from `calliopa-bootstrap`'s `BO_0293` on 2026-09-23 and moved here from
`documents`' [Block Document Model](../../../documents/docs/system/documents/block-document-model.md#a-manuscript-out-of-the-record)
when this extension came into being (`BO_0293_017`).

- [ ] BO_0293_023 The agent holds a tool and a skill: `make_manuscript`, an `ext.tool` `{venue?}` that projects the open document at the run's pin, typesets it through the same path a press takes, stages the `manuscript` node in the run's group with its files, and answers the run the LaTeX source, the log's warnings and what was left out, so the run checks the manuscript against the venue's rules and says so in the document; and a `manuscripts` skill saying when to make one and how to read the answer. Waits for the functional question in `calliopa-bootstrap`'s [Typesetting Service](../../../../../docs/system/typesetting-service.md): a tool's callback holds no person's session, and the gate admits a run's grant on no typesetting path, so how a run reaches the service is the user's to decide.
- [ ] BO_0293_024 The walk, on the dogfood instance served from a pin holding every task above, `BO_0295` and the rebuilt stack with the typesetting service: a document with a title, two authors with affiliations, keywords, an abstract, three sections, a numbered figure with a caption, a table, a numbered equation referred to from a sentence, three citations and a code block whose output is a picture; *Make manuscript* as the generic article and as IEEE — the PDF opening with the head, the numbered figure and table, the equation, the citations as `[1]`–`[3]` and the reference list, the output's picture as a figure with its provenance line and the code under *Supplementary Material*; the `.tex` and `.bib` downloaded and typeset again by hand with `latexmk`; the manuscript listed under *Manuscripts* at its revision; and a video block left out and said so. The run's half joins when `BO_0293_023` lands. Accepted by the user, the faults it found folded here.
