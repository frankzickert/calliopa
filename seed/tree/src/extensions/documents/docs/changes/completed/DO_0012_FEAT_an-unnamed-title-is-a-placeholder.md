# DO_0012_FEAT_an-unnamed-title-is-a-placeholder

Status: completed

Requested: 2026-09-22, by the user, from making a new document: the name *Untitled document* is the
right thing to show, but it is real text in the title, so naming the document starts with deleting
it. The user asks for it to behave as a placeholder — shown until there is a name, gone as soon as
one is typed, never something to select and clear first.

A new document is minted with the literal title *Untitled document* (`contributions.ts`), and the
editor's headline draws that title as its content. Everything downstream is honest about it: the
tab is labelled *Untitled document*, the Documents section lists it under that name, and pressing
the headline puts the caret inside those eighteen characters. The name is a stand-in the system
chose, and only the headline is where a person removes it.

## The Ask

1. **The name nobody chose reads as a placeholder.** In the editor's headline, a document still
   carrying the name Calliopa minted shows *Untitled document* muted, as an empty field's
   placeholder, at rest and under the caret. Pressing it gives an empty field with the caret at the
   start; the first character typed is the first character of the name, with nothing to delete.
2. **It reads as unnamed wherever it is listed.** The tab label and the Documents row draw the same
   name muted, so a document nobody has named is recognisable from the drawer and the tab strip
   rather than only from the headline.
3. **Leaving without typing changes nothing.** The document keeps the name it had, the placeholder
   comes back, and no write is sent — the rule that a blank title is not a rename stands.
4. **A named document is untouched.** Its title is ordinary title text, in full colour, selectable
   and editable as it is today.

## Where This Starts

Read from `documents`' and `ui.shell`'s docs and code at dataRevision 1388:

- **The minted name** (`src/extensions/documents/contributions.ts`): the Documents section's
  `create$` posts `{ title: "Untitled document" }` to `/api/x/documents/d` and answers the shell an
  `OpenTarget` carrying the same words. `createDocument` (`server/documents.ts`) writes the title as
  an ordinary property of the `document` node; nothing distinguishes it from a title a person wrote.
- **The headline** ([Block Editor View](../system/documents/block-editor.md), `CA_0013_002`,
  `CA_0011_004`; `views/block-editor.tsx`): an `h2.document-title` holding the editable
  `span.document-title__text` — `contentEditable`, named by the visually hidden *Document title*
  label, Enter commits, Escape restores, blur commits through `rename$`, paste is flattened to
  text. `rename$` refuses a blank value, because a document requires a title and an entry the
  library cannot name is worse than the one it had, and the blur handler puts
  `state.document?.title` back when the rename is refused.
- **The row** (`src/extensions/documents/lib/library-item.ts`): `documentItem` turns a listed
  document into a `LibraryItem` with `label` and an `open` target, both the stored title. What a row
  says beyond its label is already the contributing extension's to declare — `glyph` (`BO_0248_012`)
  and `proposedBy` (`BO_0251_012`) are the precedent for the frame drawing a row differently
  because the extension said so.
- **The tab** (`src/components/shell/shell.tsx`): `.tab__label` draws `tab.title` from the workspace
  record, and `setTitle$` on the view bridge is how a rename reaches it — it updates the tab and
  re-reads the sections the kind opens (`refreshKind$`). The shell holds each section's read answer
  in its own `library` store (`library.data`, keyed by section key), so a tab can learn what its row
  says from there without the workspace record carrying a second copy. `registry.items` beside it is
  the process registry, not the library's rows.
- **The stylesheet** (`views/block-editor.css`): `.document-title__text` reserves its focus border
  transparently and `:focus` paints border and panel. There is no placeholder idiom in the editor
  yet; `--text-muted` is the token the headline's own `__proposed` line already uses.

## What Should Change

- The editor's headline draws no text for a document still carrying its minted name: the field is
  empty and the words are a muted placeholder, so the caret lands in an empty field and typing is
  the name. Leaving it empty puts the placeholder back and sends nothing.
- A row and a tab for such a document draw their label muted, told so by the extension that owns
  the document rather than by the frame recognising the words.
- The rule that decides what "unnamed" means lives in one place in `documents`, beside the name it
  mints, so the headline, the row and the tab cannot disagree.

## Technical Notes

- **What counts as unnamed is the minted name itself** (user decision, 2026-09-22): a document whose
  title is exactly the name Calliopa minted for a new document is unnamed. Nothing new is stored,
  and a document renamed back to those words is unnamed again, which is the reading a person would
  expect of a title they cleared back to the default. `documents` mints that name and so owns the
  comparison; the editor is the only place a `document` is titled, and change documents are
  `ext.source` members rendered read-only (`BO_0254`), so no other extension mints a document title.
- **The frame is told, not taught.** The muted label in the drawer and the tab strip follows an
  optional flag the contributing extension sets on its `LibraryItem` — the shape `glyph` and
  `proposedBy` already take — rather than the shell comparing titles against words it does not own.
  The tab reads it from the library's read answer the shell already holds rather than from a copy
  in the workspace record, which would need storing, parsing and keeping fresh to say something
  derived from the title stored beside it. A document no listing carries draws an ordinary label.
- **The placeholder is not content.** Drawing it as text in the element and clearing it on focus
  would make it selectable, copyable, and something a stale read could commit as a real title.
  Keeping the element empty and painting the words from the stylesheet keeps the rename path
  exactly as it is: an empty field is not a rename, which is already true.
- **Accessibility.** The headline keeps its visually hidden *Document title* label, so an empty
  field is still named. The placeholder words need to reach a screen reader as a placeholder rather
  than as the heading's text, and the heading's accessible name should not become empty.
- It ships in a release as a change to what a new document looks like: the release note line belongs
  under *Changed*.
