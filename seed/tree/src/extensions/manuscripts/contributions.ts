import { contributions as declare } from "~/contract";

import { RenditionsProvider } from "./views/provider";
import { DocumentRenditions } from "./views/renditions";

/**
 * Manuscripts are formats (`calliopa-bootstrap`'s `BO_0312`): a document
 * carrying *Format* is made into a PDF by the agent's typesetting tool under a
 * profile the person writes, and what was made is kept on the document —
 * *Format* is taken by documents alone (`BO_0332`). This extension owns the
 * projection behind the tool, the kept renditions and where they are drawn:
 * at the document's end. *Format* is `structures`' built-in, and the
 * typesetting is the stack's service, reached through the kernel.
 */
export const contributions = declare({
  decorations: {
    document: {
      provider: RenditionsProvider,
      places: {},
      documentPlaces: { end: DocumentRenditions },
    },
  },
});
