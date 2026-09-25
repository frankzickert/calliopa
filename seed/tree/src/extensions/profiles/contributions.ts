import { contributions as declare } from "~/contract";

import { ProfilesSection } from "./views/section";
import { ProfileSelector } from "./views/selector";

/**
 * The client half of `profiles` (`BO_0298_014`, `BO_0298_016`): the Profiles
 * category under its own icon, listing the instance's profiles and creating
 * one, and the selector every document's bar carries — a dropdown attaching
 * a profile to the document, written as the person's own act. A profile is
 * a document and opens in the document tab; the property it is attached by
 * is `documents`' ([Block Document Model](../documents/docs/system/documents/block-document-model.md#profiles)),
 * and what a run receives is the kernel's (`calliopa-bootstrap`'s
 * `ui-kernel.md`, Profiles).
 */
export const contributions = declare({
  icon: { title: "Profiles", name: "compass" },
  // The rows open documents, so the shell re-reads the section when a
  // document tab is renamed or goes, as it re-reads the Documents section.
  sections: [{ name: "profiles", title: "Profiles", empty: "No profiles yet", opens: "documents:document", component: ProfilesSection }],
  kinds: {},
  decorations: {
    document: {
      provider: ProfileSelector,
      places: {},
    },
  },
});
