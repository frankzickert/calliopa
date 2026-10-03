import { $, component$, useStore, useVisibleTask$ } from "@builder.io/qwik";

import type { LockState } from "./server/lock";

/**
 * The app lock in the settings tab (`BO_0319_048`), drawn on a device alone:
 * an instance's lock route answers 404, and then nothing is drawn. Off until
 * the owner turns it on; turning it on asks the device first, so the lock is
 * one the person has just opened.
 */
export const LockSection = component$(() => {
  const state = useStore<{ lock: LockState | null; busy: boolean; notice: string }>({
    lock: null,
    busy: false,
    notice: "",
  });

  useVisibleTask$(async () => {
    const response = await fetch("/api/x/settings/lock").catch(() => null);
    state.lock = response?.ok ? ((await response.json()) as LockState) : null;
  });

  const set$ = $(async (on: boolean) => {
    state.busy = true;
    state.notice = "";
    try {
      const response = await fetch("/api/x/settings/lock", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ on }),
      });
      const answer = (await response.json().catch(() => ({}))) as LockState & { error?: string };
      if (!response.ok) {
        state.notice = answer.error ?? `The lock could not be changed (${response.status}).`;
        return;
      }
      state.lock = answer;
    } finally {
      state.busy = false;
    }
  });

  const lock = state.lock;
  if (lock === null) return null;
  return (
    <section class="settings-section" aria-labelledby="settings-lock" data-settings-lock>
      <h2 class="settings-section__heading" id="settings-lock">
        App lock
      </h2>
      <p class="settings-section__lead">
        Ask for this device's biometrics or passcode when Calliopa opens and when it comes back from the
        background.
      </p>
      <label class="connection__controls">
        <input
          type="checkbox"
          data-settings-lock-toggle
          checked={lock.on}
          disabled={state.busy || (!lock.available && !lock.on)}
          onChange$={(_, element) => set$(element.checked)}
        />
        <span>{lock.on ? "On" : "Off"}</span>
      </label>
      {!lock.available && (
        <p class="settings-section__lead" data-settings-lock-unavailable>
          This device has no biometrics or passcode set up, so it cannot lock the app.
        </p>
      )}
      {state.notice !== "" && (
        <p class="settings-section__lead" role="status" data-settings-lock-notice>
          {state.notice}
        </p>
      )}
    </section>
  );
});
