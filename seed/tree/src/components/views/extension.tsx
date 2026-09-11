import {
  $,
  component$,
  useContext,
  useStore,
  useTask$,
  useVisibleTask$,
} from "@builder.io/qwik";

import {
  ViewBridgeContext,
  type InspectorFact,
} from "~/components/shell/view-bridge";
import type { ViewProps } from "~/components/shell/view-host";
import type { OwnerBlock, OwnerDocument } from "~/lib/owner-docs/render";
import type { Run } from "~/lib/runs";
import type {
  KernelExtensionView,
  KernelHealth,
  KernelPromotion,
} from "~/server/kernel/extensions";

/**
 * The owner's view of an extension: one node of its docs network as a
 * read-only document. The tab's item identity names the node — `ext:<id>`
 * for the extension, `ext:<id>/<path>` for a topic or a change — and every
 * `calliopa:` link in the document opens its node as another tab of this
 * kind. Nothing here edits: the docs change through the kernel CLI and the
 * agent, and the graph is read, never written. BO_0201_007
 */

interface State {
  status: "loading" | "ready" | "unreachable" | "missing";
  detail: string;
  document: OwnerDocument | null;
}

/**
 * How the kernel serves this extension, read from the kernel through the
 * shell's own route: the toggle and the version selector at the top of the
 * view act on it, and the rebuild a change starts is watched here until the
 * served shell is the new build, when the page reloads. BO_0218_009 BO_0219_006
 */
interface Control {
  status: "loading" | "ready" | "unavailable";
  detail: string;
  extension: KernelExtensionView | null;
  head: number;
  servedPin: number | null;
  promotion: KernelPromotion | null;
  canChange: boolean;
  declaresVocabulary: boolean;
  health: KernelHealth | null;
  /** What the person asked for, while the promotion it started runs. */
  pending: string;
  /** The refusal of the last request, in the kernel's words. */
  refusal: string;
}

interface ControlAnswer {
  readonly extension: KernelExtensionView;
  readonly head: number;
  readonly servedPin: number | null;
  readonly promotion: KernelPromotion | null;
  readonly canChange: boolean;
  readonly declaresVocabulary: boolean;
  readonly health: KernelHealth | null;
}

/** The dependents of an extension that are themselves active, by the listing's own dependents list. */
export function blockingDependents(
  extension: KernelExtensionView,
  listing: readonly KernelExtensionView[],
): string[] {
  const active = new Set(
    listing
      .filter((candidate) => candidate.active)
      .map((candidate) => candidate.id),
  );
  return extension.dependents.filter((dependent) => active.has(dependent));
}

function when(millis: number | undefined): string {
  if (millis === undefined || millis <= 0) return "";
  return new Date(millis).toISOString().slice(0, 10);
}

/**
 * The download address of an extension's archive: the shell's own route,
 * which streams the kernel's export with the file name it named; a
 * revision names one of the extension's versions. BO_0224_010
 */
export function exportHref(id: string, revision?: number): string {
  const query = revision === undefined ? "" : `?revision=${revision}`;
  return `/api/x/ui.shell/extensions/${encodeURIComponent(id)}/export${query}`;
}

/** Splits `ext:<id>/<path>` into the extension and the optional node path. */
export function nodeTarget(itemId: string): {
  extension: string;
  path: string | undefined;
} {
  const bare = itemId.replace(/^ext:/u, "");
  const slash = bare.indexOf("/");
  return slash < 0
    ? { extension: bare, path: undefined }
    : { extension: bare.slice(0, slash), path: bare.slice(slash + 1) };
}

export const ExtensionView = component$<ViewProps>(({ tab }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<State>({
    status: "loading",
    detail: "",
    document: null,
  });
  const control = useStore<Control>({
    status: "loading",
    detail: "",
    extension: null,
    head: 0,
    servedPin: null,
    promotion: null,
    canChange: false,
    declaresVocabulary: false,
    health: null,
    pending: "",
    refusal: "",
  });

  const readControl$ = $(async (): Promise<ControlAnswer | null> => {
    const { extension, path } = nodeTarget(tab.itemId ?? "");
    if (path !== undefined) {
      control.status = "unavailable";
      control.extension = null;
      return null;
    }
    try {
      const response = await fetch(
        `/api/x/ui.shell/extensions/${encodeURIComponent(extension)}/state`,
      );
      if (!response.ok) {
        const refusal = (await response.json()) as { message?: string };
        control.status = "unavailable";
        control.detail =
          refusal.message ?? `the kernel answered ${response.status}`;
        control.extension = null;
        return null;
      }
      const answer = (await response.json()) as ControlAnswer;
      control.extension = answer.extension;
      control.head = answer.head;
      control.servedPin = answer.servedPin;
      control.promotion = answer.promotion;
      control.canChange = answer.canChange;
      control.declaresVocabulary = answer.declaresVocabulary;
      control.health = answer.health;
      control.status = "ready";
      control.detail = "";
      return answer;
    } catch (error) {
      // The served shell is being swapped: the next read will find it.
      control.detail = String(error);
      return null;
    }
  });

  // After a change the kernel promotes head: watch the promotion, then the
  // kernel's own state until it serves the new pin, then reload — the served
  // shell is a different build, and this extension's contributions are gone
  // or back. A refused gate leaves the state written and is shown as such.
  const watch$ = $(async () => {
    for (let tick = 0; tick < 1200; tick += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const answer = await readControl$();
      if (answer === null) continue;
      const promotion = answer.promotion;
      if (promotion === null || promotion.status === "running") continue;
      if (promotion.status === "refused") {
        control.pending = "";
        return;
      }
      const health = answer.health;
      if (
        health !== null &&
        health.state === "serving" &&
        health.pin === promotion.pin
      ) {
        control.pending = "";
        window.location.reload();
        return;
      }
    }
    control.pending = "";
  });

  const change$ = $(
    async (
      path: "state" | "version",
      body: Record<string, unknown>,
      pending: string,
    ) => {
      const { extension } = nodeTarget(tab.itemId ?? "");
      control.refusal = "";
      control.pending = pending;
      const response = await fetch(
        `/api/x/ui.shell/extensions/${encodeURIComponent(extension)}/${path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const answer = (await response.json()) as {
        changed?: boolean;
        message?: string;
        code?: string;
      };
      if (!response.ok) {
        control.refusal =
          answer.message ?? `the kernel answered ${response.status}`;
        control.pending = "";
        await readControl$();
        return;
      }
      if (answer.changed !== true) {
        control.pending = "";
        await readControl$();
        return;
      }
      await readControl$();
      await watch$();
    },
  );

  const toggle$ = $(async () => {
    const extension = control.extension;
    if (extension === null) return;
    const active = !extension.active;
    await change$(
      "state",
      { active },
      active ? `Activating ${extension.id}` : `Deactivating ${extension.id}`,
    );
  });

  const flip$ = $(async (choice: string) => {
    const extension = control.extension;
    if (extension === null) return;
    if (choice === "follow") {
      if (!extension.pinned) return;
      await change$(
        "version",
        { follow: true },
        `Letting ${extension.id} follow the release pin`,
      );
      return;
    }
    const revision = Number(choice);
    if (
      !Number.isFinite(revision) ||
      revision <= 0 ||
      (extension.pinned && extension.pin === revision)
    )
      return;
    const entry = extension.versions.find(
      (candidate) => candidate.revision === revision,
    );
    await change$(
      "version",
      { revision },
      `Pinning ${extension.id} to ${entry?.label ?? String(revision)}`,
    );
  });

  const load$ = $(async () => {
    const { extension, path } = nodeTarget(tab.itemId ?? "");
    const query = path === undefined ? "" : `?path=${encodeURIComponent(path)}`;
    const response = await fetch(
      `/api/x/ui.shell/extensions/${encodeURIComponent(extension)}${query}`,
    );
    const outcome = (await response.json()) as
      | { outcome: "success"; document: OwnerDocument }
      | { outcome: "missing" | "unreachable"; detail: string };
    if (outcome.outcome === "success") {
      state.document = outcome.document;
      state.status = "ready";
      state.detail = "";
    } else {
      state.document = null;
      state.status = outcome.outcome;
      state.detail = outcome.detail;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => tab.itemId);
    void load$();
    void readControl$().then((answer) => {
      // A promotion started elsewhere — another tab, the CLI — is watched too.
      if (answer?.promotion?.status === "running") {
        control.pending = answer.promotion.reason;
        void watch$();
      }
    });
  });

  useTask$(({ track }) => {
    track(() => state.status);
    track(() => state.document);
    track(() => control.extension);
    const facts: InspectorFact[] =
      state.document === null
        ? []
        : state.document.facts.map((fact) => ({
            kind: "text",
            label: fact.label,
            value: fact.value,
          }));
    // What the kernel says about how it is served, beside the graph's facts;
    // the actions stay empty, the toggle being the one control. BO_0218_010
    const served = control.extension;
    if (served !== null) {
      facts.push({
        kind: "text",
        label: "Active",
        value: served.active ? "yes" : "no",
      });
      facts.push({
        kind: "text",
        label: "Required",
        value: served.required ? "yes, to run Calliopa" : "no",
      });
      if (served.servedVersion !== undefined) {
        facts.push({
          kind: "text",
          label: "Served version",
          value: served.servedVersion,
        });
      }
      facts.push({
        kind: "text",
        label: "Pinned at",
        value: served.pinned
          ? `revision ${served.pin}`
          : "not pinned, follows the release pin",
      });
    }
    bridge.inspector.facts = facts;
    // The one action: the extension as a file, the version the selector
    // shows — pinned, that version; else its newest state. BO_0224_010
    bridge.inspector.actions =
      served === null
        ? []
        : [
            {
              kind: "button",
              id: "export-extension",
              label: "Export",
              // A saved file, never a navigation: the route answers an
              // attachment, and a refusal — the kernel unreachable, a
              // revision it will not read — would otherwise replace the
              // shell with the refusal's JSON. The control row's link
              // carries `download` for the same reason. BO_0224_010
              run$: $(() => {
                const link = document.createElement("a");
                link.href = exportHref(served.id, served.pinned ? served.pin : undefined);
                link.download = "";
                document.body.append(link);
                link.click();
                link.remove();
              }),
            },
          ];
    bridge.inspector.text =
      state.status === "ready" ? null : state.detail || "Reading the graph…";
  });

  const follow$ = $(async (link: string) => {
    const nodeId = link.replace(/^calliopa:/u, "");
    // A change document opens in the editor, as the library opens it: the
    // link names the document, not a node of the owner network. BO_0222_009
    if (nodeId.startsWith("doc:")) {
      const documentId = nodeId.slice("doc:".length);
      const named = state.document?.blocks.find(
        (block) =>
          block.kind === "text" &&
          block.runs.some((run) => run.link === link),
      );
      const title =
        named !== undefined && named.kind === "text"
          ? (named.runs.find((run) => run.link === link)?.text ?? documentId)
          : documentId;
      await bridge.openTarget$({
        kind: "ui.shell:document",
        itemId: documentId,
        title,
      });
      return;
    }
    const { extension, path } = nodeTarget(nodeId);
    const title =
      path === undefined
        ? extension
        : (path.split("/").pop() ?? path).replace(/\.md$/u, "");
    await bridge.openTarget$({
      kind: "ui.shell:extension",
      itemId: nodeId,
      title,
    });
  });

  const served = control.extension;
  const dependents = served === null ? [] : served.dependents;
  const headAhead =
    control.servedPin !== null && control.head > control.servedPin;
  const busy =
    control.pending !== "" || control.promotion?.status === "running";
  const locked = served === null || !control.canChange || busy;
  const selected =
    served === null ? "follow" : served.pinned ? String(served.pin) : "follow";

  return (
    <div class="view view--extension" data-view-body="extension">
      {control.status !== "unavailable" && (
        <div class="extension-controls" data-extension-controls>
          {control.status === "loading" && (
            <span class="extension-note">Reading the kernel…</span>
          )}
          {served !== null && (
            <>
              <label
                class="extension-toggle"
                data-extension-toggle
                data-active={served.active ? "true" : "false"}
              >
                <input
                  type="checkbox"
                  checked={served.active}
                  disabled={locked || served.required}
                  aria-label={`${served.id} is ${served.active ? "active" : "inactive"}`}
                  onChange$={toggle$}
                />
                <span>{served.active ? "Active" : "Inactive"}</span>
              </label>
              {served.required && (
                <span class="extension-note" data-extension-note="required">
                  required to run Calliopa
                </span>
              )}
              {!control.canChange && (
                <span class="extension-note" data-extension-note="agent">
                  changing what is served is a human act; your account is class
                  agent
                </span>
              )}
              {!served.required && served.active && dependents.length > 0 && (
                <span class="extension-note" data-extension-note="dependents">
                  {dependents.join(", ")}{" "}
                  {dependents.length === 1 ? "depends" : "depend"} on it;
                  deactivating is refused while they are active
                </span>
              )}
              <span
                class="extension-served"
                data-extension-served={served.servedVersion ?? ""}
              >
                Serving {served.servedVersion ?? "nothing yet"}
                {served.pinned
                  ? ` (pinned at revision ${served.pin})`
                  : " (follows the release pin)"}
              </span>
              <select
                class="extension-version-select"
                data-extension-version
                aria-label="Serve at version"
                disabled={locked}
                value={selected}
                onChange$={(_, element) => flip$(element.value)}
              >
                <option value="follow" selected={selected === "follow"}>
                  current (follow the release pin)
                </option>
                {served.versions.map((entry) => (
                  <option
                    key={entry.revision}
                    value={String(entry.revision)}
                    selected={selected === String(entry.revision)}
                    title={entry.rationale ?? ""}
                  >
                    {[
                      `${entry.label} · revision ${entry.revision}`,
                      entry.introducedAt !== undefined
                        ? when(entry.introducedAt)
                        : "",
                      entry.introducedBy ?? "",
                      entry.current ? "current" : "",
                    ]
                      .filter((part) => part !== "")
                      .join(" · ")}
                  </option>
                ))}
              </select>
              <a
                class="extension-export"
                data-extension-export={served.id}
                href={exportHref(served.id, served.pinned ? served.pin : undefined)}
                download
                title={`${served.id} as one file: its sources, vocabulary, skills and change documents`}
              >
                Export
              </a>
              {headAhead && (
                <span class="extension-note" data-extension-note="ahead">
                  head is at {control.head}, the served pin at{" "}
                  {control.servedPin}: a change here deploys everything accepted
                  since
                </span>
              )}
              {served.id === "ui.shell" && (
                <span class="extension-note" data-extension-note="toolchain">
                  flipping the shell changes the toolchain every extension
                  builds under
                </span>
              )}
              {control.declaresVocabulary && (
                <span class="extension-note" data-extension-note="vocabulary">
                  a flip changes the built shell, not the vocabulary, skills or
                  intentions the graph enforces and teaches
                </span>
              )}
              {busy && (
                <span
                  class="extension-status"
                  role="status"
                  data-extension-rebuilding
                >
                  {control.pending || control.promotion?.reason || "Rebuilding"}
                  … the kernel is {control.health?.state ?? "rebuilding"}
                  {control.health?.pin !== undefined
                    ? ` at pin ${control.health.pin}`
                    : ""}
                </span>
              )}
              {!busy && control.promotion?.status === "refused" && (
                <span
                  class="extension-note"
                  role="status"
                  data-extension-note="refused"
                >
                  Promotion refused: {control.promotion.detail ?? "no detail"}.
                  The graph says {served.active ? "active" : "inactive"}
                  {served.pinned ? ` and pinned at ${served.pin}` : ""}; the
                  served pin {control.servedPin ?? "—"} still carries the
                  previous shape. Switch back to undo.
                </span>
              )}
              {control.refusal !== "" && (
                <span
                  class="extension-note"
                  role="status"
                  data-extension-note="refusal"
                >
                  {control.refusal}
                </span>
              )}
            </>
          )}
        </div>
      )}
      {state.status === "loading" && (
        <p class="extension-status">Reading the graph…</p>
      )}
      {(state.status === "unreachable" || state.status === "missing") && (
        <p
          class="extension-status"
          role="status"
          data-extension-status={state.status}
        >
          {state.detail}
        </p>
      )}
      {state.document !== null && (
        <article
          class="owner-document"
          aria-label={state.document.title}
          data-node={state.document.nodeId}
        >
          {state.document.blocks.map((block, index) => (
            <OwnerBlockView key={index} block={block} onFollow$={follow$} />
          ))}
        </article>
      )}
    </div>
  );
});

const OwnerBlockView = component$<{
  block: OwnerBlock;
  onFollow$: (link: string) => Promise<void>;
}>(({ block, onFollow$ }) => {
  if (block.kind === "divider") return <hr class="owner-divider" />;
  const runs = block.runs.map((run, index) => (
    <RunView key={index} run={run} onFollow$={onFollow$} />
  ));
  switch (block.role) {
    case "h1":
      return <h1 class="owner-heading owner-heading--1">{runs}</h1>;
    case "h2":
      return <h2 class="owner-heading owner-heading--2">{runs}</h2>;
    case "h3":
      return <h3 class="owner-heading owner-heading--3">{runs}</h3>;
    case "quote":
      return <blockquote class="owner-quote">{runs}</blockquote>;
    default:
      return <p class="owner-paragraph">{runs}</p>;
  }
});

const RunView = component$<{
  run: Run;
  onFollow$: (link: string) => Promise<void>;
}>(({ run, onFollow$ }) => {
  const marks = run.marks ?? [];
  let node = <>{run.text}</>;
  if (marks.includes("code")) node = <code class="owner-badge">{node}</code>;
  if (marks.includes("bold")) node = <strong>{node}</strong>;
  if (marks.includes("italic")) node = <em>{node}</em>;
  if (marks.includes("strikethrough")) node = <s>{node}</s>;
  if (run.link === undefined) return node;
  if (run.link.startsWith("calliopa:")) {
    const link = run.link;
    return (
      <button
        type="button"
        class="owner-link"
        data-node-link={link}
        onClick$={() => onFollow$(link)}
      >
        {node}
      </button>
    );
  }
  return (
    <a href={run.link} rel="noreferrer">
      {node}
    </a>
  );
});
