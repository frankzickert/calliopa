import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../server/assemble";
import { SAVE_PAUSE_MS } from "./block-editor";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * The bar's Cite control pressed in the render harness (`BO_0291_024`): it
 * opens a search and a choice of the bibliography's works, choosing one
 * writes the citation, and pressing it again — and choosing the same work
 * again — writes another. Found by the user on 2026-09-23: pressing Cite
 * worked only once.
 */
const draft: DocumentView = {
  documentId: "doc-cite",
  revisionId: "rev-doc",
  title: "Citing",
  blocks: [
    { kind: "text", blockId: "blk-a", revisionId: "rev-a", containmentId: "c-a", order: "a", role: "paragraph", standing: "keep", runs: [{ text: "Opening." }] },
  ],
};

const works = [
  { workId: "wrk-1", revisionId: "rev-w1", record: { title: "Deep learning", kind: "book", author: [{ family: "Goodfellow" }], issued: { "date-parts": [[2016]] } } },
  { workId: "wrk-2", revisionId: "rev-w2", record: { title: "Attention is all you need", kind: "paper-conference", author: [{ family: "Vaswani" }], issued: { "date-parts": [[2017]] } } },
];

let last: { idle: () => Promise<void> } | null = null;

afterEach(async () => {
  await last?.idle();
  last = null;
  vi.unstubAllGlobals();
});

const mount = async () => {
  const sent: SentCommand[] = [];
  const documents = documentsApi(draft, sent, { follow: true });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/api/x/bibliography/works")) {
      return new Response(JSON.stringify({ works }), { headers: { "content-type": "application/json" } });
    }
    return documents(input as string, init);
  });
  const harness = await mountEditor(draft);
  last = harness;
  // A save lands after the pause, longer than `settle` waits: this waits the
  // way the line-break and handover tests do.
  const waitFor = async (until: () => boolean) => {
    for (let tick = 0; tick < 300; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await harness.userEvent(harness.root, "harnessSettle");
      if (until()) return;
    }
    throw new Error("waited, and it did not happen");
  };
  return { ...harness, sent, waitFor };
};

const activate = async (view: Awaited<ReturnType<typeof mount>>, blockId: string) => {
  await view.userEvent(`[data-block-id="${blockId}"] [data-block-reading]`, "focus");
  await view.userEvent(`[data-block-id="${blockId}"] [data-block-reading]`, "keydown", { key: "Enter" });
  await view.settle(() => view.root.querySelector("[data-block-editor]") != null);
};

const citations = (view: { sent: SentCommand[] }) =>
  view.sent
    .filter((command) => command.body["command"] === "revise")
    .map((command) => ((command.body["runs"] as { cite?: { work: string } }[]) ?? []).filter((run) => run.cite !== undefined).map((run) => run.cite?.work));

describe("the bar's Cite control", () => {
  it("Given Cite pressed, a source chosen, Cite pressed again and the same source chosen again, Then two citations are written, and Escape closes the panel", async () => {
    const view = await mount();
    await activate(view, "blk-a");
    const cite = () => view.root.querySelector('[data-bar-action="block-cite"]') as HTMLElement | null;
    const panel = () => view.root.querySelector('[data-popover-panel="block-cite"]') as HTMLElement | null;
    expect(cite()?.getAttribute("aria-expanded")).toBe("false");

    // The panel hangs off the bar's control and holds the sources as buttons.
    await view.userEvent('[data-bar-action="block-cite"]', "click");
    await view.settle(() => panel()?.querySelector('[data-cite-choice="wrk-1"]') != null);
    expect(cite()?.getAttribute("aria-expanded")).toBe("true");
    expect(panel()?.getAttribute("aria-labelledby")).toBe(cite()?.getAttribute("id"));
    expect(Array.from(panel()!.querySelectorAll("[data-cite-choice]")).map((button) => button.textContent)).toEqual([
      "Goodfellow (2016) — Deep learning",
      "Vaswani (2017) — Attention is all you need",
    ]);
    await view.userEvent('[data-cite-choice="wrk-1"]', "click");
    await view.settle(() => panel() == null);
    expect(cite()?.getAttribute("aria-expanded")).toBe("false");
    // The citation stands in the editing surface at once; the write follows the pause.
    expect(view.root.querySelectorAll("[data-block-editor] [data-cite-work]").length).toBe(1);
    await view.waitFor(() => citations(view).length >= 1);
    expect(citations(view)[0]).toEqual(["wrk-1"]);

    // Again, and the same source.
    await view.userEvent('[data-bar-action="block-cite"]', "click");
    await view.settle(() => panel()?.querySelector('[data-cite-choice="wrk-1"]') != null);
    await view.userEvent('[data-cite-choice="wrk-1"]', "click");
    await view.settle(() => panel() == null);
    await view.waitFor(() => citations(view).length >= 2);
    expect(citations(view)[1]).toEqual(["wrk-1", "wrk-1"]);
    expect(view.root.querySelectorAll("[data-block-editor] [data-cite-work]").length).toBe(2);

    // The search narrows the list; Escape closes the panel with nothing written.
    await view.userEvent('[data-bar-action="block-cite"]', "click");
    await view.settle(() => panel()?.querySelector("[data-cite-search]") != null);
    const search = panel()!.querySelector("[data-cite-search]") as HTMLInputElement;
    search.value = "vaswani";
    await view.userEvent(search, "input");
    await view.settle(() => panel()?.querySelectorAll("[data-cite-choice]").length === 1);
    await view.userEvent('[data-popover="block-cite"]', "keydown", { key: "Escape" });
    await view.settle(() => panel() == null);
    expect(citations(view).length).toBe(2);
    await view.idle();
  }, SAVE_PAUSE_MS * 2 + 5000);

  it("Given a source cited and the block saved, Then the citation takes the number the read gives it, where it read […] before", async () => {
    const sent: SentCommand[] = [];
    const documents = documentsApi(draft, sent, { follow: true });
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith("/api/x/bibliography/works")) {
        return new Response(JSON.stringify({ works }), { headers: { "content-type": "application/json" } });
      }
      const answered = await documents(input as string, init);
      // Once a citation is saved, the document read numbers it, as the
      // server's read does (BO_0291_013).
      const isRead = (init?.method ?? "GET") === "GET" && /\/api\/x\/documents\/d\/[^/]+$/u.test(url);
      if (!isRead || !sent.some((command) => command.body["command"] === "revise")) return answered;
      const body = (await answered.clone().json()) as { outcome?: string; result?: Record<string, unknown> };
      if (body.outcome !== "success" || body.result === undefined) return answered;
      return new Response(JSON.stringify({ ...body, result: { ...body.result, citationNumbers: { "wrk-1": 1 } } }), { headers: { "content-type": "application/json" } });
    });
    const view = await mountEditor(draft);
    last = view;
    const waitFor = async (until: () => boolean) => {
      for (let tick = 0; tick < 300; tick++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        await view.userEvent(view.root, "harnessSettle");
        if (until()) return;
      }
      throw new Error("waited, and it did not happen");
    };
    await activate({ ...view, sent, waitFor } as Awaited<ReturnType<typeof mount>>, "blk-a");
    await view.userEvent('[data-bar-action="block-cite"]', "click");
    await view.settle(() => view.root.querySelector('[data-cite-choice="wrk-1"]') != null);
    await view.userEvent('[data-cite-choice="wrk-1"]', "click");
    const atom = () => view.root.querySelector("[data-block-editor] [data-cite-work]") as HTMLElement | null;
    await view.settle(() => atom() != null);
    expect(atom()?.getAttribute("data-cite-label")).toBe("[…]");
    await waitFor(() => atom()?.getAttribute("data-cite-label") === "[1]");
    await view.idle();
  }, SAVE_PAUSE_MS * 2 + 5000);
});
