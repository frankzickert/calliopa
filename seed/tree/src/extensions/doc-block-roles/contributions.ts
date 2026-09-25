import { contributions as declare, type ViewContribution } from "~/contract";

import { RoleLabel } from "./views/label";
import { RolesProvider } from "./views/provider";
import { RolePage } from "./views/role-page";
import { RolesSection } from "./views/section";

/**
 * The client half of `doc-block-roles` (`BO_0299_012`, `BO_0299_014`,
 * `BO_0299_015`): the Roles category under its own icon, a document role's
 * page as its own kind, and — on the document kind `documents` presents —
 * the provider writing the *Roles* group into the bar and the label a roled
 * block carries while reading.
 */
const documentRole: ViewContribution = {
  id: "document-role",
  name: "Document role",
  inspector: "No role open",
  drag: [],
  component: RolePage,
};

export const contributions = declare({
  icon: { title: "Roles", name: "tag" },
  sections: [
    {
      name: "roles",
      title: "Roles",
      empty: "No roles yet",
      kind: "documentRole",
      component: RolesSection,
    },
  ],
  kinds: { documentRole },
  decorations: {
    document: {
      provider: RolesProvider,
      places: { headline: RoleLabel },
    },
  },
});
