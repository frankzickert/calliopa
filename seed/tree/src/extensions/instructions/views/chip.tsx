import { $, component$, useStore, useVisibleTask$ } from "@builder.io/qwik";

import { Icon } from "~/components/shell/icons";
import type { BlockDecorationProps } from "~/contract";

import { orderedChoices, INSTRUCTION_OPTION, NO_INSTRUCTION_OPTION, type InstructionChoice, type InstructionChoices } from "../lib/instructions";
import "./instructions.css";

/**
 * The instruction in the command chip (`calliopa-bootstrap`'s `BO_0311_011`): a
 * compass in the chip of the block being edited, opening *No instruction* and
 * every instruction by title — those carrying a role the block or its document
 * takes first. The choice is the command's: it sets the command's `instruction`
 * option, which *Send* carries, and nothing is written on the document
 * (`BO_0308_Q7`). A command that carries a choice keeps it when the chip is
 * drawn again, *No instruction* too (`PF_0001_001`); one carrying none starts
 * with the instruction the person last sent with in this document, which the
 * kernel keeps for that person alone; a instruction document's own chip starts
 * at *No instruction* (`BO_0298_Q9`). Nothing is drawn while the instructions
 * cannot be read or the instance has none.
 */

export const InstructionChip = component$<BlockDecorationProps>(({ documentId, blockId, commandOptions, setOption$ }) => {
  const state = useStore<{ loaded: boolean; choices: InstructionChoices | null; chosen: string | null; open: boolean }>({
    loaded: false,
    choices: null,
    chosen: null,
    open: false,
  });

  const choose$ = $(async (instruction: string | null) => {
    state.chosen = instruction;
    state.open = false;
    if (setOption$ === undefined) return;
    await setOption$(INSTRUCTION_OPTION, instruction);
    await setOption$(NO_INSTRUCTION_OPTION, instruction === null ? "chosen" : null);
  });

  // eslint-disable-next-line qwik/no-use-visible-task -- read in the browser with the person's session, once the chip is shown
  useVisibleTask$(async ({ track }) => {
    const document = track(() => documentId);
    const block = track(() => blockId);
    const response = await fetch(`/api/x/instructions/documents/${encodeURIComponent(document)}/blocks/${encodeURIComponent(block)}/choices`).catch(() => null);
    const choices = response !== null && response.ok ? ((await response.json().catch(() => null)) as InstructionChoices | null) : null;
    state.choices = choices;
    state.loaded = true;
    // A command that carries a choice keeps it; only one carrying none starts
    // with the person's last, while it is still an instruction.
    const held = commandOptions?.[INSTRUCTION_OPTION];
    if (held !== undefined) {
      state.chosen = held;
      return;
    }
    if (commandOptions?.[NO_INSTRUCTION_OPTION] !== undefined) return;
    const last = choices?.last ?? null;
    if (last !== null && choices?.instructions.some((instruction) => instruction.id === last) === true) await choose$(last);
  });

  const choices = state.choices;
  if (!state.loaded || choices === null || !choices.reachable || choices.instructions.length === 0) return null;
  const ordered = orderedChoices(choices.instructions);
  const chosen: InstructionChoice | undefined = ordered.find((instruction) => instruction.id === state.chosen);
  const name = chosen === undefined ? "No instruction" : `Instruction: ${chosen.title}`;
  const matching = ordered.filter((instruction) => instruction.matches);
  const rest = ordered.filter((instruction) => !instruction.matches);
  const option = (instruction: InstructionChoice) => (
    <li key={instruction.id}>
      <button
        type="button"
        class="instruction-chip__option"
        data-instruction-option={instruction.id}
        aria-pressed={state.chosen === instruction.id ? "true" : "false"}
        preventdefault:mousedown
        onClick$={() => choose$(instruction.id)}
      >
        {instruction.title.trim() === "" ? "Untitled instruction" : instruction.title}
      </button>
    </li>
  );
  return (
    <span class="instruction-chip" data-instruction-chip data-chosen={chosen === undefined ? undefined : chosen.id} stoppropagation:click>
      <button
        type="button"
        class="instruction-chip__toggle"
        aria-label={name}
        title={name}
        aria-expanded={state.open ? "true" : "false"}
        data-instruction-toggle
        // Keeps the caret where it is: the block stays edited while the
        // chip's control is pressed.
        preventdefault:mousedown
        onClick$={() => {
          state.open = !state.open;
        }}
      >
        <Icon name="compass" />
      </button>
      {state.open && (
        <div class="instruction-chip__popover" role="dialog" aria-label="Instruction for this command" data-instruction-popover stoppropagation:keydown>
          <ul class="instruction-chip__options">
            <li>
              <button
                type="button"
                class="instruction-chip__option"
                data-instruction-option=""
                aria-pressed={chosen === undefined ? "true" : "false"}
                preventdefault:mousedown
                onClick$={() => choose$(null)}
              >
                No instruction
              </button>
            </li>
          </ul>
          {matching.length > 0 && (
            <>
              <span class="instruction-chip__heading">For this block's structures</span>
              <ul class="instruction-chip__options" data-instruction-matching>
                {matching.map(option)}
              </ul>
            </>
          )}
          {rest.length > 0 && (
            <>
              {matching.length > 0 && <span class="instruction-chip__heading">Other instructions</span>}
              <ul class="instruction-chip__options" data-instruction-rest>
                {rest.map(option)}
              </ul>
            </>
          )}
        </div>
      )}
    </span>
  );
});
