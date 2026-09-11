import { component$, type QRL } from "@builder.io/qwik";

import type { OpenTarget } from "~/contract";
// The document kind the process inspector opens a run's proposals under
// (BO_0202_004) is the kind a command is aimed at, and lives with the aim.
import { DOCUMENT_KIND } from "~/lib/command-target";
import type { DragPayload } from "~/lib/drag";
import { describeProcess, type ProcessRecord } from "~/lib/process";
import {
  pressProcess,
  releaseProcess,
  selectedProcess,
  type ProcessSelection,
} from "~/lib/process-selection";
import type { TabsState } from "~/lib/tabs";
import type { ProposedDocument } from "~/server/agent/proposed";
import { Icon } from "./icons";
import type {
  InspectorFact,
  SaveState,
  ViewAction,
  ViewInspector,
} from "./view-bridge";

/**
 * The inspector's body and the console's process list, which share one
 * question: which process, if any, the active tab's inspector shows. Their own
 * module so the render harness can press them through real JSX
 * (`testing/inspector-host.tsx`); the shell mounts them over its own stores.
 * CA_0040_001
 */

/** The process registry the shell polls, with each tab's selection. */
export interface ProcessRegistry {
  items: ProcessRecord[];
  selection: ProcessSelection;
}

/** What the selected process's run proposed, read when the selection changes. */
export interface ProposedRead {
  processId: string | null;
  documents: ProposedDocument[];
}

/** The process the active tab's inspector shows, when it shows one. */
export function shownProcess(
  registry: ProcessRegistry,
  tabs: TabsState,
): ProcessRecord | undefined {
  const selected = selectedProcess(registry.selection, tabs.activeTabId);
  return registry.items.find(({ id }) => id === selected);
}

/**
 * The console's process list. A press selects the process for the active tab,
 * and a second press on the row already selected lets it go; the row says
 * which it is with `aria-pressed`, not with a class alone. CA_0040_003
 */
export const ProcessList = component$<{
  registry: ProcessRegistry;
  tabs: TabsState;
  startDrag$: QRL<(payload: DragPayload, event: PointerEvent) => void>;
}>(({ registry, tabs, startDrag$ }) => {
  if (registry.items.length === 0) return <p>No running processes</p>;
  const selected = selectedProcess(registry.selection, tabs.activeTabId);
  return (
    <ul class="process-list" aria-label="Processes">
      {registry.items.map((process) => (
        <li key={process.id}>
          <button
            type="button"
            class={{
              "process-entry": true,
              "process-entry--selected": process.id === selected,
            }}
            aria-pressed={process.id === selected ? "true" : "false"}
            data-process-id={process.id}
            data-state={process.state}
            onPointerDown$={(event) =>
              startDrag$(
                {
                  itemId: process.id,
                  kind: "process-result",
                  source: "dock",
                  operations: ["attach-to-command", "process-input"],
                  preview: process.title,
                },
                event,
              )
            }
            onClick$={() => {
              registry.selection = pressProcess(
                registry.selection,
                tabs.activeTabId,
                process.id,
              );
            }}
          >
            {describeProcess(process)}
          </button>
        </li>
      ))}
    </ul>
  );
});

/**
 * The inspector's body: the process the active tab selected, or the active
 * view's contribution. The detail closes with a labelled *Close process*,
 * not a ×, because the phone's inspector sheet already has a × that closes
 * the sheet. CA_0040_002
 */
export const InspectorPanel = component$<{
  registry: ProcessRegistry;
  tabs: TabsState;
  proposed: ProposedRead;
  inspector: ViewInspector;
  declared: string;
  viewId: string | undefined;
  openTarget$: QRL<(target: OpenTarget) => void>;
  acknowledge$: QRL<(id: string) => void>;
}>(
  ({
    registry,
    tabs,
    proposed,
    inspector,
    declared,
    viewId,
    openTarget$,
    acknowledge$,
  }) => {
    const detail = shownProcess(registry, tabs);
    if (detail === undefined) {
      return (
        <InspectorContribution
          inspector={inspector}
          declared={declared}
          viewId={viewId}
        />
      );
    }
    return (
      <div class="process-detail" data-process-id={detail.id}>
        <p class="eyebrow">Process</p>
        <h3>{detail.title}</h3>
        <p data-process-state={detail.state}>{detail.state}</p>
        <p data-process-step>{detail.step ?? "no step reported"}</p>
        {detail.error !== null && (
          <p class="process-error" data-process-error>
            {detail.error}
          </p>
        )}
        {proposed.processId === detail.id && (
          <div class="proposed" data-proposed>
            <p class="eyebrow">Proposed</p>
            {proposed.documents.length === 0 ? (
              <p data-proposed-none>This run proposed nothing.</p>
            ) : (
              <ul class="proposed__list">
                {proposed.documents.map((document) => (
                  <li key={document.documentId}>
                    <button
                      type="button"
                      data-proposed-document={document.documentId}
                      onClick$={() =>
                        openTarget$({
                          kind: DOCUMENT_KIND,
                          itemId: document.documentId,
                          title: document.title,
                        })
                      }
                    >
                      {document.title}
                    </button>
                    <span data-proposed-unanswered>
                      {document.unanswered} unanswered
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {detail.state === "failed" &&
          (detail.acknowledged ? (
            <p data-process-acknowledged>Failure acknowledged</p>
          ) : (
            <button type="button" onClick$={() => acknowledge$(detail.id)}>
              Acknowledge failure
            </button>
          ))}
        <button
          type="button"
          data-process-close
          onClick$={() => {
            registry.selection = releaseProcess(
              registry.selection,
              tabs.activeTabId,
            );
          }}
        >
          Close process
        </button>
      </div>
    );
  },
);

/**
 * What the inspector says for the active view: the view's own live
 * contribution when it has one, and its declared contribution otherwise.
 *
 * Its own component so that a view updating its contribution re-renders the
 * inspector alone. Re-rendering the shell for it would re-render the view too,
 * which for an editing surface means rebuilding the element under the caret.
 */
const InspectorContribution = component$<{
  inspector: ViewInspector;
  declared: string;
  viewId: string | undefined;
}>(({ inspector, declared, viewId }) => {
  const { facts, actions, text } = inspector;
  if (facts.length === 0 && actions.length === 0) {
    return <p data-view-inspector={viewId}>{text ?? declared}</p>;
  }
  return (
    <div class="view-inspector" data-view-inspector={viewId}>
      {facts.length > 0 && (
        <dl class="inspector-facts">
          {facts.map((fact) => (
            <div key={fact.label} class="inspector-fact">
              <dt>{fact.label}</dt>
              <dd data-inspector-fact={fact.kind}>
                <InspectorFactValue fact={fact} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {actions.length > 0 && (
        <div class="inspector-actions">
          {actions.map((action) =>
            action.kind === "toggle" ? (
              <button
                key={action.id}
                type="button"
                data-inspector-action={action.id}
                aria-pressed={action.on}
                onClick$={() => action.run$(!action.on)}
              >
                {action.label}
              </button>
            ) : action.kind === "choice" ? (
              <ChoiceControl
                key={action.id}
                action={action}
                surface="inspector"
              />
            ) : (
              <button
                key={action.id}
                type="button"
                data-inspector-action={action.id}
                data-destructive={action.destructive === true ? "" : undefined}
                onClick$={() => action.run$()}
              >
                {action.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
});

/**
 * A choice action as the shell renders it, in the inspector and the dock
 * alike: a label, the icon that stands for the current value when the
 * options name one, and a native select. The view supplies the words and
 * what choosing does; the shell knows how to draw a select and nothing
 * about what a status is. BO_0222_007
 */
export const ChoiceControl = component$<{
  action: Extract<ViewAction, { kind: "choice" }>;
  surface: "inspector" | "dock";
}>(({ action, surface }) => {
  const current = action.options.find(
    (option) => option.value === action.value,
  );
  const controlId = `${surface}-choice-${action.id}`;
  return (
    <label class="choice-control" for={controlId} data-choice={action.id}>
      <span class="choice-control__label">{action.label}</span>
      {current?.icon !== undefined && <Icon name={current.icon} />}
      <select
        id={controlId}
        data-inspector-action={surface === "inspector" ? action.id : undefined}
        data-dock-action={surface === "dock" ? action.id : undefined}
        value={action.value}
        onChange$={(_, element) => action.run$(element.value)}
      >
        {action.options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            selected={option.value === action.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
});

/**
 * How the shell reads each fact a view contributes.
 *
 * A time renders as an absolute value in a `time` element carrying the
 * machine-readable stamp. A relative age in a drawer that sits open would have
 * to keep itself current, and one that stopped ticking would state something
 * false; a static absolute value cannot go stale.
 */
const InspectorFactValue = component$<{ fact: InspectorFact }>(({ fact }) => {
  if (fact.kind === "saveState") {
    return <span data-save-state={fact.value}>{SAVE_WORD[fact.value]}</span>;
  }
  if (fact.kind === "time") {
    return <time dateTime={fact.value}>{readableTime(fact.value)}</time>;
  }
  return <span>{String(fact.value)}</span>;
});

/** An absolute moment a reader can take in at a glance. An unparseable stamp
 * reads as itself rather than as `Invalid Date`. */
function readableTime(value: string): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return value;
  return at.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export const SAVE_WORD: Readonly<Record<SaveState, string>> = {
  saving: "Saving",
  saved: "Saved",
  unsaved: "Unsaved",
};
