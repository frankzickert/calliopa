# Keyword Is A Built-In Role

Status: completed

Part 2 of 5 of `BO_0308`, after `BO_0309`. *Keyword* is a built-in role, so no one chooses which
role means keyword. Typing `@` in a block names a keyword through a typeahead. A prompt that
includes keywords carries the keyword fields the person chose. This document shapes the change and
authorizes no implementation.

## What Is Asked

* *Keyword* is a built-in role. The Keywords section's choice of which role means *keyword*
  (`BO_0301_Q2`) goes away. The person can extend the role with offered roles and fields.
* Mentions are still found automatically (`BO_0301`). Typing `@` in the words of a block, the way
  `#` works, opens a typeahead over the keywords.
* The typeahead's last entry is *Create keyword "…"*. It creates a document carrying *Keyword*,
  titled with what was typed, and names it in the text (`BO_0308_Q6`).
* When a prompt that includes keywords is sent, each keyword's chosen fields go with it. They are
  chosen in the keyword editor. The default is *definition*, and it can be switched off.
* The *Keywords* category folds into *Roles*, where *Keyword* lists the keywords
  (`BO_0308_Q11`).
* A prompt carries the chosen fields of every keyword it includes: those named with `@` and those
  its words match automatically. User decision, 2026-09-30 (`BO_0310_Q1`).
* Which fields go with the prompt is set once, on the *Keyword* role's page: one *Send with
  prompt* switch per field and offered role, the same for every keyword, with *Definition* on by
  default. User decision, 2026-09-30 (`BO_0310_Q2`).
* `@` only names a keyword; it does not point the command at the keyword document. A named
  keyword reaches the run through the prompt's keyword section, and `#` stays the way to point a
  command at a document. User decision, 2026-09-30 (`BO_0310_Q3`).
* On upgrade, the person's own roles chosen as the keyword, definition and alias roles merge into
  the built-ins: their fields, offered roles and assignments move over, and the old roles are
  retired, so *Roles* shows no duplicate. User decision, 2026-09-30 (`BO_0310_Q4`).

## Where This Starts

- `keywords` (`src/extensions/keywords/docs/system/system.md`): settings choose the keyword,
  definition and alias roles; matching by title, alias and stem; the dotted mention with its hover;
  *Mentioned in*; `read_keywords`; the glossary for `manuscripts`.
- `#` opens a typeahead that points at a document for a command (`BO_0300`, `BO_0304`) in
  `documents`' editor.
- The kernel adds the profile as the last instruction section at run start (`ui-kernel.md`,
  *Profiles*). Nothing adds keywords to the prompt.

## Proposed Shape

- **Built-ins.** *Keyword* offers the built-in roles *Definition* and *Alias*, so matching and the
  definition keep their meaning with no setting. On upgrade, the documents carrying the role that
  was chosen as the keyword role take *Keyword*, and the roled definition and alias blocks take
  the built-ins. The settings record and the section's three choices are removed.
- **The keyword editor** is the *Keyword* role's page under *Roles*. Each of its fields and
  offered roles has a *Send with prompt* switch, which is on for *Definition* on a fresh install.
- **`@`.** Choosing a keyword writes an inline atom naming the keyword document into the words,
  stored like a citation. It is drawn as a mention and matched before automatic mentions, so its
  words start no second one. *Create keyword* writes the document and the atom together as the
  person's truth.
- **The prompt section.** At intake the kernel asks `keywords` (through the extension tool
  callback) which keywords the prompt block mentions, and for each one what the switched-on fields
  and offered-role blocks say. It renders that as one instruction section before the profile's. The
  run record lists the keywords sent.

## Functional Questions

- None open. `BO_0310_Q1`–`BO_0310_Q4` are answered in What Is Asked.

## Acceptance Examples To Shape At Draft

- Given a fresh installation, *Keyword* stands under *Roles*, offering *Definition* and *Alias*,
  and there is no *Keywords* icon.
- Given an instance whose chosen keyword role was *Keyword (mine)*, after the upgrade every
  keyword document carries the built-in *Keyword*, every mention still resolves, and *Keyword
  (mine)* stands retired with nothing assigned.
- Given a prompt whose words say *quantum computers* with no `@`, the run's instructions still
  carry *Quantum computer*'s definition, and the command points at no keyword document.
- Given a paragraph being edited, typing `@quan` offers *Quantum computer*, *Quantum computing*
  and *Create keyword "quan"*. Choosing one writes a mention that follows a rename. Choosing
  *Create* makes the keyword document and the mention.
- Given a prompt mentioning *Quantum computing*, the run's instructions carry its definition, and
  the run record lists it. With *Definition*'s switch off, nothing is sent for it.

## Boundaries And Source Documents

- Graph: `keywords`' `system.md`; `documents`' `block-editor.md` (inline annotations, the `#`
  typeahead) and `block-document-model.md` (the run model, *Keywords*); `doc-block-roles`' docs
  after `BO_0309`.
- Fixed layer: `docs/system/ui-kernel.md`, run intake and instruction sections, for the keyword
  section and the record's line.
- Owner: `keywords`. Release note: *Changed*.

## Transferred

Promoted to draft by the user on 2026-09-30 and transferred the same day. It builds on `BO_0309`:
the built-in *Keyword* stands on its one role type, and it is implemented after it.

### The fixed layer, in this repository

- `docs/system/ui-kernel.md`, *Keywords In The Prompt* (new): `BO_0310_001`, the `keyword` run in
  the run schema; `BO_0310_002`, context at run start from an `ext.tool` marked `atRunStart`;
  `BO_0310_003`, the record's `context` and the harness copy; `BO_0310_004`, verification and the
  image rebuild.
- `docs/system/distribution.md`: `BO_0310_005`, the release line under *Changed*.

### The graph, staged 2026-09-30

- Staged from a fresh checkout at head 3203 as `node:chg-f2f0a688fbdfe30f`: five files, tasks
  only, zero removals. The accept is in `docs/changes/scratchpad.md`.
- `keywords`' `system.md` gains *Keyword Is A Built-In Role*: the decisions and `BO_0310_020`–`_027`
  (the built-ins in use, the merge, the section removed, named mentions, the `@` list and create,
  the run-start tool, verification and walk, close).
- `doc-block-roles`' `system.md`: `BO_0310_030`, the built-ins *Definition* and *Alias* offered by
  *Keyword*; `BO_0310_031`, *Send with prompt* on the *Keyword* role's page.
- `documents`: `BO_0310_010` in `block-document-model.md`, *Keywords* (the `keyword` run
  primitive); `BO_0310_011` in `block-editor.md`, *Inline Annotations* (inline triggers, the slot
  `@` uses).
- `ui.shell`'s `workspace/processes.md` gains *What The Run Was Told At Its Start* with
  `BO_0310_040`, the run's detail listing the keywords sent.

### Technical decisions taken at transfer

- A named keyword is a run attribute `keyword` on a run with text, like a link, not an atom like
  `cite`, since the words are the sentence's. Its words stay as written; its identity follows a
  rename.
- The kernel cannot match keywords itself, since the matcher and stemmer live in the extension. So
  run-start context is a general hook: an `ext.tool` with `atRunStart: true` is called through the
  existing callback before the instructions are rendered, and its section goes after the skills
  and before the profile's. A failing tool leaves its section out and the record names the failure.
- `@` reaches the editor through a general inline-trigger store in `documents`, the way the
  mention reaches it through inline annotations, because `documents` does not depend on `keywords`.
- *Send with prompt* is `sendWithPrompt` on `builtin:keyword`, drawn by the roles extension's page
  for that role alone. What it means stays `keywords`'.

## Implemented

Implemented on 2026-09-30 and completed on 2026-10-01. The kernel half is in this repository: the
`keyword` run, run-start tools, the record's `context`, and settings handed to a migration. The graph
half was accepted as `node:chg-446ffd517dbe0574` and served at pin 3308, after the kernel image was
rebuilt. On the dogfood instance, `BO_0309`'s `builtin-roles` migration had already run before
*Definition* and *Alias* joined it, so its record and the two `BO_0310` records were removed once to
rerun all three. A fresh install or an upgrade from 0.4.2 runs them in order. The walk on the served
build found the `@` list, *Create keyword*, a run's instructions and record carrying both keywords its
prompt included, the command pointing at no keyword document, and the merged roles retired with every
mention resolving. The *Send with prompt* switch turned off on *Keyword*'s page, walked by the user the
same day, sent nothing with the next prompt.
