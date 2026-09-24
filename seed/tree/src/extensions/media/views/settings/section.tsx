import { $, component$, useSignal, useStore, useVisibleTask$ } from "@builder.io/qwik";

import type { ServiceView, SignInState } from "../../server/media";
import { ICONS, shortName } from "../../lib/models";

/**
 * The generators, in the settings tab (`BO_0273_014`).
 *
 * **The way in comes first.** Each service leads with its standing and its
 * Sign in button, and what a flow needs — the URL to open, the code and state
 * to paste back — stands with it. A workspace is picked once signed in, from
 * the account's own, because its id is only knowable then (`BO_0273_042`).
 * Which models are offered is the owner's configuration and comes after: it
 * was above the
 * button once, and the button went off the bottom of the screen
 * (`BO_0273_033`).
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
  const offered = useSignal<readonly string[]>([]);
  const named = useSignal<readonly string[]>([]);
  // What the owner calls each model and the icon they gave it, by
  // `<service>:<model>`. Empty leaves the extension's own. BO_0273_037
  const names = useSignal<Record<string, string>>({});
  const icons = useSignal<Record<string, string>>({});
  const naming = useSignal("");
  // What each offered model takes, as the vendor last described it. The row
  // shows it, so an owner sees what a model will offer before anyone sends to
  // it. BO_0279_011
  const axes = useSignal<Record<string, { axis: string; values: string[] }[]>>({});
  const asking = useSignal("");
  const code = useSignal("");
  const state = useSignal("");

  const read$ = $(async () => {
    const [all, chosen] = await Promise.all([
      fetch("/api/x/media/services"),
      fetch("/api/x/media/offered"),
    ]);
    services.value = all.ok ? ((await all.json()).services ?? []) : [];
    if (chosen.ok) {
      const held = (await chosen.json()) as {
        models?: string[];
        named?: string[];
        names?: Record<string, string>;
        icons?: Record<string, string>;
        axes?: Record<string, { axis: string; values: string[] }[]>;
      };
      offered.value = held.models ?? [];
      named.value = held.named ?? [];
      axes.value = held.axes ?? {};
      names.value = held.names ?? {};
      icons.value = held.icons ?? {};
    }
    loading.value = false;
  });

  const keep$ = $(async (models: readonly string[], jobTypes: readonly string[]) => {
    offered.value = models;
    named.value = jobTypes;
    const answer = await fetch("/api/x/media/offered", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ models, named: jobTypes, names: names.value, icons: icons.value }),
    });
    if (!answer.ok) {
      note.value = "Only the owner can change what is offered.";
      return;
    }
    // A model just offered has nothing captured yet. BO_0279_011
    await capture$();
  });

  /** What the owner calls a model, and the icon it wears in the agent menu. */
  const call$ = $(async (key: string, name: string, icon: string) => {
    const nextNames = { ...names.value };
    const nextIcons = { ...icons.value };
    // An empty field is not a name: it gives the model back the extension's.
    if (name.trim() === "") delete nextNames[key];
    else nextNames[key] = name.trim();
    if (icon === "") delete nextIcons[key];
    else nextIcons[key] = icon;
    names.value = nextNames;
    icons.value = nextIcons;
    await keep$(offered.value, named.value);
  });

  /**
   * Asks the vendor what each offered model takes and keeps it
   * (`BO_0279_011`, `BO_0279_015`). Run when this section opens and whenever a
   * model is offered, so a vendor that adds a resolution is not invisible; a
   * row's *Ask again* runs it for one. Free, and never on the path of a press.
   */
  const capture$ = $(async (model?: string) => {
    asking.value = model ?? "all";
    const answer = await fetch("/api/x/media/offered/axes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(model === undefined ? {} : { model }),
    });
    asking.value = "";
    if (!answer.ok) {
      note.value = "What the models take could not be read just now.";
      return;
    }
    const held = (await answer.json()) as { axes?: Record<string, { axis: string; values: string[] }[]> };
    axes.value = held.axes ?? {};
  });

  useVisibleTask$(async () => {
    await read$();
    await capture$();
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

          {/* The way in, before anything else on the row. BO_0273_033 */}
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

          {/* The owner's configuration, after the way in. */}
          <details class="generators__offering">
            <summary>Which models are offered</summary>
            <ul class="generators__models">
              {service.models.map((model) => {
                const key = `${service.service}:${model.model}`;
                const on = offered.value.length === 0 || offered.value.includes(key);
                return (
                  <li key={model.model}>
                    <label>
                      <input
                        type="checkbox"
                        data-media-offer={key}
                        checked={on}
                        onChange$={() => {
                          const all = services.value.flatMap((one) =>
                            one.models.map((each) => `${one.service}:${each.model}`),
                          );
                          const now = offered.value.length === 0 ? all : [...offered.value];
                          void keep$(on ? now.filter((one) => one !== key) : [...now, key], named.value);
                        }}
                      />
                      <code>{model.model}</code>{" "}
                      <span>{model.kind === "video" ? "moving picture" : "picture"}</span>
                    </label>
                    {/* What this model lets a person choose, as the vendor last
                        described it. A model whose axes could not be read is
                        offered anyway and says so: a press then sends no
                        options and the vendor applies its own defaults.
                        BO_0279_011 BO_0279_014 */}
                    <span class="generators__takes" data-media-axes={key}>
                      {(axes.value[key] ?? []).length > 0 ? (
                        (axes.value[key] ?? []).map((axis) => (
                          <span key={axis.axis} class="generators__axis">
                            {axis.axis} <code>{axis.values.join(" · ")}</code>
                          </span>
                        ))
                      ) : (
                        <span class="generators__axis">options not read</span>
                      )}
                      <button
                        type="button"
                        data-media-ask-again={key}
                        disabled={asking.value !== ""}
                        onClick$={() => capture$(key)}
                      >
                        {asking.value === key ? "Asking…" : "Ask again"}
                      </button>
                    </span>
                    {/* What it is called and what it wears in the agent menu.
                        Empty gives it the extension's own back. BO_0273_037 */}
                    <span class="generators__calling">
                      <input
                        type="text"
                        data-media-name={key}
                        placeholder={shortName(model.model)}
                        value={names.value[key] ?? ""}
                        onChange$={(_, element) =>
                          call$(key, element.value, icons.value[key] ?? "")
                        }
                      />
                      <select
                        data-media-icon={key}
                        value={icons.value[key] ?? ""}
                        onChange$={(_, element) =>
                          call$(key, names.value[key] ?? "", element.value)
                        }
                      >
                        <option value="">
                          {model.kind === "video" ? "film strip" : "picture"}
                        </option>
                        {ICONS.map((icon) => (
                          <option key={icon} value={icon}>
                            {icon.replace("-", " ")}
                          </option>
                        ))}
                      </select>
                    </span>
                  </li>
                );
              })}
              {named.value.map((model) => (
                <li key={`named-${model}`}>
                  <code data-media-named={model}>{model}</code>{" "}
                  <span class="generators__calling">
                    <input
                      type="text"
                      data-media-name={`${service.service}:${model}`}
                      placeholder={model}
                      value={names.value[`${service.service}:${model}`] ?? ""}
                      onChange$={(_, element) =>
                        call$(`${service.service}:${model}`, element.value,
                              icons.value[`${service.service}:${model}`] ?? "")
                      }
                    />
                  </span>{" "}
                  <button type="button" data-media-unname={model}
                          onClick$={() => keep$(offered.value, named.value.filter((one) => one !== model))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            {service.openSet["video"] === true && (
              <div class="generators__field">
                <span>Its moving-picture models are not a fixed list. Name a job type:</span>
                <input type="text" data-media-name-job value={naming.value}
                       onInput$={(_, element) => (naming.value = element.value)} />
                <button
                  type="button"
                  data-media-add-job
                  onClick$={() => {
                    const one = naming.value.trim();
                    if (one === "") return;
                    naming.value = "";
                    void keep$(offered.value, [...named.value, one]);
                  }}
                >
                  Offer it
                </button>
              </div>
            )}
          </details>
        </section>
      ))}

      {note.value !== null && <p data-media-note>{note.value}</p>}
    </div>
  );
});
