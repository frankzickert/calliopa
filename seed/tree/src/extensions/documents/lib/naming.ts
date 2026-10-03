/**
 * The name a document is minted with, and whether a document still carries it.
 *
 * A document requires a title, so a new one is given the name Calliopa chose
 * rather than none. That name is nobody's choice, and everything that shows it
 * says so: the editor's headline draws it as a placeholder over an empty field
 * and the frame draws the row and the tab muted. One module holds the words and
 * the question, so the mint, the headline and the library reader cannot drift
 * apart — recognising the words in three places would be three chances to
 * disagree.
 *
 * Exactly those words are unnamed. A title that merely begins with them is a
 * name somebody wrote, and a document renamed back to them is unnamed again:
 * nothing is stored about who named it, and the words on the document are the
 * whole of what is known. DO_0012_001
 */
import { INSTRUCTION_RECORD } from "./instruction";

export const UNNAMED_DOCUMENT = "Untitled document";

/** The name an instruction is minted with (`BO_0298_014`): the same rule, its
 * own words, so a new instruction is unnamed the way a new document is. */
export const UNNAMED_INSTRUCTION = "Untitled instruction";

/** The name instructions were minted with as profiles before `BO_0338`, which
 * `instructions`' migration renames to `UNNAMED_INSTRUCTION`. */
export const FORMER_UNNAMED_INSTRUCTION = "Untitled profile";

/** The name `structures` mints a structure's document with (`RO_0006_001`):
 * the same rule, its own words, so a new structure is unnamed the way a new
 * document is. */
export const UNNAMED_STRUCTURE = "Untitled structure";

export const isUnnamed = (title: string): boolean =>
  title === UNNAMED_DOCUMENT || title === UNNAMED_INSTRUCTION || title === UNNAMED_STRUCTURE;

/** The minted name a document of this record is given, and the placeholder
 * its headline paints while it is unnamed: the minted name it carries, else an
 * instruction's for an instruction and the document's for everything else. */
export const unnamedTitle = (
  document: { readonly record?: string | undefined; readonly title?: string } | null | undefined,
): string =>
  document?.title !== undefined && isUnnamed(document.title)
    ? document.title
    : document?.record === INSTRUCTION_RECORD
      ? UNNAMED_INSTRUCTION
      : UNNAMED_DOCUMENT;

/**
 * What the title field holds for a document: nothing at all while it carries
 * the minted name, because the words are then its placeholder rather than its
 * content. It is what Escape restores and what a refused rename puts back, so
 * clearing the field and leaving leaves the placeholder rather than the words
 * as text to delete again. DO_0012_002
 */
export const shownTitle = (document: { readonly title: string } | null | undefined): string =>
  document === null || document === undefined || isUnnamed(document.title) ? "" : document.title;
