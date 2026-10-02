import { $, component$, useContext, useStore, useVisibleTask$ } from "@builder.io/qwik";

import { Icon } from "~/components/shell/icons";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { ViewProps } from "~/components/shell/view-host";

import {
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  inOrder,
  isBuiltinField,
  isBuiltinOffer,
  KEYWORD_STRUCTURE,
  shownValue,
  type FieldDeclaration,
  type FieldType,
  type StructuresListing,
  type StructureView,
} from "../lib/structures";
import "./structures.css";

/**
 * A structure's page (`BO_0299_012`, `BO_0309_013`, `BO_0309_015`): where a structure
 * is defined, never assigned (`BO_0318`). Its name and description; its
 * fields — each named, typed, marked required, given a choice's options and a
 * default, moved and removed; the structures it offers, to any structure; and the structure
 * retired or restored. Every act is one truth write through this extension's
 * route, as the signed-in person; the page shows what the route answered. A
 * built-in refuses rename, retire and restore, so the page offers neither
 * (`BO_0308_Q5`). Whether blocks may take the structure is one switch, fixed on a
 * built-in, and an offer of a structure blocks may not take says where it is taken
 * (`calliopa-bootstrap`'s `BO_0332_012`).
 */

type Answer = {
  outcome: string;
  result?: StructureView;
  detail?: string;
  failures?: readonly { detail: string }[];
};

const detailOf = (answer: Answer, status: number): string =>
  answer.failures?.map((failure) => failure.detail).join(" ") ?? answer.detail ?? `The server answered ${status}.`;

/** A default as its input shows it. */
const defaultText = (field: FieldDeclaration): string => shownValue(field, field.default);

/** A default typed into its input, as the route takes it. */
function defaultOf(field: FieldDeclaration, typed: string): unknown {
  if (typed.trim() === "") return null;
  if (field.type === "number") return Number(typed);
  if (field.type === "boolean") return typed === "true";
  return typed;
}

export const StructurePage = component$<ViewProps>(({ tab }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{
    structure: StructureView | null;
    catalogue: readonly StructureView[];
    notice: string;
    busy: boolean;
    fieldName: string;
    fieldType: FieldType;
    /** The suggestion sources the build answers, for a person's own text
     * field (`calliopa-bootstrap`'s `BO_0336_012`). */
    sources: readonly { readonly source: string; readonly label: string }[];
  }>({ structure: null, catalogue: [], notice: "", busy: false, fieldName: "", fieldType: "text", sources: [] });

  const read$ = $(async (id: string) => {
    const [response, listing, sources] = await Promise.all([
      fetch(`/api/x/structures/structures/${encodeURIComponent(id)}`).catch(() => null),
      fetch("/api/library/structures/structures").catch(() => null),
      fetch("/api/suggestions").catch(() => null),
    ]);
    if (sources !== null && sources.ok) {
      const body = (await sources.json().catch(() => null)) as { sources?: readonly { source: string; label: string }[] } | null;
      state.sources = [...(body?.sources ?? [])];
    }
    const answer = ((await response?.json().catch(() => null)) ?? { outcome: "refused" }) as Answer;
    if (listing !== null && listing.ok) {
      const body = (await listing.json().catch(() => null)) as StructuresListing | null;
      state.catalogue = [...(body?.structures ?? [])];
    }
    if (response === null || !response.ok || answer.outcome !== "success" || answer.result === undefined) {
      state.structure = null;
      state.notice = detailOf(answer, response?.status ?? 0);
      return;
    }
    state.structure = answer.result;
    state.notice = "";
  });

  // eslint-disable-next-line qwik/no-use-visible-task -- the structure is read in the browser with the person's session
  useVisibleTask$(({ track }) => {
    const id = track(() => tab.itemId);
    if (id !== null && id !== "") void read$(id);
  });

  const act$ = $(async (command: Record<string, unknown>) => {
    const structure = state.structure;
    if (structure === null || state.busy) return false;
    state.busy = true;
    try {
      const response = await fetch(`/api/x/structures/structures/${encodeURIComponent(structure.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(command),
      });
      const answer = (await response.json().catch(() => ({ outcome: "refused" }))) as Answer;
      if (!response.ok || answer.outcome !== "success" || answer.result === undefined) {
        state.notice = detailOf(answer, response.status);
        return false;
      }
      state.notice = "";
      const renamed = answer.result.name !== structure.name;
      const retiredChanged = answer.result.retired !== structure.retired;
      state.structure = answer.result;
      if (renamed) await bridge.setTitle$(answer.result.name);
      if (renamed || retiredChanged) await bridge.targetChanged$();
      return true;
    } finally {
      state.busy = false;
    }
  });

  const addField$ = $(async () => {
    const name = state.fieldName.trim();
    if (name === "") return;
    if (await act$({ command: "addField", name, type: state.fieldType })) state.fieldName = "";
  });

  const structure = state.structure;
  if (structure === null) {
    return <section class="structure-page">{state.notice !== "" && <p role="alert">{state.notice}</p>}</section>;
  }
  const others = inOrder(state.catalogue).filter((other) => other.id !== structure.id);
  const nameOf = new Map(state.catalogue.map((other) => [other.id, other.name] as const));
  const blocksOf = new Map(state.catalogue.map((other) => [other.id, other.blocks] as const));
  const offerable = others.filter((other) => !other.retired && !structure.offers.includes(other.id));
  return (
    <section class="structure-page" data-structure-page={structure.id} data-retired={structure.retired ? "true" : undefined} data-builtin={structure.builtin ? "true" : undefined}>
      <header class="structure-page__head">
        <label class="structure-page__field">
          <span class="structure-page__label">Structure{structure.builtin ? " · built in" : ""}</span>
          <input
            type="text"
            class="structure-page__name"
            value={structure.name}
            aria-label="Name of the structure"
            data-structure-name
            disabled={state.busy || structure.builtin}
            {...(structure.builtin ? { title: "A built-in structure keeps its name." } : {})}
            onChange$={(_, element) => act$({ command: "rename", name: element.value })}
          />
        </label>
        <label class="structure-page__field">
          <span class="structure-page__label">Description</span>
          <textarea
            class="structure-page__description"
            value={structure.description}
            rows={2}
            aria-label="Description of the structure"
            data-structure-description
            disabled={state.busy}
            onChange$={(_, element) => act$({ command: "describe", description: element.value })}
          />
        </label>
        <label class="structure-page__required" data-structure-blocks-row>
          <input
            type="checkbox"
            role="switch"
            checked={structure.blocks}
            disabled={state.busy || structure.builtin}
            data-structure-blocks
            {...(structure.builtin
              ? { title: structure.blocks ? "Built in: blocks use it, as the release says." : "Built in: used by documents alone, as the release says." }
              : {})}
            onChange$={(_, element) => act$({ command: "blocks", allowed: element.checked })}
          />{" "}
          Blocks may use this structure{structure.blocks ? "" : " — used by documents alone"}
        </label>
        {!structure.builtin && (
          <p class="structure-page__standing" data-structure-standing>
            {structure.retired ? "Retired: not allowed any more, assignments kept." : "Used from a block's chip, where it is allowed."}{" "}
            <button
              type="button"
              class="structure-page__button"
              disabled={state.busy}
              data-structure-retire
              onClick$={() => act$({ command: structure.retired ? "restore" : "retire" })}
            >
              {structure.retired ? "Restore" : "Retire"}
            </button>
          </p>
        )}
      </header>
      {state.notice !== "" && (
        <p class="structure-page__notice" role="alert" data-structure-notice>
          {state.notice}
        </p>
      )}

      <h3 class="structure-page__heading">Fields</h3>
      {structure.fields.length === 0 ? (
        <p class="structure-page__empty" data-fields-empty>
          No fields yet. A block taking this structure holds a value in each field listed here.
        </p>
      ) : (
        <ol class="structure-page__fields" data-fields>
          {structure.fields.map((field, index) => (
            <li
              key={field.key}
              class="structure-page__field-row"
              data-field-row={field.key}
              data-builtin-field={isBuiltinField(structure.id, field.key) ? "true" : undefined}
            >
              <input
                type="text"
                class="structure-page__field-name"
                value={field.name}
                aria-label={`Name of field ${index + 1}`}
                disabled={state.busy}
                onChange$={(_, element) => act$({ command: "reviseField", key: field.key, name: element.value })}
              />
              <select
                class="structure-page__field-type"
                aria-label={`Type of ${field.name}`}
                disabled={state.busy || isBuiltinField(structure.id, field.key)}
                data-field-type-of={field.key}
                onChange$={(_, element) => act$({ command: "reviseField", key: field.key, type: element.value })}
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type} value={type} selected={type === field.type}>
                    {FIELD_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              <label class="structure-page__required">
                <input
                  type="checkbox"
                  checked={field.required}
                  disabled={state.busy}
                  data-field-required={field.key}
                  onChange$={(_, element) => act$({ command: "reviseField", key: field.key, required: element.checked })}
                />{" "}
                Required
              </label>
              {field.type === "choice" && (
                <input
                  type="text"
                  class="structure-page__field-options"
                  value={(field.options ?? []).join(", ")}
                  placeholder="Options, separated by commas"
                  aria-label={`Options of ${field.name}`}
                  disabled={state.busy || isBuiltinField(structure.id, field.key)}
                  data-field-options={field.key}
                  onChange$={(_, element) =>
                    act$({ command: "reviseField", key: field.key, options: element.value.split(",").map((option) => option.trim()) })
                  }
                />
              )}
              {field.type === "text" && (
                // What a text field suggests: a source the build answers,
                // words of the person's own, or both; never a limit. Fixed on
                // a release field. BO_0336_012
                <>
                  <select
                    class="structure-page__field-source"
                    aria-label={`What ${field.name} suggests`}
                    disabled={state.busy || isBuiltinField(structure.id, field.key)}
                    data-field-source={field.key}
                    onChange$={(_, element) => act$({ command: "reviseField", key: field.key, suggest: element.value === "" ? null : element.value })}
                  >
                    <option value="" selected={field.suggest === undefined}>
                      No source
                    </option>
                    {field.suggest !== undefined && !state.sources.some((one) => one.source === field.suggest) && (
                      <option value={field.suggest} selected>
                        {field.suggest}
                      </option>
                    )}
                    {state.sources.map((one) => (
                      <option key={one.source} value={one.source} selected={one.source === field.suggest}>
                        {one.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    class="structure-page__field-options"
                    value={(field.suggestions ?? []).join(", ")}
                    placeholder="Suggestions, separated by commas"
                    aria-label={`Suggestions of ${field.name}`}
                    disabled={state.busy || isBuiltinField(structure.id, field.key)}
                    data-field-suggestions-of={field.key}
                    onChange$={(_, element) =>
                      act$({ command: "reviseField", key: field.key, suggestions: element.value.split(",").map((word) => word.trim()) })
                    }
                  />
                </>
              )}
              {field.type === "reference" && (
                // A reference may take only documents carrying a structure, chosen
                // by title. BO_0336_012
                <select
                  class="structure-page__field-source"
                  aria-label={`What ${field.name} names`}
                  disabled={state.busy || isBuiltinField(structure.id, field.key)}
                  data-field-carrying={field.key}
                  onChange$={(_, element) => act$({ command: "reviseField", key: field.key, carrying: element.value === "" ? null : element.value })}
                >
                  <option value="" selected={field.carrying === undefined}>
                    Any document or block, by id
                  </option>
                  {inOrder(state.catalogue).map((other) => (
                    <option key={other.id} value={other.id} selected={other.id === field.carrying}>
                      {`Documents using ${other.name}`}
                    </option>
                  ))}
                </select>
              )}
              {field.type !== "file" && field.type !== "reference" && (
                <input
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  class="structure-page__field-default"
                  value={defaultText(field)}
                  placeholder={field.type === "boolean" ? "true or false" : "Default"}
                  aria-label={`Default of ${field.name}`}
                  disabled={state.busy}
                  data-field-default={field.key}
                  onChange$={(_, element) => act$({ command: "reviseField", key: field.key, default: defaultOf(field, element.value) })}
                />
              )}
              <span class="structure-page__field-controls">
                <button
                  type="button"
                  class="structure-page__icon-button"
                  aria-label={`Move ${field.name} up`}
                  disabled={state.busy || index === 0}
                  onClick$={() => act$({ command: "moveField", key: field.key, by: -1 })}
                >
                  <Icon name="arrows-out-line-vertical" />
                </button>
                <button
                  type="button"
                  class="structure-page__icon-button"
                  aria-label={`Move ${field.name} down`}
                  disabled={state.busy || index === structure.fields.length - 1}
                  onClick$={() => act$({ command: "moveField", key: field.key, by: 1 })}
                >
                  <Icon name="arrows-in-line-vertical" />
                </button>
                {!isBuiltinField(structure.id, field.key) && (
                  <button
                    type="button"
                    class="structure-page__icon-button"
                    aria-label={`Remove ${field.name}`}
                    data-remove-field={field.key}
                    disabled={state.busy}
                    onClick$={() => act$({ command: "removeField", key: field.key })}
                  >
                    <Icon name="x" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      <form class="structure-page__add" preventdefault:submit onSubmit$={addField$}>
        <input
          type="text"
          class="structure-page__add-name"
          value={state.fieldName}
          placeholder="New field"
          aria-label="Name of a new field"
          data-new-field
          disabled={state.busy}
          onInput$={(_, element) => {
            state.fieldName = element.value;
          }}
        />
        <select
          class="structure-page__field-type"
          aria-label="Type of the new field"
          data-new-field-type
          disabled={state.busy}
          onChange$={(_, element) => {
            state.fieldType = element.value as FieldType;
          }}
        >
          {FIELD_TYPES.map((type) => (
            <option key={type} value={type} selected={type === state.fieldType}>
              {FIELD_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <button type="submit" class="structure-page__button" disabled={state.busy || state.fieldName.trim() === ""} data-add-field>
          Add field
        </button>
      </form>

      <h3 class="structure-page__heading">Allows</h3>
      <p class="structure-page__empty">
        A block under one carrying {structure.name}, or the block itself, can take the structures {structure.name} offers.
        {structure.offeredBy.length === 0
          ? ` ${structure.name} is allowed by no structure, so any ${structure.blocks ? "block" : "document"} can use it.`
          : ` ${structure.name} is allowed by ${structure.offeredBy.map((id) => nameOf.get(id) ?? id).join(", ")}.`}
      </p>
      {structure.offers.length > 0 && (
        <ul class="structure-page__offers" data-offers>
          {structure.offers.map((id) => (
            <li key={id} class="structure-page__offer" data-offer={id}>
              <span>{nameOf.get(id) ?? id}</span>
              {blocksOf.get(id) === false && (
                // An offer never lets a block take a document-only structure: the
                // focused work's document under the offering block takes it.
                // RO_0003_Q5
                <span class="structure-page__label" data-offer-document-only={id}>
                  taken by the document under a block carrying {structure.name}, never by its blocks
                </span>
              )}
              {isBuiltinOffer(structure.id, id) ? (
                // A release's offer between built-ins stays. BO_0310_030
                <span class="structure-page__label" data-builtin-offer={id}>
                  built in
                </span>
              ) : (
                <button
                  type="button"
                  class="structure-page__icon-button"
                  aria-label={`Stop allowing ${nameOf.get(id) ?? id}`}
                  data-unoffer={id}
                  disabled={state.busy}
                  onClick$={() => act$({ command: "unoffer", structure: id })}
                >
                  <Icon name="x" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {offerable.length > 0 && (
        <label class="structure-page__add">
          <span class="visually-hidden">Allow a structure</span>
          <select
            class="structure-page__field-type"
            data-offer-structure
            disabled={state.busy}
            onChange$={async (_, element) => {
              const id = element.value;
              element.value = "";
              if (id !== "") await act$({ command: "offer", structure: id });
            }}
          >
            <option value="" selected>
              Offer a structure…
            </option>
            {offerable.map((other) => (
              <option key={other.id} value={other.id}>
                {other.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {structure.id === KEYWORD_STRUCTURE && (
        // What a prompt that includes a keyword carries of it: one switch per
        // field and per offered structure, the same for every keyword. What it
        // means is the keywords extension's. BO_0310_031
        <>
          <h3 class="structure-page__heading">Send with prompt</h3>
          <p class="structure-page__empty">
            A prompt that includes a keyword — named with @ or found in its words — carries what is switched on here, for every keyword.
          </p>
          <ul class="structure-page__offers" data-send-with-prompt>
            {[
              ...structure.fields.map((field) => ({ id: field.key, name: field.name })),
              ...structure.offers.map((id) => ({ id, name: nameOf.get(id) ?? id })),
            ].map((entry) => (
              <li key={entry.id} class="structure-page__offer">
                <label class="structure-page__required">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={(structure.sendWithPrompt ?? []).includes(entry.id)}
                    disabled={state.busy}
                    data-send-with-prompt-entry={entry.id}
                    onChange$={(_, element) => act$({ command: "sendWithPrompt", entry: entry.id, on: element.checked })}
                  />{" "}
                  {entry.name}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
});
