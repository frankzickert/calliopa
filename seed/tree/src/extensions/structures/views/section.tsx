import { $, component$, useContext, useStore, useTask$ } from "@builder.io/qwik";

import { Icon } from "~/components/shell/icons";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { SectionProps } from "~/contract";

import { inOrder, INSTRUCTION_STRUCTURE, STRUCTURE_STRUCTURE, UNNAMED_STRUCTURE, type StructuresListing, type StructureView } from "../lib/structures";
import { INSTRUCTION_DRAG_KIND, STRUCTURE_DRAG_KIND } from "./drops";

/**
 * The Structures section (`BO_0299_012`, `BO_0309_015`): the structures, the built-ins
 * first, retired ones left out, each opening its document, where the structure
 * is defined — its title, its description, its blocks using *Field*, what it
 * allows — and never assigned (`BO_0318`, `RO_0005`). A built-in's row unfolds to the documents carrying it, each
 * opening as itself (`BO_0308_Q11`), and carries the `+` its owner
 * contributes, opening the owner's form — *Add source* on *Source*
 * (`BO_0313_011`). The section's own `+` creates a structure — a document using
 * *Structure* — through this extension's route and opens it: the one way a
 * structure is made (`RO_0005_Q9`).
 */

const EMPTY: StructuresListing = { reachable: false, structures: [] };

type Carrying = { readonly id: string; readonly title: string };

export const StructuresSection = component$<SectionProps>(({ data, activeItemId }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{
    listing: StructuresListing;
    busy: boolean;
    refusal: string;
    reads: number;
    unfolded: Record<string, readonly Carrying[] | "reading" | "refused">;
  }>({
    listing: (data as StructuresListing | null) ?? EMPTY,
    busy: false,
    refusal: "",
    reads: 0,
    unfolded: {},
  });

  useTask$(({ track }) => {
    const next = track(() => data) as StructuresListing | null;
    if (next !== null && next !== undefined) state.listing = next;
  });

  const refresh$ = $(async () => {
    const response = await fetch("/api/library/structures/structures").catch(() => null);
    if (response === null || !response.ok) return;
    state.listing = (await response.json()) as StructuresListing;
    state.reads += 1;
  });

  // A structure is its document (RO_0005): it opens as any document does.
  const open$ = $((structure: StructureView) =>
    bridge.openTarget$({ kind: "documents:document", itemId: structure.id, title: structure.name }),
  );

  const unfold$ = $(async (structure: StructureView) => {
    if (state.unfolded[structure.id] !== undefined) {
      const { [structure.id]: _, ...rest } = state.unfolded;
      state.unfolded = rest;
      return;
    }
    state.unfolded = { ...state.unfolded, [structure.id]: "reading" };
    const response = await fetch(`/api/x/structures/structures/${encodeURIComponent(structure.id)}/documents`).catch(() => null);
    const answer = (await response?.json().catch(() => null)) as { outcome?: string; result?: readonly Carrying[] } | null;
    state.unfolded = {
      ...state.unfolded,
      [structure.id]: answer?.outcome === "success" && answer.result !== undefined ? answer.result : "refused",
    };
  });

  const create$ = $(async () => {
    if (state.busy) return;
    state.busy = true;
    state.refusal = "";
    try {
      const response = await fetch("/api/x/structures/structures", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: UNNAMED_STRUCTURE }),
      });
      const answer = (await response.json().catch(() => ({ outcome: "refused" }))) as {
        outcome: string;
        result?: StructureView;
        detail?: string;
      };
      if (answer.outcome !== "success" || answer.result === undefined) {
        state.refusal = answer.detail ?? `The structure was not created: the server answered ${response.status}.`;
        return;
      }
      await open$(answer.result);
      await refresh$();
    } finally {
      state.busy = false;
    }
  });

  const listing = state.listing;
  const structures = inOrder(listing.structures).filter((structure) => !structure.retired);
  return (
    <>
      <div class="library-section-actions">
        <button
          type="button"
          class="library-action library-action--body library-action--icon"
          aria-label="New structure"
          disabled={state.busy}
          data-new-structure
          onClick$={create$}
        >
          <Icon name="plus" />
        </button>
      </div>
      {state.refusal !== "" && (
        <p class="library-refusal" role="alert" data-structures-notice>
          {state.refusal}
        </p>
      )}
      {!listing.reachable ? (
        <p class="library-empty" data-structures-empty>
          The structures could not be read
        </p>
      ) : structures.length === 0 ? (
        <p class="library-empty" data-structures-empty>
          No structures yet
        </p>
      ) : (
        <ul class="library-list" key={state.reads} data-structures>
          {structures.map((structure) => {
            const current = activeItemId === structure.id;
            const unfolded = state.unfolded[structure.id];
            return (
              <li key={structure.id} data-builtin={structure.builtin ? "true" : undefined}>
                <span class="structures-row">
                  {structure.builtin && (
                    <button
                      type="button"
                      class="library-action library-action--icon"
                      aria-label={`${unfolded === undefined ? "Show" : "Hide"} the documents using ${structure.name}`}
                      aria-expanded={unfolded === undefined ? "false" : "true"}
                      data-unfold-structure={structure.id}
                      onClick$={() => unfold$(structure)}
                    >
                      <Icon name={unfolded === undefined ? "caret-right" : "caret-down"} />
                    </button>
                  )}
                  <button
                    type="button"
                    class="library-entry"
                    data-structure-row={structure.id}
                    data-current={current ? "true" : undefined}
                    aria-current={current ? "true" : undefined}
                    onClick$={() => open$(structure)}
                    // A structure is dragged out of the sheet onto a block or a
                    // document's header, where it is used; *Structure* is never
                    // used by hand. BO_0349_002
                    onPointerDown$={(event: PointerEvent) => {
                      if (structure.id === STRUCTURE_STRUCTURE || event.button !== 0) return;
                      void bridge.startDrag$(
                        { itemId: structure.id, kind: STRUCTURE_DRAG_KIND, source: "library", operations: ["link"], preview: structure.name },
                        event,
                      );
                    }}
                  >
                    <span class="library-entry__label">{structure.name}</span>
                    {structure.builtin && <span class="structures-row__builtin">built in</span>}
                    {current && <span class="library-entry__marker" aria-hidden="true" />}
                  </button>
                  {structure.create !== undefined && (
                    <button
                      type="button"
                      class="library-action library-action--icon"
                      aria-label={structure.create.label}
                      data-structure-create={structure.id}
                      onClick$={() => {
                        const create = structure.create;
                        if (create !== undefined)
                          void bridge.openTarget$({ kind: create.kind, itemId: "new", title: create.label });
                      }}
                    >
                      <Icon name="plus" />
                    </button>
                  )}
                </span>
                {unfolded !== undefined && (
                  <ul class="library-list structures-row__documents" data-carrying={structure.id}>
                    {unfolded === "reading" ? (
                      <li class="library-empty">Reading…</li>
                    ) : unfolded === "refused" ? (
                      <li class="library-empty">The documents could not be read</li>
                    ) : unfolded.length === 0 ? (
                      <li class="library-empty">No document carries {structure.name}</li>
                    ) : (
                      unfolded.map((document) => (
                        <li key={document.id}>
                          <button
                            type="button"
                            class="library-entry"
                            data-carrying-document={document.id}
                            onClick$={() =>
                              bridge.openTarget$({ kind: "documents:document", itemId: document.id, title: document.title })
                            }
                            // An instruction, listed under *Instruction*, is dragged
                            // onto a block or a header, where it stands; `instructions`
                            // says what its kind means there (BO_0349_011). A structure,
                            // listed under *Structure*, drags as the structure it is, as
                            // its own row does (found in the walk at pin 4805).
                            onPointerDown$={(event: PointerEvent) => {
                              if (event.button !== 0) return;
                              const kind =
                                structure.id === INSTRUCTION_STRUCTURE ? INSTRUCTION_DRAG_KIND : structure.id === STRUCTURE_STRUCTURE ? STRUCTURE_DRAG_KIND : null;
                              if (kind === null) return;
                              void bridge.startDrag$(
                                { itemId: document.id, kind, source: "library", operations: ["link"], preview: document.title },
                                event,
                              );
                            }}
                          >
                            <span class="library-entry__label">{document.title === "" ? "Untitled" : document.title}</span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
});
