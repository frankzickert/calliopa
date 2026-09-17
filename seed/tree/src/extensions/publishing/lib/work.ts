import type { Aspect, ContentClass } from "./content-index";
import type { ChannelSummary } from "./library";

/** The constraints an author requires of the items filling a part, at production time. */
export interface Constraints {
  readonly aspect?: Aspect;
  readonly maxDurationSeconds?: number;
  readonly minWidth?: number;
  readonly minHeight?: number;
  /** Media subtypes an export must be one of: `mp4`, `png`, `jpeg`, `pdf`. */
  readonly formats?: readonly string[];
}

/**
 * What the shape, deliverable and item tabs and the library's work sections
 * are handed: plain values the server assembled. PU_0002_005 PU_0002_006
 */

export interface PartView {
  readonly partId: string;
  readonly title: string;
  readonly class: ContentClass | "shape";
  readonly cardinality: "one" | "optional" | "some" | "any";
  readonly role: string;
  readonly constraints: Constraints;
  readonly order: string;
  readonly shape: string | null;
  /** The nested shape's title, for a part of class `shape`. */
  readonly shapeTitle: string | null;
}

export interface ShapeSummary {
  readonly shapeId: string;
  readonly title: string;
}

export interface ShapeView extends ShapeSummary {
  readonly revisionId: string;
  readonly parts: readonly PartView[];
  /** The shapes that nest this one, so deleting it says why it cannot be. */
  readonly nestedIn: readonly ShapeSummary[];
}

export interface ExportView {
  readonly exportId: string;
  readonly hash: string;
  readonly mediaType: string;
  readonly size: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly aspect: string | null;
  readonly provenance: "ingested" | "produced";
}

export interface ItemSummary {
  readonly itemId: string;
  readonly class: ContentClass;
  readonly label: string;
  readonly durationSeconds: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly exportCount: number;
}

export interface ItemView extends ItemSummary {
  readonly revisionId: string;
  readonly synthetic: boolean;
  readonly transcript: string;
  readonly alt: string;
  readonly exports: readonly ExportView[];
  /** The body document of a prose item. */
  readonly documentId: string | null;
  readonly gatheredBy: readonly DeliverableSummary[];
}

export interface DeliverableSummary {
  readonly deliverableId: string;
  readonly title: string;
  readonly shapeId: string;
  readonly shapeTitle: string;
}

export interface FilledPart {
  readonly part: PartView;
  readonly items: readonly ItemSummary[];
  readonly deliverables: readonly DeliverableSummary[];
}

export interface DeliverableView extends DeliverableSummary {
  readonly revisionId: string;
  readonly parts: readonly FilledPart[];
  /** Items of each content class that could fill a part, for *Add existing*. */
  readonly candidates: readonly ItemSummary[];
}

export interface DeliverablesListing {
  readonly reachable: boolean;
  readonly shapes: readonly ShapeSummary[];
  readonly groups: readonly { readonly shape: ShapeSummary; readonly deliverables: readonly DeliverableSummary[] }[];
}

export interface StandingListing {
  readonly reachable: boolean;
  readonly items: readonly ItemSummary[];
  /** The blob store's cap, stated where an upload is refused. */
  readonly uploadCapBytes: number;
}

/** One part's slot at a channel, or none. PU_0003_002 */
export interface PartAssignment {
  readonly part: string;
  readonly slot: string;
  /** The channel hosting the videos of a part assigned to a video slot; null for any other class. PU_0004_002 */
  readonly host: string | null;
}

export interface AssignmentView {
  readonly assignmentId: string;
  readonly shape: ShapeSummary;
  readonly container: string;
  readonly parts: readonly PartAssignment[];
  /** Slots the site requires that no part fills. */
  readonly missing: readonly string[];
  /** The shape's own parts, so one is chosen by its title rather than typed by id. */
  readonly shapeParts: readonly PartView[];
}

export interface TakesView {
  readonly channelId: string;
  readonly assignments: readonly AssignmentView[];
  /** The shapes that exist, so one can be taken. */
  readonly shapes: readonly ShapeSummary[];
  /** The channels that host videos — the `bunny-stream` ones not retired — so a video slot's host is chosen by title. PU_0004_002 */
  readonly videoHosts: readonly ChannelSummary[];
}

/** What a record is worth at a channel, as authored. PU_0003_003 */
export interface BindingView {
  readonly bindingId: string | null;
  readonly recordId: string;
  readonly recordKind: "deliverable" | "item";
  readonly channel: string;
  readonly address: string | null;
  readonly number: number | null;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly disclosure: boolean | null;
  /** Whether the address may still change: false once the record was ever published there. */
  readonly addressSettled: boolean;
}

/** One entry of the append-only log. PU_0003_005 */
export interface ReleaseEntry {
  readonly releaseId: string;
  readonly recordId: string;
  readonly recordKind: "deliverable" | "item";
  readonly recordTitle: string;
  readonly channel: string;
  readonly act: "publish" | "retire";
  readonly outcome: "succeeded" | "failed";
  readonly objectIds: readonly string[];
  readonly externalId: string | null;
  readonly externalAddress: string | null;
  readonly detail: string | null;
  readonly at: string;
}

export type DestinationState = "never" | "published" | "retired";

export interface RecordAtChannel {
  readonly state: DestinationState;
  readonly firstPublishedAt: string | null;
  readonly lastPublishedAt: string | null;
  readonly externalAddress: string | null;
  /** The id the destination answered at the last publication; a video's id at its host. PU_0004_005 */
  readonly externalId: string | null;
  readonly lastAttempt: { readonly act: "publish" | "retire"; readonly outcome: "succeeded" | "failed"; readonly at: string; readonly detail: string | null } | null;
}

/** A deliverable's row for one channel that takes its shape. PU_0003_006 */
export interface AtChannel {
  readonly channel: ChannelSummary;
  readonly container: string;
  /** The container's fields the site declares, so the binding can be written against them. */
  readonly fields: readonly { readonly key: string; readonly title: string; readonly type: string; readonly many: boolean; readonly required: boolean; readonly container: string | null; readonly slot: string | null }[];
  readonly addressed: boolean;
  readonly numbered: boolean;
  readonly binding: BindingView;
  readonly at: RecordAtChannel;
  /** What the projection would refuse today, so the author sees what is missing before pressing. */
  readonly missing: readonly string[];
  /** The items that would fill each slot, by slot key — what an `entry` field chooses among, by label. PU_0004 walk */
  readonly entries: Readonly<Record<string, readonly { readonly itemId: string; readonly label: string }[]>>;
}

/** An item's row for one channel whose unit is an item and whose offer takes the item's class. PU_0004_003 */
export interface ItemAtChannel {
  readonly channel: ChannelSummary;
  readonly binding: BindingView;
  readonly at: RecordAtChannel;
  /** What the projection would refuse today. */
  readonly missing: readonly string[];
}
