import { contributions as declare, type ViewContribution } from "~/contract";

import { BlockStructureControl, TitleStructureControl } from "./views/control";
import { StructureLabel } from "./views/label";
import { NestedFieldChoice } from "./views/nested";
import { STRUCTURE_DRAG_KIND, useDroppedStructure } from "./views/drops";
import { StructuresProvider } from "./views/provider";
import { FormerStructurePage } from "./views/former-page";
import { StructuresSection } from "./views/section";

/**
 * The client half of `structures` (`BO_0299`, reshaped by `BO_0309`, documents
 * by `RO_0005`): the Structures category under its own icon, its rows opening
 * each structure's document, where structures are defined; and — on the
 * document kind `documents` presents —
 * the provider reading a document's structures once, the pills a structured block
 * carries, the structures chip beside the command chip of the block being edited
 * (RO_0002_004), and the
 * same control under the title for the document's own structures, with a
 * structure's own acts on its document. The kind `documentRole`, the page a
 * structure had before it was a document, stays registered for the tabs a
 * workspace keeps under it, and opens the structure's document.
 */
const documentRole: ViewContribution = {
  id: "document-role",
  name: "Structure",
  inspector: "No structure open",
  drag: [],
  component: FormerStructurePage,
};

export const contributions = declare({
  icon: { title: "Structures", name: "tag" },
  sections: [
    {
      name: "structures",
      title: "Structures",
      empty: "No structures yet",
      opens: "documents:document",
      component: StructuresSection,
    },
  ],
  kinds: { documentRole },
  decorations: {
    document: {
      provider: StructuresProvider,
      places: { headline: StructureLabel, underCommand: BlockStructureControl, nested: NestedFieldChoice },
      documentPlaces: { title: TitleStructureControl },
      // A structure dragged out of the Structures sheet, used where it lands.
      // BO_0349_011
      drops: { [STRUCTURE_DRAG_KIND]: useDroppedStructure },
      // Between the rows a structure is applied by a run. BO_0349_012
      actsOnBody: [STRUCTURE_DRAG_KIND],
    },
  },
});
