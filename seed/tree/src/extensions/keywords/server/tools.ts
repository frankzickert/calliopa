import { readCatalogue } from "~/extensions/structures/server/structures";
import { DEFINITION_STRUCTURE, KEYWORD_STRUCTURE, shownValue } from "~/extensions/structures/lib/structures";
import { readDocument } from "~/extensions/documents/server/documents";
import type { Run } from "~/lib/runs";
import { atDataRevision } from "~/server/ccgw/branch-scope";
import { isRecordId } from "~/server/uuid";

import { definitionText, type DocumentMentionsView, type Keyword } from "../lib/keywords";
import { findMentions } from "../lib/match";
import { keywordsOf, mentionsOf, readKeywordDocument } from "./keywords";
import { stemEnglish } from "./stem";

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
  if (document === "" || !isRecordId(document)) throw new ToolRefusal("the tool needs document, the document's record id");
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

/** What a run-start tool answers the kernel (`calliopa-bootstrap`'s
 * `BO_0310_002`): the section rendered into the run's instructions, and the
 * keywords it sent, for the record. */
export interface RunStartAnswer {
  readonly section: string;
  readonly items: readonly { readonly id: string; readonly title: string }[];
}

/** How much of one keyword's sent words a run is given. */
const SENT_WORDS = 2000;

const wordsOf = (runs: readonly Run[]): string =>
  runs
    .map((run) => run.text)
    .join("")
    .trim();

/**
 * What a prompt carries of one keyword (`BO_0310_Q2`): each field and offered
 * role *Keyword*'s *Send with prompt* switches on, in the order the role page
 * lists them — the definition as the keyword reads it, a field's value, an
 * offered role's blocks — and nothing held left out.
 */
async function sentOf(keyword: Keyword, send: readonly string[]): Promise<string[]> {
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return [];
  const role = catalogue.result.byId.get(KEYWORD_STRUCTURE);
  if (role === undefined) return [];
  const read = await readKeywordDocument(keyword.id);
  if (read.outcome !== "success") return [];
  const lines: string[] = [];
  const entries = [...role.fields.map((field) => field.key), ...role.offers].filter((entry) => send.includes(entry));
  for (const entry of entries) {
    const field = role.fields.find((candidate) => candidate.key === entry);
    if (field !== undefined) {
      const value = shownValue(field, read.result.values[field.key] as never);
      if (value !== "") lines.push(`${field.name}: ${value}`);
      continue;
    }
    const name = catalogue.result.byId.get(entry)?.name ?? entry;
    const words =
      entry === DEFINITION_STRUCTURE
        ? definitionText(keyword.definition, SENT_WORDS)
        : read.result.blocks
            .filter((block) => (read.result.rolesOfBlock.get(block.blockId) ?? []).includes(entry))
            .map((block) => wordsOf(block.runs))
            .filter((text) => text !== "")
            .join("\n")
            .slice(0, SENT_WORDS);
    if (words !== "") lines.push(`${name}: ${words}`);
  }
  return lines;
}

/**
 * prompt_keywords (`BO_0310_025`), the kernel's to call at the start of a run
 * a person's command started, never offered to the run: the keywords the
 * prompt block includes — named with `@` and matched in its words — each with
 * what *Keyword* sends, read at the run's pin. A keyword with nothing to send
 * says nothing; a prompt with no keyword answers an empty section.
 */
export async function promptKeywords(call: ToolCall): Promise<RunStartAnswer> {
  const document = documentOfInput(call.input);
  const block = text(call.input["block"]);
  const read = async (): Promise<RunStartAnswer> => {
    const empty: RunStartAnswer = { section: "", items: [] };
    const whole = await readDocument(document);
    if (whole.outcome !== "success") throw new ToolRefusal(reasonOf(whole as never));
    const prompt = whole.result.blocks.find((candidate) => candidate.blockId === block);
    if (prompt === undefined || prompt.kind !== "text") return empty;
    const all = await keywordsOf();
    if (all.outcome !== "success") throw new ToolRefusal(reasonOf(all));
    const names = all.result.map((keyword) => ({ keyword: keyword.id, title: keyword.title, aliases: keyword.aliases }));
    const byId = new Map(all.result.map((keyword) => [keyword.id, keyword] as const));
    const included: Keyword[] = [];
    for (const mention of findMentions(prompt.runs, names, stemEnglish, document)) {
      const keyword = byId.get(mention.keyword);
      if (keyword !== undefined && !included.includes(keyword)) included.push(keyword);
    }
    if (included.length === 0) return empty;
    const catalogue = await readCatalogue();
    const send = catalogue.outcome === "success" ? (catalogue.result.byId.get(KEYWORD_STRUCTURE)?.sendWithPrompt ?? []) : [];
    const parts: string[] = [];
    const items: { id: string; title: string }[] = [];
    for (const keyword of included) {
      const lines = await sentOf(keyword, send);
      if (lines.length === 0) continue;
      parts.push([`- ${keyword.title}`, ...lines.map((line) => `  ${line}`)].join("\n"));
      items.push({ id: keyword.id, title: keyword.title });
    }
    if (parts.length === 0) return empty;
    return {
      section: `The prompt includes these keywords. Write about each as the person defined it here, by its title:\n${parts.join("\n")}`,
      items,
    };
  };
  return call.run.pin > 0 ? atDataRevision(call.run.pin, read) : read();
}

export const TOOLS = { read_keywords: readKeywords, prompt_keywords: promptKeywords } as const;
