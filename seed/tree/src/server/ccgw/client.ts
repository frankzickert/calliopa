import type { GraphOutcome } from "../outcome";
import { graphEnv } from "./env";
import { forwardedCookie } from "../request-context";

/**
 * The shell's side of the one graph.
 *
 * Reads go to CCGW: rooted, bounded, pinned statements answered as the
 * assembled graph. Writes never do. Every write is a kernel bridge verb under
 * the kernel-held principal — `write` for content truth, `stage` for a
 * proposal, `accept` and `reject` with a member for review — so what the shell
 * may establish is decided by the core and not by this code. The kernel
 * proxy refuses a human-class mutation from the app origin any other way
 * (`ui-kernel.md`, `BO_0103_001`, `BO_0134_001`, `BO_0207_001`).
 *
 * The shell's server side is not a browser, sends no Origin header, and so
 * passes the bridge's same-origin rule as the non-browser caller it is.
 */

const PRINCIPAL = "ui.shell";

export interface ReadRevision {
  readonly id: string;
  /** Absent on a metadata-only read. */
  readonly content?: Record<string, unknown>;
  readonly status: string;
  readonly dataRevision: number;
  readonly createdAt: number;
  readonly createdBy: string;
  /** The data revision the revision was created at, which a proposal group's
   * base is judged from (`proposalBase`). BO_0233_011 */
  readonly createdDataRevision?: number;
  /** Present on a metadata-only read, where the content's `_type` is not. */
  readonly type?: string;
}

export interface ReadNode {
  readonly id: string;
  readonly revision: ReadRevision;
  /** Present when the read asked for history: prior revisions, newest first. */
  readonly history?: readonly ReadRevision[];
}

export interface ReadRelation {
  readonly id: string;
  readonly type: string;
  readonly fromNodeId: string;
  readonly to: { readonly kind: string; readonly nodeId?: string; readonly relationId?: string };
  readonly dataRevision: number;
  readonly createdAt: number;
  readonly validity: {
    readonly status: string;
    readonly dataRevision?: number;
    readonly updatedAt?: number;
  };
}

export interface ReadResult {
  readonly roots: readonly string[];
  readonly nodes: readonly ReadNode[];
  readonly relations: readonly ReadRelation[];
  readonly resolvedDataRevision: number;
}

export interface GraphRead {
  readonly statement: string;
  readonly parameters?: Record<string, unknown>;
  /** Node ids the read expands from, when the pattern is seeded rather than matched. */
  readonly roots?: readonly string[];
  /** Pins the read to the graph as it stood at this data revision. */
  readonly dataRevision?: number;
  /** Lays one open proposal group over established truth. */
  readonly proposalOverlay?: string;
  readonly unbounded?: boolean;
  readonly metadataOnly?: boolean;
  readonly purpose?: string;
}

interface Diagnostic {
  readonly code: string;
  readonly message: string;
}

interface Envelope {
  readonly status?: string;
  readonly result?: unknown;
  readonly resolvedDataRevision?: number;
  readonly diagnostics?: readonly Diagnostic[];
  readonly detail?: string;
  readonly dataRevision?: number;
  readonly confirmUrl?: string;
  readonly pending?: string;
}

async function post(url: string, body: unknown): Promise<{ readonly status: number; readonly envelope: Envelope }> {
  // The bridge resolves the person from the session the browser holds, so
  // the request's cookie travels with the call. BO_0208_007
  const cookie = forwardedCookie();
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie === undefined ? {} : { cookie }) },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let envelope: Envelope = {};
  try {
    envelope = text === "" ? {} : (JSON.parse(text) as Envelope);
  } catch {
    envelope = { detail: text };
  }
  return { status: response.status, envelope };
}

const failure = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

const describe = (envelope: Envelope, fallback: string): string => {
  const parts = (envelope.diagnostics ?? []).map((d) => `${d.code}: ${d.message}`);
  if (envelope.detail !== undefined && envelope.detail !== "") parts.push(envelope.detail);
  return parts.length === 0 ? fallback : parts.join("; ");
};

const firstCode = (envelope: Envelope): string =>
  envelope.diagnostics?.[0]?.code ?? envelope.status ?? "refused";

/** One rooted, bounded read of the graph as CCGW assembles it. */
export async function query(read: GraphRead): Promise<GraphOutcome<ReadResult>> {
  let answer;
  try {
    answer = await post(`${graphEnv().ccgwUrl}/v1/cypher/query`, {
      statement: read.statement,
      parameters: read.parameters ?? {},
      ...(read.roots === undefined ? {} : { roots: read.roots }),
      ...(read.dataRevision === undefined ? {} : { dataRevision: read.dataRevision }),
      ...(read.proposalOverlay === undefined ? {} : { proposalOverlay: read.proposalOverlay }),
      ...(read.unbounded === true ? { unbounded: true } : {}),
      ...(read.metadataOnly === true ? { metadataOnly: true } : {}),
      context: { principal: PRINCIPAL, purpose: read.purpose ?? "ui.shell read" },
    });
  } catch (error) {
    return { outcome: "storageError", detail: `CCGW is unreachable: ${String(error)}` };
  }
  const { envelope } = answer;
  if (envelope.status === "no_result") {
    return { outcome: "noResult", detail: "Nothing in the graph matched." };
  }
  if (envelope.status !== "success") {
    return { outcome: "storageError", detail: describe(envelope, `CCGW answered ${answer.status}`) };
  }
  const result = (envelope.result ?? {}) as Partial<ReadResult>;
  return {
    outcome: "success",
    result: {
      roots: result.roots ?? [],
      nodes: result.nodes ?? [],
      relations: result.relations ?? [],
      resolvedDataRevision: envelope.resolvedDataRevision ?? 0,
    },
  };
}

/** The group's touched set: the nodes it stages and the relations it stages. */
export interface TouchedSet {
  readonly proposal: string;
  readonly status: string;
  readonly touchedNodes: readonly string[];
  readonly stagedRelations: readonly {
    readonly id: string;
    readonly type: string;
    readonly fromNodeId: string;
    readonly toKind: string;
    readonly toId: string;
  }[];
}

export async function touchedSet(proposal: string): Promise<GraphOutcome<TouchedSet>> {
  try {
    const response = await fetch(`${graphEnv().ccgwUrl}/v1/proposals/${proposal}/touched`);
    if (!response.ok) {
      return { outcome: "storageError", detail: `touched set of ${proposal}: ${response.status}` };
    }
    return { outcome: "success", result: (await response.json()) as TouchedSet };
  } catch (error) {
    return { outcome: "storageError", detail: `CCGW is unreachable: ${String(error)}` };
  }
}

export interface Written {
  readonly dataRevision: string;
}

/**
 * A content truth write through the kernel's `write` verb: one mutation
 * script of content edits, content creation and content relations, refused
 * by the kernel's gate for anything that is not content. The bridge answers
 * the data revision it established at, and nothing else — a caller that needs
 * the revision it produced reads it back at that pin.
 */
export async function write(
  statement: string,
  parameters: Record<string, unknown>,
  rationale: string,
): Promise<GraphOutcome<Written>> {
  let answer;
  try {
    answer = await post(`${graphEnv().kernelUrl}/__kernel/review/write`, {
      statement,
      parameters,
      rationale,
    });
  } catch (error) {
    return { outcome: "storageError", detail: `the kernel is unreachable: ${String(error)}` };
  }
  const { status, envelope } = answer;
  if (status === 200 && envelope.status === "established") {
    return { outcome: "success", result: { dataRevision: String(envelope.dataRevision ?? "") } };
  }
  if (status === 409) {
    // CCGW refused the mutation itself: a validation rule, or content that
    // moved. The refusal's own words are the diagnosis.
    return failure("write_refused", describe(envelope, "the write was refused"));
  }
  if (status === 429) {
    return failure("write_too_frequent", describe(envelope, "coalesce edits in the editor"));
  }
  if (status === 403) {
    return { outcome: "refused", detail: describe(envelope, "the kernel refused the write") };
  }
  return { outcome: "storageError", detail: describe(envelope, `the kernel answered ${status}`) };
}

/**
 * A proposal-scoped mutation through the kernel's `stage` verb. The kernel
 * sets the proposal scope from the named group, never from the statement,
 * and a group that does not exist yet is created by the staging.
 */
export async function stage(
  proposal: string,
  statement: string,
  parameters: Record<string, unknown>,
  rationale: string,
): Promise<GraphOutcome<Written>> {
  let answer;
  try {
    answer = await post(`${graphEnv().kernelUrl}/__kernel/review/stage`, {
      proposal,
      statement,
      parameters,
      rationale,
    });
  } catch (error) {
    return { outcome: "storageError", detail: `the kernel is unreachable: ${String(error)}` };
  }
  const { status, envelope } = answer;
  if (status === 200 && envelope.status === "staged") {
    return { outcome: "success", result: { dataRevision: String(envelope.dataRevision ?? "") } };
  }
  if (status === 409) {
    return failure("stage_refused", describe(envelope, "the staging was refused"));
  }
  if (status === 429) {
    return failure("stage_too_frequent", describe(envelope, "coalesce edits in the editor"));
  }
  if (status === 403) {
    return { outcome: "refused", detail: describe(envelope, "the kernel refused the staging") };
  }
  return { outcome: "storageError", detail: describe(envelope, `the kernel answered ${status}`) };
}

export type Decision = "accept" | "reject";

export interface Decided {
  readonly decision: Decision;
}

/**
 * One member decision on an open group through the bridge's `accept` or
 * `reject` verb. A content member executes at once (`BO_0207_001`); a member
 * the kernel keeps behind its confirmation answers as refused with the
 * confirmation address, because the shell presents and never confirms. A
 * drifted rewrite answers as a conflict naming the member, which the surface
 * renders against it, and `override` is the explicit accept-over.
 */
export async function decide(
  decision: Decision,
  proposal: string,
  member: string,
  rationale: string,
  override = false,
): Promise<GraphOutcome<Decided>> {
  let answer;
  try {
    answer = await post(`${graphEnv().kernelUrl}/__kernel/review/${decision}`, {
      proposal,
      member,
      rationale,
      ...(override ? { override: true } : {}),
    });
  } catch (error) {
    return { outcome: "storageError", detail: `the kernel is unreachable: ${String(error)}` };
  }
  const { status, envelope } = answer;
  if (status === 200 && envelope.status === "success") {
    return { outcome: "success", result: { decision } };
  }
  if (status === 200 && envelope.status === "pending") {
    return {
      outcome: "refused",
      detail: `this decision needs the kernel's confirmation: ${envelope.confirmUrl ?? ""}`,
    };
  }
  if (status === 422) {
    const code = firstCode(envelope);
    if (code === "member_drift_conflict" || code === "member_stale") {
      return {
        outcome: "conflict",
        conflicts: [{ nodeId: member, expectedRevisionId: "", currentRevisionId: null }],
      };
    }
    return failure(code, describe(envelope, "the decision was refused"));
  }
  if (status === 409) {
    return { outcome: "refused", detail: describe(envelope, "the kernel refused the decision") };
  }
  return { outcome: "storageError", detail: describe(envelope, `the kernel answered ${status}`) };
}
