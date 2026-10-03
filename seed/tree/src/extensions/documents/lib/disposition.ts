/**
 * The disposition scale: the one standing a block carries, and how a gesture
 * moves it. BO_0227_011 BO_0272_006 BO_0315_009
 *
 * Two states, one per block: keep and fixate. Keep is the state a block is in
 * unless someone says otherwise — the absence of the stored property, as
 * paragraph is `role`'s — so the graph stores one value on the scale. A
 * fixated block is kept and also stands behind every command issued in its
 * document. A block the reader no longer wants is not a standing at all: it
 * is removed, which retires it (`BO_0315`).
 *
 * Ported from the retired artifact editor's `lib/disposition.ts` (`BO_0138`);
 * `BO_0272` took it to three states and `BO_0315` to two. The words a state is
 * called by live here and only here: the swipe's reveal, the bar's control,
 * the announcement, the take-back line and the accessible names all read these
 * tables, so a state cannot be called two things in two places — and the
 * kernel says the same of each state to a run
 * (`agenttools.DispositionMeaning`, `BO_0272_002`).
 */

/** In scale order. */
export const SCALE = ["keep", "fixate"] as const;

/**
 * Every standing: the scale, and a prompt — a block sent as a command, which
 * leaves the drawn flow and stays in the document. A prompt is set by *Send*
 * alone and is not on the scale: no swipe or chord reaches it, and the bar's
 * *Standing* choice sets it back. BO_0267_014
 */
export const STANDINGS = [...SCALE, "prompt"] as const;

export type Standing = (typeof STANDINGS)[number];

/** The stored values; keep is stored as nothing. */
export type Disposition = Exclude<Standing, "keep">;

/** The one a person sets on the scale beside keep. */
export const DISPOSITIONS: readonly Disposition[] = ["fixate"];

/** Every value the graph stores, the prompt included. BO_0267_014 */
export const STORED: readonly Disposition[] = [...DISPOSITIONS, "prompt"];

export type Direction = "left" | "right";

/** What each state is called where a person chooses it. */
export const LABEL: Readonly<Record<Standing, string>> = {
  keep: "Keep",
  fixate: "Fixate",
  prompt: "Prompt",
};

/** What arriving at each state is called, in an announcement or a take-back. */
export const DONE: Readonly<Record<Standing, string>> = {
  keep: "Unfixated",
  fixate: "Fixated",
  prompt: "Sent as prompt",
};

/**
 * What a drawn row can be marked as: the standings that carry a mark, and a
 * removed row — a retired block or a rejected proposal, out of the document's
 * flow rather than anywhere on the scale, but drawn as a card and so needing
 * a word. DO_0008_001 BO_0315_009
 */
export type CardMark = Exclude<Standing, "keep"> | "removed";

/**
 * The word a row carries for its mark, beside a glyph so the state never
 * rests on colour alone. Participles, because a mark says what the block is
 * rather than what pressing something would do. Keep carries none — a mark
 * means someone acted. One table, so the card's label and a row's accessible
 * name cannot call a state two things.
 */
export const MARK: Readonly<Partial<Record<CardMark | "keep", string>>> = {
  fixate: "fixated",
  prompt: "prompt",
  removed: "removed",
};

/**
 * The glyph a mark is recognised by, so the state never rests on colour or on
 * a bar's width — the 2px-versus-3px difference `BO_0138` recorded as the
 * weakest thing it shipped. Keep has none. A prompt and a removed row have
 * none here either: their face is the icon of the toggle that reveals them,
 * which the label draws instead (`standing-mark.tsx`, `DO_0008_001`).
 * BO_0227_012 BO_0231_002
 */
export const GLYPH: Readonly<Partial<Record<CardMark | "keep", string>>> = {
  fixate: "◆",
};

/**
 * The glyph on a control that *sets* a standing, where every state needs a
 * face. Keep has one here and none in `GLYPH`, because a control offers a
 * state while a mark says someone acted, and the state a block is in unless
 * someone says otherwise is not an act. BO_0272_010
 */
export const CONTROL_GLYPH: Readonly<Record<(typeof SCALE)[number], string>> = {
  keep: "○",
  fixate: "◆",
};

export const isDisposition = (value: unknown): value is Disposition =>
  typeof value === "string" && (STORED as readonly string[]).includes(value);

/**
 * What a value written before the scale narrowed reads as: pin was fixate
 * under another name (`BO_0272_011`), and a block stored as discarded or
 * resolved had been set aside by its reader — the migration retires it
 * (`BO_0315_008`), and until it has reached the block it reads as keep, the
 * resting state, rather than as a standing that no longer exists. User
 * decisions, 2026-09-21 and 2026-09-30.
 */
export const RETIRED: Readonly<Record<string, Standing>> = {
  pin: "fixate",
  resolved: "keep",
  discarded: "keep",
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
 * One step along the scale, which with two states is the whole distance: the
 * chord and a control that steps commit this. Right fixates and left returns
 * to keep; each end stays where it is. Removing a block is not a step: it
 * leaves the scale (`BO_0315`).
 */
export function step(current: Standing, direction: Direction): Standing {
  // A prompt is not on the scale: no chord moves it. BO_0267_014
  if (current === "prompt") return current;
  return direction === "right" ? "fixate" : "keep";
}
