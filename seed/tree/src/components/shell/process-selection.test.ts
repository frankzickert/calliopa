import { jsx } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import { InspectorHost } from "./testing/inspector-host";

/**
 * The inspector and the panel's run list, pressed through the shell's own JSX
 * (`inspector-host.tsx`). Before CA_0040 a row's press held the inspector for
 * the whole shell and nothing let it go, so a view's actions (a change
 * document's Status among them) were out of reach until a reload. The list is
 * the *Execution* section since `CA_0058_005`.
 * CA_0040_001 CA_0040_002 CA_0040_003
 */
const mount = async () => {
  const dom = await createDOM();
  await dom.render(jsx(InspectorHost, {}));
  const root = dom.screen as unknown as HTMLElement;
  const inspector = () =>
    root.querySelector("[data-inspector-panel]") as HTMLElement;
  // This DOM answers `undefined`, not `null`, when nothing matches.
  const shows = () => ({
    process:
      inspector()
        .querySelector("[data-process-id]")
        ?.getAttribute("data-process-id") ?? null,
    status:
      inspector().querySelector('[data-inspector-action="change-status"]') !=
      null,
  });
  const row = (id: string) =>
    root.querySelector(
      `[data-execution] [data-process-id="${id}"]`,
    ) as HTMLElement;
  return { ...dom, root, shows, row };
};

describe("the selected process, held per tab", () => {
  it("Given no process selected, Then the inspector shows the view's Status", async () => {
    const { shows } = await mount();
    expect(shows()).toEqual({ process: null, status: true });
  });

  it("Given a row pressed, Then its detail takes this tab's inspector and the row says it is pressed", async () => {
    const { shows, row, userEvent } = await mount();
    await userEvent(row("p1"), "click");
    expect(shows()).toEqual({ process: "p1", status: false });
    expect(row("p1").getAttribute("aria-pressed")).toBe("true");
    expect(row("p2").getAttribute("aria-pressed")).toBe("false");
  });

  it("Given a process selected on one tab, When another tab is active, Then that tab shows its view's Status, and the process again on the way back", async () => {
    const { shows, row, userEvent } = await mount();
    await userEvent(row("p1"), "click");
    await userEvent('[data-switch="b"]', "click");
    expect(shows()).toEqual({ process: null, status: true });
    expect(row("p1").getAttribute("aria-pressed")).toBe("false");
    await userEvent('[data-switch="a"]', "click");
    expect(shows()).toEqual({ process: "p1", status: false });
  });

  it("When Close process is pressed, Then the view's Status is back and the row lets go", async () => {
    const { root, shows, row, userEvent } = await mount();
    await userEvent(row("p1"), "click");
    const close = root.querySelector("[data-process-close]") as HTMLElement;
    expect(close.textContent?.trim()).toBe("Close process");
    await userEvent(close, "click");
    expect(shows()).toEqual({ process: null, status: true });
    expect(row("p1").getAttribute("aria-pressed")).toBe("false");
  });

  it("When the selected row is pressed again, Then the view's Status is back", async () => {
    const { shows, row, userEvent } = await mount();
    await userEvent(row("p1"), "click");
    await userEvent(row("p1"), "click");
    expect(shows()).toEqual({ process: null, status: true });
    expect(row("p1").getAttribute("aria-pressed")).toBe("false");
  });

  it("When another row is pressed, Then the selection moves to it", async () => {
    const { shows, row, userEvent } = await mount();
    await userEvent(row("p1"), "click");
    await userEvent(row("p2"), "click");
    expect(shows()).toEqual({ process: "p2", status: false });
    expect(row("p1").getAttribute("aria-pressed")).toBe("false");
    expect(row("p2").getAttribute("aria-pressed")).toBe("true");
  });

  it("Given a run selected, Then its detail carries what the run did, in the contract's own words", async () => {
    const { root, row, userEvent } = await mount();
    expect(root.querySelector("[data-run-activity]")).toBeFalsy();
    await userEvent(row("p1"), "click");
    const activity = root.querySelector("[data-run-activity]") as HTMLElement;
    expect(
      Array.from(activity.querySelectorAll("[data-run-event]")).map((line) => line.textContent),
    ).toEqual(["Started", "Using read_document", "Proposed one rewrite."]);
    // It stands in the process's own detail, beside its step and its error.
    expect(activity.closest("[data-process-id]")?.getAttribute("data-process-id")).toBe("p1");
  });
});

describe("a run guided by an instruction", () => {
  it("Given its detail, Then it names the instruction where the run's detail is read, and a run with none says nothing", async () => {
    const { root, row, userEvent } = await mount();
    await userEvent(row("p1"), "click");
    const line = root.querySelector("[data-process-instruction]") as HTMLElement | null;
    expect(line?.getAttribute("data-process-instruction")).toBe("prof-1");
    expect(line?.textContent?.replace(/\s+/gu, " ").trim()).toBe("Instruction: Blog post");
    expect(line?.querySelector("[data-process-instruction-open]")?.textContent).toBe("Blog post");
    await userEvent(row("p2"), "click");
    expect(root.querySelector("[data-process-instruction]")).toBeFalsy();
  });
});

describe("what a run was told at its start", () => {
  it("Given its detail, Then it lists each extension's keywords sent beside the instruction and names a tool that failed, and a run told nothing says nothing", async () => {
    const { root, row, userEvent } = await mount();
    await userEvent(row("p1"), "click");
    expect(root.querySelector('[data-process-context="keywords"]')?.textContent).toBe("Keywords: Quantum computing, Qubit");
    expect(root.querySelector('[data-process-context-failure="glossary"]')?.textContent).toBe("Glossary: nothing sent — glossary.prompt: no answer within 10s");
    await userEvent(row("p2"), "click");
    expect(root.querySelector("[data-process-context]")).toBeFalsy();
    expect(root.querySelector("[data-process-context-failure]")).toBeFalsy();
  });
});

describe("the replay's shortcut on a run's detail", () => {
  it("Given the shortcut refused on a run, Then its detail says why in words, another run's detail does not, and no detail names a replay control", async () => {
    const { root, row, userEvent } = await mount();
    await userEvent("[data-host-refuse]", "click");
    await userEvent(row("p1"), "click");
    expect(root.querySelector("[data-replay-refusal]")).toBeFalsy();
    await userEvent(row("p2"), "click");
    expect(root.querySelector("[data-replay-refusal]")?.textContent).toBe("This run can no longer be replayed: the instance holds no record of it.");
    expect(root.querySelector("[data-replay-refusal]")?.closest("[data-process-id]")?.getAttribute("data-process-id")).toBe("p2");
    // Hidden: nothing in the panel offers or names it.
    const panel = root.querySelector("[data-inspector-panel]") as HTMLElement;
    expect(Array.from(panel.querySelectorAll("button, [title], [aria-label]")).some((element) => /replay/iu.test(`${element.textContent} ${element.getAttribute("title") ?? ""} ${element.getAttribute("aria-label") ?? ""}`))).toBe(false);
  });
});
