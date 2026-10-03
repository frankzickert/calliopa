import { component$, useContext, useStore, useVisibleTask$ } from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { ViewProps } from "~/components/shell/view-host";

import type { StructureView } from "../lib/structures";

/**
 * A tab still open on the page a structure had before it was a document
 * (`RO_0005_004`): the kind stays registered, since a workspace's open tabs
 * are stored under it, and the tab opens the structure's document — found by
 * the id the tab holds, its former one included — saying so in its place.
 */
export const FormerStructurePage = component$<ViewProps>(({ tab }) => {
  const bridge = useContext(ViewBridgeContext);
  const local = useStore<{ said: string }>({ said: "Opening the structure's document…" });
  // eslint-disable-next-line qwik/no-use-visible-task -- read in the browser with the person's session
  useVisibleTask$(async () => {
    const response = await fetch(`/api/x/structures/structures/${encodeURIComponent(tab.itemId ?? "")}`).catch(() => null);
    const answer = (await response?.json().catch(() => null)) as { outcome?: string; result?: StructureView } | null;
    if (answer?.outcome !== "success" || answer.result === undefined) {
      local.said = "This structure is not here any more.";
      return;
    }
    local.said = `${answer.result.name} is a document now: it opened in its own tab.`;
    await bridge.openTarget$({ kind: "documents:document", itemId: answer.result.id, title: answer.result.name });
  });
  return (
    <p class="structure-acts__standing" role="status" data-former-structure-page={tab.itemId ?? ""}>
      {local.said}
    </p>
  );
});
