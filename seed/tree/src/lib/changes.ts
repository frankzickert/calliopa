import {
  CHANGE_STATUSES,
  DEFAULT_CHANGE_FILTER,
  isChangeStatus,
  type ChangeDocumentSummary,
  type ChangeStatus,
} from "./library";

/**
 * The pure rules behind the Extensions category's tree of changes: which
 * statuses a filter set lists, how a set is read back from a stored layout,
 * and where a change goes when the graph holds no extension of the id it
 * names. Settled without a graph, so the drawer's shape is provable on its
 * own. BO_0222_005 BO_0222_006
 */

/** A stored filter set, or the default when nothing was stored. Unknown
 * values are dropped rather than refused: a status the vocabulary loses later
 * must not lock a workspace out of its drawer. */
export function changeFilterOf(stored: readonly string[] | null | undefined): readonly ChangeStatus[] {
  if (stored === null || stored === undefined) return DEFAULT_CHANGE_FILTER;
  return CHANGE_STATUSES.filter((status) => stored.includes(status));
}

/** Whether a set differs from the default, which is when the funnel reads
 * as active. Order does not matter; membership does. */
export function isDefaultChangeFilter(filter: readonly ChangeStatus[]): boolean {
  return (
    filter.length === DEFAULT_CHANGE_FILTER.length &&
    DEFAULT_CHANGE_FILTER.every((status) => filter.includes(status))
  );
}

/** The set with one status flipped, kept in the vocabulary's order. */
export function toggleChangeStatus(
  filter: readonly ChangeStatus[],
  status: ChangeStatus,
): readonly ChangeStatus[] {
  const next = filter.includes(status)
    ? filter.filter((candidate) => candidate !== status)
    : [...filter, status];
  return CHANGE_STATUSES.filter((candidate) => next.includes(candidate));
}

/** The changes the filter lists, in the order given. */
export function filterChanges(
  changes: readonly ChangeDocumentSummary[],
  filter: readonly ChangeStatus[],
): readonly ChangeDocumentSummary[] {
  return changes.filter((change) => filter.includes(change.status));
}

/**
 * Sorts changes the way the Documents category sorts: by title,
 * case-insensitively by code unit, stable over the order given. The converted
 * files begin with their ids, so this is also their id order.
 */
export function byChangeTitle(
  left: ChangeDocumentSummary,
  right: ChangeDocumentSummary,
): number {
  const a = left.title.toLowerCase();
  const b = right.title.toLowerCase();
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Groups changes under the extension each names. A change naming an id the
 * graph holds no extension for goes under `other`, by that id, rather than
 * vanishing.
 */
export function groupChanges(
  changes: readonly ChangeDocumentSummary[],
  extensionIds: readonly string[],
): {
  readonly byExtension: ReadonlyMap<string, readonly ChangeDocumentSummary[]>;
  readonly other: readonly ChangeDocumentSummary[];
} {
  const byExtension = new Map<string, ChangeDocumentSummary[]>();
  for (const id of extensionIds) byExtension.set(id, []);
  const other: ChangeDocumentSummary[] = [];
  for (const change of [...changes].sort(byChangeTitle)) {
    const group = byExtension.get(change.change);
    if (group === undefined) other.push(change);
    else group.push(change);
  }
  other.sort((a, b) => (a.change < b.change ? -1 : a.change > b.change ? 1 : byChangeTitle(a, b)));
  return { byExtension, other };
}

/** A change document's status as stored, or `idea` for a document that
 * carries `change` and no status, which the shell never writes but the graph
 * permits. */
export function statusOf(value: unknown): ChangeStatus {
  return isChangeStatus(value) ? value : "idea";
}
