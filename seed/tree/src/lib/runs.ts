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
/** The roles a text block may take. `abstract` is a manuscript's abstract,
 * a block in the reading order that a run proposes like any other and that
 * the manuscript's head projects (`BO_0293_013`). */
export const TEXT_ROLES = ["paragraph", "h1", "h2", "h3", "quote", "abstract"] as const;
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
  /** Mathematics set in the line (`BO_0290_009`): the run's text is its exact
   * TeX rather than words, and it is drawn typeset wherever it is read. */
  readonly math?: true;
  /** A reference to a numbered equation of the same document, by identity.
   * The run carries no text of its own — it is drawn as that equation's
   * current number, which is resolved on every read and stored nowhere. */
  readonly equationRef?: string;
  /** A reference to a numbered figure — an image, or an output's picture — of
   * the same document, by identity, drawn as its current number
   * (`BO_0295_007`). No text of its own, as an equation reference. */
  readonly figureRef?: string;
  /** A reference to a numbered table of the same document, by identity. */
  readonly tableRef?: string;
  /** A citation of a work of the instance's bibliography (`BO_0291_012`): the
   * work's identity and an optional locator such as a page. The run carries no
   * text of its own — it is drawn as the work's number in the document, which
   * is resolved on every read and stored nowhere. */
  readonly cite?: Citation;
}

/** What a citation run names: the cited work, and where in it. */
export interface Citation {
  readonly work: string;
  readonly locator?: string;
}

/** The key a citation's styled label is answered under: its work and its
 * locator, since the same work cited at two places reads differently.
 * `BO_0291_030` */
export const citationKey = (cite: Citation): string => `${cite.work}\u0000${cite.locator ?? ""}`;

const citationOf = (value: Citation): Citation => ({
  work: value.work,
  ...(value.locator !== undefined ? { locator: value.locator } : {}),
});

const sameCitation = (left: Citation | undefined, right: Citation | undefined): boolean =>
  left === undefined || right === undefined
    ? left === right
    : left.work === right.work && left.locator === right.locator;

/**
 * An atom is a run that stands for one thing rather than for its characters:
 * mathematics set in the line, a reference to an equation, and a citation.
 *
 * It counts as **one character** in every offset these primitives deal in, so
 * the caret steps over it rather than into it, a split never cuts inside it,
 * and a mark applied across a selection leaves it alone — marks mean nothing
 * over an equation. Without this rule `explode` would shatter one equation
 * into one run per character. `BO_0290_009`
 */
export const isAtom = (entry: Run): boolean =>
  entry.math === true ||
  entry.equationRef !== undefined ||
  entry.figureRef !== undefined ||
  entry.tableRef !== undefined ||
  entry.cite !== undefined;

/** Whether a run is an atom that carries no text of its own — every reference
 * and a citation — and so survives normalization's drop of empty runs. */
const isEmptyAtom = (entry: Run): boolean =>
  entry.equationRef !== undefined ||
  entry.figureRef !== undefined ||
  entry.tableRef !== undefined ||
  entry.cite !== undefined;

/** The attributes an atom carries, copied whenever a run is rebuilt. */
const atomOf = (entry: Run): Partial<Run> => ({
  ...(entry.math === true ? { math: true as const } : {}),
  ...(entry.equationRef !== undefined ? { equationRef: entry.equationRef } : {}),
  ...(entry.figureRef !== undefined ? { figureRef: entry.figureRef } : {}),
  ...(entry.tableRef !== undefined ? { tableRef: entry.tableRef } : {}),
  ...(entry.cite !== undefined ? { cite: citationOf(entry.cite) } : {}),
});

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
  ...atomOf(from),
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
    // A reference and a citation carry no text of their own and survive the
    // drop; a math run whose text is empty holds no source and is dropped
    // like any other empty run. `BO_0290_009` `BO_0291_012`
    // `BO_0295_007`: a figure or table reference survives the same way.
    if (candidate.text === "" && !isEmptyAtom(candidate)) continue;
    const marks = normalizeMarks(candidate.marks ?? []);
    const next: Run = {
      text: candidate.text,
      ...(marks.length > 0 ? { marks } : {}),
      ...(candidate.link !== undefined ? { link: candidate.link } : {}),
      ...atomOf(candidate),
    };
    const last = normalized[normalized.length - 1];
    if (
      last !== undefined &&
      !isAtom(last) &&
      !isAtom(next) &&
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
  return runs.reduce(
    (total, entry) => total + (isAtom(entry) ? 1 : [...entry.text].length),
    0,
  );
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
    const atom = isAtom(entry);
    const characters = [...entry.text];
    const start = seen;
    seen += atom ? 1 : characters.length;
    if (seen <= at) {
      head.push(entry);
      continue;
    }
    if (start >= at || atom) {
      // An atom is one character wide, so nothing falls between its ends; the
      // guard says so rather than leaving it to arithmetic. `BO_0290_009`
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
  /** The whole run, when this character stands for an atom. It carries no
   * marks and no link, so every range operation passes over it unchanged and
   * `implode` puts the run back exactly as it was. `BO_0290_009` */
  readonly atom?: Run;
}

function explode(runs: readonly Run[]): Char[] {
  const chars: Char[] = [];
  for (const entry of runs) {
    if (isAtom(entry)) {
      chars.push({ ch: entry.text, marks: [], link: undefined, atom: entry });
      continue;
    }
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
    chars.map((char) =>
      char.atom !== undefined
        ? char.atom
        : {
            text: char.ch,
            ...(char.marks.length > 0 ? { marks: [...char.marks] } : {}),
            ...(char.link !== undefined ? { link: char.link } : {}),
          },
    ),
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

/**
 * Replaces a character range with one atom — mathematics, or a reference to an
 * equation (`BO_0290_017`).
 *
 * This is how a selection becomes an equation: the words the reader chose are
 * the TeX it starts from, and a collapsed caret puts a new one where it
 * stands. The atom is placed through the same character model every other edit
 * uses, so what surrounds it keeps its own marks and nothing else moves.
 */
/**
 * Replaces a character range with runs — what a paste carrying mathematics
 * puts in, since what arrives is a mixture of words and equations rather than
 * plain text (`BO_0290_024`).
 */
export function replaceRangeWithRuns(
  runs: readonly Run[],
  start: number,
  end: number,
  inserted: readonly Run[],
): Run[] {
  const chars = explode(runs);
  const [low, high] = bounds(chars, start, end);
  return implode([...chars.slice(0, low), ...explode(inserted), ...chars.slice(high)]);
}

export function replaceRangeWithAtom(
  runs: readonly Run[],
  start: number,
  end: number,
  atom: Run,
): Run[] {
  return replaceRangeWithRuns(runs, start, end, [atom]);
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
        entry.math === other.math &&
        entry.equationRef === other.equationRef &&
        entry.figureRef === other.figureRef &&
        entry.tableRef === other.tableRef &&
        sameCitation(entry.cite, other.cite) &&
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
    // Mathematics and a reference to it (`BO_0290_009`). Reading them back is
    // not optional politeness: a read that rebuilt a run from text, marks and
    // link alone would drop the mathematics out of every stored sentence.
    const math = entry["math"];
    const equationRef = entry["equationRef"];
    if (math !== undefined && math !== true) {
      return { failure: `Run ${index} carries math that is not true.` };
    }
    if (
      equationRef !== undefined &&
      (typeof equationRef !== "string" || equationRef.trim() === "")
    ) {
      return { failure: `Run ${index} refers to no equation.` };
    }
    if (math !== undefined && equationRef !== undefined) {
      return {
        failure: `Run ${index} is mathematics or a reference to it, never both.`,
      };
    }
    if (math === true && entry["text"] === "") {
      return { failure: `Run ${index} is mathematics carrying no source.` };
    }
    // A reference to a numbered figure or table (`BO_0295_007`): an identity,
    // no text of its own, and nothing else a run can be.
    const figureRef = entry["figureRef"];
    const tableRef = entry["tableRef"];
    for (const [key, value, what] of [
      ["figureRef", figureRef, "figure"],
      ["tableRef", tableRef, "table"],
    ] as const) {
      if (value === undefined) continue;
      if (typeof value !== "string" || value.trim() === "") {
        return { failure: `Run ${index} refers to no ${what}.` };
      }
      if (entry["text"] !== "") {
        return { failure: `Run ${index} is a ${what} reference carrying text of its own.` };
      }
      const others = [math, equationRef, entry["cite"], key === "figureRef" ? tableRef : figureRef];
      if (others.some((other) => other !== undefined)) {
        return { failure: `Run ${index} is one reference, mathematics or a citation, never two at once.` };
      }
    }
    // A citation (`BO_0291_012`): the work it names and an optional locator,
    // on a run that carries no text of its own and is nothing else.
    const cite = entry["cite"];
    let citation: Citation | undefined;
    if (cite !== undefined) {
      if (typeof cite !== "object" || cite === null || Array.isArray(cite)) {
        return { failure: `Run ${index} carries a citation that names no work.` };
      }
      const { work, locator, ...rest } = cite as Record<string, unknown>;
      if (typeof work !== "string" || work.trim() === "") {
        return { failure: `Run ${index} carries a citation that names no work.` };
      }
      if (locator !== undefined && typeof locator !== "string") {
        return { failure: `Run ${index} carries a citation whose locator is not words.` };
      }
      const foreign = Object.keys(rest)[0];
      if (foreign !== undefined) {
        return { failure: `Run ${index} carries a citation with ${foreign}, which a citation does not carry.` };
      }
      if (math !== undefined || equationRef !== undefined) {
        return { failure: `Run ${index} is a citation or mathematics, never both.` };
      }
      if (entry["text"] !== "") {
        return { failure: `Run ${index} is a citation carrying text of its own.` };
      }
      citation = { work, ...(locator !== undefined ? { locator: locator as string } : {}) };
    }
    runs.push({
      text: entry["text"],
      ...(marks !== undefined ? { marks: marks as Mark[] } : {}),
      ...(link !== undefined ? { link: link as string } : {}),
      ...(math === true ? { math: true as const } : {}),
      ...(equationRef !== undefined
        ? { equationRef: equationRef as string }
        : {}),
      ...(figureRef !== undefined ? { figureRef: figureRef as string } : {}),
      ...(tableRef !== undefined ? { tableRef: tableRef as string } : {}),
      ...(citation !== undefined ? { cite: citation } : {}),
    });
  }
  return { runs: normalizeRuns(runs) };
}

/** What an item of each kind proposes, as the console says it. */
const PROPOSED: Readonly<Record<string, string>> = {
  replace: "Proposed a rewrite",
  insert: "Proposed a new block",
  remove: "Proposed a removal",
  move: "Proposed a move",
};

/** A run's activity in a document in words: *Read the document*, *Read 2
 * blocks*, *Proposed a rewrite*. BO_0265_006 */
function describeActivity(
  activity: { readonly scope: string; readonly action: string; readonly blocks: readonly string[] } | undefined,
): string {
  if (activity === undefined) return "";
  if (activity.action === "read") {
    if (activity.scope === "document") return "Read the document";
    return activity.blocks.length === 1 ? "Read 1 block" : `Read ${activity.blocks.length} blocks`;
  }
  return PROPOSED[activity.action] ?? `Proposed a change (${activity.action})`;
}

/**
 * One line of a run's activity, as the console reads it aloud.
 *
 * The shell renders the normalized contract and never the agent's own JSON, so
 * this is the only place a reader's words are chosen for an event.
 */
export function describeRunEvent(event: {
  kind: string;
  activity?: { readonly scope: string; readonly action: string; readonly blocks: readonly string[]; readonly note?: string };
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
    case "documentActivity":
      return describeActivity(event.activity);
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

/**
 * Whether `read` could be `model` after one edit at a caret that had `selected`
 * characters under it.
 *
 * One edit replaces one contiguous stretch, so whatever the caret did not touch
 * is still at the start or at the end of what comes back. A reading that shares
 * neither, while the block held words and holds words again and the reader had
 * not selected the whole of it, is not an edit of this block at all: it comes
 * from an element that holds something else, or from one that was never painted.
 *
 * Deliberately narrow. A word deleted, a line deleted, a spellchecker replacing
 * a word and a whole selection retyped all keep one end or are accounted for by
 * the selection, and none of them may be refused — a reader whose ordinary
 * editing is thrown away is worse off than one who loses a block's words once.
 * DO_0017_001
 */
export function couldBeOneEdit(
  model: string,
  read: string,
  selected: number,
): boolean {
  if (model === "" || read === "" || selected >= model.length) return true;
  let prefix = 0;
  while (prefix < model.length && prefix < read.length && model[prefix] === read[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < model.length - prefix &&
    suffix < read.length - prefix &&
    model[model.length - 1 - suffix] === read[read.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return prefix > 0 || suffix > 0;
}
