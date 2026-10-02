import { $, jsx } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VariationChoice } from "./variation";

/**
 * The variation chosen beside Send (`calliopa-bootstrap`'s `BO_0336_023`):
 * drawn when the instruction the chip chose names a format with variations, set
 * on the command for one send, and nothing otherwise. What the route answers
 * is stood in for by the browser's own `fetch`.
 */
afterEach(() => {
  vi.unstubAllGlobals();
});

const answering = (asked: string[]) => async (url: string) => {
  asked.push(url);
  return new Response(
    JSON.stringify(
      url.includes("instruction=prof-img")
        ? { format: { id: "fmt-sq", title: "Instagram square" }, variations: [{ id: "var-story", title: "Story 9:16" }] }
        : { format: { id: "fmt-plain", title: "Plain" }, variations: [] },
    ),
    { status: 200 },
  );
};

async function mount(options: Record<string, string>, set: { name: string; value: string | null; once?: boolean }[]) {
  const dom = await createDOM();
  await dom.render(
    jsx(VariationChoice, {
      documentId: "doc-1",
      blockId: "blk-1",
      revisionId: "rev-1",
      active: true,
      commandOptions: options,
      setOption$: $((name: string, value: string | null, once?: boolean) => {
        set.push({ name, value, ...(once === undefined ? {} : { once }) });
      }),
    }),
  );
  const root = dom.screen as unknown as HTMLElement;
  const settle = async (until: () => boolean) => {
    for (let at = 0; at < 60 && !until(); at++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await dom.userEvent(root, "harnessSettle");
    }
  };
  return { dom, root, settle };
}

describe("the variation beside Send", () => {
  it("offers the instruction's format and its variations, and sets a choice for one send", async () => {
    const asked: string[] = [];
    const set: { name: string; value: string | null; once?: boolean }[] = [];
    vi.stubGlobal("fetch", answering(asked));
    const { root, settle, dom } = await mount({ instruction: "prof-img" }, set);
    await settle(() => (root.querySelector("[data-media-variation-select]") ?? null) !== null);
    expect(asked).toEqual(["/api/x/media/variations?instruction=prof-img"]);
    expect(Array.from(root.querySelectorAll("[data-media-variation-option]")).map((one) => one.textContent)).toEqual(["Instagram square", "Story 9:16"]);
    (root.querySelector("[data-media-variation-select]") as HTMLSelectElement).value = "var-story";
    await dom.userEvent("[data-media-variation-select]", "change");
    await settle(() => set.length > 0);
    expect(set).toEqual([{ name: "variation", value: "var-story", once: true }]);
  });

  it("draws nothing without an instruction, or for a format with no variations", async () => {
    vi.stubGlobal("fetch", answering([]));
    const none = await mount({}, []);
    await none.settle(() => false);
    expect(none.root.querySelector("[data-media-variation]")).toBeFalsy();
    const plain = await mount({ instruction: "prof-plain" }, []);
    await plain.settle(() => false);
    expect(plain.root.querySelector("[data-media-variation]")).toBeFalsy();
  });

  it("clears a variation that is not the chosen instruction's format's", async () => {
    const set: { name: string; value: string | null; once?: boolean }[] = [];
    vi.stubGlobal("fetch", answering([]));
    const { settle } = await mount({ instruction: "prof-plain", variation: "var-story" }, set);
    await settle(() => set.length > 0);
    expect(set).toEqual([{ name: "variation", value: null }]);
  });
});
