import { contributions as declare } from "~/contract";
import { SettingsView } from "./settings";
import { UpdateTabView } from "./update";

/**
 * What the settings extension contributes to the shell: two tab kinds,
 * `settings:settings` and `settings:update`, and the views presenting them.
 * Instance chrome rather than content: neither tab resolves to anything in
 * the graph, and both carry the synthetic instance-wide target so a tab is
 * still found by one. BO_0202_002 BO_0223_014
 */
export const contributions = declare({
  kinds: {
    settings: {
      id: "settings",
      name: "Settings",
      // Nothing to say about a target that is not content, and nothing to drag.
      inspector: "Instance settings",
      drag: [],
      component: SettingsView,
    },
    update: {
      id: "update",
      name: "Update",
      inspector: "Update Calliopa",
      drag: [],
      component: UpdateTabView,
    },
  },
});
