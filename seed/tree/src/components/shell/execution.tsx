import { $, component$, type QRL } from "@builder.io/qwik";

import { faceOf } from "~/lib/agent-menu";
import type { DragPayload } from "~/lib/drag";
import {
  executionGroups,
  firstLineOf,
  isRunning,
  stateWords,
  type ExecutionProcess,
  type ExecutionRun,
} from "~/lib/execution";
import type { Layout } from "~/lib/layout";
import { sectionState } from "~/lib/layout";
import { Icon } from "./icons";
import { SectionHeader } from "./panel";
import type { RunChip, ViewAnswerAll, ViewToggleRun } from "./view-bridge";

/**
 * The right panel's *Execution* section: the one list of what is running and
 * what has run. On a document tab it lists that document's runs, newest
 * first, archived ones included, and with a block selected the runs sent from
 * it, then the runs that touched it; beside them, under *Elsewhere*, stand
 * the reader's other processes, which on a tab that is no document is the
 * whole list. No process is listed twice. BO_0267_010 CA_0058_005 CA_0058_008
 *
 * A run's entry is its agent's face, the first line of its command and its
 * state, and while its group stands open the line its chip shows. Its body
 * shows or hides the run's proposals as the chip's press does (`BO_0267`),
 * and the caret beside it selects the process, which opens its detail in the
 * panel with the run's events (`CA_0058_006`). *Reject all* and *Accept all*
 * are its own buttons once it has ended, and *Cancel* while it runs. The
 * presses are the view's to answer, through `toggleRun` and `answerAll`, as
 * the chips' are — the shell only says which run.
 */

/** The runs of the active document, as the shell last read them. */
export interface ExecutionRead {
  itemId: string | null;
  runs: ExecutionRun[];
  error: string | null;
}

/** The section's key in the layout's section states. */
export const EXECUTION_SECTION = "ui.shell:execution";

export const ExecutionSection = component$<{
  /** The document in the active tab, or null where the tab shows none. */
  itemId: string | null;
  selection: string | null;
  read: ExecutionRead;
  /** Every process the reader may see, as the registry last answered. */
  processes: readonly ExecutionProcess[];
  /** The process whose detail the panel is showing, if any. */
  selected: string | null;
  chips: readonly RunChip[];
  answerAll: ViewAnswerAll;
  toggleRun: ViewToggleRun;
  layout: Layout;
  onToggle$: QRL<() => void>;
  onCancel$: QRL<(runId: string) => void>;
  onSelect$: QRL<(processId: string) => void>;
  startDrag$: QRL<(payload: DragPayload, event: PointerEvent) => void>;
}>(
  ({
    itemId,
    selection,
    read,
    processes,
    selected,
    chips,
    answerAll,
    toggleRun,
    layout,
    onToggle$,
    onCancel$,
    onSelect$,
    startDrag$,
  }) => {
    const answer$ = $((group: string, answer: "accepted" | "rejected") => {
      answerAll.itemId = itemId;
      answerAll.group = group;
      answerAll.answer = answer;
      answerAll.seq += 1;
    });
    const toggle$ = $((key: string) => {
      toggleRun.itemId = itemId;
      toggleRun.key = key;
      toggleRun.seq += 1;
    });
    const collapsed = sectionState(layout, EXECUTION_SECTION) === "collapsed";
    const runs = itemId !== null && read.itemId === itemId ? read.runs : [];
    const groups = executionGroups(runs, selection, processes);

    const entry = (run: ExecutionRun) => {
      const chip = chips.find((candidate) => candidate.group !== null && candidate.group === run.group);
      const running = isRunning(run);
      const line = firstLineOf(run.goal);
      const state = stateWords(run.status);
      // The process this run reports, which holds its events and its detail.
      const process = processes.find((candidate) => candidate.runId === run.id);
      return (
        <li key={run.id} class="execution__run" data-execution-run={run.id} data-execution-state={state}>
          <button
            type="button"
            class="execution__toggle"
            data-execution-toggle={run.id}
            aria-pressed={chip?.shown ?? false}
            aria-label={`${chip?.shown ? "Hide" : "Show"} the proposals of “${line}”, ${state}`}
            // A run whose change is not standing open has nothing to show.
            disabled={chip === undefined}
            onClick$={() => chip !== undefined && toggle$(chip.key)}
          >
            <img class="execution__face" src={faceOf(run.agent)} alt="" width={20} height={20} draggable={false} />
            <span class="execution__words">
              <span class="execution__line" data-execution-line>
                {line}
              </span>
              <span class="execution__state" data-execution-state-words>
                {chip === undefined ? state : `${state} · ${chip.text}`}
              </span>
            </span>
          </button>
          {/* The detail, where the run's events stand. CA_0058_006 */}
          <button
            type="button"
            class="execution__detail"
            data-execution-detail={run.id}
            aria-pressed={process !== undefined && process.id === selected}
            aria-label={`Details of “${line}”`}
            disabled={process === undefined}
            onClick$={() => process !== undefined && onSelect$(process.id)}
          >
            <Icon name="caret-right" size={14} />
          </button>
          {running && (
            <button
              type="button"
              class="execution__answer"
              data-execution-cancel={run.id}
              aria-label={`Cancel “${line}”`}
              onClick$={() => onCancel$(run.id)}
            >
              <Icon name="x" size={14} />
              <span>Cancel</span>
            </button>
          )}
          {!running && chip !== undefined && chip.group !== null && (
            <span class="execution__answers">
              <button
                type="button"
                class="execution__answer"
                data-execution-reject-all={chip.group}
                aria-label={`Reject all the proposals of “${line}”`}
                onClick$={() => answer$(chip.group as string, "rejected")}
              >
                <Icon name="x" size={14} />
                <span>Reject all</span>
              </button>
              <button
                type="button"
                class="execution__answer"
                data-execution-accept-all={chip.group}
                aria-label={`Accept all the proposals of “${line}”`}
                onClick$={() => answer$(chip.group as string, "accepted")}
              >
                <Icon name="checks" size={14} />
                <span>Accept all</span>
              </button>
            </span>
          )}
        </li>
      );
    };

    /** A process of the reader's that no listed run reports: what the console
     * listed, pressed the same way. CA_0058_005 */
    const processEntry = (process: ExecutionProcess) => (
      <li key={process.id} class="execution__run" data-execution-process={process.id}>
        <button
          type="button"
          class="execution__toggle process-entry"
          data-process-id={process.id}
          data-state={process.state}
          aria-pressed={process.id === selected}
          aria-label={`${process.title}, ${process.state}`}
          onPointerDown$={(event) =>
            startDrag$(
              {
                itemId: process.id,
                kind: "process-result",
                source: "panel",
                operations: ["attach-to-command", "process-input"],
                preview: process.title,
              },
              event,
            )
          }
          onClick$={() => onSelect$(process.id)}
        >
          {process.system && (
            <span class="process-entry__system" data-process-system aria-hidden="true">
              <Icon name="sparkle" size={14} />
            </span>
          )}
          <span class="execution__words">
            <span class="execution__line" data-execution-line>
              {process.title}
            </span>
            <span class="execution__state" data-execution-state-words>
              {process.step === null ? process.state : `${process.state} · ${process.step}`}
            </span>
          </span>
        </button>
      </li>
    );

    const elsewhere =
      groups.elsewhere.length === 0 ? null : (
        <>
          {/* Named only beside a document's own runs: on a tab that shows no
              document there is nothing for it to stand apart from. */}
          {itemId !== null && (
            <h4 class="execution__group" data-execution-group="elsewhere">
              Elsewhere
            </h4>
          )}
          <ul class="execution__list" aria-label="Your other processes">
            {groups.elsewhere.map(processEntry)}
          </ul>
        </>
      );

    return (
      <section class="execution library-category" data-execution aria-labelledby="execution-heading">
        <SectionHeader
          layout={layout}
          sectionKey={EXECUTION_SECTION}
          name="execution"
          elementId="execution-heading"
          title="Execution"
          collapsible={true}
          onToggle$={onToggle$}
          onCreate$={$(() => undefined)}
        />
        <div id="execution-heading-list" class="library-category__body" hidden={collapsed}>
          {read.error !== null && itemId !== null && read.itemId === itemId && (
            <p class="execution__notice" role="status" data-execution-error>
              {read.error}
            </p>
          )}
          {groups.kind === "all" ? (
            runs.length === 0 && groups.elsewhere.length === 0 ? (
              <p class="execution__notice" data-execution-empty>
                {itemId === null ? "Nothing has run yet" : "No runs on this document yet"}
              </p>
            ) : (
              <>
                {runs.length > 0 && (
                  <ul class="execution__list" aria-label="Runs of this document">
                    {groups.runs.map(entry)}
                  </ul>
                )}
                {elsewhere}
              </>
            )
          ) : groups.from.length === 0 && groups.touching.length === 0 && groups.elsewhere.length === 0 ? (
            <p class="execution__notice" data-execution-empty-block>
              No runs from or touching this block
            </p>
          ) : (
            <>
              {groups.from.length > 0 && (
                <>
                  <h4 class="execution__group" data-execution-group="from">
                    From this block
                  </h4>
                  <ul class="execution__list" aria-label="Runs from this block">
                    {groups.from.map(entry)}
                  </ul>
                </>
              )}
              {groups.touching.length > 0 && (
                <>
                  <h4 class="execution__group" data-execution-group="touching">
                    Touching this block
                  </h4>
                  <ul class="execution__list" aria-label="Runs touching this block">
                    {groups.touching.map(entry)}
                  </ul>
                </>
              )}
              {elsewhere}
            </>
          )}
        </div>
      </section>
    );
  },
);
