import { isRecordId } from "~/server/uuid";

import { definitionText, type DocumentMentionsView } from "../lib/keywords";
import { keywordsOf, mentionsOf } from "./keywords";

/**
 * The tool this extension answers a run (`BO_0301_017`): `read_keywords`, an
 * `ext.tool` member the kernel offers while the extension is active and
 * posts a call to through the callback. It reads and stages nothing: a run
 * reads keywords and never marks one, so the answer carries no `stage`.
 */

/** What the kernel posts a tool: the run's input and the run. */
export interface ToolCall {
  readonly input: Readonly<Record<string, unknown>>;
  readonly run: {
    readonly id: string;
    readonly group: string;
    readonly pin: number;
    readonly person?: string;
    readonly system?: boolean;
  };
}

/** What a tool answers the kernel. */
export interface ToolAnswer {
  readonly result: unknown;
}

/** A tool refused: the run reads the reason and nothing is staged. */
export class ToolRefusal extends Error {}

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** The document a call names, as a record id. */
export function documentOfInput(input: Readonly<Record<string, unknown>>): string {
  const document = text(input["document"]);
  if (document === "" || !isRecordId(document)) throw new ToolRefusal("read_keywords needs document, the document's record id");
  return document;
}

const reasonOf = (outcome: { outcome: string } & Record<string, unknown>): string =>
  outcome.outcome === "validationFailure"
    ? (outcome["failures"] as readonly { detail: string }[]).map((failure) => failure.detail).join(" ")
    : `the keywords could not be read: ${outcome.outcome}`;

/**
 * read_keywords: the document's mentions in reading order at the run's pin,
 * each with the keyword's title, definition and aliases, and the names of
 * every keyword the instance holds.
 */
export async function readKeywords(call: ToolCall): Promise<ToolAnswer> {
  const document = documentOfInput(call.input);
  const scope = call.run.pin > 0 ? { dataRevision: call.run.pin } : {};
  const read = await mentionsOf(document, scope);
  if (read.outcome !== "success") throw new ToolRefusal(reasonOf(read));
  const all = await keywordsOf();
  if (all.outcome !== "success") throw new ToolRefusal(reasonOf(all));
  const view: DocumentMentionsView = read.result;
  const mentioned = Object.values(view.keywords).map((keyword) => ({
    id: keyword.id,
    title: keyword.title,
    aliases: keyword.aliases,
    definition: definitionText(keyword.definition, 2000),
  }));
  return {
    result: {
      documentId: view.documentId,
      dataRevision: view.dataRevision,
      blocks: view.blocks.map((block) => ({
        blockId: block.blockId,
        mentions: block.mentions.map((mention) => ({
          start: mention.start,
          end: mention.end,
          keyword: mention.keyword,
          title: view.keywords[mention.keyword]?.title ?? "",
          rule: mention.rule,
        })),
      })),
      mentioned,
      keywords: all.result.map((keyword) => ({ id: keyword.id, title: keyword.title, aliases: keyword.aliases })),
      note:
        all.result.length === 0
          ? "This instance holds no keywords; write as you would any document."
          : mentioned.length === 0
            ? "This document mentions no keyword yet. The keywords listed are the instance's; where you write about one, write it as its definition has it, by its title, and never mark a document as a keyword — that is the person's act."
            : "This document mentions the keywords listed under mentioned, each with its definition. Write about a keyword as its definition has it, prefer its title over an alias, and never mark a document as a keyword or give it a role — that is the person's act.",
    },
  };
}

export const TOOLS = { read_keywords: readKeywords } as const;
