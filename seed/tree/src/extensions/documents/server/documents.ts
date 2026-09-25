import { readStanding, storedValue, type Standing } from "~/extensions/documents/lib/disposition";
import type { FrontMatter } from "../lib/front-matter";
import { randomBytes, randomUUID } from "node:crypto";

import { orderBetween } from "~/lib/order";
import { proposerOf, type Proposer } from "~/extensions/documents/lib/proposals";
import type { ListedDocumentEntry } from "~/extensions/documents/lib/library-item";
import {
  decide,
  query,
  stage,
  touchedSet,
  write,
  type ReadNode,
  type ReadResult,
} from "~/server/ccgw/client";
import { branchGroupOf, currentBranch, outsideBranch } from "~/server/ccgw/branch-scope";
import type { GraphOutcome, NonEmpty } from "~/server/outcome";
import { assembleDocument, assembleRetired, blocksOf, CONTAINS, RETIRED, formatsCode, placeCodeLines, toBlock, type BlockView, type DocumentView } from "./assemble";
import { formatSource } from "./format";
import { guessLanguage } from "~/extensions/documents/lib/highlight";
import { bareId, contentOf, nodeRef, typeOf } from "~/server/ccgw/nodes";
import type { BlobReference } from "~/server/ccgw/blobs";
import { sameRuns } from "~/lib/runs";
import {
  ASSERTS,
  DERIVED_FROM,
  draftClaimScript,
  farBlock,
  isBlockKind,
  onlyKindDiffers,
  readClaims,
  readRelationEnds,
  readRelationsOf,
  relationOf,
  relationScript,
  CLAIM_TYPE,
  RELATION_TYPE,
  type ClaimView,
  type RelationEnd,
  type RelationEndInput,
  type RelationInput,
  type RelationState,
  type RelationView,
} from "./work";
import { childrenOf, focusOf } from "~/server/focused-work";
import { PROFILE_RECORD, type ProfileSelection, type ProfileSummary } from "../lib/profile";
import { DOCUMENT_TARGET_KIND } from "./focus";
import { reachesDocument } from "./reach";
import {
  ACCEPTED_AT_PROPERTY,
  DOCUMENT_TYPE,
  normalizeRuns,
  splitRuns,
  type Run,
  type TextRole,
} from "./vocabulary";
import { checkTable, type TableColumn, type TableRow } from "~/extensions/documents/lib/table";
import { PHASE_PROPERTY, SUPERSEDED_BY_PROPERTY, WORK_TYPE, isPhase, type Phase } from "./vocabulary";
import { proposedWorksCited } from "./proposed-works";
import { conflictsOf } from "./phase";

/**
 * The document and block operations the editor works through, over the one
 * graph. `BO_0207_012`
 *
 * Every read is a rooted, bounded CCGW statement at the current head. Every
 * structural gesture compiles into one mutation script carried by the
 * kernel's `write` verb, so a refusal leaves the document exactly as it was
 * and what the shell may establish is the core's decision. Proposals stage
 * through the kernel's `stage` verb into a CCGW group and are answered per
 * member through its `accept` and `reject` verbs.
 *
 * Conflict on a stale base is the shell's check before it writes: CCGW's
 * direct truth write archives and replaces whatever stands, so the operation
 * compares the base the caller names with the revision the read found. The
 * window between that read and the write is the one the shell's own gateway
 * already had (`CA_0007_011`), and a proposal's staleness is CCGW's per-member
 * drift judgement at acceptance rather than anything decided here.
 */

/**
 * Blocks hang directly off their document. The first container block type
 * raises this, and the read that walks it is already written in terms of
 * relations rather than one level.
 */
const CONTAINMENT_PATTERN = (relation: string, include = ""): string =>
  `MATCH (d:${DOCUMENT_TYPE})-[c:${relation}]->(b) RETURN GRAPH d, c, b ROOT d${include}`;

/** Where a block goes among its siblings. */
export type Placement =
  | { readonly at: "start" }
  | { readonly at: "end" }
  | { readonly before: string }
  | { readonly after: string }
  /** Between two drawn rows' order keys, either `null` at an end: the rows a
   * reader dropped between, which may be a proposed insert, a retired block
   * or a discarded one as well as a block of the document. BO_0263_001 */
  | { readonly between: readonly [string | null, string | null] };

/** A slice of a document's blocks. Bounds name blocks and are exclusive. */
export interface DocumentRange {
  readonly after?: string;
  readonly before?: string;
  readonly limit?: number;
}

export interface NewTextBlock {
  readonly kind: "text";
  readonly runs?: readonly Run[];
  readonly role?: TextRole;
}

export interface NewDividerBlock {
  readonly kind: "divider";
}

/**
 * A picture or a moving picture (`BO_0273_017`). The bytes are a blob behind
 * CCGW and the block carries the reference; **absent is the pending state**, a
 * generation proposed and not yet paid for, which is why every property here is
 * optional. `source` is what made it, stored and never interpreted by this
 * model.
 */
export interface NewMediaBlock {
  readonly kind: "image" | "video";
  readonly reference?: BlobReference;
  readonly alt?: string;
  readonly width?: number;
  readonly height?: number;
  readonly source?: Record<string, unknown>;
}

/**
 * A table (`BO_0287_008`): typed columns and rows of cells, one block revised
 * whole. Behind a file the block carries the core's blob reference and the
 * file's row count, and the rows are its first hundred; `source` is where the
 * data came from, keyed by its writer and never interpreted by this model.
 */
export interface NewTableBlock {
  readonly kind: "table";
  readonly columns: readonly TableColumn[];
  readonly rows: readonly TableRow[];
  readonly caption?: string;
  readonly reference?: BlobReference;
  readonly rowCount?: number;
  readonly source?: Record<string, unknown>;
}

/**
 * An equation (`BO_0290_008`): the exact TeX, an optional caption and the
 * author's ask for a number. What the number *is* is never stored — the
 * document's order decides it on every read — so nothing here carries one.
 */
export interface NewEquationBlock {
  readonly kind: "equation";
  readonly tex: string;
  readonly caption?: string;
  readonly numbered?: boolean;
  readonly source?: Record<string, unknown>;
}

/**
 * Code (`BO_0289_018`): the code itself as text and the language it is
 * written in. It is sent to the session of the runtime the document is
 * connected to by the `code` extension and by a run's `execute_code`, and
 * what came back is an `output` block only an execution writes — so there is
 * no `NewOutputBlock` here: the kernel stages one, and this model reads it.
 * The kind is `sourcecode`, since `code` names the extension that runs it and
 * a declaration and a manifest share the `node:<id>` namespace.
 */
export interface NewCodeBlock {
  readonly kind: "sourcecode";
  readonly source: string;
  readonly language?: string;
}

export type NewBlock =
  | NewTextBlock
  | NewDividerBlock
  | NewMediaBlock
  | NewTableBlock
  | NewEquationBlock
  | NewCodeBlock;

const isCode = (block: NewBlock): block is NewCodeBlock => block.kind === "sourcecode";

const isTable = (block: NewBlock): block is NewTableBlock => block.kind === "table";

const isEquation = (block: NewBlock): block is NewEquationBlock => block.kind === "equation";

const isMedia = (block: NewBlock): block is NewMediaBlock =>
  block.kind === "image" || block.kind === "video";

export interface CreatedDocument {
  readonly documentId: string;
  readonly blockId: string;
  readonly dataRevision: string;
}

/** A write onto the document node itself, answering the revision it
 * established so a caller may write again without reading the document back. */
export interface WrittenDocument {
  readonly documentId: string;
  readonly revisionId: string;
  readonly dataRevision: string;
  /** True when the write staged into the request's branch instead of establishing. BO_0250_011 */
  readonly staged?: boolean;
}

export interface WrittenBlock {
  readonly blockId: string;
  /** The revision this write established, which is the base the next write of
   * this block names. Returning it is what lets an editor save twice without
   * reading the document back in between. */
  readonly revisionId: string;
  readonly dataRevision: string;
  /** True when the write staged into the request's branch instead of establishing. BO_0250_011 */
  readonly staged?: boolean;
}

export interface SplitBlocks {
  readonly blockId: string;
  readonly revisionId: string;
  readonly tailBlockId: string;
  /** The revision the tail was established at, which is the base its first
   * save names, so an editor that drew the tail before the split landed can
   * write it without reading it back. CA_0045_004 */
  readonly tailRevisionId: string;
  readonly dataRevision: string;
}

/**
 * How many times a document has been written, and when last.
 *
 * A data revision is one transaction, so a write that touched several of the
 * document's records counts once however many it left behind.
 */
export interface ChangeSummary {
  readonly changeCount: number;
  /** Null only when nothing of the document has ever been written. */
  readonly lastWrittenAt: string | null;
}

function refuse<T>(rule: string, detail: string): GraphOutcome<T> {
  return {
    outcome: "validationFailure",
    failures: [{ operation: null, rule, detail }],
  };
}

function conflict<T>(nodeId: string, expected: string, current: string | null): GraphOutcome<T> {
  return {
    outcome: "conflict",
    conflicts: [{ nodeId, expectedRevisionId: expected, currentRevisionId: current }],
  };
}

const nodeOf = (graph: ReadResult, id: string): ReadNode | undefined =>
  graph.nodes.find((candidate) => candidate.id === nodeRef(id));

const mediaContent = (block: NewMediaBlock, order: string): Record<string, unknown> => ({
  order,
  // Every one optional: a block with no reference is a generation not made yet,
  // and the dimensions are the block's own because the reference carries none.
  ...(block.reference !== undefined ? { reference: block.reference } : {}),
  ...(block.alt !== undefined && block.alt !== "" ? { alt: block.alt } : {}),
  ...(block.width !== undefined ? { width: block.width } : {}),
  ...(block.height !== undefined ? { height: block.height } : {}),
  ...(block.source !== undefined ? { source: block.source } : {}),
});

const tableContent = (block: NewTableBlock, order: string): Record<string, unknown> => ({
  order,
  columns: block.columns.map((column) => ({ name: column.name, type: column.type })),
  rows: block.rows.map((row) => [...row]),
  ...(block.caption !== undefined && block.caption.trim() !== "" ? { caption: block.caption.trim() } : {}),
  ...(block.reference !== undefined ? { reference: block.reference } : {}),
  // The count goes with the file: a table held whole has nothing to count.
  ...(block.reference !== undefined && block.rowCount !== undefined ? { rowCount: block.rowCount } : {}),
  ...(block.source !== undefined ? { source: block.source } : {}),
});

const equationContent = (block: NewEquationBlock, order: string): Record<string, unknown> => ({
  order,
  tex: block.tex,
  ...(block.caption !== undefined && block.caption.trim() !== "" ? { caption: block.caption.trim() } : {}),
  // Absent means no number, as an absent role means paragraph.
  ...(block.numbered === true ? { numbered: true } : {}),
  ...(block.source !== undefined ? { source: block.source } : {}),
});

/**
 * What a new block stores, exported so it can be proven on its own. A block
 * created without a language gets the highlighter's guess, once, as an
 * ordinary value a person can change; nothing re-guesses it afterwards, and a
 * guess the highlighter will not make leaves the field empty. BO_0296_017
 */
const codeContent = (block: NewCodeBlock, order: string): Record<string, unknown> => {
  const named = block.language !== undefined && block.language.trim() !== "" ? block.language.trim() : guessLanguage(block.source);
  return {
    order,
    source: block.source,
    ...(named === null ? {} : { language: named }),
  };
};

export const blockContentFor = (block: NewBlock, order: string): Record<string, unknown> =>
  isMedia(block)
    ? mediaContent(block, order)
    : isEquation(block)
    ? equationContent(block, order)
    : isTable(block)
    ? tableContent(block, order)
    : isCode(block)
    ? codeContent(block, order)
    : block.kind === "divider"
    ? { order }
    : {
        order,
        runs: normalizeRuns(block.runs ?? []),
        ...(block.role !== undefined && block.role !== "paragraph"
          ? { role: block.role }
          : {}),
      };

const blockType = (block: NewBlock): string => block.kind;

/**
 * The works the document's blocks cite that stand at the pin (`BO_0291_013`):
 * a citation names a node the document does not contain, so one rooted read
 * over the cited identities, made only when something is cited, says which
 * of them are there. The match names no label — a root that is a node of
 * another type is then an ordinary miss, read as not a work — and an empty
 * answer is the ordinary case for a citation of nothing.
 */
async function citedWorksAt(
  graph: ReadResult,
  documentId: string,
): Promise<{ readonly ok: true; readonly works: ReadonlySet<string> | undefined } | { readonly ok: false; readonly outcome: GraphOutcome<never> }> {
  const cited = new Set<string>();
  for (const block of blocksOf(graph, documentId, CONTAINS)) {
    if (block.kind !== "text") continue;
    for (const run of block.runs) if (run.cite !== undefined) cited.add(run.cite.work);
  }
  if (cited.size === 0) return { ok: true, works: undefined };
  const works = await query({
    statement: "MATCH (w) RETURN GRAPH w ROOT w",
    roots: [...cited].map((work) => nodeRef(work)),
    purpose: "cited works",
  });
  if (works.outcome === "noResult") return { ok: true, works: new Set() };
  if (works.outcome !== "success") return { ok: false, outcome: works as GraphOutcome<never> };
  return {
    ok: true,
    works: new Set(works.result.nodes.filter((node) => typeOf(node) === WORK_TYPE).map((node) => bareId(node.id))),
  };
}

/**
 * Reads a document and the graph it came from. Callers that only need the
 * ordered document use `readDocument`; the operations need the raw graph too,
 * so a revision can preserve content this build does not model.
 */
async function loadDocument(
  documentId: string,
  relationType: typeof CONTAINS | typeof RETIRED = CONTAINS,
): Promise<
  | { readonly ok: true; readonly graph: ReadResult; readonly document: DocumentView }
  | { readonly ok: false; readonly outcome: GraphOutcome<never> }
> {
  const outcome = await query({
    statement: CONTAINMENT_PATTERN(relationType),
    roots: [nodeRef(documentId)],
    unbounded: true,
    purpose: "document read",
  });
  if (outcome.outcome !== "success") {
    return { ok: false, outcome: outcome as GraphOutcome<never> };
  }
  const knownWorks = await citedWorksAt(outcome.result, documentId);
  if (knownWorks.ok === false) {
    return { ok: false, outcome: knownWorks.outcome };
  }
  const assembled = assembleDocument(outcome.result, documentId, knownWorks.works === undefined ? {} : { knownWorks: knownWorks.works });
  if (assembled === null) {
    return {
      ok: false,
      outcome: {
        outcome: "noResult",
        detail: `No document ${documentId} in this graph.`,
      },
    };
  }
  // How the citations read in the document's style, answered by whichever
  // extension resolves them, so the labels arrive with the document and
  // nothing re-flows once it is drawn. Imported where it is used: the
  // registry imports this module's extension. BO_0291_030
  let styled = assembled;
  const numbers = assembled.citationNumbers ?? {};
  if (relationType === CONTAINS && Object.keys(numbers).length > 0) {
    const cited: { work: string; locator?: string }[] = [];
    for (const block of assembled.blocks) {
      if (block.kind !== "text" || block.standing === "discarded") continue;
      for (const run of block.runs) {
        if (run.cite !== undefined && numbers[run.cite.work] !== undefined) cited.push({ work: run.cite.work, ...(run.cite.locator === undefined ? {} : { locator: run.cite.locator }) });
      }
    }
    const order = Object.entries(numbers).sort((left, right) => left[1] - right[1]).map(([work]) => work);
    const { resolveCitations } = await import("~/server/registry");
    const answer = await resolveCitations({ documentId, order, cited, ...(assembled.citationStyle === undefined ? {} : { style: assembled.citationStyle }) });
    if (answer !== null) {
      styled = {
        ...assembled,
        ...(Object.keys(answer.labels).length > 0 ? { citationLabels: answer.labels } : {}),
        ...(answer.styles === undefined ? {} : { citationStyles: answer.styles }),
      };
    }
  }
  // Which blocks a run derived from which: one rooted read over
  // `derivedFrom` beside the containment read, so the body's order and the
  // depth's relevance layer need no second request. Only the containment
  // read is asked for the retired blocks. CA_0046_005
  if (relationType !== CONTAINS || styled.blocks.length === 0) {
    return { ok: true, graph: outcome.result, document: styled };
  }
  const derived = await query({
    statement: `MATCH (b)-[e:${DERIVED_FROM}]->(f) RETURN GRAPH b, e, f ROOT b`,
    roots: styled.blocks.map((block) => nodeRef(block.blockId)),
    unbounded: true,
    purpose: "derivations",
  });
  if (derived.outcome !== "success" && derived.outcome !== "noResult") {
    return { ok: false, outcome: derived as GraphOutcome<never> };
  }
  const sources = new Map<string, string[]>();
  for (const relation of derived.outcome === "success" ? derived.result.relations : []) {
    if (relation.type !== DERIVED_FROM || relation.validity.status !== "active" || relation.to.nodeId === undefined) continue;
    sources.set(relation.fromNodeId, [...(sources.get(relation.fromNodeId) ?? []), bareId(relation.to.nodeId)].sort());
  }
  const document: DocumentView = {
    ...styled,
    blocks: styled.blocks.map((block) => {
      const from = sources.get(nodeRef(block.blockId));
      return block.kind === "text" && from !== undefined ? { ...block, derivedFrom: from } : block;
    }),
  };
  return { ok: true, graph: outcome.result, document };
}

/**
 * A document a run started and nobody has taken: its node has no established
 * revision, only a candidate in one open group — the run's, which also stages
 * its blocks and their containment (`create_document`, `ui-kernel.md`
 * `BO_0251_003`). It is answered with its title and no blocks: every block is
 * an insert of that group, drawn from the proposals read, so drawing it from
 * the document too would draw it twice. A rejected group's candidate is not
 * a candidate any more, and the document is unknown.
 *
 * Started means created by the candidate: a candidate with no earlier
 * revision. A deleted document can still carry an open group's candidate —
 * the carry-forward anchor a proposal against it hung on — which has the
 * document's history behind it and is not a document anyone started; found
 * when the delete in the behaviour suite read back as started. BO_0251_008
 */
async function readStarted(documentId: string): Promise<GraphOutcome<DocumentView>> {
  const unknown: GraphOutcome<DocumentView> = { outcome: "noResult", detail: `No document ${documentId} in this graph.` };
  const outcome = await outsideBranch(() =>
    query({
      statement: `MATCH (d:${DOCUMENT_TYPE}) RETURN GRAPH d ROOT d INCLUDE CANDIDATES, HISTORY`,
      roots: [nodeRef(documentId)],
      purpose: "started document",
    }),
  );
  if (outcome.outcome === "noResult") return unknown;
  if (outcome.outcome !== "success") return outcome as GraphOutcome<DocumentView>;
  const node = outcome.result.nodes.find(
    (candidate) => candidate.id === nodeRef(documentId) && typeOf(candidate) === DOCUMENT_TYPE && startedNode(candidate),
  );
  const group = node?.revision.content?.["_proposal"];
  if (node === undefined || typeof group !== "string" || group === "") return unknown;
  const proposer = await groupProposer(group);
  if (proposer.outcome !== "success") return proposer as GraphOutcome<DocumentView>;
  const title = contentOf(node)["title"];
  return {
    outcome: "success",
    result: {
      documentId,
      revisionId: node.revision.id,
      title: typeof title === "string" ? title : "",
      blocks: [],
      ...(outcome.result.resolvedDataRevision > 0 ? { dataRevision: outcome.result.resolvedDataRevision } : {}),
      proposed: { group, proposer: proposer.result },
    },
  };
}

/** A node a candidate created: a candidate with no revision before it. */
const startedNode = (node: ReadNode): boolean =>
  node.revision.status === "candidate" && (node.history ?? []).every((revision) => revision.id === node.revision.id);

/** Who proposed a group, read from its members as the proposals read reads
 * it: the run's provenance node when there is one, else the stamps; a
 * person's branch is that person's. BO_0233_001 BO_0250_013 */
function proposerFrom(groupId: string, members: readonly ReadNode[]): Proposer {
  const stagedBy = [...new Set(members.map((node) => node.revision.createdBy))].filter((name) => name !== "").sort();
  const run = members.find((node) => node.revision.content?.["_type"] === "agent.run");
  const branch = branchGroupOf(groupId);
  return branch === null ? proposerOf(run?.revision.content, stagedBy) : { kind: "person", name: branch.account };
}

async function groupProposer(groupId: string): Promise<GraphOutcome<Proposer>> {
  const members = await query({
    statement: "MATCH (n) WHERE n._proposal = $g RETURN GRAPH n ROOT n INCLUDE CANDIDATES",
    parameters: { g: groupId },
    proposalOverlay: groupId,
    unbounded: true,
    purpose: "started document's proposer",
  });
  if (members.outcome === "storageError") return members as GraphOutcome<Proposer>;
  const nodes = members.outcome === "success" ? members.result.nodes.filter((node) => node.revision.content?.["_proposal"] === groupId) : [];
  return { outcome: "success", result: proposerFrom(groupId, nodes) };
}

/** Whether a document is a started one nobody has taken, and in which group.
 * BO_0251_009 */
async function startedIn(documentId: string): Promise<string | null> {
  if (await hasEstablished(nodeRef(documentId))) return null;
  const started = await readStarted(documentId);
  return started.outcome === "success" ? (started.result.proposed?.group ?? null) : null;
}

/** The blocks that carry a usable order key, which are the ones a placement
 * can be computed against. */
const placeable = (blocks: readonly BlockView[]): BlockView[] =>
  blocks
    .filter((block) => block.order !== "")
    // In the reading order's own order — by key, then by block — so a block
    // staged into the list sorts where it will stand. DO_0004_008
    .sort((left, right) => (left.order !== right.order ? (left.order < right.order ? -1 : 1) : left.blockId < right.blockId ? -1 : left.blockId > right.blockId ? 1 : 0));

/** A block this group has staged ahead of the item being placed. */
const stagedSibling = (block: BlockView | undefined): boolean => block?.blockId.startsWith("staged:") === true;

/**
 * The order key a placement asks for, or a refusal when it names a block that
 * is not among these siblings.
 *
 * A block being moved stays in this list. Its own key can only ever bound the
 * side it already sits on, so the key minted against it still lands the block
 * where the caller asked; leaving it out would change the key and not the
 * order.
 */
export function orderFor(
  blocks: readonly BlockView[],
  placement: Placement,
): { readonly order: string } | { readonly failure: GraphOutcome<never> } {
  const siblings = placeable(blocks);

  // Two keys the caller drew, not blocks of this document: a proposed insert
  // and a retired block carry a key as a sibling does, and a key minted
  // between them lands the block where the drop mark showed it. BO_0263_001
  if ("between" in placement) {
    const [low, high] = placement.between;
    if (low !== null && high !== null && low >= high) {
      return {
        failure: refuse("unorderedBetween", `Order key ${low} does not sort before ${high}.`),
      };
    }
    return { order: orderBetween(low ?? "", high ?? "") };
  }

  if ("at" in placement) {
    if (placement.at === "start") {
      // After the blocks this group already put at the start, so its items
      // keep their order. DO_0004_008
      let at = 0;
      while (stagedSibling(siblings[at])) at += 1;
      return { order: orderBetween(siblings[at - 1]?.order ?? "", siblings[at]?.order ?? "") };
    }
    const last = siblings[siblings.length - 1]?.order ?? "";
    return { order: orderBetween(last, "") };
  }

  const anchorId = "before" in placement ? placement.before : placement.after;
  const index = siblings.findIndex((block) => block.blockId === anchorId);
  if (index < 0) {
    return {
      failure: refuse(
        "unknownAnchor",
        `Block ${anchorId} is not a placeable block of this document.`,
      ),
    };
  }
  const anchor = siblings[index] as BlockView;
  // The neighbour a key is minted against is the nearest one whose key
  // differs from the anchor's: two blocks sharing a key have nothing between
  // them. After an anchor, the blocks this group already put after it are
  // passed too, so its items keep their order and never share a key.
  // DO_0004_008
  if ("before" in placement) {
    let low = index - 1;
    while (low >= 0 && (siblings[low] as BlockView).order >= anchor.order) low -= 1;
    return {
      order: orderBetween(siblings[low]?.order ?? "", anchor.order),
    };
  }
  let high = index + 1;
  while (high < siblings.length && (stagedSibling(siblings[high]) || (siblings[high] as BlockView).order <= anchor.order)) high += 1;
  const low = siblings[high - 1]?.order ?? anchor.order;
  return {
    order: orderBetween(low, siblings[high]?.order ?? ""),
  };
}

/**
 * The revision a node carries at a data revision. A write answers only the
 * data revision it landed at, so the revision the next write must name is
 * read back at that pin.
 */
async function revisionAt(id: string, dataRevision: string): Promise<string> {
  const outcome = await query({
    statement: "MATCH (n {id: $id}) RETURN GRAPH n",
    parameters: { id: bareId(id) },
    dataRevision: Number(dataRevision),
    purpose: "revision after write",
  });
  if (outcome.outcome !== "success") return "";
  return nodeOf(outcome.result, id)?.revision.id ?? "";
}

/**
 * Runs one content script and reads back the revisions it produced: as truth,
 * or — when the request works in a branch — staged into the branch's group,
 * the one switch every editor command passes through, so nothing a person
 * does in a branch establishes (`BO_0250_011`). The revisions read back are
 * the branch's candidates, since the read overlays the branch.
 */
async function commit<T>(
  statement: string,
  parameters: Record<string, unknown>,
  rationale: string,
  result: (dataRevision: string, revisionOf: (id: string) => Promise<string>) => Promise<T>,
): Promise<GraphOutcome<T>> {
  const branch = currentBranch();
  // A staging into a branch says whose branch of which document it is, so
  // the group's rationale — its first staging's — names them for the kernel
  // (`branch of <document> by <account>`) whatever the command was. BO_0250_011
  const named = branch === undefined ? null : branchGroupOf(branch);
  const scoped = named === null ? rationale : `branch of ${named.documentId} by ${named.account}: ${rationale}`;
  const written = branch === undefined ? await write(statement, parameters, rationale) : await stage(branch, statement, parameters, scoped);
  if (written.outcome !== "success") return written as GraphOutcome<T>;
  const dataRevision = written.result.dataRevision;
  const answered = await result(dataRevision, (id) => revisionAt(id, dataRevision));
  return {
    outcome: "success",
    result: branch === undefined ? answered : ({ ...(answered as object), staged: true } as T),
  };
}

/** The properties a CREATE writes, as statement text over named parameters. */
const properties = (
  alias: string,
  content: Record<string, unknown>,
  parameters: Record<string, unknown>,
  established: boolean,
): string => {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(content)) {
    if (value === undefined) continue;
    const name = `${alias}_${key}`;
    parameters[name] = value;
    pairs.push(`${key}: $${name}`);
  }
  // In a branch nothing is established: a proposal-scoped CREATE stages a
  // candidate and refuses an explicit status, so the one switch of `commit`
  // holds for creations too. BO_0250_011
  if (established && currentBranch() === undefined) pairs.push(`status: "established"`);
  return pairs.join(", ");
};

/**
 * Creates a document and its first block as one script, so a document never
 * exists without somewhere to type. Identities are minted here and are the
 * ids the API hands out: CCGW names the node `node:<id>` and the shell keeps
 * the bare form.
 */
export async function createDocument(input: {
  readonly title: string;
  readonly block?: NewBlock;
  /** The record slot, set in the same statement — `profile` for a profile
   * (`BO_0298_012`); absent for an ordinary document. */
  readonly record?: string;
}): Promise<GraphOutcome<CreatedDocument>> {
  const block = input.block ?? { kind: "text" as const };
  const documentId = randomUUID();
  const blockId = randomUUID();
  const parameters: Record<string, unknown> = {
    dref: nodeRef(documentId),
    bref: nodeRef(blockId),
  };
  const content: Record<string, unknown> = { id: documentId, title: input.title, ...(input.record === undefined ? {} : { record: input.record }) };
  const statement = [
    `CREATE (d:${DOCUMENT_TYPE} {${properties("d", content, parameters, true)}})`,
    `CREATE (b:${blockType(block)} {${properties("b", { id: blockId, ...blockContentFor(block, orderBetween("", "")) }, parameters, true)}})`,
    `RELATE dref -[c:${CONTAINS}]-> bref`,
  ].join("; ");

  return commit(statement, parameters, `create document ${documentId}`, async (dataRevision) => ({
    documentId,
    blockId,
    dataRevision,
  }));
}

/**
 * Titles compare case-insensitively by code unit, not by locale. Locale
 * collation answers differently on different runtimes, and this order is read
 * back by tests and by two form factors that must agree.
 */
const byTitle = (left: ListedDocument, right: ListedDocument): number => {
  const a = left.title.toLowerCase();
  const b = right.title.toLowerCase();
  return a < b ? -1 : a > b ? 1 : 0;
};

/**
 * The documents no document contains, each with its title.
 *
 * A `document` is never the target of a containment today, so the parentless
 * filter currently keeps every document. It is written as the rule so nesting
 * documents later narrows this listing rather than rewriting it. A deleted
 * document is retired in the graph and absent from a current read, so it
 * never appears here.
 */
/** A document as the library lists it; `proposed` on a document a run
 * started that nobody has taken yet. BO_0251_011 */
export type ListedDocument = ListedDocumentEntry;

export async function listDocuments(): Promise<GraphOutcome<readonly ListedDocument[]>> {
  const outcome = await query({
    statement: `MATCH (d:${DOCUMENT_TYPE}) RETURN GRAPH d`,
    unbounded: true,
    purpose: "document listing",
  });
  if (outcome.outcome !== "success" && outcome.outcome !== "noResult") {
    return outcome as GraphOutcome<readonly ListedDocument[]>;
  }

  const contained = await query({
    statement: `MATCH (p)-[c:${CONTAINS}]->(d:${DOCUMENT_TYPE}) RETURN GRAPH p, c, d`,
    unbounded: true,
    purpose: "contained documents",
  });
  const containedIds = new Set(
    contained.outcome === "success"
      ? contained.result.relations
          .filter((relation) => relation.type === CONTAINS && relation.validity.status === "active")
          .map((relation) => relation.to.nodeId ?? "")
      : [],
  );

  const summaries: ListedDocument[] = [];
  const seen = new Set<string>();
  for (const node of outcome.outcome === "success" ? outcome.result.nodes : []) {
    if (typeOf(node) !== DOCUMENT_TYPE) continue;
    if (node.revision.status !== "established") continue;
    if (containedIds.has(node.id) || seen.has(node.id)) continue;
    // A profile lists in the Profiles category and nowhere else. BO_0298_011
    if (contentOf(node)["record"] === PROFILE_RECORD) continue;
    seen.add(node.id);
    const title = contentOf(node)["title"];
    summaries.push({
      documentId: bareId(node.id),
      title: typeof title === "string" ? title : "",
    });
  }

  // The documents runs started that nobody has taken: every document with a
  // candidate and no established revision, in one read with candidates, and
  // their proposers from the runs' provenance in one more — never a read per
  // open group. BO_0251_011
  const candidates = await query({
    statement: `MATCH (d:${DOCUMENT_TYPE}) RETURN GRAPH d INCLUDE CANDIDATES`,
    unbounded: true,
    purpose: "started documents",
  });
  const started = (candidates.outcome === "success" ? candidates.result.nodes : []).filter(
    (node) =>
      typeOf(node) === DOCUMENT_TYPE &&
      node.revision.status === "candidate" &&
      typeof node.revision.content?.["_proposal"] === "string" &&
      node.revision.content?.["record"] !== PROFILE_RECORD &&
      !seen.has(node.id) &&
      !containedIds.has(node.id),
  );
  // Created by the candidate, not a candidate of a document that stood — a
  // deleted one an open group still anchors on (`readStarted`): the history
  // of these few alone, without their content.
  const histories =
    started.length === 0
      ? null
      : await query({
          statement: `MATCH (d:${DOCUMENT_TYPE}) RETURN GRAPH d INCLUDE CANDIDATES, HISTORY`,
          roots: started.map((node) => node.id),
          unbounded: true,
          metadataOnly: true,
          purpose: "started documents' history",
        });
  const created = new Set(
    (histories?.outcome === "success" ? histories.result.nodes : []).filter(startedNode).map((node) => node.id),
  );
  if (created.size > 0) {
    const runs = await query({
      statement: "MATCH (r:agent.run) RETURN GRAPH r INCLUDE CANDIDATES",
      unbounded: true,
      purpose: "started documents' runs",
    });
    const runOf = new Map(
      (runs.outcome === "success" ? runs.result.nodes : [])
        .filter((node) => typeof node.revision.content?.["_proposal"] === "string")
        .map((node) => [node.revision.content?.["_proposal"] as string, node]),
    );
    for (const node of started.filter((candidate) => created.has(candidate.id))) {
      const group = node.revision.content?.["_proposal"] as string;
      const run = runOf.get(group);
      seen.add(node.id);
      const title = contentOf(node)["title"];
      summaries.push({
        documentId: bareId(node.id),
        title: typeof title === "string" ? title : "",
        proposed: { group, proposer: proposerFrom(group, run === undefined ? [node] : [node, run]) },
      });
    }
  }

  return { outcome: "success", result: summaries.sort(byTitle) };
}

/**
 * A root's phase, set by the reader from the transition card (`BO_0249_007`,
 * `BO_0274_005`): the base is compared first as a rename's is, and `accepted`
 * writes `acceptedAt` — the dataRevision the acceptance is made at — beside
 * the phase, which is the one fact the acceptance stores; what it accepted is
 * derived from it per claim (`acceptanceOf`). A claim contradicting an accepted
 * claim elsewhere is derived as not accepted rather than refusing the press, so
 * a press accepts what it can; `supersede` stays as the deliberate way to
 * replace a direction, moving the superseded root's `phase` and `supersededBy`
 * in the same mutation. A phase that is not `accepted` clears the stamp. A
 * content write, confirmation-free at the bridge: the press on *Establish* is
 * the confirmation (`BO_0249`, Decided).
 */
export async function setDocumentPhase(input: {
  readonly documentId: string;
  readonly baseRevisionId: string;
  readonly phase: Phase;
  readonly supersede?: string;
}): Promise<GraphOutcome<WrittenDocument>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  if (!isPhase(input.phase)) {
    return refuse("unknownPhase", `A phase is proposed, accepted or superseded, not ${String(input.phase)}.`);
  }
  if (loaded.document.revisionId !== input.baseRevisionId) {
    return conflict(input.documentId, input.baseRevisionId, loaded.document.revisionId);
  }
  // The stamp is written with the phase and cleared by any other phase: a root
  // moved back to proposed, or superseded, has no acceptance to derive from.
  // It is the revision the document was read at — the same one the base check
  // passed against — so a claim established after the reader looked at what
  // they were accepting is not accepted by their press. BO_0274_005
  const statements = [`SET d.${PHASE_PROPERTY} = $phase, d.${ACCEPTED_AT_PROPERTY} = $acceptedAt`];
  const parameters: Record<string, unknown> = {
    dNodeId: nodeRef(input.documentId),
    phase: input.phase,
    acceptedAt: input.phase === "accepted" ? (loaded.document.dataRevision ?? 0) : null,
  };
  let rationale = `set phase of document ${input.documentId} to ${input.phase}`;
  if (input.phase === "accepted") {
    const conflicts = await conflictsOf(loaded.document);
    if (conflicts.outcome !== "success") return conflicts as GraphOutcome<never>;
    const superseded = conflicts.result.find((other) => other.documentId === input.supersede);
    if (input.supersede !== undefined && superseded === undefined) {
      return refuse("notContradicting", `Document ${input.supersede} is not an accepted root contradicting this one, so there is nothing to supersede.`);
    }
    if (superseded !== undefined) {
      statements.push(`SET o.${PHASE_PROPERTY} = $superseded, o.${SUPERSEDED_BY_PROPERTY} = $successor`);
      parameters["oNodeId"] = nodeRef(superseded.documentId);
      parameters["superseded"] = "superseded";
      parameters["successor"] = input.documentId;
      rationale = `${rationale}, superseding document ${superseded.documentId}`;
    }
  }
  return commit(statements.join("; "), parameters, rationale, async (dataRevision, revisionOf) => ({
    documentId: input.documentId,
    revisionId: await revisionOf(input.documentId),
    dataRevision,
  }));
}

/**
 * The ordered document, optionally narrowed to a range of its blocks. Bounds
 * name blocks and are exclusive, so a caller reading what follows a block does
 * not have to drop the first result.
 */
export async function readDocument(
  documentId: string,
  range?: DocumentRange,
): Promise<GraphOutcome<DocumentView>> {
  const loaded = await loadDocument(documentId);
  // A document a run started and nobody has taken reads as the run's
  // proposal. BO_0251_008
  if (!loaded.ok) return loaded.outcome.outcome === "noResult" ? readStarted(documentId) : loaded.outcome;
  if (range === undefined) {
    return { outcome: "success", result: loaded.document };
  }

  const blocks = loaded.document.blocks;
  let start = 0;
  let end = blocks.length;

  if (range.after !== undefined) {
    const index = blocks.findIndex((block) => block.blockId === range.after);
    if (index < 0) {
      return refuse("unknownAnchor", `Block ${range.after} is not in this document.`);
    }
    start = index + 1;
  }
  if (range.before !== undefined) {
    const index = blocks.findIndex((block) => block.blockId === range.before);
    if (index < 0) {
      return refuse("unknownAnchor", `Block ${range.before} is not in this document.`);
    }
    end = Math.max(start, index);
  }
  if (range.limit !== undefined) {
    if (!Number.isInteger(range.limit) || range.limit < 1) {
      return refuse("limit", "A range reads at least one block.");
    }
    end = Math.min(end, start + range.limit);
  }

  return {
    outcome: "success",
    result: { ...loaded.document, blocks: blocks.slice(start, end) },
  };
}

/**
 * Retitles a document. The title is the document node's own content, so this
 * revises the document rather than any block, and the blocks are untouched.
 * A stale base is a conflict rather than a silent overwrite.
 */
export async function renameDocument(input: {
  readonly documentId: string;
  readonly baseRevisionId: string;
  readonly title: string;
}): Promise<GraphOutcome<WrittenDocument>> {
  let loaded = await loadDocument(input.documentId);
  // Retitling a started document takes it, and the title is written on top,
  // as typing into any proposal accepts it. BO_0251_009
  if (!loaded.ok && loaded.outcome.outcome === "noResult") {
    const started = await readStarted(input.documentId);
    if (started.outcome !== "success") return started as GraphOutcome<never>;
    if (started.result.revisionId !== input.baseRevisionId) {
      return conflict(input.documentId, input.baseRevisionId, started.result.revisionId);
    }
    const taken = await decide("accept", started.result.proposed?.group ?? "", nodeRef(input.documentId), `take document ${input.documentId}, retitled`);
    if (taken.outcome !== "success") return taken as GraphOutcome<never>;
    loaded = await loadDocument(input.documentId);
    if (loaded.ok) input = { ...input, baseRevisionId: loaded.document.revisionId };
  }
  if (!loaded.ok) return loaded.outcome;
  if (loaded.document.revisionId !== input.baseRevisionId) {
    return conflict(input.documentId, input.baseRevisionId, loaded.document.revisionId);
  }

  return commit(
    "SET d.title = $title",
    { dNodeId: nodeRef(input.documentId), title: input.title },
    `rename document ${input.documentId}`,
    async (dataRevision, revisionOf) => ({
      documentId: input.documentId,
      revisionId: await revisionOf(input.documentId),
      dataRevision,
    }),
  );
}

/**
 * A document's front matter set whole on its base revision (`BO_0293_012`):
 * the authors, the affiliations, the keywords and the venue a manuscript's
 * head projects, each written by property so what the panel leaves empty is
 * cleared. The abstract is a block and is written as one.
 */
export async function setFrontMatter(input: {
  readonly documentId: string;
  readonly baseRevisionId: string;
  readonly frontMatter: FrontMatter;
}): Promise<GraphOutcome<WrittenDocument>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  if (loaded.document.revisionId !== input.baseRevisionId) {
    return conflict(input.documentId, input.baseRevisionId, loaded.document.revisionId);
  }
  const { authors, affiliations, keywords, venue } = input.frontMatter;
  return commit(
    "SET d.authors = $authors, d.affiliations = $affiliations, d.keywords = $keywords, d.venue = $venue",
    {
      dNodeId: nodeRef(input.documentId),
      // A null clears the property, as an ordinary paragraph stores no role.
      authors: authors === undefined ? null : authors,
      affiliations: affiliations === undefined ? null : affiliations,
      keywords: keywords === undefined ? null : keywords,
      venue: venue === undefined ? null : venue,
    },
    `set front matter of document ${input.documentId}`,
    async (dataRevision, revisionOf) => ({
      documentId: input.documentId,
      revisionId: await revisionOf(input.documentId),
      dataRevision,
    }),
  );
}

/**
 * A document's own citation style set (`BO_0291_037`): the style's id, or
 * null to follow the instance's default again, written on the document's
 * base. Which ids exist is the declaration's to refuse — `document` permits
 * the shipped styles' ids — so `documents` holds no list of styles itself.
 */
export async function setCitationStyle(input: {
  readonly documentId: string;
  readonly baseRevisionId: string;
  readonly style: string | null;
}): Promise<GraphOutcome<WrittenDocument>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  if (loaded.document.revisionId !== input.baseRevisionId) {
    return conflict(input.documentId, input.baseRevisionId, loaded.document.revisionId);
  }
  return commit(
    "SET d.citationStyle = $style",
    { dNodeId: nodeRef(input.documentId), style: input.style },
    `set the citation style of document ${input.documentId}`,
    async (dataRevision, revisionOf) => ({
      documentId: input.documentId,
      revisionId: await revisionOf(input.documentId),
      dataRevision,
    }),
  );
}

/**
 * The document's formatting switch set (`BO_0296_013`, `BO_0296_021`): off
 * stores `false`, on clears the property so the default — on — holds again.
 * It governs what happens next, a settle or an acceptance, and reformats
 * nothing that already stands. Written on the document's base as the
 * citation style is, by the person's own edit.
 */
export async function setFormatCode(input: {
  readonly documentId: string;
  readonly baseRevisionId: string;
  readonly on: boolean;
}): Promise<GraphOutcome<WrittenDocument>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  if (loaded.document.revisionId !== input.baseRevisionId) {
    return conflict(input.documentId, input.baseRevisionId, loaded.document.revisionId);
  }
  return commit(
    "SET d.formatCode = $on",
    { dNodeId: nodeRef(input.documentId), on: input.on ? null : false },
    `${input.on ? "switch on" : "switch off"} formatting code in document ${input.documentId}`,
    async (dataRevision, revisionOf) => ({
      documentId: input.documentId,
      revisionId: await revisionOf(input.documentId),
      dataRevision,
    }),
  );
}

/**
 * The document's line-number switch set (`BO_0302_003`, `BO_0302_007`): off
 * stores `false`, on clears the property so the default — shown — holds
 * again. It governs how every code block is drawn from now on, existing
 * ones included, since the numbers are drawing and not content; nothing is
 * revised. Written on the document's base as the formatting switch is, by
 * the person's own edit.
 */
export async function setLineNumbers(input: {
  readonly documentId: string;
  readonly baseRevisionId: string;
  readonly on: boolean;
}): Promise<GraphOutcome<WrittenDocument>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  if (loaded.document.revisionId !== input.baseRevisionId) {
    return conflict(input.documentId, input.baseRevisionId, loaded.document.revisionId);
  }
  return commit(
    "SET d.lineNumbers = $on",
    { dNodeId: nodeRef(input.documentId), on: input.on ? null : false },
    `${input.on ? "show" : "hide"} line numbers in document ${input.documentId}`,
    async (dataRevision, revisionOf) => ({
      documentId: input.documentId,
      revisionId: await revisionOf(input.documentId),
      dataRevision,
    }),
  );
}

/**
 * A code block set to continue its numbering from the code block above it,
 * or not (`BO_0302_004`, `BO_0302_008`): content of the block, written on the
 * block's base as the reader's own edit through a write of its own — never a
 * `reviseCode`, so a settled edit of the source stays the one whole-block
 * revision it is and the send gate is untouched. Set stores `true`; unset
 * clears the property. The read resolves where the block then starts.
 */
export async function setCodeContinues(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly baseRevisionId: string;
  readonly continues: boolean;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  const located = locate(loaded.document, input.blockId, input.baseRevisionId);
  if ("failure" in located) return located.failure;
  if (located.block.kind !== "sourcecode") {
    return refuse("blockKind", `Block ${input.blockId} is a ${located.block.kind} block and holds no code.`);
  }
  return commit(
    "SET b.continues = $continues",
    { bNodeId: nodeRef(input.blockId), continues: input.continues ? true : null },
    `${input.continues ? "continue" : "restart"} line numbering of code ${input.blockId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.blockId,
      revisionId: await revisionOf(input.blockId),
      dataRevision,
    }),
  );
}

/**
 * One block of a document with everything it contains. A block holds no
 * children until a container block type exists, so today this is the block
 * itself, read without pulling in its siblings.
 */
export async function readBlock(
  documentId: string,
  blockId: string,
): Promise<GraphOutcome<BlockView>> {
  const loaded = await loadDocument(documentId);
  if (!loaded.ok) return loaded.outcome;
  const block = loaded.document.blocks.find(
    (candidate) => candidate.blockId === blockId,
  );
  if (block === undefined) {
    return {
      outcome: "noResult",
      detail: `Block ${blockId} is not in document ${documentId}.`,
    };
  }
  return { outcome: "success", result: block };
}

/** Inserts a new block at a placement among its siblings. */
/**
 * The statements that insert a media block, composed rather than written
 * (`BO_0273_018`).
 *
 * An agent's tool answers the kernel with statements and the kernel stages
 * them into the run's group as the run; nothing an extension does may write on
 * a run's behalf. So the vocabulary stays here — the type is this extension's —
 * and what the caller gets back is the same `CREATE` and `RELATE` `insertBlock`
 * would have run, with the block's identity and its order among its siblings
 * already settled.
 */
export async function composeMediaInsert(input: {
  readonly documentId: string;
  readonly block: NewMediaBlock;
  readonly placement: Placement;
}): Promise<
  | { readonly ok: true; readonly blockId: string; readonly statement: string; readonly parameters: Record<string, unknown> }
  | { readonly ok: false; readonly refusal: string }
> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return { ok: false, refusal: `No document ${input.documentId}.` };
  const order = orderFor(loaded.document.blocks, input.placement);
  if ("failure" in order) return { ok: false, refusal: `Nothing to place that after in ${input.documentId}.` };

  const blockId = randomUUID();
  const parameters: Record<string, unknown> = {
    dref: nodeRef(input.documentId),
    bref: nodeRef(blockId),
  };
  const statement = [
    `CREATE (b:${blockType(input.block)} {${properties("b", { id: blockId, ...blockContentFor(input.block, order.order) }, parameters, true)}})`,
    `RELATE dref -[c:${CONTAINS}]-> bref`,
  ].join("; ");
  return { ok: true, blockId, statement, parameters };
}

export async function insertBlock(input: {
  readonly documentId: string;
  readonly block: NewBlock;
  readonly placement: Placement;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;

  const order = orderFor(loaded.document.blocks, input.placement);
  if ("failure" in order) return order.failure;

  const blockId = randomUUID();
  const parameters: Record<string, unknown> = {
    dref: nodeRef(input.documentId),
    bref: nodeRef(blockId),
  };
  const statement = [
    `CREATE (b:${blockType(input.block)} {${properties("b", { id: blockId, ...blockContentFor(input.block, order.order) }, parameters, true)}})`,
    `RELATE dref -[c:${CONTAINS}]-> bref`,
  ].join("; ");

  return commit(statement, parameters, `insert block into ${input.documentId}`, async (dataRevision, revisionOf) => ({
    blockId,
    revisionId: await revisionOf(blockId),
    dataRevision,
  }));
}

/**
 * Turns a text block into a code block in its place (`BO_0289_021`): a code
 * block whose source is the block's words takes the text block's order key,
 * and the text block is retired, in one write — so the words are never in
 * two places and the retired block can be restored. A block type is a node's
 * label and cannot change, which is why this is a new block and not a
 * revise; the new block's id is answered.
 */
export async function turnIntoCode(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly baseRevisionId: string;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  const located = locate(loaded.document, input.blockId, input.baseRevisionId);
  if ("failure" in located) return located.failure;
  if (located.block.kind !== "text") {
    return refuse("blockKind", `Block ${input.blockId} is a ${located.block.kind} block; only a text block turns into code.`);
  }
  const source = located.block.runs.map((run) => run.text).join("");
  const blockId = randomUUID();
  const parameters: Record<string, unknown> = {
    dref: nodeRef(input.documentId),
    bref: nodeRef(blockId),
    cRelationId: located.block.containmentId,
    dref2: nodeRef(input.documentId),
    oref: nodeRef(input.blockId),
  };
  // The language guessed once, here, where the block is made. BO_0296_017
  const statement = [
    `CREATE (b:sourcecode {${properties("b", { id: blockId, ...codeContent({ kind: "sourcecode", source }, located.block.order) }, parameters, true)}})`,
    `RELATE dref -[c1:${CONTAINS}]-> bref`,
    "CLOSE c",
    `RELATE dref2 -[r:${RETIRED}]-> oref`,
  ].join("; ");
  return commit(statement, parameters, `turn block ${input.blockId} into code`, async (dataRevision, revisionOf) => ({
    blockId,
    revisionId: await revisionOf(blockId),
    dataRevision,
  }));
}

/** The block named by an operation, refused when it is not in the document
 * or when the base the caller names is no longer the block's revision. */
function locate(
  document: DocumentView,
  blockId: string,
  baseRevisionId?: string,
): { readonly block: BlockView } | { readonly failure: GraphOutcome<never> } {
  const block = document.blocks.find((candidate) => candidate.blockId === blockId);
  if (block === undefined) {
    return { failure: refuse("unknownBlock", `Block ${blockId} is not in this document.`) };
  }
  if (baseRevisionId !== undefined && block.revisionId !== baseRevisionId) {
    return { failure: conflict(blockId, baseRevisionId, block.revisionId) };
  }
  return { block };
}

/** Revises a text block's runs and role, keeping its identity and position. */
export async function reviseTextBlock(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly baseRevisionId: string;
  readonly runs: readonly Run[];
  readonly role?: TextRole;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  const located = locate(loaded.document, input.blockId, input.baseRevisionId);
  if ("failure" in located) return located.failure;
  if (located.block.kind !== "text") {
    return refuse(
      "blockKind",
      `Block ${input.blockId} is a ${located.block.kind} block and carries no runs.`,
    );
  }

  const role = input.role ?? located.block.role;
  return commit(
    "SET b.runs = $runs, b.role = $role",
    {
      bNodeId: nodeRef(input.blockId),
      runs: normalizeRuns(input.runs),
      // A null clears the property: an ordinary paragraph stores no role.
      role: role === "paragraph" ? null : role,
    },
    `revise block ${input.blockId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.blockId,
      revisionId: await revisionOf(input.blockId),
      dataRevision,
    }),
  );
}

/**
 * Fills a media block with the bytes that were made for it, keeping its
 * identity and its place (`BO_0273_017`).
 *
 * This is how a proposed generation stops being pending: the same block, the
 * same candidate, now carrying the reference — so the reader answers the
 * proposal they were already looking at rather than a second one appearing
 * beside it. The box travels with it, because the blob reference carries no
 * dimensions, and `source` is replaced whole by whatever made the bytes.
 *
 * A block that is not a media block is refused: the reference would be inert
 * data on a type that does not recognize it.
 */
export async function fillMediaBlock(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly baseRevisionId: string;
  readonly reference: BlobReference;
  readonly width?: number;
  readonly height?: number;
  readonly source?: Record<string, unknown>;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  const located = locate(loaded.document, input.blockId, input.baseRevisionId);
  if ("failure" in located) return located.failure;
  if (located.block.kind !== "image" && located.block.kind !== "video") {
    return refuse(
      "blockKind",
      `Block ${input.blockId} is a ${located.block.kind} block and holds no picture.`,
    );
  }

  return commit(
    "SET b.reference = $reference, b.width = $width, b.height = $height, b.source = $source",
    {
      bNodeId: nodeRef(input.blockId),
      reference: input.reference,
      // A null clears the property, as an ordinary paragraph stores no role:
      // a picture whose maker reported no dimensions stores none.
      width: input.width ?? null,
      height: input.height ?? null,
      source: input.source ?? null,
    },
    `fill block ${input.blockId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.blockId,
      revisionId: await revisionOf(input.blockId),
      dataRevision,
    }),
  );
}

/**
 * Revises a table whole (`BO_0287_009`): its columns, rows and caption, on
 * the base revision the caller names, keeping its identity and its place. A
 * cell outside its column's type is refused naming the cell and the column,
 * before anything is sent.
 *
 * A cell edit, a row or a column added or removed on a table that a file
 * stands behind drops the reference and the row count, since the rows no
 * longer are the file's first hundred; a caption or a column's type changed
 * keeps them, since no cell changed. The same rule as a run's replace (user
 * decision, 2026-09-23), applied to a person.
 */
/**
 * An equation revised whole (`BO_0290_012`): its source, its caption and its
 * ask for a number, each written by property, so a revise that leaves the
 * caption out clears it and one that leaves `numbered` out takes the number
 * away — as an absent role clears a role. The block keeps its identity and its
 * place, and the numbers of every equation below it follow on the next read
 * with nothing written to them.
 */
export async function reviseEquation(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly baseRevisionId: string;
  readonly tex: string;
  readonly caption?: string;
  readonly numbered?: boolean;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  const located = locate(loaded.document, input.blockId, input.baseRevisionId);
  if ("failure" in located) return located.failure;
  if (located.block.kind !== "equation") {
    return refuse("blockKind", `Block ${input.blockId} is a ${located.block.kind} block and holds no equation.`);
  }
  if (input.tex.trim() === "") {
    return refuse("equationShape", "An equation carries the tex it is set from.");
  }
  return commit(
    "SET b.tex = $tex, b.caption = $caption, b.numbered = $numbered",
    {
      bNodeId: nodeRef(input.blockId),
      tex: input.tex,
      // A null clears the property, as an ordinary paragraph stores no role.
      caption: input.caption === undefined || input.caption.trim() === "" ? null : input.caption.trim(),
      numbered: input.numbered === true ? true : null,
    },
    `revise equation ${input.blockId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.blockId,
      revisionId: await revisionOf(input.blockId),
      dataRevision,
    }),
  );
}

/**
 * A figure's or a table's caption and its ask for a number (`BO_0295_008`),
 * set by property on the block's base revision: a picture's and an accepted
 * output's caption and ask, a table's ask — a table's caption is its own
 * `reviseTable`'s. A revise that leaves the caption out clears it and one that
 * leaves `numbered` out takes the number away, as an equation's does; the
 * figures and tables below follow on the next read with nothing written to
 * them. An output still proposed is not in the document this read answers, so
 * it is refused as unknown until the person accepts it: its caption and number
 * are the person's to set, after the kernel's proposal of what ran.
 */
export async function setFigure(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly baseRevisionId: string;
  readonly caption?: string;
  readonly numbered?: boolean;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  const located = locate(loaded.document, input.blockId, input.baseRevisionId);
  if ("failure" in located) return located.failure;
  const kind = located.block.kind;
  // A code block is numbered as a listing, with a caption of its own, the way
  // a picture is — one write of the two properties, never through the source
  // revise (`BO_0303_008`).
  if (kind !== "image" && kind !== "output" && kind !== "table" && kind !== "sourcecode") {
    return refuse("blockKind", `Block ${input.blockId} is a ${kind} block, and only a picture, an output, a table or a code block is numbered as a figure, a table or a listing.`);
  }
  const numbered = input.numbered === true ? true : null;
  if (kind === "table") {
    if (input.caption !== undefined) {
      return refuse("figureShape", "A table's caption is revised with the table.");
    }
    return commit(
      "SET b.numbered = $numbered",
      { bNodeId: nodeRef(input.blockId), numbered },
      `number table ${input.blockId}`,
      async (dataRevision, revisionOf) => ({ blockId: input.blockId, revisionId: await revisionOf(input.blockId), dataRevision }),
    );
  }
  return commit(
    "SET b.caption = $caption, b.numbered = $numbered",
    {
      bNodeId: nodeRef(input.blockId),
      caption: input.caption === undefined || input.caption.trim() === "" ? null : input.caption.trim(),
      numbered,
    },
    `caption figure ${input.blockId}`,
    async (dataRevision, revisionOf) => ({ blockId: input.blockId, revisionId: await revisionOf(input.blockId), dataRevision }),
  );
}

/**
 * Revises a code block's source and language on its base revision, keeping
 * the block's identity (`BO_0289_018`). A person types the code in place;
 * each settled edit is one write of the whole block, as a table's is, and an
 * empty language clears it.
 */
export async function reviseCode(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly baseRevisionId: string;
  readonly source: string;
  readonly language?: string;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  const located = locate(loaded.document, input.blockId, input.baseRevisionId);
  if ("failure" in located) return located.failure;
  if (located.block.kind !== "sourcecode") {
    return refuse("blockKind", `Block ${input.blockId} is a ${located.block.kind} block and holds no code.`);
  }
  const language = input.language === undefined || input.language.trim() === "" ? null : input.language.trim();
  // A settled edit is pretty-printed before it is written, while the
  // document's switch is on; what cannot be formatted is written exactly as
  // typed, and nothing is said. BO_0296_015
  const source = formatsCode(loaded.document) ? await formatSource(input.source, language ?? undefined) : input.source;
  return commit(
    "SET b.source = $source, b.language = $language",
    { bNodeId: nodeRef(input.blockId), source, language },
    `revise code ${input.blockId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.blockId,
      revisionId: await revisionOf(input.blockId),
      dataRevision,
    }),
  );
}

export async function reviseTable(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly baseRevisionId: string;
  readonly columns: readonly TableColumn[];
  readonly rows: readonly TableRow[];
  readonly caption?: string;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  const located = locate(loaded.document, input.blockId, input.baseRevisionId);
  if ("failure" in located) return located.failure;
  if (located.block.kind !== "table") {
    return refuse("blockKind", `Block ${input.blockId} is a ${located.block.kind} block and holds no table.`);
  }
  const misfit = checkTable(input.columns, input.rows);
  if (misfit !== null) return refuse("tableShape", misfit.failure);

  const held = located.block;
  const sameCells =
    held.rows.length === input.rows.length &&
    held.columns.length === input.columns.length &&
    held.rows.every((row, index) => row.every((cell, column) => cell === input.rows[index]?.[column]));
  const keepFile = held.file !== undefined && sameCells;
  const caption = input.caption === undefined || input.caption.trim() === "" ? null : input.caption.trim();
  const statement = keepFile
    ? "SET b.columns = $columns, b.rows = $rows, b.caption = $caption"
    : "SET b.columns = $columns, b.rows = $rows, b.caption = $caption, b.reference = $reference, b.rowCount = $rowCount";
  return commit(
    statement,
    {
      bNodeId: nodeRef(input.blockId),
      columns: input.columns.map((column) => ({ name: column.name, type: column.type })),
      rows: input.rows.map((row) => [...row]),
      // A null clears the property, as an ordinary paragraph stores no role.
      caption,
      ...(keepFile ? {} : { reference: null, rowCount: null }),
    },
    `revise table ${input.blockId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.blockId,
      revisionId: await revisionOf(input.blockId),
      dataRevision,
    }),
  );
}

/**
 * Sets a text block's standing on the disposition scale, keeping its identity,
 * text and position: one property on one node, so its inverse is the previous
 * value, which the caller holds. Neutral clears the property rather than
 * storing a value for it, as a paragraph stores no role; the graph's `text`
 * declaration refuses any value not on the scale. BO_0227_010
 */
export async function setBlockDisposition(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly baseRevisionId: string;
  readonly standing: Standing;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  const located = locate(loaded.document, input.blockId, input.baseRevisionId);
  if ("failure" in located) return located.failure;
  if (located.block.kind !== "text") {
    return refuse(
      "blockKind",
      `Block ${input.blockId} is a ${located.block.kind} block and carries no standing.`,
    );
  }
  return commit(
    "SET b.disposition = $disposition",
    {
      bNodeId: nodeRef(input.blockId),
      // A null clears the property: a neutral block stores no disposition.
      disposition: storedValue(input.standing),
    },
    `set the standing of block ${input.blockId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.blockId,
      revisionId: await revisionOf(input.blockId),
      dataRevision,
    }),
  );
}

/**
 * Splits a text block at a character position. The head keeps the block's
 * identity and the tail becomes a new block directly after it, carrying the
 * same role: a split is a structural gesture, and changing what the
 * continuation is called is a separate decision the editor makes.
 */
export async function splitTextBlock(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly baseRevisionId: string;
  readonly at: number;
  /** The tail's identity, when the caller chose it: an editor that draws the
   * split before it lands names the block it drew. CA_0045_004 */
  readonly tailBlockId?: string;
  /** The head's words as the caller holds them, split in place of the runs at
   * the base revision, and its role: an editor that split after typing sends
   * both with the split, so the head is written once rather than revised and
   * then split inside the kernel's per-node floor. DO_0015_001 */
  readonly runs?: readonly Run[];
  readonly role?: TextRole;
}): Promise<GraphOutcome<SplitBlocks>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  const located = locate(loaded.document, input.blockId, input.baseRevisionId);
  if ("failure" in located) return located.failure;
  const block = located.block;
  if (block.kind !== "text") {
    return refuse("blockKind", `A ${block.kind} block does not split.`);
  }
  if (!Number.isInteger(input.at) || input.at < 0) {
    return refuse("splitPoint", "A split happens at a character position.");
  }

  const source = input.runs === undefined ? block.runs : normalizeRuns(input.runs);
  const [head, tail] = splitRuns(source, input.at);
  const role = input.role ?? block.role;
  const order = orderFor(loaded.document.blocks, { after: input.blockId });
  if ("failure" in order) return order.failure;

  // A chosen identity must name nothing yet. A CREATE over a node that exists
  // would write a revision of it rather than a new block, so the name is read
  // first and one already taken is a conflict that writes nothing.
  if (input.tailBlockId !== undefined) {
    const taken = await query({
      statement: "MATCH (n {id: $id}) RETURN GRAPH n",
      parameters: { id: input.tailBlockId },
      purpose: "split tail identity",
    });
    if (taken.outcome === "success") {
      const node = nodeOf(taken.result, input.tailBlockId);
      if (node !== undefined) return conflict(node.id, "", node.revision.id);
    } else if (taken.outcome !== "noResult") {
      return taken as GraphOutcome<SplitBlocks>;
    }
  }
  const tailBlockId = input.tailBlockId ?? randomUUID();
  const parameters: Record<string, unknown> = {
    bNodeId: nodeRef(input.blockId),
    head,
    // A null clears the property: an ordinary paragraph stores no role.
    role: role === "paragraph" ? null : role,
    dref: nodeRef(input.documentId),
    tref: nodeRef(tailBlockId),
  };
  // The tail carries the block's standing as it carries its role: the reader
  // gave that standing to the words, and a split does not change the words'
  // standing. BO_0227_010
  const standing = storedValue(block.standing);
  const tailContent: Record<string, unknown> = {
    id: tailBlockId,
    order: order.order,
    runs: tail,
    ...(role === "paragraph" ? {} : { role }),
    ...(standing === null ? {} : { disposition: standing }),
  };
  const statement = [
    "SET b.runs = $head, b.role = $role",
    `CREATE (t:text {${properties("t", tailContent, parameters, true)}})`,
    `RELATE dref -[c:${CONTAINS}]-> tref`,
  ].join("; ");

  return commit(statement, parameters, `split block ${input.blockId}`, async (dataRevision, revisionOf) => ({
    blockId: input.blockId,
    revisionId: await revisionOf(input.blockId),
    tailBlockId,
    tailRevisionId: await revisionOf(tailBlockId),
    dataRevision,
  }));
}

/**
 * Merges one text block into another, which retires the block that was merged
 * away. A block leaves a document only by becoming retired, so what a merge
 * absorbed stays recoverable rather than becoming unreachable.
 */
export async function mergeTextBlocks(input: {
  readonly documentId: string;
  readonly intoBlockId: string;
  readonly intoBaseRevisionId: string;
  readonly blockId: string;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;

  const into = loaded.document.blocks.find(
    (candidate) => candidate.blockId === input.intoBlockId,
  );
  const from = loaded.document.blocks.find(
    (candidate) => candidate.blockId === input.blockId,
  );
  if (into === undefined || from === undefined) {
    return refuse("unknownBlock", "Both blocks of a merge are in the document.");
  }
  if (into.kind !== "text" || from.kind !== "text") {
    return refuse(
      "incompatibleMerge",
      `A ${into.kind} block and a ${from.kind} block do not merge.`,
    );
  }
  if (into.blockId === from.blockId) {
    return refuse("incompatibleMerge", "A block does not merge into itself.");
  }
  if (into.revisionId !== input.intoBaseRevisionId) {
    return conflict(into.blockId, input.intoBaseRevisionId, into.revisionId);
  }

  // The absorbed block's claims move to the survivor with the words that
  // carried them: each `asserts` is closed and made again from the survivor
  // in the same script, so a relation anchored on the claim keeps its end.
  // BO_0244_007
  const parameters: Record<string, unknown> = {
    iNodeId: nodeRef(input.intoBlockId),
    runs: normalizeRuns([...into.runs, ...from.runs]),
    cRelationId: from.containmentId,
    dref: nodeRef(input.documentId),
    fref: nodeRef(from.blockId),
  };
  const statements = ["SET i.runs = $runs", "CLOSE c", `RELATE dref -[r:${RETIRED}]-> fref`];
  const carried = await query({
    statement: `MATCH (b)-[a:${ASSERTS}]->(c) RETURN GRAPH b, a, c ROOT b`,
    roots: [nodeRef(from.blockId)],
    unbounded: true,
    purpose: "claims of the absorbed block",
  });
  if (carried.outcome !== "success" && carried.outcome !== "noResult") return carried as GraphOutcome<never>;
  const asserted = carried.outcome === "success" ? carried.result.relations : [];
  asserted
    .filter((relation) => relation.type === ASSERTS && relation.validity.status === "active" && relation.fromNodeId === nodeRef(from.blockId))
    .forEach((relation, index) => {
      parameters[`a${index}RelationId`] = relation.id;
      parameters[`a${index}From`] = nodeRef(from.blockId);
      parameters[`m${index}i`] = nodeRef(input.intoBlockId);
      parameters[`m${index}c`] = relation.to.nodeId ?? "";
      statements.push(`CLOSE a${index}`, `RELATE m${index}i -[m${index}a:${ASSERTS}]-> m${index}c`);
    });

  return commit(
    statements.join("; "),
    parameters,
    `merge block ${input.blockId} into ${input.intoBlockId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.intoBlockId,
      revisionId: await revisionOf(input.intoBlockId),
      dataRevision,
    }),
  );
}

/**
 * Moves a block to another placement among its siblings. Ordering lives on the
 * block, so a reorder is one revision and the containment relation is
 * untouched.
 */
export async function moveBlock(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly baseRevisionId: string;
  readonly placement: Placement;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  const located = locate(loaded.document, input.blockId, input.baseRevisionId);
  if ("failure" in located) return located.failure;
  if (
    ("before" in input.placement && input.placement.before === input.blockId) ||
    ("after" in input.placement && input.placement.after === input.blockId)
  ) {
    return refuse("unknownAnchor", "A block does not move relative to itself.");
  }

  const order = orderFor(loaded.document.blocks, input.placement);
  if ("failure" in order) return order.failure;

  return commit(
    "SET b.order = $order",
    { bNodeId: nodeRef(input.blockId), order: order.order },
    `move block ${input.blockId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.blockId,
      revisionId: await revisionOf(input.blockId),
      dataRevision,
    }),
  );
}

/**
 * Moves a retired block without restoring it (BO_0263_012): its key is
 * written and nothing else, so it stays retired, drawn where the reader put
 * it, and *Restore* brings it back there. The key is minted against the
 * document's blocks as a move's is, and a `{between}` placement names the
 * keys of the rows drawn on either side.
 */
export async function moveRetiredBlock(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly baseRevisionId: string;
  readonly placement: Placement;
}): Promise<GraphOutcome<WrittenBlock>> {
  const contained = await loadDocument(input.documentId);
  if (!contained.ok) return contained.outcome;
  const loaded = await loadDocument(input.documentId, RETIRED);
  if (!loaded.ok) return loaded.outcome;
  const retired = assembleRetired(loaded.graph, input.documentId).find(
    (block) => block.blockId === input.blockId,
  );
  if (retired === undefined) {
    return refuse("notRetired", `Block ${input.blockId} is not retired from document ${input.documentId}.`);
  }
  if (retired.revisionId !== input.baseRevisionId) {
    return refuse("staleBase", `Block ${input.blockId} changed since revision ${input.baseRevisionId}.`);
  }
  const order = orderFor(contained.document.blocks, input.placement);
  if ("failure" in order) return order.failure;
  return commit(
    "SET b.order = $order",
    { bNodeId: nodeRef(input.blockId), order: order.order },
    `move retired block ${input.blockId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.blockId,
      revisionId: await revisionOf(input.blockId),
      dataRevision,
    }),
  );
}

/**
 * Retires a block: its containment closes and the document records it as
 * retired, so it leaves the reading order while staying reachable from the
 * document it belonged to. The close and the relation travel in one script
 * with the document as an endpoint, which is what lets the kernel's gate
 * verify the close against content it can see.
 */
export async function retireBlock(input: {
  readonly documentId: string;
  readonly blockId: string;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  const located = locate(loaded.document, input.blockId);
  if ("failure" in located) return located.failure;
  // A block with focused work stays until the child is deleted: nothing
  // cascades, and the child is named so the reader knows what stands in the
  // way. CA_0047_002
  const children = await childrenOf(DOCUMENT_TARGET_KIND, [input.blockId]);
  if (children.outcome !== "success") return children as GraphOutcome<never>;
  const child = children.result.get(input.blockId);
  if (child !== undefined) {
    return refuse(
      "focusedWork",
      `This block has focused work, “${child.title}”. Delete that document first.`,
    );
  }

  return commit(
    ["CLOSE c", `RELATE dref -[r:${RETIRED}]-> bref`].join("; "),
    {
      cRelationId: located.block.containmentId,
      dref: nodeRef(input.documentId),
      bref: nodeRef(input.blockId),
    },
    `retire block ${input.blockId}`,
    async (dataRevision) => ({
      blockId: input.blockId,
      revisionId: located.block.revisionId,
      dataRevision,
    }),
  );
}

/** The blocks retired from a document, newest position order first read. */
export async function readRetiredBlocks(
  documentId: string,
): Promise<GraphOutcome<readonly BlockView[]>> {
  const loaded = await loadDocument(documentId, RETIRED);
  if (!loaded.ok) return loaded.outcome;
  return { outcome: "success", result: assembleRetired(loaded.graph, documentId) };
}

/**
 * Restores a retired block at a placement, minting a fresh order key rather
 * than assuming the position it used to hold is still free.
 *
 * A block that is already contained is refused: containment is a tree, and a
 * second active parent is exactly what that rules out. Validation does not
 * hold this line for graph-declared types, so the shell checks it before it
 * writes (`block-document-model.md`).
 */
export async function restoreBlock(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly placement: Placement;
}): Promise<GraphOutcome<WrittenBlock>> {
  const contained = await loadDocument(input.documentId);
  if (!contained.ok) return contained.outcome;
  if (contained.document.blocks.some((block) => block.blockId === input.blockId)) {
    return refuse(
      "singleParent",
      `Block ${input.blockId} already has an active containment parent.`,
    );
  }

  const loaded = await loadDocument(input.documentId, RETIRED);
  if (!loaded.ok) return loaded.outcome;
  const retired = assembleRetired(loaded.graph, input.documentId).find(
    (block) => block.blockId === input.blockId,
  );
  if (retired === undefined) {
    return refuse(
      "notRetired",
      `Block ${input.blockId} is not retired from document ${input.documentId}.`,
    );
  }

  const order = orderFor(contained.document.blocks, input.placement);
  if ("failure" in order) return order.failure;

  return commit(
    ["SET b.order = $order", "CLOSE r", `RELATE dref -[c:${CONTAINS}]-> bref`].join("; "),
    {
      bNodeId: nodeRef(input.blockId),
      order: order.order,
      rRelationId: retired.containmentId,
      dref: nodeRef(input.documentId),
      bref: nodeRef(input.blockId),
    },
    `restore block ${input.blockId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.blockId,
      revisionId: await revisionOf(input.blockId),
      dataRevision,
    }),
  );
}

/**
 * Deletes a document by retiring its node: the established revision is
 * archived and the node leaves current reads.
 *
 * The graph keeps every revision, every relation, and every closed validity:
 * dropping them would rewrite history rather than reclaim space. Its blocks
 * are left as they stand. A block is reachable only through its document, so
 * retiring each one would multiply the write for no readable difference.
 *
 * Deleting a document that is unknown or already deleted is refused rather
 * than answered as success, because the caller asked about something that is
 * not there.
 */
export async function deleteDocument(input: {
  readonly documentId: string;
  readonly baseRevisionId: string;
}): Promise<GraphOutcome<WrittenDocument>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  if (loaded.document.revisionId !== input.baseRevisionId) {
    return conflict(input.documentId, input.baseRevisionId, loaded.document.revisionId);
  }

  // Focused work closes its `focuses` edge in the same script, so a block
  // never points at a document that answers nothing. CA_0047_002
  const focus = await focusOf(DOCUMENT_TARGET_KIND, input.documentId);
  if (focus.outcome !== "success") return focus as GraphOutcome<never>;
  const parameters: Record<string, unknown> = { dNodeId: nodeRef(input.documentId) };
  const statements = ["RETIRE d"];
  if (focus.result !== null) {
    statements.push("CLOSE f");
    parameters["fRelationId"] = focus.result.relationId;
  }
  return commit(
    statements.join("; "),
    parameters,
    `delete document ${input.documentId}`,
    async (dataRevision) => ({
      documentId: input.documentId,
      revisionId: input.baseRevisionId,
      dataRevision,
    }),
  );
}

/**
 * When a document last changed and how many times.
 *
 * A change is one graph data revision that touched the document: a revision
 * of its own node, of a block in its reading order or among its retired
 * blocks, or the creation or closing of a containment or retirement between
 * them. The stamps are read from CCGW's own history — metadata only, no
 * content — and a data revision is counted once however many records it
 * wrote, so a split, which writes two blocks together, is the one change it
 * was.
 */
export async function readDocumentChanges(
  documentId: string,
): Promise<GraphOutcome<ChangeSummary>> {
  const revisions = new Set<number>();
  let lastWrittenAt = 0;
  const stamp = (dataRevision: number | undefined, at: number | undefined): void => {
    if (dataRevision !== undefined && dataRevision > 0) revisions.add(dataRevision);
    if (at !== undefined && at > lastWrittenAt) lastWrittenAt = at;
  };

  for (const relation of [CONTAINS, RETIRED] as const) {
    const outcome = await query({
      statement: CONTAINMENT_PATTERN(relation, " INCLUDE HISTORY"),
      roots: [nodeRef(documentId)],
      unbounded: true,
      metadataOnly: true,
      purpose: "document changes",
    });
    if (outcome.outcome === "noResult") continue;
    if (outcome.outcome !== "success") return outcome as GraphOutcome<ChangeSummary>;
    // The document by id and type, whatever revision the history read puts
    // first: a metadata-only read with history answers a document that
    // gained carry-forward revisions from accepted groups with an archived
    // revision as its current one, and the strict established check turned
    // every such document's changes into a 404 (found in the BO_0245
    // walk-through, 2026-09-14).
    if (relation === CONTAINS && !outcome.result.nodes.some((node) => node.id === nodeRef(documentId) && typeOf(node) === DOCUMENT_TYPE)) {
      return { outcome: "noResult", detail: `No document ${documentId} in this graph.` };
    }
    for (const node of outcome.result.nodes) {
      stamp(node.revision.dataRevision, node.revision.createdAt);
      for (const prior of node.history ?? []) stamp(prior.dataRevision, prior.createdAt);
    }
    for (const rel of outcome.result.relations) {
      stamp(rel.dataRevision, rel.createdAt);
      stamp(rel.validity.dataRevision, rel.validity.updatedAt);
    }
  }

  return {
    outcome: "success",
    result: {
      changeCount: revisions.size,
      lastWrittenAt: lastWrittenAt === 0 ? null : new Date(lastWrittenAt).toISOString(),
    },
  };
}

/**
 * What a caller proposes for a document. Each kind carries everything its
 * operation needs, so a human answers one item without the rest of the group.
 */
export type DocumentProposalItem =
  | {
      readonly kind: "replace";
      readonly blockId: string;
      readonly baseRevisionId: string;
      readonly runs?: readonly Run[];
      readonly role?: TextRole;
    }
  | {
      readonly kind: "insert";
      readonly block: NewBlock;
      readonly placement: Placement;
    }
  | { readonly kind: "remove"; readonly blockId: string }
  | {
      readonly kind: "move";
      readonly blockId: string;
      readonly baseRevisionId: string;
      readonly placement: Placement;
    }
  /** The work items (`BO_0244_010`): a block's kind, a claim added or
   * revised, a relation with its reason, a relation's new reason, and the
   * blocks a block was derived from. */
  | { readonly kind: "kind"; readonly blockId: string; readonly blockKind: string | null }
  | { readonly kind: "claim"; readonly blockId: string; readonly claimId?: string; readonly text: readonly Run[] }
  | { readonly kind: "relate"; readonly relation: RelationInput }
  | { readonly kind: "reason"; readonly relationId: string; readonly reason: readonly Run[] }
  /** A relation's lifecycle state, proposed by a run after a pressure
   * judgement: exercised, needsReview, orphaned or retired. BO_0248_013 */
  | { readonly kind: "state"; readonly relationId: string; readonly state: RelationState }
  /** The root's phase, proposed by a run answering a commit command or by a
   * person the policy lets propose but not establish (`BO_0249_011`). */
  | { readonly kind: "phase"; readonly phase: Phase; readonly supersededBy?: string }
  | { readonly kind: "derive"; readonly blockId: string; readonly from: readonly string[] };

export interface StagedItem {
  readonly itemId: string;
  readonly kind: DocumentProposalItem["kind"];
  /** The block it concerns: the one it names, or the one it would insert. */
  readonly blockId: string;
}

export interface StagedProposal {
  readonly groupId: string;
  readonly items: readonly StagedItem[];
  readonly dataRevision: string;
}

/**
 * An item's identity, as the surface hands it back to be answered: the group,
 * the kind, and the members the decision covers. A replace, move or insert is
 * one member — the staged node, whose containment travels with it — while a
 * remove is two, the retirement relation the proposal stages and the
 * containment its close intent names, decided in that order.
 */
const itemId = (groupId: string, kind: string, members: readonly string[]): string =>
  [groupId, kind, ...members].join("|");

const parseItemId = (
  id: string,
): { readonly groupId: string; readonly kind: string; readonly members: readonly string[] } | null => {
  const [groupId, kind, ...members] = id.split("|");
  if (groupId === undefined || kind === undefined || members.length === 0) return null;
  return { groupId, kind, members };
};

/**
 * Stages a group of proposed changes against one document. Nothing here
 * changes the document: content an item introduces is staged as a candidate
 * revision, and the relations placing or retiring a block are staged beside
 * it, written into truth when the item is accepted.
 *
 * Order keys are minted here, against the document as it stands, and each
 * insert accounts for the ones staged before it in the same group. A key
 * always sorts somewhere, so an accepted insert lands where its item said even
 * when the document has moved since. Staleness of a replace or a move is
 * CCGW's per-member drift judgement at acceptance.
 */
export async function proposeDocumentChanges(input: {
  readonly documentId: string;
  readonly items: NonEmpty<DocumentProposalItem>;
  readonly request?: unknown;
}): Promise<GraphOutcome<StagedProposal>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;

  const groupId = `node:chg-${randomBytes(8).toString("hex")}`;
  const siblings: BlockView[] = [...loaded.document.blocks];
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  const staged: StagedItem[] = [];
  const documentNode = nodeRef(input.documentId);

  const isOutcome = (value: unknown): value is GraphOutcome<never> =>
    typeof value === "object" && value !== null && "outcome" in value;

  // The work items that may need a read before they compile: a relation's
  // ends, and the claims this document asserts. BO_0244_010
  const claims = await readClaims(loaded.document.blocks.map((block) => block.blockId));
  if (claims.outcome !== "success") return claims as GraphOutcome<never>;
  const work = new Map<number, { readonly statements: readonly string[]; readonly item: StagedItem }>();
  for (const [index, item] of input.items.entries()) {
    const alias = `i${index}`;
    if (item.kind === "relate") {
      const compiled = await compileRelate(alias, groupId, item.relation, loaded.document, claims.result.byBlock, parameters);
      if ("failure" in compiled) return compiled.failure;
      work.set(index, compiled);
    }
    if (item.kind === "reason") {
      if (item.reason.length === 0) return refuse("noReason", "A relation gives its reason.");
      const found = await readRelationEnds([nodeRef(item.relationId)]);
      if (found.outcome !== "success") return found as GraphOutcome<never>;
      if (found.result.length === 0) return refuse("unknownRelation", `Relation ${item.relationId} is not in the graph.`);
      parameters[`${alias}NodeId`] = nodeRef(item.relationId);
      parameters[`${alias}reason`] = normalizeRuns([...item.reason]);
      const source = claims.result.blockOf.get(found.result[0]?.source ?? "");
      const targetBlock = claims.result.blockOf.get(found.result[0]?.target ?? "");
      work.set(index, {
        statements: [`SET ${alias}.reason = $${alias}reason`],
        item: { itemId: itemId(groupId, "reason", [nodeRef(item.relationId)]), kind: "reason", blockId: source ?? targetBlock ?? "" },
      });
    }
    if (item.kind === "state") {
      const found = await readRelationEnds([nodeRef(item.relationId)]);
      if (found.outcome !== "success") return found as GraphOutcome<never>;
      if (found.result.length === 0) return refuse("unknownRelation", `Relation ${item.relationId} is not in the graph.`);
      parameters[`${alias}NodeId`] = nodeRef(item.relationId);
      parameters[`${alias}state`] = item.state;
      const source = claims.result.blockOf.get(found.result[0]?.source ?? "");
      const targetBlock = claims.result.blockOf.get(found.result[0]?.target ?? "");
      work.set(index, {
        statements: [`SET ${alias}.state = $${alias}state`],
        item: { itemId: itemId(groupId, "state", [nodeRef(item.relationId)]), kind: "state", blockId: source ?? targetBlock ?? "" },
      });
    }
    if (item.kind === "phase") {
      if (!isPhase(item.phase)) return refuse("unknownPhase", `A phase is proposed, accepted or superseded, not ${String(item.phase)}.`);
      if (item.supersededBy !== undefined && item.phase !== "superseded") {
        return refuse("supersededByWithoutSuperseded", "supersededBy names the successor of a superseded root; with another phase it means nothing.");
      }
      parameters[`${alias}NodeId`] = documentNode;
      parameters[`${alias}phase`] = item.phase;
      let statement = `SET ${alias}.${PHASE_PROPERTY} = $${alias}phase`;
      if (item.supersededBy !== undefined) {
        parameters[`${alias}by`] = item.supersededBy;
        statement = `${statement}, ${alias}.${SUPERSEDED_BY_PROPERTY} = $${alias}by`;
      }
      work.set(index, { statements: [statement], item: { itemId: itemId(groupId, "phase", [documentNode]), kind: "phase", blockId: "" } });
    }
  }
  try {
  input.items.forEach((item, index) => {
    const alias = `i${index}`;
    if (item.kind === "insert") {
      const order = orderFor(siblings, item.placement);
      if ("failure" in order) throw order.failure;
      siblings.push({
        blockId: `staged:${order.order}`,
        revisionId: "",
        containmentId: "",
        kind: "divider",
        order: order.order,
      });
      const blockId = randomUUID();
      parameters[`${alias}d`] = documentNode;
      parameters[`${alias}n`] = nodeRef(blockId);
      statements.push(
        `CREATE (${alias}:${blockType(item.block)} {${properties(alias, { id: blockId, ...blockContentFor(item.block, order.order) }, parameters, false)}})`,
        `RELATE ${alias}d -[${alias}c:${CONTAINS}]-> ${alias}n`,
      );
      staged.push({ itemId: itemId(groupId, "insert", [nodeRef(blockId)]), kind: "insert", blockId });
      return;
    }

    if (item.kind === "relate" || item.kind === "reason" || item.kind === "state" || item.kind === "phase") {
      // Resolved before the loop, since an end may need a read.
      const compiled = work.get(index);
      if (compiled === undefined) throw refuse("itemShape", "A work item was not compiled.");
      statements.push(...compiled.statements);
      staged.push(compiled.item);
      return;
    }

    const block = loaded.document.blocks.find((candidate) => candidate.blockId === item.blockId);
    if (block === undefined) {
      throw refuse("unknownBlock", `Block ${item.blockId} is not in this document.`);
    }
    const target = nodeRef(item.blockId);

    if (item.kind === "kind") {
      if (block.kind !== "text") throw refuse("blockKind", `Block ${item.blockId} is a ${block.kind} block; only a text block carries a kind.`);
      if (item.blockKind !== null && !isBlockKind(item.blockKind)) throw refuse("blockKind", `${item.blockKind} is not a kind a block can be.`);
      parameters[`${alias}NodeId`] = target;
      parameters[`${alias}kind`] = item.blockKind;
      statements.push(`SET ${alias}.kind = $${alias}kind`);
      staged.push({ itemId: itemId(groupId, "kind", [target]), kind: "kind", blockId: item.blockId });
      return;
    }
    if (item.kind === "claim") {
      if (item.text.length === 0) throw refuse("emptyClaim", "A claim carries words.");
      if (item.claimId !== undefined) {
        const known = (claims.result.byBlock[item.blockId] ?? []).some((claim) => claim.claimId === item.claimId);
        if (!known) throw refuse("unknownClaim", `Claim ${item.claimId} is not asserted by block ${item.blockId}.`);
        parameters[`${alias}NodeId`] = nodeRef(item.claimId);
        parameters[`${alias}text`] = normalizeRuns([...item.text]);
        statements.push(`SET ${alias}.text = $${alias}text`);
        staged.push({ itemId: itemId(groupId, "claim", [nodeRef(item.claimId)]), kind: "claim", blockId: item.blockId });
        return;
      }
      const drafted = draftClaimScript(alias, item.blockId, item.text, parameters, false);
      statements.push(...drafted.statements);
      staged.push({ itemId: itemId(groupId, "claim", [nodeRef(drafted.claimId)]), kind: "claim", blockId: item.blockId });
      return;
    }
    if (item.kind === "derive") {
      if (item.from.length === 0) throw refuse("emptyDerive", `A derive names the blocks ${item.blockId} rests on.`);
      item.from.forEach((sourceId, n) => {
        if (sourceId === item.blockId) throw refuse("selfDerive", "A block is not derived from itself.");
        const edge = `${alias}d${n}`;
        parameters[`${edge}b`] = target;
        parameters[`${edge}f`] = nodeRef(sourceId);
        statements.push(`RELATE ${edge}b -[${edge}e:${DERIVED_FROM}]-> ${edge}f`);
      });
      // The members are the staged edges, named by the block until the
      // touched set names them, as a removal's are.
      staged.push({ itemId: itemId(groupId, "derive", [target]), kind: "derive", blockId: item.blockId });
      return;
    }

    if (item.kind === "remove") {
      parameters[`${alias}cRelationId`] = block.containmentId;
      parameters[`${alias}d`] = documentNode;
      parameters[`${alias}b`] = target;
      statements.push(`CLOSE ${alias}c`, `RELATE ${alias}d -[${alias}r:${RETIRED}]-> ${alias}b`);
      // The retirement relation's id is only known once staged; the item is
      // named by the block and resolved to its members when read back.
      staged.push({ itemId: itemId(groupId, "remove", [target, block.containmentId]), kind: "remove", blockId: item.blockId });
      return;
    }

    if (item.kind === "move") {
      if (
        ("before" in item.placement && item.placement.before === item.blockId) ||
        ("after" in item.placement && item.placement.after === item.blockId)
      ) {
        throw refuse("unknownAnchor", "A block does not move relative to itself.");
      }
      const order = orderFor(siblings, item.placement);
      if ("failure" in order) throw order.failure;
      parameters[`${alias}NodeId`] = target;
      parameters[`${alias}order`] = order.order;
      statements.push(`SET ${alias}.order = $${alias}order`);
      staged.push({ itemId: itemId(groupId, "move", [target]), kind: "move", blockId: item.blockId });
      return;
    }

    const assignments: string[] = [];
    parameters[`${alias}NodeId`] = target;
    if (item.runs !== undefined) {
      parameters[`${alias}runs`] = normalizeRuns([...item.runs]);
      assignments.push(`${alias}.runs = $${alias}runs`);
    }
    if (item.role !== undefined) {
      parameters[`${alias}role`] = item.role === "paragraph" ? null : item.role;
      assignments.push(`${alias}.role = $${alias}role`);
    }
    if (assignments.length === 0) {
      throw refuse("emptyReplace", `A replace of ${item.blockId} names runs or a role.`);
    }
    statements.push(`SET ${assignments.join(", ")}`);
    staged.push({ itemId: itemId(groupId, "replace", [target]), kind: "replace", blockId: item.blockId });
  });
  } catch (failure) {
    if (isOutcome(failure)) return failure;
    throw failure;
  }

  const rationale =
    input.request === undefined
      ? `proposal against document ${input.documentId}`
      : `proposal against document ${input.documentId}: ${JSON.stringify(input.request)}`;
  const outcome = await stage(groupId, statements.join("; "), parameters, rationale);
  if (outcome.outcome !== "success") return outcome as GraphOutcome<StagedProposal>;
  // A derivation's members are its staged edges, whose ids exist only once
  // staged: the touched set names them, and the item is renamed by them so
  // it can be answered as it is read back. BO_0244_010
  // Unless the same group revises the block: the edges then travel with
  // the block's own candidate, and answering that item answers them.
  let items: StagedItem[] = staged;
  if (staged.some((item) => item.kind === "derive")) {
    const touched = await touchedSet(groupId);
    if (touched.outcome !== "success") return touched as GraphOutcome<never>;
    items = staged.map((item) => {
      if (item.kind !== "derive") return item;
      const carrier = staged.find((other) => other.blockId === item.blockId && (other.kind === "kind" || other.kind === "replace" || other.kind === "move"));
      if (carrier !== undefined) return { ...item, itemId: carrier.itemId };
      const edges = touched.result.stagedRelations
        .filter((relation) => relation.type === DERIVED_FROM && relation.fromNodeId === nodeRef(item.blockId))
        .map((relation) => relation.id);
      return edges.length === 0 ? item : { ...item, itemId: itemId(groupId, "derive", edges) };
    });
  }
  return {
    outcome: "success",
    result: { groupId, items, dataRevision: outcome.result.dataRevision },
  };
}

/**
 * A `relate` item's script: the relation node and its two edges, and the
 * claim drafted for an end that names a block with the words to draft. The
 * members are the drafted claims and then the relation, decided in that
 * order so the relation is never established with an end that is still a
 * candidate. BO_0244_010
 */
async function compileRelate(
  alias: string,
  groupId: string,
  relation: RelationInput,
  document: DocumentView,
  claims: Readonly<Record<string, readonly ClaimView[]>>,
  parameters: Record<string, unknown>,
): Promise<{ readonly statements: readonly string[]; readonly item: StagedItem } | { readonly failure: GraphOutcome<never> }> {
  if (relation.reason.length === 0) {
    return { failure: refuse("noReason", "A relation gives its reason: the condition that connects its ends, never that they seem related.") };
  }
  const statements: string[] = [];
  const members: string[] = [];
  let anchor = "";
  const resolve = async (suffix: string, end: RelationEndInput): Promise<string | GraphOutcome<never>> => {
    if ("claimId" in end) {
      const found = await query({ statement: `MATCH (c:${CLAIM_TYPE}) RETURN GRAPH c`, roots: [nodeRef(end.claimId)], purpose: "relation end" });
      if (found.outcome !== "success" || !found.result.nodes.some((node) => node.id === nodeRef(end.claimId))) {
        return refuse("unknownClaim", `Claim ${end.claimId} is not in the graph.`);
      }
      return end.claimId;
    }
    const here = document.blocks.find((block) => block.blockId === end.blockId);
    let asserted: readonly ClaimView[];
    if (here !== undefined) {
      if (here.kind === "text" && here.standing === "discarded") {
        return refuse("discardedBlock", `Block ${end.blockId} is discarded; a relation never anchors on a discarded block.`);
      }
      asserted = claims[end.blockId] ?? [];
      if (anchor === "") anchor = end.blockId;
    } else {
      const far = await farBlock(end.blockId);
      if (far.outcome !== "success") return far as GraphOutcome<never>;
      asserted = far.result.claims;
    }
    if (end.claim !== undefined && end.claim.length > 0) {
      const drafted = draftClaimScript(`${alias}${suffix}`, end.blockId, end.claim, parameters, false);
      statements.push(...drafted.statements);
      members.push(nodeRef(drafted.claimId));
      return drafted.claimId;
    }
    if (asserted.length === 1) return (asserted[0] as ClaimView).claimId;
    if (asserted.length === 0) return refuse("noClaim", `Block ${end.blockId} asserts no claim yet; give the claim's words to draft one.`);
    return refuse("severalClaims", `Block ${end.blockId} asserts ${asserted.length} claims; name one by claimId.`);
  };
  const source = await resolve("s", relation.source);
  if (typeof source !== "string") return { failure: source };
  const target = await resolve("t", relation.target);
  if (typeof target !== "string") return { failure: target };
  if (source === target) return { failure: refuse("sameClaim", "A relation's source and target are two claims.") };
  const script = relationScript(alias, { kind: relation.kind, reason: relation.reason, origin: relation.origin ?? "inferred" }, source, target, parameters, false);
  statements.push(...script.statements);
  members.push(nodeRef(script.relationId));
  return {
    statements,
    item: { itemId: itemId(groupId, "relate", members), kind: "relate", blockId: anchor },
  };
}

/** One proposed change, as the surface reviewing it reads it. */
export interface ProposedChange {
  readonly itemId: string;
  readonly groupId: string;
  readonly kind: string;
  /** The block it concerns: the one it names, or the one it would insert. */
  readonly blockId: string;
  /** What the block would say. Absent for a `remove`, which proposes no content. */
  readonly block: BlockView | null;
  /** A proposed claim, for a `claim` item. BO_0244_010 */
  readonly claim?: ClaimView;
  /** A proposed relation, or one whose reason is proposed, for `relate` and `reason`. */
  readonly relation?: RelationView;
  /** The state the relation holds now, for a `state` item proposing another. BO_0248_013 */
  readonly previousState?: string;
  /** The blocks a `derive` item says its block rests on. */
  readonly derivedFrom?: readonly string[];
  /** A relation drawn in another document: only its target is here, so this
   * document counts it and does not draw it. */
  readonly elsewhere?: boolean;
  /** A derived candidate of a system run — a synthesis, frontier, tension,
   * alternative, consequence or next it maintains — drawn in the derived
   * idiom and answered by use, never by icons. BO_0246_006 */
  readonly derived?: boolean;
  /** A `phase` item: the root's proposed phase, its successor when superseded,
   * and the proposer's sentence of consequences (`BO_0249_011`). */
  readonly phase?: Phase;
  readonly supersededBy?: string;
  readonly sentence?: string;
  /** The agent's own short line on the item, recorded by its run (the
   * `agent.run` node's `notes`), shown on the item's mark in place of the
   * derived words. BO_0265_011 */
  readonly note?: string;
  /** The run that refined this item on another run's proposal, and who it
   * was: the candidate's `refinedBy` stamp (the kernel's `BO_0271_003`),
   * resolved to the refining run's provenance node once it has landed; until
   * then the agent is unknown here and the editor takes it from the run's
   * activity. BO_0271_010 */
  readonly refinedBy?: { readonly runId: string; readonly proposer: Proposer };
  /** A withdrawal a run has proposed of this item: the marks the kernel
   * writes on the candidate (`withdrawnBy`, `withdrawnFor`,
   * `withdrawalReason`, its `BO_0286_001`), the run resolved to who it was as
   * a refiner is. The item stays open; the person answers it. BO_0286_008 */
  readonly withdrawal?: { readonly runId: string; readonly proposer: Proposer; readonly successor?: string; readonly reason?: string };
}

/** The kinds a system run derives; its candidates of these are drawn as
 * derived, not as an agent's proposal. BO_0246_006 */
export const DERIVED_KINDS: readonly string[] = ["synthesis", "frontier", "tension", "alternative", "consequence", "next"];

export interface DocumentProposals {
  readonly documentId: string;
  readonly unanswered: number;
  readonly groups: readonly {
    readonly groupId: string;
    readonly items: readonly ProposedChange[];
    /** Who staged the group's candidates — the core's `createdBy` stamps, sorted. BO_0209_006 */
    readonly stagedBy: readonly string[];
    /**
     * Who proposed it: the agent its run's provenance node names, or the
     * person who staged it. Every agent stages as one account, so the stamps
     * alone cannot say which agent it was. BO_0233_001
     */
    readonly proposer: Proposer;
    /** The run that staged it, when an `agent.run` node says so, and when it
     * recorded itself — what the run chips are ordered by. BO_0265_014 */
    readonly run?: { readonly runId: string; readonly stagedAt: number };
  }[];
}

/** The open proposal groups of the graph, by id. */
async function openGroups(): Promise<GraphOutcome<readonly string[]>> {
  const outcome = await query({
    statement: "MATCH (g:ProposalGroup) RETURN GRAPH g",
    unbounded: true,
    purpose: "open proposals",
  });
  if (outcome.outcome === "noResult") return { outcome: "success", result: [] };
  if (outcome.outcome !== "success") return outcome as GraphOutcome<readonly string[]>;
  return {
    outcome: "success",
    result: outcome.result.nodes
      .filter((node) => node.revision.content?.["status"] === "open")
      .map((node) => node.id),
  };
}

/**
 * The unanswered proposals standing against a document, grouped as they were
 * staged. This is the document's own reading of them: what each item would do
 * and to which block, which is what the editor shows against that block.
 *
 * A group names no document. Its members do: a staged relation from the
 * document places or retires a block, and a candidate revision of a block in
 * the document rewrites or moves it. A candidate whose content equals the
 * block's established content is the carry-forward anchor a staged relation
 * hangs on, not a change, and is not shown.
 */
export async function readDocumentProposals(
  documentId: string,
): Promise<GraphOutcome<DocumentProposals>> {
  // Always against truth: read under the tab's branch, the branch's own
  // candidates are the document and no member of it would list, so the
  // person in the branch could settle nothing. Found live in the BO_0250
  // walk-through, 2026-09-15.
  return outsideBranch(() => readDocumentProposalsAgainstTruth(documentId));
}

async function readDocumentProposalsAgainstTruth(
  documentId: string,
): Promise<GraphOutcome<DocumentProposals>> {
  const read = await loadDocument(documentId);
  // A started document's blocks are all its run's inserts. BO_0251_008
  const started = !read.ok && read.outcome.outcome === "noResult" ? await readStarted(documentId) : null;
  if (!read.ok && started?.outcome !== "success") return started ?? (read as { readonly outcome: GraphOutcome<never> }).outcome;
  const loaded = { document: read.ok ? read.document : (started as { readonly result: DocumentView }).result };
  const groupIds = await openGroups();
  if (groupIds.outcome !== "success") return groupIds as GraphOutcome<never>;

  const documentNode = nodeRef(documentId);
  const established = new Map(loaded.document.blocks.map((block) => [nodeRef(block.blockId), block]));
  const claims = await readClaims(loaded.document.blocks.map((block) => block.blockId));
  if (claims.outcome !== "success") return claims as GraphOutcome<never>;
  const groups: { groupId: string; items: ProposedChange[]; stagedBy: string[]; proposer: Proposer; run?: { runId: string; stagedAt: number } }[] = [];
  let unanswered = 0;

  // Only a group that reaches this document is read: its touched set — one
  // cheap core read per open group, all at once — names the nodes it stages
  // and the relations it stages or closes, and a group none of whose nodes or
  // ends is this document's has nothing to answer here. Reading every open
  // group's members instead made a document open wait on every proposal in
  // the instance. BO_0257_008
  const reach = new Set<string>([documentNode, ...established.keys(), ...claims.result.blockOf.keys()]);
  if (claims.result.blockOf.size > 0) {
    const relations = await readRelationsOf([...claims.result.blockOf.keys()]);
    if (relations.outcome !== "success") return relations as GraphOutcome<never>;
    for (const entry of relations.result) reach.add(entry.node.id);
  }
  const touchedSets = await Promise.all(groupIds.result.map((groupId) => touchedSet(groupId)));

  // The groups that reach the document are read all at once and answered in
  // the listing's order: each is its own few reads, and one after another
  // they kept a document with many standing refinements waiting. BO_0257_010
  const readGroup = async (
    groupId: string,
    touched: Awaited<ReturnType<typeof touchedSet>>,
  ): Promise<GraphOutcome<(typeof groups)[number] | null>> => {
      if (touched.outcome !== "success") return touched as GraphOutcome<never>;
      if (!reachesDocument(touched.result, reach)) return { outcome: "success", result: null };
      // A group answered or accepted between the listing and this read has
      // nothing left to show, and its overlay is refused as not open: it is
      // skipped, never the whole read failed for it. Surfaced by the harness
      // once branch groups close in parallel with other suites, 2026-09-15.
      if (touched.result.status !== "open") return { outcome: "success", result: null };
      const candidates = await query({
        statement: "MATCH (n) WHERE n._proposal = $g RETURN GRAPH n ROOT n INCLUDE CANDIDATES",
        parameters: { g: groupId },
        proposalOverlay: groupId,
        unbounded: true,
        purpose: "proposal members",
      });
      if (candidates.outcome === "storageError" && candidates.detail.includes("proposal_not_open")) return { outcome: "success", result: null };
      if (candidates.outcome === "storageError") return candidates as GraphOutcome<never>;
      // Every node the group stamped, and the ones still to be decided. A
      // member keeps the group's stamp once accepted and established, and an
      // established member is nothing to answer: shown again, its card would
      // offer an acceptance the core refuses as not an undecided member. Only
      // candidates are items; the stamps and the run still read from all.
      // Found live in the BO_0248 walk-through.
      const members = new Map(
        candidates.outcome === "success"
          ? candidates.result.nodes
              .filter((node) => node.revision.content?.["_proposal"] === groupId)
              .map((node) => [node.id, node])
          : [],
      );
      const staged = new Map([...members].filter(([, node]) => node.revision.status === "candidate"));

      const items: ProposedChange[] = [];
      const named = new Set<string>();

      // The root's phase, staged on the document node itself (`BO_0249_011`):
      // a candidate of the document whose phase differs from the established
      // one is the transition proposed, drawn as the card, never as a block.
      const documentCandidate = staged.get(documentNode);
      if (documentCandidate !== undefined) {
        const content = contentOf(documentCandidate);
        const proposedPhase = content[PHASE_PROPERTY];
        const currentPhase = loaded.document.phase ?? "proposed";
        if (isPhase(proposedPhase) && proposedPhase !== currentPhase) {
          const group = await query({
            statement: "MATCH (g:ProposalGroup {id: $gid}) RETURN GRAPH g",
            parameters: { gid: bareId(groupId) },
            purpose: "phase proposal's rationale",
          });
          const rationale = group.outcome === "success" ? group.result.nodes[0]?.revision.content?.["rationale"] : undefined;
          const supersededBy = content[SUPERSEDED_BY_PROPERTY];
          named.add(documentNode);
          items.push({
            itemId: itemId(groupId, "phase", [documentNode]),
            groupId,
            kind: "phase",
            blockId: "",
            block: null,
            phase: proposedPhase,
            ...(typeof supersededBy === "string" && supersededBy !== "" ? { supersededBy } : {}),
            ...(typeof rationale === "string" && rationale !== "" ? { sentence: rationale } : {}),
          });
        }
      }

      for (const relation of touched.result.stagedRelations) {
        if (relation.fromNodeId !== documentNode) continue;
        const target = relation.toId;
        if (relation.type === CONTAINS && !established.has(target)) {
          const node = staged.get(target);
          if (node === undefined) continue;
          named.add(target);
          items.push({
            itemId: itemId(groupId, "insert", [target]),
            groupId,
            kind: "insert",
            blockId: bareId(target),
            // A proposed code block is numbered from the reading it would
            // join: the code block above its place. BO_0302_005
            block: placeCodeLines(toBlock(node, ""), loaded.document.blocks),
            ...refinedByOf(node),
            ...withdrawalOf(node),
          });
        }
        if (relation.type === RETIRED && established.has(target)) {
          const block = established.get(target) as BlockView;
          named.add(target);
          // A removal's withdrawal marks sit on the group's anchor of the
          // retired block, which the core keeps an anchor. BO_0286_008
          const anchor = staged.get(target);
          items.push({
            itemId: itemId(groupId, "remove", [relation.id, block.containmentId]),
            groupId,
            kind: "remove",
            blockId: block.blockId,
            block: null,
            ...(anchor === undefined ? {} : withdrawalOf(anchor)),
          });
        }
      }

      // A carry-forward anchor is never an item: its candidate copies the
      // established revision so a staged relation can anchor at it, and once
      // truth has moved past that copy it would read as a rewrite back — which
      // acceptance refuses as not a decidable member. The core names them.
      // BO_0248
      const anchors = new Set(touched.result.carryForwardNodes ?? []);
      for (const [nodeId, node] of staged) {
        if (named.has(nodeId) || anchors.has(nodeId)) continue;
        const block = established.get(nodeId);
        if (block === undefined) continue;
        const proposed = toBlock(node, block.containmentId);
        if (sameBlock(block, proposed)) continue;
        const kind = onlyOrderDiffers(block, proposed) ? "move" : onlyKindDiffers(block, proposed) ? "kind" : "replace";
        items.push({
          itemId: itemId(groupId, kind, [nodeId]),
          groupId,
          kind,
          blockId: block.blockId,
          block: proposed,
          ...refinedByOf(node),
          ...withdrawalOf(node),
        });
      }

      // The work items: claims, relations and derivations the group stages
      // against this document's blocks and claims. BO_0244_010
      const workItems = await readWorkItems(groupId, loaded.document, touched.result, staged, claims.result);
      if (workItems.outcome !== "success") return workItems as GraphOutcome<never>;
      // A derivation whose block the group also revises travels with that
      // item — its edges anchor at the block's candidate — so it is said on
      // the item rather than answered on its own.
      for (const derived of workItems.result.filter((item) => item.kind === "derive")) {
        const carrier = items.findIndex((item) => item.blockId === derived.blockId && (item.kind === "kind" || item.kind === "replace" || item.kind === "move"));
        if (carrier >= 0) items[carrier] = { ...(items[carrier] as ProposedChange), derivedFrom: derived.derivedFrom ?? [] };
        else items.push(derived);
      }
      items.push(...workItems.result.filter((item) => item.kind !== "derive"));

      if (items.length === 0) return { outcome: "success", result: null };
      // Authorship is the graph's: the stager is whoever the core stamped on
      // the candidates, never a name the shell asserts. BO_0209_006
      const stagedBy = [...new Set([...members.values()].map((node) => node.revision.createdBy))]
        .filter((name) => name !== "")
        .sort();
      // The agent is named by its run's provenance, staged into the same group
      // before the run closed (`stageRunSummary`), never by the stamp
      // (`proposerFrom`). BO_0233_001
      const run = [...members.values()].find((node) => node.revision.content?.["_type"] === "agent.run");
      // A system run's derived candidates are the system's reading, read at no
      // cost: marked here so the editor draws them in the derived idiom and
      // never asks for an answer by icon. BO_0246_006
      const system = run?.revision.content?.["trigger"] === "system";
      const marked = system
        ? items.map((item) =>
            (item.kind === "insert" || item.kind === "replace") &&
            item.block !== null &&
            item.block.kind === "text" &&
            DERIVED_KINDS.includes(item.block.blockKind ?? "")
              ? { ...item, derived: true }
              : item,
          )
        : items;
      // The agent's notes on its items, as its run recorded them, keyed by
      // the member each item's decision covers. BO_0265_011
      const notes = notesOf(run?.revision.content?.["notes"]);
      const noted = notes.size === 0 ? marked : marked.map((item) => withNote(item, notes));
      const runId = run?.revision.content?.["id"];
      // A person's branch is a group named after the document and the person:
      // its proposer is that person, whatever the stamps say. BO_0250_016
      return {
        outcome: "success",
        result: {
          groupId,
          items: noted,
          stagedBy,
          proposer: proposerFrom(groupId, [...members.values()]),
          ...(run !== undefined && typeof runId === "string"
            ? { run: { runId: runId.replace(/^run:/u, ""), stagedAt: run.revision.createdAt } }
            : {}),
        },
      };
  };
  const groupReads = await Promise.all(
    groupIds.result.map((groupId, index) => readGroup(groupId, touchedSets[index] as Awaited<ReturnType<typeof touchedSet>>)),
  );
  for (const outcome of groupReads) {
    if (outcome.outcome !== "success") return outcome as GraphOutcome<never>;
    if (outcome.result === null) continue;
    unanswered += outcome.result.items.length;
    groups.push(outcome.result);
  }

  // A refined item names the run that refined it; who that was is the
  // refining run's own provenance node, staged into its own group when it
  // ended — one read for every refiner, never one per item. A run still
  // going has no node yet, and its agent is the editor's to take from the
  // run's activity. BO_0271_010
  const refiners = new Set(
    groups.flatMap((group) =>
      group.items.flatMap((item) => [...(item.refinedBy === undefined ? [] : [item.refinedBy.runId]), ...(item.withdrawal === undefined ? [] : [item.withdrawal.runId])]),
    ),
  );
  if (refiners.size > 0) {
    const runs = await query({
      statement: "MATCH (r:agent.run) RETURN GRAPH r INCLUDE CANDIDATES",
      unbounded: true,
      purpose: "refining runs",
    });
    const proposerOfRun = new Map(
      (runs.outcome === "success" ? runs.result.nodes : [])
        .filter((node) => typeof node.revision.content?.["id"] === "string")
        .map((node) => [(node.revision.content?.["id"] as string).replace(/^run:/u, ""), proposerOf(node.revision.content, [])]),
    );
    for (const group of groups) {
      group.items = group.items.map((item) => {
        const refiner = item.refinedBy === undefined ? undefined : proposerOfRun.get(item.refinedBy.runId);
        const withdrawer = item.withdrawal === undefined ? undefined : proposerOfRun.get(item.withdrawal.runId);
        return {
          ...item,
          ...(refiner === undefined || item.refinedBy === undefined ? {} : { refinedBy: { runId: item.refinedBy.runId, proposer: refiner } }),
          ...(withdrawer === undefined || item.withdrawal === undefined ? {} : { withdrawal: { ...item.withdrawal, proposer: withdrawer } }),
        };
      });
    }
  }

  return {
    outcome: "success",
    result: { documentId, unanswered, groups },
  };
}

/** The refiner a candidate names, when a run refined it: the stamp the
 * kernel writes on the candidate it built on (`refinedBy: run:<id>`), read
 * as the run id, with its agent unknown until the runs are read. BO_0271_010 */
/** The withdrawal a candidate's marks name, when a run proposed one: the run
 * id, the successor's item id and the reason, with the agent unknown until
 * the runs are read. BO_0286_008 */
const withdrawalOf = (node: { readonly revision: { readonly content?: Record<string, unknown> | null } }): { readonly withdrawal: NonNullable<ProposedChange["withdrawal"]> } | Record<string, never> => {
  const content = node.revision.content ?? {};
  const stamp = content["withdrawnBy"];
  if (typeof stamp !== "string" || stamp === "") return {};
  const successor = content["withdrawnFor"];
  const reason = content["withdrawalReason"];
  return {
    withdrawal: {
      runId: stamp.replace(/^run:/u, ""),
      proposer: { kind: "agent", agent: null, executedBy: "" },
      ...(typeof successor === "string" && successor !== "" ? { successor } : {}),
      ...(typeof reason === "string" && reason !== "" ? { reason } : {}),
    },
  };
};

const refinedByOf = (node: { readonly revision: { readonly content?: Record<string, unknown> | null } }): { readonly refinedBy: NonNullable<ProposedChange["refinedBy"]> } | Record<string, never> => {
  const stamp = node.revision.content?.["refinedBy"];
  return typeof stamp === "string" && stamp !== ""
    ? { refinedBy: { runId: stamp.replace(/^run:/u, ""), proposer: { kind: "agent", agent: null, executedBy: "" } } }
    : {};
};

/** A run's `notes`, member → note, as the kernel records them. */
const notesOf = (value: unknown): ReadonlyMap<string, string> =>
  new Map(
    value !== null && typeof value === "object"
      ? Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "")
      : [],
  );

/** The item with the note its run recorded on one of its members. */
const withNote = (item: ProposedChange, notes: ReadonlyMap<string, string>): ProposedChange => {
  const members = parseItemId(item.itemId)?.members ?? [];
  const note = members.map((member) => notes.get(member)).find((found) => found !== undefined);
  return note === undefined ? item : { ...item, note };
};

const sameBlock = (left: BlockView, right: BlockView): boolean =>
  left.kind === right.kind &&
  left.order === right.order &&
  (left.kind !== "text" ||
    right.kind !== "text" ||
    (left.role === right.role && sameRuns(left.runs, right.runs) && (left.blockKind ?? "") === (right.blockKind ?? "")));

/**
 * The work items a group stages against a document, read from its touched
 * set and its candidates: a new claim is a candidate `claim` node a staged
 * `asserts` from one of this document's blocks points at; a revised claim a
 * candidate of a claim the document asserts whose words differ; a relation a
 * candidate `relation` node whose source or target is a claim here — a claim
 * the same group drafts for it folds into its members — and one whose
 * established reason differs is a `reason` item; a derivation is the staged
 * `derivedFrom` edges from one of this document's blocks. BO_0244_010
 */
async function readWorkItems(
  groupId: string,
  document: DocumentView,
  touched: { readonly stagedRelations: readonly { readonly id: string; readonly type: string; readonly fromNodeId: string; readonly toId: string }[] },
  staged: ReadonlyMap<string, ReadNode>,
  claims: { readonly byBlock: Readonly<Record<string, readonly ClaimView[]>>; readonly blockOf: ReadonlyMap<string, string> },
): Promise<GraphOutcome<readonly ProposedChange[]>> {
  const items: ProposedChange[] = [];
  const blockRefs = new Set(document.blocks.map((block) => nodeRef(block.blockId)));
  const establishedClaims = new Map<string, ClaimView>();
  for (const [blockId, list] of Object.entries(claims.byBlock)) {
    for (const claim of list) establishedClaims.set(nodeRef(claim.claimId), { ...claim, ...(blockId === "" ? {} : {}) });
  }
  // Claims drafted by this group for a relation it also stages: folded into
  // the relation's item, so they are answered together and in order.
  const draftedFor = new Map<string, string[]>();
  const stagedRelationNodes = [...staged.values()].filter((node) => typeOf(node) === RELATION_TYPE).map((node) => node.id);
  const ends = stagedRelationNodes.length === 0 ? [] : await (async () => {
    const read = await readRelationEnds(stagedRelationNodes, groupId);
    return read.outcome === "success" ? read.result : [];
  })();
  // The same relations as established, for what a staged revision changes:
  // the state, or the reason. BO_0248_013
  const established = stagedRelationNodes.length === 0 ? new Map<string, ReadNode>() : await (async () => {
    const read = await readRelationEnds(stagedRelationNodes);
    return new Map((read.outcome === "success" ? read.result : []).map((entry) => [entry.node.id, entry.node]));
  })();
  const claimBlock = (ref: string): string | undefined =>
    claims.blockOf.get(ref) ??
    [...touched.stagedRelations]
      .filter((relation) => relation.type === ASSERTS && relation.toId === ref && blockRefs.has(relation.fromNodeId))
      .map((relation) => bareId(relation.fromNodeId))[0];
  for (const entry of ends) {
    for (const ref of [entry.source, entry.target]) {
      if (staged.has(ref) && !establishedClaims.has(ref)) draftedFor.set(entry.node.id, [...(draftedFor.get(entry.node.id) ?? []), ref]);
    }
  }
  const drafted = new Set([...draftedFor.values()].flat());

  // Claims.
  for (const relation of touched.stagedRelations) {
    if (relation.type !== ASSERTS || !blockRefs.has(relation.fromNodeId) || drafted.has(relation.toId)) continue;
    const node = staged.get(relation.toId);
    if (node === undefined || typeOf(node) !== CLAIM_TYPE || establishedClaims.has(relation.toId)) continue;
    items.push({
      itemId: itemId(groupId, "claim", [relation.toId]),
      groupId,
      kind: "claim",
      blockId: bareId(relation.fromNodeId),
      block: null,
      claim: { claimId: bareId(node.id), revisionId: node.revision.id, status: node.revision.status, text: normalizeRuns((contentOf(node)["text"] ?? []) as Run[]) },
    });
  }
  for (const [ref, claim] of establishedClaims) {
    const node = staged.get(ref);
    if (node === undefined) continue;
    const text = normalizeRuns((contentOf(node)["text"] ?? []) as Run[]);
    if (sameRuns(text, claim.text)) continue;
    items.push({
      itemId: itemId(groupId, "claim", [ref]),
      groupId,
      kind: "claim",
      blockId: claims.blockOf.get(ref) ?? "",
      block: null,
      claim: { ...claim, revisionId: node.revision.id, status: node.revision.status, text },
    });
  }

  // Relations: new ones, and ones whose reason the group revises.
  const endOf = (ref: string): RelationEnd => {
    const blockId = claimBlock(ref);
    const node = staged.get(ref);
    const known = establishedClaims.get(ref);
    const text = node !== undefined ? normalizeRuns((contentOf(node)["text"] ?? []) as Run[]) : (known?.text ?? []);
    return {
      claimId: bareId(ref),
      blockId: blockId ?? "",
      documentId: blockId === undefined ? "" : document.documentId,
      documentTitle: blockId === undefined ? "" : document.title,
      status: node?.revision.status ?? known?.status ?? "",
      text,
    };
  };
  for (const entry of ends) {
    const sourceHere = claimBlock(entry.source) !== undefined;
    const targetHere = claimBlock(entry.target) !== undefined;
    if (!sourceHere && !targetHere) continue;
    const view = relationOf(entry.node, endOf(entry.source), endOf(entry.target));
    const isNew = !(await hasEstablished(entry.node.id));
    if (isNew) {
      items.push({
        itemId: itemId(groupId, "relate", [...(draftedFor.get(entry.node.id) ?? []), entry.node.id]),
        groupId,
        kind: "relate",
        blockId: sourceHere ? (claimBlock(entry.source) as string) : (claimBlock(entry.target) as string),
        block: null,
        relation: view,
        ...(sourceHere ? {} : { elsewhere: true }),
      });
    } else {
      const before = established.get(entry.node.id);
      const previousState = before === undefined ? "declared" : relationOf(before, view.source, view.target).state;
      const stateMoves = previousState !== view.state;
      items.push({
        itemId: itemId(groupId, stateMoves ? "state" : "reason", [entry.node.id]),
        groupId,
        kind: stateMoves ? "state" : "reason",
        blockId: sourceHere ? (claimBlock(entry.source) as string) : (claimBlock(entry.target) as string),
        block: null,
        relation: view,
        ...(stateMoves ? { previousState } : {}),
        ...(sourceHere ? {} : { elsewhere: true }),
      });
    }
  }

  // Derivations.
  const derivations = new Map<string, { relations: string[]; from: string[] }>();
  for (const relation of touched.stagedRelations) {
    if (relation.type !== DERIVED_FROM || !blockRefs.has(relation.fromNodeId)) continue;
    const entry = derivations.get(relation.fromNodeId) ?? { relations: [], from: [] };
    entry.relations.push(relation.id);
    entry.from.push(bareId(relation.toId));
    derivations.set(relation.fromNodeId, entry);
  }
  for (const [blockRef, entry] of derivations) {
    items.push({
      itemId: itemId(groupId, "derive", entry.relations),
      groupId,
      kind: "derive",
      blockId: bareId(blockRef),
      block: null,
      derivedFrom: [...entry.from].sort(),
    });
  }
  return { outcome: "success", result: items };
}

/** Whether a node has an established revision at head. */
async function hasEstablished(nodeId: string): Promise<boolean> {
  const found = await query({ statement: "MATCH (n) RETURN GRAPH n", roots: [nodeId], purpose: "established?" });
  return found.outcome === "success" && found.result.nodes.some((node) => node.id === nodeId && node.revision.status === "established");
}

const onlyOrderDiffers = (left: BlockView, right: BlockView): boolean =>
  left.kind === right.kind &&
  left.order !== right.order &&
  (left.kind !== "text" ||
    right.kind !== "text" ||
    (left.role === right.role && sameRuns(left.runs, right.runs)));

/** A proposed change moved to another place, still unanswered. BO_0233_007 */
export interface PlacedItem {
  readonly itemId: string;
  readonly order: string;
}

/**
 * Moves a proposed change to another place without answering it. The new
 * order key is staged into the item's own group, as a candidate revision of
 * the block it places — the new block of an insert, the block a rewrite or a
 * move concerns — carrying the key and nothing else, so the place is part of
 * the proposal: it survives a reload and every device, and accepting lands the
 * block there. The reader stages it, into a group an agent may have opened;
 * CCGW admits a staging into any open group. A removal proposes no place and
 * is refused. BO_0233_007
 */
export async function placeProposedItem(input: {
  readonly documentId: string;
  readonly itemId: string;
  readonly placement: Placement;
}): Promise<GraphOutcome<PlacedItem>> {
  const parsed = parseItemId(input.itemId);
  if (parsed === null) {
    return refuse("itemShape", `${input.itemId} does not name a proposed change.`);
  }
  if (parsed.kind === "remove") {
    return refuse("removalHasNoPlace", "A proposed removal proposes no place to move.");
  }
  const node = parsed.members[0] as string;
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  const self = bareId(node);
  if (("before" in input.placement && input.placement.before === self) || ("after" in input.placement && input.placement.after === self)) {
    return refuse("unknownAnchor", "A block does not move relative to itself.");
  }
  const order = orderFor(loaded.document.blocks, input.placement);
  if ("failure" in order) return order.failure;
  // The key alone: a staging into a group that already holds a candidate of
  // this block builds on that candidate, so a rewrite keeps its words and a
  // new block its content (proven over CCGW in `tests/behavior`). BO_0233_007
  const outcome = await stage(
    parsed.groupId,
    "SET p.order = $porder",
    { pNodeId: node, porder: order.order },
    `place proposed ${parsed.kind} ${input.itemId}`,
  );
  if (outcome.outcome !== "success") return outcome as GraphOutcome<never>;
  return { outcome: "success", result: { itemId: input.itemId, order: order.order } };
}

export type ProposalAnswer = "accepted" | "rejected";

/** How a drifted member's block moved since the group's base. */
interface BlockDrift {
  /** Only its standing: its words, role and order as truth holds them now are
   * what they were at the base. BO_0233_011 */
  readonly standingOnly: boolean;
  /** The standing truth holds now, and the one the proposal carries. */
  readonly standing: Standing;
  readonly proposed: Standing;
}

/**
 * How a drifted member's block moved since the group's base, or null when the
 * block cannot be read at the base or now. BO_0233_011 CA_0042_002
 */
async function blockDrift(groupId: string, member: string): Promise<GraphOutcome<BlockDrift | null>> {
  // The base CCGW judges drift against (`proposalBase`): the group's first
  // revision's declared `baseDataRevision`, else the data revision that
  // revision was created at. A group the shell stages declares none.
  const group = await query({
    statement: "MATCH (g:ProposalGroup {id: $gid}) RETURN GRAPH g INCLUDE HISTORY",
    parameters: { gid: bareId(groupId) },
    purpose: "proposal base",
  });
  if (group.outcome !== "success") return group as GraphOutcome<never>;
  const node = group.result.nodes[0];
  const first = [...(node === undefined ? [] : [node.revision, ...(node.history ?? [])])]
    .filter((revision) => (revision.createdDataRevision ?? 0) > 0)
    .sort((left, right) => (left.createdDataRevision ?? 0) - (right.createdDataRevision ?? 0))[0];
  if (first === undefined) return { outcome: "success", result: null };
  const declared = Number(first.content?.["baseDataRevision"] ?? 0);
  const base = declared > 0 ? declared : (first.createdDataRevision ?? 0);
  const read = (extra: { dataRevision?: number; proposalOverlay?: string }) =>
    query({
      statement: "MATCH (n {id: $id}) RETURN GRAPH n",
      parameters: { id: bareId(member) },
      purpose: "proposal drift",
      ...extra,
    });
  const [then, now, proposed] = await Promise.all([
    read({ dataRevision: base }),
    read({}),
    read({ proposalOverlay: groupId }),
  ]);
  for (const outcome of [then, now, proposed]) {
    if (outcome.outcome !== "success") return outcome as GraphOutcome<never>;
  }
  const content = (outcome: typeof then) =>
    outcome.outcome === "success" ? outcome.result.nodes[0]?.revision.content : undefined;
  const before = content(then);
  const current = content(now);
  if (before === undefined || current === undefined) return { outcome: "success", result: null };
  const same =
    before["_type"] === current["_type"] &&
    (before["order"] ?? "") === (current["order"] ?? "") &&
    (before["role"] ?? null) === (current["role"] ?? null) &&
    sameRuns(normalizeRuns((before["runs"] ?? []) as Run[]), normalizeRuns((current["runs"] ?? []) as Run[]));
  const standing = (value: unknown): Standing => readStanding(value);
  return {
    outcome: "success",
    result: {
      standingOnly: same,
      standing: standing(current["disposition"]),
      proposed: standing(content(proposed)?.["disposition"]),
    },
  };
}

/** Gives an accepted block back the standing the reader had set. BO_0233_011 */
async function restoreStanding(
  documentId: string,
  blockId: string,
  standing: Standing,
): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(documentId);
  if (!loaded.ok) return loaded.outcome;
  const block = loaded.document.blocks.find((candidate) => candidate.blockId === blockId);
  if (block === undefined) return refuse("unknownBlock", `Block ${blockId} is not in this document.`);
  return setBlockDisposition({ documentId, blockId, baseRevisionId: block.revisionId, standing });
}

export interface AnsweredItem {
  readonly itemId: string;
  readonly answer: ProposalAnswer;
  readonly dataRevision: string;
  /** The group after this answer, so a caller learns it closed without asking. */
  readonly groupState: "open" | "closed";
  /** How many withdrawn items this acceptance rejected as their successor,
   * and what to tell the reader when one of them could not be. BO_0286_009 */
  readonly withdrawn?: number;
  readonly notice?: string;
}

/**
 * Answers one proposed change through the kernel. Accepting performs it and
 * the document holds it from that moment; rejecting leaves the document
 * exactly as it was. A remove is two member decisions in order — the
 * retirement relation first, so the block is never detached without being
 * recorded as retired — and a decision the kernel keeps behind its
 * confirmation answers as refused rather than half-done.
 */
export async function answerDocumentProposal(input: {
  /** The document the item stands against, for giving a block its standing
   * back after an acceptance over a standing that moved. BO_0233_011 */
  readonly documentId?: string;
  readonly itemId: string;
  readonly answer: ProposalAnswer;
  readonly override?: boolean;
  /** The acceptance is an edit's: the reader typed into the proposal and
   * chose its words, so a rewrite is accepted over whatever its block did
   * since. CA_0042_002 */
  readonly edited?: boolean;
}): Promise<GraphOutcome<AnsweredItem>> {
  const parsed = parseItemId(input.itemId);
  if (parsed === null) {
    return refuse("itemShape", `${input.itemId} does not name a proposed change.`);
  }
  const decision = input.answer === "accepted" ? "accept" : "reject";
  // A started document goes with the first item the reader accepts, before
  // the item: the core accepts a block's member into a document whose own is
  // still a candidate and leaves the block established in a document that is
  // not, so the order is the shell's to keep. BO_0251_009
  const started = input.documentId === undefined ? null : await startedIn(input.documentId);
  if (decision === "accept" && started === parsed.groupId && input.documentId !== undefined) {
    const taken = await decide("accept", parsed.groupId, nodeRef(input.documentId), `take document ${input.documentId} with ${input.itemId}`);
    if (taken.outcome !== "success") return taken as GraphOutcome<AnsweredItem>;
  }
  // The works a proposed sentence cites and its own group proposes are
  // accepted first, so a citation never lands pointing at a work that is
  // still a proposal. BO_0291_036
  if (decision === "accept") {
    const carried = await query({
      statement: "MATCH (n) WHERE n._proposal = $g RETURN GRAPH n ROOT n INCLUDE CANDIDATES",
      parameters: { g: parsed.groupId },
      proposalOverlay: parsed.groupId,
      unbounded: true,
      purpose: "works a proposed citation carries",
    });
    if (carried.outcome === "storageError") return carried as GraphOutcome<AnsweredItem>;
    const works = carried.outcome === "success" ? proposedWorksCited(carried.result.nodes, parsed.members, parsed.groupId) : [];
    for (const work of works) {
      const taken = await decide("accept", parsed.groupId, work, `work ${bareId(work)} cited by ${input.itemId}`);
      if (taken.outcome !== "success") return taken as GraphOutcome<AnsweredItem>;
    }
  }
  for (const member of parsed.members) {
    let outcome = await decide(decision, parsed.groupId, member, `${parsed.kind} ${input.itemId}`, input.override ?? false);
    // CCGW judges drift by revision, so a block whose standing the reader
    // set after the proposal was staged reads as moved past it though not a
    // word of it changed. When the words, the role and the place are what the
    // proposal was made against, it is accepted over that, and the reader's
    // standing is given back; when they are not, it says so in words, since
    // the reload the generic conflict asks for would change nothing.
    // BO_0233_011
    // A rewrite the reader typed into is accepted over any drift: editing it
    // is choosing its words, and what the block said since is replaced by
    // them. The standing is still the reader's. CA_0042_002
    if (outcome.outcome === "conflict" && decision === "accept" && input.override !== true && (parsed.kind === "replace" || parsed.kind === "move")) {
      const drift = await blockDrift(parsed.groupId, member);
      if (drift.outcome !== "success") return drift as GraphOutcome<never>;
      const edited = input.edited === true && parsed.kind === "replace";
      if (drift.result === null || (!drift.result.standingOnly && !edited)) {
        return refuse(
          "proposalStale",
          "This proposed change was made against an older version of the block, and its words, its kind or its place have changed since. Reject it, or ask for it again.",
        );
      }
      const over = drift.result.standingOnly ? "over a standing set since" : "edited, over the block's changes since";
      outcome = await decide(decision, parsed.groupId, member, `${parsed.kind} ${input.itemId}, ${over}`, true);
      if (outcome.outcome === "success" && input.documentId !== undefined && drift.result.standing !== drift.result.proposed) {
        const restored = await restoreStanding(input.documentId, bareId(member), drift.result.standing);
        if (restored.outcome !== "success") return restored as GraphOutcome<never>;
      }
    }
    if (outcome.outcome !== "success") return outcome as GraphOutcome<AnsweredItem>;
  }
  // An accepted code block is formatted in a revision of its own: the
  // acceptance above promoted the staged revision unchanged, and the
  // formatted text lands as the next revision, authored by the accepter, so
  // *accepted* keeps meaning *this text, agreed*. A block whose formatted
  // source is what was proposed writes nothing more; a document with the
  // switch off accepts code as it came. BO_0296_016
  if (decision === "accept" && input.documentId !== undefined) {
    await formatAccepted(input.documentId, parsed.members);
  }
  // Accepting a successor answers the surplus with it: every withdrawn item
  // naming this one is rejected in the same press, one member decision each
  // in its own group. A rejection that fails leaves that item standing with
  // its mark, said in a notice, and answers nothing else differently.
  // User decision, 2026-09-23. BO_0286_009
  let withdrawn = 0;
  let notice: string | undefined;
  if (decision === "accept" && input.documentId !== undefined) {
    const standing = await readDocumentProposalsAgainstTruth(input.documentId);
    const superseded = standing.outcome === "success" ? standing.result.groups.flatMap((group) => group.items).filter((item) => item.withdrawal?.successor === input.itemId) : [];
    for (const item of superseded) {
      const members = parseItemId(item.itemId)?.members ?? [];
      let failed: string | null = null;
      for (const member of members) {
        const rejected = await decide("reject", item.groupId, member, `${item.kind} ${item.itemId}, withdrawn in favour of ${input.itemId}`);
        if (rejected.outcome !== "success") {
          failed = rejected.outcome === "validationFailure" ? (rejected.failures[0]?.detail ?? "refused") : rejected.outcome;
          break;
        }
      }
      if (failed === null) withdrawn += 1;
      else notice = `${notice === undefined ? "" : notice + " "}A proposal withdrawn in favour of this one could not be rejected and still stands: ${failed}`;
    }
  }
  // Rejecting the last item of a started document rejects the document too,
  // so nothing of it is left standing unanswerable. BO_0251_009
  if (decision === "reject" && started === parsed.groupId && input.documentId !== undefined) {
    const rest = await readDocumentProposalsAgainstTruth(input.documentId);
    const left = rest.outcome === "success" ? (rest.result.groups.find((group) => group.groupId === parsed.groupId)?.items.length ?? 0) : 1;
    if (left === 0) {
      const dropped = await decide("reject", parsed.groupId, nodeRef(input.documentId), `drop document ${input.documentId}, every item rejected`);
      if (dropped.outcome !== "success") return dropped as GraphOutcome<AnsweredItem>;
    }
  }

  const state = await query({
    statement: "MATCH (g:ProposalGroup {id: $gid}) RETURN GRAPH g",
    parameters: { gid: bareId(parsed.groupId) },
    purpose: "group state after answer",
  });
  const open =
    state.outcome === "success" &&
    state.result.nodes.some((node) => node.revision.content?.["status"] === "open");
  return {
    outcome: "success",
    result: {
      ...(withdrawn > 0 ? { withdrawn } : {}),
      ...(notice === undefined ? {} : { notice }),
      itemId: input.itemId,
      answer: input.answer,
      dataRevision: state.outcome === "success" ? String(state.result.resolvedDataRevision) : "",
      groupState: open ? "open" : "closed",
    },
  };
}

/**
 * The code blocks among an accepted item's members, formatted through the
 * kernel and written as one further revision each where the text changed.
 * A failure of that write leaves the accepted text standing, unformatted,
 * and is not the acceptance's to report: what was agreed to is in the
 * document either way. BO_0296_016
 */
async function formatAccepted(documentId: string, members: readonly string[]): Promise<void> {
  const loaded = await loadDocument(documentId);
  if (!loaded.ok || !formatsCode(loaded.document)) return;
  const accepted = new Set(members.map((member) => bareId(member)));
  for (const block of loaded.document.blocks) {
    if (block.kind !== "sourcecode" || !accepted.has(block.blockId) || block.language === undefined) continue;
    const formatted = await formatSource(block.source, block.language);
    if (formatted === block.source) continue;
    await commit(
      "SET b.source = $source",
      { bNodeId: nodeRef(block.blockId), source: formatted },
      `format code ${block.blockId} as accepted`,
      async (dataRevision) => dataRevision,
    );
  }
}

export interface PromotedBlock {
  readonly groupId: string;
  readonly blockId: string;
  readonly itemId: string;
  readonly dataRevision: string;
}

/**
 * Promotes one block of a rejected branch on its own: its candidate content,
 * read through the rejected group's overlay, is staged into a new group of
 * the person's — an insert when the block is not in truth, a rewrite when it
 * is — answered as any proposal. Nothing of the branch enters truth by it;
 * the block does, if accepted. BO_0250_016 (material §25)
 */
export async function promoteBlock(input: {
  readonly documentId: string;
  readonly group: string;
  readonly blockId: string;
  readonly account: string;
}): Promise<GraphOutcome<PromotedBlock>> {
  return outsideBranch(async () => {
    const candidate = await query({
      statement: "MATCH (n {id: $id}) RETURN GRAPH n INCLUDE CANDIDATES",
      parameters: { id: input.blockId },
      proposalOverlay: input.group,
      purpose: "promotion source",
    });
    if (candidate.outcome !== "success") return candidate as GraphOutcome<never>;
    const node = candidate.result.nodes.find((found) => found.id === nodeRef(input.blockId) && found.revision.content?.["_proposal"] === input.group);
    if (node === undefined) {
      return refuse("notInBranch", `Block ${input.blockId} is not a member of ${input.group}.`);
    }
    const content = node.revision.content ?? {};
    if (content["_type"] !== "text" && content["_type"] !== "divider") {
      return refuse("notABlock", `${input.blockId} is not a block.`);
    }
    const loaded = await loadDocument(input.documentId);
    if (!loaded.ok) return loaded.outcome;
    const inTruth = loaded.document.blocks.find((block) => block.blockId === input.blockId);
    const groups = await query({ statement: "MATCH (g:ProposalGroup) RETURN GRAPH g", unbounded: true, purpose: "promotion groups" });
    const prefix = `promote-${input.blockId}-${input.account}-`;
    const taken = groups.outcome === "success" ? groups.result.nodes.filter((found) => bareId(found.id).startsWith(prefix)).length : 0;
    const groupId = `node:${prefix}${taken + 1}`;
    const runs = Array.isArray(content["runs"]) ? normalizeRuns(content["runs"] as Run[]) : [];
    const role = typeof content["role"] === "string" ? content["role"] : null;
    const parameters: Record<string, unknown> = {};
    let statement: string;
    if (inTruth === undefined) {
      const last = loaded.document.blocks[loaded.document.blocks.length - 1];
      const order = orderBetween(last?.order ?? "", "");
      parameters["pd"] = nodeRef(input.documentId);
      parameters["pn"] = nodeRef(input.blockId);
      const block: NewBlock = content["_type"] === "divider" ? { kind: "divider" } : { kind: "text", runs, ...(role === null ? {} : { role: role as TextRole }) };
      statement = [
        `CREATE (p:${blockType(block)} {${properties("p", { id: input.blockId, ...blockContentFor(block, order) }, parameters, false)}})`,
        `RELATE pd -[pc:${CONTAINS}]-> pn`,
      ].join("; ");
    } else {
      parameters["pNodeId"] = nodeRef(input.blockId);
      parameters["pruns"] = runs;
      parameters["prole"] = role === "paragraph" ? null : role;
      statement = "SET p.runs = $pruns, p.role = $prole";
    }
    const staged = await stage(groupId, statement, parameters, `promote block ${input.blockId} from ${input.group} on its own`);
    if (staged.outcome !== "success") return staged as GraphOutcome<never>;
    return {
      outcome: "success",
      result: {
        groupId,
        blockId: input.blockId,
        itemId: itemId(groupId, inTruth === undefined ? "insert" : "replace", [nodeRef(input.blockId)]),
        dataRevision: staged.result.dataRevision,
      },
    };
  });
}

/**
 * Profiles (`BO_0298_010`–`BO_0298_012`): the `profile` property of the
 * `document` declaration names the profile attached to a document — the id
 * of a document carrying `record: profile` — and these are the writes and
 * reads the `profiles` extension's routes are made of. A selection is the
 * person's own act, established at once as truth whatever branch the tab is
 * in (`BO_0298_Q7`), never a proposal; the kernel reads the property at a
 * run's start (`calliopa-bootstrap`'s `ui-kernel.md`, Profiles).
 */

/** One document node's content as established, or null when the pin holds none. */
async function documentContent(id: string): Promise<GraphOutcome<Record<string, unknown> | null>> {
  const read = await outsideBranch(() =>
    query({ statement: `MATCH (d:${DOCUMENT_TYPE}) RETURN GRAPH d`, roots: [nodeRef(id)], unbounded: true, purpose: "document node" }),
  );
  if (read.outcome === "noResult") return { outcome: "success", result: null };
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  const node = read.result.nodes.find((candidate) => candidate.id === nodeRef(id) && typeOf(candidate) === DOCUMENT_TYPE);
  return { outcome: "success", result: node === undefined || node.revision.status !== "established" ? null : contentOf(node) };
}

const isProfile = (content: Record<string, unknown> | null): content is Record<string, unknown> =>
  content !== null && content["record"] === PROFILE_RECORD;

const profileOf = (id: string, content: Record<string, unknown>): ProfileSummary => ({
  id,
  title: typeof content["title"] === "string" ? content["title"] : "",
});

const byProfileTitle = (left: ProfileSummary, right: ProfileSummary): number => {
  const a = left.title.toLowerCase();
  const b = right.title.toLowerCase();
  return a < b ? -1 : a > b ? 1 : 0;
};

/** Every profile of the instance, by title. */
export async function listProfiles(): Promise<GraphOutcome<readonly ProfileSummary[]>> {
  const read = await outsideBranch(() =>
    query({
      statement: `MATCH (d:${DOCUMENT_TYPE} {record: $record}) RETURN GRAPH d`,
      parameters: { record: PROFILE_RECORD },
      unbounded: true,
      purpose: "profiles",
    }),
  );
  if (read.outcome === "noResult") return { outcome: "success", result: [] };
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  const listed: ProfileSummary[] = [];
  for (const node of read.result.nodes) {
    if (typeOf(node) !== DOCUMENT_TYPE || node.revision.status !== "established") continue;
    const content = contentOf(node);
    if (!isProfile(content)) continue;
    listed.push(profileOf(bareId(node.id), content));
  }
  return { outcome: "success", result: listed.sort(byProfileTitle) };
}

/** What a document's `profile` names, resolved: the profile, none, or an id
 * the graph no longer holds as a profile. */
async function selectionOf(content: Record<string, unknown>): Promise<GraphOutcome<ProfileSelection>> {
  const named = content["profile"];
  if (typeof named !== "string" || named === "") return { outcome: "success", result: { profile: null, gone: null } };
  const profile = await documentContent(named);
  if (profile.outcome !== "success") return profile as GraphOutcome<never>;
  return {
    outcome: "success",
    result: isProfile(profile.result) ? { profile: profileOf(named, profile.result), gone: null } : { profile: null, gone: named },
  };
}

/** The document's selection as it stands. */
export async function readProfileSelection(documentId: string): Promise<GraphOutcome<ProfileSelection>> {
  const document = await documentContent(documentId);
  if (document.outcome !== "success") return document as GraphOutcome<never>;
  if (document.result === null) return { outcome: "noResult", detail: `No document ${documentId}.` };
  return selectionOf(document.result);
}

/**
 * The person's selection written: a profile by its id, or null for *No
 * profile*. An id that is not an established document carrying
 * `record: profile` is refused before anything is written, in words.
 */
export async function setProfile(input: {
  readonly documentId: string;
  readonly profile: string | null;
}): Promise<GraphOutcome<ProfileSelection>> {
  const document = await documentContent(input.documentId);
  if (document.outcome !== "success") return document as GraphOutcome<never>;
  if (document.result === null) return { outcome: "noResult", detail: `No document ${input.documentId}.` };
  let chosen: ProfileSummary | null = null;
  if (input.profile !== null) {
    const profile = await documentContent(input.profile);
    if (profile.outcome !== "success") return profile as GraphOutcome<never>;
    if (!isProfile(profile.result)) {
      return { outcome: "validationFailure", failures: [{ operation: null, rule: "profile", detail: `${input.profile} is not a profile: a profile is a document carrying record ${PROFILE_RECORD}.` }] };
    }
    chosen = profileOf(input.profile, profile.result);
  }
  const written = await outsideBranch(() =>
    write("SET d.profile = $profile", { dNodeId: nodeRef(input.documentId), profile: input.profile }, `attach profile ${input.profile ?? "none"} to document ${input.documentId}`),
  );
  if (written.outcome !== "success") return written as GraphOutcome<never>;
  return { outcome: "success", result: { profile: chosen, gone: null } };
}
