import type { JSONValue } from "postgres";

import { asRecord } from "../documents/content";
import { DOCUMENT_TYPE } from "../documents/vocabulary";
import type { GraphSchema } from "../graph/contract";

/**
 * Calliopa's committed production vocabulary: what the author makes.
 *
 * Definitions are source in this repository, like the block vocabulary. Adding
 * a role or widening a permitted set is an ordinary change, and narrowing one
 * is breaking, because content established under the wider set may hold a value
 * the narrower set forbids.
 */

/** The node types this vocabulary defines. */
export const ASSET_TYPE = "asset";
export const EPISODE_TYPE = "episode";
export const SERIAL_TYPE = "serial";
export const RENDITION_TYPE = "rendition";
export const CATEGORY_TYPE = "category";
export const CHARACTER_TYPE = "character";

/**
 * What the author made an asset as. This is Calliopa's own vocabulary, not any
 * destination's: a destination maps these onto whatever it accepts, and a role
 * that no destination takes is still a real thing that was produced.
 */
export const ASSET_ROLES = [
  "complete-episode",
  "main-video",
  "teaser",
  "crossover",
  "blooper",
  "cinematic-image",
  "statement",
  "image-teaser",
  "field-note",
] as const;
export type AssetRole = (typeof ASSET_ROLES)[number];

/**
 * `video` and `image` carry bytes; `prose` carries a document. One concept
 * across all three, so a destination mapping reads one role vocabulary rather
 * than a second one for the text roles.
 */
export const ASSET_MEDIA = ["video", "image", "prose"] as const;
export type AssetMedium = (typeof ASSET_MEDIA)[number];

/**
 * The facts a machine needs, gathered once at production time rather than once
 * per destination.
 *
 * `synthetic` is stated rather than defaulted: a destination applies its own
 * required disclosure from it, and assuming a value would be a falsehood for
 * the asset that is not synthetic.
 */
export interface AssetContent {
  readonly role: AssetRole;
  readonly medium: AssetMedium;
  readonly synthetic: boolean;
  /** Seconds. Required of `video`, refused of anything else. */
  readonly durationSeconds?: number;
  /** Pixels. Required of `image` together, refused of anything else. */
  readonly width?: number;
  readonly height?: number;
  readonly transcript?: string;
  readonly altText?: string;
  /**
   * A short authored line naming the asset, shown where several items sit in
   * one slot and the artefacts cannot be told apart. Never derived, and nothing
   * is derived from it.
   */
  readonly label?: string;
}

/** A point of view an asset takes. Its colour is a destination's, not this. */
export interface CategoryContent {
  readonly label: string;
  readonly line: string;
}

export interface CharacterContent {
  readonly name: string;
}

const isPositiveNumber = (value: unknown): boolean =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const isPositiveInteger = (value: unknown): boolean =>
  isPositiveNumber(value) && Number.isInteger(value);

function validateMediumFacts(
  medium: AssetMedium,
  content: Record<string, unknown>,
): string | null {
  const hasDuration = content["durationSeconds"] !== undefined;
  const hasWidth = content["width"] !== undefined;
  const hasHeight = content["height"] !== undefined;

  if (medium === "video") {
    if (!hasDuration) return "A video asset carries a duration in seconds.";
    if (!isPositiveNumber(content["durationSeconds"])) {
      return "A video asset carries a duration in seconds greater than zero.";
    }
    if (hasWidth || hasHeight) {
      return "Dimensions belong to a rendition, not to a video asset.";
    }
    return null;
  }

  if (medium === "image") {
    if (!hasWidth || !hasHeight) {
      return "An image asset carries a width and a height in pixels.";
    }
    if (!isPositiveInteger(content["width"]) || !isPositiveInteger(content["height"])) {
      return "An image asset carries whole pixel dimensions greater than zero.";
    }
    if (hasDuration) return "An image asset carries no duration.";
    return null;
  }

  if (hasDuration) return "A prose asset carries no duration.";
  if (hasWidth || hasHeight) return "A prose asset carries no dimensions.";
  return null;
}


/**
 * Where a rendition's bytes came from. Both paths are permanent: Calliopa
 * ingests externally produced exports today and will produce them itself, and
 * external upload stays the fallback. No destination adapter may care which
 * path a file took, so this is recorded and never branched on outside a report.
 */
export const RENDITION_PROVENANCES = ["ingested", "produced"] as const;
export type RenditionProvenance = (typeof RENDITION_PROVENANCES)[number];

/** Whether a serial is still being added to. */
export const SERIAL_STATES = ["running", "complete"] as const;
export type SerialState = (typeof SERIAL_STATES)[number];

export interface EpisodeContent {
  readonly title: string;
  /**
   * Writing about the episode that any channel may draw on. Both are optional
   * here and required by whichever destination requires them: an episode being
   * made does not yet have its premise written, and refusing to store one until
   * it does would make the workspace unusable for the work it exists for.
   */
  readonly premise?: string;
  readonly teaserText?: string;
  /**
   * The episode's number within its ordered home serial. An episode outside an
   * ordered serial carries none. Uniqueness and the requirement of an ordered
   * home serial are enforced where placements are decided, because content
   * validation sees one node and neither rule is about one node.
   */
  readonly position?: number;
}

export interface SerialContent {
  readonly name: string;
  /** The one line a card carries. Optional here for the reason an episode's is. */
  readonly premise?: string;
  /**
   * Set by the author, never derived from whether episodes happen to carry
   * positions. It selects an entire presentation, so a half-numbered serial
   * must not be representable.
   */
  readonly ordered: boolean;
  readonly state: SerialState;
}

/**
 * One export of one asset. Dimensions are stored and the aspect is derived
 * from them, because an aspect stored beside its dimensions can come to
 * disagree with them and then nothing says which is right.
 */
export interface RenditionContent {
  readonly objectId: string;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
  readonly contentType: string;
  readonly provenance: RenditionProvenance;
}

/** An object id is the lowercase hex SHA-256 of the bytes it names. */
const OBJECT_ID = /^[0-9a-f]{64}$/;

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

/**
 * The reduced `w:h` of a rendition, derived rather than stored. Two exports of
 * the same shape at different sizes answer the same aspect.
 */
export function renditionAspect(rendition: {
  readonly width: number;
  readonly height: number;
}): string {
  const divisor = greatestCommonDivisor(rendition.width, rendition.height);
  return `${rendition.width / divisor}:${rendition.height / divisor}`;
}

/** An optional authored line: absent, or text. */
function validateOptionalText(
  content: Record<string, unknown>,
  field: string,
  subject: string,
): string | null {
  const value = content[field];
  if (value !== undefined && typeof value !== "string") {
    return `${subject}'s ${field} is text.`;
  }
  return null;
}

function validateEpisode(value: JSONValue): string | null {
  const content = asRecord(value);
  if (content === null) return "An episode carries content.";
  if (typeof content["title"] !== "string") return "An episode carries a title.";

  for (const field of ["premise", "teaserText"] as const) {
    const refusal = validateOptionalText(content, field, "An episode");
    if (refusal !== null) return refusal;
  }

  const position = content["position"];
  if (position !== undefined && !isPositiveInteger(position)) {
    return "An episode's position is a whole number greater than zero.";
  }
  return null;
}

function validateSerial(value: JSONValue): string | null {
  const content = asRecord(value);
  if (content === null) return "A serial carries content.";
  if (typeof content["name"] !== "string") return "A serial carries a name.";
  if (typeof content["ordered"] !== "boolean") {
    return "A serial states whether it is ordered.";
  }
  const state = content["state"];
  if (!SERIAL_STATES.includes(state as SerialState)) {
    return `A serial carries the state ${String(state)}, which is not one of ${SERIAL_STATES.join(", ")}.`;
  }
  return validateOptionalText(content, "premise", "A serial");
}

function validateCategory(value: JSONValue): string | null {
  const content = asRecord(value);
  if (content === null) return "A category carries content.";
  if (typeof content["label"] !== "string" || content["label"] === "") {
    return "A category carries a label.";
  }
  if (typeof content["line"] !== "string") return "A category carries a line.";
  return null;
}

function validateCharacter(value: JSONValue): string | null {
  const content = asRecord(value);
  if (content === null) return "A character carries content.";
  if (typeof content["name"] !== "string" || content["name"] === "") {
    return "A character carries a name.";
  }
  return null;
}

function validateRendition(value: JSONValue): string | null {
  const content = asRecord(value);
  if (content === null) return "A rendition carries content.";

  const objectId = content["objectId"];
  if (typeof objectId !== "string" || !OBJECT_ID.test(objectId)) {
    return "A rendition names its bytes by their SHA-256, which is what makes the id say what it holds.";
  }
  if (!isPositiveInteger(content["width"]) || !isPositiveInteger(content["height"])) {
    return "A rendition carries whole pixel dimensions greater than zero.";
  }
  if (!isPositiveInteger(content["byteSize"])) {
    return "A rendition carries its size in bytes.";
  }
  if (typeof content["contentType"] !== "string" || content["contentType"] === "") {
    return "A rendition carries the media type of its bytes.";
  }
  const provenance = content["provenance"];
  if (!RENDITION_PROVENANCES.includes(provenance as RenditionProvenance)) {
    return `A rendition carries the provenance ${String(provenance)}, which is not one of ${RENDITION_PROVENANCES.join(", ")}.`;
  }
  return null;
}

function validateAsset(value: JSONValue): string | null {
  const content = asRecord(value);
  if (content === null) return "An asset carries content.";

  const role = content["role"];
  if (!ASSET_ROLES.includes(role as AssetRole)) {
    return `An asset carries the role ${String(role)}, which is not one of ${ASSET_ROLES.join(", ")}.`;
  }

  const medium = content["medium"];
  if (!ASSET_MEDIA.includes(medium as AssetMedium)) {
    return `An asset carries the medium ${String(medium)}, which is not one of ${ASSET_MEDIA.join(", ")}.`;
  }

  if (typeof content["synthetic"] !== "boolean") {
    return "An asset states whether its media is synthetic.";
  }

  const facts = validateMediumFacts(medium as AssetMedium, content);
  if (facts !== null) return facts;

  const transcript = content["transcript"];
  if (transcript !== undefined && typeof transcript !== "string") {
    return "An asset's transcript is text.";
  }

  const altText = content["altText"];
  if (altText !== undefined && typeof altText !== "string") {
    return "An asset's alt text is text.";
  }

  return validateOptionalText(content, "label", "An asset");
}

/**
 * The vocabulary the gateway validates production writes against.
 *
 * Episode membership is `holds` rather than `contains`. The block model states
 * that containment must not be widened to serve a non-structural purpose, and
 * this is exactly that: keeping them apart leaves the single-active-parent tree
 * the editor depends on untouched, and lets an asset belong to any number of
 * episodes without that meaning anything about a block.
 */
export const productionSchema: GraphSchema = {
  nodes: {
    asset: {
      semanticType: ASSET_TYPE,
      schemaVersion: 1,
      validate: validateAsset,
    },
    episode: {
      semanticType: EPISODE_TYPE,
      schemaVersion: 1,
      validate: validateEpisode,
    },
    serial: {
      semanticType: SERIAL_TYPE,
      schemaVersion: 1,
      validate: validateSerial,
    },
    rendition: {
      semanticType: RENDITION_TYPE,
      schemaVersion: 1,
      validate: validateRendition,
    },
    category: {
      semanticType: CATEGORY_TYPE,
      schemaVersion: 1,
      validate: validateCategory,
    },
    character: {
      semanticType: CHARACTER_TYPE,
      schemaVersion: 1,
      validate: validateCharacter,
    },
  },
  relations: {
    /** What an episode is made of. An asset may be held by any number. */
    holds: {
      relationType: "holds",
      schemaVersion: 1,
      fromNodes: [EPISODE_TYPE],
      toNodes: [ASSET_TYPE],
    },
    /** The bytes behind an asset, one per export. */
    exports: {
      relationType: "exports",
      schemaVersion: 1,
      fromNodes: [ASSET_TYPE],
      toNodes: [RENDITION_TYPE],
    },
    /** A prose asset's body. Its text is a document, not bytes in Garage. */
    body: {
      relationType: "body",
      schemaVersion: 1,
      fromNodes: [ASSET_TYPE],
      toNodes: [DOCUMENT_TYPE],
    },
    /** The serial an episode belongs to, which drives sequence and position. */
    homeSerial: {
      relationType: "homeSerial",
      schemaVersion: 1,
      fromNodes: [EPISODE_TYPE],
      toNodes: [SERIAL_TYPE],
    },
    /** A further membership. Unordered serials only, so a position means one thing. */
    alsoIn: {
      relationType: "alsoIn",
      schemaVersion: 1,
      fromNodes: [EPISODE_TYPE],
      toNodes: [SERIAL_TYPE],
    },
    /** The one asset that stands for the episode where it is not being played. */
    teaser: {
      relationType: "teaser",
      schemaVersion: 1,
      fromNodes: [EPISODE_TYPE],
      toNodes: [ASSET_TYPE],
    },
    /** Whose view an asset is. An asset may name any number. */
    categorised: {
      relationType: "categorised",
      schemaVersion: 1,
      fromNodes: [ASSET_TYPE],
      toNodes: [CATEGORY_TYPE],
    },
    /** The characters appearing in an episode. Which episodes a character is in
     * is a query over this, never a list anyone maintains. */
    features: {
      relationType: "features",
      schemaVersion: 1,
      fromNodes: [EPISODE_TYPE],
      toNodes: [CHARACTER_TYPE],
    },
    portrait: {
      relationType: "portrait",
      schemaVersion: 1,
      fromNodes: [CHARACTER_TYPE],
      toNodes: [ASSET_TYPE],
    },
    /** A character's description, and a serial's opening: prose, so documents. */
    description: {
      relationType: "description",
      schemaVersion: 1,
      fromNodes: [CHARACTER_TYPE],
      toNodes: [DOCUMENT_TYPE],
    },
    opening: {
      relationType: "opening",
      schemaVersion: 1,
      fromNodes: [SERIAL_TYPE],
      toNodes: [DOCUMENT_TYPE],
    },
    cover: {
      relationType: "cover",
      schemaVersion: 1,
      fromNodes: [SERIAL_TYPE],
      toNodes: [ASSET_TYPE],
    },
  },
};
