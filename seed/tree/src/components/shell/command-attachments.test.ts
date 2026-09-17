import { jsx } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import type { Pointing } from "~/lib/command-target";
import { ComposerHost, releaseUpload, resetUploads } from "./testing/composer-host";

/**
 * The paperclip and the attachment chips pressed through the shell's own JSX
 * (`composer-host.tsx`): chosen files become chips, uploading then ready or
 * refused, a file past the bound or the tenth is refused beside the paperclip
 * with nothing uploaded, × takes a chip off, and what *Run* posts is the ready
 * files. BO_0229_010 BO_0229_013
 */
const report: Pointing = { references: [{ kind: "block", number: 1, blockId: "a", words: "Opening.", stale: false }], pinned: [] };

/** Waits, in short steps, until the bar shows what a test expects: a fixed
 * pause flaked under a full suite's load. */
const settle = async (until: () => boolean = () => true) => {
  for (let tick = 0; tick < 200; tick++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (until()) return;
  }
};

const mount = async () => {
  resetUploads();
  const dom = await createDOM();
  await dom.render(jsx(ComposerHost, { report }));
  const root = dom.screen as unknown as HTMLElement;
  const find = (selector: string) => (root.querySelector(selector) as HTMLElement | null) ?? null;
  const all = (selector: string) => Array.from(root.querySelectorAll(selector)) as HTMLElement[];
  const read = (selector: string) => JSON.parse(find(selector)?.textContent ?? "null") as string[];
  return { ...dom, root, find, all, read };
};

describe("the paperclip", () => {
  it("Given the bar, Then Attach files is a native multi-file picker beside the field, disabled while a command is sent", async () => {
    const { find, userEvent } = await mount();
    const input = find("[data-attach-input]");
    expect(input?.getAttribute("type")).toBe("file");
    expect(input?.hasAttribute("multiple")).toBe(true);
    expect(input?.getAttribute("aria-label")).toBe("Attach files");
    expect(find("[data-attach]")?.getAttribute("aria-disabled")).toBe("false");
    expect(find(".composer__bar > [data-attach]")).not.toBeNull();
    await userEvent("[data-sending]", "click");
    expect(input?.hasAttribute("disabled")).toBe(true);
    expect(find("[data-attach]")?.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("the attachment chips", () => {
  it("Given two files and one past 10 MB, Then two chips upload and turn ready, the large one is refused beside the paperclip, and the ready files are what is posted", async () => {
    const { find, all, read, userEvent } = await mount();
    await userEvent("[data-report]", "click");
    await userEvent("[data-host-attach]", "click");
    await settle(() => find("[data-attach-refusal]") !== null && all("[data-attachment-chip]").length === 2);
    expect(find("[data-attach-refusal]")?.textContent).toBe("huge.bin is larger than 10 MB, the most a command can carry per file.");
    const chips = all("[data-attachment-chip]");
    expect(chips.map((chip) => chip.getAttribute("data-attachment-chip"))).toEqual(["plan.md", "notes.txt"]);
    expect(chips.map((chip) => chip.getAttribute("data-attachment-state"))).toEqual(["uploading", "uploading"]);
    expect(chips[0]?.getAttribute("aria-label")).toBe("plan.md, 7 B, uploading");
    expect(read("[data-attachments-uploading]")).toEqual(["plan.md", "notes.txt"]);
    expect(read("[data-attachments-sent]")).toEqual([]);

    // The chips sit along the field's edge, before the reference chips.
    const field = find(".composer__field");
    const order = Array.from(field?.children ?? []).map((child) => (child as HTMLElement).getAttribute("data-attachments") !== null ? "attachments" : (child as HTMLElement).getAttribute("data-chips") !== null ? "references" : "");
    expect(order.indexOf("attachments")).toBeLessThan(order.indexOf("references"));

    releaseUpload();
    releaseUpload("notes.txt could not be read");
    await settle(() => all("[data-attachment-chip]").every((chip) => chip.getAttribute("data-attachment-state") !== "uploading"));
    await userEvent("[data-sending]", "click");
    await userEvent("[data-sending]", "click");
    const settled = all("[data-attachment-chip]");
    expect(settled.map((chip) => chip.getAttribute("data-attachment-state"))).toEqual(["ready", "refused"]);
    expect(settled[1]?.getAttribute("aria-label")).toBe("notes.txt, refused: notes.txt could not be read");
    expect(read("[data-attachments-sent]")).toEqual(["plan.md"]);
    expect(read("[data-attachments-uploading]")).toEqual([]);

    // × takes a chip off, by its name.
    expect(find('[data-attachment-remove="notes.txt"]')?.getAttribute("aria-label")).toBe("Remove «notes.txt»");
    await userEvent('[data-attachment-remove="notes.txt"]', "click");
    expect(all("[data-attachment-chip]").map((chip) => chip.getAttribute("data-attachment-chip"))).toEqual(["plan.md"]);
    expect(find("[data-attach-refusal]")).toBeNull();
    await userEvent('[data-attachment-remove="plan.md"]', "click");
    expect(find("[data-attachments]")).toBeNull();
    expect(read("[data-attachments-sent]")).toEqual([]);
  });

  it("Given eleven files, Then ten upload and the eleventh is refused beside the paperclip without an upload", async () => {
    const { find, all, read, userEvent } = await mount();
    await userEvent("[data-host-attach-many]", "click");
    await settle(() => all("[data-attachment-chip]").length === 10);
    expect(all("[data-attachment-chip]")).toHaveLength(10);
    expect(find("[data-attach-refusal]")?.textContent).toBe("f10.txt was not attached: a command carries at most 10 files.");
    expect(read("[data-attachments-uploading]")).toHaveLength(10);
    for (let i = 0; i < 10; i += 1) releaseUpload();
    await settle(() => all("[data-attachment-chip]").every((chip) => chip.getAttribute("data-attachment-state") === "ready"));
    await userEvent("[data-sending]", "click");
    await userEvent("[data-sending]", "click");
    expect(read("[data-attachments-sent]")).toHaveLength(10);
  });
});
