import { $, component$, useStore, useVisibleTask$ } from "@builder.io/qwik";

/**
 * What a staged group is judged by, drawn where the person reads the
 * extension. **There is no diff here and there is meant to be none**: a
 * person does not read code to judge a change (`BO_0282`, user decision
 * 2026-09-23), and *a review of code in the shell* stays a **Not Here** in
 * the contribution contract. What stands in its place is the change document
 * and the status its staged line reads, what the group touches, what each run
 * says it did and whether its gates are green, and the candidate — the change
 * built and served beside this instance, which is how a person judges it by
 * trying it.
 *
 * Accepting is the kernel's confirmation page, exactly as an import's is; the
 * shell links it and never confirms. BO_0282_008 BO_0282_010
 */

interface GroupRun {
  readonly id: string;
  readonly goal?: string;
  readonly person?: string;
  readonly executedBy?: string;
  readonly model?: string;
  readonly status?: string;
  readonly conclusion?: string;
  readonly buildOk: boolean;
  readonly checkOk: boolean;
  readonly testOk: boolean;
}

interface Group {
  readonly group: string;
  readonly status: string;
  readonly createdBy: string;
  readonly rationale?: string;
  readonly change?: string;
  readonly changeStatus?: string;
  readonly members?: Readonly<Record<string, number>>;
  readonly runs?: readonly GroupRun[];
}

interface Candidate {
  readonly group: string;
  readonly status: "building" | "serving" | "refused" | "stopped";
  readonly detail?: string;
  readonly address?: string;
  readonly by: string;
}

interface GroupsState {
  status: "loading" | "ready" | "unavailable";
  detail: string;
  groups: Group[];
  candidate: Candidate | null;
  running: boolean;
  busy: string;
  confirmUrl: string;
  refusal: string;
}

/** gateWords says which gates a run was seen to pass, and which it never ran. */
export function gateWords(run: {
  readonly buildOk: boolean;
  readonly checkOk: boolean;
  readonly testOk: boolean;
}): string {
  const passed: string[] = [];
  const notRun: string[] = [];
  for (const [name, ok] of [
    ["build", run.buildOk],
    ["check", run.checkOk],
    ["tests", run.testOk],
  ] as const) {
    (ok ? passed : notRun).push(name);
  }
  if (passed.length === 0) return "no gate was run";
  if (notRun.length === 0) return "build, check and tests passed";
  return `${passed.join(" and ")} passed, ${notRun.join(" and ")} not run`;
}

/** touchWords renders the member counts as words rather than a table. */
export function touchWords(members: Readonly<Record<string, number>> | undefined): string {
  if (members === undefined) return "";
  const parts = Object.keys(members)
    .sort()
    .map((kind) => `${members[kind]} ${kind}`);
  return parts.join(", ");
}

export const ExtensionGroups = component$<{ extension: string }>((props) => {
  const state = useStore<GroupsState>({
    status: "loading",
    detail: "",
    groups: [],
    candidate: null,
    running: false,
    busy: "",
    confirmUrl: "",
    refusal: "",
  });

  const read$ = $(async () => {
    try {
      const response = await fetch(
        `/api/x/ui.shell/extensions/${encodeURIComponent(props.extension)}/groups`,
      );
      if (!response.ok) {
        const refusal = (await response.json()) as { message?: string };
        state.status = "unavailable";
        state.detail = refusal.message ?? `the kernel answered ${response.status}`;
        return;
      }
      const answer = (await response.json()) as {
        groups?: Group[];
        candidate?: { running?: boolean; candidate?: Candidate };
      };
      state.groups = answer.groups ?? [];
      state.candidate = answer.candidate?.candidate ?? null;
      state.running = answer.candidate?.running === true;
      state.status = "ready";
      state.detail = "";
    } catch (error) {
      state.status = "unavailable";
      state.detail = String(error);
    }
  });

  const decide$ = $(async (group: string, verb: "accept" | "reject") => {
    state.busy = group;
    state.refusal = "";
    state.confirmUrl = "";
    try {
      const response = await fetch(
        `/api/x/ui.shell/extensions/group/${encodeURIComponent(group)}/${verb}`,
        { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
      );
      const answer = (await response.json()) as {
        message?: string;
        status?: string;
        confirmUrl?: string;
      };
      if (!response.ok) {
        state.refusal = answer.message ?? `the kernel answered ${response.status}`;
        return;
      }
      // An acceptance is parked behind the kernel's confirmation origin: the
      // shell shows the address and the person presses there. BO_0103_003
      if (answer.status === "pending" && answer.confirmUrl !== undefined) {
        state.confirmUrl = answer.confirmUrl;
        return;
      }
      await read$();
    } finally {
      state.busy = "";
    }
  });

  const candidate$ = $(async (body: Record<string, unknown>) => {
    state.refusal = "";
    try {
      const response = await fetch("/api/x/ui.shell/extensions/candidate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const answer = (await response.json()) as {
        message?: string;
        running?: boolean;
        candidate?: Candidate;
      };
      if (!response.ok) {
        state.refusal = answer.message ?? `the kernel answered ${response.status}`;
        return;
      }
      state.candidate = answer.candidate ?? null;
      state.running = answer.running === true;
    } catch (error) {
      state.refusal = String(error);
    }
  });

  useVisibleTask$(async ({ cleanup }) => {
    await read$();
    // While a candidate builds, the answer is polled: a build takes minutes
    // and the route answers before it finishes, the way a promotion does.
    const timer = setInterval(() => {
      if (state.running) void read$();
    }, 3000);
    cleanup(() => clearInterval(timer));
  });

  if (state.status === "loading") return null;
  if (state.status === "unavailable")
    return (
      <section class="extension-groups" aria-label="Staged changes">
        <p class="extension-status" role="status">
          {state.detail}
        </p>
      </section>
    );
  if (state.groups.length === 0) return null;

  const candidate = state.candidate;
  return (
    <section class="extension-groups" aria-label="Staged changes">
      <h2 class="extension-groups-heading">Staged changes</h2>
      <p class="extension-groups-note">
        The code is not shown. A change is judged by what its change document
        says it should do, by what each run says it did, by whether its build,
        check and tests are green, and by trying it.
      </p>
      {state.refusal !== "" && (
        <p class="extension-groups-refusal" role="alert">
          {state.refusal}
        </p>
      )}
      {state.confirmUrl !== "" && (
        <p class="extension-groups-confirm">
          Establishing this change is confirmed by the kernel:{" "}
          <a href={state.confirmUrl} rel="noreferrer">
            open the confirmation
          </a>
          .
        </p>
      )}
      {state.groups.map((group) => (
        <article class="extension-group" key={group.group} data-group={group.group}>
          <h3 class="extension-group-title">
            {group.change ?? group.rationale ?? group.group}
            {group.changeStatus !== undefined && (
              <span class="extension-group-status"> · {group.changeStatus}</span>
            )}
          </h3>
          <p class="extension-group-touches">
            Staged by {group.createdBy}
            {touchWords(group.members) !== "" && ` · touches ${touchWords(group.members)}`}
          </p>
          {(group.runs ?? []).map((run) => (
            <p class="extension-group-run" key={run.id} data-run={run.id}>
              <span class="extension-group-run-who">
                {run.person ?? "a run"}
                {run.executedBy !== undefined && ` · ${run.executedBy}`}
                {run.model !== undefined && ` (${run.model})`}
              </span>{" "}
              {run.conclusion ?? run.goal ?? ""} — {gateWords(run)}
            </p>
          ))}
          <div class="extension-group-actions">
            <button
              type="button"
              class="extension-group-action"
              disabled={state.busy !== ""}
              onClick$={() => decide$(group.group, "accept")}
            >
              Accept
            </button>
            <button
              type="button"
              class="extension-group-action"
              disabled={state.busy !== ""}
              onClick$={() => decide$(group.group, "reject")}
            >
              Reject
            </button>
            {candidate !== null &&
            candidate.group === group.group &&
            (candidate.status === "building" || candidate.status === "serving") ? (
              <>
                <span class="extension-group-candidate" role="status">
                  {candidate.status === "building"
                    ? "Building it beside this instance…"
                    : "Served beside this instance"}
                </span>
                {candidate.status === "serving" && candidate.address !== undefined && (
                  <a
                    class="extension-group-action"
                    href={candidateHref(candidate.address)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open it
                  </a>
                )}
                <button
                  type="button"
                  class="extension-group-action"
                  onClick$={() => candidate$({ stop: true })}
                >
                  Stop
                </button>
              </>
            ) : (
              <button
                type="button"
                class="extension-group-action"
                disabled={state.running}
                onClick$={() => candidate$({ group: group.group })}
              >
                Try it
              </button>
            )}
          </div>
          {candidate !== null &&
            candidate.group === group.group &&
            candidate.status === "refused" && (
              <p class="extension-group-refused" role="alert">
                It could not be built: {candidate.detail}
              </p>
            )}
        </article>
      ))}
    </section>
  );
});

/**
 * candidateHref turns the kernel's `:port` into an address on the host the
 * browser is already on. The kernel states the port alone because the host is
 * whatever the browser used to reach it — the same reasoning the confirmation
 * URL follows (`BO_0240_001`), read here rather than sent.
 */
export function candidateHref(address: string, location?: { protocol: string; hostname: string }): string {
  const here = location ?? (typeof window === "undefined" ? { protocol: "http:", hostname: "127.0.0.1" } : window.location);
  const port = address.startsWith(":") ? address.slice(1) : address;
  return `${here.protocol}//${here.hostname}:${port}/`;
}
