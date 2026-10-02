import { contributions as declare } from "~/contract";

import { InstructionChip } from "./views/chip";
import { InstructionToolsSettings } from "./views/settings";
import { InstructionToolsProvider, ToolHeadline } from "./views/tools";

/**
 * The client half of `instructions` (`calliopa-bootstrap`'s `BO_0298` and
 * `BO_0311`): the instruction chosen per command from a compass in the chip of
 * the block being edited, and on an instruction's own document its code blocks
 * named as the tools they are, with the owner's grant of outside reach in the
 * document's bar, and the grants and the tools' secrets in Settings for the
 * owner alone. An instruction is a document carrying the built-in *Instruction*
 * role, so the Roles category lists the instructions and this extension draws no
 * category of its own (`BO_0308_Q11`); what a run receives is the kernel's
 * (`ui-kernel.md`, The Instruction In The Command, With Tools).
 */
export const contributions = declare({
  sections: [],
  kinds: {},
  settingsSections: [{ name: "instruction-tools", title: "Instruction tools", component: InstructionToolsSettings, owner: true }],
  decorations: {
    document: {
      provider: InstructionToolsProvider,
      places: { command: InstructionChip, headline: ToolHeadline },
    },
  },
});
