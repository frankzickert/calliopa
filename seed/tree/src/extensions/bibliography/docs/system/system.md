# Bibliography

## Purpose

- This document is the entry point of `bibliography`, the extension that keeps the sources a
  person cites — a paper, a book, a web page, an interview, a conversation, a dataset, a piece of
  software, a report, anything CSL names — and lets a document cite them: a source is a document
  carrying the built-in *Source*, its record fetched from a DOI, an ISBN, a PMID, an arXiv id or a
  URL where there is one and typed where there is none, a citation written into a sentence and
  drawn in a citation style, and the reference list derived from a document's citations. It is
  Zotero's shape inside Calliopa (`calliopa-bootstrap`'s `BO_0291`, requested and decided by the
  user on 2026-09-23), with sources made documents by `calliopa-bootstrap`'s `BO_0313`.
- It is `bundled` and active on a fresh install: it needs no credential and bills nothing, and it
  adds one container to every install — the [Bibliography Service](../../../../../docs/system/bibliography-service.md),
  the Zotero translation server behind a front the kernel forwards to, which is the fixed layer's
  because fetching the web is the fixed layer's.
- It depends on `documents`, whose `text` runs carry the citation, whose editor draws it and whose
  documents a source is; on `doc-block-roles`, whose built-in *Source* a source carries and whose
  fields hold its record; and on `ui.shell`, whose frame it contributes into and whose run library
  holds the `cite` atom. It draws no library category: a source is listed under *Roles → Source*
  and among the documents. The manifest names the entrypoint `contributions`, with a client half
  and a server half.
- Its change documents carry the prefix `BI`. A `BI` change that alters what a release ships
  writes its line in the repository's `docs/release-notes/unreleased.md`, as every change of a
  `bundled` extension does (`distribution.md`, Release Notes).

## What This Extension Holds

* A source covers non-academic sources as well as papers. *Source* is a built-in role, and the
  *Sources* category folds into *Roles*, where *Source* lists the sources (`BO_0308_Q5`,
  `BO_0308_Q11`). User decisions.
* A source is a document carrying *Source*. It can hold the person's notes, be mentioned and carry
  other roles, and its CSL record is the role's fields (`BO_0313_Q1`). User decision, 2026-09-30.
* Source documents appear in the Documents category as well as under *Roles → Source*
  (`BO_0313_Q3`). User decision, 2026-09-30.
* The add form offers paper, book, web page, interview, conversation, dataset, software and report
  up front, and every other CSL type behind *More* (`BO_0313_Q2`). User decision, 2026-09-30.
* One set of sources per instance, shared by its people, so a shared document's citations resolve
  the same for everyone. User decision, 2026-09-23.
* The record is fetched by the Zotero translation server, a fixed-layer service, from a DOI, an
  ISBN, a PMID, an arXiv id or a URL. User decision, 2026-09-23.
* The default citation style is IEEE, `[3]` in the text, numbered in first-citation order; the
  other shipped styles are chosen in Settings. A citation shows its source on hover, as a link.
  User decisions, 2026-09-23.
* A source may carry its own file, in *Source*'s *File* field. User decisions, 2026-09-23 and
  2026-09-30 (`BO_0313_Q1`).
* Importing a Zotero, BibTeX or RIS library is the next change, not this one. User decision,
  2026-09-23.
* The style is set per instance with a per-document override: the owner's default in Settings,
  IEEE on a fresh install, and a document may choose another. User decision, 2026-09-24.
* English only: the `en-US` CSL locale ships and every reference list uses English terms. User
  decision, 2026-09-24.
* `citeproc-js` is taken under AGPL-3.0 of its dual licence, used unmodified. User decision,
  2026-09-24.
- A source document is a `document` carrying `record: source` beside *Source*, so the kernel checks
  a citation's target the way it recognizes a profile, without the roles' vocabulary
  (`calliopa-bootstrap`'s `ui-kernel.md`, *Sources Are Documents*). Its title is the CSL title;
  *Source*'s release fields hold the rest (`doc-block-roles`' `BO_0313_010`): *Kind* (every CSL
  type), *Authors* and *Editors* (one *Family, Given* per line, a line without a comma an
  institution), *Issued* and *Accessed* (text: a year, a year and month, a date, or words, since
  CSL allows a year alone), *Container*, *Volume*, *Issue*, *Pages*, *Publisher*, *Place*, *DOI*,
  *ISBN*, *URL*, *Abstract*, *Tags* (separated by commas), *File* and *Fetched* (what answered the
  record, by whom and when, as one line). `lib/work.ts`'s `fieldsOfRecord` and `recordOfSource`
  map a CSL-JSON record to the fields and back, judged by `readWorkRecord`, so the record the
  citation processor consumes, the fetch exports and the fields hold is one record. Technical
  decisions at transfer, 2026-09-30.
- The identifier is the identity for duplicates: a DOI, an ISBN or a URL a source already holds
  adds nothing and names the existing source instead. A source added by a person is a human
  content write; a run proposes one and a person answers.
- A citation is `documents`' run attribute `cite: {work, locator?}`, `work` naming the source
  document, an atom with no text of its own, numbered in the document read and never stored with a
  number ([Block Document Model](../../../documents/docs/system/documents/block-document-model.md#sources-and-citations),
  `BO_0291_012`, `BO_0291_013`, `BO_0313_030`). The key keeps the name `work`: renaming it would
  break every stored run and the run schema for no reader's gain (technical decision at transfer,
  2026-09-30). This extension answers what a citation is drawn as — the in-text label and the
  reference-list entry in the chosen style — and *cited by*; `documents` draws the label where the
  citation sits and the bare number when this extension is off.
- The names in code keep *work* — `WorkView`, `listWorks`, the `/works` routes, `propose_work`,
  `read_works` — since a citation's run says `work`; a `workId` is the source document's identity.

## Open Work

Transferred from `calliopa-bootstrap`'s `BO_0291` on 2026-09-23 and moved here from `documents`'
[Block Document Model](../../../documents/docs/system/documents/block-document-model.md#sources-and-citations)
when this extension came into being (`BO_0291_014`), with the type renamed from `source` to `work`
as decided. The editor's half — the bar control, the drawn citation, the hover, the reference list
and the walk — is `documents`' `BO_0291_024`–`BO_0291_028` ([Block Editor View](../../../documents/docs/system/documents/block-editor.md#sources-and-citations));
the tree's dependency and the two contract slots are `ui.shell`'s `BO_0291_029`–`BO_0291_031`.
Nothing here is claimed, and each is small enough for one session.

- The `work` type stays declared for one release (`BO_0291_015`, `BO_0313_023`): an `ext.blocktype`
  member of this extension, read only by the migration below, its semantics saying so; nothing
  writes a `work` any more. It permits the two names its hyphenated CSL fields were stored under,
  `containerTitle` and `publisherPlace`, the Cypher dialect having no quoted identifiers, and the
  migration reads them through `lib/work.ts`'s `storedKey`. The kernel harness's copy
  (`calliopa-bootstrap`'s `serve/testdata/documents-vocabulary.json`) declares the same, and the
  two leave together (`BO_0313_026`).
- Sources are read and written as documents (`BO_0291_016`, `BO_0313_020`, landed 2026-10-01;
  `server/works.ts`, `server/api.ts`). `listWorks` reads every `document` carrying `record: source`
  at the pin and, rooted at them, the `roleFields` *Source* holds on each, one read each, and
  composes each source's record from its title and those values; `readWork` reads one, refusing a
  document that is no source as `unknownWork`. `addWork`, on this extension's command route
  `POST /api/x/bibliography/commands` scoped by the shared `withBranch`, writes one script —
  `sourceStatements`: the document with its title and `record: source`, an empty paragraph for
  the person's notes, *Source* taken and its values with the file's live blob reference hoisted
  into `files` — established as the person's truth, staged in the tab's branch. It reads the
  record through `readWorkRecord` and refuses a DOI, an ISBN or a URL a source already holds by
  naming it and its title (`duplicateWork`), the identifiers normalized (`doi.org` prefixes and
  case off a DOI, hyphens off an ISBN, the fragment and a trailing slash off a URL). `fillWork`
  writes a fetched record over the title and the fields it holds, keeping the rest, against the
  base revision the caller read, a stale base answering a `conflict`. A source's fields are
  otherwise edited in the inspector, as every role's are, and it is deleted as the document it
  is. `GET /api/x/bibliography/works` lists the sources and `GET .../works/[id]` reads one. Every
  CSL type is a kind (`WORK_KINDS`, `doc-block-roles`' `CSL_TYPES`).
- The works suite runs under the kernel harness, `TestShellDocumentsOverCCGW`, whose scratch CCGW
  signs in its fixture human, so the truth writes it makes need no one's seat (`BO_0291_032`). It
  waits past the kernel's 250 ms write floor between writes of the same node.
- The record is fetched (`BO_0291_017`, landed 2026-09-23; `server/fetch.ts`, `POST
  /api/x/bibliography/fetch`): an `input` is read as an address when it starts with `http`, else
  as an identifier with a `doi:` prefix dropped; the route asks the kernel forward
  `/__kernel/bibliography/search` or `/web` as `text/plain`, converts the engine's items through
  `/export?format=csljson`, and answers `{outcome: "record", record, others}` — CSL's `type` read
  as `kind` and kept as the record's own (`BO_0313`), only a type CSL does not name read as
  `document`, the engine's key dropped, `fetched`
  naming the engine, the time and the input — or `{outcome: "candidates", url, session, items}`
  when the engine answered `300`, which the surface offers and posts back as a `selection` to the
  same route, or `{outcome: "refused", detail}` in the service's own words (`422`). Nothing bills,
  so nothing waits for a second press. Proven in `server/fetch.test.ts` with the service stood in
  for by a transport the test hands in — the paths, bodies and content types as the front expects
  them, the `300` round trip, the three refusals — the front and the engine themselves having
  been proven live in `calliopa-bootstrap`'s `bibliography-service.md`; the live press through
  this route is the walk's (`documents`' `BO_0291_028`).
- A source carries its file in *Source*'s *File* (`BO_0291_018`, `BO_0313_021`): chosen in the
  inspector's field, uploaded through `documents`' blob route as every role's file is, and kept
  alive by the reference `roleFields` holds in `files`. `GET /api/x/bibliography/works/[id]/file`
  streams it back typed as its media type and `inline` under its name, immutable, since the
  generic blob route answers every object as octet-stream; the cite card's file link reads it. A fetched record never brings the
  file, and a fill keeps it.
- The surfaces (`BO_0291_019`, `BO_0313_021`, landed 2026-10-01; `contributions.ts`,
  `views/new-source.tsx`, `views/source.tsx`, `views/record-form.ts`, `views/bibliography.css`).
  This extension contributes no library category. *Roles → Source*'s `+` (`doc-block-roles`'
  `BO_0313_011`) opens the kind `bibliography:new-source`, *Add source*: the eight kinds up front
  as pressable choices — *Paper*, *Book*, *Web page*, *Interview*, *Conversation*, *Dataset*,
  *Software*, *Report* (`FRONT_KINDS`, `kindWords`) — and *More*, a list of every other CSL type
  by a readable name; a DOI, an ISBN, an arXiv id or a link fetched through `BO_0291_017`'s
  route to fill the fields, or the candidates a page listed to choose from, or the refusal in the
  route's words; and the fields typed for a source with neither — title, authors one per line as
  *Family, Given*, date, container, publisher, place, volume, issue, pages, DOI, ISBN, URL.
  *Add source* writes it through `addWork` and opens it as the document it is, its body for notes
  and its fields in the inspector (`doc-block-roles`, `BO_0309`). On a source document,
  `SourceProvider` puts *Fill from identifier* in the bar as its own group, *Source*, opening a
  line above the first block that fetches and writes through `fillWork`, then has the editor read
  the document again; and the document's `end` place draws, after the reference list, *Cited by*.
  The citation control's search reads the sources through the `works` route. The form's two-way
  mapping, the row's words and the search are proven in `views/record-form.test.ts`.
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
  sources' CSL-JSON, every CSL type rendered as its own: an item per source in the document's citation order — IEEE numbers by it, APA
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
- The agent holds two tools and a skill (`BO_0291_021`, `BO_0313_022`; `server/tools.ts`, the
  kernel callback route `kernel/tools/[tool]`, the members `bibliography.propose_work`,
  `bibliography.read_works` and `bibliography.citing`). A run fetches a record with `fetch_record`,
  the kernel's own tool and the one path a run has to the bibliography service — the service's
  surface admits no run grant and this extension's callback carries no session (user decision,
  2026-09-23; `calliopa-bootstrap`'s `BO_0291_035`). `propose_work` takes the CSL-JSON item
  `fetch_record` answered, of any CSL type, or a source's own record, refuses one already here at
  the run's pin by naming it, and answers one statement — the source document, its paragraph,
  *Source* and its values, `sourceStatements` without a status — that the kernel stages into the
  run's group, never truth; the `workId` it answers is the document's. `read_works` answers the
  source documents at the pin — identity, line, record but for the abstract, whether a file is
  held — narrowed by an optional query, with a note saying how a citation is written. The skill
  says a source is a document of any CSL type whose body may hold the person's notes, to cite by a
  `cite` run with empty text naming the source document, to read before citing, to fetch rather
  than draft a record, and to give a locator only where a long source is cited for one place.
  Proven in `server/tools.test.ts`; `documents` accepts a proposed source with the sentence citing
  it (`BO_0313_030`).

- The documents skill names a citation (`BO_0291_022`, landed 2026-09-24): `ui.shell.documents`'
  `structure` convention says, beside a link, inline mathematics and the references, that a
  citation is a run of its sentence carrying `cite` — the work's identity and an optional
  locator — with empty text, never a bracketed number or an author and year typed into the words,
  and that `read_document` answers its number, how it reads being the document's style. It
  agrees with this extension's `bibliography.citing` skill, which says how to find the source. A
  member revision staged with this change's code.
- *Cited by* is read (`BO_0291_023`, an `end` place since `BO_0313_021`): `GET
  /api/x/bibliography/works/[id]/cited-by` answers, through `documents`' `documentsCiting`, the
  documents whose reading order holds a citation of the source in title order, each with its
  citing blocks in the document's order and their words, shortened to 160 characters, and refuses
  a document that is no source. It is a query over the runs of every contained text block, one
  read at the pin, rather than a maintained `cites` edge (`documents`' block document model).
  `CitedBy`, drawn at a source document's end after its reference list, lists each document's
  title, pressed to open it, and the words of its citing blocks, or *No document cites this
  source.*; on a document that is no source it draws nothing.
## Sources Beyond Papers

Under `calliopa-bootstrap`'s `BO_0313` (`docs/changes/BO_0313_FEAT_sources-beyond-papers.md`,
part 5 of `BO_0308`, promoted to draft by the user on 2026-09-30, transferred the same day and set
ready by the user): a source is a document carrying the built-in *Source*, of any CSL type, and
the *Sources* category folds into *Roles*. It follows `BO_0309`, and its migration takes
`BO_0312_001`'s executable path. The kernel's half is `ui-kernel.md`, *Sources Are Documents*;
`doc-block-roles` holds *Source*'s fields and the row's `+` (`BO_0313_010`, `BO_0313_011`),
`documents` the citation of a source document (`BO_0313_030`), and `manuscripts` the projection
(`BO_0313_040`). The decisions are in *What This Extension Holds* above, and the lines above are
what is served.

- Every `work` becomes a source document (`BO_0313_023`, landed 2026-10-01;
  `server/migrations.ts`, the member `migration-bo-0313-sources-are-documents`, route
  `kernel/migrations/sources-are-documents`, `after` `doc-block-roles`'
  `migration-bo-0313-source-fields`). The route reads every established `work` under the names it
  was stored by — a record that no longer reads keeps its title and a kind CSL names — and every
  established `text` block whose runs cite one, and answers one script: each work as a source
  document (`sourceStatements`, its file moved to *File*), each `cite` run naming a work rewritten
  to name its document with its locator kept, and each work retired. The kernel writes it as one
  truth change set under the owner when it serves the pin carrying the member, once per instance,
  as the release is taken (`BO_0312_Q7`); an instance without works answers an empty statement.
  A citation staged in a proposal still open is not rewritten: it is no established block, and
  answering it after the migration draws it as missing. The `work` declaration stays one release
  (`BO_0313_026`).
- Verified (`BO_0313_024`, 2026-10-01): `lib/work.test.ts` — the record to *Source*'s fields and
  back, a source typed by hand, a date as text, the eight kinds up front by name and every CSL
  type a kind, a record's own CSL type kept by the fetch; `server/api.test.ts` — adding and
  filling parsed, retiring refused as no command of this extension; `server/tools.test.ts` — an
  interview's and a blog post's own type kept, the staged source document's seven statements
  without a status, every alias a plain identifier; `server/migrations.test.ts` — a work read
  under its stored names, citations renamed with their locators, one script creating and
  retiring, nothing on an instance without works; and `tests/behavior/works.test.ts` under the
  kernel harness — a web page, an interview and a dataset added as source documents carrying
  *Source*, listed among the documents and under *Source*, the duplicate refused by name, a fill
  conflicting on a stale base and keeping what the record does not hold, a document citing all
  three numbered 1, 2, 3 and listed in IEEE and APA, and the migration making a cited `work` a
  source document, its citation named and its reference list reading as before.
- Served and walked (`BO_0313_024`, 2026-10-01): accepted and pinned at 3474; the kernel applied
  `migration-bo-0313-source-fields` at revision 3476 and `migration-bo-0313-sources-are-documents`
  at 3477, after which the dogfood instance held no `work`, four source documents with their fields
  filled from the records, and five citations, every one naming a source document. The user walked
  the served build: *Roles → Source* and its `+`, a web page, an interview and a dataset added and
  cited, the IEEE and APA lists, *Fill from identifier* and *Cited by*. The migrated citations were
  not walked; the graph read and the behaviour suite stand for them.
- [ ] BO_0313_026 A release after `BO_0313`, once every install has run the migration: the `work`
      declaration dropped with an `ext.migration` naming it, the kernel harness's vocabulary copy
      dropping it in step (`calliopa-bootstrap`'s `BO_0313_001`), and `WORK_TYPE`, `storedKey` and
      the migration's reading of a work removed with it.
