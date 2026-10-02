import { documentOf } from "~/lib/command-target";
import type { Tab } from "~/lib/tabs";
import { replayChipsKey, type RunChip } from "~/components/shell/view-bridge";

/**
 * The run chips of the active tab's target: the open run groups its view
 * reported, newest first, for the line above the command field and the
 * count on the collapsed handle. Pure, so the composer and the handle cannot
 * disagree. BO_0265_008 BO_0265_009
 */
export function chipsFor(
  byItem: Readonly<Record<string, readonly RunChip[]>>,
  tab: Tab | undefined,
): readonly RunChip[] {
  const itemId = documentOf(tab);
  if (itemId === null || tab === undefined) return [];
  // A replay's tab reports under its own key, never its document's. BO_0340_004
  return (tab.replay === undefined ? byItem[itemId] : byItem[replayChipsKey(tab.id)]) ?? [];
}
