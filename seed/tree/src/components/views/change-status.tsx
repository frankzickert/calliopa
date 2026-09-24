import { $, component$, useSignal, useStore, useVisibleTask$ } from "@builder.io/qwik";
import { CHANGE_STATUSES, isChangeStatus } from "~/lib/library";

/**
 * A change document's status, on the change's own tab.
 *
 * It writes nothing. Choosing a status asks the kernel to stage the one-line
 * edit to the document's `Status:` line and to ask for its acceptance at
 * once; the tab shows the kernel's confirmation link, and the person's
 * confirmation there is what establishes it — so `BO_0254`'s rule that a
 * status is *set by accepting the proposal that changes it* is kept, and the
 * change document's body stays read-only as that change left it.
 *
 * A document has one waiting move. It is read from the extension's staged
 * groups when the tab opens, so it survives a reload, and a new choice
 * replaces it — choosing the status the document reads withdraws it.
 *
 * It lives here rather than on the library row: a status belongs to the
 * change you are reading, not to a line in a tree of every change there is.
 * User decision, 2026-09-23. BO_0282_009 BO_0297_007 BO_0297_008
 */

interface WaitingMove {
  group: string;
  to: string;
}

interface StatusState {
  waiting: WaitingMove | null;
  busy: boolean;
  refusal: string;
  note: string;
  confirmUrl: string;
}

/** changeStatusOf reads the status out of the rendered change's facts. */
export function changeStatusOf(facts: readonly { label: string; value: string }[]): string {
  return facts.find((fact) => fact.label === "Status")?.value ?? "";
}

/** isChangeDocumentPath recognises a change document by the path convention. */
export function isChangeDocumentPath(path: string | undefined): boolean {
  return path !== undefined && path.includes("docs/changes/") && path.endsWith(".md");
}

/** waitingMoveOf finds the change's waiting move among the extension's groups. */
export function waitingMoveOf(
  groups: readonly { group: string; statusMove?: { path: string; to: string } }[],
  path: string,
): WaitingMove | null {
  const found = groups.find((group) => group.statusMove?.path === path);
  return found?.statusMove === undefined ? null : { group: found.group, to: found.statusMove.to };
}

export const ChangeStatus = component$<{
  extension: string;
  path: string;
  status: string;
}>((props) => {
  const state = useStore<StatusState>({
    waiting: null,
    busy: false,
    refusal: "",
    note: "",
    confirmUrl: "",
  });
  const control = useSignal<HTMLSelectElement>();

  const api = `/api/x/ui.shell/extensions`;

  useVisibleTask$(() => {
    const read = async () => {
      try {
        const response = await fetch(`${api}/${encodeURIComponent(props.extension)}/groups`);
        if (!response.ok) return;
        const answer = (await response.json()) as {
          groups?: { group: string; statusMove?: { path: string; to: string } }[];
        };
        state.waiting = waitingMoveOf(answer.groups ?? [], props.path);
      } catch {
        // The waiting move is an affordance; the control works without it.
      }
    };
    // Handed off rather than awaited in the task: a task that holds its
    // await chain holds the render flush open under it.
    setTimeout(() => void read(), 0);
  });

  const move$ = $(async (status: string) => {
    state.busy = true;
    state.refusal = "";
    state.note = "";
    state.confirmUrl = "";
    try {
      const response = await fetch(
        `${api}/${encodeURIComponent(props.extension)}/change-status`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path: props.path, status }),
        },
      );
      const answer = (await response.json()) as {
        message?: string;
        changed?: boolean;
        group?: string;
        confirmUrl?: string;
        replaced?: string[];
      };
      if (!response.ok) {
        state.refusal = answer.message ?? `the kernel answered ${response.status}`;
        // The control goes back to what it showed, so it never shows a
        // choice the kernel did not take.
        if (control.value !== undefined) control.value.value = state.waiting?.to ?? props.status;
        return;
      }
      if (answer.changed !== true || answer.group === undefined) {
        const withdrew = (answer.replaced ?? []).length > 0;
        state.waiting = null;
        state.note = withdrew
          ? `It stays ${status}; the waiting move was withdrawn.`
          : `It already reads ${status}.`;
        return;
      }
      state.waiting = { group: answer.group, to: status };
      state.confirmUrl = answer.confirmUrl ?? "";
    } catch (error) {
      state.refusal = String(error);
      if (control.value !== undefined) control.value.value = state.waiting?.to ?? props.status;
    } finally {
      state.busy = false;
    }
  });

  // A move read on opening the tab has no address yet: the confirmation is
  // asked for again, as the staged-changes list asks for it. BO_0297_008
  const ask$ = $(async () => {
    const group = state.waiting?.group ?? "";
    state.busy = true;
    state.refusal = "";
    try {
      const response = await fetch(`${api}/group/${encodeURIComponent(group)}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const answer = (await response.json()) as { message?: string; confirmUrl?: string };
      if (!response.ok) {
        state.refusal = answer.message ?? `the kernel answered ${response.status}`;
        return;
      }
      state.confirmUrl = answer.confirmUrl ?? "";
    } catch (error) {
      state.refusal = String(error);
    } finally {
      state.busy = false;
    }
  });

  // The control shows the waiting move's target, so choosing the status the
  // document reads is a change that withdraws it; the note always says what
  // the document reads.
  const shown = state.waiting?.to ?? props.status;
  return (
    <div class="change-status" data-change-status-control>
      <label class="change-status__label">
        <span class="change-status__name">Status</span>
        <select
          ref={control}
          class="change-status__choice"
          disabled={state.busy}
          value={shown}
          data-status-waiting={state.waiting === null ? undefined : state.waiting.to}
          onChange$={async (_, element) => {
            const chosen = element.value;
            // Awaited rather than fired and forgotten: the tab shows what the
            // kernel answered, and a handler that returns before the answer
            // shows nothing at all.
            if (isChangeStatus(chosen)) await move$(chosen);
          }}
        >
          {CHANGE_STATUSES.map((status) => (
            <option key={status} value={status} selected={status === shown}>
              {status}
            </option>
          ))}
        </select>
      </label>
      {state.waiting !== null && (
        <p class="change-status__note" role="status" data-status-staged>
          It reads {props.status}, and reads {state.waiting.to} once you confirm the move on the
          kernel's page
          {state.confirmUrl !== "" ? (
            <>
              :{" "}
              <a href={state.confirmUrl} rel="noreferrer" data-status-confirm>
                open the confirmation
              </a>
              .
            </>
          ) : (
            <>
              .{" "}
              <button
                type="button"
                class="change-status__ask"
                disabled={state.busy}
                data-status-ask
                onClick$={ask$}
              >
                Confirm the move
              </button>
            </>
          )}
        </p>
      )}
      {state.waiting === null && state.note !== "" && (
        <p class="change-status__note" role="status" data-status-note>
          {state.note}
        </p>
      )}
      {state.refusal !== "" && (
        <p class="change-status__refusal" role="alert" data-status-refusal>
          {state.refusal}
        </p>
      )}
    </div>
  );
});
