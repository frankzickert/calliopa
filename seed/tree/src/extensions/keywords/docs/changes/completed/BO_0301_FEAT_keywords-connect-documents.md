# Keywords Connect Documents

Status: completed

Requested: 2026-09-25. A person marks some documents as keywords — *Quantum computing* — and from
then on every place the words of a block say *quantum computing*, or *quantum computers*, is
connected to that document: the reader follows the mention to the keyword, the keyword knows where
it is mentioned, a run reads the keyword's definition before it writes about it, and a manuscript
carries the keywords it mentions as its glossary. A keyword document is a document with a role
(`BO_0299`), and what a keyword holds — its definition, what it is, its other names — is the roles
its blocks and its focused-work children carry. This document shapes the change; it authorizes no
implementation.

## What Is Asked

* A person marks a document as a keyword. Marking is giving it a document role, through
  `doc-block-roles` (`BO_0299`); no second way of saying *this document is a keyword* is
  introduced. The request is the user's, 2026-09-25.
* Which document role means *keyword* is a choice the person makes in the extension's own
  section, over the role catalogue, kept as the extension's setting; the same for the role that
  means *definition* and the role that means *alias*. Roles have no fixed names and no starter
  role ships (`BO_0299_Q1`), so the extension never looks for a role by name. User decision,
  2026-09-25 (`BO_0301_Q2`).
* A mention of a keyword in the words of a block is connected to the keyword document without
  the person doing anything at the mention: writing *quantum computing* in a paragraph is enough.
* Matching is English, and it follows three rules in order. First, the title in every inflection
  wins: *quantum computers* and *quantum computer's* reach *Quantum computer*, and *quantum
  computing* never does, since *computing* and *computer* are different words — the hardware and
  the domain stay two keywords. Second, the keyword's aliases, in every inflection, the same way.
  Third, and only where the first two reach nothing, the full stem: *quantum computation* reaches
  *Quantum computing* by the stem it shares. User decision, 2026-09-25 (`BO_0301_Q3`).
* A keyword carries aliases in this change, as a block role: each line of a block carrying the
  role the person named as the alias role is one more name the keyword answers to — *QC*, *quantum
  computation*. User decision, 2026-09-25 (`BO_0301_Q4`).
* A keyword's definition — what the hover shows and a run receives — is the first block of the
  keyword document whose block role is the one named as the definition role; else the face of the
  first focused-work child (`ui.shell`'s Focused Work, `CA_0065`) whose document role is that
  role; else the keyword's first paragraph. Both structures the person may build — roled blocks,
  roled children — are read. User decision, 2026-09-25 (`BO_0301_Q5`).
* A run learns of mentions through an `ext.tool` of this extension and a skill, not through the
  kernel's `read_document`. User decision, 2026-09-25 (`BO_0301_Q6`).
* A manuscript carries a glossary: every keyword the document mentions in its accepted reading
  order, with its definition, automatically — nothing to pick. User decision, 2026-09-25.
* Publishing keywords to a website is a change of its own, noted below.

## Where This Sits

- A mention is a connection between the words of a block and a document those words name. The
  words are `documents`' (`lib/runs.ts`, the run primitives; the document read that resolves
  numbers and citations); the roles that mark the keyword, its definition and its aliases are
  `doc-block-roles`' (`rolesOf`, the catalogue); following a mention to its document is the
  frame's (the route, `retarget$`, the tabs); the glossary is `manuscripts`' projection reading
  this extension; the run's tool is answered through the kernel callback (`ui-kernel.md`
  `BO_0264_007`). A new extension holds the matching, the surfaces and the tool; if it ships,
  this repository's `release-extensions.json` names it. So the work spans the graph and this
  repository and is a `BO` change here, its extension tasks enumerated in the graph at draft —
  in the new extension's `system.md` and, for the glossary, in `manuscripts`' — with the task
  lines here pointing there.

## Proposed Shape

- **A new extension, `keywords`**, prefix `KW` (free: `BI`, `CA`, `CO`, `CS`, `DO`, `MA`, `ME`,
  `PF`, `PU`, `RF`, `RL`, `RO` are taken), depending on `documents`, `doc-block-roles` and
  `ui.shell`. It is `bundled` and active on a fresh install, as `doc-block-roles` and `profiles`
  are, since a keyword is nothing without the mentions reaching it and an install that marks no
  keyword pays nothing: with no keyword role chosen, no block is matched and nothing is drawn
  (`BO_0301_Q1`).
- **The section.** *Keywords*, under the extension's own icon, holds three choices over the
  catalogue's unretired document and block roles — *Keyword role*, *Definition role*, *Alias
  role* — kept as the extension's settings in the settings extension's `ext.settings` shape, and
  lists every document carrying the keyword role by title, each opening as the document it is.
  Choosing a different keyword role later re-marks at once, since nothing per document is stored.
- **What a keyword answers to** is its title and each line of its alias blocks, every one a
  *name*. A name matches a run of words at word boundaries, case-insensitively, by the three
  rules in order: the name's words with each word's inflection allowed — the English plural and
  possessive forms, `-s`, `-es`, `-ies`, `'s` — then, where no title reaches, the aliases the same
  way, then, where no name reaches, the Snowball English stem of each word. A word already inside
  a mention starts no second one. Among the matches at one place the higher rule wins over the
  same words, and the longest span wins among what remains, so *quantum computing* names the
  longer keyword and not *quantum* inside it — this ordering of the two rules is a proposal for
  the user to confirm at draft, being the one place the rules cross. Where the stem rule alone
  reaches several keywords with the same words — *quantum comput-* shared by *Quantum computer*
  and *Quantum computing* — nothing is connected, because a guess is not a connection; the person
  adds the alias that decides it.
- **A keyword's own name is not a mention.** A keyword document's blocks saying its own title or
  aliases are not connected — a definition says its name. Words under the `code` mark, inside an
  inline equation, a citation or any other atom are never matched.
- **A mention is resolved in the read and stored nowhere.** Following the citation's rule
  (`documents`' Block Document Model, `BO_0291_023`): a mention is a query over the words, not a
  maintained edge, so it can never drift from what the block says, a keyword renamed or given an
  alias re-matches everything at its next read, a block edited is matched as it now reads, and
  the graph gains no node, no relation and no run attribute. The extension's route answers, for a
  document at the pin or in a branch, each text block's mentions as ranges — start, end, the
  keyword's identity, title and the rule that matched — beside what the document read already
  answers. The alternative — a `mentions` relation written when a block is written — is measured
  at draft against this and expected to lose on the same grounds the citation did.
- **The reader sees a mention and follows it.** In the editor a mention is drawn over its words in
  a treatment of its own — quiet, distinct from a link the person set, so the two never read as
  one — and the runs under it are untouched, so editing inside a mention is editing words. On
  pointer hover a card shows the keyword's definition; a press opens the keyword document the way
  a chip opens its document (`retarget$`'s route, a tab), landing at its top. On touch the press
  opens; the hover has no touch equivalent and needs none. Nothing is drawn while the extension
  is switched off.
- **The keyword knows where it is mentioned.** A keyword document ends with *Mentioned in*: the
  documents that mention it, each with its mentioning blocks' words, a press revealing the block
  in its document. It is drawn through the `end` document place the bibliography's reference list
  already uses (`contribution-contract.md`, `BO_0291_031`), not the inspector, whose facts are the
  view's own typed contribution and not an extension's to widen (found at transfer, 2026-09-25).
  It is the reverse read, a query over every document's text blocks as `cited-by` is
  (`BO_0291_023`), answered by the extension's route at the pin. Retired and discarded blocks
  count for nothing; a mention in an open proposal counts where it would land, as a citation's
  number does. Its cost over an instance is measured at draft before any index is considered.
- **A run reads the keyword before it writes about it.** `read_keywords` `{document}`, an
  `ext.tool` answered through the kernel callback at the run's pin, answers the mentions the
  document holds — per block, the keyword's identity, title, definition and aliases — and the
  names of every keyword the instance holds, so a run proposing new words knows which of them are
  keywords. The extension's skill says: when the document mentions a keyword, read its definition
  before writing about it, write it as the keyword defines it, prefer the keyword's title over its
  aliases, and never mark a document as a keyword or give it a role, which is the person's.
- **The glossary is a projection.** `manuscripts` declares `keywords` as a dependency, as it
  declares `bibliography` for citations, and reads the document's mentions at the manuscript's
  revision through the extension's server module, one process and no HTTP hop
  (`contribution-contract.md`, the direct import between dependents). The manuscript gains a
  *Glossary* section between the body and the references: every keyword mentioned in the accepted
  reading order, once, alphabetically by title, its definition's words as the entry — the definition
  block's runs, or the child's face — and a keyword with no definition listed by its title alone.
  Proposed for the typesetting: a description list in the Pandoc AST the front already takes, so
  every venue's template carries it without a LaTeX package the service would have to add; the
  `glossaries` package is the alternative measured at draft. A run's `make_manuscript` carries the
  glossary the same way, since it is the same projection. With `keywords` switched off a
  manuscript has no glossary and says nothing about one.
- **The name `keywords` and the front matter's `keywords`.** A document's front matter already
  carries a `keywords` property — the author's own keyword list for the venue (`BO_0293_012`),
  typed words the manuscript prints under the abstract. That list and this extension are two
  things, and this change leaves the front matter alone; filling the venue's keyword list from the
  mentioned keywords is a later change if wanted. Found at transfer, 2026-09-25.
- **Nothing per mention is stored, so nothing needs migrating**: switching the extension off leaves
  every document exactly as it was; switching it on connects what the words already say.

## Functional Questions

- [ ] `BO_0301_Q1` Whether the extension is bundled and active on a fresh install. Proposed: yes,
  as `doc-block-roles` is, since it costs an install nothing until a keyword role is chosen.
- [ ] `BO_0301_Q7` Whether a mention inside a keyword document that mentions *another* keyword is
  connected. Proposed: yes; only a keyword's mentions of its own names are left alone.
- `BO_0301_Q2`–`BO_0301_Q6` are answered in What Is Asked.

## Acceptance Examples To Shape At Draft

- Given a fresh installation with the extension active and no keyword role chosen, no block of
  any document is drawn as a mention and the *Keywords* section holds the three choices and no
  keyword.
- Given the document role *Keyword* created in `doc-block-roles` and chosen as the keyword role,
  when a document titled *Quantum computing* takes the role *Keyword*, then the section lists it,
  and every document whose blocks say *quantum computing* or *Quantum computing's* draws those
  words as a mention at its next read.
- Given *Quantum computer* and *Quantum computing* both keywords, a sentence saying *quantum
  computers* is a mention of the first and not the second; one saying *quantum computation* is
  a mention of neither until one of them carries it as an alias, and then of that one.
- Given *Quantum computing* with an alias block roled *Alias* holding the line *QC*, a sentence
  saying *QCs* is a mention of it.
- Given a mention drawn in a paragraph, when the reader hovers it, then a card shows the words of
  the keyword's block roled *Definition*, that role being named as the definition role; when the
  reader presses it, then *Quantum computing* opens in a tab at its top.
- Given the keyword *Quantum computing* whose *Definition* is a focused-work child carrying that
  document role rather than a block, the hover shows the child's face.
- Given *quantum* and *quantum computing* both keywords, a sentence saying *quantum computing* is
  one mention of *Quantum computing* and none of *quantum*.
- Given *quantum computing* inside a `code` run or an inline equation, nothing is matched.
- Given the keyword document *Quantum computing* itself saying *quantum computing* in its first
  paragraph, no mention is drawn there.
- Given the keyword renamed to *Quantum computation*, every document saying *quantum computing*
  is connected at its next read by the stem rule alone, and every one saying *quantum
  computation* by the first rule, with no document touched.
- Given the keyword document open, it ends with *Mentioned in* listing each document
  mentioning it with the mentioning words, and a press on one reveals the block in its document;
  a mentioning block retired leaves the list at the next read.
- Given a run in a document mentioning *Quantum computing*, when it calls `read_keywords`, it
  receives the mention with the keyword's title, definition and aliases, and its skill tells it
  to write about the keyword as the definition has it.
- Given a document mentioning *Quantum computing* twice and *Qubit* once, when a manuscript is
  made from it, then the PDF and the LaTeX carry a *Glossary* section before the references with
  the two entries in alphabetical order, each with its definition, and a keyword mentioned only in
  a retired block is not among them.
- Given the extension switched off, nothing is drawn, no document ends with *Mentioned in*, the
  tool is not offered, a manuscript has no glossary, and every document's words are as they were.

## What Is Not In This Change

- **Publishing keywords to a website.** A change of its own, once this one is in use, expected to
  take this shape: a published page draws each mention as a link to the keyword's own published
  page, a keyword is published as a page carrying its definition and aliases, and a site can
  carry a glossary page listing the keywords its published documents mention. It reads what this
  change answers — the mentions of a document at a revision, a keyword's definition — through the
  same server module, and stores nothing new. User decision, 2026-09-25, to note it here rather
  than open its document now.
- A person setting a link to a document by hand in the words of a block, and the picker that
  would offer documents by title — authored links, left out of `BO_0300` for the same reason.
- Pointing at a keyword for a command (`BO_0300`), which stores nothing in the document and is
  the prompt's; a mention is the words' and is read by anyone.
- A keyword proposed by a run: marking and roling are the person's (`BO_0299_Q6` holds).
- Languages other than English, and a per-block language.
- Matching on anything but text blocks' words: titles of other documents, table cells, code and
  captions are not matched until asked for.
- A stored `mentions` relation, an index of mentions, or counting mentions — the reverse read is
  a query, and its cost is measured at draft before any index is considered.
- Leaving a keyword out of one manuscript's glossary; the glossary is automatic.

## Boundaries And Source Documents

- Read from the checkout `.local/tree-bo0298-stage4` on 2026-09-25, the newest tree at hand,
  after `BO_0298` completed at head 2674. The graph paths below name the authoritative extension
  docs; this idea does not establish their behavior.
- `doc-block-roles`: `src/extensions/doc-block-roles/docs/system/system.md` — the catalogue
  (`readCatalogue`, `GET /api/x/doc-block-roles/roles`), `rolesOf` as the interface a dependent
  extension imports directly, `read_document_roles` as the precedent for an `ext.tool` beside a
  skill, and `BO_0299_019`–`BO_0299_020` still open there.
- `documents`: `src/extensions/documents/docs/system/documents/block-document-model.md` — the
  run primitives and what a run may carry (marks, a link, mathematics, a citation), the citation
  resolved in the document read and *cited by* as a query over runs (`BO_0291_023`), focused work
  as a `document` that `focuses` a block; `block-editor.md` for how the editor draws an atom, a
  link and the citation's hover; `document-panel.md` for the inspector's document facts.
- `manuscripts`: `src/extensions/manuscripts/docs/system/system.md` — the projection from the
  accepted reading order at a revision, its dependency on `bibliography` for what it cites, and
  the Pandoc AST the typesetting front takes (`docs/system/typesetting-service.md`).
- `ui.shell`: `docs/system/workspace/focused-work.md` — the faces a target's blocks have and how a
  child is opened and read; `contribution-contract.md` for sections, kinds, routes, decoration
  places and the direct server import between dependents; `tabs.md` for the route a mention opens
  its document through; the settings extension's docs for the `ext.settings` shape the choices
  take.
- Fixed layer: `docs/system/extension-model.md` for members and what ships;
  `docs/system/ui-kernel.md` for extension tools (`BO_0264_007`);
  `docs/system/distribution.md`, The Release Names Its Extensions, for
  `release-extensions.json`.
- `BO_0299` (`docs/changes/BO_0299_FEAT_doc-block-roles.md`, wip) is what a keyword is marked
  with, and `BO_0300` (`docs/changes/BO_0300_FEAT_references-across-documents.md`, draft) is the
  neighbour this change is not: pointing for a command against connection by the words.
- This is a `BO` change spanning a new extension in the graph, `manuscripts` in the graph and,
  if bundled, this repository's release list. At draft, determine whether anything in the fixed
  layer moves — the answer proposed above is nothing — and enumerate the extension's tasks in its
  own `docs/system/system.md` and the glossary's in `manuscripts`', with pointers from the
  fixed-layer tasks. The new extension names `KW` as its prefix there, and this document travels
  into its `docs/changes/` at the same status through a checkout proposal.
- Implementation closure includes the accepted graph change, the graph export, and a release
  note for anything the release ships. This idea changes no shipped behavior, so none is due at
  capture time.
