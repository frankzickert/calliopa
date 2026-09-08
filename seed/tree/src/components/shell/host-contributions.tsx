import { component$ } from "@builder.io/qwik";
import type { ClientContributions, ViewContribution } from "~/contract";
import { HOST_KINDS } from "~/lib/tabs";
import type { ViewProps } from "./view-host";

/**
 * What the frame contributes on its own behalf, merged first and with bare
 * names: the placeholder view and the one target kind that is the shell's
 * rather than any extension's — `process-result`, which the process registry
 * owns. The story-development placeholders and the `outline` view that
 * presented them were dropped with `BO_0203_005`. Everything an extension
 * contributes is qualified by its id; this is the kind that is not. BO_0202_004
 */

/**
 * The placeholder context view: the working surface the shell shipped before
 * views were named. It presents any target kind, which is what makes view
 * resolution total: a tab whose kind nothing contributes any more falls back
 * here visibly rather than losing the tab.
 */
export const ContextView = component$<ViewProps>(({ tab }) => (
  <div class="view view--context" data-view-body="context">
    <p data-selection={tab.selection ?? undefined}>
      {tab.drawerContext ?? "Open a document from the library to begin."}
    </p>
  </div>
));

const context: ViewContribution = {
  id: "context",
  name: "Context",
  inspector: "Context summary",
  drag: ["move", "open-in-tab"],
  component: ContextView,
};

export const HOST_CONTRIBUTIONS: ClientContributions = {
  kinds: Object.fromEntries(HOST_KINDS.map((kind) => [kind, context])),
};
