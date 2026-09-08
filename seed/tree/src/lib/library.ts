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
 * What the `Extensions` category shows: every extension the knowledge graph
 * holds, by id and version, with whether newer truth than the served release
 * pin waits for promotion. Read from the graph's gateway, never from this
 * application's own store. BO_0201_005
 */
export interface ExtensionSummary {
  readonly id: string;
  readonly version: string;
  readonly category: "bundled" | "individual";
  readonly newestRevision: number;
  readonly servedPin: number | null;
  readonly ahead: boolean;
}
