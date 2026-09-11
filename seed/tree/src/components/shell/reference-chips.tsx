import { component$, type QRL } from "@builder.io/qwik";

import {
  revealTarget,
  type Pointing,
  type RevealTarget,
} from "~/lib/command-target";
import { chipName, pinnedChipName } from "~/lib/pointing";
import { Icon } from "./icons";

/**
 * What the command carries, along the field's bottom edge: one chip per
 * reference in mark order, then one per pinned block. CA_0039_003
 *
 * Built from the view's report, the value `commandTarget` builds the body
 * from, so what the bar shows and what is sent cannot differ; a pinned block
 * is shown and never sent. A chip shows its number and says its words in its
 * name. Pressing one asks the document's view to show its area; a chip carries
 * no × and no +, because a reference is taken back where it was marked, in the
 * document, which stays the list.
 *
 * It takes the report itself, never `.references` of it: a prop written as
 * `object.field` stays reactive only when the object is a store, and before
 * anything is marked the report is the plain `NO_POINTING`
 * (`qwik-member-props-freeze`).
 */
export const ReferenceChips = component$<{
  pointing: Pointing;
  onReveal$: QRL<(target: RevealTarget) => void>;
}>(({ pointing, onReveal$ }) => {
  if (pointing.references.length === 0 && pointing.pinned.length === 0) {
    return null;
  }
  return (
    <ul class="composer__chips" data-chips aria-label="What the command carries">
      {pointing.references.map((reference) => (
        <li key={`reference-${reference.number}`}>
          <button
            type="button"
            class="chip"
            data-chip={reference.number}
            data-stale={reference.stale ? "true" : "false"}
            aria-label={chipName(reference)}
            onClick$={() => onReveal$(revealTarget(reference))}
          >
            {reference.stale && <Icon name="warning" />}#{reference.number}
          </button>
        </li>
      ))}
      {pointing.pinned.map((pinned) => (
        <li key={`pinned-${pinned.blockId}`}>
          <button
            type="button"
            class="chip chip--pinned"
            data-chip-pinned={pinned.blockId}
            aria-label={pinnedChipName(pinned)}
            onClick$={() => onReveal$(revealTarget(pinned))}
          >
            <Icon name="push-pin" />
          </button>
        </li>
      ))}
    </ul>
  );
});
