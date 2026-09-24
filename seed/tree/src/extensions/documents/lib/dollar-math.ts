import {
  replaceRangeWithAtom,
  runsLength,
  runsText,
  sliceRuns,
  type Run,
} from "~/lib/runs";

/**
 * `$…$` typed in a sentence becomes mathematics (`BO_0290_024`).
 *
 * The user's decision of 2026-09-23: the conversion happens as the closing `$`
 * lands, and undo gives back the literal characters — so the gesture is fast
 * without being a trap.
 */

/**
 * What stands between two `$` is an equation only when it is not spaced away
 * from either of them, and when the closing `$` is not followed by a digit.
 *
 * The user's rule was "no space after the opening `$`, so a sentence about
 * money is not an equation". That alone does not save the example they gave:
 * in `$5 and $10` the first `$` is followed by `5`, so the pair would convert
 * and eat the sentence. The rule is therefore the one TeX-aware editors settle
 * on — no space on *either* inside edge, and no digit after the close — which
 * keeps `$5 and $10` as money and `$x^2$` as mathematics. A technical decision
 * serving the user's intent, open to their revision.
 */
const isEquationSource = (source: string): boolean =>
  source !== "" && !/^\s/.test(source) && !/\s$/.test(source) && !source.includes("$");

/**
 * The runs with the `$…$` ending at `caret` turned into mathematics, and where
 * the caret then stands — or null when nothing closed there.
 *
 * **Only the pair that just closed converts.** Converting every pair in the
 * block would be simpler and wrong: undo restores the literal characters, and
 * the next keystroke would convert them straight back, so nothing a person
 * undid would stay undone.
 *
 * `caret` is a character offset in the run model, where an atom counts as one.
 */
export function mathAtCaret(
  runs: readonly Run[],
  caret: number,
): { readonly runs: Run[]; readonly caret: number } | null {
  if (caret < 2 || caret > runsLength(runs)) return null;
  const before = runsText(sliceRuns(runs, 0, caret));
  // The closing `$` is the character just typed.
  if (!before.endsWith("$")) return null;
  const opening = before.lastIndexOf("$", before.length - 2);
  if (opening < 0) return null;
  const source = before.slice(opening + 1, before.length - 1);
  if (!isEquationSource(source)) return null;
  const placed = replaceRangeWithAtom(runs, opening, caret, {
    text: source,
    math: true,
  });
  // The atom is one character wide, so the caret lands just after it.
  return { runs: placed, caret: opening + 1 };
}

/**
 * A pasted string as runs, every `$…$` in it converted.
 *
 * Paste is the one place where converting *every* pair is right: the person
 * did not type these characters one at a time, so there is no single
 * conversion for an undo to protect. The user's decision, 2026-09-23.
 */
export function mathInText(text: string): Run[] {
  const runs: Run[] = [];
  let at = 0;
  let opening = text.indexOf("$");
  while (opening >= 0) {
    const closing = text.indexOf("$", opening + 1);
    if (closing < 0) break;
    const source = text.slice(opening + 1, closing);
    const after = text[closing + 1];
    if (!isEquationSource(source) || (after !== undefined && /[0-9]/.test(after))) {
      // Not an equation: this `$` stands as itself, and the next one is tried
      // as an opening, so `$5 and $10` keeps both of its dollars.
      opening = text.indexOf("$", opening + 1);
      continue;
    }
    const before = text.slice(at, opening);
    if (before !== "") runs.push({ text: before });
    runs.push({ text: source, math: true });
    at = closing + 1;
    opening = text.indexOf("$", at);
  }
  const rest = text.slice(at);
  if (rest !== "") runs.push({ text: rest });
  return runs;
}

/** Whether a pasted string holds anything this would convert, so a paste that
 * carries no mathematics takes the path it always took. */
export const carriesMath = (text: string): boolean =>
  mathInText(text).some((run) => run.math === true);
