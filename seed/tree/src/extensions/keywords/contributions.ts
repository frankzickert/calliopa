import { contributions as declare } from "~/contract";

import { MentionedIn } from "./views/mentioned-in";
import { KeywordsProvider } from "./views/provider";
import { KeywordsSection } from "./views/section";

/**
 * The client half of `keywords` (`BO_0301_012`, `BO_0301_015`, `BO_0301_016`):
 * the Keywords category under its own icon with the three role choices and
 * the keywords by title, opening as documents; on the document kind
 * `documents` presents, the provider writing each block's mentions into the
 * editor's inline annotations, and *Mentioned in* at the foot of a keyword
 * document through the `end` place.
 */
export const contributions = declare({
  icon: { title: "Keywords", name: "hash" },
  sections: [
    {
      name: "keywords",
      title: "Keywords",
      empty: "No keywords yet",
      opens: "documents:document",
      component: KeywordsSection,
    },
  ],
  decorations: {
    document: {
      provider: KeywordsProvider,
      places: {},
      documentPlaces: { end: MentionedIn },
    },
  },
});
