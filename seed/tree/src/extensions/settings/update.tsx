import { $, component$, useContext, useStore, useVisibleTask$ } from "@builder.io/qwik";

import type { ViewProps } from "~/components/shell/view-host";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import { candidates, fetchReleases, parseReleases, type Candidate, type Release } from "~/lib/releases";
import type { UpdateProposal, UpdateView } from "~/server/kernel/update";

/**
 * The Update tab: the installed release, the releases above it worth
 * installing — the newest patch, minor and major — every release on request,
 * and the update itself, started here with one press and followed through
 * to the instance serving the new release. Nothing here decides anything the
 * review path would not: the updater on the host runs the install, the
 * proposal it stages is accepted through the kernel's confirmation, and the
 * release pin moves through the kernel's promotion gate. BO_0223_014
 */

type Phase =
  | "idle"
  | "running"
  | "waiting"
  | "returned"
  | "confirm"
  | "accepted"
  | "promoting"
  | "served"
  | "failed";

interface State {
  info: UpdateView | null;
  /** Why the kernel could not be read, in words; `forbidden` for anyone but the owner. */
  refusal: string | null;
  releases: readonly Release[];
  candidates: readonly Candidate[];
  checked: "unchecked" | "checking" | "checked" | "unreachable" | "off";
  showAll: boolean;
  /** The release the owner chose, while the update runs and after. */
  chosen: string | null;
  phase: Phase;
  detail: string;
  proposal: UpdateProposal | null;
  confirmUrl: string | null;
  busy: boolean;
}

const refusalOf = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: string; code?: string };
    return body.error ?? body.code ?? `the kernel answered ${response.status}`;
  } catch {
    return `the kernel answered ${response.status}`;
  }
};

const versionOf = (view: UpdateView | null): string => view?.release ?? "";

export const UpdateTabView = component$<ViewProps>(() => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<State>({
    info: null,
    refusal: null,
    releases: [],
    candidates: [],
    checked: "unchecked",
    showAll: false,
    chosen: null,
    phase: "idle",
    detail: "",
    proposal: null,
    confirmUrl: null,
    busy: false,
  });

  /** Reads the kernel's answer; `false` when the kernel did not answer at all — a restart in progress. */
  const read$ = $(async (): Promise<boolean> => {
    let response: Response;
    try {
      response = await fetch("/api/x/settings/update");
    } catch {
      return false;
    }
    if (response.status >= 500) return false;
    if (!response.ok) {
      state.refusal = await refusalOf(response);
      state.info = null;
      return true;
    }
    state.refusal = null;
    state.info = (await response.json()) as UpdateView;
    return true;
  });

  const checkReleases$ = $(async (fresh: boolean) => {
    if (state.info === null || !state.info.updateCheck) {
      state.checked = "off";
      return;
    }
    state.checked = "checking";
    const raw = await fetchReleases(fresh);
    if (raw === null) {
      state.checked = "unreachable";
      state.releases = [];
      state.candidates = [];
      return;
    }
    state.releases = parseReleases(raw);
    state.candidates = candidates(versionOf(state.info), state.releases);
    state.checked = "checked";
  });

  const readProposal$ = $(async () => {
    const response = await fetch("/api/x/settings/update/proposal");
    state.proposal = response.ok ? ((await response.json()) as UpdateProposal) : null;
  });

  /**
   * Follows the update after the press: the updater's steps, the restart —
   * during which the kernel stops answering and the tab waits — the kernel
   * back on the chosen release, and then the proposal to review.
   */
  const follow$ = $(async () => {
    const answered = await read$();
    if (!answered) {
      if (state.phase === "running" || state.phase === "waiting") state.phase = "waiting";
      return;
    }
    const info = state.info;
    if (info === null) return;
    if (state.phase === "running" || state.phase === "waiting") {
      if (info.updater.state === "failed" && info.updater.version === state.chosen) {
        state.phase = "failed";
        state.detail = info.updater.exit ?? "the update failed";
        return;
      }
      if (info.updater.state !== "running" && state.chosen !== null && info.release === state.chosen) {
        state.phase = "returned";
        await readProposal$();
      }
      return;
    }
    if (state.phase === "confirm" && info.pending === null) {
      state.phase = "accepted";
      state.confirmUrl = null;
      return;
    }
    if (state.phase === "promoting") {
      const promotion = info.promotion;
      if (promotion === undefined || promotion.status === "running") return;
      if (promotion.status === "promoted") {
        state.phase = "served";
        state.detail = "";
      } else {
        state.phase = "failed";
        state.detail = promotion.detail ?? "the promotion was refused";
      }
    }
  });

  // The kernel's answer on mount, the release check with it, and a poll
  // every two seconds while something is in flight. BO_0223_014
  useVisibleTask$(async ({ cleanup }) => {
    await read$();
    await checkReleases$(false);
    if (state.info?.pending !== null && state.info?.pending !== undefined) {
      state.chosen = state.info.pending.version;
      state.phase = "returned";
      await readProposal$();
    }
    const timer = setInterval(() => {
      if (state.phase === "idle" || state.phase === "served" || state.phase === "failed" || state.phase === "returned" || state.phase === "accepted") {
        return;
      }
      void follow$();
    }, 2000);
    cleanup(() => clearInterval(timer));
  });

  const start$ = $(async (version: string) => {
    state.busy = true;
    state.detail = "";
    state.chosen = version;
    try {
      if (state.info?.updater.state === "absent") {
        // No updater: the commands are shown, and the tab waits for the
        // kernel to come back on the chosen release all the same.
        state.phase = "waiting";
        return;
      }
      const response = await fetch("/api/x/settings/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version }),
      });
      if (!response.ok) {
        state.phase = "failed";
        state.detail = await refusalOf(response);
        return;
      }
      state.phase = "running";
    } finally {
      state.busy = false;
    }
  });

  const accept$ = $(async () => {
    const pending = state.info?.pending;
    if (pending === null || pending === undefined) return;
    state.busy = true;
    state.detail = "";
    try {
      const response = await fetch("/api/x/settings/update/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposal: pending.proposal, version: pending.version }),
      });
      if (!response.ok) {
        state.detail = await refusalOf(response);
        return;
      }
      const answer = (await response.json()) as { status: string; confirmUrl?: string };
      if (answer.status === "pending" && answer.confirmUrl !== undefined) {
        state.confirmUrl = answer.confirmUrl;
        state.phase = "confirm";
        return;
      }
      state.phase = "accepted";
      await read$();
    } finally {
      state.busy = false;
    }
  });

  const promote$ = $(async () => {
    state.busy = true;
    state.detail = "";
    try {
      const response = await fetch("/api/x/settings/update/promote", { method: "POST" });
      if (!response.ok) {
        state.detail = await refusalOf(response);
        return;
      }
      state.phase = "promoting";
    } finally {
      state.busy = false;
    }
  });

  const openShell$ = $(async () => {
    await bridge.openTarget$({ kind: "ui.shell:extension", itemId: "ext:ui.shell", title: "ui.shell" });
  });

  const info = state.info;
  const installed = versionOf(info);
  const inFlight = state.phase !== "idle" && state.phase !== "served" && state.phase !== "failed";
  const commands = (version: string) =>
    `cd ~/calliopa\ngit fetch --tags && git checkout --detach v${version}\n./install.sh`;
  const describe = (release: Release, type?: Candidate["type"]): string => {
    const date = release.publishedAt === "" ? "" : ` · ${new Date(release.publishedAt).toLocaleDateString()}`;
    const label = type === undefined ? "" : ` · newest ${type}`;
    return `${release.version}${label}${date}`;
  };
  const older = (release: Release): boolean => {
    const base = state.releases.find((r) => r.version === installed);
    return base !== undefined && (release.major - base.major || release.minor - base.minor || release.patch - base.patch) < 0;
  };

  return (
    <div class="settings" data-update-view data-update-phase={state.phase}>
      <section class="settings-section" aria-labelledby="update-installed">
        <h2 class="settings-section__heading" id="update-installed">
          Update
        </h2>
        {state.refusal !== null && (
          <p class="settings-empty" role="status" data-update-refusal>
            {state.refusal}
          </p>
        )}
        {info !== null && (
          <p class="settings-section__lead" data-update-installed={installed}>
            Installed release: <strong>{installed === "" ? "unknown" : installed}</strong>
            {info.servedPin !== undefined && ` · serving pin ${info.servedPin}`}
            {" · "}
            {info.updater.state === "absent"
              ? "no updater is running on this machine"
              : `updater ${info.updater.state}`}
          </p>
        )}
        {info !== null && state.checked === "off" && (
          <p class="settings-empty" data-update-check="off">
            The release check is off (<code>CALLIOPA_UPDATE_CHECK=off</code> in <code>.env</code>), so nothing is
            known about newer releases.
          </p>
        )}
        {state.checked === "unreachable" && (
          <p class="settings-empty" data-update-check="unreachable">
            GitHub could not be reached, so nothing is known about newer releases.
          </p>
        )}
        {state.checked === "checked" && state.candidates.length === 0 && (
          <p class="settings-empty" data-update-check="current">
            This instance is on the newest release.
          </p>
        )}
        {state.checked === "checked" && state.candidates.length > 0 && (
          <ul class="connection-list" data-update-candidates>
            {state.candidates.map((candidate) => (
              <li class="connection" key={candidate.release.version} data-update-candidate={candidate.release.version}>
                <div class="connection__identity">
                  <h3 class="connection__name">{describe(candidate.release, candidate.type)}</h3>
                  <p class="person__facts">
                    <a href={candidate.release.url} target="_blank" rel="noreferrer">
                      Release notes
                    </a>
                  </p>
                </div>
                <div class="connection__controls">
                  <button
                    type="button"
                    class="connection__action"
                    disabled={state.busy || inFlight}
                    onClick$={() => start$(candidate.release.version)}
                  >
                    Update to {candidate.release.version}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {info !== null && info.updateCheck && (
          <p class="connection__controls">
            <button type="button" class="connection__action" disabled={state.checked === "checking"} onClick$={() => checkReleases$(true)}>
              Check again
            </button>
            {state.releases.length > 0 && (
              <button
                type="button"
                class="connection__action"
                aria-pressed={state.showAll}
                onClick$={() => {
                  state.showAll = !state.showAll;
                }}
              >
                {state.showAll ? "Hide all versions" : "Show all versions"}
              </button>
            )}
          </p>
        )}
        {state.showAll && (
          <ul class="connection-list" data-update-all>
            {state.releases.map((release) => (
              <li
                class="connection"
                key={release.version}
                data-update-release={release.version}
                data-update-installed-release={release.version === installed ? "true" : undefined}
              >
                <div class="connection__identity">
                  <h3 class="connection__name">
                    {describe(release)}
                    {release.version === installed && <span class="person__owner">installed</span>}
                  </h3>
                  <p class="person__facts">
                    <a href={release.url} target="_blank" rel="noreferrer">
                      Release notes
                    </a>
                  </p>
                </div>
                {release.version !== installed && (
                  <div class="connection__controls">
                    <button
                      type="button"
                      class="connection__action"
                      disabled={state.busy || inFlight}
                      onClick$={() => start$(release.version)}
                    >
                      {older(release) ? `Downgrade to ${release.version}` : `Update to ${release.version}`}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {state.chosen !== null && (
        <section class="settings-section" aria-labelledby="update-progress" data-update-progress>
          <h2 class="settings-section__heading" id="update-progress">
            {older(state.releases.find((r) => r.version === state.chosen) ?? { version: "", major: 0, minor: 0, patch: 0, publishedAt: "", url: "" })
              ? `Downgrade to ${state.chosen}`
              : `Update to ${state.chosen}`}
          </h2>
          {older(state.releases.find((r) => r.version === state.chosen) ?? { version: "", major: 0, minor: 0, patch: 0, publishedAt: "", url: "" }) && (
            <p class="settings-section__lead">
              This rolls the images back. Graph content versions on its own and is not rolled back with them.
            </p>
          )}
          {info?.updater.state === "absent" && (state.phase === "waiting" || state.phase === "running") && (
            <div data-update-commands>
              <p class="settings-section__lead">
                No updater is running on this machine. Run these on it, then come back here:
              </p>
              <pre class="settings-commands">{commands(state.chosen)}</pre>
            </div>
          )}
          {(state.phase === "running" || state.phase === "waiting") && info?.updater.state !== "absent" && (
            <p class="settings-section__lead" role="status" data-update-step={info?.updater.step ?? ""}>
              {state.phase === "waiting"
                ? "The stack is restarting; waiting for the kernel to come back."
                : `The updater is running${info?.updater.step === undefined ? "" : `: ${info.updater.step}`}.`}
            </p>
          )}
          {(state.phase === "running" || state.phase === "waiting") && info?.updater.log !== undefined && info.updater.log.length > 0 && (
            <pre class="settings-commands" data-update-log>
              {info.updater.log.join("\n")}
            </pre>
          )}
          {state.phase === "returned" && (
            <div data-update-review>
              <p class="settings-section__lead" role="status">
                The instance is back on release {state.chosen}.{" "}
                {info?.pending === null || info?.pending === undefined
                  ? "No update proposal is waiting: the graph already holds this release's content."
                  : `Its extensions are staged as proposal ${info.pending.proposal}, waiting for your review.`}
              </p>
              {state.proposal !== null && (
                <ul class="connection-list" data-update-files>
                  {state.proposal.files.map((file) => (
                    <li class="connection" key={file.path} data-update-file={file.path}>
                      <div class="connection__identity">
                        <h3 class="connection__name">{file.path}</h3>
                        <p class="person__facts">{file.change}</p>
                      </div>
                    </li>
                  ))}
                  {state.proposal.files.length === 0 && (
                    <li class="connection">
                      <p class="settings-empty">The proposal changes no file.</p>
                    </li>
                  )}
                </ul>
              )}
              <p class="connection__controls">
                {info?.pending !== null && info?.pending !== undefined && (
                  <button type="button" class="connection__action" disabled={state.busy} onClick$={() => accept$()}>
                    Accept the proposal
                  </button>
                )}
                <button type="button" class="connection__action" onClick$={() => openShell$()}>
                  Open the shell's extension document
                </button>
              </p>
            </div>
          )}
          {state.phase === "confirm" && state.confirmUrl !== null && (
            <p class="settings-section__lead" role="status" data-update-confirm={state.confirmUrl}>
              Establishing truth needs the kernel's own confirmation:{" "}
              <a href={state.confirmUrl} target="_blank" rel="noreferrer">
                confirm the acceptance
              </a>
              . This tab moves on when the proposal is accepted.
            </p>
          )}
          {state.phase === "accepted" && (
            <p class="connection__controls">
              <span class="settings-section__lead" role="status">
                The proposal is accepted. Promote it so the instance serves release {state.chosen}.
              </span>
              <button type="button" class="connection__action" disabled={state.busy} onClick$={() => promote$()}>
                Promote
              </button>
            </p>
          )}
          {state.phase === "promoting" && (
            <p class="settings-section__lead" role="status">
              Promoting: the kernel builds and checks the release before it serves it.
            </p>
          )}
          {state.phase === "served" && (
            <p class="settings-section__lead" role="status" data-update-served={state.chosen}>
              Serving release {state.chosen}
              {info?.servedPin !== undefined && ` at pin ${info.servedPin}`}. Reload to run the new shell.
            </p>
          )}
          {state.phase === "failed" && (
            <p class="settings-empty" role="alert" data-update-failed>
              {state.detail}
            </p>
          )}
          {state.detail !== "" && state.phase !== "failed" && (
            <p class="settings-empty" role="alert">
              {state.detail}
            </p>
          )}
        </section>
      )}
    </div>
  );
});
