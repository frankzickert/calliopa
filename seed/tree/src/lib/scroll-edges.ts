/**
 * What lies beyond a scrolling row's two ends, from what it holds against the
 * room it has. A pixel of slack, because a scroll position is fractional on a
 * scaled viewport and an end reached reports a hair short of the room.
 *
 * Here rather than beside one component because two rows under the workspace's
 * top edge measure it — the view bar and the run chip line, which fade their
 * ends the same way. CA_0060_002 CA_0062_003
 */
export const moreBeyond = (
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
): { start: boolean; end: boolean } => ({
  start: scrollLeft > 1,
  end: scrollWidth - clientWidth - scrollLeft > 1,
});
