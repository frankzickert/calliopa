import { $, component$, useStore, useVisibleTask$ } from "@builder.io/qwik";

import type { BlockDecorationProps } from "~/contract";

import type { FormatChoices } from "../../lib/variations";
import "./variation.css";

/** The option the choice sets on the command, which the kernel hands a
 * generation unread (`calliopa-bootstrap`'s `BO_0336_001`). */
export const VARIATION_OPTION = "variation";

/**
 * The variation chosen beside *Send* (`calliopa-bootstrap`'s `BO_0336_023`):
 * when the instruction the chip chose names a format with variations, the format
 * itself and each of its variations, by title. A choice is set on the command
 * for one send, so after *Send* it shows the format again and a costlier
 * variation is never spent again by surprise. Nothing is drawn while no
 * instruction is chosen, its format has no variations, or they cannot be read.
 */
export const VariationChoice = component$<BlockDecorationProps>(({ commandOptions, setOption$ }) => {
  const state = useStore<{ instruction: string; choices: FormatChoices }>({ instruction: "", choices: { format: null, variations: [] } });

  // eslint-disable-next-line qwik/no-use-visible-task -- read in the browser with the person's session, as the chip's choice changes
  useVisibleTask$(async ({ track }) => {
    const instruction = track(() => commandOptions?.["instruction"] ?? "");
    if (instruction === state.instruction) return;
    state.instruction = instruction;
    const response = instruction === "" ? null : await fetch(`/api/x/media/variations?instruction=${encodeURIComponent(instruction)}`).catch(() => null);
    const read = response !== null && response.ok ? ((await response.json().catch(() => null)) as FormatChoices | null) : null;
    state.choices = read ?? { format: null, variations: [] };
    // A variation of another instruction's format goes with that instruction.
    const held = commandOptions?.[VARIATION_OPTION];
    if (held !== undefined && !state.choices.variations.some((one) => one.id === held) && setOption$ !== undefined) {
      await setOption$(VARIATION_OPTION, null);
    }
  });

  const choose$ = $(async (variation: string) => {
    if (setOption$ !== undefined) await setOption$(VARIATION_OPTION, variation === "" ? null : variation, true);
  });

  const { format, variations } = state.choices;
  const chosen = commandOptions?.[VARIATION_OPTION] ?? "";
  // A host that takes no room in the chip's line, so the choice has an
  // element to be read from while nothing is drawn in it.
  return (
    <span class="media-variation-host" data-media-variation-host>
      {format !== null && variations.length > 0 && (
        <label class="media-variation" data-media-variation title={`Make it as ${format.title} or one of its variations`}>
          <span class="visually-hidden">Variation</span>
          <select class="media-variation__select" data-media-variation-select onChange$={(_, element) => choose$(element.value)}>
            <option value="" selected={chosen === ""} data-media-variation-option="">
              {format.title}
            </option>
            {variations.map((one) => (
              <option key={one.id} value={one.id} selected={chosen === one.id} data-media-variation-option={one.id}>
                {one.title}
              </option>
            ))}
          </select>
        </label>
      )}
    </span>
  );
});
