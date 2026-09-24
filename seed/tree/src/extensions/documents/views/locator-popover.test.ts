import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../server/assemble";
import { SAVE_PAUSE_MS } from "./block-editor";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A citation's locator edited over it (`BO_0291_034`): pressing the second of
 * two citations while the block is edited opens the panel with its locator,
 * Done writes the new one onto that citation alone, and an emptied field
 * takes the locator away.
 */
const draft: DocumentView = {
  documentId: "doc-locator",
  revisionId: "rev-doc",
  title: "Locators",
  blocks: [
    {
      kind: "text",
      blockId: "blk-a",
      revisionId: "rev-a",
      containmentId: "c-a",
      order: "a",
      role: "paragraph",
      standing: "keep",
      runs: [{ text: "See " }, { text: "", cite: { work: "wrk-1" } }, { text: " and " }, { text: "", cite: { work: "wrk-2", locator: "p. 3" } }, { text: "." }],
    },
  ],
};

let last: { idle: () => Promise<void> } | null = null;

afterEach(async () => {
  await last?.idle();
  last = null;
  vi.unstubAllGlobals();
});

const mount = async () => {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent, { follow: true }));
  const harness = await mountEditor(draft);
  last = harness;
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

const cites = (view: { sent: SentCommand[] }) =>
  view.sent
    .filter((command) => command.body["command"] === "revise")
    .map((command) => ((command.body["runs"] as { cite?: { work: string; locator?: string } }[]) ?? []).flatMap((run) => (run.cite === undefined ? [] : [run.cite])));

describe("a citation's locator", () => {
  it("Given the second citation pressed while editing, Then its panel holds its locator, Done writes the new one onto it alone, and an emptied field takes it away", async () => {
    const view = await mount();
    await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "focus");
    await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "keydown", { key: "Enter" });
    await view.settle(() => view.root.querySelectorAll("[data-block-editor] [data-cite-work]").length === 2);

    const second = () => view.root.querySelectorAll("[data-block-editor] [data-cite-work]")[1] as HTMLElement;
    // The harness does not bubble: the press is dispatched on the editing
    // surface with the atom as its target, as the reference-math test does.
    await view.userEvent("[data-block-editor]", "click", { target: second() });
    await view.settle(() => view.root.querySelector("[data-locator-field]") != null);
    const field = view.root.querySelector("[data-locator-field]") as HTMLInputElement;
    expect(field.getAttribute("value")).toBe("p. 3");
    field.value = "pp. 12-14";
    await view.userEvent(field, "input");
    await view.userEvent("[data-locator-done]", "click");
    await view.settle(() => view.root.querySelector("[data-locator-popover]") == null);
    await view.waitFor(() => cites(view).length >= 1);
    expect(cites(view)[0]).toEqual([{ work: "wrk-1" }, { work: "wrk-2", locator: "pp. 12-14" }]);

    await view.userEvent("[data-block-editor]", "click", { target: second() });
    await view.settle(() => view.root.querySelector("[data-locator-field]") != null);
    const again = view.root.querySelector("[data-locator-field]") as HTMLInputElement;
    again.value = "";
    await view.userEvent(again, "input");
    await view.userEvent("[data-locator-popover]", "keydown", { key: "Enter" });
    await view.settle(() => view.root.querySelector("[data-locator-popover]") == null);
    await view.waitFor(() => cites(view).length >= 2);
    expect(cites(view)[cites(view).length - 1]).toEqual([{ work: "wrk-1" }, { work: "wrk-2" }]);
    await view.idle();
  }, SAVE_PAUSE_MS * 2 + 5000);
});
