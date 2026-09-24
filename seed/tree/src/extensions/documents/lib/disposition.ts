/**
 * The disposition scale: the one standing a block carries, and how a gesture
 * moves it. BO_0227_011 BO_0272_006
 *
 * Three states, one per block: discard, keep and fixate. Keep is the state a
 * block is in unless someone says otherwise — the absence of the stored
 * property, as paragraph is `role`'s — so the scale has three positions and
 * the graph two values. A fixated block is kept and also stands behind every
 * command issued in its document, which is what pin did before `BO_0272`.
 *
 * Ported from the retired artifact editor's `lib/disposition.ts` (`BO_0138`),
 * which closed on a five-position scale after use on a phone and a desktop;
 * `BO_0272` took it to three, where one action reaches each end. The words a
 * state is called by live here and only here: the swipe's reveal, the bar's
 * control, the announcement, the take-back line and the accessible names all
 * read these tables, so a state cannot be called two things in two places —
 * and the kernel says the same of each state to a run
 * (`agenttools.DispositionMeaning`, `BO_0272_002`).
 */

/** In scale order, from the destructive end. */
export const SCALE = ["discarded", "keep", "fixate"] as const;

/**
 * Every standing: the scale, and a prompt — a block sent as a command, which
 * leaves the drawn flow as a discarded block does. A prompt is set by *Send*
 * alone and is not on the scale: no swipe or chord reaches it, and the bar's
 * *Standing* choice sets it back. BO_0267_014
 */
export const STANDINGS = [...SCALE, "prompt"] as const;

export type Standing = (typeof STANDINGS)[number];

/** The stored values; keep is stored as nothing. */
export type Disposition = Exclude<Standing, "keep">;

/** The two a person sets on the scale beside keep, as the standing toolbar
 * offers them. */
export const DISPOSITIONS: readonly Disposition[] = ["discarded", "fixate"];

/** Every value the graph stores, the prompt included. BO_0267_014 */
export const STORED: readonly Disposition[] = [...DISPOSITIONS, "prompt"];

export type Direction = "left" | "right";

/** What each state is called where a person chooses it. */
export const LABEL: Readonly<Record<Standing, string>> = {
  discarded: "Discard",
  keep: "Keep",
  fixate: "Fixate",
  prompt: "Prompt",
};

/** What arriving at each state is called, in an announcement or a take-back. */
export const DONE: Readonly<Record<Standing, string>> = {
  discarded: "Discarded",
  keep: "Back to keep",
  fixate: "Fixated",
  prompt: "Sent as prompt",
};

/**
 * What each state means, in the words the info control reads. The reader's
 * wording and the run's say the same thing of each state. BO_0272_009
 */
export const MEANING: Readonly<Record<Standing, string>> = {
  discarded:
    "Set aside: the block leaves the page and stays in the document and its order. Show discarded blocks brings it back.",
  keep: "Where a block stands unless you say otherwise. Nothing is marked and nothing is hidden.",
  fixate:
    "Left standing, and sent with every command you give in this document.",
  prompt:
    "A command you sent from this block. Show prompts brings it back into the page.",
};

/**
 * What a drawn row can be marked as: the standings that carry a mark, and a
 * retired block — out of the document's flow rather than anywhere on the
 * scale, but drawn as the fourth card and so needing the fourth word.
 * DO_0008_001
 */
export type CardMark = Exclude<Standing, "keep"> | "retired";

/**
 * The word a row carries for its mark, beside a glyph so the state never
 * rests on colour alone. Participles, because a mark says what the block is
 * rather than what pressing something would do. Keep carries none — a mark
 * means someone acted. One table for the four, so the card's label and a
 * row's accessible name cannot call a state two things.
 */
export const MARK: Readonly<Partial<Record<CardMark | "keep", string>>> = {
  fixate: "fixated",
  discarded: "discarded",
  prompt: "prompt",
  retired: "retired",
};

/**
 * The glyph a mark is recognised by, one shape per mark, so the state never
 * rests on colour or on a bar's width — the 2px-versus-3px difference
 * `BO_0138` recorded as the weakest thing it shipped. Keep has none. A
 * prompt and a retired block have none here either: their face is the icon
 * of the toggle that reveals them, which the label draws instead
 * (`standing-mark.tsx`, `DO_0008_001`). BO_0227_012 BO_0231_002
 */
export const GLYPH: Readonly<Partial<Record<CardMark | "keep", string>>> = {
  fixate: "◆",
  discarded: "✕",
};

/**
 * The glyph on a control that *sets* a standing, where every state needs a
 * face — the standing toolbar's three buttons. Keep has one here and none in
 * `GLYPH`, because a control offers a state while a mark says someone acted,
 * and the state a block is in unless someone says otherwise is not an act.
 * BO_0272_010
 */
export const CONTROL_GLYPH: Readonly<Record<(typeof SCALE)[number], string>> = {
  discarded: "✕",
  keep: "○",
  fixate: "◆",
};

export const isDisposition = (value: unknown): value is Disposition =>
  typeof value === "string" && (STORED as readonly string[]).includes(value);

/**
 * What a value written before `BO_0272` narrowed the scale reads as: pin was
 * fixate under another name, a resolved block had been set aside by its
 * reader and discard is the remaining state that says so, and the old keep is
 * the resting state the word now means. A block still carrying one reads as
 * its successor until the next write stores it, so an instance the narrowing
 * reached before its content shows what the reader decided rather than
 * nothing. User decision, 2026-09-21 (`BO_0272_011`).
 */
export const RETIRED: Readonly<Record<string, Standing>> = {
  pin: "fixate",
  resolved: "discarded",
  keep: "keep",
};

/** A stored value read back: a standing this scale knows, what a retired
 * value became, or keep. */
export const readStanding = (value: unknown): Standing =>
  isDisposition(value)
    ? value
    : typeof value === "string" && value in RETIRED
      ? (RETIRED[value] as Standing)
      : "keep";

/** What is written for a standing: keep clears the property. */
export const storedValue = (standing: Standing): Disposition | null =>
  standing === "keep" ? null : standing;

/**
 * One step along the scale, which with three states is the whole distance: a
 * swipe, a key chord and a control that steps all commit this. From keep, left
 * discards and right fixates; from either end, the step back is keep. The ends
 * stay where they are.
 */
export function step(current: Standing, direction: Direction): Standing {
  // A prompt is not on the scale: no chord moves it. BO_0267_014
  if (current === "prompt") return current;
  if (direction === "right") {
    return current === "discarded" ? "keep" : "fixate";
  }
  return current === "fixate" ? "keep" : "discarded";
}
