import { contributions as declare, type ViewContribution } from "~/contract";

import { NewSourceView } from "./views/new-source";
import { StyleSettings } from "./views/settings";
import { SourceEnd, SourceProvider } from "./views/source";

/**
 * The client half of `bibliography` (`BO_0291_019`, reshaped by `BO_0313`):
 * a source is a document carrying *Source*, listed under *Roles → Source*
 * and among the documents, so this extension draws no library category of
 * its own. It contributes *Add source*, the kind the `+` on *Roles → Source*
 * opens; on the document kind `documents` presents, a source's *Fill from
 * identifier* in the bar, and at every document's end its reference list
 * and, on a source, *Cited by*. The citation's drawing stays `documents`',
 * which owns the run.
 */

const newSource: ViewContribution = {
  id: "new-source",
  name: "Add source",
  inspector: "No source open",
  drag: [],
  component: NewSourceView,
};

export const contributions = declare({
  kinds: { "new-source": newSource },
  settingsSections: [{ name: "citations", title: "Citations", component: StyleSettings }],
  // The reference list after a document's last block (BO_0291_027), and a
  // source's Cited by beneath it, through the document's `end` place.
  decorations: {
    document: { provider: SourceProvider, places: {}, documentPlaces: { end: SourceEnd } },
  },
});
