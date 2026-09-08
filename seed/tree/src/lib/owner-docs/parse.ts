/**
 * The live-line protocol, parsed.
 *
 * An extension's docs are written the way this project's own docs are: list
 * items whose marker carries commitment (`*` fixed, `-` mutable) and whose
 * checkbox carries state (`[ ]` open, `[x]` claimed, none means truth), a
 * `Status:` line on a change document, headings that name sections, and task
 * identifiers that tie a line to the change that made it true. This module
 * reads that protocol and nothing else; it is pure, so it is tested against
 * real documents without a graph. BO_0201_006
 */

export type Marker = "fixed" | "mutable";
export type LineState = "truth" | "open" | "claimed";

/** One live line: a requirement, an assumption, or a piece of work. */
export interface LiveLine {
  readonly path: string;
  /** The nearest heading above the line, or "" for lines before any heading. */
  readonly section: string;
  readonly marker: Marker;
  readonly state: LineState;
  /** A functional question: the line begins with the protocol's phrase. */
  readonly question: boolean;
  /** The line's text with marker and checkbox removed, continuation lines joined. */
  readonly text: string;
  /** Every task identifier the text carries, in order of appearance, unique. */
  readonly tasks: readonly string[];
}

export interface Prose {
  readonly kind: "prose";
  readonly section: string;
  readonly text: string;
  /** A fenced code block, kept whole. */
  readonly code: boolean;
}

export interface LiveLineBlock {
  readonly kind: "line";
  readonly line: LiveLine;
}

export interface Heading {
  readonly kind: "heading";
  readonly level: number;
  readonly text: string;
}

export type ParsedBlock = Prose | LiveLineBlock | Heading;

export interface ParsedDocument {
  readonly path: string;
  /** The first level-one heading, or the file name without its extension. */
  readonly title: string;
  /** The value of a `Status:` line, when the document carries one. */
  readonly status: string | null;
  readonly blocks: readonly ParsedBlock[];
  readonly lines: readonly LiveLine[];
  /** Every task identifier in the document, in order of first appearance. */
  readonly tasks: readonly string[];
}

export const TASK_ID = /\b[A-Z]{2}_\d{4}_\d{3}\b/gu;
/** A change identifier: the task identifier's first two parts. */
export const CHANGE_ID = /\b[A-Z]{2}_\d{4}(?=\b|_)/gu;

const LIVE = /^(\s*)([*-])\s+(?:\[( |x)\]\s+)?(.*)$/u;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/u;
const STATUS = /^Status:\s*(\S+)\s*$/u;
const QUESTION = /^\**\s*functional question\b/iu;

function unique(values: readonly string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

export function taskIdsIn(text: string): string[] {
  return unique(text.match(TASK_ID) ?? []);
}

export function changeIdsIn(text: string): string[] {
  return unique(text.match(CHANGE_ID) ?? []);
}

function fileTitle(path: string): string {
  const name = path.split("/").pop() ?? path;
  return name.replace(/\.md$/u, "");
}

/** Parses one markdown document under the protocol. */
export function parseDocument(path: string, markdown: string): ParsedDocument {
  const blocks: ParsedBlock[] = [];
  const lines: LiveLine[] = [];
  let title: string | null = null;
  let status: string | null = null;
  let section = "";
  let paragraph: string[] = [];
  let fence: string[] | null = null;
  let current: { text: string; marker: Marker; state: LineState } | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "prose", section, text: paragraph.join(" "), code: false });
      paragraph = [];
    }
  };
  const flushLine = (): void => {
    if (current === null) return;
    const text = current.text.trim();
    const line: LiveLine = {
      path,
      section,
      marker: current.marker,
      state: current.state,
      question: QUESTION.test(text),
      text,
      tasks: taskIdsIn(text),
    };
    lines.push(line);
    blocks.push({ kind: "line", line });
    current = null;
  };

  for (const raw of markdown.split(/\r?\n/u)) {
    if (fence !== null) {
      if (raw.trim().startsWith("```")) {
        blocks.push({ kind: "prose", section, text: fence.join("\n"), code: true });
        fence = null;
      } else {
        fence.push(raw);
      }
      continue;
    }
    if (raw.trim().startsWith("```")) {
      flushParagraph();
      flushLine();
      fence = [];
      continue;
    }
    const heading = HEADING.exec(raw);
    if (heading !== null) {
      flushParagraph();
      flushLine();
      const level = heading[1]?.length ?? 1;
      const text = heading[2] ?? "";
      if (level === 1 && title === null) title = text;
      else section = text;
      blocks.push({ kind: "heading", level, text });
      continue;
    }
    const statusMatch = STATUS.exec(raw);
    if (statusMatch !== null && status === null) {
      flushParagraph();
      flushLine();
      status = statusMatch[1] ?? null;
      continue;
    }
    const live = LIVE.exec(raw);
    if (live !== null) {
      flushParagraph();
      flushLine();
      const box = live[3];
      current = {
        text: live[4] ?? "",
        marker: live[2] === "*" ? "fixed" : "mutable",
        state: box === undefined ? "truth" : box === "x" ? "claimed" : "open",
      };
      continue;
    }
    if (raw.trim() === "") {
      flushParagraph();
      flushLine();
      continue;
    }
    // An indented continuation belongs to the live line above it; anything
    // else is prose.
    if (current !== null && /^\s+/u.test(raw)) {
      current = { ...current, text: `${current.text} ${raw.trim()}` };
      continue;
    }
    flushLine();
    paragraph.push(raw.trim());
  }
  flushParagraph();
  flushLine();

  return {
    path,
    title: title ?? fileTitle(path),
    status,
    blocks,
    lines,
    tasks: unique(lines.flatMap((line) => line.tasks).concat(taskIdsIn(markdown))),
  };
}
