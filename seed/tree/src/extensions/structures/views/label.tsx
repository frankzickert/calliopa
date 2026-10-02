import { component$, useContext } from "@builder.io/qwik";

import type { BlockDecorationProps } from "~/contract";

import { structureState, type TakenStructure } from "../lib/structures";
import { StructuresContext } from "./provider";
import "./structures.css";

/**
 * A block's structures while reading (`BO_0299_Q7`, one per structure since
 * `BO_0309_021`): each structure's name as a small pill at the block, the idiom
 * the register word and the standing use, saying *not offered* when the structure
 * above it went, *not allowed on a block* when blocks may no longer take it
 * (`BO_0332_013`) and *retired* when the structure was, marked when a required value
 * is missing, and *proposed* while a run's proposal of it waits for the
 * person. Pressing a pill opens the chip's structure control at that structure. Nothing
 * on a block carrying none. It reads what the provider read once for the
 * document.
 */

/** What a pill says beside the structure's name, or nothing. */
export function pillNote(structure: TakenStructure): string | null {
  if (structure.proposed === "structure") return "proposed";
  const state = structureState(structure);
  if (state !== null) return state;
  if (structure.proposed === "values") return "values proposed";
  return null;
}

/** The pill's title: what the structure is, and what it lacks. */
export function pillTitle(structure: TakenStructure): string {
  const lacking = structure.fields
    .filter((field) => structure.missing.includes(field.key))
    .map((field) => field.name);
  const note = pillNote(structure);
  return [
    note === null ? (structure.description === "" ? `Structure: ${structure.name}` : structure.description) : `${structure.name} is ${note}`,
    ...(lacking.length === 0 ? [] : [`Missing: ${lacking.join(", ")}`]),
  ].join(". ");
}

export const StructurePills = component$<{ structures: readonly TakenStructure[]; subject: string }>(({ structures, subject }) => {
  const state = useContext(StructuresContext);
  if (structures.length === 0) return null;
  return (
    <span class="block-structures" data-block-structures-of={subject}>
      {structures.map((structure) => {
        const note = pillNote(structure);
        return (
          <button
            key={structure.id}
            type="button"
            class="block-structure"
            data-block-structure={structure.id}
            data-structure-state={note ?? undefined}
            data-structure-missing={structure.missing.length > 0 ? "true" : undefined}
            title={pillTitle(structure)}
            aria-label={pillTitle(structure)}
            // A pill opens the chip's control at its structure. The press goes on
            // to the row, whose own press starts editing the block, and the
            // chip that then stands under it opens where the pill asked.
            onClick$={() => {
              state.opening = { subject, structure: structure.id };
            }}
          >
            <span class="block-structure__name">{structure.name}</span>
            {structure.missing.length > 0 && (
              <span class="block-structure__missing" aria-hidden="true">
                !
              </span>
            )}
            {note !== null && <span class="block-structure__state">{note}</span>}
          </button>
        );
      })}
    </span>
  );
});

export const StructureLabel = component$<BlockDecorationProps>(({ blockId }) => {
  const structures = useContext(StructuresContext);
  const block = structures.view?.blocks.find((candidate) => candidate.blockId === blockId);
  if (block === undefined || block.structures.length === 0) return null;
  return <StructurePills structures={block.structures} subject={blockId} />;
});
