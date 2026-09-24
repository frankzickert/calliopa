import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../server/assemble";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A citation's hover card and the document's reference list, drawn in the
 * render harness from the bibliography's `references` route
 * (`BO_0291_026`, `BO_0291_027`): the card names the work, opens its page,
 * links its DOI and its PDF and shows the locator; the list after the last
 * block holds the cited works in their numbered order.
 */
const draft: DocumentView = {
  documentId: "00000000-0000-4000-8000-000000000c17",
  revisionId: "rev-doc",
  title: "Cited",
  dataRevision: 7,
  citationNumbers: { "wrk-2": 1, "wrk-1": 2 },
  blocks: [
    {
      kind: "text",
      blockId: "blk-a",
      revisionId: "rev-a",
      containmentId: "c-a",
      order: "a",
      role: "paragraph",
      standing: "keep",
      runs: [{ text: "Thermometry " }, { text: "", cite: { work: "wrk-2", locator: "p. 54" } }, { text: " and learning " }, { text: "", cite: { work: "wrk-1" } }, { text: "." }],
    },
  ],
};

const references = {
  style: "ieee",
  references: [
    { number: 1, label: "[1]", workId: "wrk-2", title: "Thermometry", line: "Kucsko (2013) — Thermometry", doi: "10.1038/nature12373", file: true, entry: [{ text: 'G. Kucsko, "Thermometry," ' }, { text: "Nature", italic: true }, { text: ", 2013." }] },
    { number: 2, label: "[2]", workId: "wrk-1", title: "Deep learning", line: "Goodfellow (2016) — Deep learning", file: false, entry: [{ text: "I. Goodfellow, " }, { text: "Deep learning", italic: true }, { text: ". MIT Press, 2016." }] },
  ],
  missing: [],
};

let last: { idle: () => Promise<void> } | null = null;

afterEach(async () => {
  await last?.idle();
  last = null;
  vi.unstubAllGlobals();
});

const mount = async () => {
  const sent: SentCommand[] = [];
  const documents = documentsApi(draft, sent);
  const asked: string[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/x/bibliography/references")) {
      asked.push(url);
      return new Response(JSON.stringify({ outcome: "success", result: references }), { headers: { "content-type": "application/json" } });
    }
    return documents(input as string, init);
  });
  const harness = await mountEditor(draft);
  last = harness;
  return { ...harness, sent, asked };
};

describe("a citation in reading", () => {
  it("Given a document citing two works, Then each citation carries a card naming its work, and the list after the last block holds both in number order", async () => {
    const view = await mount();
    await view.settle(() => view.root.querySelector('[data-cite-card="wrk-2"]') != null);
    expect(view.asked.some((url) => url.endsWith(`document=${draft.documentId}`))).toBe(true);

    const card = view.root.querySelector('[data-cite-card="wrk-2"]') as HTMLElement;
    expect(card.querySelector(".cite-card__line")?.textContent).toBe("Kucsko (2013) — Thermometry");
    expect(card.querySelector(".cite-card__locator")?.textContent).toBe("p. 54");
    expect(card.querySelector("[data-cite-doi]")?.getAttribute("href")).toBe("https://doi.org/10.1038/nature12373");
    expect(card.querySelector("[data-cite-file]")?.getAttribute("href")).toBe("/api/x/bibliography/works/wrk-2/file");
    const other = view.root.querySelector('[data-cite-card="wrk-1"]') as HTMLElement;
    expect(other.querySelector("[data-cite-file]") ?? null).toBeNull();
    expect(other.querySelector(".cite-card__locator") ?? null).toBeNull();

    // The reference list, drawn by the bibliography through the end place.
    await view.settle(() => view.root.querySelectorAll("[data-reference-list] [data-reference]").length === 2);
    const entries = Array.from(view.root.querySelectorAll("[data-reference-list] [data-reference]")) as HTMLElement[];
    expect(entries.map((entry) => entry.getAttribute("data-reference"))).toEqual(["wrk-2", "wrk-1"]);
    expect(entries[0]?.querySelector(".bib-references__label")?.textContent).toBe("[1]");
    expect(entries[0]?.querySelector("em")?.textContent).toBe("Nature");
    expect(entries[1]?.textContent).toContain("I. Goodfellow, Deep learning. MIT Press, 2016.");
  });

  it("Given the card's Open source pressed, Then the work's page opens in its tab", async () => {
    const view = await mount();
    await view.settle(() => view.root.querySelector('[data-cite-open="wrk-2"]') != null);
    await view.userEvent('[data-cite-open="wrk-2"]', "click");
    await view.settle(() => (view.record.opened ?? []).some((target) => target.itemId === "wrk-2"));
    expect((view.record.opened ?? []).find((target) => target.itemId === "wrk-2")).toMatchObject({ kind: "bibliography:work", title: "Thermometry" });
  });
});
