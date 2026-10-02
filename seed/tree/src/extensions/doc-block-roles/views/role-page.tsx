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
  KEYWORD_ROLE,
  shownValue,
  type FieldDeclaration,
  type FieldType,
  type RolesListing,
  type RoleView,
} from "../lib/roles";
import "./roles.css";

/**
 * A role's page (`BO_0299_012`, `BO_0309_013`, `BO_0309_015`): where a role
 * is defined, never assigned (`BO_0318`). Its name and description; its
 * fields — each named, typed, marked required, given a choice's options and a
 * default, moved and removed; the roles it offers, to any role; and the role
 * retired or restored. Every act is one truth write through this extension's
 * route, as the signed-in person; the page shows what the route answered. A
 * built-in refuses rename, retire and restore, so the page offers neither
 * (`BO_0308_Q5`). Whether blocks may take the role is one switch, fixed on a
 * built-in, and an offer of a role blocks may not take says where it is taken
 * (`calliopa-bootstrap`'s `BO_0332_012`).
 */

type Answer = {
  outcome: string;
  result?: RoleView;
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

export const RolePage = component$<ViewProps>(({ tab }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{
    role: RoleView | null;
    catalogue: readonly RoleView[];
    notice: string;
    busy: boolean;
    fieldName: string;
    fieldType: FieldType;
  }>({ role: null, catalogue: [], notice: "", busy: false, fieldName: "", fieldType: "text" });

  const read$ = $(async (id: string) => {
    const [response, listing] = await Promise.all([
      fetch(`/api/x/doc-block-roles/roles/${encodeURIComponent(id)}`).catch(() => null),
      fetch("/api/library/doc-block-roles/roles").catch(() => null),
    ]);
    const answer = ((await response?.json().catch(() => null)) ?? { outcome: "refused" }) as Answer;
    if (listing !== null && listing.ok) {
      const body = (await listing.json().catch(() => null)) as RolesListing | null;
      state.catalogue = [...(body?.roles ?? [])];
    }
    if (response === null || !response.ok || answer.outcome !== "success" || answer.result === undefined) {
      state.role = null;
      state.notice = detailOf(answer, response?.status ?? 0);
      return;
    }
    state.role = answer.result;
    state.notice = "";
  });

  // eslint-disable-next-line qwik/no-use-visible-task -- the role is read in the browser with the person's session
  useVisibleTask$(({ track }) => {
    const id = track(() => tab.itemId);
    if (id !== null && id !== "") void read$(id);
  });

  const act$ = $(async (command: Record<string, unknown>) => {
    const role = state.role;
    if (role === null || state.busy) return false;
    state.busy = true;
    try {
      const response = await fetch(`/api/x/doc-block-roles/roles/${encodeURIComponent(role.id)}`, {
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
      const renamed = answer.result.name !== role.name;
      const retiredChanged = answer.result.retired !== role.retired;
      state.role = answer.result;
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

  const role = state.role;
  if (role === null) {
    return <section class="role-page">{state.notice !== "" && <p role="alert">{state.notice}</p>}</section>;
  }
  const others = inOrder(state.catalogue).filter((other) => other.id !== role.id);
  const nameOf = new Map(state.catalogue.map((other) => [other.id, other.name] as const));
  const blocksOf = new Map(state.catalogue.map((other) => [other.id, other.blocks] as const));
  const offerable = others.filter((other) => !other.retired && !role.offers.includes(other.id));
  return (
    <section class="role-page" data-role-page={role.id} data-retired={role.retired ? "true" : undefined} data-builtin={role.builtin ? "true" : undefined}>
      <header class="role-page__head">
        <label class="role-page__field">
          <span class="role-page__label">Role{role.builtin ? " · built in" : ""}</span>
          <input
            type="text"
            class="role-page__name"
            value={role.name}
            aria-label="Name of the role"
            data-role-name
            disabled={state.busy || role.builtin}
            {...(role.builtin ? { title: "A built-in role keeps its name." } : {})}
            onChange$={(_, element) => act$({ command: "rename", name: element.value })}
          />
        </label>
        <label class="role-page__field">
          <span class="role-page__label">Description</span>
          <textarea
            class="role-page__description"
            value={role.description}
            rows={2}
            aria-label="Description of the role"
            data-role-description
            disabled={state.busy}
            onChange$={(_, element) => act$({ command: "describe", description: element.value })}
          />
        </label>
        <label class="role-page__required" data-role-blocks-row>
          <input
            type="checkbox"
            role="switch"
            checked={role.blocks}
            disabled={state.busy || role.builtin}
            data-role-blocks
            {...(role.builtin
              ? { title: role.blocks ? "Built in: blocks take it, as the release says." : "Built in: taken by documents alone, as the release says." }
              : {})}
            onChange$={(_, element) => act$({ command: "blocks", allowed: element.checked })}
          />{" "}
          Blocks may take this role{role.blocks ? "" : " — taken by documents alone"}
        </label>
        {!role.builtin && (
          <p class="role-page__standing" data-role-standing>
            {role.retired ? "Retired: not offered any more, assignments kept." : "Taken from a block's chip, where it is offered."}{" "}
            <button
              type="button"
              class="role-page__button"
              disabled={state.busy}
              data-role-retire
              onClick$={() => act$({ command: role.retired ? "restore" : "retire" })}
            >
              {role.retired ? "Restore" : "Retire"}
            </button>
          </p>
        )}
      </header>
      {state.notice !== "" && (
        <p class="role-page__notice" role="alert" data-role-notice>
          {state.notice}
        </p>
      )}

      <h3 class="role-page__heading">Fields</h3>
      {role.fields.length === 0 ? (
        <p class="role-page__empty" data-fields-empty>
          No fields yet. A block taking this role holds a value in each field listed here.
        </p>
      ) : (
        <ol class="role-page__fields" data-fields>
          {role.fields.map((field, index) => (
            <li
              key={field.key}
              class="role-page__field-row"
              data-field-row={field.key}
              data-builtin-field={isBuiltinField(role.id, field.key) ? "true" : undefined}
            >
              <input
                type="text"
                class="role-page__field-name"
                value={field.name}
                aria-label={`Name of field ${index + 1}`}
                disabled={state.busy}
                onChange$={(_, element) => act$({ command: "reviseField", key: field.key, name: element.value })}
              />
              <select
                class="role-page__field-type"
                aria-label={`Type of ${field.name}`}
                disabled={state.busy || isBuiltinField(role.id, field.key)}
                data-field-type-of={field.key}
                onChange$={(_, element) => act$({ command: "reviseField", key: field.key, type: element.value })}
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type} value={type} selected={type === field.type}>
                    {FIELD_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              <label class="role-page__required">
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
                  class="role-page__field-options"
                  value={(field.options ?? []).join(", ")}
                  placeholder="Options, separated by commas"
                  aria-label={`Options of ${field.name}`}
                  disabled={state.busy || isBuiltinField(role.id, field.key)}
                  data-field-options={field.key}
                  onChange$={(_, element) =>
                    act$({ command: "reviseField", key: field.key, options: element.value.split(",").map((option) => option.trim()) })
                  }
                />
              )}
              {field.type !== "file" && field.type !== "reference" && (
                <input
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  class="role-page__field-default"
                  value={defaultText(field)}
                  placeholder={field.type === "boolean" ? "true or false" : "Default"}
                  aria-label={`Default of ${field.name}`}
                  disabled={state.busy}
                  data-field-default={field.key}
                  onChange$={(_, element) => act$({ command: "reviseField", key: field.key, default: defaultOf(field, element.value) })}
                />
              )}
              <span class="role-page__field-controls">
                <button
                  type="button"
                  class="role-page__icon-button"
                  aria-label={`Move ${field.name} up`}
                  disabled={state.busy || index === 0}
                  onClick$={() => act$({ command: "moveField", key: field.key, by: -1 })}
                >
                  <Icon name="arrows-out-line-vertical" />
                </button>
                <button
                  type="button"
                  class="role-page__icon-button"
                  aria-label={`Move ${field.name} down`}
                  disabled={state.busy || index === role.fields.length - 1}
                  onClick$={() => act$({ command: "moveField", key: field.key, by: 1 })}
                >
                  <Icon name="arrows-in-line-vertical" />
                </button>
                {!isBuiltinField(role.id, field.key) && (
                  <button
                    type="button"
                    class="role-page__icon-button"
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
      <form class="role-page__add" preventdefault:submit onSubmit$={addField$}>
        <input
          type="text"
          class="role-page__add-name"
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
          class="role-page__field-type"
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
        <button type="submit" class="role-page__button" disabled={state.busy || state.fieldName.trim() === ""} data-add-field>
          Add field
        </button>
      </form>

      <h3 class="role-page__heading">Offers</h3>
      <p class="role-page__empty">
        A block under one carrying {role.name}, or the block itself, can take the roles {role.name} offers.
        {role.offeredBy.length === 0
          ? ` ${role.name} is offered by no role, so any ${role.blocks ? "block" : "document"} can take it.`
          : ` ${role.name} is offered by ${role.offeredBy.map((id) => nameOf.get(id) ?? id).join(", ")}.`}
      </p>
      {role.offers.length > 0 && (
        <ul class="role-page__offers" data-offers>
          {role.offers.map((id) => (
            <li key={id} class="role-page__offer" data-offer={id}>
              <span>{nameOf.get(id) ?? id}</span>
              {blocksOf.get(id) === false && (
                // An offer never lets a block take a document-only role: the
                // focused work's document under the offering block takes it.
                // RO_0003_Q5
                <span class="role-page__label" data-offer-document-only={id}>
                  taken by the document under a block carrying {role.name}, never by its blocks
                </span>
              )}
              {isBuiltinOffer(role.id, id) ? (
                // A release's offer between built-ins stays. BO_0310_030
                <span class="role-page__label" data-builtin-offer={id}>
                  built in
                </span>
              ) : (
                <button
                  type="button"
                  class="role-page__icon-button"
                  aria-label={`Stop offering ${nameOf.get(id) ?? id}`}
                  data-unoffer={id}
                  disabled={state.busy}
                  onClick$={() => act$({ command: "unoffer", role: id })}
                >
                  <Icon name="x" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {offerable.length > 0 && (
        <label class="role-page__add">
          <span class="visually-hidden">Offer a role</span>
          <select
            class="role-page__field-type"
            data-offer-role
            disabled={state.busy}
            onChange$={async (_, element) => {
              const id = element.value;
              element.value = "";
              if (id !== "") await act$({ command: "offer", role: id });
            }}
          >
            <option value="" selected>
              Offer a role…
            </option>
            {offerable.map((other) => (
              <option key={other.id} value={other.id}>
                {other.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {role.id === KEYWORD_ROLE && (
        // What a prompt that includes a keyword carries of it: one switch per
        // field and per offered role, the same for every keyword. What it
        // means is the keywords extension's. BO_0310_031
        <>
          <h3 class="role-page__heading">Send with prompt</h3>
          <p class="role-page__empty">
            A prompt that includes a keyword — named with @ or found in its words — carries what is switched on here, for every keyword.
          </p>
          <ul class="role-page__offers" data-send-with-prompt>
            {[
              ...role.fields.map((field) => ({ id: field.key, name: field.name })),
              ...role.offers.map((id) => ({ id, name: nameOf.get(id) ?? id })),
            ].map((entry) => (
              <li key={entry.id} class="role-page__offer">
                <label class="role-page__required">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={(role.sendWithPrompt ?? []).includes(entry.id)}
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
