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
  /** The library's `Documents` category. */
  library: SectionState;
  /** The library's `Episodes` category. */
  episodes: SectionState;
  /** The library's `Standing Assets` category: the assets no episode holds. */
  standing: SectionState;
  /** The library's `Destinations` category: the destinations that have a front. */
  destinations: SectionState;
}

export function nextSectionState(state: SectionState): SectionState {
  return state === "expanded" ? "collapsed" : "expanded";
}

export function nextDrawerState(state: DrawerState): DrawerState {
  return DRAWER_STATES[(DRAWER_STATES.indexOf(state) + 1) % 3] ?? "expanded";
}

export function dockAfterTap(position: DockPosition): DockPosition {
  return DOCK_POSITIONS[(DOCK_POSITIONS.indexOf(position) + 1) % 3] ?? position;
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
