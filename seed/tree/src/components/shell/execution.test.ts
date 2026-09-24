import { jsx } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import { executionProcess, type ExecutionProcess, type ExecutionRun } from "~/lib/execution";
import { ExecutionHost } from "./testing/execution-host";
import type { RunChip } from "./view-bridge";

/**
 * The panel's *Execution* section pressed through real JSX
 * (`execution-host.tsx`): every run of the document, newest first as read;
 * with a block selected, the runs from it and the runs touching it; the
 * reader's other processes under *Elsewhere*, and those alone on a tab with
 * no document; an entry's press showing or hiding its change as its chip's
 * does, the caret beside it opening the run's detail, its answers once ended,
 * and its cancel while it runs. BO_0267_010 CA_0058_005 CA_0058_008
 */
const run = (id: string, extra: Partial<ExecutionRun> = {}): ExecutionRun => ({
  id,
  goal: `Command ${id}\nsecond line`,
  status: "completed",
  agent: "claude-code",
  group: `node:run-${id}`,
  source: null,
  touched: [],
  references: [],
  startedAt: 1,
  ...extra,
});
const runs = [
  run("going", { status: "running", source: "blk-b", group: null }),
  run("ended", { source: "blk-b" }),
  run("touching", { touched: ["blk-b"] }),
  run("answered"),
];
const chip = (key: string, shown: boolean): RunChip => ({
  key,
  group: key,
  face: { kind: "icon", icon: "robot" },
  tone: "claude",
  name: "Claude Code",
  text: "2 rewrites",
  ended: true,
  shown,
});
const chips = [chip("node:run-ended", true), chip("node:run-touching", false)];

const process = (id: string, runId: string | null, extra: { state?: string; step?: string | null; trigger?: string } = {}): ExecutionProcess =>
  executionProcess({
    id,
    title: `Process ${id}`,
    state: extra.state ?? "running",
    step: extra.step ?? null,
    ...(runId === null ? {} : { runId }),
    ...(extra.trigger === undefined ? {} : { trigger: extra.trigger }),
  });

const mount = async (props: { processes?: ExecutionProcess[]; itemId?: string | null } = {}) => {
  const dom = await createDOM();
  await dom.render(jsx(ExecutionHost, { runs, chips, ...props }));
  const root = dom.screen as unknown as HTMLElement;
  const find = (selector: string) => (root.querySelector(selector) as HTMLElement | null) ?? null;
  const ids = (selector = "[data-execution-run]") =>
    Array.from(root.querySelectorAll(selector)).map((entry) => entry.getAttribute("data-execution-run"));
  const written = () =>
    JSON.parse(find("[data-written]")?.textContent ?? "null") as {
      toggle: { itemId: string | null; key: string | null; seq: number };
      answer: { itemId: string | null; group: string | null; answer: string | null; seq: number };
      cancelled: string[];
      selected: string | null;
    };
  return { ...dom, root, find, ids, written };
};

describe("the Execution section", () => {
  it("Given the document's runs, Then each is listed as read, by its face, its command's first line and its state", async () => {
    const { find, ids } = await mount();
    expect(find("[data-execution] h2")?.textContent).toContain("Execution");
    expect(ids()).toEqual(["going", "ended", "touching", "answered"]);
    expect(find('[data-execution-run="going"] [data-execution-line]')?.textContent).toBe("Command going");
    expect(find('[data-execution-run="going"]')?.getAttribute("data-execution-state")).toBe("running");
    // An open change says its chip's line beside the state.
    expect(find('[data-execution-run="ended"] [data-execution-state-words]')?.textContent).toBe("ended · 2 rewrites");
    expect(find('[data-execution-run="answered"] [data-execution-state-words]')?.textContent).toBe("ended");
    expect(find('[data-execution-run="going"] img')?.getAttribute("src")).toBe("/agents/clauderic.webp");
  });

  it("Given a block selected, Then the runs from it come first and the runs touching it after, and no block brings every run back", async () => {
    const { find, ids, userEvent } = await mount();
    await userEvent("[data-select-b]", "click");
    expect(find('[data-execution-group="from"]')?.textContent).toBe("From this block");
    expect(ids('[aria-label="Runs from this block"] [data-execution-run]')).toEqual(["going", "ended"]);
    expect(ids('[aria-label="Runs touching this block"] [data-execution-run]')).toEqual(["touching"]);
    await userEvent("[data-select-none]", "click");
    expect(ids()).toEqual(["going", "ended", "touching", "answered"]);
  });

  it("When an entry is pressed, Then it asks the view to show or hide its change as the chip does, and says which it is", async () => {
    const { find, written, userEvent } = await mount();
    const shown = find('[data-execution-toggle="ended"]');
    expect(shown?.getAttribute("aria-pressed")).toBe("true");
    expect(shown?.getAttribute("aria-label")).toBe("Hide the proposals of “Command ended”, ended");
    expect(find('[data-execution-toggle="touching"]')?.getAttribute("aria-pressed")).toBe("false");
    await userEvent('[data-execution-toggle="touching"]', "click");
    expect(written().toggle).toEqual({ itemId: "doc-1", key: "node:run-touching", seq: 1 });
    // A run with no change standing open has nothing to show.
    expect(find('[data-execution-toggle="answered"]')?.hasAttribute("disabled")).toBe(true);
  });

  it("Given a run ended with its change open, Then Reject all and Accept all answer it; a running run offers Cancel alone", async () => {
    const { find, written, userEvent } = await mount();
    expect(find('[data-execution-run="going"] [data-execution-accept-all]')).toBeNull();
    await userEvent('[data-execution-cancel="going"]', "click");
    expect(written().cancelled).toEqual(["going"]);
    await userEvent('[data-execution-accept-all="node:run-ended"]', "click");
    expect(written().answer).toEqual({ itemId: "doc-1", group: "node:run-ended", answer: "accepted", seq: 1 });
    await userEvent('[data-execution-reject-all="node:run-touching"]', "click");
    expect(written().answer).toEqual({ itemId: "doc-1", group: "node:run-touching", answer: "rejected", seq: 2 });
    expect(find('[data-execution-cancel="ended"]')).toBeNull();
  });

  it("Given the reader's other processes, Then they stand under Elsewhere, and a process reporting a listed run does not", async () => {
    const { find, root } = await mount({
      processes: [process("p-run", "ended"), process("p-other", "arun-elsewhere", { step: "publishing" }), process("p-system", null, { trigger: "system" })],
    });
    expect(find('[data-execution-group="elsewhere"]')?.textContent).toBe("Elsewhere");
    expect(
      Array.from(root.querySelectorAll("[data-execution-process]")).map((entry) => entry.getAttribute("data-execution-process")),
    ).toEqual(["p-other", "p-system"]);
    expect(find('[data-execution-process="p-other"] [data-execution-line]')?.textContent).toBe("Process p-other");
    expect(find('[data-execution-process="p-other"] [data-execution-state-words]')?.textContent).toBe("running · publishing");
    // A run an extension started says so at a glance, as the console said it.
    expect(find('[data-execution-process="p-system"] [data-process-system]')).not.toBeNull();
  });

  it("Given a tab with no document, Then the section lists the reader's processes alone, unnamed by a group", async () => {
    const { find, ids, root } = await mount({ itemId: null, processes: [process("p-other", "arun-elsewhere")] });
    expect(ids()).toEqual([]);
    expect(find('[data-execution-group="elsewhere"]')).toBeNull();
    expect(root.querySelectorAll("[data-execution-process]").length).toBe(1);
  });

  it("Given a tab with nothing run, Then the section says so in its own words", async () => {
    const dom = await createDOM();
    await dom.render(jsx(ExecutionHost, { runs: [], chips: [], itemId: null }));
    const root = dom.screen as unknown as HTMLElement;
    expect(root.querySelector("[data-execution-empty]")?.textContent).toBe("Nothing has run yet");
  });

  it("When the caret beside a run is pressed, Then that run's process is selected, and pressing it again lets it go", async () => {
    const { find, written, userEvent } = await mount({ processes: [process("p-run", "ended")] });
    const caret = find('[data-execution-detail="ended"]');
    expect(caret?.getAttribute("aria-label")).toBe("Details of “Command ended”");
    expect(caret?.getAttribute("aria-pressed")).toBe("false");
    await userEvent('[data-execution-detail="ended"]', "click");
    expect(written().selected).toBe("p-run");
    expect(find('[data-execution-detail="ended"]')?.getAttribute("aria-pressed")).toBe("true");
    await userEvent('[data-execution-detail="ended"]', "click");
    expect(written().selected).toBeNull();
    // Showing and hiding the proposals stays the entry's own press.
    expect(written().toggle.seq).toBe(0);
    // A run no process of the reader's reports has no detail to open.
    expect(find('[data-execution-detail="touching"]')?.hasAttribute("disabled")).toBe(true);
  });

  it("When a process under Elsewhere is pressed, Then it is selected as the console's row was", async () => {
    const { find, written, userEvent } = await mount({ processes: [process("p-other", "arun-elsewhere")] });
    expect(find('[data-process-id="p-other"]')?.getAttribute("aria-pressed")).toBe("false");
    await userEvent('[data-process-id="p-other"]', "click");
    expect(written().selected).toBe("p-other");
    expect(find('[data-process-id="p-other"]')?.getAttribute("aria-pressed")).toBe("true");
  });
});
