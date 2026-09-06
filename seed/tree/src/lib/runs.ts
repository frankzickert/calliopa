/**
 * Text runs: what a text block holds, and every edit that can be made to one.
 *
 * This module is shared by the editor in the browser and the vocabulary on the
 * server, deliberately. "Equal normalized content is not written again" only
 * holds if the surface that builds runs and the boundary that stores them
 * normalize the same way, and one implementation is the only way to guarantee
 * that.
 *
 * Every position here is a character offset, counted in characters rather than
 * UTF-16 code units, so text outside the basic plane splits where a reader sees
 * the boundary. Offsets are never stored — they name different characters in
 * different runtimes — they only cross between a live selection and an edit.
 */

/** The roles a text block may carry. An absent role means `paragraph`, so an
 * ordinary block stores no role at all. */
export const TEXT_ROLES = ["paragraph", "h1", "h2", "h3", "quote"] as const;
export type TextRole = (typeof TEXT_ROLES)[number];

/** The marks a run may carry. A link is a property of the run rather than a
 * mark, because it holds a value. */
export const MARKS = ["bold", "italic", "strikethrough", "code"] as const;
export type Mark = (typeof MARKS)[number];

/** A stretch of text carrying its own marks. */
export interface Run {
  readonly text: string;
  readonly marks?: readonly Mark[];
  readonly link?: string;
}

/** Marks in their declared order, each once, so two runs carrying the same set
 * compare equal however the caller listed them. */
function normalizeMarks(marks: readonly unknown[]): Mark[] {
  return MARKS.filter((mark) => marks.includes(mark));
}

const sameMarks = (left: Run, right: Run): boolean => {
  const leftMarks = left.marks ?? [];
  const rightMarks = right.marks ?? [];
  return (
    leftMarks.length === rightMarks.length &&
    leftMarks.every((mark) => rightMarks.includes(mark))
  );
};

const run = (text: string, from: Run): Run => ({
  text,
  ...(from.marks !== undefined && from.marks.length > 0
    ? { marks: [...from.marks] }
    : {}),
  ...(from.link !== undefined ? { link: from.link } : {}),
});

/**
 * The stored form of a run list: empty runs dropped, marks in declared order,
 * and adjacent runs carrying the same marks and link joined.
 *
 * Normalizing on the way in is what makes two edits that mean the same thing
 * compare equal, so an editor that rebuilds its runs does not write a revision
 * saying nothing new.
 */
export function normalizeRuns(runs: readonly Run[]): Run[] {
  const normalized: Run[] = [];
  for (const candidate of runs) {
    if (candidate.text === "") continue;
    const marks = normalizeMarks(candidate.marks ?? []);
    const next: Run = {
      text: candidate.text,
      ...(marks.length > 0 ? { marks } : {}),
      ...(candidate.link !== undefined ? { link: candidate.link } : {}),
    };
    const last = normalized[normalized.length - 1];
    if (
      last !== undefined &&
      sameMarks(last, next) &&
      last.link === next.link
    ) {
      normalized[normalized.length - 1] = run(last.text + next.text, last);
      continue;
    }
    normalized.push(next);
  }
  return normalized;
}

/** The text a run list holds, in order. */
export function runsText(runs: readonly Run[]): string {
  return runs.map((entry) => entry.text).join("");
}

/** How many characters a run list holds. */
export function runsLength(runs: readonly Run[]): number {
  return runs.reduce((total, entry) => total + [...entry.text].length, 0);
}

/**
 * Splits a run list at a character position. A position past the end puts
 * everything in the head.
 *
 * Both halves are normalized, and every character survives in one of them:
 * splitting is the model's job precisely so the caller cannot lose one.
 */
export function splitRuns(runs: readonly Run[], at: number): [Run[], Run[]] {
  const head: Run[] = [];
  const tail: Run[] = [];
  let seen = 0;

  for (const entry of runs) {
    const characters = [...entry.text];
    const start = seen;
    seen += characters.length;
    if (seen <= at) {
      head.push(entry);
      continue;
    }
    if (start >= at) {
      tail.push(entry);
      continue;
    }
    const boundary = at - start;
    head.push(run(characters.slice(0, boundary).join(""), entry));
    tail.push(run(characters.slice(boundary).join(""), entry));
  }

  return [normalizeRuns(head), normalizeRuns(tail)];
}

/**
 * One character with the marks and link it carries.
 *
 * Editing through characters rather than through run boundaries is what keeps
 * these operations obviously correct: a range edit never has to reason about
 * which runs it partially covers, and `normalizeRuns` rebuilds the run
 * boundaries afterwards from what the marks actually became.
 */
interface Char {
  readonly ch: string;
  readonly marks: readonly Mark[];
  readonly link: string | undefined;
}

function explode(runs: readonly Run[]): Char[] {
  const chars: Char[] = [];
  for (const entry of runs) {
    for (const ch of entry.text) {
      chars.push({
        ch,
        marks: normalizeMarks(entry.marks ?? []),
        link: entry.link,
      });
    }
  }
  return chars;
}

function implode(chars: readonly Char[]): Run[] {
  return normalizeRuns(
    chars.map((char) => ({
      text: char.ch,
      ...(char.marks.length > 0 ? { marks: [...char.marks] } : {}),
      ...(char.link !== undefined ? { link: char.link } : {}),
    })),
  );
}

/** A range clamped to the run list and ordered, so a caller may hand over a
 * live selection without checking it first. */
function bounds(
  chars: readonly Char[],
  start: number,
  end: number,
): [number, number] {
  const low = Math.max(0, Math.min(start, end));
  const high = Math.min(chars.length, Math.max(start, end));
  return [low, Math.max(low, high)];
}

/** The runs covering a character range, normalized. */
export function sliceRuns(
  runs: readonly Run[],
  start: number,
  end: number,
): Run[] {
  const chars = explode(runs);
  const [low, high] = bounds(chars, start, end);
  return implode(chars.slice(low, high));
}

/**
 * The marks every character in the range carries.
 *
 * A mark held by only part of the selection is not reported, so toggling reads
 * as "make all of this bold" on a mixed selection rather than as "unbold the
 * half that is". An empty range reports the marks of the character before the
 * caret, which is what makes a pending format at a collapsed caret possible.
 */
export function marksAt(
  runs: readonly Run[],
  start: number,
  end: number,
): Mark[] {
  const chars = explode(runs);
  const [low, high] = bounds(chars, start, end);
  if (low === high) {
    const before = chars[low - 1];
    return before === undefined ? [] : [...before.marks];
  }
  const covered = chars.slice(low, high);
  return MARKS.filter((mark) =>
    covered.every((char) => char.marks.includes(mark)),
  );
}

/** The link every character in the range carries, or null when they differ or
 * carry none. */
export function linkAt(
  runs: readonly Run[],
  start: number,
  end: number,
): string | null {
  const chars = explode(runs);
  const [low, high] = bounds(chars, start, end);
  const covered = chars.slice(low, high);
  const first = covered[0]?.link;
  if (first === undefined || covered.length === 0) return null;
  return covered.every((char) => char.link === first) ? first : null;
}

/** Turns a mark on or off across a character range. */
export function applyMark(
  runs: readonly Run[],
  start: number,
  end: number,
  mark: Mark,
  on: boolean,
): Run[] {
  const chars = explode(runs);
  const [low, high] = bounds(chars, start, end);
  return implode(
    chars.map((char, index) => {
      if (index < low || index >= high) return char;
      const marks = on
        ? normalizeMarks([...char.marks, mark])
        : char.marks.filter((held) => held !== mark);
      return { ...char, marks };
    }),
  );
}

/** Sets or clears the link across a character range. */
export function applyLink(
  runs: readonly Run[],
  start: number,
  end: number,
  link: string | null,
): Run[] {
  const chars = explode(runs);
  const [low, high] = bounds(chars, start, end);
  return implode(
    chars.map((char, index) =>
      index < low || index >= high
        ? char
        : { ...char, link: link === null ? undefined : link },
    ),
  );
}

/**
 * Replaces a character range with plain text, which is how paste and typed
 * input enter the model.
 *
 * The inserted text takes the formatting of the character the range starts
 * after, so typing inside a bold word stays bold and a paste at a plain caret
 * arrives plain. Structural paste that carries its own formatting is a later
 * change; nothing here invents marks the surrounding text does not have.
 */
export function replaceRange(
  runs: readonly Run[],
  start: number,
  end: number,
  text: string,
): Run[] {
  const chars = explode(runs);
  const [low, high] = bounds(chars, start, end);
  const carrier = chars[low - 1] ?? chars[high] ?? null;
  const inserted: Char[] = [...text].map((ch) => ({
    ch,
    marks: carrier === null ? [] : carrier.marks,
    link: carrier === null ? undefined : carrier.link,
  }));
  return implode([...chars.slice(0, low), ...inserted, ...chars.slice(high)]);
}

/** Whether two run lists mean the same thing once normalized. This is the
 * check that keeps a save from writing a revision saying nothing new. */
export function sameRuns(left: readonly Run[], right: readonly Run[]): boolean {
  const a = normalizeRuns(left);
  const b = normalizeRuns(right);
  return (
    a.length === b.length &&
    a.every((entry, index) => {
      const other = b[index] as Run;
      return (
        entry.text === other.text &&
        entry.link === other.link &&
        sameMarks(entry, other)
      );
    })
  );
}

/**
 * Reads an untrusted value as a run list, or says why it is not one.
 *
 * Both the schema validator and the editor's API boundary need this question
 * answered, and two answers that could disagree is exactly the bug where a
 * write passes one check and fails the other.
 */
export function readRuns(
  value: unknown,
): { readonly runs: Run[] } | { readonly failure: string } {
  if (!Array.isArray(value)) return { failure: "A text block carries runs." };
  const runs: Run[] = [];
  for (const [index, candidate] of value.entries()) {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      return { failure: `Run ${index} is not a run.` };
    }
    const entry = candidate as Record<string, unknown>;
    if (typeof entry["text"] !== "string") {
      return { failure: `Run ${index} carries no text.` };
    }
    const marks = entry["marks"];
    if (marks !== undefined) {
      if (!Array.isArray(marks))
        return { failure: `Run ${index} lists no marks.` };
      for (const mark of marks) {
        if (!MARKS.includes(mark as Mark)) {
          return {
            failure: `Run ${index} carries the mark ${String(mark)}, which is not one of ${MARKS.join(", ")}.`,
          };
        }
      }
    }
    const link = entry["link"];
    if (link !== undefined && typeof link !== "string") {
      return { failure: `Run ${index} carries a link that is not a location.` };
    }
    runs.push({
      text: entry["text"],
      ...(marks !== undefined ? { marks: marks as Mark[] } : {}),
      ...(link !== undefined ? { link: link as string } : {}),
    });
  }
  return { runs: normalizeRuns(runs) };
}

/**
 * One line of a run's activity, as the console reads it aloud.
 *
 * The shell renders the normalized contract and never the agent's own JSON, so
 * this is the only place a reader's words are chosen for an event.
 */
export function describeRunEvent(event: {
  kind: string;
  tool?: string;
  text?: string;
  error?: string;
  output?: string;
  failed?: boolean;
}): string {
  switch (event.kind) {
    case "runStarted":
      return "Started";
    case "assistantDelta":
      return event.text ?? "";
    case "toolStarted":
      return `Using ${event.tool ?? "a tool"}`;
    case "toolCompleted":
      return `${event.failed === true ? "Failed" : "Finished"} ${event.tool ?? "a tool"}`;
    case "runCompleted":
      return event.output === undefined || event.output === ""
        ? "Done"
        : event.output;
    case "runFailed":
      return event.error ?? "The run failed.";
    case "runCancelled":
      return "Cancelled";
    default:
      return event.kind;
  }
}
