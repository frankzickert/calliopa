import { contributions as declare, type ViewContribution } from "~/contract";

import { BlockRoleControl, TitleRoleControl } from "./views/control";
import { RoleLabel } from "./views/label";
import { RolesProvider } from "./views/provider";
import { RolePage } from "./views/role-page";
import { RolesSection } from "./views/section";

/**
 * The client half of `doc-block-roles` (`BO_0299`, reshaped by `BO_0309`):
 * the Roles category under its own icon and a role's page as its own kind,
 * where roles are defined; and — on the document kind `documents` presents —
 * the provider reading a document's roles once, the pills a roled block
 * carries, the roles chip beside the command chip of the block being edited
 * (RO_0002_004), and the
 * same control under the title for the document's own roles. The kind keeps
 * the name `documentRole` it had before one role type, since a workspace's
 * open tabs are stored under it.
 */
const documentRole: ViewContribution = {
  id: "document-role",
  name: "Role",
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
      places: { headline: RoleLabel, underCommand: BlockRoleControl },
      documentPlaces: { title: TitleRoleControl },
    },
  },
});
