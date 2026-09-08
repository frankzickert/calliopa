import { contributions as declare } from "~/contract";
import { SettingsView } from "./settings";

/**
 * What the settings extension contributes to the shell: one tab kind,
 * `settings:settings`, and the view presenting it. Instance chrome rather
 * than content: a settings tab resolves to nothing in the graph, and its
 * target is synthetic so a tab is still found by one. BO_0202_002
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
  },
});
