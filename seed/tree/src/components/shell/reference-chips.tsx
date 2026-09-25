import { component$, type QRL } from "@builder.io/qwik";

import {
  revealTarget,
  type Pointing,
  type RevealTarget,
} from "~/lib/command-target";
import { chipName, fixatedChipName, takeBackName } from "~/lib/command-target";
import { Icon } from "./icons";

/**
 * What the command carries, along the field's bottom edge: one chip per
 * reference in mark order, then one per fixated block. CA_0039_003
 *
 * Built from the view's report, the value `commandTarget` builds the body
 * from, so what the bar shows and what is sent cannot differ; a fixated block
 * is shown and never sent. A chip shows its number and says its words in its
 * name. Pressing one asks the document's view to show its area; a chip carries
 * no × and no +, because a reference is taken back where it was marked, in the
 * document, which stays the list — except a rowless one, whose row has gone:
 * its × asks the view to take it back (BO_0263_007). A reference that is not
 * simply a block of the document says what it is in a word beside its number
 * — proposed, retired, discarded — so the kind never rests on colour.
 *
 * It takes the report itself, never `.references` of it: a prop written as
 * `object.field` stays reactive only when the object is a store, and before
 * anything is marked the report is the plain `NO_POINTING`
 * (`qwik-member-props-freeze`).
 */
/** The word a chip carries beside its number. BO_0263_007 */
const WHAT = { proposal: "proposed", retired: "retired", discarded: "discarded" } as const;

export const ReferenceChips = component$<{
  pointing: Pointing;
  onReveal$: QRL<(target: RevealTarget) => void>;
}>(({ pointing, onReveal$ }) => {
  if (pointing.references.length === 0 && pointing.fixated.length === 0) {
    return null;
  }
  return (
    <ul class="composer__chips" data-chips aria-label="What the command carries">
      {pointing.references.map((reference) => {
        const chip = (
          <button
            type="button"
            class="chip"
            data-chip={reference.number}
            data-stale={reference.stale ? "true" : "false"}
            data-chip-what={reference.what}
            data-chip-since={reference.since}
            aria-label={chipName(reference)}
            onClick$={() => {
              if (reference.rowless !== true) void onReveal$(revealTarget(reference));
            }}
          >
            {reference.stale && <Icon name="warning" />}#{reference.number}
            {reference.what !== undefined && <span class="chip__meta">{WHAT[reference.what]}</span>}
            {/* Where it points when that is another document, by that
                document's title (`BO_0304_Q4`); a document marked whole by
                its title alone. BO_0304_013 */}
            {(reference.kind === "document" || reference.document !== undefined) && (
              <span class="chip__meta chip__document" data-chip-document={reference.document}>
                {reference.documentTitle ?? reference.document}
              </span>
            )}
          </button>
        );
        return (
          <li key={`reference-${reference.number}`}>
            {reference.rowless === true ? (
              <span class="chip-group" data-chip-rowless={reference.number}>
                {chip}
                <button
                  type="button"
                  class="chip__remove"
                  data-chip-take-back={reference.number}
                  aria-label={takeBackName(reference)}
                  onClick$={() => onReveal$({ kind: "takeBack", number: reference.number })}
                >
                  <Icon name="x" />
                </button>
              </span>
            ) : (
              chip
            )}
          </li>
        );
      })}
      {pointing.fixated.map((fixated) => (
        <li key={`fixated-${fixated.blockId}`}>
          <button
            type="button"
            class="chip chip--fixated"
            data-chip-fixated={fixated.blockId}
            aria-label={fixatedChipName(fixated)}
            onClick$={() => onReveal$(revealTarget(fixated))}
          >
            <Icon name="push-pin" />
          </button>
        </li>
      ))}
    </ul>
  );
});
