import { $, component$, useStore, useVisibleTask$ } from "@builder.io/qwik";

import { STYLES, type StyleId } from "../lib/styles";
import "./bibliography.css";

/**
 * The bibliography's Settings section (`BO_0291_020`): the instance's
 * default citation style, IEEE on a fresh install, chosen by the owner from
 * the shipped styles. A document may override it for itself (`BO_0291_037`).
 * The kernel refuses anyone but the owner, and the refusal is said here.
 */
export const StyleSettings = component$(() => {
  const state = useStore<{ style: StyleId | null; notice: string; saving: boolean }>({ style: null, notice: "", saving: false });

  useVisibleTask$(async () => {
    try {
      const response = await fetch("/api/x/bibliography/settings");
      if (response.ok) state.style = ((await response.json()) as { style: StyleId }).style;
    } catch {
      state.notice = "The citation style could not be read.";
    }
  });

  const choose$ = $(async (style: StyleId) => {
    state.saving = true;
    state.notice = "";
    try {
      const response = await fetch("/api/x/bibliography/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ style }),
      });
      if (!response.ok) {
        const answer = (await response.json().catch(() => ({}))) as { detail?: string; error?: string };
        state.notice = answer.detail ?? answer.error ?? `The style could not be set (${response.status}).`;
        return;
      }
      state.style = style;
      state.notice = "Saved. Documents that do not choose their own style use it from their next read.";
    } finally {
      state.saving = false;
    }
  });

  return (
    <div class="bib-settings" data-bibliography-settings>
      <label class="bib-work__field">
        <span>Citation style</span>
        <select disabled={state.style === null || state.saving} onChange$={(_, element) => choose$(element.value as StyleId)}>
          {STYLES.map((style) => (
            <option key={style.id} value={style.id} selected={style.id === state.style}>
              {style.name}
            </option>
          ))}
        </select>
      </label>
      <p class="bib-work__fetched">How citations and reference lists read in every document that does not choose its own style.</p>
      {state.notice !== "" && <p class="bib-work__fetched" role="status">{state.notice}</p>}
    </div>
  );
});
