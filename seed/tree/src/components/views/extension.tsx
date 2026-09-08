import { $, component$, useContext, useStore, useTask$, useVisibleTask$ } from "@builder.io/qwik";

import { ViewBridgeContext, type InspectorFact } from "~/components/shell/view-bridge";
import type { ViewProps } from "~/components/shell/view-host";
import type { OwnerBlock, OwnerDocument } from "~/lib/owner-docs/render";
import type { Run } from "~/lib/runs";

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

/** Splits `ext:<id>/<path>` into the extension and the optional node path. */
export function nodeTarget(itemId: string): { extension: string; path: string | undefined } {
  const bare = itemId.replace(/^ext:/u, "");
  const slash = bare.indexOf("/");
  return slash < 0
    ? { extension: bare, path: undefined }
    : { extension: bare.slice(0, slash), path: bare.slice(slash + 1) };
}

export const ExtensionView = component$<ViewProps>(({ tab }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<State>({ status: "loading", detail: "", document: null });

  const load$ = $(async () => {
    const { extension, path } = nodeTarget(tab.itemId ?? "");
    const query = path === undefined ? "" : `?path=${encodeURIComponent(path)}`;
    const response = await fetch(`/api/x/ui.shell/extensions/${encodeURIComponent(extension)}${query}`);
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
  });

  useTask$(({ track }) => {
    track(() => state.status);
    track(() => state.document);
    const facts: InspectorFact[] =
      state.document === null
        ? []
        : state.document.facts.map((fact) => ({ kind: "text", label: fact.label, value: fact.value }));
    bridge.inspector.facts = facts;
    bridge.inspector.actions = [];
    bridge.inspector.text = state.status === "ready" ? null : state.detail || "Reading the graph…";
  });

  const follow$ = $(async (link: string) => {
    const nodeId = link.replace(/^calliopa:/u, "");
    const { extension, path } = nodeTarget(nodeId);
    const title = path === undefined ? extension : (path.split("/").pop() ?? path).replace(/\.md$/u, "");
    await bridge.openTarget$({ kind: "ui.shell:extension", itemId: nodeId, title });
  });

  return (
    <div class="view view--extension" data-view-body="extension">
      {state.status === "loading" && <p class="extension-status">Reading the graph…</p>}
      {(state.status === "unreachable" || state.status === "missing") && (
        <p class="extension-status" role="status" data-extension-status={state.status}>
          {state.detail}
        </p>
      )}
      {state.document !== null && (
        <article class="owner-document" aria-label={state.document.title} data-node={state.document.nodeId}>
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
  const runs = block.runs.map((run, index) => <RunView key={index} run={run} onFollow$={onFollow$} />);
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

const RunView = component$<{ run: Run; onFollow$: (link: string) => Promise<void> }>(({ run, onFollow$ }) => {
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
      <button type="button" class="owner-link" data-node-link={link} onClick$={() => onFollow$(link)}>
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
