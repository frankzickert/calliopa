import {
  panelWidthKey,
  panelWidthProperty,
  parsePanelWidth,
  type PanelSide,
} from "./layout";

/**
 * Where a panel's width lives and how it reaches the page: a per-viewer
 * convenience in `localStorage`, keyed by side, and a custom property on the
 * root element that the shell's columns read. Every touch of storage and of
 * the root sits in a try/catch, so a browser that refuses either still draws
 * the default; nothing here is sent to the kernel. CA_0066_003 CA_0066_004
 */
export function readPanelWidth(side: PanelSide): number | null {
  try {
    return parsePanelWidth(localStorage.getItem(panelWidthKey(side)));
  } catch {
    return null;
  }
}

/** A width to keep, or `null` to forget it: the reset clears the stored value. */
export function writePanelWidth(side: PanelSide, width: number | null): void {
  try {
    if (width === null) localStorage.removeItem(panelWidthKey(side));
    else localStorage.setItem(panelWidthKey(side), String(width));
  } catch {
    // The width still holds for this page; only the next load forgets it.
  }
}

export function applyPanelWidth(side: PanelSide, width: number | null): void {
  try {
    const style = document.documentElement.style;
    if (width === null) style.removeProperty(panelWidthProperty(side));
    else style.setProperty(panelWidthProperty(side), `${width}px`);
  } catch {
    // Without a root to write to, the stylesheet's default holds.
  }
}

/** The root's font size in px, which the defaults and the bounds are written
 * from; 16 where nothing can be measured, as on the server. */
export function remPx(): number {
  try {
    return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  } catch {
    return 16;
  }
}
