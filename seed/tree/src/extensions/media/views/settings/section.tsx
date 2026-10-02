import { $, component$, useSignal, useStore, useVisibleTask$ } from "@builder.io/qwik";

import type { ServiceView, SignInState } from "../../server/media";

/**
 * The generators, in the settings tab (`BO_0273_014`).
 *
 * **The way in comes first.** Each service leads with its standing and its
 * Sign in button, and what a flow needs — the URL to open, the code and state
 * to paste back — stands with it. A workspace is picked once signed in, from
 * the account's own, because its id is only knowable then (`BO_0273_042`).
 * Nothing else stands here: which model makes what is a format's to say, and
 * every model a vendor offers is suggested there under its own name
 * (`calliopa-bootstrap`'s `BO_0336_021`).
 *
 * Signing in runs that vendor's own browser login; the credential stays in the
 * vendor's home and never passes through Calliopa, as for Codex and Claude.
 * Both vendors finish on a loopback redirect inside the service's container,
 * and **OpenArt picks a fresh port for every flow**, so its redirect can never
 * be caught from your browser — the code and state are pasted back instead.
 */

interface Flow {
  id: string;
  service: string;
  state: SignInState | null;
}

export const GeneratorsSection = component$(() => {
  const services = useSignal<readonly ServiceView[]>([]);
  const loading = useSignal(true);
  const note = useSignal<string | null>(null);
  const flow = useStore<Flow>({ id: "", service: "", state: null });
  const code = useSignal("");
  const state = useSignal("");

  const read$ = $(async () => {
    const all = await fetch("/api/x/media/services");
    // The generators signed in to here; Codex, which the roster also answers,
    // is signed in under Agents. BO_0312_063
    services.value = (all.ok ? (((await all.json()) as { services?: readonly ServiceView[] }).services ?? []) : []).filter(
      (service) => service.service === "higgsfield" || service.service === "openart",
    );
    loading.value = false;
  });

  useVisibleTask$(async () => {
    await read$();
  });

  useVisibleTask$(({ track, cleanup }) => {
    const id = track(() => flow.id);
    if (id === "") return;
    let stopped = false;
    const tick = async () => {
      const answer = await fetch(`/api/x/media/sign-in?id=${encodeURIComponent(id)}`);
      if (stopped) return;
      flow.state = answer.ok ? await answer.json() : null;
      const status = flow.state?.status;
      if (status === "succeeded" || status === "failed" || status === "superseded") {
        flow.id = "";
        await read$();
        return;
      }
      if (!stopped) setTimeout(() => void tick(), 1000);
    };
    setTimeout(() => void tick(), 500);
    cleanup(() => {
      stopped = true;
    });
  });

  const signIn$ = $(async (service: string) => {
    note.value = null;
    const answer = await fetch("/api/x/media/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service }),
    });
    if (!answer.ok) {
      note.value = ((await answer.json()) as { error?: string }).error ?? "The sign-in did not start.";
      return;
    }
    const started = (await answer.json()) as { id: string };
    flow.id = started.id;
    flow.service = service;
    flow.state = null;
  });

  /** Picks the workspace a service submits into. Spends nothing. BO_0273_042 */
  const choose$ = $(async (service: string, workspace: string) => {
    note.value = null;
    if (workspace === "") return;
    const answer = await fetch("/api/x/media/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service, workspace }),
    });
    if (!answer.ok) {
      note.value =
        ((await answer.json()) as { error?: string }).error ?? "The workspace was not taken.";
    }
    // Either way: the listing says which is selected, and it is the truth here.
    await read$();
  });

  const hand$ = $(async () => {
    const answer = await fetch("/api/x/media/sign-in/redirect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: flow.service, id: flow.id, code: code.value, state: state.value }),
    });
    note.value = answer.ok ? null : "The flow, the code and the state are all needed.";
    if (answer.ok) {
      code.value = "";
      state.value = "";
    }
  });

  return (
    <div class="generators" data-media-generators>
      {loading.value && <p>Reading the generators…</p>}

      {!loading.value && services.value.length === 0 && (
        <p data-media-absent>The media service is not answering, so nothing can be made yet.</p>
      )}

      {services.value.map((service) => (
        <section key={service.service} class="generators__service" data-media-service={service.service}>
          <h4>{service.service === "higgsfield" ? "Higgsfield" : "OpenArt"}</h4>

          <p data-media-signed-in={String(service.signedIn)}>
            {service.signedIn ? "Signed in." : (service.reason ?? "Not signed in.")}
          </p>

          {/* The way in, before anything else on the row, where there is
            one. BO_0273_033 BO_0319_043 */}
          {!(service.unavailable ?? false) && (
          <div class="generators__entry">
            <button
              type="button"
              data-media-sign-in={service.service}
              disabled={flow.id !== ""}
              onClick$={() => signIn$(service.service)}
            >
              {service.signedIn ? "Sign in again" : "Sign in"}
            </button>
          </div>
          )}

          {flow.id !== "" && flow.service === service.service && (
            <div class="generators__flow" data-media-flow={service.service}>
              {flow.state?.url !== undefined && flow.state.url !== "" && (
                <p>
                  <a href={flow.state.url} target="_blank" rel="noreferrer" data-media-url>
                    Open {service.service} to approve this sign-in
                  </a>
                </p>
              )}
              {flow.state?.status === "awaiting_redirect" && (
                <div data-media-redirect>
                  <p>
                    Approve it, then copy <code>code</code> and <code>state</code> out of the
                    address of the page it lands on — that page cannot load, which is expected.
                  </p>
                  <label class="generators__field">
                    <span>code</span>
                    <input type="text" data-media-code value={code.value}
                           onInput$={(_, element) => (code.value = element.value)} />
                  </label>
                  <label class="generators__field">
                    <span>state</span>
                    <input type="text" data-media-state value={state.value}
                           onInput$={(_, element) => (state.value = element.value)} />
                  </label>
                  <button type="button" data-media-hand-back onClick$={hand$}>
                    Finish signing in
                  </button>
                </div>
              )}
              {flow.state?.status === "failed" && (
                <p data-media-failed>The sign-in did not finish. {flow.state.output ?? ""}</p>
              )}
            </div>
          )}

          {service.workspaces !== null && service.workspaces.length > 0 && (
            <label class="generators__field" data-media-workspaces={service.service}>
              <span>Workspace</span>
              <select
                data-media-workspace
                value={service.workspaces.find((held) => held.selected)?.id ?? ""}
                onChange$={(_, element) => choose$(service.service, element.value)}
              >
                {/* Nothing is selected until the owner picks: an unselected account
                    must not read as having chosen the first row. */}
                <option value="">Choose a workspace</option>
                {service.workspaces.map((held) => (
                  // One string: an `<option>` takes a single text child.
                  <option key={held.id} value={held.id}>
                    {`${held.name}${held.plan === null ? "" : ` — ${held.plan}`}${
                      held.credits === null ? "" : `, ${held.credits} credits`
                    }`}
                  </option>
                ))}
              </select>
            </label>
          )}

          {service.service === "higgsfield" && (
            <p class="generators__aside">
              {service.signedIn && !(service.workspaces ?? []).some((held) => held.selected)
                ? "Pick a workspace: Higgsfield refuses every generation until one is chosen."
                : "Making a picture needs a paid plan; a free plan refuses every submission before a job exists, so nothing is spent."}
            </p>
          )}

        </section>
      ))}

      {note.value !== null && <p data-media-note>{note.value}</p>}
    </div>
  );
});
