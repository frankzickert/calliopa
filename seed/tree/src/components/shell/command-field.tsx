import { $, component$, useSignal } from "@builder.io/qwik";

import type { Pointing } from "~/lib/command-target";
import {
  insertReference,
  pendingReference,
  referenceMatches,
  type PendingReference,
} from "~/lib/command-typeahead";

/**
 * The composer's field, which offers the open document's references when the
 * reader types `#`. BO_0227_015
 *
 * The textarea stays uncontrolled — `sendGoal$` reads it at the press, as it
 * always has — so re-rendering the offer never touches what was typed. The
 * offer is a list of buttons that opens above the field, since the field's
 * bottom edge holds the command's chips (`CA_0039_002`): reached by pointer
 * and touch, and by `Shift`+`Tab` from the field, without a key handler racing
 * the textarea's own Enter (`qwik-preventdefault-is-lazy`). Choosing one
 * writes `#<number>` where the reader was typing. Typing a number creates
 * nothing.
 *
 * It takes the report, not its `.references`: the optimizer compiles a prop
 * written as `object.field` through `_wrapProp`, which stays reactive only when
 * the object is a store, and before anything is marked the shell's report is
 * the plain `NO_POINTING` — so `.references` was taken once, empty, and kept.
 */
/** How tall the field grows before it scrolls, matching its CSS bound. */
const FIELD_MAX_PX = 160;

/**
 * Grows the field with its text up to a bound, after which it scrolls, and
 * shrinks it again when text goes; an empty field is one line tall. Measured
 * rather than left to `field-sizing`, which not every browser has.
 * CA_0039_002
 */
export function fitField(element: HTMLTextAreaElement): void {
  element.style.height = "";
  if (!(element.scrollHeight > 0) || element.value === "") return;
  element.style.height = `${Math.min(element.scrollHeight, FIELD_MAX_PX)}px`;
}

export const CommandField = component$<{
  pointing: Pointing;
}>(({ pointing }) => {
  const field = useSignal<HTMLTextAreaElement>();
  const pending = useSignal<PendingReference | null>(null);
  const caret = useSignal(0);

  const choose$ = $((number: number) => {
    const element = field.value;
    const at = pending.value;
    if (element === undefined || at === null) return;
    const next = insertReference(element.value, at, caret.value, number);
    element.value = next.text;
    element.focus();
    element.setSelectionRange(next.caret, next.caret);
    pending.value = null;
  });

  const matches =
    pending.value === null
      ? []
      : referenceMatches(pointing.references, pending.value.typed);

  return (
    <>
      {matches.length > 0 && (
        <ul class="composer__references" aria-label="Name a reference">
          {matches.map((reference) => (
            <li key={reference.number}>
              <button
                type="button"
                data-reference-option={reference.number}
                onClick$={() => choose$(reference.number)}
              >
                <span class="composer__number">#{reference.number}</span>
                <q>{reference.words}</q>
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        id="command"
        ref={field}
        rows={1}
        placeholder="Ask Calliopa or add context"
        onInput$={(_, element) => {
          fitField(element);
          caret.value = element.selectionStart;
          pending.value = pendingReference(
            element.value,
            element.selectionStart,
          );
        }}
        onKeyUp$={(event, element) => {
          if (event.key === "Escape") pending.value = null;
          else caret.value = element.selectionStart;
        }}
      />
    </>
  );
});
