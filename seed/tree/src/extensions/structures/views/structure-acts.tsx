import { $, component$, useContext, useStore } from "@builder.io/qwik";

import { ViewBridgeContext } from "~/components/shell/view-bridge";

import { KEYWORD_STRUCTURE, type StructureView } from "../lib/structures";
import { readStructures, type StructuresState } from "./provider";

/**
 * What a structure's document carries beside its header's lines
 * (`RO_0005_004`): its name, description, fields and what it allows are the
 * document's own — the title, the blocks, the blocks using *Field*, the
 * values of *Structure* — and what stays an act is drawn here: *Retire* or
 * *Restore* (`RO_0005_Q7`), never on a built-in; *Used by*, unfolding to the
 * documents using it, each opening as itself; and on *Keyword* the *Send with
 * prompt* switches, one per field and per allowed structure (`BO_0310_031`).
 * Every act posts to this extension's route and the state is read again.
 */

type Carrying = { readonly id: string; readonly title: string };

export const StructureActs = component$<{ structure: StructureView; state: StructuresState; documentId: string }>(
  ({ structure, state, documentId }) => {
    const bridge = useContext(ViewBridgeContext);
    const local = useStore<{ refusal: string; busy: boolean; using: readonly Carrying[] | "reading" | "refused" | null }>({
      refusal: "",
      busy: false,
      using: null,
    });

    const act$ = $(async (body: Record<string, unknown>) => {
      if (local.busy) return;
      local.busy = true;
      local.refusal = "";
      try {
        const response = await fetch(`/api/x/structures/structures/${encodeURIComponent(structure.id)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }).catch(() => null);
        const answer = (await response?.json().catch(() => null)) as { outcome?: string; detail?: string; failures?: readonly { detail: string }[] } | null;
        if (answer?.outcome !== "success")
          local.refusal = answer?.failures?.map((failure) => failure.detail).join(" ") ?? answer?.detail ?? "The structure did not change.";
        await readStructures(state, documentId);
      } finally {
        local.busy = false;
      }
    });

    const unfold$ = $(async () => {
      if (local.using !== null) {
        local.using = null;
        return;
      }
      local.using = "reading";
      const response = await fetch(`/api/x/structures/structures/${encodeURIComponent(structure.id)}/documents`).catch(() => null);
      const answer = (await response?.json().catch(() => null)) as { outcome?: string; result?: readonly Carrying[] } | null;
      local.using = answer?.outcome === "success" && answer.result !== undefined ? answer.result : "refused";
    });

    const nameOf = new Map(state.catalogue.map((one) => [one.id, one.name] as const));
    // An allowing never overrides the setting: a structure blocks may not use
    // is used by the document under a block using this one (RO_0003_Q5).
    const documentOnly = structure.offers
      .map((id) => state.catalogue.find((one) => one.id === id))
      .filter((one): one is StructureView => one !== undefined && !one.blocks);
    const sendable =
      structure.id === KEYWORD_STRUCTURE
        ? [
            ...structure.fields.map((field) => ({ id: field.key, name: field.name })),
            ...structure.offers.map((id) => ({ id, name: nameOf.get(id) ?? id })),
          ]
        : [];
    return (
      <div class="structure-acts" data-structure-acts={structure.id} data-retired={structure.retired ? "true" : undefined}>
        <div class="structure-acts__line">
          <span class="structure-acts__standing">
            {structure.retired ? "Retired: allowed nowhere, kept where it was used." : "A structure: its title names it, its blocks describe it, and its blocks using Field are its fields."}
          </span>
          {!structure.builtin && (
            <button
              type="button"
              class="structure-acts__act"
              disabled={local.busy}
              data-structure-retire
              onClick$={() => act$({ command: structure.retired ? "restore" : "retire" })}
            >
              {structure.retired ? "Restore" : "Retire"}
            </button>
          )}
          <button
            type="button"
            class="structure-acts__act"
            aria-expanded={local.using === null ? "false" : "true"}
            data-structure-used-by
            onClick$={unfold$}
          >
            Used by
          </button>
        </div>
        {local.using !== null && (
          <ul class="structure-acts__using" data-structure-using>
            {local.using === "reading" ? (
              <li class="structure-acts__empty">Reading…</li>
            ) : local.using === "refused" ? (
              <li class="structure-acts__empty">The documents could not be read</li>
            ) : local.using.length === 0 ? (
              <li class="structure-acts__empty">No document uses {structure.name}</li>
            ) : (
              local.using.map((document) => (
                <li key={document.id}>
                  <button
                    type="button"
                    class="structure-acts__document"
                    data-using-document={document.id}
                    onClick$={() => bridge.openTarget$({ kind: "documents:document", itemId: document.id, title: document.title })}
                  >
                    {document.title === "" ? "Untitled" : document.title}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
        {documentOnly.length > 0 && (
          <ul class="structure-acts__using" data-structure-document-only>
            {documentOnly.map((one) => (
              <li key={one.id} class="structure-acts__empty" data-offer-document-only={one.id}>
                {one.name}: used by the document under a block using {structure.name}, never by its blocks
              </li>
            ))}
          </ul>
        )}
        {sendable.length > 0 && (
          // What a prompt that includes a keyword carries of it, the same for
          // every keyword; what it means is the keywords extension's. BO_0310_031
          <fieldset class="structure-acts__send" data-send-with-prompt>
            <legend class="structure-acts__heading">Send with prompt</legend>
            {sendable.map((entry) => (
              <label key={entry.id} class="structure-acts__switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={(structure.sendWithPrompt ?? []).includes(entry.id)}
                  disabled={local.busy}
                  data-send-with-prompt-entry={entry.id}
                  onChange$={(_, element) => act$({ command: "sendWithPrompt", entry: entry.id, on: element.checked })}
                />{" "}
                {entry.name}
              </label>
            ))}
          </fieldset>
        )}
        {local.refusal !== "" && (
          <p class="structure-acts__refusal" role="alert" data-structure-acts-refusal>
            {local.refusal}
          </p>
        )}
      </div>
    );
  },
);
