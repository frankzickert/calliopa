import { asRecord } from "../documents/content";
import type { AssembledGraph, GraphNodeView } from "../graph/contract";
import {
  ASSET_TYPE,
  CATEGORY_TYPE,
  CHARACTER_TYPE,
  EPISODE_TYPE,
  RENDITION_TYPE,
  SERIAL_TYPE,
  renditionAspect,
  type AssetMedium,
  type AssetRole,
  type RenditionProvenance,
  type SerialState,
} from "./vocabulary";

/**
 * Turning an assembled graph into an episode.
 *
 * Pure, so what an episode reads as — which assets it holds, which serials it
 * belongs to, what a rendition's aspect works out at — is settled without a
 * database.
 */

export interface RenditionView {
  readonly renditionId: string;
  readonly objectId: string;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
  readonly contentType: string;
  readonly provenance: RenditionProvenance;
  /** Derived from the dimensions, never stored beside them. */
  readonly aspect: string;
}

export interface CategoryView {
  readonly categoryId: string;
  readonly revisionId: string;
  readonly label: string;
  readonly line: string;
}

export interface CharacterView {
  readonly characterId: string;
  readonly revisionId: string;
  readonly name: string;
  readonly portraitAssetId: string | null;
  readonly descriptionDocumentId: string | null;
}

export interface AssetView {
  readonly assetId: string;
  readonly revisionId: string;
  readonly role: AssetRole;
  readonly medium: AssetMedium;
  readonly synthetic: boolean;
  readonly durationSeconds: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly transcript: string | null;
  readonly altText: string | null;
  /** A short authored line, or null where the author wrote none. */
  readonly label: string | null;
  readonly renditions: readonly RenditionView[];
  /** A prose asset's body. Null for an asset whose content is bytes. */
  readonly bodyDocumentId: string | null;
  /** Whose view this asset is. Empty is ordinary. */
  readonly categories: readonly CategoryView[];
}

export interface SerialView {
  readonly serialId: string;
  readonly revisionId: string;
  readonly name: string;
  readonly premise: string | null;
  readonly ordered: boolean;
  readonly state: SerialState;
  readonly openingDocumentId: string | null;
  readonly coverAssetId: string | null;
}

export interface EpisodeView {
  readonly episodeId: string;
  readonly revisionId: string;
  readonly title: string;
  readonly premise: string | null;
  readonly teaserText: string | null;
  /** The asset standing for the episode where it is not being played. */
  readonly teaserAssetId: string | null;
  readonly characters: readonly CharacterView[];
  /** Its number in an ordered home serial, or null anywhere else. */
  readonly position: number | null;
  readonly homeSerial: SerialView | null;
  /** Further memberships, unordered serials only. */
  readonly alsoIn: readonly SerialView[];
  readonly assets: readonly AssetView[];
}

const nodesOfType = (
  graph: AssembledGraph,
  semanticType: string,
): readonly GraphNodeView[] =>
  graph.nodes.filter((node) => node.semanticType === semanticType);

const nodeById = (graph: AssembledGraph, nodeId: string): GraphNodeView | undefined =>
  graph.nodes.find((node) => node.nodeId === nodeId);

/**
 * The active targets of one relation type leaving one node, in the order the
 * read answered them. A closed relation is not a membership any more, so it is
 * never a target here.
 */
export function activeTargets(
  graph: AssembledGraph,
  fromNodeId: string,
  relationType: string,
): readonly string[] {
  return graph.relations
    .filter(
      (relation) =>
        relation.relationType === relationType &&
        relation.fromNodeId === fromNodeId &&
        relation.validity.status === "active" &&
        relation.target.kind === "node",
    )
    .map((relation) => (relation.target.kind === "node" ? relation.target.nodeId : ""));
}

const numberOrNull = (value: unknown): number | null =>
  typeof value === "number" ? value : null;

const stringOrNull = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

export function toRendition(node: GraphNodeView): RenditionView | null {
  const content = asRecord(node.content);
  if (content === null || node.semanticType !== RENDITION_TYPE) return null;
  const width = content["width"] as number;
  const height = content["height"] as number;
  return {
    renditionId: node.nodeId,
    objectId: content["objectId"] as string,
    width,
    height,
    byteSize: content["byteSize"] as number,
    contentType: content["contentType"] as string,
    provenance: content["provenance"] as RenditionProvenance,
    aspect: renditionAspect({ width, height }),
  };
}

export function toCategory(node: GraphNodeView): CategoryView | null {
  const content = asRecord(node.content);
  if (content === null || node.semanticType !== CATEGORY_TYPE) return null;
  return {
    categoryId: node.nodeId,
    revisionId: node.revisionId,
    label: content["label"] as string,
    line: content["line"] as string,
  };
}

export function toCharacter(
  graph: AssembledGraph,
  node: GraphNodeView,
): CharacterView | null {
  const content = asRecord(node.content);
  if (content === null || node.semanticType !== CHARACTER_TYPE) return null;
  return {
    characterId: node.nodeId,
    revisionId: node.revisionId,
    name: content["name"] as string,
    portraitAssetId: activeTargets(graph, node.nodeId, "portrait")[0] ?? null,
    descriptionDocumentId:
      activeTargets(graph, node.nodeId, "description")[0] ?? null,
  };
}

export function toSerial(graph: AssembledGraph, node: GraphNodeView): SerialView | null {
  const content = asRecord(node.content);
  if (content === null || node.semanticType !== SERIAL_TYPE) return null;
  return {
    serialId: node.nodeId,
    revisionId: node.revisionId,
    name: content["name"] as string,
    premise: stringOrNull(content["premise"]),
    ordered: content["ordered"] as boolean,
    state: content["state"] as SerialState,
    openingDocumentId: activeTargets(graph, node.nodeId, "opening")[0] ?? null,
    coverAssetId: activeTargets(graph, node.nodeId, "cover")[0] ?? null,
  };
}

export function toAsset(graph: AssembledGraph, node: GraphNodeView): AssetView | null {
  const content = asRecord(node.content);
  if (content === null || node.semanticType !== ASSET_TYPE) return null;

  const renditions = activeTargets(graph, node.nodeId, "exports")
    .map((renditionId) => nodeById(graph, renditionId))
    .filter((candidate): candidate is GraphNodeView => candidate !== undefined)
    .map(toRendition)
    .filter((rendition): rendition is RenditionView => rendition !== null);

  return {
    assetId: node.nodeId,
    revisionId: node.revisionId,
    role: content["role"] as AssetRole,
    medium: content["medium"] as AssetMedium,
    synthetic: content["synthetic"] as boolean,
    durationSeconds: numberOrNull(content["durationSeconds"]),
    width: numberOrNull(content["width"]),
    height: numberOrNull(content["height"]),
    transcript: stringOrNull(content["transcript"]),
    altText: stringOrNull(content["altText"]),
    label: stringOrNull(content["label"]),
    renditions,
    bodyDocumentId: activeTargets(graph, node.nodeId, "body")[0] ?? null,
    categories: activeTargets(graph, node.nodeId, "categorised")
      .map((categoryId) => nodeById(graph, categoryId))
      .filter((candidate): candidate is GraphNodeView => candidate !== undefined)
      .map(toCategory)
      .filter((category): category is CategoryView => category !== null),
  };
}

/**
 * The episode as a reader meets it. Answers null when the graph holds no
 * established episode at that identity, which is what a deleted one reads as.
 */
export function assembleEpisode(
  graph: AssembledGraph,
  episodeId: string,
): EpisodeView | null {
  const node = nodeById(graph, episodeId);
  if (node === undefined || node.semanticType !== EPISODE_TYPE) return null;
  const content = asRecord(node.content);
  if (content === null) return null;

  const serialOf = (serialId: string): SerialView | null => {
    const serial = nodeById(graph, serialId);
    return serial === undefined ? null : toSerial(graph, serial);
  };

  const assets = activeTargets(graph, episodeId, "holds")
    .map((assetId) => nodeById(graph, assetId))
    .filter((candidate): candidate is GraphNodeView => candidate !== undefined)
    .map((asset) => toAsset(graph, asset))
    .filter((asset): asset is AssetView => asset !== null);

  const home = activeTargets(graph, episodeId, "homeSerial")[0];

  return {
    episodeId,
    revisionId: node.revisionId,
    title: (content["title"] as string) ?? "",
    premise: stringOrNull(content["premise"]),
    teaserText: stringOrNull(content["teaserText"]),
    teaserAssetId: activeTargets(graph, episodeId, "teaser")[0] ?? null,
    characters: activeTargets(graph, episodeId, "features")
      .map((characterId) => nodeById(graph, characterId))
      .filter((candidate): candidate is GraphNodeView => candidate !== undefined)
      .map((character) => toCharacter(graph, character))
      .filter((character): character is CharacterView => character !== null),
    position: numberOrNull(content["position"]),
    homeSerial: home === undefined ? null : serialOf(home),
    alsoIn: activeTargets(graph, episodeId, "alsoIn")
      .map(serialOf)
      .filter((serial): serial is SerialView => serial !== null),
    assets,
  };
}

/** Every serial the graph holds, for the index that lists them. */
export function assembleSerials(graph: AssembledGraph): readonly SerialView[] {
  return nodesOfType(graph, SERIAL_TYPE)
    .map((serial) => toSerial(graph, serial))
    .filter((serial): serial is SerialView => serial !== null);
}

/** Every category the graph holds, for the surface that offers them. */
export function assembleCategories(graph: AssembledGraph): readonly CategoryView[] {
  return nodesOfType(graph, CATEGORY_TYPE)
    .map(toCategory)
    .filter((category): category is CategoryView => category !== null);
}

/** Every character the graph holds. */
export function assembleCharacters(graph: AssembledGraph): readonly CharacterView[] {
  return nodesOfType(graph, CHARACTER_TYPE)
    .map((character) => toCharacter(graph, character))
    .filter((character): character is CharacterView => character !== null);
}
