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
 * and how a status line is read. Settled without a graph, so the drawer's
 * shape is provable on its own. A change is a member of the extension whose
 * subtree holds it, so nothing here groups or rehomes one. BO_0222_006
 * BO_0254_009
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

/** A change document's status as its `Status:` line carries it, or `idea` for
 * a member whose line is missing or names something the protocol does not
 * know: unreadable work is open work, and hiding it behind the default filter
 * would be worse than listing it. BO_0254_009 */
export function statusOf(value: unknown): ChangeStatus {
  return isChangeStatus(value) ? value : "idea";
}
