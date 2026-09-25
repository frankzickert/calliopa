import {
  component$,
  useOnDocument,
  useSignal,
  useStore,
  useVisibleTask$,
  $,
  type QRL,
} from "@builder.io/qwik";

import type { OpenTarget } from "~/contract";
// The document kind the process inspector opens a run's proposals under
// (BO_0202_004) is the kind a command is aimed at, and lives with the aim.
import { DOCUMENT_KIND } from "~/lib/command-target";
import { type ProcessRecord } from "~/lib/process";
import { describeRunEvent } from "~/lib/runs";
import type { RunEvent } from "~/server/agent/run-events";
import {
  releaseProcess,
  selectedProcess,
  type ProcessSelection,
} from "~/lib/process-selection";
import type { TabsState } from "~/lib/tabs";
import type { ProposedItem } from "~/server/agent/proposed";
import type { BridgeAttachment } from "~/server/agent/bridge";
import { deliveredWords, formatSize } from "~/lib/command-target";
import { Icon } from "./icons";
import type {
  InspectorFact,
  SaveState,
  ViewAction,
  ViewInspector,
} from "./view-bridge";

/**
 * The inspector's body: which process, if any, the active tab's inspector
 * shows, and what it says about it. Its own module so the render harness can
 * press it through real JSX (`testing/inspector-host.tsx`); the shell mounts
 * it over its own stores. The list the detail is opened from is the panel's
 * *Execution* section (`execution.tsx`, `CA_0058_005`). CA_0040_001
 */

/** The process registry the shell polls, with each tab's selection. */
export interface ProcessRegistry {
  items: ProcessRecord[];
  selection: ProcessSelection;
}

/** What the selected process's run proposed, the files it was sent with and
 * the events it reported, read when the selection changes. CA_0058_006 */
export interface ProposedRead {
  processId: string | null;
  documents: ProposedItem[];
  /** BO_0229_011 */
  attachments: BridgeAttachment[];
  /** The profile the run was guided by, from its record; null for none. BO_0298_031 */
  profile: { readonly id: string; readonly title: string } | null;
  /** What the run did, in the contract's own words. CA_0058_006 */
  events: RunEvent[];
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
      <div class="process-detail" data-process-id={detail.id} data-process-trigger={detail.trigger ?? "person"}>
        <p class="eyebrow">
          {/* A system process says so at a glance: a run an extension started,
              with its glyph, told apart from a person's run. BO_0245_010 */}
          {detail.trigger === "system" ? (
            <span data-process-system-label>
              <Icon name="sparkle" size={14} /> System
            </span>
          ) : (
            "Process"
          )}
        </p>
        <h3>{detail.title}</h3>
        <p data-process-state={detail.state}>{detail.state}</p>
        <p data-process-step>{detail.step ?? "no step reported"}</p>
        {/* The profile that guided the run, named where the run's detail is
            read and nowhere else; a press opens it. BO_0298_031 */}
        {proposed.processId === detail.id && proposed.profile !== null && (
          <p class="process-trigger" data-process-profile={proposed.profile.id}>
            {"Profile: "}
            <button
              type="button"
              data-process-profile-open
              onClick$={() =>
                openTarget$({
                  kind: DOCUMENT_KIND,
                  itemId: proposed.profile?.id ?? "",
                  title: proposed.profile?.title ?? "",
                })
              }
            >
              {proposed.profile.title}
            </button>
          </p>
        )}
        {/* A system run says which extension started it and after which
            change, and opens the document it proposes into. BO_0264_017 */}
        {detail.triggeredBy !== undefined && (
          <p class="process-trigger" data-process-triggered-by={detail.triggeredBy.extension}>
            {`Started by ${detail.triggeredBy.extension === "" ? "an extension" : detail.triggeredBy.extension} after the change at revision ${detail.triggeredBy.dataRevision}`}
            {detail.itemId !== null && detail.itemKind !== null && (
              <>
                {", in "}
                <button
                  type="button"
                  data-process-item
                  onClick$={() =>
                    openTarget$({
                      kind: detail.itemKind ?? DOCUMENT_KIND,
                      itemId: detail.itemId ?? "",
                      title: detail.itemLabel ?? detail.itemId ?? "",
                    })
                  }
                >
                  {detail.itemLabel ?? detail.itemId}
                </button>
              </>
            )}
            .
          </p>
        )}
        {detail.concluded !== undefined && detail.concluded !== "" && (
          <p class="process-concluded" data-process-concluded>
            {detail.concluded}
          </p>
        )}
        {detail.error !== null && (
          <p class="process-error" data-process-error>
            {detail.error}
          </p>
        )}
        {proposed.processId === detail.id && proposed.events.length > 0 && (
          <div class="run-activity" data-run-activity aria-label="Agent activity">
            <p class="eyebrow">Activity</p>
            <ol class="run-activity__list">
              {proposed.events.map((event, index) => (
                <li key={`${event.kind}-${index}`} data-run-event={event.kind}>
                  {describeRunEvent(event)}
                </li>
              ))}
            </ol>
          </div>
        )}
        {proposed.processId === detail.id && (
          <div class="proposed" data-proposed>
            <p class="eyebrow">Proposed</p>
            {proposed.documents.length === 0 ? (
              <p data-proposed-none>This run proposed nothing.</p>
            ) : (
              <ul class="proposed__list">
                {proposed.documents.map((document) => (
                  <li key={document.itemId}>
                    <button
                      type="button"
                      data-proposed-document={document.itemId}
                      onClick$={() =>
                        openTarget$({
                          kind: document.openKind,
                          itemId: document.itemId,
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
        {proposed.processId === detail.id && proposed.attachments.length > 0 && (
          <div class="proposed" data-process-attachments>
            <p class="eyebrow">Attached</p>
            <ul class="proposed__list">
              {proposed.attachments.map((attachment) => (
                <li key={attachment.id} data-process-attachment={attachment.filename}>
                  <a
                    href={`/api/attachments/${encodeURIComponent(attachment.id.replace(/^node:/u, ""))}/file?process=${encodeURIComponent(detail.id)}`}
                    download={attachment.filename}
                    data-attachment-open={attachment.id}
                  >
                    {attachment.filename}
                  </a>
                  <span data-attachment-delivered={attachment.delivered}>
                    {formatSize(attachment.size)} · {deliveredWords(attachment.delivered)}
                  </span>
                </li>
              ))}
            </ul>
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
          {actions.map((action) => (
            <ActionControl key={action.id} action={action} surface="inspector" />
          ))}
        </div>
      )}
    </div>
  );
});

/** Where a view's action is drawn. Each surface names its controls in its own
 * data attribute, so a test and a stylesheet can tell them apart. */
/** Where a named action is drawn. A block row is the third since `CA_0065_004`:
 * the shell contributes a control into a view's own row, and the view renders
 * it through the same control the inspector and the bar use, so a named action
 * reads the same wherever it lands. */
export type ActionSurface = "inspector" | "bar" | "block";

/**
 * One named action as the shell draws it, on every surface that shows one:
 * the inspector and the bar. One control, so a view's button reads
 * the same wherever it lands. An action with an icon shows the icon, its label
 * the accessible name and the tooltip; `name` says more than the label where
 * the view has more to say. CA_0053_002
 */
export const ActionControl = component$<{
  action: ViewAction;
  surface: ActionSurface;
}>(({ action, surface }) => {
  if (action.kind === "choice") {
    return <ChoiceControl action={action} surface={surface} />;
  }
  if (action.kind === "popover") {
    return <PopoverControl action={action} surface={surface} />;
  }
  // Every attribute set unconditionally: a spread makes the optimizer emit a
  // key twice (`BO_0225`).
  const inspectorId = surface === "inspector" ? action.id : undefined;
  const barId = surface === "bar" ? action.id : undefined;
  const blockId = surface === "block" ? action.id : undefined;
  if (action.kind === "field") {
    const controlId = `${surface}-field-${action.id}`;
    return (
      <span class="field-control" data-field={action.id}>
        <label for={controlId}>{action.label}</label>
        <input
          id={controlId}
          data-inspector-action={inspectorId}
          data-bar-action={barId}
          data-block-action={blockId}
          type={action.type ?? "text"}
          value={action.value}
          onInput$={(_, element) => action.input$(element.value)}
          onKeyDown$={(event) => {
            if (event.key === "Enter") void action.submit$();
          }}
        />
        <button
          type="button"
          data-field-submit={action.id}
          onClick$={() => action.submit$()}
        >
          {action.submitLabel}
        </button>
      </span>
    );
  }
  const icon = action.icon;
  const name = action.name ?? (icon !== undefined ? action.label : undefined);
  const keeps = action.keepsSelection === true;
  if (action.kind === "toggle") {
    return (
      <button
        type="button"
        class={{ "action-control": true, "action-control--icon": icon !== undefined }}
        data-inspector-action={inspectorId}
        data-bar-action={barId}
        data-block-action={blockId}
        aria-pressed={action.on}
        aria-label={name}
        title={icon !== undefined ? action.label : ""}
        // Keeping focus in the text is what keeps the selection alive: a
        // button that took focus would collapse the range it acts on.
        preventdefault:mousedown={keeps}
        onClick$={() => action.run$(!action.on)}
      >
        {icon !== undefined ? <Icon name={icon} /> : action.label}
      </button>
    );
  }
  return (
    <button
      type="button"
      class={{ "action-control": true, "action-control--icon": icon !== undefined }}
      data-inspector-action={inspectorId}
      data-bar-action={barId}
      data-block-action={blockId}
      data-destructive={action.destructive === true ? "" : undefined}
      aria-label={name}
      title={icon !== undefined ? action.label : ""}
      disabled={action.disabled === true}
      preventdefault:mousedown={keeps}
      onClick$={() => action.run$()}
    >
      {icon !== undefined ? <Icon name={icon} /> : action.label}
    </button>
  );
});

/**
 * A choice action as the shell renders it: a label, the icon that stands for
 * the current value when the options name one, and a native select. The view
 * supplies the words and what choosing does; the shell knows how to draw a
 * select and nothing about what a status is. BO_0222_007
 *
 * On the bar a choice whose current option names an icon is that icon alone,
 * with the action's label as the select's accessible name — the rule a button
 * and a toggle already follow there, where room is what the bar has least of.
 * The inspector draws the label whatever the options carry, and a choice
 * whose options name no icon keeps its label on both surfaces, so a change
 * document's status control is unchanged. The contract gains no field: the
 * surface decides, as it does for the control ids. DO_0010_009
 */
export const ChoiceControl = component$<{
  action: Extract<ViewAction, { kind: "choice" }>;
  surface: ActionSurface;
}>(({ action, surface }) => {
  const current = action.options.find(
    (option) => option.value === action.value,
  );
  const controlId = `${surface}-choice-${action.id}`;
  const iconOnly = surface === "bar" && current?.icon !== undefined;
  return (
    <label
      class={{ "choice-control": true, "choice-control--icon": iconOnly }}
      for={controlId}
      data-choice={action.id}
      title={iconOnly ? action.label : ""}
    >
      {!iconOnly && <span class="choice-control__label">{action.label}</span>}
      {current?.icon !== undefined && <Icon name={current.icon} />}
      {iconOnly && (
        <span class="choice-control__caret" aria-hidden="true">
          <Icon name="caret-down" size={12} />
        </span>
      )}
      <select
        id={controlId}
        data-inspector-action={surface === "inspector" ? action.id : undefined}
        data-bar-action={surface === "bar" ? action.id : undefined}
        aria-label={iconOnly ? action.label : undefined}
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
 * Where a popover's panel stands: under the control that opened it, aligned
 * to its leading edge, and pulled back inside the viewport when the panel is
 * wider than the room to its right. Pure, so the rule is pressed without a
 * browser. DO_0010_010
 */
export const placePopover = (
  anchor: { top: number; left: number; bottom: number },
  width: number,
  viewport: { width: number; height: number },
): { top: number; left: number } => ({
  top: anchor.bottom + POPOVER_GAP,
  left: Math.max(
    POPOVER_MARGIN,
    Math.min(anchor.left, viewport.width - width - POPOVER_MARGIN),
  ),
});

/** The air between the control and its panel, and between the panel and the
 * viewport's edge: the numbers the stylesheet used while the panel hung from
 * the control. */
const POPOVER_GAP = 5.6;
const POPOVER_MARGIN = 16;

/**
 * A control that opens a panel of the view's own words beside it, on the bar
 * and in the inspector alike: the shell draws the control, the panel and the
 * keyboard, and knows nothing of what is said. Open state is this control's
 * own, so nothing above it re-renders when the panel opens — the rule the
 * bar and the inspector are separate components for. BO_0272_014
 *
 * The panel is drawn out of the flow it was opened from. An absolutely
 * positioned panel is clipped by `.view-bar`, which is one bar-height tall
 * and scrolls sideways, and capped by its stacking context besides, so on
 * the bar the reader saw nothing. It is `position: fixed`, placed from the
 * control's own box on each open and on each scroll or resize, which escapes
 * the clip because a fixed box's containing block is the viewport; and it
 * asks for the platform's top layer (`showPopover`), which escapes every
 * stacking context. The top layer is asked for and not relied on: where it
 * is absent the fixed placement alone is what the reader sees. DO_0010_010
 */
export const PopoverControl = component$<{
  action: Extract<ViewAction, { kind: "popover" }>;
  surface: ActionSurface;
}>(({ action, surface }) => {
  const open = useSignal(false);
  const host = useSignal<HTMLElement>();
  const panel = useSignal<HTMLElement>();
  // Where the panel stands, in viewport coordinates: read from the control,
  // never guessed, so it follows a bar that has been scrolled sideways.
  const at = useStore({ top: 0, left: 0 });
  const controlId = `${surface}-popover-${action.id}`;
  const panelId = `${controlId}-panel`;
  // A body of the view's own, drawn in place of the lines; it closes the
  // panel through this, which gives the control back the focus it took.
  const Body = action.body?.component;
  const close$ = $(() => {
    open.value = false;
    host.value?.querySelector<HTMLElement>("button")?.focus();
  });
  // The viewport is the panel's own document's, never a global: the render
  // harness draws into a document with no window, and a measurement taken
  // from the element is the one that is true of where it stands.
  const place$ = $(() => {
    const button = host.value?.querySelector<HTMLElement>("button");
    const box = panel.value;
    const view = box?.ownerDocument.defaultView;
    if (button == null || box == null || view == null) return;
    // A document that does not lay anything out — the render harness's —
    // measures nothing, and there is nothing to place.
    if (typeof button.getBoundingClientRect !== "function") return;
    const placed = placePopover(button.getBoundingClientRect(), box.offsetWidth, {
      width: view.innerWidth,
      height: view.innerHeight,
    });
    at.top = placed.top;
    at.left = placed.left;
  });
  // The panel is measured from the drawn control, which is what a visible
  // task is for. It asks for the top layer once it is in the DOM: a browser
  // without one draws it as an ordinary fixed box, which is already outside
  // the bar's clip.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    track(() => open.value);
    const box = panel.value;
    if (!open.value || box == null) return;
    if (typeof box.showPopover === "function") box.showPopover();
    void place$();
    const view = box.ownerDocument.defaultView;
    if (view == null) return;
    const again = (): void => {
      void place$();
    };
    // A scroll anywhere can move the control — the bar scrolls sideways and
    // the workspace scrolls under it — so the listener is on the capture
    // phase, where a scroll on any element is heard.
    view.addEventListener("scroll", again, true);
    view.addEventListener("resize", again);
    cleanup(() => {
      view.removeEventListener("scroll", again, true);
      view.removeEventListener("resize", again);
    });
  });
  // A press anywhere outside closes it, as a menu does; Escape closes it and
  // gives the control back the focus it took.
  useOnDocument(
    "pointerdown",
    $((event: Event) => {
      if (!open.value) return;
      const target = event.target;
      if (target instanceof Node && host.value?.contains(target) === true)
        return;
      open.value = false;
    }),
  );
  return (
    <span
      class="popover-control"
      data-popover={action.id}
      ref={host}
      // Escape closes it and gives the control back the focus it took. The
      // handler sits on the wrapper because focus is inside it whenever the
      // panel is open — on the control that opened it, or in the panel.
      onKeyDown$={(event: KeyboardEvent) => {
        if (!open.value || event.key !== "Escape") return;
        open.value = false;
        host.value?.querySelector<HTMLElement>("button")?.focus();
      }}
    >
      <button
        type="button"
        id={controlId}
        data-inspector-action={surface === "inspector" ? action.id : undefined}
        data-bar-action={surface === "bar" ? action.id : undefined}
        aria-label={action.name ?? action.label}
        aria-expanded={open.value ? "true" : "false"}
        aria-controls={panelId}
        title={action.label}
        onClick$={() => {
          open.value = !open.value;
        }}
      >
        {action.icon !== undefined ? (
          <Icon name={action.icon} />
        ) : (
          action.label
        )}
      </button>
      {open.value && (
        <div
          ref={panel}
          class="popover-control__panel"
          id={panelId}
          role="group"
          data-popover-panel={action.id}
          aria-labelledby={controlId}
          // Manual, not auto: the control's own Escape and press-outside
          // already close it and give the focus back, and an auto popover
          // would close itself on the same press without doing either.
          popover="manual"
          style={{ top: `${at.top}px`, left: `${at.left}px` }}
        >
          {action.heading !== undefined && (
            <p class="popover-control__heading">{action.heading}</p>
          )}
          {Body !== undefined ? (
            <Body {...(action.body?.props ?? {})} close$={close$} />
          ) : (
            <dl>
              {(action.lines ?? []).map((line, index) => (
                <div key={line.term ?? String(index)}>
                  {line.term !== undefined && <dt>{line.term}</dt>}
                  <dd>{line.text}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </span>
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
