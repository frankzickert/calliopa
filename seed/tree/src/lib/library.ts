/**
 * What the left drawer's `Documents` category shows, and what the listing
 * behind it answers.
 *
 * A document as the library lists it is its identity and its title. The
 * listing carries nothing else, so opening the drawer never reads block
 * content the category does not render. The shape lives here rather than on
 * either side of the boundary, so the server's listing and the drawer that
 * renders it cannot drift apart.
 */
export interface DocumentSummary {
  readonly documentId: string;
  readonly title: string;
}

/**
 * What the `Episodes` category shows. Identity and title, for the same reason
 * a document summary carries no blocks: the drawer never pays for the assets
 * it does not render.
 */
export interface EpisodeSummary {
  readonly episodeId: string;
  readonly title: string;
}

/**
 * What the `Standing Assets` category shows: the assets no episode holds. A
 * label is what the author wrote to tell several items in one slot apart, so a
 * listing falls back to the role where none was written.
 */
export interface AssetSummary {
  readonly assetId: string;
  readonly label: string | null;
  readonly role: string;
  readonly medium: string;
}

/**
 * What the `Destinations` category shows: the destinations that have a front,
 * whether or not one has been written for them yet. A destination with nothing
 * written is listed rather than hidden, because otherwise the first front could
 * never be opened to be written.
 */
export interface FrontSummary {
  readonly channel: string;
  readonly headline: string | null;
  readonly state: "never" | "published";
}

/** What a front may name as its entry point. */
export interface SerialSummary {
  readonly serialId: string;
  readonly name: string;
  readonly ordered: boolean;
}
