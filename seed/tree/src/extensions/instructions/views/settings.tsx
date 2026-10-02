import { $, component$, useStore, useVisibleTask$ } from "@builder.io/qwik";

import type { InstructionGrants } from "../lib/instructions";
import "./instructions.css";

/**
 * *Instruction tools* in Settings, the owner's alone (`calliopa-bootstrap`'s
 * `BO_0311_040`): the instructions granted outside reach, with who granted each
 * and when and which secrets each may read, each revoked here; and the named
 * secrets a granted tool reads, each with whether it is set and its last
 * characters, added, replaced and cleared here. A value is never shown once
 * it is saved: the kernel answers none (`BO_0311_006`).
 */

const when = (at: number): string => new Date(at).toLocaleString();

export const InstructionToolsSettings = component$(() => {
  const state = useStore<{ view: InstructionGrants | null; notice: string; busy: boolean; name: string; value: string; replacing: Record<string, string> }>({
    view: null,
    notice: "",
    busy: false,
    name: "",
    value: "",
    replacing: {},
  });

  const read$ = $(async () => {
    const response = await fetch("/api/x/instructions/settings").catch(() => null);
    if (response === null || !response.ok) {
      state.notice = "The instruction tools could not be read.";
      return;
    }
    state.view = (await response.json()) as InstructionGrants;
  });

  // eslint-disable-next-line qwik/no-use-visible-task -- read in the browser with the owner's session
  useVisibleTask$(async () => {
    await read$();
  });

  const act$ = $(async (url: string, init: RequestInit, done: string) => {
    state.busy = true;
    state.notice = "";
    try {
      const response = await fetch(url, init).catch(() => null);
      if (response === null || !response.ok) {
        const answer = response === null ? {} : ((await response.json().catch(() => ({}))) as { error?: string });
        state.notice = answer.error ?? "That could not be done.";
        return false;
      }
      state.notice = done;
      await read$();
      return true;
    } finally {
      state.busy = false;
    }
  });

  const save$ = $(async (name: string, value: string) => {
    const saved = await act$(`/api/x/instructions/secrets/${encodeURIComponent(name)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ value }) }, `The secret ${name} is saved.`);
    if (saved) {
      state.name = "";
      state.value = "";
      state.replacing = { ...state.replacing, [name]: "" };
    }
  });

  const view = state.view;
  return (
    <div class="instruction-settings" data-instruction-tools-settings>
      <p class="settings-section__lead">
        An instruction's code blocks are tools an agent can call. Granted outside reach, they run with the network and read the secrets the grant names; otherwise they run with no network
        at all. A grant covers the code as it stood, so an edit needs a new grant.
      </p>
      <h3 class="instruction-settings__heading">Granted instructions</h3>
      {view !== null && view.grants.length === 0 && (
        <p class="settings-empty" data-instruction-grants-empty>
          No instruction is granted outside reach.
        </p>
      )}
      {view !== null && view.grants.length > 0 && (
        <ul class="instruction-settings__list" data-instruction-grants>
          {view.grants.map((grant) => (
            <li key={grant.instruction} class="instruction-settings__row" data-instruction-grant={grant.instruction}>
              <span class="instruction-settings__name">{grant.title === "" ? grant.instruction : grant.title}</span>
              <span class="instruction-settings__detail">
                granted by {grant.grantedBy} on {when(grant.grantedAt)}; {grant.secrets.length === 0 ? "reads no secret" : `reads ${grant.secrets.join(", ")}`}
              </span>
              <button
                type="button"
                class="connection__action"
                data-revoke-grant={grant.instruction}
                disabled={state.busy}
                onClick$={() => act$(`/api/x/instructions/documents/${encodeURIComponent(grant.instruction)}/grant`, { method: "DELETE" }, `${grant.title === "" ? "The instruction" : grant.title} is offline again.`)}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
      <h3 class="instruction-settings__heading">Secrets</h3>
      {view !== null && view.secrets.length === 0 && <p class="settings-empty">No secret is kept for the tools.</p>}
      {view !== null && view.secrets.length > 0 && (
        <ul class="instruction-settings__list" data-instruction-secrets>
          {view.secrets.map((secret) => (
            <li key={secret.name} class="instruction-settings__row" data-instruction-secret={secret.name}>
              <span class="instruction-settings__name">{secret.name}</span>
              <span class="instruction-settings__detail">{secret.set ? `set, ending ${secret.suffix}` : "not set"}</span>
              <input
                type="password"
                class="connection__input"
                aria-label={`A new value for ${secret.name}`}
                placeholder="New value"
                autoComplete="off"
                value={state.replacing[secret.name] ?? ""}
                data-replace-secret={secret.name}
                onInput$={(_, element) => {
                  state.replacing = { ...state.replacing, [secret.name]: element.value };
                }}
              />
              <button
                type="button"
                class="connection__action"
                data-save-secret={secret.name}
                disabled={state.busy || (state.replacing[secret.name] ?? "") === ""}
                onClick$={() => save$(secret.name, state.replacing[secret.name] ?? "")}
              >
                Replace
              </button>
              <button
                type="button"
                class="connection__action"
                data-clear-secret={secret.name}
                disabled={state.busy}
                onClick$={() => act$(`/api/x/instructions/secrets/${encodeURIComponent(secret.name)}`, { method: "DELETE" }, `The secret ${secret.name} is cleared.`)}
              >
                Clear
              </button>
            </li>
          ))}
        </ul>
      )}
      <p class="instruction-settings__add">
        <input
          type="text"
          class="connection__input"
          aria-label="The secret's name, which a tool reads from its environment"
          placeholder="Name, such as SMTP_PASSWORD"
          value={state.name}
          data-new-secret-name
          onInput$={(_, element) => {
            state.name = element.value;
          }}
        />
        <input
          type="password"
          class="connection__input"
          aria-label="The secret's value"
          placeholder="Value"
          autoComplete="off"
          value={state.value}
          data-new-secret-value
          onInput$={(_, element) => {
            state.value = element.value;
          }}
        />
        <button
          type="button"
          class="connection__action"
          data-add-secret
          disabled={state.busy || state.name.trim() === "" || state.value === ""}
          onClick$={() => save$(state.name.trim(), state.value)}
        >
          Add secret
        </button>
      </p>
      {state.notice !== "" && (
        <p class="settings-section__lead" role="status" data-instruction-tools-notice>
          {state.notice}
        </p>
      )}
    </div>
  );
});
