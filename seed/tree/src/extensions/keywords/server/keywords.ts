import { listDocumentRoles, rolesOf } from "~/extensions/doc-block-roles/server/roles";
import { DOCUMENT_ROLE_TYPE, HAS_DOCUMENT_ROLE, type DocumentRoleView } from "~/extensions/doc-block-roles/lib/roles";
import { blocksOf, CONTAINS, type TextBlockView } from "~/extensions/documents/server/assemble";
import { readDocument } from "~/extensions/documents/server/documents";
import { DOCUMENT_TYPE } from "~/extensions/documents/server/vocabulary";
import type { Run } from "~/lib/runs";
import { atDataRevision, withBranch } from "~/server/ccgw/branch-scope";
import { query, type ReadNode, type ReadRelation } from "~/server/ccgw/client";
import { bareId, contentOf, typeOf } from "~/server/ccgw/nodes";
import { facesOf } from "~/server/focused-work";
import type { GraphOutcome } from "~/server/outcome";

import {
  type DocumentMentionsView,
  type Keyword,
  type KeywordsListing,
  type KeywordsSettings,
  type MentionedInView,
  type MentioningDocument,
} from "../lib/keywords";
import { findMentions, type KeywordNames, type Mention } from "../lib/match";
import { readSettings } from "./settings";
import { stemEnglish } from "./stem";

/**
 * The reads (`BO_0301_014`): the keywords the instance holds with their
 * names and definitions, a document's mentions in reading order, and the
 * documents mentioning a keyword. A mention is resolved here and stored
 * nowhere (`BO_0291_023`'s rule): a query over the words, so it can never
 * drift from what a block says, and a keyword renamed or given an alias
 * re-matches everything at its next read. An extension declaring `keywords`
 * as a dependency imports these directly; the routes and the tool answer
 * the same shapes.
 */

const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

const DOCUMENT_KIND = "documents:document";

const active = (relation: ReadRelation, type: string): boolean =>
  relation.type === type && relation.validity.status === "active";

const isType = (node: ReadNode, type: string): boolean =>
  node.revision.status === "established" && typeOf(node) === type;

/** The text blocks of a document's reading order that words are read from:
 * contained, neither discarded nor a prompt. */
const readable = (block: { readonly kind: string; readonly standing?: string }): block is TextBlockView =>
  block.kind === "text" && block.standing !== "discarded" && block.standing !== "prompt";

/** Each line of a block carrying the alias role is one alias. */
const aliasLines = (runs: readonly Run[]): string[] =>
  runs
    .map((run) => run.text)
    .join("")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

/** The documents carrying the keyword role, by identity, with their titles. */
async function keywordDocuments(keywordRole: string): Promise<GraphOutcome<{ id: string; title: string }[]>> {
  const found = await query({
    statement: `MATCH (d:${DOCUMENT_TYPE})-[h:${HAS_DOCUMENT_ROLE}]->(r:${DOCUMENT_ROLE_TYPE}) RETURN GRAPH d, h, r`,
    unbounded: true,
    purpose: "documents carrying the keyword role",
  });
  if (found.outcome === "noResult") return { outcome: "success", result: [] };
  if (found.outcome !== "success") return found as GraphOutcome<never>;
  const byId = new Map(found.result.nodes.map((node) => [node.id, node] as const));
  const keywords: { id: string; title: string }[] = [];
  for (const relation of found.result.relations) {
    if (!active(relation, HAS_DOCUMENT_ROLE) || relation.to.nodeId === undefined) continue;
    if (bareId(relation.to.nodeId) !== keywordRole) continue;
    const document = byId.get(relation.fromNodeId);
    if (document === undefined || !isType(document, DOCUMENT_TYPE)) continue;
    const title = contentOf(document)["title"];
    keywords.push({ id: bareId(document.id), title: typeof title === "string" ? title : "" });
  }
  return { outcome: "success", result: keywords.sort((left, right) => left.title.localeCompare(right.title) || (left.id < right.id ? -1 : 1)) };
}

/**
 * One keyword read whole: its title, the lines of its blocks carrying the
 * alias role, and its definition — the first block carrying the definition
 * role, else the face of the first focused-work child carrying it as its
 * document role, else its first paragraph (`BO_0301_Q5`).
 */
async function readKeyword(id: string, title: string, settings: KeywordsSettings): Promise<GraphOutcome<Keyword>> {
  const document = await readDocument(id);
  if (document.outcome !== "success") return document as GraphOutcome<never>;
  const blocks = document.result.blocks.filter(readable);
  const roles = await rolesOf(id);
  if (roles.outcome !== "success") return roles as GraphOutcome<never>;
  const roleOf = new Map(roles.result.blocks.map((block) => [block.blockId, block.blockRole?.id ?? null] as const));
  const aliases = settings.aliasRole === null ? [] : blocks.filter((block) => roleOf.get(block.blockId) === settings.aliasRole).flatMap((block) => aliasLines(block.runs));

  let definition: readonly Run[] | null = null;
  let source: Keyword["definitionSource"] = null;
  const choice = settings.definitionRole;
  if (choice !== null && choice.kind === "block") {
    const defined = blocks.find((block) => roleOf.get(block.blockId) === choice.id);
    if (defined !== undefined) {
      definition = defined.runs;
      source = "block";
    }
  }
  if (definition === null && choice !== null && choice.kind === "document") {
    const faces = await facesOf(DOCUMENT_KIND, id);
    if (faces.outcome === "success") {
      for (const block of document.result.blocks) {
        const child = faces.result[block.blockId];
        if (child === undefined) continue;
        const childRoles = await rolesOf(child.itemId);
        if (childRoles.outcome !== "success" || childRoles.result.documentRole?.id !== choice.id) continue;
        definition = child.face ?? [];
        source = "child";
        break;
      }
    }
  }
  if (definition === null) {
    const paragraph = blocks.find((block) => block.role === "paragraph" && block.runs.some((run) => run.text.trim() !== "") && roleOf.get(block.blockId) !== settings.aliasRole);
    if (paragraph !== undefined) {
      definition = paragraph.runs;
      source = "paragraph";
    }
  }
  return { outcome: "success", result: { id, title: document.result.title || title, aliases, definition, definitionSource: source } };
}

/** Every keyword the instance holds, with names and definitions, by title;
 * none while no keyword role is chosen. */
export async function keywordsOf(settings?: KeywordsSettings): Promise<GraphOutcome<readonly Keyword[]>> {
  const chosen = settings ?? (await readSettings());
  if (chosen.keywordRole === null) return { outcome: "success", result: [] };
  const documents = await keywordDocuments(chosen.keywordRole);
  if (documents.outcome !== "success") return documents as GraphOutcome<never>;
  const keywords: Keyword[] = [];
  for (const entry of documents.result) {
    const keyword = await readKeyword(entry.id, entry.title, chosen);
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
    const mentions = names.length === 0 ? [] : findMentions(block.runs, names, stemEnglish, documentId);
    for (const mention of mentions) named.add(mention.keyword);
    return { blockId: block.blockId, mentions };
  });
  return {
    outcome: "success",
    result: {
      documentId,
      dataRevision: document.result.dataRevision ?? 0,
      blocks: blocks.filter((block) => block.mentions.length > 0),
      keywords: indexed(keywords.result.filter((keyword) => named.has(keyword.id))),
    },
  };
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

/** What the Keywords section is handed: the settings, the catalogue and the
 * keywords by title, or that the graph did not answer. */
export async function listKeywords(): Promise<KeywordsListing> {
  const settings = await readSettings();
  const roles = await listDocumentRoles();
  if (roles.outcome !== "success") return { reachable: false, settings, roles: [], keywords: [] };
  const catalogue: readonly DocumentRoleView[] = roles.result;
  if (settings.keywordRole === null) return { reachable: true, settings, roles: catalogue, keywords: [] };
  const documents = await keywordDocuments(settings.keywordRole);
  if (documents.outcome !== "success") return { reachable: false, settings, roles: catalogue, keywords: [] };
  return { reachable: true, settings, roles: catalogue, keywords: documents.result };
}
