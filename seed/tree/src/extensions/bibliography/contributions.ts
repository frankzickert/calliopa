import { contributions as declare, type ViewContribution } from "~/contract";

import { ReferenceList } from "./views/references";
import { StyleSettings } from "./views/settings";
import { SourcesSection } from "./views/sources/section";
import { WorkView } from "./views/work";

/**
 * The client half of `bibliography` (`BO_0291_019`): one library category,
 * Sources, under its own icon, and the `work` kind with its view. The
 * citation's drawing stays `documents`', which owns the run; what this
 * extension answers for it — the styled label, the hover, the reference list
 * — arrives with `BO_0291_020` and the editor's tasks.
 */

const work: ViewContribution = {
  id: "work",
  name: "Source",
  inspector: "No source open",
  drag: [],
  component: WorkView,
};

export const contributions = declare({
  icon: { title: "Sources", name: "books" },
  sections: [{ name: "sources", title: "Sources", empty: "No sources yet", kind: "work", component: SourcesSection }],
  kinds: { work },
  settingsSections: [{ name: "citations", title: "Citations", component: StyleSettings }],
  // The reference list after a document's last block (BO_0291_027), through
  // the document's `end` place; nothing on its blocks.
  decorations: {
    document: { places: {}, documentPlaces: { end: ReferenceList } },
  },
});
