/**
 * The phone header's two modes. *Full* is the line with the tab strip under
 * it; *Minimum* is one line holding the wordmark, the active tab and one menu
 * with every control. The mode only means something inside the phone media
 * query: a desktop never shows the control and keeps its header. CA_0054_001
 */
const HEADER_MODES = ["full", "minimum"] as const;
export type HeaderMode = (typeof HEADER_MODES)[number];
export const HEADER_MODE_STORAGE_KEY = "calliopa.headerMode";

/** A phone starts in *Minimum*: anything but a stored `full` reads so. */
export function parseHeaderMode(value: string | null | undefined): HeaderMode {
  return value === "full" ? "full" : "minimum";
}

export function otherHeaderMode(mode: HeaderMode): HeaderMode {
  return mode === "full" ? "minimum" : "full";
}

/** Runs in the head before body paint, beside the theme's, and mirrors
 * `parseHeaderMode`: a reload never draws the other header first. */
export const HEADER_MODE_SCRIPT = `(function(){var m=null;try{m=localStorage.getItem(${JSON.stringify(HEADER_MODE_STORAGE_KEY)})}catch(e){}document.documentElement.setAttribute("data-header-mode",m==="full"?"full":"minimum");})();`;

/** What the *Minimum* menu holds that can change while nobody looks at it. */
export interface MenuStatus {
  readonly save: "saving" | "saved" | "unsaved" | null;
  readonly processes: number;
  readonly update: string | null;
  readonly licence: string | null;
}

/** Nothing to say: the state before the page has read anything. */
export const QUIET_STATUS: MenuStatus = {
  save: null,
  processes: 0,
  update: null,
  licence: null,
};

export type MenuStatusChange =
  | { readonly kind: "save"; readonly state: "saving" | "saved" | "unsaved" }
  | { readonly kind: "processes"; readonly count: number }
  | { readonly kind: "update"; readonly version: string }
  | { readonly kind: "licence"; readonly text: string };

/**
 * The change the menu button shows in its place, or null when nothing the
 * menu holds changed. A save state appearing or going with a tab is not a
 * change — switching tabs is not news — but one save state following another
 * is. When several change at once, the one asking most for a decision wins:
 * the licence, then an update, then the processes, then the save. CA_0054_004
 */
export function menuStatusChange(
  before: MenuStatus,
  after: MenuStatus,
): MenuStatusChange | null {
  if (after.licence !== null && after.licence !== before.licence)
    return { kind: "licence", text: after.licence };
  if (after.update !== null && after.update !== before.update)
    return { kind: "update", version: after.update };
  if (after.processes !== before.processes)
    return { kind: "processes", count: after.processes };
  if (after.save !== null && before.save !== null && after.save !== before.save)
    return { kind: "save", state: after.save };
  return null;
}

/** How long a change holds the menu button's place. CA_0054_004 */
export const MENU_FLASH_MS = 3000;
