# Sources And Citations

Status: completed

A person keeps the sources they read — papers, books, web pages, reports — in one place, and
cites them from a document. A source arrives from its identifier or its address: a DOI, an ISBN,
an arXiv or PubMed id, or a URL, and its bibliographic record is fetched rather than typed, the
way Zotero fills a record from what it is given. A citation is written into a sentence and drawn
in a citation style; the document's reference list is derived from its citations and never
written by hand. Requested by the user on 2026-09-23, decided, promoted to draft and transferred the same day.
The work is enumerated as `BO_0291_001`–`BO_0291_011` in `docs/system/bibliography-service.md`,
`docs/system/ui-kernel.md` and `docs/system/distribution.md`, and as `BO_0291_012`–`BO_0291_031`
in `documents`' and `ui.shell`'s graph docs. Set ready and taken to wip the same day; the service and its forward are landed
(`BO_0291_001`–`BO_0291_003`, below).

## What Is Asked

- A store of sources, like Zotero's library: a record per source, with its authors, title, year,
  container (journal, book, site), volume, issue, pages, publisher, identifiers and address.
- Referencing a source from a document: a citation in the text, and the reference list it implies.
- Automatic fetching of the bibliographic record from an identifier or an address.

## Decided

User decisions of 2026-09-23, taken on the questions this document first carried.

* **The extension is `bibliography`, its change prefix `BI`, and its side-bar category
  *Sources*.** Its type was to be `source`; it is `work` — decided 2026-09-23 at implementation,
  because a type declaration's node id is `node:<name>` whatever its kind and `node:source` is
  already `relations`' `source` relation type, so the collision was not in prose only. A
  bibliographic work is the cited thing, as Crossref's works API and MLA's *Works Cited* say it;
  the citation run is `cite: {work, locator?}`; the category keeps its name.
* **It is `bundled` and active on a fresh install.** It needs no credential and bills nothing; it
  adds one container to every install, as capture already does.
* **The fetch engine is the Zotero translation server**, run unmodified as a fixed-layer service.
  Hand-written fetchers in the extension's server were the alternative and are declined.
* **One bibliography per instance, shared by its people.** A document is shared by the instance's
  people, and its citations resolve the same for all of them.
* **The default citation style is IEEE**: numbered in citation order, `[3]` in the text. The other
  shipped styles are chosen in Settings.
* **A citation shows its source on hover**: the pointer over `[3]` opens the source's record — its
  authors, title, year, container — as a link, so the reader reaches the source without leaving the
  sentence. The link opens the source's page in the bibliography; where the record carries an
  address (a DOI or URL), that address is offered beside it.
* **A source's own file ships in this change**: the paper's PDF stored as a blob on the source and
  opened from the citation's hover and from the source's page.
* **Importing an existing Zotero, BibTeX or RIS library is the next change**, not this one.
* **A citation is written from a control on the bar and its keyboard shortcut** over the caret or
  the selection, which open a search over the bibliography. No typed trigger in the flow.

User decisions of 2026-09-24, taken on the styles' questions:

* **`citeproc-js` is taken under AGPL-3.0**, of its dual licence, as the stack's other AGPL
  software — SearXNG, Garage, Honcho, the Zotero translation server — is used, unmodified. It is
  named in `THIRD-PARTY.md`'s table for the interface's own dependencies (`BO_0290_021`), with the
  CSL styles under CC-BY-SA-3.0.
* **The style is set per instance with a per-document override**: the owner chooses the default
  in Settings, IEEE on a fresh install, and a document may choose another from its own controls,
  since a text written for a journal needs that journal's style while the rest keep theirs.
* **English only**: the `en-US` CSL locale ships and every reference list uses English terms,
  whatever the document's language.

## What The System Already Holds

Nothing here is new work. These are the parts this change rests on.

- **A block type is an extension's declared vocabulary**, an `ext.blocktype` member enforced by
  Validation, and adding one migrates nothing; a build that predates it draws the block as
  unsupported content and never drops it ([Schema Evolution](../../graph/tree/src/extensions/documents/docs/system/documents/schema-evolution.md)).
  `image`, `video` (`BO_0273`), `table` (`BO_0287`) and the equation (`BO_0290`) are the precedents
  for a type entering with the smallest slice its surface needs.
- **A run may carry an attribute beyond `text` and `marks`.** `link` is the precedent: the core's
  run-shape validation refuses a run without a `text` string and tolerates every other key
  (`internal/validation/run_shape.go`, `BO_0185_001`), and the editing surface already carries a
  run's link as a real element in the flow (`views/editor-dom.ts`). `BO_0290` builds an equation
  reference on the same idiom: a run that draws the referenced thing's *current* number and follows
  it when the numbering shifts.
- **An extension contributes a category to the side bar** — one icon, a sticky band, its own
  kinds and views — as `documents` contributes Documents and `calliopa-refine` Investigations
  ([Contribution Contract](../../graph/tree/docs/system/workspace/contribution-contract.md),
  `CA_0044`). It contributes routes under `/api/x/<ext>/`, decoration places on a document
  (`headline`, `depth`, `below`, `command`) without being the kind's provider, and settings sections.
- **An extension can give the agent tools and teach it.** An `ext.tool` member is listed in the
  kernel toolset; a call posts `{input, run, settings?}` to the extension's `kernelCallback` route
  within a 30-second timeout, and the route answers `{result, stage, conclusion}` — the statements
  of `stage` are staged into the run's group as the run, so a run proposes and never writes
  ([UI Kernel](../system/ui-kernel.md), `BO_0264_007`). `ext.skill` members are read into a run's
  instructions. `calliopa-refine`'s `propose_source` is the precedent for a tool that stages one
  block from what it fetched.
- **A fixed-layer service reached through the kernel is a settled pattern.** Capture and search
  run as their own containers, internal network only, a bearer from the secrets volume, the kernel
  forwarding `/__kernel/<svc>/<rest>` with the bearer added and answering `502` in words when the
  service is down ([Page Capture Service](../system/page-capture-service.md),
  [Search Service](../system/search-service.md)). Search is a third-party server, AGPL-3.0, run
  unmodified as its own container behind a small front that enforces the bearer
  ([Distribution](../system/distribution.md), Recipes And Release Binaries). The
  exposure-boundary tests hold both compose files to the rules.
- **Fetching the web is the fixed layer's, not the shell's.** The capture service refuses private,
  loopback and link-local addresses and the stack's own service names at its own forward proxy,
  and the docs record that the shell's server process fetches nothing from the web any more
  (`BO_0284`). A page read answers `title`, `author`, `publisher`, `publishedAt` from the page's
  meta tags — and nothing bibliographic beyond them: no `citation_*` tags, no DOI.
- **Bytes are solved.** A PDF is a blob behind CCGW, referenced from content by hash, and `read_page`
  already stores a captured page's PDF that way ([Binary Block Content](../system/binary-content.md)).
- **A refinement source is a record of a web page, undeclared.** `calliopa-refine` keeps a captured
  page as a `text` block carrying `url`, `finalUrl`, `title`, `author`, `publisher`, `publishedAt`,
  `retrievedAt` and its blob references, tolerated by Validation as undeclared properties; the
  extension is `individual`, shipped off, and inactive on the dogfood instance. It is the closest
  thing the system holds to a bibliographic record, and it names no identifier a library could key on.
- **The renderer of a document's markup arrives with the first response.** The shell builds an SSR
  bundle, so a citation drawn on the server (`BO_0290`'s idiom for the equation) is on screen before
  any script runs. The tree's `package.json` and `pnpm-lock.yaml` are `ui.shell`'s root-mapped
  members, so a renderer is a dependency of the tree.

## What The System Does Not Hold

- **No bibliographic vocabulary.** No type, property, tool or document anywhere in the graph or
  this repository names a DOI, an ISBN, a citation or a bibliography. `relations` has `supports`
  and `evidences` between text blocks and no `cites`.
- **No reference from a document to a node outside it.** `documents`' own model says so: *surfacing
  one block from several documents would need a distinct non-structural reference relation; no
  change has introduced one*. A run's `link` is a plain string. So a citation is the first thing in
  a document that points at a node the document does not contain.
- **No fetch of a bibliographic record.** Capture reads the tags a news page carries; a DOI
  resolves nowhere; an ISBN means nothing; a publisher's page with `citation_*` tags is read as
  prose.
- **No citation style.** Nothing typesets an author-year or numbered citation, and nothing carries
  a CSL style.

## The Shape

Mutable, and the starting point for the transfer if the user takes the recommendations below.

### The store

- A new extension owns the vocabulary and the surfaces; the fetch runs in the fixed layer. It is a
  `BO` change because it spans the two: the service, its compose entry, its kernel forward and the
  release file are the fixed layer's, and the extension is a graph subtree, so the graph half stands
  as a change document of the extension at the same status.
- One bibliography per instance, shared by its people: a root node the extension declares, holding
  `source` blocks, listed as one category in the side bar — *Sources* — with search over author,
  title, year and tag. A source has an identity of its own that survives its edits, which is what a
  citation anchors on.
- A `source` block requires `kind` and `title`. Its `kind` is a permitted value from the CSL types
  the fetch can answer (`article-journal`, `book`, `chapter`, `paper-conference`, `thesis`,
  `report`, `webpage`, `dataset`, `software`, and a few more, closed at draft). It permits the
  record's fields in CSL-JSON shape — `author`, `editor`, `issued`, `container-title`, `volume`,
  `issue`, `page`, `publisher`, `DOI`, `ISBN`, `URL`, `accessed`, `abstract` — plus `tags`, and one
  `fetched` object saying what answered the record, when, and from which identifier. CSL-JSON is
  the shape a DOI resolves to, the shape the fetch engine exports, and the shape a citation
  processor consumes, so there is one record and no translation between the three.
- A person adds a source, edits its fields and retires it as a human content write, through the
  same path a block edit takes; a run proposes one and a person answers. The identifier is the
  identity for duplicates: a DOI, ISBN or URL the bibliography already holds adds nothing and shows
  the existing source instead.
- A source may carry its own file: one PDF, uploaded from the source's page or dropped onto it,
  stored as a blob behind CCGW and referenced from the block by hash, as a captured page's PDF is
  today ([Binary Block Content](../system/binary-content.md)). It permits `file` — the blob
  reference and its `mediaType` — and is opened from the source's page and from a citation's hover.
  A fetched record never brings the file; the file is the person's, uploaded by hand.

### The fetch

- **The Zotero translation server, run unmodified as a fixed-layer service** — the engine behind
  Zotero's own *add by identifier* and browser connector. It answers a DOI, ISBN, PMID or arXiv id
  (`/search`) and a URL (`/web`) with bibliographic items through its translator corpus — hundreds
  of publishers, catalogues and sites, and embedded metadata (`citation_*`, Dublin Core, Open Graph,
  schema.org) for a page no translator knows — and it converts between formats (`/export`,
  `/import`: CSL-JSON, BibTeX, RIS). AGPL-3.0, like SearXNG, so the Licences and `THIRD-PARTY.md`
  rules already have a shape for it. Endpoints, image and licence are verified against the
  project's own README at draft, not from memory.
- It sits where capture and search sit: its own container, internal network only, no port, a
  bearer from the secrets volume, the kernel forwarding `/__kernel/bibliography/<rest>` with the
  bearer added. It fetches arbitrary addresses on request, so it takes the same private-address
  refusal capture enforces, at a small front of its own, and the same caps. The exposure-boundary
  tests learn the service.
- The extension's server route asks the kernel forward, converts the answer to CSL-JSON, and
  offers the record for a person to confirm — the fields filled, editable before the write. A URL
  that answers several items (a search result, a table of contents) shows the choice. Nothing bills,
  so nothing waits for a second press.
- **The alternative, named to be declined:** hand-written fetchers in the extension's server — DOI
  content negotiation, OpenLibrary for an ISBN, and capture's page read for a URL. Smaller, no new
  container, and far weaker on URLs, which is most of what a person adds; it also puts web fetching
  back into the shell's server, which `BO_0284` moved out.

### The citation

- A citation is a run attribute in a text block, `cite`, the way `link` is: the source's block id
  and an optional locator (`p. 12`). It is drawn typeset on the server in the chosen style —
  `[3]`, or `[3, p. 12]` with a locator, in IEEE — as `BO_0290` draws an equation reference, and it
  follows the source's record and the style, so a corrected author name or a changed style redraws
  every citation with no write. Numbers run in first-citation order over the document, so a source
  cited twice keeps its number.
- The pointer over a citation opens the source's record as a link: authors, title, year and
  container, opening the source's page in the bibliography, with its DOI or URL beside it when the
  record carries one and its PDF when the source holds one. The hover is the reading path from a
  sentence to what it rests on; the reference list is the printed one. Authored from a control on the bar and a shortcut over the caret or the
  selection, which opens a search over the bibliography; a source not yet held can be fetched from
  there in the same gesture.
- The document's reference list is derived from its citations in reading order, drawn after the
  last block in the style, never stored. A source cited nowhere is in the bibliography and in no
  list.
- *Cited by* is a read the source's page answers: the documents whose blocks carry a citation of
  it. Whether that read is a query over run attributes or a `cites` edge the write path maintains
  beside the attribute is a technical decision at draft; what a person sees is the same.
- The style is a Settings choice of the extension, from a shipped set of CSL styles — IEEE by
  default, with APA and Chicago author-date beside it; a notes style waits for a footnote surface.
  The processor is citeproc-js, a dependency of the tree like MathJax.

### The agent

- Two tools: `propose_source`, which fetches through the service and stages one `source` block
  from an identifier or a URL — refusing one the bibliography already holds, as refinement's tool
  refuses a repeated URL — and `read_sources`, which answers the bibliography's records for a run
  drafting a citation. A run's `propose_document_changes` carries `cite` in a run as it carries
  `link`, so a proposed sentence can cite. A skill says when to cite and to fetch rather than draft
  a record.

## Transferred

Promoted to draft by the user on 2026-09-23 and transferred the same day.

### The fixed layer, in this repository

- `docs/system/bibliography-service.md`, new: `BO_0291_001`–`BO_0291_005`. The service — the
  engine's image pinned by digest, a front enforcing the bearer and the four routes, a forward
  proxy carrying capture's address rule that the engine is pointed at through `HTTP_PROXY` — its
  compose entry and bearer, the kernel forward `/__kernel/bibliography/<rest>`, the release recipe
  and `THIRD-PARTY.md`, and the verification on the instance. The engine's endpoints, image and
  licence were verified against its repository on 2026-09-23: `/web`, `/search`, `/export` (with
  `csljson` among its formats) and `/import`; `zotero/translation-server` on 1969; AGPL-3.0.
- `docs/system/ui-kernel.md`, *Sources And Citations*: `BO_0291_006`–`BO_0291_009`. The `cite`
  run in the tools' schema, the derived number on every read, the refusals, the verification, the
  image rebuild.
- `docs/system/distribution.md`: `BO_0291_010` (`release-extensions.json`, the Licences
  enumeration, ordered after `BO_0288_009` and `BO_0289_017`) and `BO_0291_011` (the release
  note), the recipe line beside the code image's, and a line under Licences saying `citeproc-js`
  is dual-licensed CPAL-1.0 or AGPL-3.0 and the CSL styles CC-BY-SA-3.0, so `BO_0290_021`'s
  decision on `THIRD-PARTY.md` is taken with both in view.

### The graph, staged 2026-09-23

- Staged from a checkout at dataRevision 2037 (rebased after the first staging at 2034 drifted) as `node:chg-a784dd695fde00c6`, four files and
  nothing else. `documents`' `block-document-model.md` gains *Sources And Citations* with the six
  fixed decisions and `BO_0291_012`–`BO_0291_023`: the `cite` run primitive, the derived number,
  the extension's creation (`_014`, after which `_015`–`_023` move into its own `system.md` in the
  same proposal), the `source` declaration, the write path with its duplicate rule, the fetch
  route, the PDF, the Sources category, the style setting and the citation route, the two tools
  and the skill, the `structure` convention, and *cited by*. `block-editor.md` gains the same
  section with `BO_0291_024`–`BO_0291_028`: the bar control, the drawn citation, the hover, the
  reference list, the walk. `ui.shell`'s `foundation/runtime.md` gains `BO_0291_029`
  (`citeproc-js` and the styles) and `workspace/contribution-contract.md` `BO_0291_030` (a
  citation resolver slot) and `BO_0291_031` (a document-end place). Tasks only — nothing in the
  proposal implements anything. Accepted by the user on 2026-09-23, so the graph's docs list the
  work.
- The change document is not carried into the graph yet: its owner is `bibliography`, which
  `BO_0291_014` creates, and that task carries the document into the extension's `docs/changes/`
  in the same proposal. Until then the graph lists the work under `documents`.

### Technical decisions taken at transfer

- A `source` is a root block with no parent, and the bibliography is every `source` of the
  instance; no container type is declared, since nothing would go in it but the sources.
- The `cite` run has empty text, `equationRef`'s shape, so the label is derived and stored nowhere;
  the number is resolved in the read by `documents` and the kernel alike, and the styled label and
  the entries by the bibliography through a contract slot, so a citation keeps its number when the
  extension is switched off.
- The address rule is enforced at a forward proxy the engine is pointed at through
  `HTTP_PROXY`/`HTTPS_PROXY`, because the engine follows redirects and translators fetch on their
  own; a check at the entry alone would miss both.

## The Service Landed

- 2026-09-23, `BO_0291_001`–`BO_0291_003` in `docs/system/bibliography-service.md`. The engine
  answers records from the real web through the built image; the compose entries, the bootstrap
  bearer, the boundary and topology tests, and the kernel forward with its tests are in.
- **The published image could not be used.** `zotero/translation-server` on Docker Hub is arm64
  alone since 2.0.6 (2025-01); amd64 stopped at 2.0.4 (2021). The service builds the engine from
  its repository at a pinned commit instead — master of 2026-07-31 and the four submodule commits
  it records — unmodified, with the front starting `node src/server.js` rather than the image's
  entrypoint, which pulls the translators' master at every start. This is a technical decision:
  the user's decision was the engine and that it runs unmodified as its own container, which
  holds; what changed is the pin, from a digest to commits.
- The address rule holds at the proxy as designed: the engine's HTTP client honours
  `HTTP_PROXY`/`HTTPS_PROXY`, and a redirect to a loopback address was dropped in verification.
- Uncommitted in the repository: `infra/bibliography/`, the two compose files,
  `cmd/bootstrap/main.go`, `internal/storage/bootstrap_bibliography_secrets*.go`,
  `internal/kernel/serve/{bibliography.go,bibliography_test.go,serve.go,proxy.go,callback_test.go}`,
  `cmd/kernel/serve.go`, the two boundary tests, and these docs.
- The service runs on the dogfood instance since 2026-09-23 (the user rebuilt the stack); the
  bearer pairing, a DOI, the refusals and the session gate are verified there, and `BO_0291_005`
  now names only the run's tool path, which waits on `BO_0291_021`.
- Left in this change: `BO_0291_005` (the run path, after the
  extension's tool exists),
  the release lines `BO_0291_010`–`_011`, and the whole graph half `BO_0291_012`–`_031`.

## The Kernel's Citation Half Landed

- 2026-09-23, `BO_0291_006`–`BO_0291_008` in `docs/system/ui-kernel.md`, *Sources And Citations*:
  `agenttools/citations.go` with the run schema's `cite`, the refusals, the look-up of the cited
  works at the pin and the derived numbering; `citations_test.go` over a real CCGW; the harness
  fixture's `work` declaration. `BO_0291_009`, the kernel image rebuild, was run by the user the same day; the served binary carries the citation half.
- **The type is `work`, not `source`** (Decided, above). The graph tasks accepted at transfer read
  `source` — `documents`' `BO_0291_015`–`_023` and the editor's — and are corrected in the proposal
  that creates the extension (`BO_0291_014`), the first that touches them; the wording of a
  citation run there becomes `cite: {work, locator?}`.
- Uncommitted in the repository: `internal/kernel/agenttools/{citations.go,citations_test.go,documents.go,equations.go}`,
  `internal/kernel/serve/testdata/documents-vocabulary.json`,
  `internal/kernel/serve/vocabulary_absence_verification_test.go`, and these docs.

## The Release Recipe Landed

- 2026-09-23, `BO_0291_004` in `docs/system/distribution.md`, Recipes And Release Binaries:
  `distribution/build/bibliography/Dockerfile` (the dogfood one, Node base by digest), the copy
  lines in `scripts/release-distribution.sh`, the rows in `distribution/THIRD-PARTY.md`, the
  paragraph in `distribution/README.md`, and the topology checks. The pinned recipe built from the
  copied sources. Two licence facts worth the user's eye: the translators repository's
  `package.json` declares CC0-1.0 while each translator file carries an AGPL-3.0 licence block,
  and `zotero-schema` carries no licence file; the notice says both as they are.
- Left in this repository: `BO_0291_005` (the run path, after the extension's tool exists),
  `BO_0291_010` and `BO_0291_011` (the release file, the Licences enumeration and the release
  note, which wait for the extension to exist). The graph half `BO_0291_012`–`_031` is next.

## The Graph Half Begins

- 2026-09-23, `BO_0291_012` and `BO_0291_013`, staged from a checkout at dataRevision 2097 as
  `node:chg-df0d3f55da9a7fff`, seven files: `lib/runs.ts` gains the `cite` atom
  (`{work, locator?}`, kept without text, never joined, whole on either side of every edit, part
  of what two run lists mean, refused by `readRuns` in six ways) with its tests; `assemble.ts`
  gains `numberCitations` and the view's `citationNumbers` and `missingWorks`; `documents.ts`
  reads the cited identities at the pin in one label-free rooted match before assembling;
  `vocabulary.ts` names the `work` type; `server/citation-number.test.ts` proves the numbering;
  and `block-document-model.md` carries the two tasks as truth, with the `work` decision. On the
  host: `tsc` clean, 853 of 856 lib and documents tests pass; the three failures pre-exist at head
  (two left stale by the `code` type, one timing case in `never-waits.test.ts`) and fail on a
  pristine copy of the same checkout.
- Tests run on the host from `.local/tree-bo0291` with `.local/tree-0290y`'s `node_modules`
  linked in, never inside the kernel container, which broad suites have OOM-killed before.

## The Extension Exists

- 2026-09-23, `BO_0291_014`, staged from a checkout at dataRevision 2103 as
  `node:chg-48a804c6eb5a05a3`, five files: `src/extensions/bibliography/manifest.json`
  (`bundled`, depending on `documents` and `ui.shell`, `ccgwScopes` query and propose, no
  entrypoint, the shape `test` stands in and the registry scan accepts); its
  `docs/system/system.md` with the purpose, the decisions — the type as `work` — the `BI` prefix,
  the release-note obligation of a bundled extension, and `BO_0291_015`–`BO_0291_023` moved in
  from `documents` and renamed throughout (`work`, `addWork`, `propose_work`, `read_works`,
  `/works/[id]/…`); this change document carried into its `docs/changes/` at `Status: wip`; and
  `documents`' two docs corrected — the creation as truth, the nine tasks replaced by a pointer,
  `source` as a type gone from the section, *source* kept where it is the person's word.
- From here the graph copy of this document follows every status the change takes, in the
  proposal that carries the code, as The Docs In The Graph requires.
- The extension is created by `kernel commit` rather than from the Extensions section, which is
  a human-class write an agent cannot make, exactly as `relations` was.

## The Type Is Declared

- 2026-09-23, `BO_0291_015`, staged from a checkout at dataRevision 2109 as
  `node:chg-c4ab61e92fac3dcc`: one extension member — the `work` `ext.blocktype` of
  `bibliography`, through the members sidecar `kernel commit --members` folds into the change set,
  as `equation` and `table` were declared — and the task folded to truth in the extension's
  `system.md`. The declaration requires `id`, `title` and `kind`, permits the eleven CSL types for
  `kind` through `permittedValues` as `relation` permits its kinds, permits the CSL-JSON fields,
  `tags`, `fetched` and `file`, carries no block flag, and says in its semantics why the name is
  `work`. The kernel harness's copy carries the same `permittedValues` from now on.

## The Extension's First Server Code

- 2026-09-23, `BO_0291_016` and `BO_0291_017`, staged from a checkout at dataRevision 2113 as
  `node:chg-48a7c4979272d04d`, eleven files: `lib/work.ts` (the record's shape, the identifier
  normalization, the CSL mapping), `server/works.ts` (`listWorks`, `readWork`, `addWork` with the
  duplicate refusal, `reviseWork` against a base, `retireWork`), `server/api.ts` (the commands
  route under `withBranch`), `server/fetch.ts` (the fetch through the kernel forward with the
  `300` round trip), `contributions.server.ts` (`commands`, `works`, `fetch`), the manifest
  naming the entrypoint, three unit test files (11 tests), the behaviour suite
  `tests/behavior/works.test.ts`, and the extension's `system.md` with the two tasks folded.
  On the host: `tsc` clean, the extension's unit tests green, `vite build` green, the registry
  scan listing the extension with its server half.
- The behaviour suite is written and skipped where the graph environment is absent; a truth write
  needs the human seat, so its first run is the user's under the harness. `BO_0291_032` in the
  extension's `system.md` says so rather than claiming a run that did not happen.

## The First Surface

- 2026-09-23, `BO_0291_018` and `BO_0291_019`, staged from a checkout at dataRevision 2136 as
  `node:chg-29591e41509e73fe`, eleven files: `contributions.ts` (the Sources section under the
  `books` icon, the `work` kind with its view), `views/sources/section.tsx` (the listing, the
  search, the *Add source* form with the record to confirm and a page's candidates to choose
  from), `views/work.tsx` (the record's fields editable and saved against the base, the file kept,
  opened or dropped, the fetched mark, retirement), `views/record-form.ts` with its test (the form
  and the record each way, the row's words, the search), `views/bibliography.css` (tokens only),
  the file routes and the section reader in `contributions.server.ts`, `setWorkFile` in
  `server/works.ts`, the `books` icon in the shell's icon table (Phosphor 2.1.1, the path as
  published), the manifest rendering views, and the doc with the two tasks folded. `tsc` clean,
  15 unit tests green, the tree built, the theme-token check's one failure being `documents`'
  own stylesheet as before. Accepted and served from pin 2139 on 2026-09-23, the registry listing
  `bibliography` active; the surface is the user's to look at, and a fault they find is folded
  into the extension's doc.
- A first staging of the same work, `node:chg-f47d57ece0f0c05d`, was made against a container
  checkout that had vanished under it and so reads as eleven files added against dataRevision 0.
  It is wrong and is to be rejected; the second staging above replaces it, rebased on head 2136,
  which had gained an `equals` icon since the checkout the work was made in.

## Citing From The Editor

- 2026-09-23, `BO_0291_024` and `BO_0291_025`, staged from a checkout at dataRevision 2168 (rebased twice as the editor file moved under it) as
  `node:chg-0525e72f3d9389bf`, seven files in `documents`: the bar's *Cite* toggle with its
  search field and choice of the bibliography's works, Ctrl/Cmd+Alt+C, and `makeCitation$`
  writing the atom after the caret or the selection (`block-editor.tsx`); the citation drawn in
  reading (`block-text.tsx`) and in the editing surface (`editor-dom.ts`) from the read's numbers,
  `[3]`, `[3, p. 12]`, *[source gone]*, `[…]` until numbered (`lib/citation-label.ts`); the
  stylesheet; a test; and the two tasks folded into `block-editor.md`. The user asked *how do I
  reference it in the text?* after adding a source, which is why these came before the style
  work. Rebased twice as the editor file moved under the checkout. `tsc` clean, the documents
  view suites green but for the known timing case, the tree built. Accepted and served from pin
  2179 on 2026-09-23.
- **Walk findings, fixed 2026-09-23.** The user reported *pressing cite worked only once*, then
  *still nothing happens when I click cite*. Two causes, found by reproducing the press in the
  render harness (`views/cite-control.test.ts`, which presses Cite, chooses a work, presses again
  and chooses the same work again): the bar re-renders only for the editor fields it tracks by
  name, and the Cite state was not among them, so a press changed the state and drew nothing —
  the real cause, fixed as `node:chg-f89ea036cf1bc25a` from head 2201; and the *Source* choice is
  a native select firing only on change, reused between openings, so the same work chosen twice
  fired nothing — fixed first as `node:chg-ce01e250e66b5c37` with a fresh choice per opening,
  which was right but not the whole story. Both stand in `block-editor.md`'s `BO_0291_024` line.
- **A finding for `BO_0290`, not fixed here.** The editing surface counts an atom's text towards
  the DOM's offsets: an equation reference is painted with its number as a text node, so every
  caret position after one is off by the label's length. The citation draws its label from an
  attribute through a `::before` rule for that reason. The equation reference should take the
  same shape when its authoring path lands.

## The Source Chooser Is A Popover

- User decision, 2026-09-23, after citing worked: *make the source selection a popover*. Staged
  from head 2227 as `node:chg-11deb65132490450` (a first staging from 2209 drifted on the doc), five files in `documents`: `views/cite-popover.tsx`,
  a panel beneath the block being edited with a search field focused on opening and the works as
  buttons, reading the works itself, closed by Escape, a press outside or the bar's control; the
  bar keeps its Cite toggle and loses the field and the choice; the editor's state keeps `citing`
  and the opening count and loses the works it no longer holds; the stylesheet, tokens only; the
  harness test presses Cite, chooses, presses again and chooses the same source, narrows by the
  search and closes with Escape; and `block-editor.md`'s `BO_0291_024` line now says the popover.
  `tsc` clean, 53 editor tests green, the tree built.

## The Chooser Hangs Off The Bar

- User decision, 2026-09-23, revising the same day's popover: *the panel should open directly
  below the cite button in the toolbar*. The bar is the shell's, and its `popover` action kind
  held read-only lines, so the shell's vocabulary widens by one slot — `body: { component,
  props? }`, a body of the view's own drawn inside the panel the shell places under the control,
  with a `close$` of the shell's — as `BO_0291_033`, a `ui.shell` task added at implementation
  and folded into `docs/system/workspace/layout.md` in the same proposal. `documents`' Cite
  becomes that action with the source chooser as its body; the editor holds no citing state
  any more, and Ctrl/Cmd+Alt+C presses the control. Staged from head 2246 (rebased after 2239 aged) as
  `node:chg-41ce55212a79331d`, nine files across `ui.shell` (the bridge type, `inspector.tsx`,
  `view-bar.test.ts`, `layout.md`) and `documents` (the body, the editor, its stylesheet, its
  test, `block-editor.md`). `tsc` clean, 63 tests green across the shell's bar and the editor,
  the tree built. Rebuilt twice from the saved edit scripts as the checkouts aged; accepted and
  served on 2026-09-23.

## The Reader's Side

- 2026-09-23, `BO_0291_026` (but for the locator's editing, split out as `BO_0291_034`),
  `BO_0291_027` and `ui.shell`'s `BO_0291_031`, staged from head 2264 as
  `node:chg-ee2b24a8aa3fb90d`, twenty files. The shell's contract gains a document place, `end`,
  drawn once after a document's last block; the bibliography answers a `references` route from
  `documents`' own read — the cited works in number order with their entries and what a hover
  card shows — and draws *References* there; `documents` reads the same route into a context and
  gives each citation in reading a card: the work, *Open source*, its DOI or address, its PDF, the
  locator. The entries are IEEE written by hand (`lib/ieee.ts`) until `BO_0291_020` brings
  `citeproc-js`. The harness now records the targets a view opens. `tsc` clean; 952 of 953 tests
  across lib, documents, bibliography and the shell's bar, the one failure the known timing case;
  the theme check's one refusal is the equation popover's own shadow; the tree built.

- `BO_0291_034`, 2026-09-23, staged from head 2278 as `node:chg-1f886549021ab8cc`, five files in
  `documents`: pressing a citation while editing opens a locator panel over it, the equation
  popover's idiom; Done, Enter or Escape save, an empty field clears. The panel does not take
  focus as it opens — in the harness a panel reaching for focus looped with the editing surface,
  which takes focus back on every repaint, and ran the test out of memory. `tsc` clean, 304 of 305
  documents view and bibliography tests, the known timing case the one failure, the tree built.

## The Agent Cites

- 2026-09-23. `BO_0291_021` as planned could not work: an extension's callback carries no session
  and the kernel's service surfaces admit no run grant (`BO_0284_005`), so a tool cannot fetch
  through `/__kernel/bibliography`. The user chose a kernel-owned tool: `BO_0291_035`,
  `fetch_record`, added and landed in this repository (`agenttools/fetch_record.go`,
  `serve/bibliography.go`), the service document's constraint corrected. The extension's half —
  `propose_work`, `read_works`, the `citing` skill and their callback route — is staged from head
  2281 as `node:chg-ddbc11ceb2263aee`, six files and four members.
- **A bug found on the way, fixed in the same proposal.** The dialect has no quoted identifiers,
  so a work carrying `container-title` or `publisher-place` could never be written: `addWork`
  refused every journal article and every book with a place, and only an arXiv preprint had been
  added. The two fields are stored as `containerTitle` and `publisherPlace`, mapped at the write
  and the read, and the `work` declaration and the harness fixture permit the stored names.
- Uncommitted in the repository: `internal/kernel/agenttools/{fetch_record.go,fetch_record_test.go,server.go,server_test.go}`,
  `internal/kernel/serve/{bibliography.go,bibliography_test.go,serve.go}`, the fixture, and these
  docs. Accepted, the kernel rebuilt and pin 2283 served on 2026-09-23.

## Citations Read `[…]`

- The user reported on 2026-09-24, in the document *Greenland*, that a citation *only ever puts
  […] in there*. Two causes: a save writes a block and reads nothing back, so a newly cited work
  had no number until a full read; and a proposed sentence drew its citations as nothing. Beneath
  both, a run's proposed works were stranded: a work is not a block of the document, so the user
  accepted the sentences and never saw the works, and an accepted citation pointed at a work
  still a proposal. The user decided that accepting a sentence accepts the works it cites that its
  own group proposes (`BO_0291_036`). Fixed in `documents` — the refresh after a save, the numbers
  in the shared context, the in-place relabel, numbered proposals, and the accept — staged from
  head 2406 as `node:chg-43a24e2060b4bdc9` after a first staging drifted. The stranded data was
  repaired by the user accepting the run's remaining proposal, which established both works.
  Accepted and served from pin 2414; the user confirmed on 2026-09-24 that Greenland's citations
  are numbered and its references drawn. The same run verified `BO_0291_005`: both works came
  through `fetch_record`, the run's record naming the bibliography twice.

## Styles Through The Processor

- 2026-09-24, `BO_0291_029`, `BO_0291_030` and `BO_0291_020`, built in one checkout of
  dataRevision 2428. `citeproc` 2.4.63 joined the tree's `package.json` and lockfile, and the
  IEEE, APA and Chicago author-date styles with the `en-US` locale joined the bibliography under
  `csl/`, pinned at the Citation Style Language repositories' commits `8947960d` (styles) and
  `a89adece` (locales). The hand-written IEEE formatter went: IEEE through the processor writes
  the entries its tests pinned. `ui.shell` gained the citation resolver slot, one per instance,
  and `documents`' read asks it, so a citation's label arrives with the document in the chosen
  style. The owner chooses the instance's style in the bibliography's Settings section. The
  typecheck, the bibliography's, `documents`' citation and the registry's tests, and both builds
  are clean; the processor is in the server bundle and in no client chunk. The document's own
  style is `BO_0291_037`, below. The CSL files travel in the seed, which the opening of
  `THIRD-PARTY.md` does not cover; that is the user's question, `BO_0291_038` in
  `docs/system/distribution.md`.

## A Document Chooses Its Style

- 2026-09-24, `BO_0291_037`, built in a checkout of dataRevision 2437 after the user accepted the
  styles (`node:chg-50798e6f0de56c54`). `document` permits `citationStyle`, the shipped styles'
  ids, widened as a member revision; `documents`' `setCitationStyle` writes it or clears it; the
  read asks the resolver in it; and the bar's *Document* group offers *Citation style* while the
  document cites anything. The resolver's answer names the styles, so `documents` holds no list
  of them beyond the declaration's permitted set. The bibliography's works behaviour case paced
  its revise past the kernel's 250 ms write floor, which it had tripped. The shell's behaviour
  suite over a scratch CCGW passes the new case; the five failures it still reports fail
  identically on an unchanged checkout of head 2437 and belong to other changes. Accepted as
  `node:chg-724a4929f50485bb` and served with the styles from pin 2456; the user confirmed on
  2026-09-24 that the instance's style and a document's own style both redraw the citations and
  the reference list. That covers the style step of the walk, `BO_0291_028`, and not the
  other steps.

## Cited By, And The Skill Names A Citation

- 2026-09-24, `BO_0291_022` and `BO_0291_023`, built in a checkout of dataRevision 2460. The
  documents skill's `structure` convention now names a citation as a run carrying `cite` with
  empty text, as the bibliography's own skill does. *Cited by* is a query over runs, not a
  maintained edge: one read of every document's contained text blocks, filtered in
  `documents`' `server/cited-by.ts`, answered by the bibliography's `works/[id]/cited-by` route
  and drawn on the work's page, each citing document pressed to open it. Its unit tests and a
  behaviour case over a scratch CCGW pass. The suite's other failures are the ones head already
  has. Accepted as `node:chg-78e1ce091d3bc4e6`, served from pin 2464; the user confirmed on
  2026-09-24 that a work's page lists the documents citing it.
- `BO_0291_032` closed the same day: `tests/behavior/works.test.ts` ran green twice under the
  kernel harness, `TestShellDocumentsOverCCGW`, whose scratch CCGW signs in its fixture human, so
  a truth write needs no seat of the user's. Its first runs had tripped the kernel's write floor,
  which the `BO_0291_037` staging fixed.

## The Styles Are Fetched, Not Carried

- 2026-09-24, `BO_0291_038`, the user's answer to the licence question: the CSL styles and locale
  are fetched when the interface is built, and the seed carries none. They are two pnpm
  dependencies, `csl-styles` and `csl-locales`, naming the Citation Style Language repositories'
  GitHub tarballs at the commits pinned before, with their integrity in the lockfile, so
  `THIRD-PARTY.md` lists them in the table of what the interface's install fetches and its
  opening stays true unchanged. The fetched files are byte-identical to the carried ones. A
  frozen-lockfile install passes pnpm's supply-chain policy, and the typecheck, the
  bibliography's tests and both builds are clean. The cost is the styles tarball, 6.5 MB,
  unpacking every style of the project for the three used, and a build reaching
  `codeload.github.com` beside the npm registry.

## The Walk

- 2026-09-24, `BO_0291_028`, on the dogfood instance at pin 2472. The user walked the steps not
  confirmed before — a source added from a DOI and one from an address with their records
  filled, the same DOI shown as the source already held, a PDF attached and opened from a
  citation's card, a cited source retired and its citation saying so, and the extension switched
  off with the numbers staying — and confirmed them. Earlier walks had confirmed citing and its
  numbers, the reference list, a run's cited sentence and its works, both styles and a
  document's own style, and *Cited by*. Nothing the walk found needed a fix.

## The Release Carries It

- 2026-09-24, `BO_0291_010` and `BO_0291_011`. Both task lines had been lost from
  `docs/system/distribution.md` in the `BO_0276` commit, most likely a concurrent write of an
  older copy; they were restored, then landed: `release-extensions.json` ships `bibliography`,
  the *next release ships* line names eleven extensions, and `docs/release-notes/unreleased.md`
  carries one *Added* line for the service and the extension. It had become owed twice:
  `manuscripts` (`BO_0293`) depends on `bibliography`, so a cut failed until the file answered
  for it. `releaseextensions check` holds against a current checkout: eleven shipped.

## Not Here

Each its own change once this one stands.

- Importing a Zotero, BibTeX or RIS library, and exporting the bibliography.
- Refinement's captured pages becoming sources: `calliopa-refine`'s undeclared source record is a
  `webpage` in the vocabulary above, and a reach could add what it finds to the bibliography.
  Refinement is `individual` and inactive, so the mapping waits.
- A `cites` relation as a person's declared relation in `relations`, with a reason, once
  `BO_0288` gives relations a surface.
- Citing a passage: a citation that carries the cited page's captured text at the locator.
- A typed trigger for a citation in the flow, converting as it lands, if the bar control proves
  too slow in use.
- Footnote citation styles, once a document has a footnote surface.

## Depends On

- Nothing blocking. `BO_0290` (math in documents) is the sibling precedent for a run attribute
  drawn on the server and a derived reference; if both land, the second takes the first's editor
  idiom for an inline object as given.
- `BO_0288` (`relations`) and `BO_0289` (`code`) are each adding an entry to
  `release-extensions.json` and a line to the Licences enumeration; this change adds a third and
  a service beside `BO_0289`'s, so the transfer orders the shared lines after theirs.
