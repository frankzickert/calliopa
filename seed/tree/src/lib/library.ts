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
 * A change document's status: the change protocol's vocabulary, in its order.
 * The graph declares the same set as the permitted values of the document
 * type's `changeStatus` property, so a seventh value is refused at the write,
 * not here. BO_0222_004
 */
export const CHANGE_STATUSES = [
  "idea",
  "draft",
  "ready",
  "wip",
  "completed",
  "rejected",
] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

export const isChangeStatus = (value: unknown): value is ChangeStatus =>
  (CHANGE_STATUSES as readonly unknown[]).includes(value);

/**
 * The statuses a workspace lists before anyone touches the filter: what is
 * open. Finished work — `completed` and `rejected` — waits behind the
 * filter. BO_0222_006
 */
export const DEFAULT_CHANGE_FILTER: readonly ChangeStatus[] = [
  "idea",
  "draft",
  "ready",
  "wip",
];

/**
 * A change of an extension as the `Extensions` category lists it under the
 * extension: a document carrying `change` (the extension's id) and
 * `changeStatus`, read from the graph the way the documents listing reads,
 * never from the pinned extension snapshot. BO_0222_005
 */
export interface ChangeDocumentSummary {
  readonly documentId: string;
  readonly title: string;
  readonly change: string;
  readonly status: ChangeStatus;
  /** When the document node itself was last revised — its title or status. */
  readonly revisedAt: number;
}

/**
 * What the `Extensions` category shows: every extension the knowledge graph
 * holds, by id and version, with whether newer truth than the served release
 * pin waits for promotion, and its change documents. Read from the graph's
 * gateway, never from this application's own store. BO_0201_005 BO_0222_005
 */
export interface ExtensionSummary {
  readonly id: string;
  readonly version: string;
  readonly category: "bundled" | "individual";
  readonly newestRevision: number;
  readonly servedPin: number | null;
  readonly ahead: boolean;
  /** Whether the kernel's extension state serves it at all (`BO_0218_010`). */
  readonly active: boolean;
  /** Whether it is served at a revision of its own rather than the release pin (`BO_0219_006`). */
  readonly pinned: boolean;
  readonly pinnedAt: number | null;
  /** The extension's change documents, by title. */
  readonly changes: readonly ChangeDocumentSummary[];
}
