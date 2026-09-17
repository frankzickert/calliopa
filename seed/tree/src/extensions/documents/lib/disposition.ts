/**
 * The disposition scale: the one standing a block carries, and how a gesture
 * moves it. BO_0227_011
 *
 * One state per block, not four flags — a pinned block is kept, and a block
 * swiped right to pin and then left to resolve is resolved, with no state in
 * which it is both. Neutral is the absence of the stored property, as
 * paragraph is `role`'s (`block-document-model.md`), so the scale has five
 * positions and the graph four values.
 *
 * Ported from the retired artifact editor's `lib/disposition.ts` (`BO_0138`),
 * which closed on these rules after use on a phone and a desktop. The words a
 * state is called by live here and only here: the swipe's reveal, the bar's
 * control, the announcement, the undo line and the accessible names all read
 * these tables, so a state cannot be called two things in two places.
 */

/** In scale order, from the destructive end. */
export const SCALE = [
  "discarded",
  "resolved",
  "neutral",
  "keep",
  "pin",
] as const;

export type Standing = (typeof SCALE)[number];

/** The four stored values; neutral is stored as nothing. */
export type Disposition = Exclude<Standing, "neutral">;

export const DISPOSITIONS: readonly Disposition[] = [
  "keep",
  "pin",
  "resolved",
  "discarded",
];

export type Direction = "left" | "right";

/** What each state is called where a person chooses it. */
export const LABEL: Readonly<Record<Standing, string>> = {
  discarded: "Discard",
  resolved: "Resolve",
  neutral: "Neutral",
  keep: "Keep",
  pin: "Pin",
};

/** What arriving at each state is called, in an announcement or an undo. */
export const DONE: Readonly<Record<Standing, string>> = {
  discarded: "Discarded",
  resolved: "Resolved",
  neutral: "Back to neutral",
  keep: "Kept",
  pin: "Pinned",
};

/**
 * The word a block carries for its standing, beside a glyph so the state
 * never rests on colour alone. Participles, because a mark says what the block
 * is rather than what pressing something would do. Neutral carries none, and
 * a discarded block is not drawn in the flow.
 */
export const MARK: Readonly<Partial<Record<Standing, string>>> = {
  keep: "kept",
  pin: "pinned",
  resolved: "resolved",
  discarded: "discarded",
};

/**
 * The glyph a standing is recognised by, one shape per standing, so the state
 * never rests on colour or on a bar's width — the 2px-versus-3px difference
 * `BO_0138` recorded as the weakest thing it shipped. Neutral has none.
 * BO_0227_012 BO_0231_002
 */
export const GLYPH: Readonly<Partial<Record<Standing, string>>> = {
  keep: "◇",
  pin: "◆",
  resolved: "✓",
  discarded: "✕",
};

export const isDisposition = (value: unknown): value is Disposition =>
  typeof value === "string" &&
  (DISPOSITIONS as readonly string[]).includes(value);

/** A stored value read back: anything that is not a disposition is neutral. */
export const readStanding = (value: unknown): Standing =>
  isDisposition(value) ? value : "neutral";

/** What is written for a standing: neutral clears the property. */
export const storedValue = (standing: Standing): Disposition | null =>
  standing === "neutral" ? null : standing;

/**
 * One step along the scale, for a key chord or a control that steps: a kept or
 * pinned block goes to neutral before it is resolved, and a resolved or
 * discarded one to neutral before it is kept, so reversing is never skipped.
 * The ends stay where they are.
 */
export function step(current: Standing, direction: Direction): Standing {
  if (direction === "right") {
    switch (current) {
      case "discarded":
      case "resolved":
        return "neutral";
      case "neutral":
        return "keep";
      case "keep":
      case "pin":
        return "pin";
    }
  }
  switch (current) {
    case "keep":
    case "pin":
      return "neutral";
    case "neutral":
      return "resolved";
    case "resolved":
    case "discarded":
      return "discarded";
  }
}

/**
 * What the swipe's near and far thresholds reach from where the block stands.
 *
 * Positions on the scale rather than steps, because **discard is only ever the
 * far threshold's**: the far action on the left is the one that takes a block
 * out of sight, and its distance is the whole reason the swipe has two
 * thresholds. A resolved block swiped left therefore stays resolved at the
 * near threshold and is discarded only at the far one. The near threshold on a
 * resolved or discarded block swiped right reopens it before keep is offered;
 * on a kept or pinned block swiped left, it returns it to neutral.
 *
 * One deliberate difference from `BO_0138`'s table: a pinned block swiped
 * right stays pinned. The old table answered keep at the near threshold — the
 * one target that moved against the finger.
 */
export function swipeTargets(
  current: Standing,
  direction: Direction,
): readonly [Standing, Standing] {
  if (direction === "right") {
    switch (current) {
      case "discarded":
      case "resolved":
        return ["neutral", "keep"];
      case "neutral":
      case "keep":
        return ["keep", "pin"];
      case "pin":
        return ["pin", "pin"];
    }
  }
  switch (current) {
    case "keep":
    case "pin":
      return ["neutral", "resolved"];
    case "neutral":
    case "resolved":
      return ["resolved", "discarded"];
    case "discarded":
      return ["discarded", "discarded"];
  }
}
