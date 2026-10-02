import { contributions as declare, type ViewContribution } from "~/contract";

import { BlockStructureControl, TitleStructureControl } from "./views/control";
import { StructureLabel } from "./views/label";
import { StructuresProvider } from "./views/provider";
import { StructurePage } from "./views/structure-page";
import { StructuresSection } from "./views/section";

/**
 * The client half of `structures` (`BO_0299`, reshaped by `BO_0309`):
 * the Structures category under its own icon and a structure's page as its own kind,
 * where structures are defined; and — on the document kind `documents` presents —
 * the provider reading a document's structures once, the pills a structured block
 * carries, the structures chip beside the command chip of the block being edited
 * (RO_0002_004), and the
 * same control under the title for the document's own structures. The kind keeps
 * the name `documentRole` it had before one structure type, since a workspace's
 * open tabs are stored under it.
 */
const documentRole: ViewContribution = {
  id: "document-role",
  name: "Structure",
  inspector: "No structure open",
  drag: [],
  component: StructurePage,
};

export const contributions = declare({
  icon: { title: "Structures", name: "tag" },
  sections: [
    {
      name: "structures",
      title: "Structures",
      empty: "No structures yet",
      kind: "documentRole",
      component: StructuresSection,
    },
  ],
  kinds: { documentRole },
  decorations: {
    document: {
      provider: StructuresProvider,
      places: { headline: StructureLabel, underCommand: BlockStructureControl },
      documentPlaces: { title: TitleStructureControl },
    },
  },
});
