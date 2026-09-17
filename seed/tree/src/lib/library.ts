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
 * A change document is an `ext.source` member of its extension and its status
 * is the `Status:` line of that file, so this set is what the parse
 * recognises and a line carrying anything else reads as `idea`. BO_0254_009
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
 * extension: one of its `docs/changes/` members, read from the same snapshot
 * its topics are read from, with the status its `Status:` line carries. A
 * member is always under the extension whose subtree holds it, so there is no
 * change that names an extension the graph does not hold. BO_0254_009
 */
export interface ChangeDocumentSummary {
  /** The member path, e.g. `docs/changes/CA_0044_FEAT_library-side-bar.md`. */
  readonly path: string;
  /** The change identifier from the file name, e.g. `CA_0044`, or "". */
  readonly id: string;
  readonly title: string;
  readonly change: string;
  readonly status: ChangeStatus;
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
  /** The extension's change documents: its `docs/changes/` members. */
  readonly changes: readonly ChangeDocumentSummary[];
}
