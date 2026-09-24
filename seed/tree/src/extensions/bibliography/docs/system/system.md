# Bibliography

## Purpose

- This document is the entry point of `bibliography`, the extension that keeps the sources a
  person reads — papers, books, pages, reports — as one bibliography per instance and lets a
  document cite them: a `work` per source, its record fetched from a DOI, an ISBN, a PMID, an
  arXiv id or a URL rather than typed, a citation written into a sentence and drawn in a citation
  style, and the reference list derived from a document's citations. It is Zotero's shape inside
  Calliopa (`calliopa-bootstrap`'s `BO_0291`, requested and decided by the user on 2026-09-23).
- It is `bundled` and active on a fresh install: it needs no credential and bills nothing, and it
  adds one container to every install — the [Bibliography Service](../../../../../docs/system/bibliography-service.md),
  the Zotero translation server behind a front the kernel forwards to, which is the fixed layer's
  because fetching the web is the fixed layer's.
- It depends on `documents`, whose `text` runs carry the citation and whose editor draws it, and
  on `ui.shell`, whose frame it contributes into and whose run library holds the `cite` atom. It
  draws the Sources category and a work's page (`BO_0291_019`); the manifest names the entrypoint
  `contributions`, with a client half and a server half.
- Its change documents carry the prefix `BI`. A `BI` change that alters what a release ships
  writes its line in the repository's `docs/release-notes/unreleased.md`, as every change of a
  `bundled` extension does (`distribution.md`, Release Notes).

## What This Extension Holds

* The type is `work` — a bibliographic work, the cited thing, as Crossref's works API and MLA's
  *Works Cited* say it — not `source`: a type declaration's node id is `node:<name>` whatever its
  kind, and `node:source` is already `relations`' `source` relation type. The side-bar category
  keeps the name *Sources*, since that is what a person calls them. User decision, 2026-09-23.
* One bibliography per instance, shared by its people, so a shared document's citations resolve
  the same for everyone. User decision, 2026-09-23.
* The record is fetched by the Zotero translation server, a fixed-layer service, from a DOI, an
  ISBN, a PMID, an arXiv id or a URL. User decision, 2026-09-23.
* The default citation style is IEEE, `[3]` in the text, numbered in first-citation order; the
  other shipped styles are chosen in Settings. A citation shows its work on hover, as a link.
  User decisions, 2026-09-23.
* A work may carry its own file, the paper's PDF, stored as a blob on the work. User decision,
  2026-09-23.
* Importing a Zotero, BibTeX or RIS library is the next change, not this one. User decision,
  2026-09-23.
* The style is set per instance with a per-document override: the owner's default in Settings,
  IEEE on a fresh install, and a document may choose another. User decision, 2026-09-24.
* English only: the `en-US` CSL locale ships and every reference list uses English terms. User
  decision, 2026-09-24.
* `citeproc-js` is taken under AGPL-3.0 of its dual licence, used unmodified. User decision,
  2026-09-24.
- A work's record is stored in CSL-JSON shape — the shape a DOI resolves to, the shape the engine
  exports and the shape the citation processor consumes, so there is one record and no translation
  between the three. `kind` is a permitted value from the CSL types the fetch can answer; `title`
  is required; the record's fields are permitted by name. A work is a root node with no parent and
  no block flag, so it is never offered among the kinds a document's block may take.
- The identifier is the identity for duplicates: a DOI, an ISBN or a URL the bibliography already
  holds adds nothing and shows the existing work instead. A work added by a person is a human
  content write; a run proposes one and a person answers.
- A citation is `documents`' run attribute `cite: {work, locator?}`, an atom with no text of its
  own, numbered in the document read and never stored with a number ([Block Document Model](../../../documents/docs/system/documents/block-document-model.md#sources-and-citations),
  `BO_0291_012`, `BO_0291_013`). This extension answers what a citation is drawn as — the in-text
  label and the reference-list entry in the chosen style — and *cited by*; `documents` draws the
  label where the citation sits and the bare number when this extension is off.

## Open Work

Transferred from `calliopa-bootstrap`'s `BO_0291` on 2026-09-23 and moved here from `documents`'
[Block Document Model](../../../documents/docs/system/documents/block-document-model.md#sources-and-citations)
when this extension came into being (`BO_0291_014`), with the type renamed from `source` to `work`
as decided. The editor's half — the bar control, the drawn citation, the hover, the reference list
and the walk — is `documents`' `BO_0291_024`–`BO_0291_028` ([Block Editor View](../../../documents/docs/system/documents/block-editor.md#sources-and-citations));
the tree's dependency and the two contract slots are `ui.shell`'s `BO_0291_029`–`BO_0291_031`.
Nothing here is claimed, and each is small enough for one session.

- The `work` type is declared (`BO_0291_015`, 2026-09-23): an `ext.blocktype` member of this extension staged through `kernel commit --members`, a root node with no parent and no block flag — so it is never offered among the kinds a document's block may take — requiring `id`, `title` and `kind`, `kind` permitted from `article-journal`, `book`, `chapter`, `paper-conference`, `thesis`, `report`, `webpage`, `post`, `dataset`, `software` and `document`, and permitting `author`, `editor`, `issued`, `container-title`, `volume`, `issue`, `page`, `publisher`, `publisher-place`, `DOI`, `ISBN`, `URL`, `accessed`, `abstract`, `tags`, `fetched` (what answered the record, when, from which identifier) and `file` (the PDF's blob reference with its `mediaType`); its semantics name CSL-JSON as the shape and say why the name is `work`. The kernel harness's copy (`calliopa-bootstrap`'s `serve/testdata/documents-vocabulary.json`) declares the same, and the two must stay in step.
- A work is written like a block (`BO_0291_016`, landed 2026-09-23; `server/works.ts`,
  `server/api.ts`, `contributions.server.ts`): `addWork`, `reviseWork` and `retireWork` on this
  extension's own commands route `POST /api/x/bibliography/commands`, scoped by the shared
  `withBranch` so a tab in a branch stages rather than establishes, a human content write through
  the depth as every content write is. `addWork` reads the record through `lib/work.ts`'s
  `readWorkRecord` — `title` and a permitted `kind` required, every other field by name and in
  its CSL shape, nothing else — and refuses a DOI, an ISBN or a URL the bibliography already
  holds by naming the existing work and its title (`duplicateWork`), the identifiers normalized
  (`doi.org` prefixes and case off a DOI, hyphens off an ISBN, the fragment and a trailing slash
  off a URL); `reviseWork` sets every permitted field by property against the base revision the
  caller read, a stale base answering a `conflict`; `retireWork` is a `RETIRE` against the base,
  after which the work's citations draw as missing. `GET /api/x/bibliography/works` lists the
  bibliography, one query at the pin, as `listWorks` does for the duplicate check. The manifest
  now names the entrypoint `contributions` and renders routes. Proven: the record's reading, the
  identity and the parser in `lib/work.test.ts` and `server/api.test.ts`; the writes in
  `tests/behavior/works.test.ts`, which adds, refuses the duplicate, conflicts on a stale base,
  revises and retires over the one graph.
- The works suite runs green (`BO_0291_032`, 2026-09-24): `tests/behavior/works.test.ts` under the
  kernel harness, `TestShellDocumentsOverCCGW`, whose scratch CCGW signs in its fixture human, so
  the truth writes it makes need no one's seat. It waits past the kernel's 250 ms write floor
  between writes of the same work.
- The record is fetched (`BO_0291_017`, landed 2026-09-23; `server/fetch.ts`, `POST
  /api/x/bibliography/fetch`): an `input` is read as an address when it starts with `http`, else
  as an identifier with a `doi:` prefix dropped; the route asks the kernel forward
  `/__kernel/bibliography/search` or `/web` as `text/plain`, converts the engine's items through
  `/export?format=csljson`, and answers `{outcome: "record", record, others}` — CSL's `type` read
  as `kind`, a type outside the permitted set as `document`, the engine's key dropped, `fetched`
  naming the engine, the time and the input — or `{outcome: "candidates", url, session, items}`
  when the engine answered `300`, which the surface offers and posts back as a `selection` to the
  same route, or `{outcome: "refused", detail}` in the service's own words (`422`). Nothing bills,
  so nothing waits for a second press. Proven in `server/fetch.test.ts` with the service stood in
  for by a transport the test hands in — the paths, bodies and content types as the front expects
  them, the `300` round trip, the three refusals — the front and the engine themselves having
  been proven live in `calliopa-bootstrap`'s `bibliography-service.md`; the live press through
  this route is the walk's (`documents`' `BO_0291_028`).
- A work carries its file (`BO_0291_018`, landed 2026-09-23; `contributions.server.ts`,
  `server/works.ts` `setWorkFile`): a PDF chosen on the work's page goes `POST
  /api/x/bibliography/works/[id]/file` as the request body with its name in `x-calliopa-filename`
  and the base revision the page read in `x-calliopa-base-revision` — through this origin, as a
  table's file does, since the browser cannot reach `PUT /v1/blobs` — is stored with `putBlob`
  (a PDF only, 64 MiB at most) and set on the work as `file`, the core's blob reference with its
  media type, size and filename, by property against the base; `DELETE` on the same route drops
  it; `GET` streams it back typed `application/pdf` and `inline` under its name, immutable, the
  way `calliopa-refine` serves a captured page's PDF, since the generic blob route answers every
  object as octet-stream. A fetched record never brings the file.
- The Sources category (`BO_0291_019`, landed 2026-09-23; `contributions.ts`,
  `views/sources/section.tsx`, `views/work.tsx`, `views/record-form.ts`, `views/bibliography.css`):
  this extension contributes one section, *Sources*, under the `books` icon (added to the shell's
  icon table from Phosphor 2.1.1), as a component section whose reader answers every work of the
  instance; it draws each work as its title with who and when beneath, a search over authors,
  title, year, container, tags and DOI matching every word typed, and the section's `+`, which
  toggles the *Add source* form — the Investigations section's idiom — asking for a DOI, an ISBN,
  an arXiv id or a link; submitting fetches through `BO_0291_017`'s route and shows the record to
  confirm, or the candidates a page listed to choose from, or the refusal in the route's words;
  confirming writes the work as truth through `addWork` and opens its tab. The `work` kind and its
  view, *Source*: the record's fields editable — title, kind by name, year, authors and editors
  one per line as *Family, Given*, container, volume, issue, pages, publisher, place, DOI, ISBN,
  URL, abstract, tags — saved whole with `reviseWork` against the revision the page read, with
  the fetched mark and the file carried over; the file kept, opened or dropped; where the record
  came from; *Cited by*; and *Retire this source*, after which the tab is told its target is
  gone. The manifest renders routes and views. Proven: the form's two-way
  mapping, the row's words and the search in `views/record-form.test.ts`; `tsc` clean and the
  tree built; the surface itself has not been drawn on the instance yet — that is the walk's
  (`documents`' `BO_0291_028`), and a fault it finds is folded here.
- A document's references are answered (`BO_0291_026`, `BO_0291_027`, 2026-09-23;
  `server/references.ts`, `GET /api/x/bibliography/references?document=`): the document's cited
  works in the order `documents`' own read numbers them — this extension calls `readDocument`,
  since it depends on `documents` — each with its entry in the document's style, the line *who
  (year) — title*, its DOI or address and whether it holds a file, and the cited works not at the
  pin. `documents` reads it for a citation's hover card and this extension's `ReferenceList`,
  contributed to the document's `end` place, draws the list from it. Proven in
  `server/references.test.ts`.
- Citations and references are set in a style (`BO_0291_020`, landed 2026-09-24;
  `lib/styles.ts`, `server/render.ts`, `server/style.ts`, `views/settings.tsx`). The shipped
  styles are IEEE, APA and Chicago author-date (`STYLES`), rendered on the server by `citeproc-js`
  with the style files and the `en-US` locale of the `csl-styles` and `csl-locales` packages, fetched at build (`ui.shell`'s `BO_0291_029`) from the
  works' CSL-JSON: an item per work in the document's citation order — IEEE numbers by it, APA
  and Chicago list by author — and a cluster per citation, its locator read as a person writes it
  (`p. 54`, `pp. 3–5`, `§ 2`, `ch. 4`, `fig. 3`, a bare number as a page, anything else as a
  suffix). A numeric style lists its entries in citation order, each beside its label; the others
  list by author with no label and a hanging indent. Italics survive from citeproc's markup into
  the entry's segments; nothing else of its HTML does.
- The instance's default style is the owner's choice in this extension's Settings section,
  *Citations*, kept in the extension's `kernelState` settings record and read by anyone signed in
  (`GET /api/x/bibliography/settings`, `PUT` by the owner; IEEE when nothing is set). The
  `references` route answers in it, and `documents` draws each citation's in-text label from this
  extension's citation resolver (`ui.shell`'s `BO_0291_030`, `labelsFor`), so a citation in
  reading, in the editing surface and on a proposal reads `[1]` under IEEE and
  `(Kucsko & Maurer, 2013, p. 54)` under APA. Labels travel with the document read rather than
  through a route of their own. A document's own choice overrides the default for it
  (`BO_0291_037`): the style is the first shipped one of the route's asked style, the document's
  `citationStyle` and the instance's default (`styleFor`), so a choice no longer shipped falls
  back rather than failing the read. Proven in `server/render.test.ts` and `server/references.test.ts`.
- A document chooses its citation style (`BO_0291_037`, landed 2026-09-24): the resolver's answer
  names the style applied, the instance's default and every shipped style by id and name
  (`stylesAnswer`, `ui.shell`'s `CitationStyles`), so `documents` offers them without holding a
  list of styles itself — `documents`' `setCitationStyle` writes the choice, and its bar draws it
  (`documents`' block editor, *A document's citation style*). Proven in `lib/styles.test.ts`.
- The agent holds two tools and a skill (`BO_0291_021`, landed 2026-09-23; `server/tools.ts`, the
  kernel callback route `kernel/tools/[tool]`, the members `bibliography.propose_work`,
  `bibliography.read_works` and `bibliography.citing`). A run fetches a record with `fetch_record`,
  the kernel's own tool and the one path a run has to the bibliography service — the service's
  surface admits no run grant and this extension's callback carries no session, so the transfer's
  plan of a callback asking the forward could not work (user decision, 2026-09-23;
  `calliopa-bootstrap`'s `BO_0291_035`). `propose_work` takes the CSL-JSON item `fetch_record`
  answered, or a work's own record, refuses one the bibliography holds at the run's pin by naming
  it, and answers the statement the kernel stages into the run's group, never truth.
  `read_works` answers the works at the pin — identity, line, record but for the abstract, whether
  a file is held — narrowed by an optional query, with a note saying how a citation is written.
  The skill says to cite by a `cite` run with empty text, to read before citing, to fetch rather
  than draft a record, and to give a locator only where a long work is cited for one place.
  Proven in `server/tools.test.ts`; the run's path through the kernel on the instance is
  `calliopa-bootstrap`'s `BO_0291_005`.
- A work's two hyphenated CSL fields are stored as `containerTitle` and `publisherPlace` (found
  2026-09-23 while writing `propose_work`): the Cypher dialect has no quoted identifiers, so
  `container-title` cannot be a property name and `addWork` refused any record carrying a
  container or a place with a parse error — the one work then on the instance, an arXiv preprint,
  carried neither. `lib/work.ts`'s `storedKey` maps them at the write and the read, the record
  keeping CSL's own keys everywhere between, and the `work` declaration permits the two stored
  names beside the old ones, a widening. Proven in `server/tools.test.ts`: every pair a work is
  written as is a plain identifier.
- The documents skill names a citation (`BO_0291_022`, landed 2026-09-24): `ui.shell.documents`'
  `structure` convention says, beside a link, inline mathematics and the references, that a
  citation is a run of its sentence carrying `cite` — the work's identity and an optional
  locator — with empty text, never a bracketed number or an author and year typed into the words,
  and that `read_document` answers its number, how it reads being the document's style. It
  agrees with this extension's `bibliography.citing` skill, which says how to find the work. A
  member revision staged with this change's code.
- *Cited by* is read (`BO_0291_023`, landed 2026-09-24): `GET /api/x/bibliography/works/[id]/cited-by`
  answers, through `documents`' `documentsCiting`, the documents whose reading order holds a
  citation of the work in title order, each with its citing blocks in the document's order and
  their words, shortened to 160 characters. It is a query over the runs of every contained text
  block, one read at the pin, rather than a maintained `cites` edge (`documents`' block document
  model). The work's page draws *Cited by* beneath the file: each document's title, pressed to
  open it, and the words of its citing blocks, or *No document cites this source.*
