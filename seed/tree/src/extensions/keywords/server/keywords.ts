import { documentsCarrying, rolesOf, setRole } from "~/extensions/doc-block-roles/server/roles";
import { ALIAS_ROLE, DEFINITION_ROLE, KEYWORD_ROLE } from "~/extensions/doc-block-roles/lib/roles";
import { blocksOf, CONTAINS, type TextBlockView } from "~/extensions/documents/server/assemble";
import { createDocument, readDocument } from "~/extensions/documents/server/documents";
import { DOCUMENT_TYPE } from "~/extensions/documents/server/vocabulary";
import type { Run } from "~/lib/runs";
import { atDataRevision, outsideBranch, withBranch } from "~/server/ccgw/branch-scope";
import { query, type ReadNode } from "~/server/ccgw/client";
import { bareId, contentOf, nodeRef, typeOf } from "~/server/ccgw/nodes";
import { facesOf } from "~/server/focused-work";
import type { GraphOutcome } from "~/server/outcome";

import {
  type DocumentMentionsView,
  type Keyword,
  type MentionedInView,
  type MentioningDocument,
} from "../lib/keywords";
import { findMentions, type KeywordNames, type Mention } from "../lib/match";
import { stemEnglish } from "./stem";

/**
 * The reads (`BO_0301_014`): the keywords the instance holds with their
 * names and definitions, a document's mentions in reading order, and the
 * documents mentioning a keyword. A mention is resolved here and stored
 * nowhere (`BO_0291_023`'s rule): a query over the words, so it can never
 * drift from what a block says, and a keyword renamed or given an alias
 * re-matches everything at its next read. A keyword the person named with
 * `@` is a mention by its run (`BO_0310_023`). An extension declaring
 * `keywords` as a dependency imports these directly; the routes and the tool
 * answer the same shapes.
 *
 * *Keyword*, *Definition* and *Alias* are built-in roles found by their fixed
 * ids (`calliopa-bootstrap`'s `BO_0310_020`): no one chooses which role
 * means keyword, so there is nothing to set.
 */

const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

const DOCUMENT_KIND = "documents:document";

const isType = (node: ReadNode, type: string): boolean =>
  node.revision.status === "established" && typeOf(node) === type;

/** The text blocks of a document's reading order that words are read from:
 * contained, and not a prompt. */
const readable = (block: { readonly kind: string; readonly standing?: string }): block is TextBlockView =>
  block.kind === "text" && block.standing !== "prompt";

/** Each line of a block carrying *Alias* is one alias. */
const aliasLines = (runs: readonly Run[]): string[] =>
  runs
    .map((run) => run.text)
    .join("")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

/** The documents carrying *Keyword* as their own, with their titles. */
async function keywordDocuments(): Promise<GraphOutcome<{ id: string; title: string }[]>> {
  const carrying = await documentsCarrying(KEYWORD_ROLE);
  // An instance that has not run the built-ins' migration holds no Keyword.
  if (carrying.outcome === "validationFailure") return { outcome: "success", result: [] };
  if (carrying.outcome !== "success") return carrying as GraphOutcome<never>;
  return { outcome: "success", result: [...carrying.result] };
}

/** A keyword document read once: its blocks in reading order and the roles
 * each carries, for the keyword and for what a prompt is sent of it. */
export interface KeywordReading {
  readonly blocks: readonly TextBlockView[];
  readonly rolesOfBlock: ReadonlyMap<string, readonly string[]>;
  /** The values the document holds for *Keyword*'s own fields, by key. */
  readonly values: Readonly<Record<string, unknown>>;
}

export async function readKeywordDocument(id: string): Promise<GraphOutcome<KeywordReading & { readonly title: string; readonly all: Awaited<ReturnType<typeof readDocument>> }>> {
  const document = await readDocument(id);
  if (document.outcome !== "success") return document as GraphOutcome<never>;
  const roles = await rolesOf(id);
  if (roles.outcome !== "success") return roles as GraphOutcome<never>;
  // A block carries several roles since the one role type (BO_0309_012).
  const rolesOfBlock = new Map(roles.result.blocks.map((block) => [block.blockId, block.roles.filter((role) => role.proposed !== "role").map((role) => role.id)] as const));
  const keyword = roles.result.roles.find((role) => role.id === KEYWORD_ROLE);
  return {
    outcome: "success",
    result: {
      title: document.result.title,
      blocks: document.result.blocks.filter(readable),
      rolesOfBlock,
      values: keyword?.values ?? {},
      all: document,
    },
  };
}

/**
 * One keyword read whole: its title, the lines of its blocks carrying
 * *Alias*, and its definition — the first block carrying *Definition*, else
 * the face of the first focused-work child carrying it, else its first
 * paragraph (`BO_0301_Q5`).
 */
async function readKeyword(id: string, title: string): Promise<GraphOutcome<Keyword>> {
  const read = await readKeywordDocument(id);
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  const { blocks, rolesOfBlock } = read.result;
  const carries = (blockId: string, role: string): boolean => (rolesOfBlock.get(blockId) ?? []).includes(role);
  const aliases = blocks.filter((block) => carries(block.blockId, ALIAS_ROLE)).flatMap((block) => aliasLines(block.runs));

  let definition: readonly Run[] | null = null;
  let source: Keyword["definitionSource"] = null;
  const defined = blocks.find((block) => carries(block.blockId, DEFINITION_ROLE));
  if (defined !== undefined) {
    definition = defined.runs;
    source = "block";
  }
  const whole = read.result.all;
  if (definition === null && whole.outcome === "success") {
    const faces = await facesOf(DOCUMENT_KIND, id);
    if (faces.outcome === "success") {
      for (const block of whole.result.blocks) {
        const child = faces.result[block.blockId];
        if (child === undefined) continue;
        const childRoles = await rolesOf(child.itemId);
        if (childRoles.outcome !== "success" || !childRoles.result.roles.some((role) => role.proposed !== "role" && role.id === DEFINITION_ROLE)) continue;
        definition = child.face ?? [];
        source = "child";
        break;
      }
    }
  }
  if (definition === null) {
    const paragraph = blocks.find((block) => block.role === "paragraph" && block.runs.some((run) => run.text.trim() !== "") && !carries(block.blockId, ALIAS_ROLE));
    if (paragraph !== undefined) {
      definition = paragraph.runs;
      source = "paragraph";
    }
  }
  return { outcome: "success", result: { id, title: read.result.title || title, aliases, definition, definitionSource: source } };
}

/** Every keyword the instance holds, with names and definitions, by title. */
export async function keywordsOf(): Promise<GraphOutcome<readonly Keyword[]>> {
  const documents = await keywordDocuments();
  if (documents.outcome !== "success") return documents as GraphOutcome<never>;
  const keywords: Keyword[] = [];
  for (const entry of documents.result) {
    const keyword = await readKeyword(entry.id, entry.title);
    if (keyword.outcome !== "success") return keyword as GraphOutcome<never>;
    keywords.push(keyword.result);
  }
  return { outcome: "success", result: keywords };
}

const namesOf = (keywords: readonly Keyword[]): KeywordNames[] =>
  keywords.map((keyword) => ({ keyword: keyword.id, title: keyword.title, aliases: keyword.aliases }));

const indexed = (keywords: readonly Keyword[]): Record<string, Keyword> =>
  Object.fromEntries(keywords.map((keyword) => [keyword.id, keyword]));

/**
 * A document's mentions in reading order at the data revision it was read
 * at: each text block's mentions as character ranges with the keyword and
 * the rule, and the keywords they name. `scope` names a branch the caller
 * works in — a mention in an open proposal counts where it would land — or
 * a data revision to read at; absent, it reads truth as it stands.
 */
export async function mentionsOf(
  documentId: string,
  scope: { readonly branch?: string; readonly dataRevision?: number } = {},
): Promise<GraphOutcome<DocumentMentionsView>> {
  const read = () => withBranch(scope.branch, () => readMentions(documentId));
  return scope.dataRevision === undefined ? read() : atDataRevision(scope.dataRevision, read);
}

async function readMentions(documentId: string): Promise<GraphOutcome<DocumentMentionsView>> {
  const document = await readDocument(documentId);
  if (document.outcome === "noResult") return refuse("unknownDocument", `Document ${documentId} is not here.`);
  if (document.outcome !== "success") return document as GraphOutcome<never>;
  const keywords = await keywordsOf();
  if (keywords.outcome !== "success") return keywords as GraphOutcome<never>;
  const names = namesOf(keywords.result);
  const named = new Set<string>();
  const blocks = document.result.blocks.filter(readable).map((block) => {
    const mentions = findMentions(block.runs, names, stemEnglish, documentId);
    for (const mention of mentions) named.add(mention.keyword);
    return { blockId: block.blockId, mentions };
  });
  // A keyword named with `@` whose document carries Keyword no more is still
  // a mention, drawn as not a keyword under the title it has (BO_0310_023).
  const standing = new Set(keywords.result.map((keyword) => keyword.id));
  const others = await titlesOf([...named].filter((id) => !standing.has(id)));
  if (others.outcome !== "success") return others as GraphOutcome<never>;
  return {
    outcome: "success",
    result: {
      documentId,
      dataRevision: document.result.dataRevision ?? 0,
      blocks: blocks.filter((block) => block.mentions.length > 0),
      keywords: indexed(keywords.result.filter((keyword) => named.has(keyword.id))),
      notKeywords: others.result,
    },
  };
}

/** The titles of documents by id; an id the graph holds no document under
 * answers the empty title. */
async function titlesOf(ids: readonly string[]): Promise<GraphOutcome<Record<string, string>>> {
  const titles: Record<string, string> = Object.fromEntries(ids.map((id) => [id, ""] as const));
  if (ids.length === 0) return { outcome: "success", result: titles };
  const found = await query({
    statement: "MATCH (d) RETURN GRAPH d ROOT d",
    roots: ids.map(nodeRef),
    purpose: "named keywords that are no keyword",
  });
  if (found.outcome === "noResult") return { outcome: "success", result: titles };
  if (found.outcome !== "success") return found as GraphOutcome<never>;
  for (const node of found.result.nodes) {
    if (!isType(node, DOCUMENT_TYPE)) continue;
    const title = contentOf(node)["title"];
    titles[bareId(node.id)] = typeof title === "string" ? title : "";
  }
  return { outcome: "success", result: titles };
}

/** How much of a mentioning block's words the list shows. */
const WORDS = 160;

const wordsOf = (runs: readonly Run[]): string => {
  const words = runs
    .map((run) => run.text)
    .join("")
    .replace(/\s+/gu, " ")
    .trim();
  return words.length > WORDS ? `${words.slice(0, WORDS - 1).trimEnd()}…` : words;
};

/**
 * *Mentioned in* for a document (`BO_0301_016`): whether it is a keyword and,
 * if so, every document with a text block in its reading order mentioning
 * it — one unbounded read of every document and the text blocks it
 * contains, matched here with every keyword, so the longer keyword's span
 * is never counted for the shorter one inside it. Documents come by title,
 * their mentioning blocks in reading order, each with its words.
 */
export async function mentionedIn(documentId: string): Promise<GraphOutcome<MentionedInView>> {
  const keywords = await keywordsOf();
  if (keywords.outcome !== "success") return keywords as GraphOutcome<never>;
  const keyword = keywords.result.find((candidate) => candidate.id === documentId) ?? null;
  if (keyword === null) return { outcome: "success", result: { keyword: null, documents: [] } };
  const graph = await query({
    statement: `MATCH (d:${DOCUMENT_TYPE})-[c:${CONTAINS}]->(b:text) RETURN GRAPH d, c, b`,
    unbounded: true,
    purpose: "documents mentioning a keyword",
  });
  if (graph.outcome === "noResult") return { outcome: "success", result: { keyword, documents: [] } };
  if (graph.outcome !== "success") return graph as GraphOutcome<never>;
  const names = namesOf(keywords.result);
  const documents: MentioningDocument[] = [];
  for (const node of graph.result.nodes) {
    if (!isType(node, DOCUMENT_TYPE)) continue;
    const id = bareId(node.id);
    if (id === documentId) continue;
    const mentions = blocksOf(graph.result, id, CONTAINS)
      .filter(readable)
      .flatMap((block) => {
        const here: Mention[] = findMentions(block.runs, names, stemEnglish, id);
        return here.some((mention) => mention.keyword === documentId) ? [{ blockId: block.blockId, words: wordsOf(block.runs) }] : [];
      });
    if (mentions.length === 0) continue;
    const title = contentOf(node)["title"];
    documents.push({ documentId: id, title: typeof title === "string" ? title : "", mentions });
  }
  documents.sort((left, right) => left.title.localeCompare(right.title) || (left.documentId < right.documentId ? -1 : 1));
  return { outcome: "success", result: { keyword, documents } };
}

/** The longest title a keyword is created with from the `@` list. */
export const TITLE_LENGTH = 200;

/**
 * *Create keyword "…"* (`BO_0310_024`, `BO_0308_Q6`): a document titled with
 * what was typed, made through `documents`' own create and taking *Keyword*,
 * both the person's truth at once, answering the keyword as the `@` list
 * offers it.
 */
export async function createKeyword(typed: string): Promise<GraphOutcome<{ id: string; title: string; aliases: readonly string[] }>> {
  const title = typed.replace(/\s+/gu, " ").trim();
  if (title === "" || title.length > TITLE_LENGTH) return refuse("keywordTitle", `A keyword is created with a title of 1 to ${TITLE_LENGTH} characters.`);
  const created = await outsideBranch(() => createDocument({ title }));
  if (created.outcome !== "success") return created as GraphOutcome<never>;
  const documentId = created.result.documentId;
  const taken = await setRole({ documentId, role: KEYWORD_ROLE, taken: true });
  if (taken.outcome !== "success") return taken as GraphOutcome<never>;
  return { outcome: "success", result: { id: documentId, title, aliases: [] } };
}
