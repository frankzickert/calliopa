import type { ExtensionSummary } from "~/lib/library";
import {
  buildNetwork,
  type DocSource,
  type Network,
  type ProposalSummary,
} from "~/lib/owner-docs/network";
import {
  renderNode,
  type ExtensionFacts,
  type OwnerDocument,
} from "~/lib/owner-docs/render";
import {
  membersByManifest,
  nodesOfType,
  query,
  readElevated,
  readHead,
  stringOf,
  type GraphNode,
  type GraphResult,
} from "./graph-gateway";

/**
 * The extensions the graph holds, for the library and for their owners.
 *
 * Everything here is read from the gateway once per head data revision and
 * kept in memory: the shell's whole source is among the members, and the
 * owner document is assembled from it, so a read per click would be a read of
 * the shell per click. The cache is keyed by head; a new revision reads
 * again. BO_0201_004 BO_0201_005 BO_0201_007
 */

export type ExtensionListing =
  | {
      readonly reachable: true;
      readonly extensions: readonly ExtensionSummary[];
    }
  | {
      readonly reachable: false;
      readonly detail: string;
      readonly extensions: readonly [];
    };

export type ExtensionDocumentOutcome =
  | { readonly outcome: "success"; readonly document: OwnerDocument }
  | { readonly outcome: "missing"; readonly detail: string }
  | { readonly outcome: "unreachable"; readonly detail: string };

/** One revision an extension's Block ever had: who wrote it, why, and when. */
export interface RevisionEvent {
  readonly purpose: string;
  readonly author: string;
  readonly createdAt: number;
  readonly dataRevision: number;
}

interface Snapshot {
  readonly head: number;
  readonly manifests: readonly GraphNode[];
  readonly membersByManifest: ReadonlyMap<string, GraphNode[]>;
  readonly skillsByManifest: ReadonlyMap<string, GraphNode[]>;
  readonly dependsOn: ReadonlyMap<string, string[]>;
  readonly proposals: readonly ProposalSummary[];
  /** Every revision of a manifest and its members, current and archived, by manifest. */
  readonly eventsByManifest: ReadonlyMap<string, RevisionEvent[]>;
  readonly servedPin: number | null;
  readonly elevated: readonly string[];
  /** The kernel's extension state: which ids are inactive and which are pinned to a revision (`BO_0218_001`). */
  readonly inactive: readonly string[];
  readonly pins: ReadonlyMap<string, number>;
  /** Manifests that declare vocabulary, skills or intentions — members a version flip never pins (`BO_0219_006`). */
  readonly declaring: ReadonlySet<string>;
}

let cached: Snapshot | null = null;

function fail(detail: string): { readonly ok: false; readonly detail: string } {
  return { ok: false, detail };
}

/**
 * Revision events per manifest from a metadata-only read carrying history: the
 * relations say which manifest a member belongs to, and each node's current
 * revision plus its archived ones say who wrote what, when, and why. Nothing
 * here needs content, so the read stays small even for the shell's sources.
 */
export function eventsByManifest(
  ...results: readonly GraphResult[]
): Map<string, RevisionEvent[]> {
  const events = new Map<string, RevisionEvent[]>();
  const add = (manifest: string, node: GraphNode): void => {
    const list = events.get(manifest) ?? [];
    const entries = [node.revision, ...(node.history ?? [])];
    for (const entry of entries) {
      list.push({
        purpose: entry.purpose ?? "",
        author: entry.createdBy,
        createdAt: entry.createdAt,
        dataRevision: entry.dataRevision,
      });
    }
    events.set(manifest, list);
  };
  for (const result of results) {
    const byId = new Map(result.nodes.map((node) => [node.id, node] as const));
    for (const relation of result.relations) {
      if (relation.type !== "partOf" || relation.to.nodeId === undefined)
        continue;
      const member = byId.get(relation.fromNodeId);
      if (member !== undefined) add(relation.to.nodeId, member);
    }
    for (const manifest of nodesOfType(result, "ext.manifest"))
      add(manifest.id, manifest);
  }
  return events;
}

async function readSnapshot(): Promise<
  { ok: true; value: Snapshot } | { ok: false; detail: string }
> {
  const head = await readHead();
  if (!head.ok) return fail(head.detail);
  if (cached !== null && cached.head === head.value)
    return { ok: true, value: cached };

  const [
    manifests,
    sources,
    skills,
    depends,
    pins,
    groups,
    sourceHistory,
    skillHistory,
    manifestHistory,
    elevated,
    states,
    blocktypes,
    relationtypes,
    intentions,
  ] = await Promise.all([
    query("MATCH (m:ext.manifest) RETURN GRAPH m"),
    query(
      "MATCH (s:ext.source)-[r:partOf]->(m:ext.manifest) RETURN GRAPH s, m",
    ),
    query("MATCH (s:ext.skill)-[r:partOf]->(m:ext.manifest) RETURN GRAPH s, m"),
    query(
      "MATCH (a:ext.manifest)-[r:dependsOn]->(b:ext.manifest) RETURN GRAPH a, b",
    ),
    query("MATCH (p:kernel.releasepin) RETURN GRAPH p"),
    query("MATCH (g:ProposalGroup) RETURN GRAPH g"),
    query(
      "MATCH (s:ext.source)-[r:partOf]->(m:ext.manifest) RETURN GRAPH s, m INCLUDE HISTORY",
      {},
      { metadataOnly: true },
    ),
    query(
      "MATCH (s:ext.skill)-[r:partOf]->(m:ext.manifest) RETURN GRAPH s, m INCLUDE HISTORY",
      {},
      { metadataOnly: true },
    ),
    query(
      "MATCH (m:ext.manifest) RETURN GRAPH m INCLUDE HISTORY",
      {},
      { metadataOnly: true },
    ),
    readElevated(),
    query("MATCH (s:kernel.extensionstate) RETURN GRAPH s"),
    query(
      "MATCH (b:ext.blocktype)-[r:partOf]->(m:ext.manifest) RETURN GRAPH b, m",
      {},
      { metadataOnly: true },
    ),
    query(
      "MATCH (b:ext.relationtype)-[r:partOf]->(m:ext.manifest) RETURN GRAPH b, m",
      {},
      { metadataOnly: true },
    ),
    query(
      "MATCH (b:ext.intention)-[r:partOf]->(m:ext.manifest) RETURN GRAPH b, m",
      {},
      { metadataOnly: true },
    ),
  ]);
  const replies = [
    manifests,
    sources,
    skills,
    depends,
    pins,
    groups,
    sourceHistory,
    skillHistory,
    manifestHistory,
  ];
  for (const reply of replies) {
    if (!reply.ok) return fail(reply.detail);
  }
  if (
    !manifests.ok ||
    !sources.ok ||
    !skills.ok ||
    !depends.ok ||
    !pins.ok ||
    !groups.ok ||
    !sourceHistory.ok ||
    !skillHistory.ok ||
    !manifestHistory.ok
  ) {
    return fail("The gateway did not answer every read.");
  }

  const dependsOn = new Map<string, string[]>();
  for (const relation of depends.value.relations) {
    if (relation.type !== "dependsOn" || relation.to.nodeId === undefined)
      continue;
    const list = dependsOn.get(relation.fromNodeId) ?? [];
    list.push(relation.to.nodeId);
    dependsOn.set(relation.fromNodeId, list);
  }

  const pin = nodesOfType(pins.value, "kernel.releasepin")[0]?.revision.content[
    "pin"
  ];
  // The kernel's extension state: absent means everything active and nothing
  // pinned, the state of a fresh install. BO_0218_010
  const state = states.ok
    ? nodesOfType(states.value, "kernel.extensionstate")[0]?.revision.content
    : undefined;
  const inactive = Array.isArray(state?.["inactive"])
    ? (state["inactive"] as unknown[]).map(String)
    : [];
  const pinsRecord = state?.["pins"];
  const extensionPins = new Map<string, number>();
  if (typeof pinsRecord === "object" && pinsRecord !== null) {
    for (const [id, value] of Object.entries(
      pinsRecord as Record<string, unknown>,
    )) {
      if (typeof value === "number" && value > 0) extensionPins.set(id, value);
    }
  }
  const declaring = new Set<string>();
  for (const reply of [blocktypes, relationtypes, intentions]) {
    if (!reply.ok) continue;
    for (const relation of reply.value.relations) {
      if (relation.type === "partOf" && relation.to.nodeId !== undefined)
        declaring.add(relation.to.nodeId);
    }
  }
  for (const [manifestId, list] of membersByManifest(skills.value)) {
    if (list.length > 0) declaring.add(manifestId);
  }
  const proposals: ProposalSummary[] = nodesOfType(
    groups.value,
    "ProposalGroup",
  ).map((node) => ({
    id: node.id,
    status: stringOf(node.revision.content, "status"),
    rationale: stringOf(node.revision.content, "rationale"),
    author: node.revision.createdBy,
    dataRevision: node.revision.dataRevision,
  }));

  const snapshot: Snapshot = {
    head: head.value,
    manifests: nodesOfType(manifests.value, "ext.manifest"),
    membersByManifest: membersByManifest(sources.value),
    skillsByManifest: membersByManifest(skills.value),
    dependsOn,
    proposals,
    eventsByManifest: eventsByManifest(
      sourceHistory.value,
      skillHistory.value,
      manifestHistory.value,
    ),
    servedPin: typeof pin === "number" ? pin : null,
    elevated: elevated.ok ? elevated.value : [],
    inactive,
    pins: extensionPins,
    declaring,
  };
  cached = snapshot;
  return { ok: true, value: snapshot };
}

/** The newest established data revision among a manifest and its members. */
function newestRevision(snapshot: Snapshot, manifest: GraphNode): number {
  const members = [
    ...(snapshot.membersByManifest.get(manifest.id) ?? []),
    ...(snapshot.skillsByManifest.get(manifest.id) ?? []),
  ];
  return Math.max(
    manifest.revision.dataRevision,
    ...members.map((member) => member.revision.dataRevision),
  );
}

function summaryOf(snapshot: Snapshot, manifest: GraphNode): ExtensionSummary {
  const content = manifest.revision.content;
  const newest = newestRevision(snapshot, manifest);
  const id = stringOf(content, "id") || manifest.id.replace(/^node:/u, "");
  const pinnedAt = snapshot.pins.get(id) ?? null;
  return {
    id,
    version: stringOf(content, "version") || "unversioned",
    category:
      stringOf(content, "category") === "bundled" ? "bundled" : "individual",
    newestRevision: newest,
    servedPin: snapshot.servedPin,
    ahead: snapshot.servedPin !== null && newest > snapshot.servedPin,
    active: !snapshot.inactive.includes(id),
    pinned: pinnedAt !== null,
    pinnedAt,
  };
}

/**
 * Whether an extension declares block types, relation types, skills or
 * intentions: members that never materialize and so are never pinned by a
 * version flip, which the view says beside the version control. BO_0219_006
 */
export async function declaresVocabulary(id: string): Promise<boolean> {
  const snapshot = await readSnapshot();
  if (!snapshot.ok) return false;
  const manifest = snapshot.value.manifests.find(
    (candidate) => stringOf(candidate.revision.content, "id") === id,
  );
  return manifest !== undefined && snapshot.value.declaring.has(manifest.id);
}

export async function listExtensions(): Promise<ExtensionListing> {
  const snapshot = await readSnapshot();
  if (!snapshot.ok)
    return { reachable: false, detail: snapshot.detail, extensions: [] };
  const extensions = snapshot.value.manifests.map((manifest) =>
    summaryOf(snapshot.value, manifest),
  );
  extensions.sort((a, b) =>
    a.category !== b.category
      ? a.category === "bundled"
        ? -1
        : 1
      : a.id.localeCompare(b.id),
  );
  return { reachable: true, extensions };
}

function docsOf(members: readonly GraphNode[]): DocSource[] {
  const docs: DocSource[] = [];
  for (const member of members) {
    const content = member.revision.content;
    const path = stringOf(content, "path");
    const code = content["code"];
    if (typeof code !== "string") continue;
    if (
      path === "README.md" ||
      (path.startsWith("docs/") && path.endsWith(".md"))
    ) {
      docs.push({ path, content: code });
    }
  }
  return docs;
}

function factsOf(
  snapshot: Snapshot,
  manifest: GraphNode,
  summary: ExtensionSummary,
): ExtensionFacts {
  const idOf = (nodeId: string): string => {
    const node = snapshot.manifests.find(
      (candidate) => candidate.id === nodeId,
    );
    return node === undefined
      ? nodeId.replace(/^node:/u, "")
      : stringOf(node.revision.content, "id") || nodeId;
  };
  const dependedOnBy = [...snapshot.dependsOn.entries()]
    .filter(([, targets]) => targets.includes(manifest.id))
    .map(([from]) => idOf(from));
  const skill = snapshot.skillsByManifest.get(manifest.id)?.[0];
  const goal =
    skill === undefined ? "" : stringOf(skill.revision.content, "goal");
  return {
    id: summary.id,
    version: summary.version,
    category: summary.category,
    elevated: snapshot.elevated.includes(summary.id),
    establishedBy: manifest.revision.createdBy,
    establishedAt: manifest.revision.dataRevision,
    servedPin: snapshot.servedPin,
    newestRevision: summary.newestRevision,
    dependsOn: (snapshot.dependsOn.get(manifest.id) ?? []).map(idOf),
    dependedOnBy,
    skillGoal: goal === "" ? null : goal,
  };
}

/**
 * The proposals that carried this extension, from every revision its Blocks
 * ever had: each revision's rationale is the rationale of the group that
 * wrote it, so the join is by rationale, and a revision no group matches
 * (a write outside the proposal loop) is still an event with its author and
 * revision. Superseded revisions count: history is what happened, not what
 * is current.
 */
export function historyOf(
  events: readonly RevisionEvent[],
  proposals: readonly ProposalSummary[],
): ProposalSummary[] {
  const byRationale = new Map(
    proposals.map((proposal) => [proposal.rationale, proposal] as const),
  );
  const seen = new Map<string, ProposalSummary>();
  for (const event of events) {
    const key = event.purpose;
    if (key === "" || seen.has(key)) continue;
    const group = byRationale.get(key);
    seen.set(
      key,
      group ?? {
        id: "",
        status: "established",
        rationale: event.purpose,
        author: event.author,
        dataRevision: event.dataRevision,
      },
    );
  }
  return [...seen.values()].sort((a, b) => b.dataRevision - a.dataRevision);
}

const networks = new Map<string, { head: number; network: Network }>();

export async function readExtensionDocument(
  id: string,
  path?: string,
): Promise<ExtensionDocumentOutcome> {
  const snapshot = await readSnapshot();
  if (!snapshot.ok) return { outcome: "unreachable", detail: snapshot.detail };
  const manifest = snapshot.value.manifests.find(
    (node) => stringOf(node.revision.content, "id") === id,
  );
  if (manifest === undefined)
    return {
      outcome: "missing",
      detail: `The graph holds no extension ${id}.`,
    };

  const summary = summaryOf(snapshot.value, manifest);
  let entry = networks.get(id);
  if (entry === undefined || entry.head !== snapshot.value.head) {
    const network = buildNetwork(
      docsOf(snapshot.value.membersByManifest.get(manifest.id) ?? []),
      historyOf(
        snapshot.value.eventsByManifest.get(manifest.id) ?? [],
        snapshot.value.proposals,
      ),
    );
    entry = { head: snapshot.value.head, network };
    networks.set(id, entry);
  }
  const document = renderNode(
    path,
    entry.network,
    factsOf(snapshot.value, manifest, summary),
  );
  return document === null
    ? { outcome: "missing", detail: `${id} has no node ${path ?? ""}.` }
    : { outcome: "success", document };
}

/** For tests: the grouping and summary logic over a recorded result set. */
export const forTesting = { membersByManifest, summaryOf, docsOf };
export type { GraphResult };
