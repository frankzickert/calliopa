/**
 * Where the role popover stands above the phone width (`RO_0004_001`): below
 * its chip, or above it where the room below is smaller than the room above;
 * its height capped to the room on that side; shifted along the line so it
 * stays inside the frame. Pure, in the viewport's pixels, so the control
 * measures and this decides.
 */

/** A box in viewport pixels, as `getBoundingClientRect` answers it. */
export type Box = { top: number; left: number; right: number; bottom: number };

export type Placement = {
  side: "below" | "above";
  /** From the frame's top when below, else null. */
  top: number | null;
  /** From the viewport's bottom when above, so it grows upward; else null. */
  bottom: number | null;
  left: number;
  width: number;
  maxHeight: number;
};

/** The gap between the chip and the popover. */
export const CHIP_GAP = 6;
/** What the popover keeps clear of the frame's edges. */
export const FRAME_MARGIN = 8;

export const placePopover = ({
  chip,
  frame,
  width,
  align,
  viewportHeight = frame.bottom,
}: {
  chip: Box;
  frame: Box;
  /** The popover's own width, before the frame narrows it. */
  width: number;
  /** "end": the popover ends at the chip's right edge (the block's chip at the right of its row). */
  align: "start" | "end";
  /** The viewport's height, which a popover above is measured up from. */
  viewportHeight?: number;
}): Placement => {
  const lowest = frame.top + FRAME_MARGIN;
  const highest = frame.bottom - FRAME_MARGIN;
  const startBelow = Math.min(Math.max(chip.bottom + CHIP_GAP, lowest), highest);
  const endAbove = Math.max(Math.min(chip.top - CHIP_GAP, highest), lowest);
  const below = highest - startBelow;
  const above = endAbove - lowest;
  const fitted = Math.max(0, Math.min(width, frame.right - frame.left - 2 * FRAME_MARGIN));
  const wanted = align === "end" ? chip.right - fitted : chip.left;
  const left = Math.min(Math.max(wanted, frame.left + FRAME_MARGIN), frame.right - FRAME_MARGIN - fitted);
  if (below < above) {
    return { side: "above", top: null, bottom: viewportHeight - endAbove, left, width: fitted, maxHeight: above };
  }
  return { side: "below", top: startBelow, bottom: null, left, width: fitted, maxHeight: below };
};
