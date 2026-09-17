import type { ConfigurationField } from "~/contract";
import type { IndexRefusal, StoredIndex } from "./content-index";

/**
 * What the Channels category and the channel tab are handed: plain values
 * the server assembled, so the browser holds no roster of kinds and no rule
 * of its own. PU_0001_005 PU_0001_006
 */

export const CHANNEL_STATES = ["unconfigured", "configured", "verified", "failing"] as const;
export type ChannelState = (typeof CHANNEL_STATES)[number];

/** A kind as the browser sees it: enough to choose one and to draw its row. */
export interface KindSummary {
  readonly id: string;
  readonly label: string;
  readonly fields: readonly ConfigurationField[];
  /** Whether the kind's offer is read from the destination, as a website's is. */
  readonly readsIndex: boolean;
}

export interface ChannelSummary {
  readonly channelId: string;
  readonly kind: string;
  readonly kindLabel: string;
  readonly title: string;
  readonly state: ChannelState;
  /** Retired rather than deleted, because something was published to it. PU_0003_005 */
  readonly retired: boolean;
}

export interface ChannelsListing {
  readonly reachable: boolean;
  readonly kinds: readonly KindSummary[];
  readonly channels: readonly ChannelSummary[];
}

/** The credential half as the settings row reports it, never a value. */
export interface CredentialFacts {
  readonly state: ChannelState;
  readonly keySet: boolean;
  readonly configuration: Readonly<Record<string, string>>;
  readonly lastTestedAt: string | null;
  readonly lastError: string | null;
}

export interface ChannelDetail {
  readonly channel: ChannelSummary;
  readonly revisionId: string;
  readonly kindSummary: KindSummary;
  readonly credential: CredentialFacts;
  /** What the destination declared, for a kind that reads an index; `null` until read. */
  readonly index: StoredIndex | null;
}

export interface IndexReadReport {
  readonly index: StoredIndex;
  readonly retired: readonly string[];
  readonly dropped: readonly string[];
  readonly reclassed: readonly string[];
}

export type { IndexRefusal };
