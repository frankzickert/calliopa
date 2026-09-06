import type { DocumentView } from "../documents/assemble";
import type { AssetView, EpisodeView, SerialView } from "../production/assemble";
import type { Binding } from "./bindings";
import type { Front } from "./front";

/**
 * The contract every destination implements.
 *
 * A destination is split where the network is. The **projection** and the
 * **validation** are functions over records with no I/O, so the ordinary gate
 * proves them without an account and without egress; the **transport** is the
 * only part that reaches outward, and only it needs a real instance to prove.
 *
 * An adapter whose mapping reached the network could not be proven by the
 * ordinary gate at all, which is why the split is in the contract rather than
 * left to each adapter to arrange.
 */

/**
 * What a destination takes: a whole episode, an asset out of one, or its own
 * front. A destination may take more than one of them — homepage takes episodes
 * and has a front — so a destination declares a set rather than a single unit.
 */
export const DESTINATION_UNITS = ["episode", "asset", "front"] as const;
export type DestinationUnit = (typeof DESTINATION_UNITS)[number];

export interface Refusal {
  readonly rule: string;
  readonly detail: string;
}

export type Projected<T> =
  | { readonly ok: true; readonly document: T }
  | { readonly ok: false; readonly refusals: readonly Refusal[] };

/** What a destination is handed to project an episode. */
export interface EpisodeSubmission {
  readonly episode: EpisodeView;
  readonly binding: Binding;
  /** The bindings of everything the episode refers to, by record identity. */
  readonly referenced: ReadonlyMap<string, Binding>;
  /**
   * The body of every prose asset the episode holds, by document identity. A
   * destination that typesets prose is sent the blocks, not a reference to
   * them, so the projection is handed what it needs rather than reaching for it.
   */
  readonly documents: ReadonlyMap<string, DocumentView>;
}

/**
 * What a destination is handed to project its front.
 *
 * A front names records rather than containing them, so what it names is read
 * and passed in: the projection stays a function over records with no I/O, and
 * what it refuses is decided by what was actually found rather than by what the
 * binding claims.
 */
export interface FrontSubmission {
  readonly front: Front;
  /** The standing asset the front names as its hero, if it is still there. */
  readonly hero: AssetView | null;
  readonly flagship: EpisodeView | null;
  readonly entrySerial: SerialView | null;
  /** The bindings of everything the front names, by record identity. */
  readonly referenced: ReadonlyMap<string, Binding>;
  /** Which of them are live at this destination right now. */
  readonly published: ReadonlySet<string>;
}

/**
 * A destination's pure half. `project` answers the document that destination
 * would receive, or every rule it breaks — every one, rather than the first,
 * because an author fixing a publish wants the whole list rather than a
 * conversation.
 *
 * A destination that has no front declares none, which is what keeps the front
 * out of the destinations that do not serve one.
 */
export interface Destination<TDocument, TFront = never> {
  /** The channel party in `connection` this destination's credential is under. */
  readonly channel: string;
  readonly units: readonly DestinationUnit[];
  readonly projectEpisode: (submission: EpisodeSubmission) => Projected<TDocument>;
  readonly projectFront?: (submission: FrontSubmission) => Projected<TFront>;
}

/** Collects refusals so a projection reports all of them at once. */
export class Refusals {
  private readonly found: Refusal[] = [];

  refuse(rule: string, detail: string): void {
    this.found.push({ rule, detail });
  }

  require(condition: boolean, rule: string, detail: string): void {
    if (!condition) this.refuse(rule, detail);
  }

  get refusals(): readonly Refusal[] {
    return this.found;
  }

  get any(): boolean {
    return this.found.length > 0;
  }
}
