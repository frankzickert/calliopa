import { $, component$, useContext, useOnDocument, useSignal, useStore, useTask$, useVisibleTask$ } from "@builder.io/qwik";

import type { BlockDecorationProps } from "~/contract";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import { FILL_A_FIELD_INSTRUCTION } from "~/extensions/documents/lib/instruction";

import { startsRun } from "../lib/children";
import { FIELD_TYPE_LABELS, type FieldDeclaration } from "../lib/structures";
import { postStructures, StructuresContext } from "./provider";

/**
 * The field choice under a structured block a drop has just nested a block
 * into (`calliopa-bootstrap`'s `BO_0349_010`): the nest stands, and the
 * target's structures offer their fields, grouped under each structure's name.
 * Choosing one puts the nested block into it; *Just nest it*, `Escape` or a
 * press elsewhere leaves the plain nest. A field whose kind is not text is
 * marked red, since choosing it also starts a run under *Fill a field* that
 * proposes the value read off the block (`BO_0349_018`). A block using no structure with a
 * field is asked nothing, and the place says it is finished.
 */

/** What a structured block offers: each structure it uses, with its fields. */
export interface FieldGroup {
  readonly structure: string;
  readonly name: string;
  readonly fields: readonly FieldDeclaration[];
}

/** The groups a block's structures offer, in the order the block uses them;
 * a structure only proposed, or one with no field, offers nothing. */
export function fieldGroups(
  structures: readonly { readonly id: string; readonly name: string; readonly proposed?: string; readonly fields: readonly FieldDeclaration[] }[],
): readonly FieldGroup[] {
  return structures
    .filter((structure) => structure.proposed !== "structure" && structure.fields.length > 0)
    .map((structure) => ({ structure: structure.id, name: structure.name, fields: structure.fields }));
}

/** What a run filling a field is asked, in words naming the two blocks by
 * the numbers its references carry: #1 the structured block, #2 the block
 * put into the field. */
export const fillGoal = (field: FieldDeclaration, structure: string): string =>
  `Fill the field "${field.name}" (${FIELD_TYPE_LABELS[field.type]}) of ${structure} on #1 from #2, the block put into it.`;

export const NestedFieldChoice = component$<BlockDecorationProps>(({ documentId, blockId, nested, done$ }) => {
  const state = useContext(StructuresContext, null);
  const bridge = useContext(ViewBridgeContext, null);
  const host = useSignal<HTMLElement>();
  const local = useStore({ refusal: "" });
  const block = state?.view?.blocks.find((candidate) => candidate.blockId === blockId);
  const groups = block === undefined ? [] : fieldGroups(block.structures);
  const ready = state !== null && state.loaded && state.view !== null;

  // Nothing to ask: the plain nest is all the drop meant. A tracked task, since
  // the structures are read in the browser after the drop, so `ready` turns
  // true only there.
  useTask$(({ track }) => {
    if (state === null) return;
    const loaded = track(() => state.loaded);
    const view = track(() => state.view);
    if (!loaded || view === null) return;
    const standing = view.blocks.find((candidate) => candidate.blockId === blockId);
    if (fieldGroups(standing?.structures ?? []).length === 0) void done$?.();
  });

  // The first field takes the focus, so the keyboard answers at once.
  // eslint-disable-next-line qwik/no-use-visible-task -- the focus is the browser's
  useVisibleTask$(({ track }) => {
    track(() => groups.length);
    host.value?.querySelector<HTMLButtonElement>("[data-nested-field]")?.focus();
  });

  useOnDocument(
    "pointerdown",
    $((event: Event) => {
      const target = event.target as Node | null;
      if (host.value !== undefined && target !== null && !host.value.contains(target)) void done$?.();
    }),
  );

  const choose$ = $(async (structure: string, field: string) => {
    if (state === null || nested === undefined) return;
    const refusal = await postStructures(
      state,
      `/api/x/structures/documents/${encodeURIComponent(documentId)}/blocks/${encodeURIComponent(blockId)}/structures/${encodeURIComponent(structure)}/fields`,
      { field, child: nested.blockId },
      host.value?.ownerDocument ?? null,
    );
    if (refusal !== null) {
      local.refusal = refusal;
      return;
    }
    // A field whose kind is not text holds the block, and a run reads its
    // value off it, proposed where every proposal is answered. BO_0349_018
    const group = groups.find((candidate) => candidate.structure === structure);
    const declared = group?.fields.find((candidate) => candidate.key === field);
    if (group !== undefined && declared !== undefined && startsRun(declared) && bridge !== null) {
      const sent = await bridge.sendInstructed$({
        itemId: documentId,
        goal: fillGoal(declared, group.name),
        instruction: FILL_A_FIELD_INSTRUCTION,
        references: [
          { number: 1, blockId },
          { number: 2, blockId: nested.blockId, document: nested.documentId },
        ],
      });
      if (!sent.ok) {
        local.refusal = sent.error;
        return;
      }
    }
    await done$?.();
  });

  if (nested === undefined) return null;
  if (!ready || groups.length === 0) return null;
  return (
    <div
      ref={host}
      class="nested-fields"
      role="group"
      aria-label="Put the nested block into a field"
      data-nested-fields
      onKeyDown$={(event) => {
        if (event.key === "Escape") void done$?.();
      }}
    >
      <span class="nested-fields__heading">Nested. Put it into a field?</span>
      {groups.map((group) => (
        <div key={group.structure} class="nested-fields__group" data-nested-structure={group.structure}>
          <span class="nested-fields__structure">{group.name}</span>
          <div class="nested-fields__fields">
            {group.fields.map((field) => (
              <button
                key={field.key}
                type="button"
                class={["nested-fields__field", startsRun(field) ? "nested-fields__field--acts" : ""]}
                data-nested-field={field.key}
                data-nested-acts={startsRun(field) ? "run" : "none"}
                title={startsRun(field) ? "Starts a run that reads the value off the block" : `Put the block into ${field.name}`}
                disabled={state.busy}
                onClick$={() => choose$(group.structure, field.key)}
              >
                {field.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button type="button" class="nested-fields__skip" data-nested-skip onClick$={() => done$?.()}>
        Just nest it
      </button>
      {local.refusal !== "" && (
        <span class="nested-fields__refusal" role="alert" data-nested-refusal>
          {local.refusal}
        </span>
      )}
    </div>
  );
});
