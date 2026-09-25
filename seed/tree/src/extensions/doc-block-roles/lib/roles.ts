/**
 * Document and block roles (`calliopa-bootstrap`'s `BO_0299`): a person gives
 * a document a role — a *Story* — and, under it, gives individual blocks the
 * roles that document role offers — *Hook*, *Problem*, *Transformation*,
 * *Closing*. The roles are this extension's own nodes and an assignment is a
 * relation, so a rename follows everywhere at once and `documents`'
 * declarations do not change. Client-safe: nothing here reaches the graph.
 *
 * The word *role* is taken on a text block — `text.role` is the typographic
 * role, paragraph or heading — so nothing here is called `role` alone: the
 * types are `documentRole` and `blockRole`, and the surfaces say *document
 * role* and *block role*.
 */

/** The node types this extension declares. */
export const DOCUMENT_ROLE_TYPE = "documentRole";
export const BLOCK_ROLE_TYPE = "blockRole";

/** The relation types this extension declares. */
export const OFFERS = "offers";
export const HAS_DOCUMENT_ROLE = "hasDocumentRole";
export const HAS_BLOCK_ROLE = "hasBlockRole";

/** The name a role is minted with, renamed on its page. */
export const UNNAMED_ROLE = "Untitled role";

/** The choice's value for *No role*. */
export const NO_ROLE = "";

/** A role as the catalogue lists it and a choice offers it. */
export interface RoleSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Retired, never deleted: the choices stop offering it, assignments
   * stay and say so (`BO_0299_Q4`). */
  readonly retired: boolean;
}

/** A block role a document role offers, in the order the person gave it. */
export interface BlockRoleView extends RoleSummary {
  readonly order: number;
}

/** A document role with the block roles it offers, in order. */
export interface DocumentRoleView extends RoleSummary {
  readonly blockRoles: readonly BlockRoleView[];
}

/** A block's role as a document's reading answers it. */
export interface AssignedBlockRole extends RoleSummary {
  /** The document role that offers this block role. */
  readonly documentRole: string;
  /** Whether the document's current role offers it: a role assigned under
   * an earlier document role stays and says it is not offered
   * (`BO_0299_Q3`). */
  readonly offered: boolean;
}

/** One block in reading order and its role, or none. */
export interface RoledBlock {
  readonly blockId: string;
  readonly kind: string;
  readonly blockRole: AssignedBlockRole | null;
}

/**
 * What another extension, the browser and a run read: the document's role
 * and each block's, in reading order, at the data revision it was read
 * at. The shape `rolesOf` answers, the routes serve and
 * `read_document_roles` tells a run (`BO_0299_016`).
 */
export interface DocumentRolesView {
  readonly documentId: string;
  readonly dataRevision: number;
  readonly documentRole: RoleSummary | null;
  readonly blocks: readonly RoledBlock[];
}

/** What the Roles section and the choices are handed: the catalogue, or
 * that the graph did not answer. */
export interface RolesListing {
  readonly reachable: boolean;
  readonly roles: readonly DocumentRoleView[];
}

const byOrder = (left: BlockRoleView, right: BlockRoleView): number =>
  left.order - right.order || left.name.localeCompare(right.name);
const byName = (left: RoleSummary, right: RoleSummary): number =>
  left.name.localeCompare(right.name);

/** The block roles a document role offers, unretired, in order. */
export function offeredBy(role: DocumentRoleView): readonly BlockRoleView[] {
  return [...role.blockRoles]
    .filter((blockRole) => !blockRole.retired)
    .sort(byOrder);
}

/** The document roles a choice offers: unretired, by name. */
export function offeredRoles(
  roles: readonly DocumentRoleView[],
): readonly DocumentRoleView[] {
  return roles.filter((role) => !role.retired).sort(byName);
}

/** What a label says of a block's role beside its name, or nothing. */
export function roleState(
  role: AssignedBlockRole,
): "retired" | "not offered" | null {
  if (role.retired) return "retired";
  if (!role.offered) return "not offered";
  return null;
}
