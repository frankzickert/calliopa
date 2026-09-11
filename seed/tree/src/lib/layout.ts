export const DRAWER_STATES = ["expanded", "compact", "hidden"] as const;
export type DrawerState = (typeof DRAWER_STATES)[number];
export const DOCK_POSITIONS = ["collapsed", "composer", "console"] as const;
export type DockPosition = (typeof DOCK_POSITIONS)[number];

/** A drawer section is open or shut. Sections do not have the drawer's third
 * state: a category has nothing to be compact about. */
export const SECTION_STATES = ["expanded", "collapsed"] as const;
export type SectionState = (typeof SECTION_STATES)[number];

export interface Layout {
  left: DrawerState;
  right: DrawerState;
  dock: DockPosition;
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
  library: "ui.shell:documents",
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

export function nextDrawerState(state: DrawerState): DrawerState {
  return DRAWER_STATES[(DRAWER_STATES.indexOf(state) + 1) % 3] ?? "expanded";
}

/**
 * A tap on the dock's handle: an open dock — at the composer or the console —
 * closes, and a closed one opens to the composer. Closing is what a reader
 * reaching for the handle of an open dock means. The forward cycle this
 * replaced took the composer to the console, so on a phone the first tap made
 * the dock taller, which read as the dock refusing to close. The console is a
 * swipe up from the composer, or the header's console control. BO_0230_002
 */
export function dockAfterTap(position: DockPosition): DockPosition {
  return position === "collapsed" ? "composer" : "collapsed";
}

/** How far a pointer must travel before a release reads as a swipe rather
 * than as a tap. One threshold, asked by every reading of a gesture. */
export const DOCK_SWIPE_THRESHOLD = 40;

export function dockAfterSwipe(
  position: DockPosition,
  deltaY: number,
): DockPosition {
  if (Math.abs(deltaY) < DOCK_SWIPE_THRESHOLD) return position;
  const index = DOCK_POSITIONS.indexOf(position) + (deltaY < 0 ? 1 : -1);
  return DOCK_POSITIONS[Math.min(2, Math.max(0, index))] ?? position;
}

/** A release on the dock handle applies exactly one transition: a swipe when a
 * recorded press travelled far enough, a tap otherwise.
 *
 * `pressedY` is `null` when the handle saw no press. No pointer coordinate can
 * mean "no press", so an initial one would stand in for a measurement that
 * never happened and read as a swipe the length of the viewport. A release with
 * nothing recorded is never a swipe. */
export function dockAfterRelease(
  position: DockPosition,
  pressedY: number | null,
  releasedY: number,
): DockPosition {
  if (pressedY === null) return dockAfterTap(position);
  const deltaY = releasedY - pressedY;
  return Math.abs(deltaY) >= DOCK_SWIPE_THRESHOLD
    ? dockAfterSwipe(position, deltaY)
    : dockAfterTap(position);
}
