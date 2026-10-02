# Keywords

## Purpose

- This document is the entry point of `keywords`, the extension that connects the words of a
  block to the document they name: a person marks some documents as keywords — *Quantum
  computing* — and every place a block says its title or one of its aliases, in every
  inflection, is a mention: the reader follows it to the keyword, the keyword knows where it is
  mentioned, a run reads the keyword's definition before it writes about it, and a manuscript
  carries the keywords it mentions as its glossary (`calliopa-bootstrap`'s `BO_0301`, requested
  and decided by the user on 2026-09-25).
- It is `bundled` and active on a fresh install, and costs an install nothing until a document
  uses the built-in structure *Keyword*: with none, no block is matched and nothing is drawn
  (`BO_0301_Q1`, proposed and in force). Its release line is `calliopa-bootstrap`'s
  `distribution.md` (`BO_0301_001`–`BO_0301_002`, `BO_0310_005`).
- It depends on `structures`, whose built-in structures *Keyword*, *Definition* and *Alias* mark a
  keyword and hold its definition and its aliases
  ([Document And Block Structures](../../../structures/docs/system/system.md)); on
  `documents`, whose words are matched and whose editor draws the mention
  ([Block Document Model](../../../documents/docs/system/documents/block-document-model.md#keywords)
  holds the decisions, [Block Editor](../../../documents/docs/system/documents/block-editor.md),
  *Inline Annotations*, the drawing); and on `ui.shell`, whose frame it contributes into.
  `manuscripts` depends on it in turn for the glossary
  ([Manuscripts](../../../manuscripts/docs/system/system.md)). The extension declares no
  vocabulary: an automatic mention is stored nowhere, and a named one is `documents`' `keyword`
  run. The kernel lists an active extension's `ext.tool` members and answers them through the
  callback as it does for every extension (`ui-kernel.md`, `BO_0264_007`), calls a tool marked
  `atRunStart` before a command's run is told its instructions (`ui-kernel.md`, `BO_0310_002`),
  and runs an `ext.migration` with a `route` once per instance (`BO_0312_003`).
- Its change documents carry the prefix `KW`. A `KW` change that alters what a release ships
  writes its line in the repository's `docs/release-notes/unreleased.md`, as every change of a
  `bundled` extension does.

## What This Extension Holds

* A person marks a document as a keyword by giving it a document structure; no second way of saying
  *this document is a keyword* exists. A mention of a keyword in the words of a block is
  connected without the person doing anything at the mention. The request, 2026-09-25.
* Matching is English and follows three rules in order: the title in every inflection wins —
  *quantum computers* reaches *Quantum computer*, *quantum computing* never does — then the
  aliases in every inflection, then, only where the first two reach nothing, the full stem
  (`BO_0301_Q3`). Aliases are a block structure, one per line (`BO_0301_Q4`).
* A keyword's definition is the first block using the definition structure, else the face of the
  first focused-work child using it as its document structure, else the first paragraph
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
- The matcher (`BO_0301_013`, landed 2026-09-25; `lib/match.ts`, `findMentions`) is pure and
  answers, for one block's runs and the keywords' names, the mentions as character ranges — the
  run model's offsets, an atom one wide — with the keyword and the rule. A keyword named with
  `@` comes first (`BO_0310_023`, `namedMentions`): each stretch of a block's `keyword` runs naming
  one keyword is a mention by the rule `named`, whatever its words say, and nothing inside it is
  matched again, since a named run's characters are unmatchable to the three rules; a keyword's
  own document naming itself is left alone as its own names are. Words are letters,
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
  `keywordsOf()` — every document using *Keyword* (`builtin:keyword`) as its own, read by
  `structures`' `documentsCarrying`, then each read whole for its title, the lines of its
  blocks using *Alias* (`builtin:alias`) and its definition, the first block using
  *Definition* (`builtin:definition`), else a focused-work child using it, else the first
  paragraph (`BO_0310_020`, landed 2026-09-30);
  `mentionsOf(documentId, {branch?, dataRevision?})` — the `DocumentMentionsView`: each text
  block of the reading order that is not a prompt with its mentions, and the
  keywords they name, read as truth as it stands, in a branch so a mention in an open proposal
  counts where it would land, or at a data revision — with `notKeywords`, the title of each
  document a block names with `@` that uses *Keyword* no more, empty for one that is gone;
  and `mentionedIn(documentId)` — whether the
  document is a keyword and every document with a block in its reading order mentioning it, one
  unbounded read of every document and its text blocks matched with every keyword, so the
  longer keyword's span is never counted for the shorter one inside it, documents by title and
  each mentioning block with its first words. An extension declaring `keywords` as a dependency
  imports them directly, one process and no HTTP hop; `GET /api/x/keywords/documents/[id]`
  (`?branch=`) and `GET /api/x/keywords/keywords/[id]/mentioned-in` answer the same to the
  browser, and `GET /api/x/keywords/keywords` every keyword by title with its aliases, for the
  `@` list. Named mentions count in all three as the automatic ones do, and so in the manuscript's
  glossary. This shape is the extension's contract: widening it is an ordinary change, and a field
  is never renamed under a reader.
- [ ] BO_0301_014 (the measure) The cost of `keywordsOf` over the dogfood instance: each keyword
      costs a document read and a structures read, so a mention read costs a handful of queries per
      keyword. Measure on the instance once a dozen keywords stand; if it shows in the editor's
      read, fold the keyword documents' blocks and block structures into two rooted queries before any
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
  nothing is drawn. A named keyword whose document uses *Keyword* no more is drawn under its
  title with *Not a keyword* in its card, and one whose document is gone as `keyword-gone`,
  muted, a press opening nothing (`BO_0310_023`).
- Where a keyword is mentioned is said by the mentions line in its document's header
  ([The Mentions In The Header](#the-mentions-in-the-header), `DO_0030`).
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
  structure, and that a mention follows from the words alone.
## Keyword Is A Built-In Structure

Under `calliopa-bootstrap`'s `BO_0310` (`docs/changes/BO_0310_FEAT_keyword-is-a-built-in-role.md`,
part 2 of `BO_0308`, promoted to draft by the user on 2026-09-30 and transferred here the same
day). *Keyword* is a built-in structure, so no one chooses which structure means keyword. Typing `@` in a
sentence names a keyword through a list, and a prompt carries the chosen fields of every keyword it
includes. It follows `BO_0309` (`structures`' *One Structure Type With Fields*). This change's
document stands as a member of this extension, `docs/changes/BO_0310_FEAT_keyword-is-a-built-in-role.md`,
at the status it holds in `calliopa-bootstrap`.

* *Keyword* is a built-in structure, offering the built-ins *Definition* and *Alias*. The Keywords
  section's three structure choices (`BO_0301_Q2`) go, and the *Keywords* category folds into *Structures*,
  where *Keyword* lists the keywords (`BO_0308_Q5`, `BO_0308_Q11`).
* Mentions are still found automatically. Typing `@` in the words of a block opens a list of the
  keywords, whose last entry is *Create keyword "…"*: a document carrying *Keyword*, titled with
  what was typed, named in the text (`BO_0308_Q6`).
* A prompt carries the chosen fields of every keyword it includes, named with `@` or matched
  automatically (`BO_0310_Q1`). Which fields go is set once, on the *Keyword* structure's page, one
  *Send with prompt* switch per field and offered structure, *Definition* on by default (`BO_0310_Q2`).
* `@` only names a keyword and never points the command at its document; `#` stays the pointing
  (`BO_0310_Q3`).
* On upgrade, the person's own structures chosen as the keyword, definition and alias structures merge into
  the built-ins: their fields, offered structures and assignments move over, and the old structures are
  retired (`BO_0310_Q4`).
- A named keyword is a `keyword` run (`documents`' `BO_0310_010`), drawn, hovered and pressed as
  every mention is.
- The built-ins in use (`BO_0310_020`, landed 2026-09-30; `server/keywords.ts`): *Keyword*,
  *Definition* and *Alias* are found by their fixed ids, `builtin:keyword`, `builtin:definition`
  and `builtin:alias`, which `structures` holds (`BO_0310_030`); there is nothing to choose
  and nothing to set.
- The merge (`BO_0310_021`, landed 2026-09-30; `server/merge.ts`, `mergeKeywordRoles`): the
  executable migration `migration-bo-0310-merge-keyword-roles`, route
  `kernel/migrations/merge-keyword-roles`, after `structures`' `keyword-builtins`, applied
  once on every instance as it takes the release (`BO_0312_Q7`). It reads the structures the settings
  record chose from the settings the kernel hands the call, since a callback carries no session
  (`calliopa-bootstrap`'s `BO_0312_003`, widened by `BO_0310`), each found through the catalogue by
  its id or its former id. For each chosen structure that is not a built-in and not retired: its fields
  are copied onto the built-in, a field whose name the built-in already holds kept once with its
  values moved to the built-in's key; what it offers is offered by the built-in, a chosen structure's
  offer of another chosen structure becoming nothing since the built-ins offer each other; every
  `hasBlockRole` to it is closed and related to the built-in, a subject already taking the built-in
  keeping its one; each `roleFields` node moves to the built-in (`role` and `fieldsFor`), rekeyed,
  or its values join the built-in's node where the subject has one, the built-in's own values
  kept; and the chosen structure is retired. One script, as the owner; nothing chosen, or everything
  merged already, answers an empty statement. Technical decision at implementation: the settings
  record stays on the kernel's volume unread, since a migration's callback holds no session to
  remove it with and nothing reads it any more.
- The section went (`BO_0310_022`, landed 2026-09-30): the Keywords category, `views/section.tsx`,
  the reader `keywords`, the settings module and the `/api/x/keywords/settings` route are gone.
  The keywords are listed under *Structures*, as the documents carrying *Keyword* on its row
  (`structures`' `BO_0309_015`).
- The `@` list (`BO_0310_024`, landed 2026-09-30; `views/provider.tsx`): the provider registers
  `@` in `documents`' inline triggers (`BO_0310_011`) with every keyword as an entry by title,
  found by its title and its aliases, the aliases shown beside it, and *Create keyword* last.
  Choosing writes a `keyword` run of the keyword's title and a space after it. Create posts
  `POST /api/x/keywords/keywords {title}` (`createKeyword`), which makes the document through
  `documents`' `createDocument` outside any branch and takes `builtin:keyword` on it with
  `structures`' `setStructure`, both the person's truth at once, answering the keyword; a title of
  1 to 200 characters, spaces folded, else refused in words. The list is read when the document
  is read and again after a create.
- The run-start tool (`BO_0310_025`, landed 2026-09-30; `server/tools.ts`, `promptKeywords`): the
  member `keywords.prompt_keywords`, name `prompt_keywords`, route `kernel/tools/prompt_keywords`,
  `atRunStart: true`, so the kernel calls it at a command's run start and never offers it to the
  run. At the run's pin it reads the prompt block — a prompt is read here though mentions skip
  prompts — finds its mentions, named and automatic, in the order they stand, and for each keyword
  the entries *Keyword*'s `sendWithPrompt` switches on, in the order the structure page lists them:
  *Definition* as the keyword's definition reads, with its fallbacks; a field of *Keyword* as the
  keyword document's value; another offered structure as the words of the blocks carrying it; each cut
  to 2000 characters. It answers `section`, one line per keyword by title with its words indented
  under it, after a sentence telling the run to write each as the person defined it; and `items`,
  the keywords sent. A keyword with nothing to send is left out, and a prompt with none answers an
  empty section. `read_keywords` is unchanged.
- The skill says a mention also follows from a keyword named with `@`, which a run may write as a
  `keyword` run as it writes a link, and that the prompt's keywords reach the run at its start.
- Verified 2026-09-30 (`BO_0310_026`, the unit and behaviour parts): `lib/match.test.ts` for every
  rule by example, the named rule, its precedence, a named keyword that is none and joined across
  marks; `views/views.test.ts` in Qwik's render harness — a mention drawn over the words in the
  editor with the bold mark kept under it and the definition on the wrapper, a press opening the
  keyword and no editor; the `@` list narrowed by what is typed, found by an alias, *Create*
  offered only for a name no keyword holds, a choice writing the `keyword` run of the title,
  create making the keyword and naming it; *not a keyword* and gone drawn; the foot's list and
  press. `server/merge.test.ts` for the merge's one script; `server/tools.test.ts` for the tools'
  input. `tests/behavior/keywords.test.ts` over CCGW under the kernel harness, beside
  `structures`' suite writing the same built-in — the keywords by the built-ins; a document
  mentioned at once by the plural, an alias, the stem and `@`, nothing under the code mark;
  *Mentioned in* counting the named mention; the run-start section with *Definition* on and off;
  create; the merge of chosen structures into the built-ins with their fields, offers, assignments and
  values and the chosen structures retired; a mention gone with its block retired, a rename followed;
  the tool's answer and refusal. Two mutations — the named characters left matchable, a keyword
  growing at its edge — each failed a test. `tsc --noEmit` clean.
- Walked 2026-10-01 on the served build, pin 3308 (`BO_0310_026`): `@quan` offered *Quantum
  computer*, *Quantum computing* and *Create keyword*, and a create made a keyword document carrying
  *Keyword*; a run whose prompt included *Quantum computer* and *Quantum computing* recorded both
  in its `context`, and its command pointed at the open document,
  not a keyword's; the instance's own *Keyword*, *Definition* and *Alias* stand retired with the
  keywords, the alias *QC* and *Mentioned in* resolving through the built-ins. *Send with prompt*
  switched off on *Keyword*'s page left the next run's prompt without the keywords' definitions,
  walked by the user the same day.

## The Mentions In The Header

- Under `documents`' `DO_0030` (set to draft by the user on 2026-10-01 and transferred the same
  day): on a document using *Keyword*, the document's header carries a mentions line
  ([Block Editor View](../../../documents/docs/system/documents/block-editor.md#the-document-header)),
  this extension's contribution to the `title` place (`ui.shell`'s `DO_0030_001`), standing after
  the structures extension's rows by extension order.
* The header's mentions line is the one place a keyword document lists where it is mentioned:
  *Mentioned in* at its foot goes. User decision, 2026-10-01 (`DO_0030_Q8`).
- The mentions line (`DO_0030_006`, landed 2026-10-01; `views/mentions-line.tsx`, `MentionsLine`,
  contributed to the `title` place, and nothing at `end`): with `form="full"`, on a
  document using *Keyword* that is mentioned anywhere, a button (`data-mentions-toggle`) saying
  *Mentioned in N blocks* — *1 block* in the singular — the mentioning blocks counted over every
  document `mentionedIn` answers (`mentionCount`), read again when the document's data revision
  moves; a press unfolds under it (`data-mentions-list`) the mentioning blocks grouped by document,
  each document by title and each block by its first words, a press opening that document in a tab;
  a second press folds it. Nothing on another document, on one mentioned nowhere, or with
  `form="compact"`, where nothing is read. Proven by `views/views.test.ts`: the count, the list
  unfolded and folded, a press opening a document, the singular, nothing on a document that is no
  keyword or is mentioned nowhere, nothing read for the compact line, and `title` the extension's
  only document place. A count mutated to count documents failed a test.

## Roles Become Structures

Under `calliopa-bootstrap`'s `BO_0338`, promoted to draft by the user on 2026-10-02 and transferred
here the same day: roles become structures and profiles become instructions, with every stored
identifier and route, and `doc-block-roles` and `profiles` become `structures` and `instructions`
([Roles Become Structures](../../../structures/docs/system/system.md#roles-become-structures)).

- *Keyword* is a built-in structure that allows *Definition* and *Alias* in what a run is told and
  in the code (`BO_0338_070`, 2026-10-02): the `keywords.keywords` skill and `read_keywords`' description
  say structure and *use*, the readers call `structures`' names
  (`structuresOf`, `setStructure`, `KEYWORD_STRUCTURE`), and the manifest depends on `structures`.
  The owner's settings keep their stored keys (`keywordRole`, `definitionRole`, `aliasRole`), and
  the executed migration `migration-bo-0310-merge-keyword-roles` its id and route.
- This document speaks the new terms (`BO_0338_071`, 2026-10-02): *Keyword Is A Built-In Structure*, a
  document *using* *Keyword*, its blocks *using* *Definition* and *Alias*; the settings' stored keys
  keep their names.

## A Structure Is A Document

Under `structures`' `RO_0005` (2026-10-02): every structure becomes a document and *Keyword*'s id
becomes `structure:keyword`
([A Structure Is A Document](../../../structures/docs/system/system.md#a-structure-is-a-document)).

- [ ] RO_0005_030 Keywords follow: the merge into *Keyword* (`server/merge.ts`) moves a person's
      structure's *Field* blocks, allows, assignments and values into *Keyword*'s document and
      retires the merged structure; the settings and the tools read *Keyword* and its
      *Send with prompt* entries by the new ids, a former id found through the catalogue; the
      suites green over the documents.
