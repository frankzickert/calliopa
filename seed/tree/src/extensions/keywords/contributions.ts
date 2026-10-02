import { contributions as declare } from "~/contract";

import { MentionsLine } from "./views/mentions-line";
import { KeywordsProvider } from "./views/provider";

/**
 * The client half of `keywords` (`BO_0301_015`, `BO_0301_016`, `BO_0310`):
 * on the document kind `documents` presents, the provider writing each
 * block's mentions into the editor's inline annotations and registering `@`
 * as an inline trigger, and the mentions line in a keyword document's header
 * through the `title` place (`DO_0030_006`). The keywords are listed under *Roles*, as the
 * documents carrying *Keyword* (`BO_0310_022`); this extension has no
 * category of its own.
 */
export const contributions = declare({
  decorations: {
    document: {
      provider: KeywordsProvider,
      places: {},
      documentPlaces: { title: MentionsLine },
    },
  },
});
