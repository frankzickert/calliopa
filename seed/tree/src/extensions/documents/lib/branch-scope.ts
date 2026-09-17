/**
 * Which tab works in which proposal, and how a read says so (`BO_0250_010`).
 *
 * The scope is this extension's because every read of a document honours it:
 * a tab in a branch reads the document through it, and `?branch=` on the URL
 * or `branch` in a command body is how it says which. BO_0256_008 BO_0250_020
 */

const branches = new Map<string, string>();
let activeTab = "";
const keyOf = (tabId: string, documentId: string): string => `${tabId}|${documentId}`;

/** The editor shown declares its tab: the helpers read that tab's branch. */
export function activateTab(tabId: string): void {
  activeTab = tabId;
}

/** The branch the active tab works in on a document, or null for truth. */
export const branchOf = (documentId: string | null | undefined, tabId: string = activeTab): string | null =>
  documentId == null ? null : (branches.get(keyOf(tabId, documentId)) ?? null);

export function enterBranch(documentId: string, group: string, tabId: string = activeTab): void {
  branches.set(keyOf(tabId, documentId), group);
}

export function leaveBranch(documentId: string, tabId: string = activeTab): void {
  branches.delete(keyOf(tabId, documentId));
}

/** A read's URL with the tab's branch as its overlay, when in one. */
export function withBranch(url: string, documentId: string, branch: string | null = branchOf(documentId)): string {
  if (branch === null || branch === "") return url;
  return `${url}${url.includes("?") ? "&" : "?"}branch=${encodeURIComponent(branch)}`;
}

/** A command's body with the tab's branch named, when in one. */
export function withBranchBody(body: Record<string, unknown>, documentId: string): Record<string, unknown> {
  const branch = branchOf(documentId);
  return branch === null ? body : { ...body, branch };
}