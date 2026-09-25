# Keywords

## Purpose

- This document is the entry point of `keywords`, the extension that connects the words of a
  block to the document they name: a person marks some documents as keywords — *Quantum
  computing* — and every place a block says its title or one of its aliases, in every
  inflection, is a mention: the reader follows it to the keyword, the keyword knows where it is
  mentioned, a run reads the keyword's definition before it writes about it, and a manuscript
  carries the keywords it mentions as its glossary (`calliopa-bootstrap`'s `BO_0301`, requested
  and decided by the user on 2026-09-25).
- It is `bundled` and active on a fresh install, and costs an install nothing until a keyword
  role is chosen: with none chosen, no block is matched and nothing is drawn (`BO_0301_Q1`,
  proposed and in force). Its release line is `calliopa-bootstrap`'s `distribution.md`
  (`BO_0301_001`–`BO_0301_002`).
- It depends on `doc-block-roles`, whose roles mark a keyword and hold its definition and its
  aliases ([Document And Block Roles](../../../doc-block-roles/docs/system/system.md)); on
  `documents`, whose words are matched and whose editor draws the mention
  ([Block Document Model](../../../documents/docs/system/documents/block-document-model.md#keywords)
  holds the decisions, [Block Editor](../../../documents/docs/system/documents/block-editor.md),
  *Inline Annotations*, the drawing); and on `ui.shell`, whose frame it contributes into.
  `manuscripts` depends on it in turn for the glossary
  ([Manuscripts](../../../manuscripts/docs/system/system.md)). Nothing in the fixed layer moves:
  the extension declares no vocabulary, since a mention is stored nowhere, and the kernel lists
  an active extension's `ext.tool` members and answers them through the callback as it does for
  every extension (`ui-kernel.md`, `BO_0264_007`).
- Its change documents carry the prefix `KW`. A `KW` change that alters what a release ships
  writes its line in the repository's `docs/release-notes/unreleased.md`, as every change of a
  `bundled` extension does.

## What This Extension Holds

* A person marks a document as a keyword by giving it a document role; no second way of saying
  *this document is a keyword* exists. A mention of a keyword in the words of a block is
  connected without the person doing anything at the mention. The request, 2026-09-25.
* Which document role means *keyword*, which role means *definition* and which block role means
  *alias* are the person's choices in the Keywords section, over the role catalogue; the
  extension never looks for a role by name (`BO_0301_Q2`).
* Matching is English and follows three rules in order: the title in every inflection wins —
  *quantum computers* reaches *Quantum computer*, *quantum computing* never does — then the
  aliases in every inflection, then, only where the first two reach nothing, the full stem
  (`BO_0301_Q3`). Aliases are a block role, one per line (`BO_0301_Q4`).
* A keyword's definition is the first block carrying the definition role, else the face of the
  first focused-work child carrying it as its document role, else the first paragraph
  (`BO_0301_Q5`).
* A run learns of mentions through this extension's tool and skill, never through the kernel's
  `read_document` (`BO_0301_Q6`).
- A keyword document's mention of *another* keyword is connected; only a keyword's own names in
  its own document are left alone (`BO_0301_Q7`, proposed and in force).
- A mention is resolved in the read and stored nowhere, by the rule a citation set
  (`BO_0291_023`): a query over the words, never a maintained edge, so it cannot drift from what
  a block says, a keyword renamed or given an alias re-matches everything at its next read, and
  the graph gains no node, no relation and no run attribute. Switching the extension off leaves
  every document as it was.
- The settings are the kernel's settings record under this extension's id (`BO_0301_012`,
  landed 2026-09-25; `server/settings.ts`), as the bibliography keeps the instance's citation
  style: read by anyone signed in, written by the owner alone — the kernel refuses anyone else,
  and the section says so in the kernel's words. Technical decision at implementation: no node
  of the extension's own and no `ext.settings` Block, so the extension declares nothing and the
  harness's vocabulary copy is untouched. A fresh install holds no record, which reads as no role
  chosen. `GET /api/x/keywords/settings` reads them and `PUT` writes one field at a time —
  `keywordRole` and `aliasRole` a role's id or null, `definitionRole` as `block:<id>` or
  `document:<id>` or null (`contributions.server.ts`, `settingsFrom`).
- The Keywords section (`BO_0301_012`; `views/section.tsx`, `KeywordsSection`): a category under
  Phosphor `hash`, holding *Keyword role* over the unretired document roles, *Definition role*
  over the block roles the keyword role offers and, in a second group, the document roles for a
  focused-work child, and *Alias role* over the block roles the keyword role offers, each with
  *None* first and the two latter withheld until a keyword role is chosen; below them every
  document carrying the keyword role by title, opening as the document it is, and in words when
  no role is chosen, when there is no keyword yet, and when nothing could be read. The reader
  `keywords` answers `KeywordsListing` (`lib/keywords.ts`). A choice answered with a bare 503 —
  the kernel while the shell restarts for a pin — says *Calliopa is restarting; choose again in a
  moment* and keeps the choice. Found in the walk, 2026-09-25, when a choice landed in another
  session's pin and read as an unexplained 503.
- The matcher (`BO_0301_013`, landed 2026-09-25; `lib/match.ts`, `findMentions`) is pure and
  answers, for one block's runs and the keywords' names, the mentions as character ranges — the
  run model's offsets, an atom one wide — with the keyword and the rule. Words are letters,
  digits and marks at boundaries, an apostrophe inside a word belonging to it, compared
  case-insensitively with the possessive taken off; the inflection allowed is the English plural
  and possessive, `-s`, `-es`, `-ies`, `'s`, either way round. A name matched partly by
  inflection and partly by stem is a stem match. Over the same words the higher rule wins, and
  the longest span wins among what remains — so *quantum computing* names the longer keyword and
  not *quantum* inside it; several keywords left at the winning rule over the same words, which
  the stem rule can leave, connect nothing. A word inside a mention starts no second one; nothing
  in a `code` run or an atom is matched; a keyword's own names in its own document are not. The
  stem is Snowball English through `snowball-stemmers` `0.6.0` (ISC), fetched by `pnpm`, server
  only (`server/stem.ts`): a suffix the stemmer strips — *computingly* — is the third rule's by
  design. Proven in `lib/match.test.ts`.
- The reads and the interface (`BO_0301_014`, landed 2026-09-25; `server/keywords.ts`):
  `keywordsOf()` — every document carrying the keyword role, read by one query over
  `hasDocumentRole`, then each read whole for its title, its alias lines and its definition;
  `mentionsOf(documentId, {branch?, dataRevision?})` — the `DocumentMentionsView`: each text
  block of the reading order that is neither discarded nor a prompt with its mentions, and the
  keywords they name, read as truth as it stands, in a branch so a mention in an open proposal
  counts where it would land, or at a data revision; and `mentionedIn(documentId)` — whether the
  document is a keyword and every document with a block in its reading order mentioning it, one
  unbounded read of every document and its text blocks matched with every keyword, so the
  longer keyword's span is never counted for the shorter one inside it, documents by title and
  each mentioning block with its first words. An extension declaring `keywords` as a dependency
  imports them directly, one process and no HTTP hop; `GET /api/x/keywords/documents/[id]`
  (`?branch=`) and `GET /api/x/keywords/keywords/[id]/mentioned-in` answer the same to the
  browser. This shape is the extension's contract: widening it is an ordinary change, and a field
  is never renamed under a reader.
- [ ] BO_0301_014 (the measure) The cost of `keywordsOf` over the dogfood instance: each keyword
      costs a document read and a roles read, so a mention read costs a handful of queries per
      keyword. Measure on the instance once a dozen keywords stand; if it shows in the editor's
      read, fold the keyword documents' blocks and block roles into two rooted queries before any
      index is considered.
- The mention in the editor (`BO_0301_015`, landed 2026-09-25; `views/provider.tsx`,
  `KeywordsProvider`): a decoration provider of the `document` kind reading the document's
  mentions once per document and again when the editor reads the document again, and writing
  them as this extension's source into the editor's inline annotations — each with the
  keyword's title and its definition, cut to a line, for the hover. The editor draws a mention
  over its words as `[data-annotation="keyword"]` and never touches the runs; this extension's
  stylesheet draws it dotted, distinct from a link the person set, and on pointer hover the
  title and the definition as a card from the wrapper's own words — no script, and nothing for
  touch, which opens the keyword on a press instead. A press on a mention is recorded by the
  editor and opens no editor; the provider opens the keyword document in a tab through the
  bridge. A block being edited is drawn by the editor's own element, so its mentions leave with
  the edit and return with the next read. With the extension switched off nothing is written and
  nothing is drawn.
- *Mentioned in* at the foot of a keyword document (`BO_0301_016`, landed 2026-09-25;
  `views/mentioned-in.tsx`, `MentionedIn`): an `end` document place, the reference list's
  (`ui.shell`'s `BO_0291_031`), reading `mentioned-in` again when the document's data revision
  moves and drawing, on a document carrying the keyword role, each mentioning document by title
  with its mentioning blocks' words, a press opening the document in a tab; nothing on a
  document that is no keyword or is mentioned nowhere. Found at implementation: the inspector's
  facts are the view's own typed contribution and not an extension's to widen, which is why the
  foot is the place.
- [ ] BO_0301_016 (the landing) A press on a mentioning block's words opens the document at its
      top; landing on the block, as `reveal` does inside a view, needs the shell to open a target
      at a block, which no bridge call offers today. Add it to the shell's `openTarget$` when a
      second reader wants it.
- The agent's tool and skill (`BO_0301_017`, landed 2026-09-25; `server/tools.ts`, the members
  `keywords.read_keywords` and `keywords.keywords`): `read_keywords` `{document}` is answered on
  `POST /api/x/keywords/kernel/tools/[tool]`, a `kernelCallback` route, with `mentionsOf` at the
  run's pin — per block each mention's range, keyword, title and rule; the mentioned keywords
  with their definitions and aliases; every keyword's names — and a note saying what to do; it
  stages nothing, and a missing or malformed document is refused `422` in words. The skill says
  to read the keywords before proposing into a document, to write about a keyword as its
  definition has it, to prefer the title over an alias, never to mark a document or assign a
  role, and that a mention follows from the words alone.
- Verified 2026-09-25 (`BO_0301_018`, the unit and behaviour parts): `lib/match.test.ts` for
  every rule by example; `views/views.test.ts` in Qwik's render harness — the section's three
  choices from the catalogue with the settings chosen, a choice posted and reflected, a refusal
  in the route's words with the choice kept, the empty and unreadable states, the keywords
  opening as documents; a mention drawn over the words in the editor harness with the bold mark
  kept under it and the definition on the wrapper, the words reading back whole, a press opening
  the keyword and no editor; the foot's list and press, and nothing on a document that is no
  keyword. `server/api.test.ts` and `server/tools.test.ts` for the settings a choice posts and
  the tool's input. `tests/behavior/keywords.test.ts` over CCGW under the kernel harness — the
  keywords with their aliases and definitions; a document mentioned from another at once by the
  plural, an alias and the stem, nothing under the code mark; a keyword's own names left alone
  and its mention of another keyword counted; *Mentioned in* for a keyword and nothing for a
  document that is none; a mention gone with the block discarded and a rename followed at the
  next read; the tool's answer and its refusal; nothing while no keyword role is chosen.
  `documents`' `lib/annotations.test.ts` proves the cut. `tsc --noEmit` clean with the registry
  generated.
- Walked on the served build at pin 2820 on 2026-09-25 (`BO_0301_019`): *Keyword* created with
  *Definition* and *Alias*, chosen under Keywords; *Quantum computer* and *Quantum computing* made
  keywords with a definition each and *QC* as an alias; the document *Eln* saying *quantum
  computers*, *QCs* and *quantum computation* drawn with the right mentions, the hover and the
  press; a run in *Eln* whose record shows `read_keywords` answered before it staged its proposal;
  and *Eln* projected with a *Glossary* of the two keywords and their definitions. The walk's one
  finding, the bare 503 during another session's pin, is folded above. The change document stands
  in `docs/changes/completed/` at `completed`.