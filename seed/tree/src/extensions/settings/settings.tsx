import {
  $,
  component$,
  useContext,
  useSignal,
  useStore,
  useVisibleTask$,
} from "@builder.io/qwik";

import { agentNeeds, type ConnectionRecord, type HermesModel } from "~/lib/connections";
import type { ViewProps } from "~/components/shell/view-host";
import type { LoginState } from "~/server/agent/adapters";
import type { AccountListing, AccountView, LicenceView } from "~/server/kernel/accounts";
import type { Person } from "~/server/session";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import { candidates, fetchReleases, parseReleases } from "~/lib/releases";
import type { UpdateView } from "~/server/kernel/update";

/**
 * The instance's settings, mounted like any other view. The tab is sectioned;
 * `Connections` is the first section, `Channels` the second and `People` the
 * third, and further sections arrive with the changes that need them.
 *
 * The two are split because they read as different things to the person
 * entering credentials: a connection is a service Calliopa needs to run, a
 * channel is somewhere the author's work goes. Holding a channel's credential
 * grants no authority to publish with it.
 *
 * A stored key never reaches this component. A row is told whether a key is
 * set and its last characters, which is the whole of what the API says about
 * one, so there is nothing here that could render a secret.
 */

/**
 * How often the rows are re-read while the agent is not doing its work. Slow
 * enough to be free, quick enough that a reader coming back from a terminal
 * sees the agent catch up rather than wondering whether it did.
 */
const AGENT_POLL_MS = 5000;

const STATE_WORDS: Readonly<Record<ConnectionRecord["state"], string>> = {
  unconfigured: "No key",
  configured: "Key set, not tested",
  verified: "Verified",
  failing: "Failing",
};

interface ConnectionsState {
  rows: ConnectionRecord[];
  loaded: boolean;
  /** The party a request is in flight for, so one row at a time reports work. */
  busy: string | null;
  error: string | null;
  /**
   * Which party the error belongs to, so a refusal is shown in the section the
   * reader was acting in rather than in whichever one happens to render first.
   */
  errorParty: string | null;
}

export const SettingsView = component$<ViewProps>(() => {
  const bridge = useContext(ViewBridgeContext);
  /**
   * The Update entry: the owner's alone — anyone else is refused by the
   * kernel and sees no entry — saying the installed release and whether a
   * newer one exists, and opening the Update tab. BO_0223_014
   */
  const update = useStore<{ info: UpdateView | null; shown: boolean; line: string }>({
    info: null,
    shown: false,
    line: "",
  });
  const readUpdate$ = $(async () => {
    try {
      const response = await fetch("/api/x/settings/update");
      if (!response.ok) {
        update.shown = false;
        return;
      }
      update.info = (await response.json()) as UpdateView;
      update.shown = true;
      if (!update.info.updateCheck) {
        update.line = "The release check is off.";
        return;
      }
      const raw = await fetchReleases();
      if (raw === null) {
        update.line = "GitHub could not be reached.";
        return;
      }
      const found = candidates(update.info.release, parseReleases(raw));
      update.line = found.length === 0 ? "This instance is on the newest release." : `Update available: ${found[0]?.release.version}.`;
    } catch {
      update.shown = false;
    }
  });
  const openUpdate$ = $(async () => {
    await bridge.openTarget$({ kind: "settings:update", itemId: "instance", title: "Update" });
  });
  const state = useStore<ConnectionsState>({
    rows: [],
    loaded: false,
    busy: null,
    error: null,
    errorParty: null,
  });
  const entered = useSignal("");
  /**
   * What the reader has typed into a channel's fields, keyed by party and
   * field. A key absent means untouched, so the stored value is what shows —
   * an address is readable, unlike the key beside it.
   */
  const channelField = useStore<Record<string, string>>({});
  const channelKey = useStore<Record<string, string>>({});
  /** What the copy control last managed, said where the reader is looking. */
  const copied = useSignal("");
  /** The sign-in in flight: which runtime, what the broker last reported,
   * whatever code the flow has asked the human to paste back, and whether that
   * code has been handed over. The broker says the same thing by moving
   * `awaiting` to `cli`, a poll later; `sent` is what closes the field the
   * moment it is spent, so nothing invites a second code that would be wrong. */
  const login = useStore<{
    runtime: string | null;
    state: LoginState | null;
    code: string;
    sent: boolean;
  }>({ runtime: null, state: null, code: "", sent: false });

  /**
   * The people who hold authority, as the kernel answers them for the
   * signed-in person: nothing here is load-bearing. The list is read per
   * request and cached nowhere; every control is a call the core refuses on
   * its own terms, and a refusal is shown in the core's words with its code.
   * BO_0209_004 BO_0209_005
   */
  const people = useStore<{
    me: Person | null;
    listing: AccountListing | null;
    licence: LicenceView | null;
    loaded: boolean;
    /** The list is the owner's to read; a person who is not sees their own row's controls alone. */
    forbidden: boolean;
    busy: string | null;
    error: string | null;
    code: string | null;
    create: { name: string; class: string; password: string };
    own: { current: string; next: string; done: string | null };
  }>({
    me: null,
    listing: null,
    licence: null,
    loaded: false,
    forbidden: false,
    busy: null,
    error: null,
    code: null,
    create: { name: "", class: "agent", password: "" },
    own: { current: "", next: "", done: null },
  });

  const readPeople$ = $(async () => {
    const me = await fetch("/api/x/settings/people/me");
    people.me = me.ok ? ((await me.json()) as Person | null) : null;
    const listed = await fetch("/api/x/settings/people");
    if (listed.ok) {
      people.listing = (await listed.json()) as AccountListing;
      people.forbidden = false;
    } else {
      people.listing = null;
      people.forbidden = listed.status === 403;
      if (listed.status !== 403) {
        const refused = (await listed.json()) as { error?: string; code?: string };
        people.error = refused.error ?? "The people could not be read.";
        people.code = refused.code ?? null;
      }
    }
    // The licence is the owner's to read; anyone else is told nothing, which
    // is not an error worth showing.
    const licence = await fetch("/api/x/settings/people/licence");
    people.licence = licence.ok ? ((await licence.json()) as LicenceView) : null;
    people.loaded = true;
  });

  /** One call to the kernel as the person, then a re-read: the rows are the server's answer. */
  const act$ = $(async (busy: string, path: string, body: unknown): Promise<boolean> => {
    people.busy = busy;
    people.error = null;
    people.code = null;
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const refused = (await response.json()) as { error?: string; code?: string };
        people.error = refused.error ?? "The request failed.";
        people.code = refused.code ?? null;
        return false;
      }
      await readPeople$();
      return true;
    } catch {
      people.error = "The request could not be made.";
      return false;
    } finally {
      people.busy = null;
    }
  });

  const read$ = $(async () => {
    const response = await fetch("/api/x/settings/connections");
    if (!response.ok) {
      state.error = "The connections could not be read.";
      state.loaded = true;
      return;
    }
    state.rows = (await response.json()) as ConnectionRecord[];
    state.loaded = true;
  });

  // The rows are the server's answer, so every request re-reads rather than
  // patching a row in the browser and hoping the two agree.
  /**
   * Asks the agent to run a runtime's own sign-in flow, and follows it.
   *
   * The flow belongs to the runtime and runs in the agent's container; what
   * arrives here is what the human must act on — where to go and the one-time
   * code to type — and, when the flow asks for one, a field to paste its code
   * back into. Nothing that could sign in again ever reaches this surface.
   */
  const signIn$ = $(async (party: string) => {
    state.busy = party;
    state.error = null;
    login.runtime = party;
    login.state = null;
    login.code = "";
    login.sent = false;
    try {
      const asked = await fetch("/api/x/settings/agent/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runtime: party }),
      });
      if (!asked.ok) {
        const refused = (await asked.json()) as { error?: string };
        state.error = refused.error ?? "The sign-in could not be started.";
        return;
      }
      // The broker writes its progress as it goes; this follows it until the
      // flow ends rather than asking once and leaving the reader guessing.
      //
      // If nothing answers at all the agent is not running, and saying so
      // beats a control that stays disabled for as long as a login could have
      // taken. Once the flow has spoken once, it is given the time a human
      // needs to go and sign in.
      for (let attempt = 0; attempt < 900; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const reported = await fetch("/api/x/settings/agent/login");
        const answered = reported.ok
          ? ((await reported.json()) as LoginState | null)
          : null;
        if (answered !== null && answered.runtime === party) {
          login.state = answered;
          if (answered.status !== "running") break;
        }
        if (login.state === null && attempt >= 14) {
          state.error =
            "The agent is not answering. It may not be running yet.";
          break;
        }
      }
      await read$();
    } catch {
      state.error = "The agent could not be reached.";
    } finally {
      state.busy = null;
    }
  });

  /**
   * Hands the broker the code the flow asked for.
   *
   * Sending is a deliberate gesture: the button, or `Enter` in the field.
   * Leaving the field is not one — a code typed and then clicked away from
   * would be spent by a reader who had not decided to spend it.
   */
  /**
   * Copies the one command the product cannot run for the reader.
   *
   * The clipboard is not always reachable — a page served over plain HTTP has
   * no access to it at all — and a control that silently did nothing would be
   * worse than none, so what happened is said either way.
   */
  const copyCommand$ = $(async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      copied.value = "Copied.";
    } catch {
      copied.value = "This page cannot reach the clipboard. Copy it by hand.";
    }
  });

  const sendCode$ = $(async () => {
    const code = login.code.trim();
    if (code === "") return;
    login.code = "";
    login.sent = true;
    await fetch("/api/x/settings/agent/code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
  });

  /**
   * What Hermes's own loop reasons with, set from the agent's row. The kernel
   * writes the choice and the agent applies it when its gateway restarts, so
   * the row says it is switching until the agent's stamp agrees, and reads
   * the stamp again while it restarts. BO_0228_012
   */
  const hermesAsked = useSignal<HermesModel | null>(null);
  const setHermesModel$ = $(async (model: HermesModel) => {
    state.busy = "hermes";
    state.error = null;
    state.errorParty = null;
    try {
      const response = await fetch("/api/x/settings/agent/hermes-model", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model }),
      });
      if (!response.ok) {
        const refused = (await response.json().catch(() => ({}))) as { error?: string };
        state.error = refused.error ?? "What Hermes reasons with could not be set.";
        state.errorParty = "hermes";
        return;
      }
      hermesAsked.value = model;
      for (const delay of [4000, 10000, 20000]) setTimeout(() => void read$(), delay);
    } catch {
      state.error = "The request could not be made.";
    } finally {
      state.busy = null;
    }
  });

  const request$ = $(async (party: string, path: string, init: RequestInit) => {
    state.busy = party;
    state.error = null;
    state.errorParty = null;
    try {
      const response = await fetch(path, init);
      const answered = (await response.json()) as
        ConnectionRecord | { error?: string };
      if (!response.ok) {
        state.error =
          (answered as { error?: string }).error ?? "The request failed.";
        state.errorParty = party;
        return;
      }
      state.rows = state.rows.map((row) =>
        row.party === party ? (answered as ConnectionRecord) : row,
      );
    } catch {
      state.error = "The request could not be made.";
    } finally {
      state.busy = null;
    }
  });

  // The first read happens in the browser. A task that ran during server
  // rendering is not run again when the page resumes, so a restored settings
  // tab would come back with no rows at all.
  useVisibleTask$(async ({ cleanup }) => {
    await readUpdate$();
    await read$();
    await readPeople$();

    // The step the reader takes at a terminal ends in the agent restarting,
    // not the application, so nothing else would bring this row to the truth.
    // The interval stops as soon as the agent is doing its work: a surface
    // that keeps asking after the answer has stopped changing is a cost with
    // no reader. Memory is not waited on, because it blocks nothing.
    // CA_0026_005
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    timer = setInterval(() => {
      if (!agentNeeds(state.rows).some((need) => need.blocking)) {
        stop();
        return;
      }
      // A request of the reader's own is already re-reading the rows, and a
      // sign-in follows its own flow. Neither is raced.
      if (state.busy === null) void read$();
    }, AGENT_POLL_MS);
    cleanup(stop);
  });

  // A refusal is shown in the section the reader was acting in; which one is
  // read off the row's descriptor rather than a roster the browser holds.
  const errorInChannel =
    state.rows.find((row) => row.party === state.errorParty)?.channel ?? false;

  return (
    <div class="view view--settings" data-view-body="settings">
      <section class="settings-section" aria-labelledby="settings-connections">
        <h2 class="settings-section__heading" id="settings-connections">
          Connections
        </h2>
        <p class="settings-section__lead">
          Keys Calliopa presents to the services it reaches. A key is entered
          once and never shown again.
        </p>

        {state.error !== null && !errorInChannel && (
          <p class="settings-error" role="alert">
            {state.error}
          </p>
        )}

        {state.loaded && state.rows.length === 0 && (
          <p class="settings-empty">No connections.</p>
        )}

        <ul class="connection-list">
          {state.rows
            .filter((row) => !row.channel)
            .map((row) => {
              const busy = state.busy === row.party;
              const needs =
                row.party === "hermes" ? agentNeeds(state.rows) : [];
              return (
                <li
                  class="connection"
                  key={row.party}
                  data-connection={row.party}
                  data-state={row.state}
                >
                  <div class="connection__identity">
                    <h3 class="connection__name">
                      {row.label || row.party}
                    </h3>
                    <p class="connection__purpose">{row.purpose}</p>
                  </div>
                  <p
                    class="connection__state"
                    data-connection-state={row.state}
                  >
                    {STATE_WORDS[row.state]}
                    {row.keySet && (
                      <span class="connection__suffix">
                        {" · key ending "}
                        {row.secretSuffix}
                      </span>
                    )}
                  </p>
                  {row.lastError !== null && row.party !== "hermes" && (
                    <p class="connection__error" role="status">
                      {row.lastError}
                    </p>
                  )}
                  {/* The agent's row is the whole picture: what stands between
                    the agent and its work, whichever row fixes it. Its state
                    words are said here instead of as one error line, because
                    more than one thing can be missing at once. CA_0026_003 */}
                  {row.party === "hermes" && (
                    <div class="agent-report" data-agent-report>
                      {needs.length === 0 ? (
                        <p class="agent-report__ready" data-agent-ready>
                          {"Reasoning on "}
                          {row.agent?.runtime === "hermes"
                            ? "Hermes's own loop"
                            : (state.rows.find((candidate) => candidate.party === row.agent?.runtime)
                                ?.label ??
                              row.agent?.runtime ??
                              "its runtime")}
                          {", with the Calliopa toolset registered."}
                        </p>
                      ) : (
                        <ul class="agent-report__needs" data-agent-needs>
                          {needs.map((need) => {
                            const command = need.command;
                            return (
                              <li
                                class="agent-report__need"
                                key={need.key}
                                data-agent-need={need.key}
                                data-blocking={need.blocking ? "true" : "false"}
                              >
                                {need.text}
                                {/* The command is shown as it must be typed. The
                                client name is what a run's owner is resolved
                                by, so nothing here paraphrases it.
                                CA_0026_004 */}
                                {command !== undefined && (
                                  <span class="agent-report__command">
                                    <code data-agent-command>{command}</code>
                                    <button
                                      type="button"
                                      class="connection__action"
                                      data-agent-copy
                                      onClick$={() =>
                                        copyCommand$(need.command ?? "")
                                      }
                                    >
                                      Copy
                                    </button>
                                    {copied.value !== "" && (
                                      <span
                                        class="agent-report__copied"
                                        role="status"
                                        data-agent-copied
                                      >
                                        {copied.value}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {row.agent !== null && (
                        <p
                          class="agent-report__model"
                          data-hermes-model={row.agent.hermesModel ?? "subscription"}
                        >
                          {"Hermes reasons with "}
                          {row.agent.hermesModel === "provider"
                            ? "the API-key model"
                            : "the ChatGPT subscription"}
                          {row.agent.hermesModelName === undefined
                            ? ""
                            : ` (${row.agent.hermesModelName})`}
                          {"."}
                          {hermesAsked.value !== null &&
                            hermesAsked.value !== (row.agent.hermesModel ?? "subscription") && (
                              <span class="agent-report__switching" role="status" data-hermes-switching>
                                {" Switching to "}
                                {hermesAsked.value === "provider"
                                  ? "the API-key model"
                                  : "the ChatGPT subscription"}
                                {"; the agent restarts to apply it."}
                              </span>
                            )}
                          {row.agent.hermesModel === "provider" ? (
                            <button
                              type="button"
                              class="connection__action"
                              data-hermes-use="subscription"
                              disabled={busy}
                              onClick$={() => setHermesModel$("subscription")}
                            >
                              Use the ChatGPT subscription
                            </button>
                          ) : row.apiKeyModel === true ? (
                            <button
                              type="button"
                              class="connection__action"
                              data-hermes-use="provider"
                              disabled={busy}
                              onClick$={() => setHermesModel$("provider")}
                            >
                              Use the API-key model
                            </button>
                          ) : (
                            <span class="agent-report__hint" data-hermes-hint>
                              {" No API-key model is configured, so the subscription is the one choice. One is configured with "}
                              <code>POST /__kernel/agent/config</code>
                              {", naming an OpenRouter or OpenAI key and a model."}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                  {row.kind === "status" ? (
                    <div class="connection__controls" data-status-controls>
                      {row.status !== null && (
                        <p
                          class="connection__reported"
                          data-connection-reported
                        >
                          {row.status.version === ""
                            ? "installed"
                            : row.status.version}
                          {" · billed to your "}
                          {row.status.billing}
                        </p>
                      )}
                      {/* A status party holds no key, so it is offered none: no
                        field to type one into, nothing to save, nothing to
                        clear. Signing in is the only thing to do here, and
                        only while the runtime is not signed in. */}
                      {row.party !== "hermes" &&
                        !(row.status?.authenticated ?? false) && (
                          <button
                            type="button"
                            class="connection__action"
                            disabled={busy}
                            data-sign-in={row.party}
                            onClick$={() => signIn$(row.party)}
                          >
                            {/* A control that still reads `Sign in` while its
                              flow runs names an action already under way. */}
                            {busy ? "Signing in…" : "Sign in"}
                          </button>
                        )}
                      {login.runtime === row.party && login.state !== null && (
                        <div
                          class="sign-in"
                          data-sign-in-state={login.state.status}
                        >
                          {login.state.url !== undefined && (
                            <p class="sign-in__url">
                              {"Open "}
                              <a
                                href={login.state.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                data-sign-in-url
                              >
                                {login.state.url}
                              </a>
                            </p>
                          )}
                          {login.state.userCode !== undefined && (
                            <p class="sign-in__code" data-sign-in-code>
                              {"and enter "}
                              <strong>{login.state.userCode}</strong>
                            </p>
                          )}
                          {login.state.awaiting === "code" && !login.sent && (
                            <div class="sign-in__ask">
                              <label class="connection__field">
                                <span class="connection__label">
                                  Code from the browser
                                </span>
                                <input
                                  type="text"
                                  class="connection__input"
                                  autoComplete="off"
                                  value={login.code}
                                  data-sign-in-paste
                                  aria-label={`${row.label || row.party} code`}
                                  onInput$={(_, element) =>
                                    (login.code = element.value)
                                  }
                                  onKeyDown$={(event) => {
                                    if (event.key === "Enter") sendCode$();
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                class="connection__action"
                                disabled={login.code.trim() === ""}
                                data-sign-in-send={row.party}
                                onClick$={sendCode$}
                              >
                                Send
                              </button>
                            </div>
                          )}
                          {login.state.status === "running" &&
                            (login.sent || login.state.awaiting === "cli") && (
                              <p
                                class="sign-in__sent"
                                data-sign-in-sent
                                role="status"
                              >
                                {"Code sent. Waiting for "}
                                {row.label || row.party}
                                {" to finish signing in…"}
                              </p>
                            )}
                          {login.state.status === "failed" && (
                            <p class="connection__error" role="status">
                              {/* What the flow said, not a summary of it: a
                                sign-in that failed is only diagnosable in the
                                runtime's own words. */}
                              {(login.state.output ?? "")
                                .trim()
                                .split("\n")
                                .pop() ?? "The sign-in failed."}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div class="connection__controls">
                      <label class="connection__field">
                        <span class="connection__label">
                          {row.keySet ? "Replace key" : "Key"}
                        </span>
                        <input
                          type="password"
                          class="connection__input"
                          autoComplete="off"
                          value={entered.value}
                          placeholder={
                            row.keySet ? "Enter a new key" : "Enter key"
                          }
                          aria-label={`${row.label || row.party} key`}
                          onInput$={(_, element) =>
                            (entered.value = element.value)
                          }
                        />
                      </label>
                      <button
                        type="button"
                        class="connection__action"
                        disabled={busy || entered.value.trim() === ""}
                        onClick$={async () => {
                          await request$(
                            row.party,
                            `/api/x/settings/connections/${row.party}`,
                            {
                              method: "PUT",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ secret: entered.value }),
                            },
                          );
                          entered.value = "";
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        class="connection__action"
                        disabled={busy || !row.keySet}
                        onClick$={() =>
                          request$(
                            row.party,
                            `/api/x/settings/connections/${row.party}/test`,
                            { method: "POST" },
                          )
                        }
                      >
                        Test
                      </button>
                      <button
                        type="button"
                        class="connection__action connection__action--clear"
                        disabled={busy || !row.keySet}
                        onClick$={() =>
                          request$(
                            row.party,
                            `/api/x/settings/connections/${row.party}`,
                            {
                              method: "DELETE",
                            },
                          )
                        }
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
      </section>

      {/* Channels: destinations the author's work goes to. Separate from the
          services above because they read as a different thing to the person
          entering credentials for them, and because a channel holds
          configuration beside its key. CA_0036_005 */}
      <section class="settings-section" aria-labelledby="settings-channels">
        <h2 class="settings-section__heading" id="settings-channels">
          Channels
        </h2>
        <p class="settings-section__lead">
          Where your work is published. A channel holds what it needs to reach
          the destination and the credential it presents; the credential is
          entered once and never shown again. Saving one publishes nothing.
        </p>

        {state.error !== null && errorInChannel && (
          <p class="settings-error" role="alert">
            {state.error}
          </p>
        )}

        <ul class="connection-list">
          {state.rows
            .filter((row) => row.channel)
            .map((row) => {
              const fields = row.fields;
              const busy = state.busy === row.party;
              const typedKey = channelKey[row.party] ?? "";
              const valueOf = (field: string) =>
                channelField[`${row.party}.${field}`] ??
                row.configuration[field] ??
                "";
              return (
                <li
                  class="connection"
                  key={row.party}
                  data-connection={row.party}
                  data-channel={row.party}
                  data-state={row.state}
                >
                  <div class="connection__identity">
                    <h3 class="connection__name">
                      {row.label || row.party}
                    </h3>
                    <p class="connection__purpose">{row.purpose}</p>
                  </div>
                  <p
                    class="connection__state"
                    data-connection-state={row.state}
                  >
                    {STATE_WORDS[row.state]}
                    {row.keySet && (
                      <span class="connection__suffix">
                        {" · key ending "}
                        {row.secretSuffix}
                      </span>
                    )}
                  </p>
                  {row.lastError !== null && (
                    <p class="connection__error" role="status">
                      {row.lastError}
                    </p>
                  )}
                  <div class="connection__controls">
                    {fields.map((field) => (
                      <label class="connection__field" key={field.key}>
                        <span class="connection__label">{field.label}</span>
                        <input
                          type="text"
                          class="connection__input"
                          autoComplete="off"
                          value={valueOf(field.key)}
                          placeholder={field.hint}
                          data-channel-field={field.key}
                          aria-label={`${row.label || row.party} ${field.label.toLowerCase()}`}
                          onInput$={(_, element) =>
                            (channelField[`${row.party}.${field.key}`] =
                              element.value)
                          }
                        />
                      </label>
                    ))}
                    <label class="connection__field">
                      <span class="connection__label">
                        {row.keySet ? "Replace key" : "Key"}
                      </span>
                      <input
                        type="password"
                        class="connection__input"
                        autoComplete="off"
                        value={typedKey}
                        placeholder={
                          row.keySet ? "Enter a new key" : "Enter key"
                        }
                        data-channel-key
                        aria-label={`${row.label || row.party} key`}
                        onInput$={(_, element) =>
                          (channelKey[row.party] = element.value)
                        }
                      />
                    </label>
                    <button
                      type="button"
                      class="connection__action"
                      disabled={
                        busy ||
                        // Nothing to send: no field edited and no key typed.
                        (typedKey.trim() === "" &&
                          fields.every(
                            (field) =>
                              channelField[`${row.party}.${field.key}`] ===
                              undefined,
                          ))
                      }
                      data-channel-save={row.party}
                      onClick$={async () => {
                        const configuration = Object.fromEntries(
                          fields.map((field) => [
                            field.key,
                            valueOf(field.key),
                          ]),
                        );
                        const body: Record<string, unknown> = { configuration };
                        if (typedKey.trim() !== "") body.secret = typedKey;
                        await request$(
                          row.party,
                          `/api/x/settings/connections/${row.party}`,
                          {
                            method: "PUT",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify(body),
                          },
                        );
                        channelKey[row.party] = "";
                        for (const field of fields) {
                          delete channelField[`${row.party}.${field.key}`];
                        }
                      }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      class="connection__action"
                      disabled={busy || !row.keySet}
                      data-channel-test={row.party}
                      onClick$={() =>
                        request$(
                          row.party,
                          `/api/x/settings/connections/${row.party}/test`,
                          { method: "POST" },
                        )
                      }
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      class="connection__action connection__action--clear"
                      disabled={busy || !row.keySet}
                      data-channel-clear={row.party}
                      onClick$={() =>
                        request$(
                          row.party,
                          `/api/x/settings/connections/${row.party}`,
                          { method: "DELETE" },
                        )
                      }
                    >
                      Clear
                    </button>
                  </div>
                </li>
              );
            })}
        </ul>
      </section>

      {/* People: who holds authority in this instance. Read from the kernel as
          the signed-in person and decided by the core; every control here is
          one the core refuses independently, so a fork that redraws this
          section changes nothing about who may write. BO_0209_004 */}
      <section
        class="settings-section"
        aria-labelledby="settings-people"
        data-people
        data-people-loaded={people.loaded ? "true" : "false"}
      >
        <h2 class="settings-section__heading" id="settings-people">
          People
        </h2>
        <p class="settings-section__lead">
          Who holds authority in this instance. A person of class human may
          establish truth; one of class agent may only propose. The core
          decides every change here; this section only asks.
        </p>

        {people.listing !== null && (
          <p class="licence-state" data-licence-state>
            {people.listing.unlimited
              ? `${people.listing.activeHumans} ${people.listing.activeHumans === 1 ? "person" : "people"} may establish`
              : `${people.listing.activeHumans} of ${people.listing.seats} ${people.listing.seats === 1 ? "seat" : "seats"} may establish`}
            {people.licence?.licence !== undefined
              ? ` · licensed to ${people.licence.licence.licensee}, until ${people.licence.licence.expires}`
              : people.listing.unlimited
                ? ""
                : " · no licence installed"}
            {people.licence?.state.warning !== undefined &&
              ` · ${people.licence.state.warning}`}
          </p>
        )}

        {people.error !== null && (
          <p class="settings-error" role="alert" data-people-error={people.code ?? "error"}>
            {people.code !== null && (
              <span class="settings-refusal__code">{people.code}</span>
            )}
            {people.error}
          </p>
        )}

        {people.loaded && people.forbidden && (
          <p class="settings-empty">The people list is the owner's to read.</p>
        )}

        {people.listing !== null && (
          <ul class="connection-list" data-people-list>
            {people.listing.principals.map((row: AccountView) => {
              const me = people.me;
              const isMe = me !== null && me.name === row.name;
              const ownerActing = me !== null && people.listing?.principals.some((p) => p.name === me.name && p.owner) === true;
              const busy = people.busy === row.name;
              return (
                <li
                  class="connection person"
                  key={row.name}
                  data-person={row.name}
                  data-person-kind={row.kind}
                  data-person-class={row.class}
                  data-person-state={row.state}
                >
                  <div class="connection__identity">
                    <h3 class="connection__name">
                      {row.name}
                      {row.owner && <span class="person__owner">owner</span>}
                      {isMe && <span class="person__owner">you</span>}
                    </h3>
                    <p class="person__facts">
                      {row.kind}
                      {" · "}
                      {row.class === "human" ? "may establish" : "proposes"}
                      {row.demotedByExpiry === true && " (demoted by the licence)"}
                    </p>
                  </div>
                  <p class="connection__state">{row.state}</p>
                  <p class="person__facts" data-person-stamps>
                    {row.lastUsedAt === undefined
                      ? "credential never used"
                      : `credential used ${new Date(row.lastUsedAt).toLocaleString()}`}
                    {" · "}
                    {row.lastActiveAt === undefined
                      ? "no live session"
                      : `session active ${new Date(row.lastActiveAt).toLocaleString()}`}
                  </p>
                  {ownerActing && !row.owner && (
                    <div class="connection__controls">
                      {row.state === "active" && (
                        <button
                          type="button"
                          class="connection__action"
                          disabled={busy}
                          data-person-suspend={row.name}
                          onClick$={() =>
                            act$(row.name, `/api/x/settings/people/${row.name}/state`, { state: "suspended" })
                          }
                        >
                          Suspend
                        </button>
                      )}
                      {row.state !== "active" && (
                        <button
                          type="button"
                          class="connection__action"
                          disabled={busy}
                          data-person-resume={row.name}
                          onClick$={() =>
                            act$(row.name, `/api/x/settings/people/${row.name}/state`, { state: "active" })
                          }
                        >
                          {row.state === "retired" ? "Reactivate" : "Resume"}
                        </button>
                      )}
                      {row.state !== "retired" && (
                        <button
                          type="button"
                          class="connection__action connection__action--clear"
                          disabled={busy}
                          data-person-retire={row.name}
                          onClick$={() =>
                            act$(row.name, `/api/x/settings/people/${row.name}/state`, { state: "retired" })
                          }
                        >
                          Retire
                        </button>
                      )}
                      {row.kind === "human" && (
                        <button
                          type="button"
                          class="connection__action"
                          disabled={busy}
                          data-person-class={row.class === "human" ? "agent" : "human"}
                          onClick$={() =>
                            act$(row.name, `/api/x/settings/people/${row.name}/class`, {
                              class: row.class === "human" ? "agent" : "human",
                            })
                          }
                        >
                          {row.class === "human" ? "Set to propose only" : "Let establish"}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {people.listing !== null &&
          people.me !== null &&
          people.listing.principals.some((p) => p.name === people.me?.name && p.owner) && (
            <form
              class="people-form"
              data-people-create
              preventdefault:submit
              onSubmit$={async () => {
                const done = await act$("create", "/api/x/settings/people", people.create);
                if (done) people.create = { name: "", class: "agent", password: "" };
              }}
            >
              <h3 class="people-form__title">Add a person</h3>
              <label class="connection__field">
                <span class="connection__label">Name</span>
                <input
                  class="connection__input"
                  name="name"
                  autocomplete="off"
                  required
                  value={people.create.name}
                  onInput$={(_, element) => (people.create.name = element.value)}
                />
              </label>
              <label class="connection__field">
                <span class="connection__label">May establish truth</span>
                <select
                  class="connection__input"
                  name="class"
                  value={people.create.class}
                  onChange$={(_, element) => (people.create.class = element.value)}
                >
                  <option value="agent" selected={people.create.class === "agent"}>No, proposes only</option>
                  <option value="human" selected={people.create.class === "human"}>Yes</option>
                </select>
              </label>
              <label class="connection__field">
                <span class="connection__label">Initial password, handed over out of band</span>
                <input
                  class="connection__input"
                  name="password"
                  type="password"
                  autocomplete="new-password"
                  required
                  value={people.create.password}
                  onInput$={(_, element) => (people.create.password = element.value)}
                />
              </label>
              <button type="submit" class="connection__action" disabled={people.busy !== null}>
                Add
              </button>
            </form>
          )}

        {people.me !== null && (
          // A person's own password, with the current one: the core accepts the
          // owner or the principal itself and nobody else, and the kernel revokes
          // the person's other sessions on the way. BO_0209_004
          <form
            class="people-form"
            data-people-own-password
            preventdefault:submit
            onSubmit$={async () => {
              const me = people.me;
              if (me === null) return;
              const done = await act$("password", `/api/x/settings/people/${me.name}/password`, {
                password: people.own.next,
                currentPassword: people.own.current,
              });
              people.own = done
                ? { current: "", next: "", done: "Your password is changed; your other sessions are signed out." }
                : { ...people.own, done: null };
            }}
          >
            <h3 class="people-form__title">Your password</h3>
            <label class="connection__field">
              <span class="connection__label">Current password</span>
              <input
                class="connection__input"
                name="currentPassword"
                type="password"
                autocomplete="current-password"
                required
                value={people.own.current}
                onInput$={(_, element) => (people.own.current = element.value)}
              />
            </label>
            <label class="connection__field">
              <span class="connection__label">New password</span>
              <input
                class="connection__input"
                name="password"
                type="password"
                autocomplete="new-password"
                required
                value={people.own.next}
                onInput$={(_, element) => (people.own.next = element.value)}
              />
            </label>
            <button type="submit" class="connection__action" disabled={people.busy !== null}>
              Change
            </button>
            {people.own.done !== null && (
              <p class="sign-in__sent" data-people-password-done>{people.own.done}</p>
            )}
          </form>
        )}
      </section>

      {update.shown && (
        <section class="settings-section" aria-labelledby="settings-update" data-settings-update>
          <h2 class="settings-section__heading" id="settings-update">
            Update
          </h2>
          <p class="settings-section__lead" data-settings-update-line>
            Installed release {update.info?.release === "" ? "unknown" : update.info?.release}. {update.line}
          </p>
          <p class="connection__controls">
            <button type="button" class="connection__action" onClick$={() => openUpdate$()}>
              Open the Update tab
            </button>
          </p>
        </section>
      )}
    </div>
  );
});
