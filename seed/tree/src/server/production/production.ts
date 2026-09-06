import type postgres from "postgres";
import type { JSONValue } from "postgres";

import type { EpisodeSummary } from "../../lib/library";

import type {
  AssembledGraph,
  GraphMutationResult,
  GraphOperation,
  GraphOutcome,
  NonEmpty,
} from "../graph/contract";
import { mutateGraph } from "../graph/mutate";
import { liveAt } from "../publishing/bindings";
import { frontsNaming } from "../publishing/front";
import { readGraph } from "../graph/read";
import { resolveRoots } from "../graph/roots";
import { calliopaGraphSchema } from "../graph/schema";
import {
  activeTargets,
  assembleCategories,
  assembleCharacters,
  assembleEpisode,
  assembleSerials,
  toAsset,
  toCharacter,
  toSerial,
  type AssetView,
  type CategoryView,
  type CharacterView,
  type EpisodeView,
  type SerialView,
} from "./assemble";
import {
  ASSET_TYPE,
  CATEGORY_TYPE,
  CHARACTER_TYPE,
  EPISODE_TYPE,
  RENDITION_TYPE,
  SERIAL_TYPE,
  type AssetContent,
  type CategoryContent,
  type CharacterContent,
  type RenditionContent,
  type SerialContent,
} from "./vocabulary";

/**
 * The production operations: episodes, what they hold, and the serials they
 * belong to.
 *
 * Rules that span more than one node live here rather than in content
 * validation, because validation sees one node and none of these are about
 * one node. Each gesture compiles into one gateway mutation, so a refusal
 * leaves the graph exactly as it was.
 */

const actor = { kind: "application" } as const;

/**
 * An episode read reaches its assets, and through them their renditions and
 * their bodies. Two hops, stated once.
 */
const EPISODE_DEPTH = 2;

/** Every relation an episode read follows, stated once. */
const EPISODE_RELATIONS = [
  "holds",
  "exports",
  "body",
  "categorised",
  "homeSerial",
  "alsoIn",
  "teaser",
  "features",
  "portrait",
  "description",
] as const;

export interface WrittenEpisode {
  readonly episodeId: string;
  readonly revisionId: string;
  readonly dataRevision: string;
}

function refuse<T>(rule: string, detail: string): GraphOutcome<T> {
  return {
    outcome: "validationFailure",
    failures: [{ operation: null, rule, detail }],
  };
}

async function commit<T>(
  db: postgres.Sql,
  operations: NonEmpty<GraphOperation>,
  result: (written: GraphMutationResult) => T,
): Promise<GraphOutcome<T>> {
  const outcome = await mutateGraph(db, calliopaGraphSchema, { operations }, actor);
  if (outcome.outcome !== "success") return outcome as GraphOutcome<T>;
  return { outcome: "success", result: result(outcome.result) };
}

const revisionOf = (written: GraphMutationResult, nodeId: string): string =>
  written.nodes.find((node) => node.nodeId === nodeId)?.revisionId ?? "";

const firstNodeId = (written: GraphMutationResult, ref: string): string =>
  written.nodes.find((node) => node.ref === ref)?.nodeId ?? "";

/** Reads one node and whatever hangs off it, so a rule can be checked against
 * what the graph actually holds rather than against what a caller claims. */
async function load(
  db: postgres.Sql,
  nodeId: string,
  relationTypes: readonly string[],
  depth: number,
): Promise<GraphOutcome<AssembledGraph>> {
  return readGraph(db, {
    roots: [nodeId],
    traverse: [{ direction: "outgoing", depth, relationTypes }],
  });
}

export type { EpisodeSummary };

/**
 * Every record of one type, assembled by the reader that type uses. Resolving
 * roots and reading them is the same shape for each, so it is written once.
 */
async function listOfType<T>(
  db: postgres.Sql,
  semanticType: string,
  assemble: (graph: AssembledGraph) => readonly T[],
  relationTypes?: readonly string[],
): Promise<GraphOutcome<readonly T[]>> {
  const resolved = await resolveRoots(db, { semanticType });
  if (resolved.outcome !== "success") return resolved as GraphOutcome<readonly T[]>;

  const [first, ...rest] = resolved.result.nodeIds;
  if (first === undefined) return { outcome: "success", result: [] };

  const outcome = await readGraph(db, {
    roots: [first, ...rest] as NonEmpty<string>,
    ...(relationTypes === undefined
      ? {}
      : { traverse: [{ direction: "outgoing" as const, depth: 1, relationTypes }] }),
  });
  if (outcome.outcome !== "success") return outcome as GraphOutcome<readonly T[]>;
  return { outcome: "success", result: assemble(outcome.result) };
}

export async function createEpisode(
  db: postgres.Sql,
  input: { readonly title: string },
): Promise<GraphOutcome<WrittenEpisode>> {
  return commit(
    db,
    [
      {
        op: "createNode",
        ref: "episode",
        semanticType: EPISODE_TYPE,
        content: { title: input.title },
      },
    ],
    (written) => {
      const episodeId = firstNodeId(written, "episode");
      return {
        episodeId,
        revisionId: revisionOf(written, episodeId),
        dataRevision: written.dataRevision,
      };
    },
  );
}

/**
 * The episode with everything it holds, in one rooted read bounded by relation
 * type, so reading an episode never walks into the rest of the graph.
 */
export async function readEpisode(
  db: postgres.Sql,
  episodeId: string,
): Promise<GraphOutcome<EpisodeView>> {
  const outcome = await load(db, episodeId, EPISODE_RELATIONS, EPISODE_DEPTH);
  if (outcome.outcome !== "success") return outcome as GraphOutcome<EpisodeView>;

  const episode = assembleEpisode(outcome.result, episodeId);
  if (episode === null) {
    return { outcome: "noResult", detail: `No episode ${episodeId} in this graph.` };
  }
  return { outcome: "success", result: episode };
}

/**
 * Archives the episode's established revision. What it held is left as it
 * stands: an asset may be held by any number of episodes, so removing one
 * episode's assets would reach into the others'.
 */
export async function deleteEpisode(
  db: postgres.Sql,
  input: { readonly episodeId: string; readonly baseRevisionId: string },
): Promise<GraphOutcome<WrittenEpisode>> {
  const existing = await readEpisode(db, input.episodeId);
  if (existing.outcome !== "success") return existing as GraphOutcome<WrittenEpisode>;

  const live = await liveAt(db, input.episodeId);
  if (live.length > 0) {
    return refuse(
      "liveAtDestination",
      `This episode is live at ${live.join(", ")}. Retire it there before deleting it here.`,
    );
  }

  const fronts = await frontsNaming(db, input.episodeId);
  if (fronts.length > 0) {
    return refuse(
      "namedByALiveFront",
      `The front at ${fronts.join(", ")} names this episode. Point that front elsewhere before deleting it here.`,
    );
  }

  return commit(
    db,
    [
      {
        op: "archiveNode",
        nodeId: input.episodeId,
        baseRevisionId: input.baseRevisionId,
      },
    ],
    (written) => ({
      episodeId: input.episodeId,
      revisionId: input.baseRevisionId,
      dataRevision: written.dataRevision,
    }),
  );
}

const byTitle = (left: EpisodeSummary, right: EpisodeSummary): number => {
  const compared = left.title.toLowerCase() < right.title.toLowerCase() ? -1 : 1;
  return left.title.toLowerCase() === right.title.toLowerCase() ? 0 : compared;
};

/**
 * The episodes the library shows. It reads identities and titles and assembles
 * nothing, so opening the drawer never pays for the assets a category does not
 * render.
 */
export async function listEpisodes(
  db: postgres.Sql,
): Promise<GraphOutcome<readonly EpisodeSummary[]>> {
  const resolved = await resolveRoots(db, { semanticType: EPISODE_TYPE });
  if (resolved.outcome !== "success") {
    return resolved as GraphOutcome<readonly EpisodeSummary[]>;
  }
  const [first, ...rest] = resolved.result.nodeIds;
  if (first === undefined) return { outcome: "success", result: [] };

  const outcome = await readGraph(db, { roots: [first, ...rest] as NonEmpty<string> });
  if (outcome.outcome !== "success") {
    return outcome as GraphOutcome<readonly EpisodeSummary[]>;
  }

  const summaries: EpisodeSummary[] = [];
  for (const node of outcome.result.nodes) {
    if (node.semanticType !== EPISODE_TYPE) continue;
    const title = (node.content as Record<string, unknown> | null)?.["title"];
    summaries.push({
      episodeId: node.nodeId,
      title: typeof title === "string" ? title : "",
    });
  }
  return { outcome: "success", result: summaries.sort(byTitle) };
}

export async function createAsset(
  db: postgres.Sql,
  content: AssetContent,
): Promise<GraphOutcome<{ readonly assetId: string; readonly dataRevision: string }>> {
  return commit(
    db,
    [
      {
        op: "createNode",
        ref: "asset",
        semanticType: ASSET_TYPE,
        content: content as unknown as JSONValue,
      },
    ],
    (written) => ({
      assetId: firstNodeId(written, "asset"),
      dataRevision: written.dataRevision,
    }),
  );
}

/**
 * Puts an asset in an episode. An asset may be held by any number of episodes,
 * so this refuses only a membership that already stands: two `holds` between
 * the same pair would make a single release ambiguous.
 */
export async function holdAsset(
  db: postgres.Sql,
  input: { readonly episodeId: string; readonly assetId: string },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const outcome = await load(db, input.episodeId, ["holds"], 1);
  if (outcome.outcome !== "success") {
    return outcome as GraphOutcome<{ readonly dataRevision: string }>;
  }
  if (assembleEpisode(outcome.result, input.episodeId) === null) {
    return refuse("unknownEpisode", `No episode ${input.episodeId} in this graph.`);
  }
  if (activeTargets(outcome.result, input.episodeId, "holds").includes(input.assetId)) {
    return refuse(
      "alreadyHeld",
      `Episode ${input.episodeId} already holds asset ${input.assetId}.`,
    );
  }

  return commit(
    db,
    [
      {
        op: "createRelation",
        relationType: "holds",
        from: { kind: "id", nodeId: input.episodeId },
        to: { kind: "node", node: { kind: "id", nodeId: input.assetId } },
      },
    ],
    (written) => ({ dataRevision: written.dataRevision }),
  );
}

/** Takes an asset out of one episode, leaving every other episode holding it. */
export async function releaseAsset(
  db: postgres.Sql,
  input: { readonly episodeId: string; readonly assetId: string },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const outcome = await load(db, input.episodeId, ["holds"], 1);
  if (outcome.outcome !== "success") {
    return outcome as GraphOutcome<{ readonly dataRevision: string }>;
  }
  const relation = outcome.result.relations.find(
    (candidate) =>
      candidate.relationType === "holds" &&
      candidate.fromNodeId === input.episodeId &&
      candidate.validity.status === "active" &&
      candidate.target.kind === "node" &&
      candidate.target.nodeId === input.assetId,
  );
  if (relation === undefined) {
    return refuse(
      "notHeld",
      `Episode ${input.episodeId} does not hold asset ${input.assetId}.`,
    );
  }

  return commit(
    db,
    [{ op: "closeRelation", relationId: relation.relationId }],
    (written) => ({ dataRevision: written.dataRevision }),
  );
}

async function loadAsset(
  db: postgres.Sql,
  assetId: string,
): Promise<
  | { readonly ok: true; readonly graph: AssembledGraph; readonly asset: AssetView }
  | { readonly ok: false; readonly outcome: GraphOutcome<never> }
> {
  const outcome = await load(db, assetId, ["exports", "body", "categorised"], 1);
  if (outcome.outcome !== "success") {
    return { ok: false, outcome: outcome as GraphOutcome<never> };
  }
  const node = outcome.result.nodes.find((candidate) => candidate.nodeId === assetId);
  const asset = node === undefined ? null : toAsset(outcome.result, node);
  if (asset === null) {
    return {
      ok: false,
      outcome: { outcome: "noResult", detail: `No asset ${assetId} in this graph.` },
    };
  }
  return { ok: true, graph: outcome.result, asset };
}

/**
 * Records one export of an asset and the object holding its bytes.
 *
 * A prose asset is refused: its content is a document, not a file, and a
 * rendition of it would be a second place its words live.
 */
export async function recordRendition(
  db: postgres.Sql,
  input: { readonly assetId: string; readonly rendition: RenditionContent },
): Promise<
  GraphOutcome<{ readonly renditionId: string; readonly dataRevision: string }>
> {
  const loaded = await loadAsset(db, input.assetId);
  if (!loaded.ok) return loaded.outcome;
  if (loaded.asset.medium === "prose") {
    return refuse(
      "proseHasNoRendition",
      "A prose asset's content is a document, so it carries no rendition.",
    );
  }
  const existing = loaded.asset.renditions.find(
    (rendition) => rendition.objectId === input.rendition.objectId,
  );
  if (existing !== undefined) {
    return refuse(
      "renditionExists",
      `Asset ${input.assetId} already exports object ${input.rendition.objectId}.`,
    );
  }

  return commit(
    db,
    [
      {
        op: "createNode",
        ref: "rendition",
        semanticType: RENDITION_TYPE,
        content: input.rendition as unknown as JSONValue,
      },
      {
        op: "createRelation",
        relationType: "exports",
        from: { kind: "id", nodeId: input.assetId },
        to: { kind: "node", node: { kind: "ref", ref: "rendition" } },
      },
    ],
    (written) => ({
      renditionId: firstNodeId(written, "rendition"),
      dataRevision: written.dataRevision,
    }),
  );
}

/**
 * Attaches the document that is a prose asset's body.
 *
 * Only a prose asset has one, and it has at most one: two bodies would leave
 * every reader picking which of them the asset says.
 */
export async function attachBody(
  db: postgres.Sql,
  input: { readonly assetId: string; readonly documentId: string },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const loaded = await loadAsset(db, input.assetId);
  if (!loaded.ok) return loaded.outcome;
  if (loaded.asset.medium !== "prose") {
    return refuse(
      "onlyProseHasBody",
      `Asset ${input.assetId} is ${loaded.asset.medium}, and only a prose asset carries a body.`,
    );
  }
  if (loaded.asset.bodyDocumentId !== null) {
    return refuse(
      "bodyExists",
      `Asset ${input.assetId} already carries a body document.`,
    );
  }

  return commit(
    db,
    [
      {
        op: "createRelation",
        relationType: "body",
        from: { kind: "id", nodeId: input.assetId },
        to: { kind: "node", node: { kind: "id", nodeId: input.documentId } },
      },
    ],
    (written) => ({ dataRevision: written.dataRevision }),
  );
}

/** Every relation an asset read follows, stated once. */
const ASSET_RELATIONS = ["exports", "body", "categorised"] as const;

/**
 * One asset with its exports, its body and its categories.
 *
 * An asset is reachable on its own because not every asset is reached through
 * an episode: a standing asset is held by none, and whatever names one — a
 * destination's front does — names it directly.
 */
export async function readAsset(
  db: postgres.Sql,
  assetId: string,
): Promise<AssetView | null> {
  const outcome = await load(db, assetId, ASSET_RELATIONS, 1);
  if (outcome.outcome !== "success") return null;
  const node = outcome.result.nodes.find((candidate) => candidate.nodeId === assetId);
  return node === undefined ? null : toAsset(outcome.result, node);
}

/**
 * The assets no episode holds.
 *
 * Standing assets are identified by what holds them rather than by a field or a
 * container, so this is the whole of what makes one: an asset with no active
 * `holds` pointing at it. A closed one is not a membership, so releasing an
 * asset from the last episode holding it makes it standing without anything
 * being written to say so.
 */
export async function listStandingAssets(
  db: postgres.Sql,
): Promise<GraphOutcome<readonly AssetView[]>> {
  const resolved = await resolveRoots(db, { semanticType: ASSET_TYPE });
  if (resolved.outcome !== "success") {
    return resolved as GraphOutcome<readonly AssetView[]>;
  }
  const [first, ...rest] = resolved.result.nodeIds;
  if (first === undefined) return { outcome: "success", result: [] };

  const outcome = await readGraph(db, {
    roots: [first, ...rest] as NonEmpty<string>,
    traverse: [
      { direction: "incoming", depth: 1, relationTypes: ["holds"] },
      { direction: "outgoing", depth: 1, relationTypes: [...ASSET_RELATIONS] },
    ],
  });
  if (outcome.outcome !== "success") return outcome as GraphOutcome<readonly AssetView[]>;

  const held = new Set(
    outcome.result.relations
      .filter(
        (relation) =>
          relation.relationType === "holds" &&
          relation.validity.status === "active" &&
          relation.target.kind === "node",
      )
      .map((relation) => (relation.target.kind === "node" ? relation.target.nodeId : "")),
  );

  const standing = outcome.result.nodes
    .filter((node) => node.semanticType === ASSET_TYPE && !held.has(node.nodeId))
    .map((node) => toAsset(outcome.result, node))
    .filter((asset): asset is AssetView => asset !== null);
  return { outcome: "success", result: standing };
}

export async function createSerial(
  db: postgres.Sql,
  content: SerialContent,
): Promise<GraphOutcome<{ readonly serialId: string; readonly dataRevision: string }>> {
  return commit(
    db,
    [
      {
        op: "createNode",
        ref: "serial",
        semanticType: SERIAL_TYPE,
        content: content as unknown as JSONValue,
      },
    ],
    (written) => ({
      serialId: firstNodeId(written, "serial"),
      dataRevision: written.dataRevision,
    }),
  );
}

export async function listSerials(
  db: postgres.Sql,
): Promise<GraphOutcome<readonly SerialView[]>> {
  const resolved = await resolveRoots(db, { semanticType: SERIAL_TYPE });
  if (resolved.outcome !== "success") {
    return resolved as GraphOutcome<readonly SerialView[]>;
  }
  const [first, ...rest] = resolved.result.nodeIds;
  if (first === undefined) return { outcome: "success", result: [] };

  const outcome = await readGraph(db, {
    roots: [first, ...rest] as NonEmpty<string>,
    traverse: [
      { direction: "outgoing", depth: 1, relationTypes: ["opening", "cover"] },
    ],
  });
  if (outcome.outcome !== "success") {
    return outcome as GraphOutcome<readonly SerialView[]>;
  }
  return { outcome: "success", result: assembleSerials(outcome.result) };
}

export async function readSerial(
  db: postgres.Sql,
  serialId: string,
): Promise<SerialView | null> {
  const outcome = await readGraph(db, {
    roots: [serialId],
    traverse: [
      { direction: "outgoing", depth: 1, relationTypes: ["opening", "cover"] },
    ],
  });
  if (outcome.outcome !== "success") return null;
  const node = outcome.result.nodes.find((candidate) => candidate.nodeId === serialId);
  return node === undefined ? null : toSerial(outcome.result, node);
}

/** Every position already taken in one serial, and by which episode. */
async function positionsIn(
  db: postgres.Sql,
  serialId: string,
): Promise<ReadonlyMap<number, string>> {
  const taken = new Map<number, string>();
  const outcome = await readGraph(db, {
    roots: [serialId],
    traverse: [{ direction: "incoming", depth: 1, relationTypes: ["homeSerial"] }],
  });
  if (outcome.outcome !== "success") return taken;

  for (const relation of outcome.result.relations) {
    if (relation.relationType !== "homeSerial") continue;
    if (relation.validity.status !== "active") continue;
    const episode = outcome.result.nodes.find(
      (node) => node.nodeId === relation.fromNodeId,
    );
    const position = (episode?.content as Record<string, unknown> | null)?.["position"];
    if (typeof position === "number") taken.set(position, relation.fromNodeId);
  }
  return taken;
}

/**
 * Sets the serial an episode belongs to, and its position within it.
 *
 * An ordered serial takes a position and an unordered one refuses it: the
 * distinction selects an entire presentation, so a half-numbered serial must
 * not be representable. A position is unique among a serial's members, so a
 * citation of episode four never comes to mean something else.
 */
export async function setHomeSerial(
  db: postgres.Sql,
  input: {
    readonly episodeId: string;
    readonly serialId: string;
    readonly position?: number;
  },
): Promise<GraphOutcome<WrittenEpisode>> {
  const episode = await readEpisode(db, input.episodeId);
  if (episode.outcome !== "success") return episode as GraphOutcome<WrittenEpisode>;

  const serial = await readSerial(db, input.serialId);
  if (serial === null) {
    return refuse("unknownSerial", `No serial ${input.serialId} in this graph.`);
  }

  if (serial.ordered && input.position === undefined) {
    return refuse(
      "positionRequired",
      `Serial ${serial.name} is ordered, so an episode in it carries a position.`,
    );
  }
  if (!serial.ordered && input.position !== undefined) {
    return refuse(
      "positionRefused",
      `Serial ${serial.name} is unordered, so its episodes carry no position.`,
    );
  }
  if (episode.result.alsoIn.some((member) => member.serialId === input.serialId)) {
    return refuse(
      "alreadyMember",
      `Episode ${input.episodeId} already appears in serial ${serial.name}.`,
    );
  }
  if (input.position !== undefined) {
    const taken = await positionsIn(db, input.serialId);
    const holder = taken.get(input.position);
    if (holder !== undefined && holder !== input.episodeId) {
      return refuse(
        "positionTaken",
        `Position ${input.position} in serial ${serial.name} is episode ${holder}.`,
      );
    }
  }

  const previous = episode.result.homeSerial;
  const operations: GraphOperation[] = [];

  if (previous !== null) {
    const outcome = await load(db, input.episodeId, ["homeSerial"], 1);
    if (outcome.outcome !== "success") return outcome as GraphOutcome<WrittenEpisode>;
    for (const relation of outcome.result.relations) {
      if (relation.relationType === "homeSerial" && relation.validity.status === "active") {
        operations.push({ op: "closeRelation", relationId: relation.relationId });
      }
    }
  }

  operations.push({
    op: "reviseNode",
    nodeId: input.episodeId,
    baseRevisionId: episode.result.revisionId,
    semanticType: EPISODE_TYPE,
    content:
      input.position === undefined
        ? { title: episode.result.title }
        : { title: episode.result.title, position: input.position },
  });
  operations.push({
    op: "createRelation",
    relationType: "homeSerial",
    from: { kind: "id", nodeId: input.episodeId },
    to: { kind: "node", node: { kind: "id", nodeId: input.serialId } },
  });

  const [first, ...rest] = operations;
  if (first === undefined) {
    return refuse("noOperation", "Setting a home serial writes at least one change.");
  }

  return commit(db, [first, ...rest], (written) => ({
    episodeId: input.episodeId,
    revisionId: revisionOf(written, input.episodeId),
    dataRevision: written.dataRevision,
  }));
}

/**
 * Adds a further membership. Unordered serials only: an episode carries at
 * most one position, always its home serial's, so an "also appears in" line is
 * a plain link and never a number whose next control leads somewhere else.
 */
export async function addAlsoIn(
  db: postgres.Sql,
  input: { readonly episodeId: string; readonly serialId: string },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const episode = await readEpisode(db, input.episodeId);
  if (episode.outcome !== "success") {
    return episode as GraphOutcome<{ readonly dataRevision: string }>;
  }
  const serial = await readSerial(db, input.serialId);
  if (serial === null) {
    return refuse("unknownSerial", `No serial ${input.serialId} in this graph.`);
  }
  if (serial.ordered) {
    return refuse(
      "orderedSerial",
      `Serial ${serial.name} is ordered, so it is a home serial rather than a further membership.`,
    );
  }
  if (episode.result.homeSerial?.serialId === input.serialId) {
    return refuse(
      "alreadyMember",
      `Serial ${serial.name} is already episode ${input.episodeId}'s home serial.`,
    );
  }
  if (episode.result.alsoIn.some((member) => member.serialId === input.serialId)) {
    return refuse(
      "alreadyMember",
      `Episode ${input.episodeId} already appears in serial ${serial.name}.`,
    );
  }

  return commit(
    db,
    [
      {
        op: "createRelation",
        relationType: "alsoIn",
        from: { kind: "id", nodeId: input.episodeId },
        to: { kind: "node", node: { kind: "id", nodeId: input.serialId } },
      },
    ],
    (written) => ({ dataRevision: written.dataRevision }),
  );
}

/**
 * Revises an episode's own writing. The premise and the teaser text are two
 * pieces with two jobs and neither is a fallback for the other, so each is set
 * or cleared on its own and nothing derives one from the other.
 */
export async function reviseEpisode(
  db: postgres.Sql,
  input: {
    readonly episodeId: string;
    readonly title?: string;
    readonly premise?: string | null;
    readonly teaserText?: string | null;
  },
): Promise<GraphOutcome<WrittenEpisode>> {
  const episode = await readEpisode(db, input.episodeId);
  if (episode.outcome !== "success") return episode as GraphOutcome<WrittenEpisode>;

  const current = episode.result;
  const settled = <T>(given: T | null | undefined, held: T | null): T | undefined => {
    if (given === undefined) return held ?? undefined;
    return given === null ? undefined : given;
  };

  const content: Record<string, unknown> = { title: input.title ?? current.title };
  const premise = settled(input.premise, current.premise);
  if (premise !== undefined) content["premise"] = premise;
  const teaserText = settled(input.teaserText, current.teaserText);
  if (teaserText !== undefined) content["teaserText"] = teaserText;
  if (current.position !== null) content["position"] = current.position;

  return commit(
    db,
    [
      {
        op: "reviseNode",
        nodeId: input.episodeId,
        baseRevisionId: current.revisionId,
        semanticType: EPISODE_TYPE,
        content: content as JSONValue,
      },
    ],
    (written) => ({
      episodeId: input.episodeId,
      revisionId: revisionOf(written, input.episodeId),
      dataRevision: written.dataRevision,
    }),
  );
}

/**
 * Names the asset that stands for the episode where it is not being played.
 *
 * It must be an asset the episode holds and an image: the teaser is what every
 * surface shows in place of a film, and an episode holding several images is
 * exactly why nothing may derive the pick from list order.
 */
export async function setTeaser(
  db: postgres.Sql,
  input: { readonly episodeId: string; readonly assetId: string },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const episode = await readEpisode(db, input.episodeId);
  if (episode.outcome !== "success") {
    return episode as GraphOutcome<{ readonly dataRevision: string }>;
  }
  const held = episode.result.assets.find((asset) => asset.assetId === input.assetId);
  if (held === undefined) {
    return refuse(
      "notHeld",
      `Episode ${input.episodeId} does not hold asset ${input.assetId}, so it cannot be its teaser.`,
    );
  }
  if (held.medium !== "image") {
    return refuse(
      "teaserIsAnImage",
      `Asset ${input.assetId} is ${held.medium}, and a teaser is an image.`,
    );
  }

  const operations: GraphOperation[] = [];
  if (episode.result.teaserAssetId !== null) {
    const outcome = await load(db, input.episodeId, ["teaser"], 1);
    if (outcome.outcome !== "success") {
      return outcome as GraphOutcome<{ readonly dataRevision: string }>;
    }
    for (const relation of outcome.result.relations) {
      if (relation.relationType === "teaser" && relation.validity.status === "active") {
        operations.push({ op: "closeRelation", relationId: relation.relationId });
      }
    }
  }
  operations.push({
    op: "createRelation",
    relationType: "teaser",
    from: { kind: "id", nodeId: input.episodeId },
    to: { kind: "node", node: { kind: "id", nodeId: input.assetId } },
  });

  const [first, ...rest] = operations;
  if (first === undefined) return refuse("noOperation", "Naming a teaser writes a change.");
  return commit(db, [first, ...rest], (written) => ({
    dataRevision: written.dataRevision,
  }));
}

/** A short authored line on an asset, or `null` to remove the one it carries. */
export async function setAssetLabel(
  db: postgres.Sql,
  input: { readonly assetId: string; readonly label: string | null },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const loaded = await loadAsset(db, input.assetId);
  if (!loaded.ok) return loaded.outcome;

  const asset = loaded.asset;
  const content: Record<string, unknown> = {
    role: asset.role,
    medium: asset.medium,
    synthetic: asset.synthetic,
  };
  if (asset.durationSeconds !== null) content["durationSeconds"] = asset.durationSeconds;
  if (asset.width !== null) content["width"] = asset.width;
  if (asset.height !== null) content["height"] = asset.height;
  if (asset.transcript !== null) content["transcript"] = asset.transcript;
  if (asset.altText !== null) content["altText"] = asset.altText;
  if (input.label !== null) content["label"] = input.label;

  return commit(
    db,
    [
      {
        op: "reviseNode",
        nodeId: input.assetId,
        baseRevisionId: asset.revisionId,
        semanticType: ASSET_TYPE,
        content: content as JSONValue,
      },
    ],
    (written) => ({ dataRevision: written.dataRevision }),
  );
}

export async function createCategory(
  db: postgres.Sql,
  content: CategoryContent,
): Promise<GraphOutcome<{ readonly categoryId: string; readonly dataRevision: string }>> {
  return commit(
    db,
    [
      {
        op: "createNode",
        ref: "category",
        semanticType: CATEGORY_TYPE,
        content: content as unknown as JSONValue,
      },
    ],
    (written) => ({
      categoryId: firstNodeId(written, "category"),
      dataRevision: written.dataRevision,
    }),
  );
}

export async function listCategories(
  db: postgres.Sql,
): Promise<GraphOutcome<readonly CategoryView[]>> {
  return listOfType(db, CATEGORY_TYPE, assembleCategories);
}

/**
 * Names a point of view an asset takes. An asset may carry any number, so this
 * refuses only a category it already carries: two of the same would make one
 * removal ambiguous.
 */
export async function categoriseAsset(
  db: postgres.Sql,
  input: { readonly assetId: string; readonly categoryId: string },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const loaded = await loadAsset(db, input.assetId);
  if (!loaded.ok) return loaded.outcome;

  const category = await readGraph(db, { roots: [input.categoryId] });
  const known =
    category.outcome === "success" &&
    category.result.nodes.some(
      (node) =>
        node.nodeId === input.categoryId && node.semanticType === CATEGORY_TYPE,
    );
  if (!known) {
    return refuse("unknownCategory", `No category ${input.categoryId} in this graph.`);
  }
  if (loaded.asset.categories.some((held) => held.categoryId === input.categoryId)) {
    return refuse(
      "alreadyCategorised",
      `Asset ${input.assetId} already carries category ${input.categoryId}.`,
    );
  }

  return commit(
    db,
    [
      {
        op: "createRelation",
        relationType: "categorised",
        from: { kind: "id", nodeId: input.assetId },
        to: { kind: "node", node: { kind: "id", nodeId: input.categoryId } },
      },
    ],
    (written) => ({ dataRevision: written.dataRevision }),
  );
}

/** Takes one point of view off an asset, leaving every other it carries. */
export async function uncategoriseAsset(
  db: postgres.Sql,
  input: { readonly assetId: string; readonly categoryId: string },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const outcome = await load(db, input.assetId, ["categorised"], 1);
  if (outcome.outcome !== "success") {
    return outcome as GraphOutcome<{ readonly dataRevision: string }>;
  }
  const relation = outcome.result.relations.find(
    (candidate) =>
      candidate.relationType === "categorised" &&
      candidate.fromNodeId === input.assetId &&
      candidate.validity.status === "active" &&
      candidate.target.kind === "node" &&
      candidate.target.nodeId === input.categoryId,
  );
  if (relation === undefined) {
    return refuse(
      "notCategorised",
      `Asset ${input.assetId} does not carry category ${input.categoryId}.`,
    );
  }
  return commit(
    db,
    [{ op: "closeRelation", relationId: relation.relationId }],
    (written) => ({ dataRevision: written.dataRevision }),
  );
}

export async function createCharacter(
  db: postgres.Sql,
  content: CharacterContent,
): Promise<
  GraphOutcome<{ readonly characterId: string; readonly dataRevision: string }>
> {
  return commit(
    db,
    [
      {
        op: "createNode",
        ref: "character",
        semanticType: CHARACTER_TYPE,
        content: content as unknown as JSONValue,
      },
    ],
    (written) => ({
      characterId: firstNodeId(written, "character"),
      dataRevision: written.dataRevision,
    }),
  );
}

export async function listCharacters(
  db: postgres.Sql,
): Promise<GraphOutcome<readonly CharacterView[]>> {
  return listOfType(db, CHARACTER_TYPE, assembleCharacters, [
    "portrait",
    "description",
  ]);
}

export async function readCharacter(
  db: postgres.Sql,
  characterId: string,
): Promise<GraphOutcome<CharacterView>> {
  const outcome = await load(db, characterId, ["portrait", "description"], 1);
  if (outcome.outcome !== "success") return outcome as GraphOutcome<CharacterView>;
  const node = outcome.result.nodes.find(
    (candidate) => candidate.nodeId === characterId,
  );
  const character = node === undefined ? null : toCharacter(outcome.result, node);
  if (character === null) {
    return { outcome: "noResult", detail: `No character ${characterId} in this graph.` };
  }
  return { outcome: "success", result: character };
}

/**
 * The episodes a character appears in, read from the relation rather than from
 * a list anyone maintains. Every shelf is a query.
 */
export async function episodesFeaturing(
  db: postgres.Sql,
  characterId: string,
): Promise<GraphOutcome<readonly EpisodeSummary[]>> {
  const outcome = await readGraph(db, {
    roots: [characterId],
    traverse: [{ direction: "incoming", depth: 1, relationTypes: ["features"] }],
  });
  if (outcome.outcome !== "success") {
    return outcome as GraphOutcome<readonly EpisodeSummary[]>;
  }
  const featured = new Set(
    outcome.result.relations
      .filter(
        (relation) =>
          relation.relationType === "features" &&
          relation.validity.status === "active" &&
          relation.target.kind === "node" &&
          relation.target.nodeId === characterId,
      )
      .map((relation) => relation.fromNodeId),
  );
  const summaries: EpisodeSummary[] = [];
  for (const node of outcome.result.nodes) {
    if (node.semanticType !== EPISODE_TYPE || !featured.has(node.nodeId)) continue;
    const title = (node.content as Record<string, unknown> | null)?.["title"];
    summaries.push({
      episodeId: node.nodeId,
      title: typeof title === "string" ? title : "",
    });
  }
  return { outcome: "success", result: summaries.sort(byTitle) };
}

/** Says a character appears in an episode. */
export async function featureCharacter(
  db: postgres.Sql,
  input: { readonly episodeId: string; readonly characterId: string },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const episode = await readEpisode(db, input.episodeId);
  if (episode.outcome !== "success") {
    return episode as GraphOutcome<{ readonly dataRevision: string }>;
  }
  const character = await readCharacter(db, input.characterId);
  if (character.outcome !== "success") {
    return refuse("unknownCharacter", `No character ${input.characterId} in this graph.`);
  }
  if (
    episode.result.characters.some(
      (held) => held.characterId === input.characterId,
    )
  ) {
    return refuse(
      "alreadyFeatured",
      `Episode ${input.episodeId} already features ${character.result.name}.`,
    );
  }
  return commit(
    db,
    [
      {
        op: "createRelation",
        relationType: "features",
        from: { kind: "id", nodeId: input.episodeId },
        to: { kind: "node", node: { kind: "id", nodeId: input.characterId } },
      },
    ],
    (written) => ({ dataRevision: written.dataRevision }),
  );
}

/** Replaces whatever single target one relation currently points at. */
async function setSingleTarget(
  db: postgres.Sql,
  input: {
    readonly fromNodeId: string;
    readonly relationType: string;
    readonly toNodeId: string;
  },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const outcome = await load(db, input.fromNodeId, [input.relationType], 1);
  if (outcome.outcome !== "success") {
    return outcome as GraphOutcome<{ readonly dataRevision: string }>;
  }
  const operations: GraphOperation[] = outcome.result.relations
    .filter(
      (relation) =>
        relation.relationType === input.relationType &&
        relation.fromNodeId === input.fromNodeId &&
        relation.validity.status === "active",
    )
    .map((relation) => ({ op: "closeRelation" as const, relationId: relation.relationId }));

  operations.push({
    op: "createRelation",
    relationType: input.relationType,
    from: { kind: "id", nodeId: input.fromNodeId },
    to: { kind: "node", node: { kind: "id", nodeId: input.toNodeId } },
  });

  const [first, ...rest] = operations;
  if (first === undefined) {
    return refuse("noOperation", "Setting a target writes a change.");
  }
  return commit(db, [first, ...rest], (written) => ({
    dataRevision: written.dataRevision,
  }));
}

/** The one image that stands for a character. */
export async function setPortrait(
  db: postgres.Sql,
  input: { readonly characterId: string; readonly assetId: string },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const character = await readCharacter(db, input.characterId);
  if (character.outcome !== "success") {
    return character as GraphOutcome<{ readonly dataRevision: string }>;
  }
  const loaded = await loadAsset(db, input.assetId);
  if (!loaded.ok) return loaded.outcome;
  if (loaded.asset.medium !== "image") {
    return refuse(
      "portraitIsAnImage",
      `Asset ${input.assetId} is ${loaded.asset.medium}, and a portrait is an image.`,
    );
  }
  return setSingleTarget(db, {
    fromNodeId: input.characterId,
    relationType: "portrait",
    toNodeId: input.assetId,
  });
}

/**
 * A character's description is a document, not a line: a character page is a
 * piece of writing about who someone is rather than a caption under a portrait.
 */
export async function setCharacterDescription(
  db: postgres.Sql,
  input: { readonly characterId: string; readonly documentId: string },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const character = await readCharacter(db, input.characterId);
  if (character.outcome !== "success") {
    return character as GraphOutcome<{ readonly dataRevision: string }>;
  }
  return setSingleTarget(db, {
    fromNodeId: input.characterId,
    relationType: "description",
    toNodeId: input.documentId,
  });
}

/** Revises a serial's own writing and its state. */
export async function reviseSerial(
  db: postgres.Sql,
  input: {
    readonly serialId: string;
    readonly name?: string;
    readonly premise?: string | null;
    readonly state?: SerialContent["state"];
  },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const serial = await readSerial(db, input.serialId);
  if (serial === null) {
    return refuse("unknownSerial", `No serial ${input.serialId} in this graph.`);
  }
  const content: Record<string, unknown> = {
    name: input.name ?? serial.name,
    // `ordered` selects an entire presentation and is never changed in passing.
    ordered: serial.ordered,
    state: input.state ?? serial.state,
  };
  const premise =
    input.premise === undefined ? (serial.premise ?? undefined) : (input.premise ?? undefined);
  if (premise !== undefined) content["premise"] = premise;

  return commit(
    db,
    [
      {
        op: "reviseNode",
        nodeId: input.serialId,
        baseRevisionId: serial.revisionId,
        semanticType: SERIAL_TYPE,
        content: content as JSONValue,
      },
    ],
    (written) => ({ dataRevision: written.dataRevision }),
  );
}

/** The prose a serial page leads with, as a document like any other prose. */
export async function setSerialOpening(
  db: postgres.Sql,
  input: { readonly serialId: string; readonly documentId: string },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  if ((await readSerial(db, input.serialId)) === null) {
    return refuse("unknownSerial", `No serial ${input.serialId} in this graph.`);
  }
  return setSingleTarget(db, {
    fromNodeId: input.serialId,
    relationType: "opening",
    toNodeId: input.documentId,
  });
}

/** The still a serial's card carries. */
export async function setSerialCover(
  db: postgres.Sql,
  input: { readonly serialId: string; readonly assetId: string },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  if ((await readSerial(db, input.serialId)) === null) {
    return refuse("unknownSerial", `No serial ${input.serialId} in this graph.`);
  }
  const loaded = await loadAsset(db, input.assetId);
  if (!loaded.ok) return loaded.outcome;
  if (loaded.asset.medium !== "image") {
    return refuse(
      "coverIsAnImage",
      `Asset ${input.assetId} is ${loaded.asset.medium}, and a cover still is an image.`,
    );
  }
  return setSingleTarget(db, {
    fromNodeId: input.serialId,
    relationType: "cover",
    toNodeId: input.assetId,
  });
}

/**
 * Replaces one export of an asset with another.
 *
 * The old rendition's `exports` is closed rather than deleted, which is what
 * makes it superseded: the record and its bytes stay, and the asset stops
 * pointing at it. A superseded rendition is what the sweep considers, and the
 * publication log is what protects the ones that actually went somewhere.
 */
export async function replaceRendition(
  db: postgres.Sql,
  input: {
    readonly assetId: string;
    readonly renditionId: string;
    readonly rendition: RenditionContent;
  },
): Promise<
  GraphOutcome<{ readonly renditionId: string; readonly dataRevision: string }>
> {
  const outcome = await load(db, input.assetId, ["exports"], 1);
  if (outcome.outcome !== "success") {
    return outcome as GraphOutcome<{
      readonly renditionId: string;
      readonly dataRevision: string;
    }>;
  }
  const relation = outcome.result.relations.find(
    (candidate) =>
      candidate.relationType === "exports" &&
      candidate.fromNodeId === input.assetId &&
      candidate.validity.status === "active" &&
      candidate.target.kind === "node" &&
      candidate.target.nodeId === input.renditionId,
  );
  if (relation === undefined) {
    return refuse(
      "notAnExport",
      `Asset ${input.assetId} does not export rendition ${input.renditionId}.`,
    );
  }

  return commit(
    db,
    [
      { op: "closeRelation", relationId: relation.relationId },
      {
        op: "createNode",
        ref: "rendition",
        semanticType: RENDITION_TYPE,
        content: input.rendition as unknown as JSONValue,
      },
      {
        op: "createRelation",
        relationType: "exports",
        from: { kind: "id", nodeId: input.assetId },
        to: { kind: "node", node: { kind: "ref", ref: "rendition" } },
      },
    ],
    (written) => ({
      renditionId: firstNodeId(written, "rendition"),
      dataRevision: written.dataRevision,
    }),
  );
}

/**
 * Every object a superseded rendition holds: one whose `exports` has been
 * closed, so the asset no longer points at it. These are what the sweep
 * considers; the publication log decides which of them it may actually remove.
 */
export async function supersededObjectIds(
  db: postgres.Sql,
): Promise<ReadonlySet<string>> {
  const resolved = await resolveRoots(db, { semanticType: RENDITION_TYPE });
  if (resolved.outcome !== "success") return new Set();
  const [first, ...rest] = resolved.result.nodeIds;
  if (first === undefined) return new Set();

  const outcome = await readGraph(db, {
    roots: [first, ...rest] as NonEmpty<string>,
    traverse: [{ direction: "incoming", depth: 1, relationTypes: ["exports"] }],
  });
  if (outcome.outcome !== "success") return new Set();

  // A rooted read follows relations that still apply, so a closed `exports`
  // does not come back at all. What identifies a superseded rendition is
  // therefore the absence of an active one rather than the presence of a closed
  // one: every rendition is created with its `exports` in the same mutation, so
  // a rendition no asset actively exports is one an asset stopped exporting.
  const active = new Set<string>();
  for (const relation of outcome.result.relations) {
    if (relation.relationType !== "exports" || relation.target.kind !== "node") continue;
    if (relation.validity.status === "active") active.add(relation.target.nodeId);
  }

  const superseded = new Set<string>();
  for (const node of outcome.result.nodes) {
    if (node.semanticType !== RENDITION_TYPE || active.has(node.nodeId)) continue;
    const objectId = (node.content as Record<string, unknown> | null)?.["objectId"];
    if (typeof objectId === "string") superseded.add(objectId);
  }
  return superseded;
}

/**
 * The two refusals every deletable record carries.
 *
 * Both exist because the harm runs the other way from a publish: publishing by
 * accident puts something public that should not be, while deleting here leaves
 * a page the author believes is gone still being served, or a hole in the first
 * thing an arrival sees. A refusal that names where is what makes either
 * impossible to miss.
 */
async function stillNeeded(
  db: postgres.Sql,
  recordId: string,
  what: string,
): Promise<GraphOutcome<never> | null> {
  const live = await liveAt(db, recordId);
  if (live.length > 0) {
    return refuse(
      "liveAtDestination",
      `This ${what} is live at ${live.join(", ")}. Retire it there before deleting it here.`,
    );
  }
  const fronts = await frontsNaming(db, recordId);
  if (fronts.length > 0) {
    return refuse(
      "namedByALiveFront",
      `The front at ${fronts.join(", ")} names this ${what}. Point that front elsewhere before deleting it here.`,
    );
  }
  return null;
}

/** Every node of one type that still points at this record through a relation. */
async function pointingAt(
  db: postgres.Sql,
  recordId: string,
  relationType: string,
): Promise<readonly string[]> {
  const outcome = await readGraph(db, {
    roots: [recordId],
    traverse: [{ direction: "incoming", depth: 1, relationTypes: [relationType] }],
  });
  if (outcome.outcome !== "success") return [];
  return outcome.result.relations
    .filter(
      (relation) =>
        relation.relationType === relationType &&
        relation.validity.status === "active" &&
        relation.target.kind === "node" &&
        relation.target.nodeId === recordId,
    )
    .map((relation) => relation.fromNodeId);
}

async function archive(
  db: postgres.Sql,
  nodeId: string,
  baseRevisionId: string,
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  return commit(db, [{ op: "archiveNode", nodeId, baseRevisionId }], (written) => ({
    dataRevision: written.dataRevision,
  }));
}

/**
 * Deletes an asset. It is refused while an episode still holds it: an episode
 * whose asset quietly resolved to nothing would lose it from its own read
 * without anyone having removed it.
 */
export async function deleteAsset(
  db: postgres.Sql,
  input: { readonly assetId: string; readonly baseRevisionId: string },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const loaded = await loadAsset(db, input.assetId);
  if (!loaded.ok) return loaded.outcome;

  const held = await pointingAt(db, input.assetId, "holds");
  if (held.length > 0) {
    return refuse(
      "heldByAnEpisode",
      `${held.length} episode(s) hold this asset. Release it from each before deleting it.`,
    );
  }
  const refusal = await stillNeeded(db, input.assetId, "asset");
  if (refusal !== null) return refusal;

  return archive(db, input.assetId, input.baseRevisionId);
}

/**
 * Deletes a serial. It is refused while an episode belongs to it, because a
 * position means a place in something and a member of a serial that is gone
 * carries a number that means nothing.
 */
export async function deleteSerial(
  db: postgres.Sql,
  input: { readonly serialId: string; readonly baseRevisionId: string },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  if ((await readSerial(db, input.serialId)) === null) {
    return refuse("unknownSerial", `No serial ${input.serialId} in this graph.`);
  }
  const members = [
    ...(await pointingAt(db, input.serialId, "homeSerial")),
    ...(await pointingAt(db, input.serialId, "alsoIn")),
  ];
  if (members.length > 0) {
    return refuse(
      "hasMembers",
      `${members.length} episode(s) belong to this serial. Move them before deleting it.`,
    );
  }
  const refusal = await stillNeeded(db, input.serialId, "serial");
  if (refusal !== null) return refusal;

  return archive(db, input.serialId, input.baseRevisionId);
}

/** Deletes a character, refused while an episode says it appears in it. */
export async function deleteCharacter(
  db: postgres.Sql,
  input: { readonly characterId: string; readonly baseRevisionId: string },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const character = await readCharacter(db, input.characterId);
  if (character.outcome !== "success") {
    return character as GraphOutcome<{ readonly dataRevision: string }>;
  }
  const featured = await pointingAt(db, input.characterId, "features");
  if (featured.length > 0) {
    return refuse(
      "appearsInEpisodes",
      `${featured.length} episode(s) say ${character.result.name} appears in them. Remove those before deleting the character.`,
    );
  }
  const refusal = await stillNeeded(db, input.characterId, "character");
  if (refusal !== null) return refusal;

  return archive(db, input.characterId, input.baseRevisionId);
}

/**
 * Deletes a category, refused while an asset carries it.
 *
 * A category has no address and no citation to protect, so it is deleted rather
 * than retired; what it needs instead is the refusal that stops a published
 * asset pointing at nothing. `../homepage` states the same rule at its own
 * boundary, and this is the same rule stated where the author is.
 */
export async function deleteCategory(
  db: postgres.Sql,
  input: { readonly categoryId: string; readonly baseRevisionId: string },
): Promise<GraphOutcome<{ readonly dataRevision: string }>> {
  const carried = await pointingAt(db, input.categoryId, "categorised");
  if (carried.length > 0) {
    return refuse(
      "carriedByAssets",
      `${carried.length} asset(s) carry this category. Take it off each before deleting it.`,
    );
  }
  const refusal = await stillNeeded(db, input.categoryId, "category");
  if (refusal !== null) return refusal;

  return archive(db, input.categoryId, input.baseRevisionId);
}
