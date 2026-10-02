# Sources Beyond Papers

Status: completed

Part 5 of 5 of `BO_0308`, after `BO_0309`. *Source* is a built-in role, and a source can be
anything that is cited: a web page, an interview, a conversation, a dataset, a piece of software,
an internal document, as well as a paper. This document shapes the change and authorizes no
implementation.

## What Is Asked

* Sources are generalized to cover non-academic sources.
* *Source* is a built-in role (`BO_0308_Q5`).
* The *Sources* category folds into *Roles*, where *Source* lists the sources (`BO_0308_Q11`).
* A source is a document carrying *Source*. It can hold the person's notes, be mentioned and
  carry other roles, and its CSL record is the role's fields. Every existing `work` migrates to such
  a document, and every citation is rewritten to name it, automatically as the release is taken
  (`BO_0312_Q7`). User decision, 2026-09-30 (`BO_0313_Q1`).
* The add form offers paper, book, web page, interview, conversation, dataset, software and report
  up front, and every other CSL type behind *More*. User decision, 2026-09-30 (`BO_0313_Q2`).
* Source documents appear in the Documents category as well as under *Roles → Source*. User
  decision, 2026-09-30 (`BO_0313_Q3`), asked at transfer.

## Where This Starts

- `bibliography` (`BO_0291`): one `work` node per source as CSL-JSON, fetched through the Zotero
  translation server from an identifier or an address, with a PDF blob, cited by a `cite` run and
  rendered by `citeproc-js` in the instance's or the document's style.

## Proposed Shape

- A source is a document carrying *Source*. Its CSL record is exposed as the role's fields, and
  its file as a file field. Every CSL type can be chosen, and the Zotero fetch fills the fields
  wherever there is an identifier or an address. A source without one is typed in through the
  fields.
- Citations name the source document. Every `work` migrates to a document carrying *Source*, and
  every `cite` run is rewritten to name it, so reference lists render unchanged.

## Functional Questions

- None open. `BO_0313_Q1`–`BO_0313_Q3` are answered in What Is Asked; `Q3` came up at transfer.

## Acceptance Examples To Shape At Draft

- Given a web page, a recorded interview and a dataset, each can be added as a source and cited,
  and each appears in the reference list in the document's citation style.
- Given an instance with cited works, after the upgrade every citation resolves to its source
  document, and every reference list reads as before.
- Given the *Roles* category, *Source* lists the sources, and there is no *Sources* icon.

## Boundaries And Source Documents

- Graph: `bibliography`'s `system.md`; `documents`' `block-document-model.md` (the `cite` run,
  the reference list).
- Fixed layer: `docs/system/bibliography-service.md`.
- Owner: `bibliography`. Release note: *Changed*.

## Transferred

Promoted to draft by the user on 2026-09-30 and transferred the same day. One question came up at
transfer and was answered the same day (`BO_0313_Q3`). It builds on `BO_0309` and uses `BO_0312`'s
executable migration.

### The fixed layer, in this repository

- `docs/system/ui-kernel.md`, *Sources Are Documents* (new): `BO_0313_001`, a citation's target a
  document with `record: source`, and the harness copy dropping `work`; `BO_0313_002`,
  verification and the rebuild.
- `docs/system/distribution.md`: `BO_0313_003`, the release line under *Changed*.

### The graph

- Staged from head 3235, which carries the accepted `BO_0312` transfer, as
  `node:chg-9202279d88f3b1f5`: four files, tasks only, zero removals. An earlier staging from head
  3232, `node:chg-6c48640bc5b99d6d`, came before `BO_0312`'s acceptance and would have dropped its
  lines, so it is to be rejected. Both commands are in `docs/changes/scratchpad.md`.
- `bibliography`'s `system.md` gains *Sources Beyond Papers*: the decisions and
  `BO_0313_020`–`_025` (sources as documents, the surfaces, the tools, the migration, verification
  and walk, close).
- `doc-block-roles`: `BO_0313_010`, *Source*'s built-in fields; `BO_0313_011`, a built-in role's
  row carrying its owner's create action.
- `documents`' `block-document-model.md`, *Sources And Citations*: `BO_0313_030`, a citation naming
  a source document, with the Documents listing keeping them.
- `manuscripts`: `BO_0313_040`, the projection reading CSL items from source documents.

### Technical decisions taken at transfer

- `cite: {work, locator?}` keeps its shape, with `work` now naming the source document, so no
  stored run and no run schema breaks.
- A source document carries `record: source` beside the role, so the kernel checks a citation's
  target the way it recognizes a profile, without the roles' vocabulary.
- The document's title is the CSL title. Authors and editors are long text, one *Family, Given* per
  line, as the source page already writes them. `issued` is text, since CSL allows a year alone.
- The fetch keeps a record's own CSL type rather than mapping it to `document`.

## Implementation

Set to wip on 2026-10-01. The graph tasks the transfer staged (`node:chg-9202279d88f3b1f5`) were
never accepted, and by then that staging, from head 3235, would have removed lines other changes
had landed since; it is to be rejected. The implementing proposal carries those sections itself,
folded into truth where the work is done.

- Fixed layer, in this repository: `knownWorks` accepts a source document (`BO_0313_001`) and its
  test (`BO_0313_002`), folded into `ui-kernel.md`, *Sources Are Documents*. Open: the kernel image
  rebuilt before the graph half is accepted and pinned (`BO_0313_002`), and the release line
  (`BO_0313_003`), written once the graph half is accepted.
- The graph, staged as one proposal from `.local/bo313-bundle`: `bibliography` — sources read and
  written as documents, *Add source* with the eight kinds and *More*, *Fill from identifier*,
  *Cited by* at a source's end, the tools and the skill, and the migration
  `migration-bo-0313-sources-are-documents` (`BO_0313_020`–`_023`, `_024` verified but for the
  walk); `doc-block-roles` — *Source*'s release fields and their migration
  `migration-bo-0313-source-fields`, and the row's `+` (`BO_0313_010`, `_011`); `documents` — a
  citation naming a source document, a proposed source accepted with its sentence (`BO_0313_030`);
  `manuscripts` — the projection reading source documents (`BO_0313_040`). Open: the walk
  (`BO_0313_024`), the close (`_025`), the `work` declaration dropped a release later (`_026`), and
  a `@misc` entry's address and DOI in a manuscript's `.bib` (`_041`).
- Technical decisions while implementing: the `work` declaration and the harness's copy stay one
  release, since the migration reads works and an install that has not run it still holds them;
  bibliography's internal names keep *work*, as the citation's key does; *Source*'s row action is
  named by the built-in's fixed id in `doc-block-roles` and drawn only while the owner's kind is
  registered, so the shell's contribution contract is unchanged; a source's bar action is its own
  group, *Source*, beside the view's.

## Walked And Completed

Staged as `node:chg-f168b3c6b29220a8`, accepted and pinned at 3474 on 2026-10-01 after the user
rebuilt the kernel image; serving it, the kernel applied *Source*'s fields at revision 3476 and the
works' migration at 3477, leaving no `work`, four source documents and five citations all naming
them. Walked by the user on the served build the same day: *Roles → Source* and its `+`, a web
page, an interview and a dataset added and cited, IEEE and APA lists, *Fill from identifier* and
*Cited by* — "done, works". The user did not walk the migrated citations ("i don't care about the
old"); they stand verified by the graph read and the behaviour suite. Completed 2026-10-01. Still
open: `BO_0313_026` (the `work` declaration dropped a release later) and `BO_0313_041` (address
and DOI in a `@misc` entry).
