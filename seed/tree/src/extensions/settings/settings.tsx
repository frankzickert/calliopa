import {
  $,
  component$,
  useSignal,
  useStore,
  useVisibleTask$,
} from "@builder.io/qwik";

import {
  agentNeeds,
  CHANNEL_CONFIGURATION,
  CONNECTION_PARTY_DETAIL,
  isChannelParty,
  type ChannelParty,
  type ConnectionParty,
  type ConnectionRecord,
} from "~/lib/connections";
import type { ViewProps } from "~/components/shell/view-host";
import type { LoginState } from "./server/adapters";

/**
 * The instance's settings, mounted like any other view. The tab is sectioned;
 * `Connections` is the first section and `Channels` the second, and further
 * sections arrive with the changes that need them.
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

  const read$ = $(async () => {
    const response = await fetch("/api/settings/connections");
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
      const asked = await fetch("/api/settings/agent/login", {
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
        const reported = await fetch("/api/settings/agent/login");
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
    await fetch("/api/settings/agent/code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
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
    await read$();

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

        {state.error !== null && !isChannelParty(state.errorParty ?? "") && (
          <p class="settings-error" role="alert">
            {state.error}
          </p>
        )}

        {state.loaded && state.rows.length === 0 && (
          <p class="settings-empty">No connections.</p>
        )}

        <ul class="connection-list">
          {state.rows
            .filter((row) => !isChannelParty(row.party))
            .map((row) => {
              const detail =
                CONNECTION_PARTY_DETAIL[row.party as ConnectionParty];
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
                      {detail?.name ?? row.party}
                    </h3>
                    <p class="connection__purpose">{detail?.purpose ?? ""}</p>
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
                          {CONNECTION_PARTY_DETAIL[
                            row.agent?.runtime as ConnectionParty
                          ]?.name ??
                            row.agent?.runtime ??
                            "its runtime"}
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
                                  aria-label={`${detail?.name ?? row.party} code`}
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
                                {detail?.name ?? row.party}
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
                          aria-label={`${detail?.name ?? row.party} key`}
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
                            `/api/settings/connections/${row.party}`,
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
                            `/api/settings/connections/${row.party}/test`,
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
                            `/api/settings/connections/${row.party}`,
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

        {state.error !== null && isChannelParty(state.errorParty ?? "") && (
          <p class="settings-error" role="alert">
            {state.error}
          </p>
        )}

        <ul class="connection-list">
          {state.rows
            .filter((row) => isChannelParty(row.party))
            .map((row) => {
              const party = row.party as ChannelParty;
              const detail = CONNECTION_PARTY_DETAIL[row.party];
              const fields = CHANNEL_CONFIGURATION[party];
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
                      {detail?.name ?? row.party}
                    </h3>
                    <p class="connection__purpose">{detail?.purpose ?? ""}</p>
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
                          aria-label={`${detail?.name ?? row.party} ${field.label.toLowerCase()}`}
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
                        aria-label={`${detail?.name ?? row.party} key`}
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
                          `/api/settings/connections/${row.party}`,
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
                          `/api/settings/connections/${row.party}/test`,
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
                          `/api/settings/connections/${row.party}`,
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
    </div>
  );
});
