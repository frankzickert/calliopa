import {
  changeIdsIn,
  parseDocument,
  type LiveLine,
  type ParsedDocument,
} from "./parse";

/**
 * An extension's docs as a network rather than a page.
 *
 * Topics are the system documents, changes are the change documents, tasks are
 * the identifiers that tie a line to the change that enumerated it, questions
 * are the lines awaiting the owner, and history is what the graph records about
 * the proposals that carried the work. Every edge here is one the protocol
 * already encodes; nothing is inferred from prose. BO_0201_006
 */

export interface DocSource {
  readonly path: string;
  readonly content: string;
}

/** What the graph records about one accepted or open proposal group. */
export interface ProposalSummary {
  readonly id: string;
  readonly status: string;
  readonly rationale: string;
  readonly author: string;
  readonly dataRevision: number;
}

export interface Topic {
  readonly kind: "topic";
  readonly path: string;
  readonly title: string;
  /** The area is the directory under docs/system, or "" at its root. */
  readonly area: string;
  readonly document: ParsedDocument;
  readonly fixedCount: number;
  readonly openCount: number;
  readonly claimedCount: number;
}

export interface Change {
  readonly kind: "change";
  readonly path: string;
  /** The change identifier from the file name, e.g. `CA_0022`, or "" when the name carries none. */
  readonly id: string;
  readonly title: string;
  readonly status: string;
  /** The first prose paragraph after the status line. */
  readonly intent: string;
  readonly document: ParsedDocument;
  /** Task identifiers the change enumerates: its own prefix, or any it names. */
  readonly tasks: readonly string[];
  /** Topics the change names by file name. */
  readonly topics: readonly string[];
}

export interface Task {
  readonly id: string;
  /** Lines carrying the identifier, in the order the documents list them. */
  readonly lines: readonly LiveLine[];
  /** Change documents whose own identifier is this task's prefix or that name it. */
  readonly changes: readonly string[];
}

export interface HistoryEntry extends ProposalSummary {
  /** Change or task identifiers the rationale carries. */
  readonly identifiers: readonly string[];
}

export interface Network {
  readonly topics: readonly Topic[];
  readonly changes: readonly Change[];
  readonly tasks: ReadonlyMap<string, Task>;
  readonly questions: readonly LiveLine[];
  readonly history: readonly HistoryEntry[];
  readonly readme: ParsedDocument | null;
}

const SYSTEM = /^docs\/system\/(.+)\.md$/u;
const CHANGE = /^docs\/changes\/(?:completed\/)?([^/]+)\.md$/u;
const CHANGE_NAME = /^([A-Z]{2}_\d{4})_/u;

function count(document: ParsedDocument, predicate: (line: LiveLine) => boolean): number {
  return document.lines.filter(predicate).length;
}

function intentOf(document: ParsedDocument): string {
  const prose = document.blocks.find((block) => block.kind === "prose" && !block.code);
  return prose !== undefined && prose.kind === "prose" ? prose.text : "";
}

const compareIds = (a: string, b: string): number => (a < b ? 1 : a > b ? -1 : 0);

/** Builds the network from an extension's docs members and the graph's proposal groups. */
export function buildNetwork(
  sources: readonly DocSource[],
  proposals: readonly ProposalSummary[],
): Network {
  const topics: Topic[] = [];
  const changes: Change[] = [];
  let readme: ParsedDocument | null = null;

  for (const source of sources) {
    const system = SYSTEM.exec(source.path);
    if (system !== null) {
      const document = parseDocument(source.path, source.content);
      const parts = (system[1] ?? "").split("/");
      topics.push({
        kind: "topic",
        path: source.path,
        title: document.title,
        area: parts.length > 1 ? parts.slice(0, -1).join("/") : "",
        document,
        fixedCount: count(document, (line) => line.marker === "fixed"),
        openCount: count(document, (line) => line.state === "open"),
        claimedCount: count(document, (line) => line.state === "claimed"),
      });
      continue;
    }
    const change = CHANGE.exec(source.path);
    if (change !== null) {
      const document = parseDocument(source.path, source.content);
      const name = change[1] ?? "";
      const id = CHANGE_NAME.exec(name)?.[1] ?? "";
      changes.push({
        kind: "change",
        path: source.path,
        id,
        title: document.title,
        status: document.status ?? "unknown",
        intent: intentOf(document),
        document,
        tasks: document.tasks,
        topics: [],
      });
      continue;
    }
    if (source.path === "README.md") {
      readme = parseDocument(source.path, source.content);
    }
  }

  topics.sort((a, b) => a.path.localeCompare(b.path));
  changes.sort((a, b) => {
    const openA = a.status !== "completed";
    const openB = b.status !== "completed";
    if (openA !== openB) return openA ? -1 : 1;
    return compareIds(a.id || a.path, b.id || b.path);
  });

  // A change names a topic when its text carries the topic's file name.
  const topicNames = topics.map((topic) => ({
    path: topic.path,
    name: topic.path.split("/").pop() ?? topic.path,
  }));
  const linked = changes.map((change) => {
    const text = change.document.blocks
      .map((block) => (block.kind === "prose" ? block.text : block.kind === "line" ? block.line.text : block.text))
      .join("\n");
    return {
      ...change,
      topics: topicNames.filter(({ name }) => text.includes(name)).map(({ path }) => path),
    };
  });

  const tasks = new Map<string, { id: string; lines: LiveLine[]; changes: Set<string> }>();
  const task = (id: string) => {
    let entry = tasks.get(id);
    if (entry === undefined) {
      entry = { id, lines: [], changes: new Set() };
      tasks.set(id, entry);
    }
    return entry;
  };
  for (const topic of topics) {
    for (const line of topic.document.lines) {
      for (const id of line.tasks) task(id).lines.push(line);
    }
  }
  for (const change of linked) {
    for (const id of change.tasks) task(id).changes.add(change.path);
    // A task whose prefix is the change's own identifier belongs to it even
    // when the change document never spells the task out.
    if (change.id !== "") {
      for (const id of tasks.keys()) {
        if (id.startsWith(`${change.id}_`)) task(id).changes.add(change.path);
      }
    }
  }

  const questions = topics
    .flatMap((topic) => topic.document.lines)
    .concat(linked.flatMap((change) => change.document.lines))
    .filter((line) => line.question);

  const history: HistoryEntry[] = [...proposals]
    .sort((a, b) => b.dataRevision - a.dataRevision)
    .map((proposal) => ({
      ...proposal,
      identifiers: [
        ...changeIdsIn(proposal.rationale),
        ...(proposal.rationale.match(/\b[A-Z]{2}_\d{4}_\d{3}\b/gu) ?? []),
      ].filter((value, index, all) => all.indexOf(value) === index),
    }));

  return {
    topics,
    changes: linked,
    tasks: new Map(
      [...tasks.values()].map((entry) => [
        entry.id,
        { id: entry.id, lines: entry.lines, changes: [...entry.changes].sort() },
      ]),
    ),
    questions,
    history,
    readme,
  };
}
