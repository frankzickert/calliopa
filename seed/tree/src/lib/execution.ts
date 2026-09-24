/**
 * What the right panel's *Execution* section lists: the runs of the document
 * in the active tab — every run the person may see, newest first, archived
 * ones included, and with a block selected the runs sent from it, then the
 * runs that touched it — and, in a group of their own, the reader's other
 * processes, which is every process on a tab that is no document. It is the
 * one list, so no process stands in it twice (`CA_0058_008`). Pure, so which
 * entry lands in which group is proven without a browser. BO_0267_010
 */

/** One run of a document, as the shell's route answers it. */
export interface ExecutionRun {
  readonly id: string;
  /** The command's words, the block's when it was sent from one. */
  readonly goal: string;
  readonly status: string;
  readonly agent: string | null;
  /** The proposal group it staged into, once it has. */
  readonly group: string | null;
  /** The block it was sent from. */
  readonly source: string | null;
  /** The blocks it staged against. */
  readonly touched: readonly string[];
  /** What it was told the reader marked, as the command sent it: the
   * *Touching* group reads their blocks, and a prompt's marks come back from
   * its latest run's (`BO_0267_013`). */
  readonly references: readonly SentMark[];
  readonly startedAt: number;
}

/** A reference as a run's record keeps it. */
export interface SentMark {
  readonly number: number;
  readonly blockId: string;
  readonly kind?: string;
  readonly quote?: string;
  readonly target?: string;
  readonly group?: string;
  readonly item?: string;
  readonly revisionId?: string;
}

/**
 * A process of the reader's that is not a run of the document in this tab:
 * what the console listed, in the words an entry shows. CA_0058_008
 */
export interface ExecutionProcess {
  readonly id: string;
  readonly title: string;
  readonly state: string;
  readonly step: string | null;
  /** The run it reports, when it is one. */
  readonly runId: string | null;
  /** A run an extension's trigger started, which says so at a glance. */
  readonly system: boolean;
}

/** What the section shows: the document's runs — every one, or the two
 * groups for a block — and the reader's other processes beside them. */
export type ExecutionGroups = {
  readonly elsewhere: readonly ExecutionProcess[];
} & (
  | { readonly kind: "all"; readonly runs: readonly ExecutionRun[] }
  | {
      readonly kind: "block";
      readonly from: readonly ExecutionRun[];
      readonly touching: readonly ExecutionRun[];
    }
);

const bare = (id: string): string => id.replace(/^node:/u, "");

/**
 * The runs split by the selected block: *From this block* are the runs sent
 * from it, *Touching this block* the runs that staged against it or were told
 * it was marked, the first group's runs excluded. No block selected lists
 * every run.
 *
 * *Elsewhere* is every process of the reader's that no listed run reports, so
 * a run of this document is listed as a run and never again as a process, and
 * a tab that is no document lists its processes alone. CA_0058_008
 */
export function executionGroups(
  runs: readonly ExecutionRun[],
  selected: string | null,
  processes: readonly ExecutionProcess[] = [],
): ExecutionGroups {
  const listed = new Set(runs.map((run) => run.id));
  const elsewhere = processes.filter((process) => process.runId === null || !listed.has(process.runId));
  if (selected === null || selected === "") return { kind: "all", runs, elsewhere };
  const block = bare(selected);
  const from = runs.filter((run) => run.source !== null && bare(run.source) === block);
  const touching = runs.filter(
    (run) =>
      !from.includes(run) &&
      (run.touched.some((id) => bare(id) === block) || run.references.some((reference) => bare(reference.blockId) === block)),
  );
  return { kind: "block", from, touching, elsewhere };
}

/** A process record as the registry answers it, with nothing the section
 * does not read. CA_0058_008 */
export function executionProcess(record: {
  readonly id: string;
  readonly title: string;
  readonly state: string;
  readonly step: string | null;
  readonly runId?: string;
  readonly trigger?: string;
}): ExecutionProcess {
  return {
    id: record.id,
    title: record.title,
    state: record.state,
    step: record.step,
    runId: record.runId === undefined || record.runId === "" ? null : record.runId,
    system: record.trigger === "system",
  };
}

/** Whether a process is still going, which is when it can be cancelled. */
export const processRunning = (process: ExecutionProcess): boolean =>
  process.state === "running" || process.state === "queued";

/** The first line of a command's words, which an entry shows. */
export const firstLineOf = (goal: string): string => goal.trim().split("\n")[0]?.trim() ?? "";

/** A run's state in the section's words. */
export function stateWords(status: string): string {
  switch (status) {
    case "running":
    case "queued":
      return "running";
    case "completed":
      return "ended";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return status;
  }
}

/** Whether a run is still going, which is when it can be cancelled and the
 * section keeps reading the list. */
export const isRunning = (run: ExecutionRun): boolean => run.status === "running" || run.status === "queued";

/** A bridge record as the route answers it, with nothing the section does not
 * read. */
export function executionRun(record: {
  readonly id: string;
  readonly goal: string;
  readonly status: string;
  readonly agent?: string;
  readonly group?: string;
  readonly source?: { readonly block: string };
  readonly touched?: readonly string[];
  readonly references?: readonly SentMark[];
  readonly startedAt?: number;
}): ExecutionRun {
  return {
    id: record.id,
    goal: record.goal,
    status: record.status,
    agent: record.agent ?? null,
    group: record.group === undefined || record.group === "" ? null : record.group,
    source: record.source?.block ?? null,
    touched: record.touched ?? [],
    references: record.references ?? [],
    startedAt: record.startedAt ?? 0,
  };
}
