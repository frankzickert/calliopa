import { $, component$, jsx, useContextProvider, useStore, type JSXOutput } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActionControl } from "~/components/shell/inspector";
import { ViewBridgeContext, type ViewBar, type ViewBridge } from "~/components/shell/view-bridge";

import type { ManuscriptView } from "../lib/manuscript";
import { ManuscriptProvider } from "./bar";
import { ManuscriptPage } from "./manuscript";
import { ManuscriptsSection } from "./section";

/**
 * The manuscripts extension's surfaces in Qwik's render harness
 * (`BO_0293_022`): the section listing the kept manuscripts, a kept
 * manuscript's page with its files, what was left out and the typesetting's
 * warnings, and *Make manuscript* in the document's bar, whose press makes
 * one and opens it. What the routes answer is stood in for by the browser's
 * own `fetch`, answered with the shapes the server's tests prove.
 */
const kept: ManuscriptView = {
  manuscriptId: "0ba160b6-1819-4d78-a04b-7d2ba21a01fa",
  revisionId: "rev-m",
  of: "doc-1",
  title: "A Manuscript",
  revision: 2186,
  venue: "ieee",
  files: [
    { objectId: "a", filename: "manuscript.pdf", mediaType: "application/pdf", size: 93730 },
    { objectId: "b", filename: "manuscript.tex", mediaType: "text/x-tex", size: 2048 },
    { objectId: "c", filename: "references.bib", mediaType: "text/x-bibtex", size: 512 },
  ],
  made: "2026-09-23T15:49:00.000Z",
  by: "frankzickert",
  outcome: "ok",
  log: ["Package caption Warning: Unknown document class (or package)"],
  omitted: ["A video: a manuscript is printed."],
};

/** A host supplying the bridge the surfaces read: the decoration bar a
 * provider writes its group into, and the two calls it makes. */
const opened: { kind: string; itemId: string }[] = [];
const raised: string[] = [];
const hosted = (child: JSXOutput) =>
  component$(() => {
    const decorationBar = useStore<ViewBar>({ groups: [] });
    const bridge = {
      decorationBar,
      openTarget$: $((target: { kind: string; itemId: string }) => {
        opened.push({ kind: target.kind, itemId: target.itemId });
      }),
      raiseMessage$: $((message: { body: string }) => {
        raised.push(message.body);
      }),
    } as unknown as ViewBridge;
    useContextProvider(ViewBridgeContext, bridge);
    return jsx("div", {
      children: [
        child,
        // The group as the shell's bar draws it, through its own control.
        jsx("div", {
          "data-test-bar": "",
          children: decorationBar.groups.flatMap((group) => group.actions.map((action) => jsx(ActionControl, { action, surface: "bar" }, action.id))),
        }),
      ],
    });
  });

async function mount(child: JSXOutput) {
  const dom = await createDOM();
  await dom.render(jsx(hosted(child), {}));
  const root = dom.screen as unknown as HTMLElement;
  // A render is flushed by an event nothing listens for, as the editor's
  // harness settles one; the reads a visible task starts answer between.
  const settle = async (until: () => boolean) => {
    for (let at = 0; at < 50; at++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await dom.userEvent(root, "harnessSettle");
      if (until()) return;
    }
  };
  return { root, settle, dom };
}

afterEach(() => {
  vi.unstubAllGlobals();
  opened.length = 0;
  raised.length = 0;
});

describe("the Manuscripts section", () => {
  it("lists the kept manuscripts with the document's title, the venue and the outcome", async () => {
    const { root } = await mount(jsx(ManuscriptsSection, { data: { reachable: true, manuscripts: [kept] }, activeItemId: null, sectionKey: "manuscripts:manuscripts", filter: null, setFilter$: $(async () => {}) }));
    const row = root.querySelector(`[data-manuscript="${kept.manuscriptId}"]`) as HTMLElement;
    expect(row.textContent).toContain("A Manuscript");
    expect(row.textContent).toContain("ieee");
    expect(row.textContent).toContain("Typeset");
  });

  it("says when there are none, and when they could not be read", async () => {
    expect((await mount(jsx(ManuscriptsSection, { data: { reachable: true, manuscripts: [] }, activeItemId: null, sectionKey: "s", filter: null, setFilter$: $(async () => {}) }))).root.textContent).toContain("No manuscripts yet");
    expect((await mount(jsx(ManuscriptsSection, { data: { reachable: false, manuscripts: [] }, activeItemId: null, sectionKey: "s", filter: null, setFilter$: $(async () => {}) }))).root.textContent).toContain("could not be read");
  });
});

describe("a kept manuscript's page", () => {
  it("offers the PDF to open and the source and references to download, and says what was left out and what the typesetting said", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ outcome: "success", result: kept }), { status: 200, headers: { "content-type": "application/json" } }));
    const { root, settle } = await mount(jsx(ManuscriptPage, { tab: { id: "t", kind: "manuscripts:manuscript", itemId: kept.manuscriptId, title: "A Manuscript" } } as never));
    await settle(() => root.querySelector("[data-manuscript-files]") !== null);
    const pdf = root.querySelector('[data-manuscript-file="manuscript.pdf"]') as HTMLAnchorElement;
    expect(pdf.getAttribute("href")).toBe(`/api/x/manuscripts/manuscripts/${kept.manuscriptId}/files/manuscript.pdf`);
    expect(pdf.getAttribute("target")).toBe("_blank");
    expect(root.querySelector('[data-manuscript-file="manuscript.tex"]')?.getAttribute("download")).toBe("manuscript.tex");
    expect(root.querySelector("[data-manuscript-venue]")?.textContent).toBe("ieee");
    expect(root.querySelector("[data-manuscript-revision]")?.textContent).toBe("2186");
    expect(root.querySelector("[data-manuscript-omitted]")?.textContent).toContain("A video");
    expect(root.querySelector("[data-manuscript-log]")?.textContent).toContain("caption Warning");
  });
});

describe("Make manuscript in the document's bar", () => {
  it("offers the service's venues and the press, and a press makes one and opens it", async () => {
    const asked: { url: string; body?: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      asked.push({ url, ...(typeof init?.body === "string" ? { body: init.body } : {}) });
      if (url === "/api/x/manuscripts/venues") {
        return new Response(JSON.stringify({ reachable: true, venues: [{ id: "generic", name: "Generic article" }, { id: "ieee", name: "IEEE" }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ outcome: "success", result: { manuscriptId: kept.manuscriptId, outcome: "ok" } }), { status: 200 });
    });
    const { root, settle, dom } = await mount(jsx(ManuscriptProvider, { documentId: "doc-1" }));
    const make = () => (root.querySelector('[data-bar-action="manuscript-make"]') ?? null) as HTMLElement | null;
    await settle(() => make() !== null);
    const bar = root.querySelector("[data-test-bar]") as HTMLElement;
    expect(Array.from(bar.querySelectorAll("option")).map((option) => option.textContent)).toEqual(["The document's venue", "Generic article", "IEEE"]);
    expect(make()?.getAttribute("aria-label")).toContain("Make a manuscript of this document");
    await dom.userEvent('[data-bar-action="manuscript-make"]', "click");
    await settle(() => opened.length > 0);
    expect(asked.find((entry) => entry.url === "/api/x/manuscripts/make")?.body).toBe(JSON.stringify({ document: "doc-1" }));
    expect(opened).toEqual([{ kind: "manuscripts:manuscript", itemId: kept.manuscriptId }]);
  });

  it("offers nothing when the typesetting service does not answer", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ reachable: false, venues: [] }), { status: 200 }));
    const { root, settle } = await mount(jsx(ManuscriptProvider, { documentId: "doc-1" }));
    await settle(() => false);
    expect(root.querySelector('[data-bar-action="manuscript-make"]') ?? null).toBeNull();
  });
});
