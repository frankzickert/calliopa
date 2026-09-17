import { jsx } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import type { LibraryItem } from "~/contract";
import { LibraryRowHost } from "./testing/library-row-host";

/**
 * A library row pressed through the shell's own JSX: a document a run started
 * and nobody has taken yet carries its proposer's face and says so in its
 * name; an ordinary row carries neither. BO_0251_012
 */
const open = (itemId: string, title: string) => ({ kind: "documents:document", itemId, title });
const items: LibraryItem[] = [
  { id: "doc-plain", label: "Notes", open: open("doc-plain", "Notes") },
  {
    id: "doc-started",
    label: "Onboarding checklist",
    open: open("doc-started", "Onboarding checklist"),
    proposedBy: { agent: "claude-code", name: "Claude Code" },
  },
  {
    id: "doc-person",
    label: "Handover",
    open: open("doc-person", "Handover"),
    proposedBy: { agent: null, name: "sam" },
  },
];

const mount = async () => {
  const dom = await createDOM();
  await dom.render(jsx(LibraryRowHost, { items }));
  const root = dom.screen as unknown as HTMLElement;
  const find = (selector: string) => (root.querySelector(selector) as HTMLElement | null) ?? null;
  await dom.userEvent("[data-load]", "click");
  return { ...dom, root, find };
};

const nameOf = (row: HTMLElement | null) =>
  row === null
    ? null
    : Array.from(row.querySelectorAll(".library-entry__label, .visually-hidden"))
        .map((part) => part.textContent)
        .join("");

describe("a proposed document in the library", () => {
  it("Given a started document nobody has taken, Then its row carries the proposer's face and is named as proposed by them", async () => {
    const { find } = await mount();
    const row = find('[data-item-id="doc-started"]');
    expect(row?.hasAttribute("data-proposed")).toBe(true);
    const face = row?.querySelector("[data-proposer-face]") as HTMLImageElement | null;
    expect(face?.getAttribute("src")).toBe("/agents/clauderic.webp");
    expect(face?.getAttribute("alt")).toBe("");
    expect(nameOf(row)).toBe("Onboarding checklist, proposed by Claude Code");
  });

  it("Given a person proposed it, Then the row carries the neutral face and their name", async () => {
    const { find } = await mount();
    const row = find('[data-item-id="doc-person"]');
    expect(row?.querySelector("img[data-proposer-face]") ?? null).toBeNull();
    expect(row?.querySelector('[data-proposer-face="person"]') != null).toBe(true);
    expect(nameOf(row)).toBe("Handover, proposed by sam");
  });

  it("Given an ordinary document, Then its row carries no face and no proposer in its name", async () => {
    const { find } = await mount();
    const row = find('[data-item-id="doc-plain"]');
    expect(row?.hasAttribute("data-proposed")).toBe(false);
    expect(row?.querySelector("[data-proposer-face]") ?? null).toBeNull();
    expect(nameOf(row)).toBe("Notes");
  });

  it("When a proposed row is pressed, Then it opens as any row does", async () => {
    const { find, userEvent } = await mount();
    await userEvent('[data-item-id="doc-started"]', "click");
    expect(JSON.parse(find("[data-opened]")?.textContent ?? "null")).toEqual(open("doc-started", "Onboarding checklist"));
  });
});
