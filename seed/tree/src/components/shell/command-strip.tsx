import { component$, type QRL } from "@builder.io/qwik";

import type { Delivery } from "~/lib/command-target";
import { ChoiceControl } from "./inspector";
import type { ViewDock } from "./view-bridge";

/**
 * The thin line right above the bar: the active view's contributed action,
 * then where the command's work goes. CA_0039_001
 *
 * The dock's action area lives here rather than beside it, so the dock still
 * renders the view's one action — for a document, the Command mode toggle —
 * and it rides with the composer, gone at the collapsed handle. On a document
 * the line names it, grayed, with a × that asks for words instead of a
 * proposal; the line then reads *Answer in the console* and the title brings
 * the proposal back. The choice is the reader's, kept as `DeliveryChoice`
 * keeps it, and the run never infers it from the command's words (`BO_0226`).
 * On a tab that is not a document there is no title and no ×, and a view that
 * contributes nothing there leaves no line at all.
 */
export const CommandStrip = component$<{
  dock: ViewDock;
  title: string | null;
  delivery: Delivery;
  onDelivery$: QRL<(delivery: Delivery) => void>;
}>(({ dock, title, delivery, onDelivery$ }) => {
  const action = dock.action;
  if (action === null && title === null) return null;
  return (
    <div
      class="command-strip"
      data-command-strip
      role="group"
      aria-label={title === null ? "View commands" : `Command aimed at ${title}`}
    >
      {action !== null && (
        <div class="dock-actions" aria-label="View commands">
          {action.kind === "toggle" ? (
            <button
              type="button"
              data-dock-action={action.id}
              aria-pressed={action.on}
              onClick$={() => action.run$(!action.on)}
            >
              {action.label}
            </button>
          ) : action.kind === "choice" ? (
            <ChoiceControl action={action} surface="dock" />
          ) : (
            <button
              type="button"
              data-dock-action={action.id}
              data-destructive={action.destructive === true ? "" : undefined}
              onClick$={() => action.run$()}
            >
              {action.label}
            </button>
          )}
        </div>
      )}
      {title !== null &&
        (delivery === "propose" ? (
          <>
            <span class="command-strip__title" data-aim-title>
              {title}
            </span>
            <button
              type="button"
              class="command-strip__dismiss"
              data-aim-dismiss
              aria-label={`Answer in the console instead of proposing into ${title}`}
              onClick$={() => onDelivery$("answer")}
            >
              ×
            </button>
          </>
        ) : (
          <>
            <span class="command-strip__answer" data-aim-answer>
              Answer in the console
            </span>
            <button
              type="button"
              class="command-strip__title"
              data-aim-restore
              aria-label={`Propose into ${title}`}
              onClick$={() => onDelivery$("propose")}
            >
              {title}
            </button>
          </>
        ))}
    </div>
  );
});
