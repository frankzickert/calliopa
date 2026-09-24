import { contributions as declare } from "~/contract";

import { SourcePanel } from "./views/block/source-panel";
import { GeneratorsSection } from "./views/settings/section";

/**
 * What `media` draws: the two services in the settings tab, and the model a
 * command will use in the block's command chip.
 *
 * The extension makes pictures and moving pictures from the words in a block.
 * It does not own the blocks — `image` and `video` are `documents`' types, so a
 * picture stays a picture when this is switched off — and it does not generate:
 * the generators and the vendor credentials are the stack's media service.
 *
 * Nothing stands in the command chip any more: a model is chosen in the agent
 * menu and sent to with *Send*, so the dropdown and the cost button the chip
 * once carried are gone (`BO_0273_035`).
 */
export const contributions = declare({
  settingsSections: [
    { name: "generators", title: "Generators", component: GeneratorsSection },
  ],
  decorations: {
    document: {
      places: { below: SourcePanel },
    },
  },
});
