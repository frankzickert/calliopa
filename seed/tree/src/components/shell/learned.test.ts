import { jsx } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { entryMarked, forwardMarked, readForward } from "~/lib/forward";
import { erasesAt, learnedOn, readLearned } from "~/lib/learned";
import { LearnedHost } from "./testing/learned-host";

/**
 * What Hermes learned, in the right panel (BO_0350_023), and the work it puts
 * forward (BO_0350_024): the reader's conclusions as rows, erased by a left
 * swipe or Delete and never by a right swipe, the memory said to be off when
 * it is; a document marked where it is held, and no longer once opened.
 */
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("what is learned and put forward, decided", () => {
  it("Given the kernel's answer, Then only well-formed rows are read, and anything else is the memory off", () => {
    expect(readLearned({ memory: "on", learned: [{ id: "c-1", words: "Short openings.", at: "2026-10-05T10:00:00Z" }, { id: "", words: "x" }, 3] })).toEqual({
      memory: "on",
      learned: [{ id: "c-1", words: "Short openings.", at: "2026-10-05T10:00:00Z" }],
    });
    expect(readLearned(null)).toEqual({ memory: "off", learned: [] });
    expect(learnedOn("2026-10-05T10:00:00Z")).toBe("2026-10-05");
    expect(learnedOn("")).toBe("");
  });

  it("Given a release, Then a left swipe past the share erases and a right one or a short one never does", () => {
    expect(erasesAt(-120, 300)).toBe(true);
    expect(erasesAt(-60, 300)).toBe(false);
    expect(erasesAt(200, 300)).toBe(false);
  });

  it("Given what Hermes puts forward, Then an opened document is no longer marked, and an entry is marked only while no tab holds it", () => {
    const marked = forwardMarked(readForward({ forward: ["doc-1", "doc-2", 7] }), ["doc-2"]);
    expect([...marked]).toEqual(["doc-1"]);
    expect(entryMarked(marked, "doc-1", ["doc-3"])).toBe(true);
    expect(entryMarked(marked, "doc-1", ["doc-1"])).toBe(false);
    expect(entryMarked(marked, null, [])).toBe(false);
    expect(readForward({})).toEqual([]);
  });
});

describe("the What Hermes learned category", () => {
  const mount = async (answer: unknown, erased: string[] = []) => {
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        erased.push(url);
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify(answer), { headers: { "content-type": "application/json" } });
    });
    const dom = await createDOM();
    await dom.render(jsx(LearnedHost, {}));
    const root = dom.screen as unknown as HTMLElement;
    // The read is a visible task, woken as the browser wakes it.
    await dom.userEvent("[data-learned]", "qvisible");
    const settle = async (until: () => boolean) => {
      for (let tick = 0; tick < 100 && !until(); tick++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        await dom.userEvent(root, "harnessSettle");
      }
    };
    return { ...dom, root, settle, erased };
  };

  it("Given what was learned, Then each is a row, and Delete on one erases it", async () => {
    const view = await mount({ memory: "on", learned: [{ id: "c-1", words: "Prefers short openings.", at: "2026-10-05T10:00:00Z" }, { id: "c-2", words: "Keeps cards for Mondays.", at: "" }] });
    await view.settle(() => view.root.querySelectorAll("[data-learned-row]").length === 2);
    expect(view.root.querySelector('[data-learned-row="c-1"]')?.textContent).toContain("2026-10-05");
    await view.userEvent('[data-learned-row="c-1"]', "keydown", { key: "Delete" });
    await view.settle(() => view.root.querySelector('[data-learned-row="c-1"]') === null);
    expect(view.erased).toEqual(["/api/hermes/learned/c-1"]);
    expect(view.root.querySelectorAll("[data-learned-row]").length).toBe(1);
  });

  it("Given no memory, Then the category says so and draws no rows", async () => {
    const view = await mount({ memory: "off", learned: [] });
    await view.settle(() => view.root.querySelector("[data-learned-off]") !== null);
    expect(view.root.querySelector("[data-learned-off]")?.textContent).toContain("keeps no memory");
    expect(view.root.querySelectorAll("[data-learned-row]").length).toBe(0);
  });
});
