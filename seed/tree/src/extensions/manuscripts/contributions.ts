import { contributions as declare, type ViewContribution } from "~/contract";

import { ManuscriptProvider } from "./views/bar";
import { ManuscriptPage } from "./views/manuscript";
import { ManuscriptsSection } from "./views/section";

/**
 * A manuscript out of the record (`BO_0293_017`, `BO_0293_022`): this
 * extension owns the make — *Make manuscript* in the document's bar — the kept
 * manuscripts, listed in their own library category and each opening in its
 * own tab, and the projection behind them. The document's front matter and
 * the abstract's role are `documents`', so a document stays one with this
 * extension switched off; the typesetting is the stack's service, reached
 * through the kernel.
 */
const manuscript: ViewContribution = {
  id: "manuscript",
  name: "Manuscript",
  inspector: "No manuscript open",
  drag: [],
  component: ManuscriptPage,
};

export const contributions = declare({
  icon: { title: "Manuscripts", name: "files" },
  sections: [{ name: "manuscripts", title: "Manuscripts", empty: "No manuscripts yet", kind: "manuscript", component: ManuscriptsSection }],
  kinds: { manuscript },
  decorations: {
    document: {
      provider: ManuscriptProvider,
      places: {},
    },
  },
});
