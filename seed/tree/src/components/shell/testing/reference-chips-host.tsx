import { component$, useStore } from "@builder.io/qwik";

import { NO_POINTING, type Pointing, type RevealTarget } from "~/lib/command-target";
import { ReferenceChips } from "../reference-chips";

/**
 * The chips of what a command carries, wired in real JSX the way a block's
 * command control wires them (`command-control.tsx`), over a report that is
 * the plain `NO_POINTING` until the first one arrives and the store's object
 * after, and a reveal the host shows for a test to read. Test support,
 * imported by `reference-chips.test.ts` and nothing that ships. CA_0039_003
 * BO_0267_012
 */
export const ReferenceChipsHost = component$<{ report: Pointing }>(({ report }) => {
  const held = useStore<{ pointing: Pointing }>({ pointing: NO_POINTING });
  const reveal = useStore<{ target: RevealTarget | null; seq: number }>({ target: null, seq: 0 });
  return (
    <div>
      <ReferenceChips
        pointing={held.pointing}
        onReveal$={(target: RevealTarget) => {
          reveal.target = target;
          reveal.seq += 1;
        }}
      />
      <button
        type="button"
        data-report
        onClick$={() => {
          held.pointing = report;
        }}
      >
        report
      </button>
      <output data-reveal>{JSON.stringify({ target: reveal.target, seq: reveal.seq })}</output>
    </div>
  );
});
