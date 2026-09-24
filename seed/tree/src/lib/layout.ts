/**
 * A panel — the library at the left, the inspector at the right — is an icon
 * column and a content area beside it, as VS Code's activity bar and side
 * bar are. It is shown or hidden as a whole, and while shown it shows one
 * icon's content or none, which is the small mode: the icon column alone.
 * `icon` is the shown icon's id — an extension id in the library,
 * `INSPECTOR_ICON` in the inspector — `null` for the small mode, and absent
 * for the panel's first icon; an id no icon answers to any more reads as the
 * first too, so an extension removed leaves the panel on the next one.
 * Hiding keeps `icon`, so showing brings back what the panel last had.
 * CA_0056_001 CA_0056_004
 */
export interface PanelState {
  readonly shown: boolean;
  readonly icon?: string | null;
}

/** What a panel draws: hidden, the icon column alone, or one icon's content. */
export type PanelDraw = "hidden" | "small" | "shown";

/** The inspector's one icon, the shell's own rather than a contribution. */
export const INSPECTOR_ICON = "ui.shell:inspector";

/**
 * A panel as stored before `CA_0056`, a drawer state, read as a panel:
 * `expanded` is shown with the first icon, `compact` the small mode, `hidden`
 * hidden with the first icon to come back to. A stored panel is read as it
 * is. Anything else is `undefined`, which the reader refuses.
 */
export function readPanel(stored: unknown): PanelState | undefined {
  if (stored === "expanded") return { shown: true };
  if (stored === "compact") return { shown: true, icon: null };
  if (stored === "hidden") return { shown: false };
  if (typeof stored !== "object" || stored === null) return undefined;
  const { shown, icon } = stored as Record<string, unknown>;
  if (typeof shown !== "boolean") return undefined;
  if (icon === undefined) return { shown };
  if (icon === null || typeof icon === "string") return { shown, icon };
  return undefined;
}

/**
 * The icon whose content the panel carries, among `icons` in the column's
 * order: the stored one while an icon answers to it, the first otherwise,
 * and none in the small mode. A hidden panel still names it, so the content
 * is ready when the panel is shown; the phone's sheet shows it even in the
 * small mode, where a sheet of icons alone would show nothing (`contentIcon`).
 */
export function shownIcon(panel: PanelState, icons: readonly string[]): string | null {
  if (panel.icon === null) return null;
  if (panel.icon !== undefined && icons.includes(panel.icon)) return panel.icon;
  return icons[0] ?? null;
}

/** The content a sheet or a column carries: the shown icon's, or in the small
 * mode the first icon's, which only a phone's sheet draws. */
export function contentIcon(panel: PanelState, icons: readonly string[]): string | null {
  return shownIcon(panel, icons) ?? icons[0] ?? null;
}

export function panelDraw(panel: PanelState): PanelDraw {
  if (!panel.shown) return "hidden";
  return panel.icon === null ? "small" : "shown";
}

/**
 * A press on an icon. On a desktop it shows that icon's content and nothing
 * else, and a press on the icon already shown leaves the icon column alone.
 * On a phone's sheet a press on the shown icon keeps the panel as it is and
 * closes the sheet instead (`pressClosesSheet`): a sheet of icons alone would
 * show nothing worth opening it for. CA_0056_002 CA_0056_006 CA_0056_013
 */
export function pressIcon(
  panel: PanelState,
  icons: readonly string[],
  id: string,
  phone: boolean,
): PanelState {
  if (!phone && shownIcon(panel, icons) === id) return { shown: true, icon: null };
  return { shown: true, icon: id };
}

/** Whether a press on a phone's sheet closes it: a press on the icon whose
 * content it shows. CA_0056_013 */
export function pressClosesSheet(
  panel: PanelState,
  icons: readonly string[],
  id: string,
  phone: boolean,
): boolean {
  return phone && shownIcon(panel, icons) === id;
}

/**
 * The library's icons in the reader's order: the ones `order` names first,
 * in that order, then every icon it does not name in contribution order, so a
 * newly activated extension joins at the end and one no longer contributing
 * drops out. An id named twice counts once. CA_0068_001
 */
export function orderedIcons<T extends { readonly id: string }>(
  icons: readonly T[],
  order: readonly string[],
): T[] {
  const named = new Set<string>();
  const first: T[] = [];
  for (const id of order) {
    const icon = icons.find((candidate) => candidate.id === id);
    if (icon === undefined || named.has(id)) continue;
    named.add(id);
    first.push(icon);
  }
  return [...first, ...icons.filter((icon) => !named.has(icon.id))];
}

/**
 * Where a drop over an icon puts the dragged one, as the icon it lands before
 * or `null` for the end: over an icon's upper half before that icon, over its
 * lower half before the next one. CA_0068_002
 */
export function iconDropBefore(
  ids: readonly string[],
  overId: string,
  lowerHalf: boolean,
): string | null {
  if (!lowerHalf) return overId;
  const at = ids.indexOf(overId);
  return at < 0 ? null : (ids[at + 1] ?? null);
}

/**
 * The column's order once `id` is dropped before `before`, or at the end for
 * `null`; a drop onto its own place, or of an id the column does not hold,
 * leaves the order as it was. CA_0068_002
 */
export function movedIconOrder(
  ids: readonly string[],
  id: string,
  before: string | null,
): string[] {
  if (!ids.includes(id) || id === before) return [...ids];
  const rest = ids.filter((candidate) => candidate !== id);
  const at = before === null ? rest.length : rest.indexOf(before);
  if (at < 0) return [...ids];
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

/** Which sheet a phone has open, or none. Browser-local: unlike a panel's
 * shown state and its icon, nothing about it is stored, because it says where
 * the reader is looking rather than how they work. */
export type Sheet = "left" | "right" | null;

/**
 * A press on a sheet handle. The handle of the sheet already open closes it,
 * so the gesture that opened the sheet also puts it away; any other handle
 * opens its own, replacing whatever was open. CA_0059_002
 */
export function pressHandle(sheet: Sheet, side: "left" | "right"): Sheet {
  return sheet === side ? null : side;
}

/** The header's panel control: the whole panel hidden or shown, keeping the
 * icon it showed, or the small mode, for when it comes back. CA_0056_003 */
export function togglePanel(panel: PanelState): PanelState {
  return { ...panel, shown: !panel.shown };
}

/** A library section is open or shut, inside an icon holding several. */
export const SECTION_STATES = ["expanded", "collapsed"] as const;
export type SectionState = (typeof SECTION_STATES)[number];

export interface Layout {
  left: PanelState;
  right: PanelState;
  /**
   * The library sections' states, keyed `<ext>:<section>` as the registry
   * names them. A key nothing contributes any more is preserved untouched, so
   * an extension removed and restored remembers its state; a key absent
   * reads expanded. BO_0202_003
   */
  sections: Record<string, SectionState>;
  /**
   * A section's stored filter, keyed like `sections`: the values it lists,
   * in its own vocabulary — the Extensions section's change statuses. A key
   * absent means the section's default; a stored empty set lists nothing.
   * Preserved for a section nothing contributes, as `sections` is. BO_0222_006
   */
  filters: Record<string, readonly string[]>;
  /**
   * The library's icons in the reader's order, as extension ids; the column
   * draws what it names first (`orderedIcons`). Empty until the reader drags
   * an icon, and absent before `CA_0068`, which reads empty. CA_0068_003
   */
  libraryOrder: readonly string[];
}

export function sectionState(layout: Layout, key: string): SectionState {
  return layout.sections[key] ?? "expanded";
}

/**
 * The named fields a layout carried before sections were keyed, and the key
 * each became. A stored layout is rewritten on the way in (`workspaces.ts`),
 * so a workspace saved before `BO_0202` opens with its sections as they were.
 */
export const LEGACY_SECTION_KEYS: Readonly<Record<string, string>> = {
  library: "documents:documents",
  episodes: "calliopa-video:episodes",
  standing: "calliopa-video:standing",
  destinations: "calliopa-video:destinations",
  extensions: "ui.shell:extensions",
};

/**
 * Section keys that changed hands: the three sections `ui.shell` held for one
 * pin before they became `calliopa-video`'s. A stored key on the left is read
 * as the key on the right, once, and stored so on the next save (`BO_0203_006`).
 */
export const RENAMED_SECTION_KEYS: Readonly<Record<string, string>> = {
  "ui.shell:episodes": "calliopa-video:episodes",
  "ui.shell:standing": "calliopa-video:standing",
  "ui.shell:destinations": "calliopa-video:destinations",
};

export function nextSectionState(state: SectionState): SectionState {
  return state === "expanded" ? "collapsed" : "expanded";
}

/**
 * A panel's content width on a desktop, beside its icon column, once the
 * reader has dragged the panel's inner border. The default is the width the
 * panel had before the border could be dragged, 16rem for the library and
 * 18rem for the inspector; the minimum fits a row's text and a category's
 * controls; the maximum leaves the workspace `WORKSPACE_MIN_REM` beside the
 * other panel. Everything is in CSS px, from the root's rem, so a drag and a
 * key pass through one clamp and the render and the keyboard agree. The
 * width is the browser's, kept per side and never sent (`PanelWidths`,
 * `null` meaning the default). CA_0066_001
 */
export const PANEL_DEFAULT_REM = { left: 16, right: 18 } as const;
export const PANEL_MIN_REM = 10;
export const WORKSPACE_MIN_REM = 20;
export const PANEL_ICONS_REM = 3;
/** How far one arrow key moves the border. */
export const PANEL_STEP_PX = 16;

export type PanelSide = "left" | "right";

export interface PanelWidths {
  left: number | null;
  right: number | null;
}

export interface PanelBounds {
  readonly min: number;
  readonly max: number;
}

export function defaultPanelWidth(side: PanelSide, rem: number): number {
  return Math.round(PANEL_DEFAULT_REM[side] * rem);
}

/**
 * The bounds at a viewport width, given the other panel's whole column (its
 * icons and content, or 0 while hidden): the panel's own icon column and the
 * workspace's minimum are what its content may not take.
 */
export function panelBounds(viewport: number, otherColumn: number, rem: number): PanelBounds {
  const min = Math.round(PANEL_MIN_REM * rem);
  const room = viewport - otherColumn - PANEL_ICONS_REM * rem - WORKSPACE_MIN_REM * rem;
  return { min, max: Math.max(min, Math.round(room)) };
}

export function clampPanelWidth(width: number, bounds: PanelBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(width)));
}

/** A drag from where it began: travel toward the workspace widens the panel,
 * on either side, and the result stops at the bounds. */
export function draggedPanelWidth(
  side: PanelSide,
  startWidth: number,
  travel: number,
  bounds: PanelBounds,
): number {
  return clampPanelWidth(startWidth + (side === "left" ? travel : -travel), bounds);
}

/** What a key on the focused separator asks: the arrow toward the workspace
 * widens, the arrow away narrows, and Enter restores the default, the way a
 * double press on the border does. Anything else asks nothing. */
export type ResizeAsk = "wider" | "narrower" | "reset";

export function resizeKey(side: PanelSide, key: string): ResizeAsk | null {
  if (key === "Enter") return "reset";
  const toward = side === "left" ? "ArrowRight" : "ArrowLeft";
  const away = side === "left" ? "ArrowLeft" : "ArrowRight";
  if (key === toward) return "wider";
  if (key === away) return "narrower";
  return null;
}

export function stepPanelWidth(width: number, ask: "wider" | "narrower", bounds: PanelBounds): number {
  return clampPanelWidth(width + (ask === "wider" ? PANEL_STEP_PX : -PANEL_STEP_PX), bounds);
}

/** A stored width is a positive finite number of px; anything else reads as
 * the default. CA_0066_004 */
export function parsePanelWidth(stored: string | null | undefined): number | null {
  if (stored === null || stored === undefined || stored.trim() === "") return null;
  const width = Number(stored);
  return Number.isFinite(width) && width > 0 ? Math.round(width) : null;
}

export const PANEL_WIDTH_STORAGE_KEY = "calliopa.panelWidth";

export function panelWidthKey(side: PanelSide): string {
  return `${PANEL_WIDTH_STORAGE_KEY}.${side}`;
}

/** The custom property a side's content width is written to, on the root
 * element, which `.shell`'s columns read; absent, the stylesheet's default
 * holds. CA_0066_003 */
export function panelWidthProperty(side: PanelSide): string {
  return `--${side}-content`;
}

/** Runs in the head before body paint, beside the theme's and the header
 * mode's, and mirrors `parsePanelWidth`: a reload never draws the default
 * width first. The clamp waits for the shell, which knows the other panel. */
export const PANEL_WIDTH_SCRIPT = `(function(){var s=["left","right"];for(var i=0;i<s.length;i++){var v=null;try{v=localStorage.getItem(${JSON.stringify(PANEL_WIDTH_STORAGE_KEY)}+"."+s[i])}catch(e){}if(v===null||v.trim()==="")continue;var n=Number(v);if(isFinite(n)&&n>0)document.documentElement.style.setProperty("--"+s[i]+"-content",Math.round(n)+"px")}})();`;
