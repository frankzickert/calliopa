import type { Run } from "~/lib/runs";

import type { Mention } from "./match";

/**
 * Keywords (`calliopa-bootstrap`'s `BO_0301`): a document carrying the
 * built-in role *Keyword* is a keyword (`BO_0310`), and every
 * place the words of a block say its title or one of its aliases — in every
 * inflection, and by the stem where nothing else reaches — is a mention,
 * connected to it. A mention is resolved in the read and stored nowhere, by
 * the rule a citation set: a query over the words, never a maintained edge.
 * Client-safe: nothing here reaches the graph.
 */

/** Where a keyword's definition was read from, or that it has none. */
export type DefinitionSource = "block" | "child" | "paragraph";

/** A keyword as the reads answer it: its names and its definition. */
export interface Keyword {
  readonly id: string;
  readonly title: string;
  readonly aliases: readonly string[];
  readonly definition: readonly Run[] | null;
  readonly definitionSource: DefinitionSource | null;
}

/** One text block's mentions, in reading order. */
export interface BlockMentions {
  readonly blockId: string;
  readonly mentions: readonly Mention[];
}

/**
 * What the route, the tool and a dependent extension read for a document
 * (`BO_0301_014`): each text block's mentions as character ranges, and the
 * keywords they name, at the data revision it was read at.
 */
export interface DocumentMentionsView {
  readonly documentId: string;
  readonly dataRevision: number;
  readonly blocks: readonly BlockMentions[];
  readonly keywords: Readonly<Record<string, Keyword>>;
  /** A keyword named with `@` whose document carries *Keyword* no more, by
   * id, with the title it has — empty when the document is gone
   * (`BO_0310_023`). */
  readonly notKeywords?: Readonly<Record<string, string>>;
}

/** A document mentioning a keyword, with each mentioning block's words. */
export interface MentioningDocument {
  readonly documentId: string;
  readonly title: string;
  readonly mentions: readonly { readonly blockId: string; readonly words: string }[];
}

/** What *Mentioned in* reads for a document: whether it is a keyword, and
 * who mentions it. */
export interface MentionedInView {
  readonly keyword: Keyword | null;
  readonly documents: readonly MentioningDocument[];
}

/** How much of a definition a hover card or a list shows. */
export const DEFINITION_WORDS = 240;

/** A definition's words as one line, cut for a card. */
export function definitionText(runs: readonly Run[] | null, limit = DEFINITION_WORDS): string {
  if (runs === null) return "";
  const words = runs
    .map((run) => run.text)
    .join("")
    .replace(/\s+/gu, " ")
    .trim();
  return words.length > limit ? `${words.slice(0, limit - 1).trimEnd()}…` : words;
}
