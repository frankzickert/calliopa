import { contributions as declare } from "~/contract";

import { SourcePanel } from "./views/block/source-panel";
import { VariationChoice } from "./views/command/variation";
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
 * In the command chip stands the variation of the instruction's format, chosen
 * for one send (`calliopa-bootstrap`'s `BO_0336_023`); which model makes what
 * is the format's to say.
 */
export const contributions = declare({
  settingsSections: [
    { name: "generators", title: "Generators", component: GeneratorsSection },
  ],
  decorations: {
    document: {
      places: { below: SourcePanel, command: VariationChoice },
    },
  },
});
