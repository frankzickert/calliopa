import type { Run } from "~/lib/runs";
import type { DocumentRoleView } from "~/extensions/doc-block-roles/lib/roles";

import type { Mention } from "./match";

/**
 * Keywords (`calliopa-bootstrap`'s `BO_0301`): a document carrying the
 * document role the person named as the keyword role is a keyword, and every
 * place the words of a block say its title or one of its aliases — in every
 * inflection, and by the stem where nothing else reaches — is a mention,
 * connected to it. A mention is resolved in the read and stored nowhere, by
 * the rule a citation set: a query over the words, never a maintained edge.
 * Client-safe: nothing here reaches the graph.
 */

/** The choice's value for *None*. */
export const NO_ROLE = "";

/** Which role a definition is read by: a block role on the keyword's own
 * blocks, or a document role on its focused-work children (`BO_0301_Q5`). */
export interface RoleChoice {
  readonly kind: "block" | "document";
  readonly id: string;
}

/** The extension's per-instance settings, kept in the kernel's settings
 * record under its id: which document role marks a keyword, which role holds
 * its definition, and which block role its aliases (`BO_0301_Q2`). */
export interface KeywordsSettings {
  readonly keywordRole: string | null;
  readonly definitionRole: RoleChoice | null;
  readonly aliasRole: string | null;
}

export const NO_SETTINGS: KeywordsSettings = {
  keywordRole: null,
  definitionRole: null,
  aliasRole: null,
};

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

/** What the Keywords section is handed: the settings, the role catalogue the
 * choices are made from, and the keywords by title. */
export interface KeywordsListing {
  readonly reachable: boolean;
  readonly settings: KeywordsSettings;
  readonly roles: readonly DocumentRoleView[];
  readonly keywords: readonly { readonly id: string; readonly title: string }[];
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

/** The value a choice control carries for a role choice, and back. */
export const roleChoiceValue = (choice: RoleChoice | null): string =>
  choice === null ? NO_ROLE : `${choice.kind}:${choice.id}`;

export function parseRoleChoice(value: string): RoleChoice | null {
  const at = value.indexOf(":");
  if (at < 0) return null;
  const kind = value.slice(0, at);
  const id = value.slice(at + 1);
  if ((kind !== "block" && kind !== "document") || id === "") return null;
  return { kind, id };
}
