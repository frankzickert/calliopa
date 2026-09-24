import { jsx } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { RunChip } from "./view-bridge";
import { chipsFor } from "~/lib/run-chips";
import { HOST_CHIPS, RunChipsHost } from "./testing/run-chips-host";

/**
 * The run chips, pressed through the shell's own JSX (`run-chips-host.tsx`):
 * one chip per open run group of the active tab's target, newest first, on a
 * line right after the view bar, the chip itself showing or hiding its change
 * and its Reject all and Accept all answering it once the run has ended.
 * BO_0265_008 CA_0055_001 CA_0055_002 CA_0055_004 The reader's own
 * proposal sessions stand among them, answered at once. CA_0057_004
 */
const mount = async (chips: readonly RunChip[] = HOST_CHIPS) => {
  const dom = await createDOM();
  await dom.render(jsx(RunChipsHost, { chips }));
  const root = dom.screen as unknown as HTMLElement;
  // This DOM answers `undefined`, not `null`, when nothing matches.
  const find = (selector: string) => (root.querySelector(selector) as HTMLElement | null) ?? null;
  const all = (selector: string) => Array.from(root.querySelectorAll(selector)) as HTMLElement[];
  const read = (selector: string) => JSON.parse(find(selector)?.textContent ?? "null") as Record<string, unknown>;
  return { ...dom, root, find, all, read };
};

describe("the run chips under the view bar", () => {
  it("Given the view's chips, Then they stand in order right after the bar, each named by whose run and what it did, answers only once ended", async () => {
    const { find, all } = await mount();
    const line = find(".run-chips") as HTMLElement;
    expect(line.previousElementSibling?.classList.contains("view-bar")).toBe(true);
    expect(all(".run-chip").map((chip) => chip.getAttribute("data-run-chip"))).toEqual(["arun-live", "node:run-old"]);
    const [running, ended] = all(".run-chip");
    expect(running?.querySelector(".run-chip__text")?.textContent).toBe("Reading the document");
    expect(running?.querySelector("img")?.getAttribute("src")).toBe("/agents/clauderic.webp");
    expect(running?.innerHTML).not.toContain("data-run-accept-all");
    expect(ended?.querySelector(".run-chip__toggle")?.getAttribute("aria-label")).toBe("Hide an agent's proposals: 3 rewrites, 1 insert");
    expect(ended?.querySelector(".run-chip__answer:first-child")?.getAttribute("aria-label")).toBe("Reject all of an agent's proposals");
    expect(ended?.querySelector(".run-chip__answer:last-child")?.getAttribute("aria-label")).toBe("Accept all of an agent's proposals");
  });

  it("When a chip itself is pressed, Then it asks the view to show or hide its change, and its answers ask for nothing of the kind", async () => {
    const { read, userEvent } = await mount();
    await userEvent('[data-run-chip-toggle="node:run-old"]', "click");
    expect(read("[data-toggle-run]")).toEqual({ itemId: "doc-1", key: "node:run-old", seq: 1, work: false });
    await userEvent('[data-run-reject-all="node:run-old"]', "click");
    expect(read("[data-answer-all]")).toEqual({ itemId: "doc-1", group: "node:run-old", answer: "rejected", seq: 1 });
    expect(read("[data-toggle-run]")["seq"]).toBe(1);
    await userEvent('[data-run-accept-all="node:run-old"]', "click");
    expect(read("[data-answer-all]")).toEqual({ itemId: "doc-1", group: "node:run-old", answer: "accepted", seq: 2 });
    await userEvent('[data-run-chip-toggle="node:run-old"]', "click");
    expect(read("[data-toggle-run]")["seq"]).toBe(2);
  });

  it("Given a change shown and one hidden, Then each chip's pressed state and name say which, and a run that staged nothing cannot be pressed", async () => {
    const { find } = await mount([
      { ...(HOST_CHIPS[0] as RunChip) },
      { ...(HOST_CHIPS[1] as RunChip), shown: false },
    ]);
    const live = find('[data-run-chip-toggle="arun-live"]') as HTMLElement;
    expect(live.getAttribute("aria-pressed")).toBe("true");
    expect(live.hasAttribute("disabled")).toBe(true);
    const old = find('[data-run-chip-toggle="node:run-old"]') as HTMLElement;
    expect(old.getAttribute("aria-pressed")).toBe("false");
    expect(old.getAttribute("aria-label")).toBe("Show an agent's proposals: 3 rewrites, 1 insert");
  });

  it("Given a session chip, Then its answers stand at once, its press asks the view to work in it, and its names say the session", async () => {
    const session: RunChip = { key: "node:branch-doc-1-alice", group: "node:branch-doc-1-alice", face: { kind: "icon", icon: "user" }, tone: "person", name: "you", text: "Proposal · yours · 14:32", ended: true, shown: false, session: true };
    const { find, read, userEvent } = await mount([session]);
    const chip = find('[data-run-chip="node:branch-doc-1-alice"]') as HTMLElement;
    expect(chip.getAttribute("data-run-chip-session")).toBe("true");
    expect(find(".run-chip__text")?.textContent).toBe("Proposal · yours · 14:32");
    expect(find(".run-chip__toggle")?.getAttribute("aria-label")).toBe("Show Proposal · yours · 14:32");
    expect(find("[data-run-chip-work]")?.getAttribute("aria-label")).toBe("Work in Proposal · yours · 14:32");
    expect(find("[data-run-chip-work]")?.getAttribute("aria-pressed")).toBe("false");
    expect(find("[data-run-reject-all]")?.getAttribute("aria-label")).toBe("Reject all of Proposal · yours · 14:32");
    expect(find("[data-run-accept-all]")?.getAttribute("aria-label")).toBe("Accept all of Proposal · yours · 14:32");
    await userEvent('[data-run-chip-toggle="node:branch-doc-1-alice"]', "click");
    expect(read("[data-toggle-run]")).toEqual({ itemId: "doc-1", key: "node:branch-doc-1-alice", seq: 1, work: false });
    await userEvent('[data-run-chip-work="node:branch-doc-1-alice"]', "click");
    expect(read("[data-toggle-run]")).toEqual({ itemId: "doc-1", key: "node:branch-doc-1-alice", seq: 2, work: true });
    await userEvent('[data-run-accept-all="node:branch-doc-1-alice"]', "click");
    expect(read("[data-answer-all]")).toEqual({ itemId: "doc-1", group: "node:branch-doc-1-alice", answer: "accepted", seq: 1 });
  });

  it("Given a session someone else accepts, Then the chip says so in place of Accept all and still offers Reject all", async () => {
    const session: RunChip = { key: "node:branch-doc-1-alice", group: "node:branch-doc-1-alice", face: { kind: "icon", icon: "user" }, tone: "person", name: "you", text: "Proposal · yours · 14:32", ended: true, shown: true, session: true, working: true, accepts: "others" };
    const { find } = await mount([session]);
    // The session the tab works in: marked, its pencil pressed, and its own
    // press idle, since it is the document the tab reads. CA_0057_014
    expect(find("[data-run-chip]")?.getAttribute("data-run-chip-working")).toBe("true");
    expect(find("[data-run-chip-work]")?.getAttribute("aria-pressed")).toBe("true");
    expect(find("[data-run-chip-work]")?.getAttribute("aria-label")).toBe("Stop working in Proposal · yours · 14:32");
    expect(find(".run-chip__toggle")?.hasAttribute("disabled")).toBe(true);
    expect(find("[data-run-accept-all]")).toBeNull();
    expect(find("[data-run-accepts-others]")?.textContent?.trim()).toBe("Someone else accepts it.");
    expect(find("[data-run-reject-all]")).not.toBeNull();
  });

  it("Given the stylesheet, Then a shown chip takes its proposer's ground and the session worked in the accent", () => {
    const css = readFileSync(new URL("./shell.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.run-chip\[data-run-chip-shown\]\s*\{[^}]*background:\s*var\(--proposal-person\)/u);
    expect(css).toMatch(/\.run-chip\[data-run-chip-shown\]\[data-run-chip-tone="claude"\]\s*\{[^}]*background:\s*var\(--proposal-claude\)/u);
    expect(css).toMatch(/\.run-chip\[data-run-chip-working\]\s*\{[^}]*var\(--accent\)/u);
  });

  it("Given a touch screen, Then no rule gives the chips a minimum height", () => {
    const css = readFileSync(new URL("./shell.css", import.meta.url), "utf8");
    const chipRules = css.match(/[^{}]*\.run-chip[^{}]*\{[^}]*\}/gu) ?? [];
    expect(chipRules.length).toBeGreaterThan(0);
    expect(chipRules.some((rule) => /min-height/u.test(rule))).toBe(false);
  });

  it("Given several chips, Then the line says so, the collapsed one draws its number, and every name it carries is unchanged", async () => {
    const ended = HOST_CHIPS[1] as RunChip;
    const { find } = await mount([
      { ...ended, key: "node:run-a", group: "node:run-a", shown: true },
      { ...ended, key: "node:run-b", group: "node:run-b", shown: false, count: 2 },
    ]);
    expect(find(".run-chips")?.getAttribute("data-run-chips-several")).toBe("true");
    expect(find('[data-run-chip-count="node:run-b"]')?.textContent).toBe("2");
    // The words and the labels stand in the chip, hidden by the line's rules,
    // so only the eye loses them. CA_0061_001
    expect(find('[data-run-chip="node:run-b"] .run-chip__text')?.textContent).toBe("3 rewrites, 1 insert");
    expect(find('[data-run-chip-toggle="node:run-b"]')?.getAttribute("aria-label")).toBe("Show an agent's proposals: 3 rewrites, 1 insert");
    expect(find('[data-run-reject-all="node:run-b"]')?.getAttribute("aria-label")).toBe("Reject all of an agent's proposals");
    expect(find('[data-run-accept-all="node:run-b"]')?.getAttribute("aria-label")).toBe("Accept all of an agent's proposals");
  });

  it("Given one chip alone, Then the line is not a line of several and nothing is minimized", async () => {
    const { find } = await mount([{ ...(HOST_CHIPS[1] as RunChip) }]);
    expect(find(".run-chips")?.hasAttribute("data-run-chips-several")).toBe(false);
  });

  it("Given a run still going beside an ended one, Then it is not an ended chip and has no number to draw", async () => {
    const { find } = await mount(HOST_CHIPS);
    const live = find('[data-run-chip="arun-live"]') as HTMLElement;
    expect(live.hasAttribute("data-run-chip-ended")).toBe(false);
    expect(find('[data-run-chip-count="arun-live"]')).toBeNull();
  });

  it("Given a session someone else accepts, Then the warning sign stands in the accept's place and the words are still in the chip", async () => {
    const session: RunChip = { key: "node:branch-doc-1-alice", group: "node:branch-doc-1-alice", face: { kind: "icon", icon: "user" }, tone: "person", name: "you", text: "Proposal · yours · 14:32", count: 2, ended: true, shown: false, session: true, accepts: "others" };
    const { find } = await mount([session, { ...(HOST_CHIPS[1] as RunChip) }]);
    expect(find("[data-run-accepts-sign] [data-icon]")?.getAttribute("data-icon")).toBe("warning");
    expect(find("[data-run-accepts-sign]")?.getAttribute("title")).toBe("Someone else accepts it.");
    expect(find("[data-run-accepts-others]")?.textContent?.trim()).toBe("Someone else accepts it.");
    expect(find("[data-run-chip-work]")).not.toBeNull();
  });

  it("Given the stylesheet, Then a line of several draws every chip but the expanded one as a face, a number and two signs", () => {
    const css = readFileSync(new URL("./shell.css", import.meta.url), "utf8");
    const minimal = String.raw`\.run-chips\[data-run-chips-several\] \.run-chip\[data-run-chip-ended\]:not\(\[data-run-chip-shown\]\) `;
    expect(css).toMatch(/\.run-chip__count \{[^}]*display:\s*none/u);
    expect(css).toMatch(/\.run-chip__note-sign \{[^}]*display:\s*none/u);
    expect(css).toMatch(new RegExp(`${minimal}\\.run-chip__text \\{[^}]*display:\\s*none`, "u"));
    expect(css).toMatch(new RegExp(`${minimal}\\.run-chip__count \\{[^}]*display:\\s*inline`, "u"));
    expect(css).toMatch(new RegExp(`${minimal}\\.run-chip__answer > span \\{[^}]*display:\\s*none`, "u"));
    expect(css).toMatch(new RegExp(`${minimal}\\.run-chip__note-sign \\{[^}]*display:\\s*inline-grid`, "u"));
    // The words someone else accepts it by are hidden to the eye alone.
    expect(css).toMatch(new RegExp(`${minimal}\\.run-chip__note \\{[^}]*clip:\\s*rect\\(0, 0, 0, 0\\)`, "u"));
    // A collapsed chip carries no ground and its number is muted. CA_0061_003
    expect(css).toMatch(/\.run-chip:not\(\[data-run-chip-shown\]\) \.run-chip__count \{[^}]*color:\s*var\(--text-muted\)/u);
  });

  it("Given the stylesheet, Then the line is one row that scrolls and an end with chips beyond it fades", () => {
    const css = readFileSync(new URL("./shell.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.run-chips \{[^}]*flex-wrap:\s*nowrap/u);
    expect(css).toMatch(/\.run-chips \{[^}]*overflow-x:\s*auto/u);
    expect(css).toMatch(/\.run-chips \{[^}]*overflow-y:\s*hidden/u);
    // The fade is the bar's idiom on the line's ground: sticky items pulled
    // back out of the flow, shown from what the line reads off itself.
    expect(css).toMatch(/\.run-chips::before,\s*\n\.run-chips::after \{[^}]*position:\s*sticky/u);
    expect(css).toMatch(/\.run-chips::before \{[^}]*margin-inline-end:\s*-1\.5rem/u);
    expect(css).toMatch(/\.run-chips::after \{[^}]*margin-inline-start:\s*-1\.5rem/u);
    expect(css).toMatch(/\.run-chips\[data-more-start\]::before,\s*\n\.run-chips\[data-more-end\]::after \{[^}]*opacity:\s*1/u);
    // A chip keeps its size; the expanded one is held to the line and its
    // words are what give way. CA_0062_005
    expect(css).toMatch(/\.run-chip \{[^}]*flex:\s*0 0 auto/u);
    expect(css).toMatch(/\.run-chip \{[^}]*max-width:\s*100%/u);
    expect(css).toMatch(/\.run-chip__text \{[^}]*text-overflow:\s*ellipsis/u);
  });

  it("Given a line whose chips fit, Then neither end fades", async () => {
    const { find } = await mount();
    const line = find(".run-chips") as HTMLElement;
    // The harness measures nothing, which is a line whose chips fit: the fade
    // is drawn from what the line reads off itself, and the widths it reads
    // are the browser's. The walk covers the fade drawn (CA_0062_008).
    expect(line.hasAttribute("data-more-start")).toBe(false);
    expect(line.hasAttribute("data-more-end")).toBe(false);
  });

  it("Given a chip that becomes the expanded one, Then the line scrolls to it unless the reader pressed it", async () => {
    const ended = HOST_CHIPS[1] as RunChip;
    const scrolled: string[] = [];
    const { root, userEvent } = await mount([
      { ...ended, key: "node:run-a", group: "node:run-a", shown: false },
      { ...ended, key: "node:run-b", group: "node:run-b", shown: false },
    ]);
    const watch = () => {
      for (const chip of Array.from(root.querySelectorAll("[data-run-chip]")) as HTMLElement[]) {
        chip.scrollIntoView = () => scrolled.push(chip.getAttribute("data-run-chip") ?? "");
      }
    };
    watch();

    // A run ending takes the expansion: nothing was pressed, so the line
    // scrolls to it. CA_0062_004
    await userEvent('[data-harness-show="node:run-b"]', "click");
    watch();
    expect(scrolled).toEqual(["node:run-b"]);

    // The chip the reader pressed is where their hand is: no scrolling to it.
    await userEvent('[data-run-chip-toggle="node:run-a"]', "click");
    await userEvent('[data-harness-show="node:run-a"]', "click");
    watch();
    expect(scrolled).toEqual(["node:run-b"]);
  });

  it("Given no chips, Then there is no line", async () => {
    const { find } = await mount([]);
    expect(find(".run-chips")).toBeNull();
  });

  it("Given a tab, Then its target's chips are the ones drawn, and a tab that is not a document has none", () => {
    expect(chipsFor({ "doc-1": HOST_CHIPS }, { kind: "documents:document", itemId: "doc-1" } as never)).toHaveLength(2);
    expect(chipsFor({ "doc-1": HOST_CHIPS }, { kind: "documents:document", itemId: "doc-2" } as never)).toHaveLength(0);
    expect(chipsFor({ "doc-1": HOST_CHIPS }, { kind: "settings:settings", itemId: "instance" } as never)).toHaveLength(0);
  });
});
