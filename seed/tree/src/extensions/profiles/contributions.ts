import { contributions as declare } from "~/contract";

import { ProfileChip } from "./views/chip";
import { ProfileToolsSettings } from "./views/settings";
import { ProfileToolsProvider, ToolHeadline } from "./views/tools";

/**
 * The client half of `profiles` (`calliopa-bootstrap`'s `BO_0298` and
 * `BO_0311`): the profile chosen per command from a compass in the chip of
 * the block being edited, and on a profile's own document its code blocks
 * named as the tools they are, with the owner's grant of outside reach in the
 * document's bar, and the grants and the tools' secrets in Settings for the
 * owner alone. A profile is a document carrying the built-in *Profile*
 * role, so the Roles category lists the profiles and this extension draws no
 * category of its own (`BO_0308_Q11`); what a run receives is the kernel's
 * (`ui-kernel.md`, The Profile In The Command, With Tools).
 */
export const contributions = declare({
  sections: [],
  kinds: {},
  settingsSections: [{ name: "profile-tools", title: "Profile tools", component: ProfileToolsSettings, owner: true }],
  decorations: {
    document: {
      provider: ProfileToolsProvider,
      places: { command: ProfileChip, headline: ToolHeadline },
    },
  },
});
