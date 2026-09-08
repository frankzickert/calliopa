/**
 * The knowledge graph's gateway, as this application reads it.
 *
 * The shell's own content lives in its own store; the graph is where the
 * shell's *code* and every extension live, behind the Calliopa-Cypher
 * Gateway. This module is the one place that speaks to it, and it only
 * reads: manifests, members, the release pin, proposal groups, the schema
 * reflection. Reads carry a fixed reader principal and no credential —
 * reads are unfenced — and `CALLIOPA_CCGW_URL` is optional: without it every
 * read reports the gateway unreachable and the surfaces say so. BO_0201_004
 */

export type GatewayReply<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly detail: string };

/** One node as the gateway returns it under RETURN GRAPH. */
export interface GraphRevision {
  readonly id: string;
  /** Absent on a metadata-only read. */
  readonly content: Record<string, unknown>;
  readonly status: string;
  /** The revision's lifecycle data revision: where its status last moved. */
  readonly dataRevision: number;
  readonly createdAt: number;
  readonly createdBy: string;
  readonly purpose: string;
}

export interface GraphNode {
  readonly id: string;
  readonly revision: GraphRevision;
  /** Earlier revisions, present under INCLUDE HISTORY. */
  readonly history?: readonly GraphRevision[];
}

export interface GraphRelation {
  readonly id: string;
  readonly type: string;
  readonly fromNodeId: string;
  readonly to: { readonly kind: string; readonly nodeId?: string };
}

export interface GraphResult {
  readonly roots: readonly string[];
  readonly nodes: readonly GraphNode[];
  readonly relations: readonly GraphRelation[];
}

export const READER_PRINCIPAL = "ui.shell";

export function gatewayUrl(): string | null {
  const url = process.env.CALLIOPA_CCGW_URL?.trim() ?? "";
  return url === "" ? null : url.replace(/\/+$/u, "");
}

export function gatewayConfigured(): boolean {
  return gatewayUrl() !== null;
}

async function ask(
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<GatewayReply<string>> {
  const base = gatewayUrl();
  if (base === null) {
    return {
      ok: false,
      detail:
        "The knowledge graph is not reachable: CALLIOPA_CCGW_URL is not set.",
    };
  }
  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.text();
    return response.ok
      ? { ok: true, value: body }
      : {
          ok: false,
          detail: `The gateway answered ${response.status}: ${body.slice(0, 200)}`,
        };
  } catch (error) {
    const detail =
      error instanceof Error && error.name === "TimeoutError"
        ? "The gateway did not answer in time."
        : `The gateway could not be reached: ${error instanceof Error ? error.message : String(error)}`;
    return { ok: false, detail };
  }
}

/** Parses a query route answer into its graph, or the reason it is not one. */
export function parseQueryAnswer(body: string): GatewayReply<GraphResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, detail: "The gateway's answer was not JSON." };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, detail: "The gateway's answer was not an object." };
  }
  const answer = parsed as {
    status?: unknown;
    result?: unknown;
    error?: { message?: unknown };
  };
  // A read that matched nothing is an answer, not a refusal: an instance
  // before its first release pin, or without a kernel extension state Block,
  // reads as empty rather than unreachable. BO_0218_010
  if (answer.status === "no_result") {
    return { ok: true, value: { roots: [], nodes: [], relations: [] } };
  }
  if (answer.status !== "success") {
    const message =
      typeof answer.error?.message === "string"
        ? answer.error.message
        : String(answer.status);
    return { ok: false, detail: `The gateway refused the read: ${message}` };
  }
  const result = (answer.result ?? {}) as Partial<GraphResult>;
  const nodes = Array.isArray(result.nodes)
    ? (result.nodes as GraphNode[]).map((node) => ({
        ...node,
        revision: { ...node.revision, content: node.revision.content ?? {} },
      }))
    : [];
  return {
    ok: true,
    value: {
      roots: Array.isArray(result.roots) ? (result.roots as string[]) : [],
      nodes,
      relations: Array.isArray(result.relations)
        ? (result.relations as GraphRelation[])
        : [],
    },
  };
}

/** A read statement with its parameters, never spliced. */
export async function query(
  statement: string,
  parameters: Record<string, unknown> = {},
  options: { readonly metadataOnly?: boolean } = {},
): Promise<GatewayReply<GraphResult>> {
  const reply = await ask(
    "/v1/cypher/query",
    {
      method: "POST",
      body: JSON.stringify({
        statement,
        parameters,
        ...(options.metadataOnly === true ? { metadataOnly: true } : {}),
        context: { principal: READER_PRINCIPAL },
      }),
    },
    15_000,
  );
  return reply.ok ? parseQueryAnswer(reply.value) : reply;
}

export async function readHead(): Promise<GatewayReply<number>> {
  const reply = await ask("/v1/head", { method: "GET" }, 5_000);
  if (!reply.ok) return reply;
  try {
    const head = (JSON.parse(reply.value) as { dataRevision?: unknown })
      .dataRevision;
    return typeof head === "number"
      ? { ok: true, value: head }
      : { ok: false, detail: "The gateway named no head." };
  } catch {
    return { ok: false, detail: "The gateway's head was not JSON." };
  }
}

export async function readElevated(): Promise<GatewayReply<readonly string[]>> {
  const reply = await ask("/v1/schema", { method: "GET" }, 5_000);
  if (!reply.ok) return reply;
  try {
    const set = (JSON.parse(reply.value) as { elevatedExtensions?: unknown })
      .elevatedExtensions;
    return { ok: true, value: Array.isArray(set) ? (set as string[]) : [] };
  } catch {
    return { ok: false, detail: "The gateway's schema was not JSON." };
  }
}

/** The nodes of one `_type` in a result, in the order returned. */
export function nodesOfType(result: GraphResult, type: string): GraphNode[] {
  return result.nodes.filter(
    (node) =>
      node.revision.content["_type"] === type ||
      (node.revision as { type?: unknown }).type === type,
  );
}

/**
 * Groups member nodes by the manifest their `partOf` relation names. A
 * property filter on the manifest does not prune the joined alias, so one
 * read of every pair and the relations it returns is how membership resolves
 * — the same way the kernel's own member export does it.
 */
export function membersByManifest(
  result: GraphResult,
): Map<string, GraphNode[]> {
  const byId = new Map(result.nodes.map((node) => [node.id, node] as const));
  const grouped = new Map<string, GraphNode[]>();
  for (const relation of result.relations) {
    if (relation.type !== "partOf" || relation.to.nodeId === undefined)
      continue;
    const member = byId.get(relation.fromNodeId);
    if (member === undefined) continue;
    const list = grouped.get(relation.to.nodeId) ?? [];
    list.push(member);
    grouped.set(relation.to.nodeId, list);
  }
  return grouped;
}

export function stringOf(
  content: Record<string, unknown>,
  key: string,
): string {
  const value = content[key];
  return typeof value === "string" ? value : "";
}
