import { $, component$, jsx, useContext, useContextProvider, useStore } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import {
  type ViewActivity,
  type ViewReplay,
  NO_REPLAY,
  type ViewAnswerAll,
  type ViewToggleRun, ViewBridgeContext, type ViewBridge, type ViewBar,
  type ViewFocus, type ViewAgents, type ViewComposeBlock, type ViewInspector, type ViewProposed, type ViewReveal, type ViewPointing, type ViewAcross, type ViewCommandOptions, afterSend } from "./view-bridge";

/**
 * A contributed view reads the workspace it is mounted in off the bridge:
 * what it names when it creates a process through the shell's registry.
 * The bridge here is built the way the shell and the editor harness build
 * theirs, with the workspace the host holds. CA_0050_001
 */
const Reader = component$(() => {
  const bridge = useContext(ViewBridgeContext);
  return jsx("p", { "data-workspace-id": bridge.workspaceId, children: bridge.workspaceId });
});

const Host = component$<{ workspaceId: string }>(({ workspaceId }) => {
  const noop = $(() => undefined);
  const bridge: ViewBridge = {
    workspaceId,
    drag: useStore({ overId: null, drop: null }),
    inspector: useStore<ViewInspector>({ text: null, facts: [], actions: [] }),
    bar: useStore<ViewBar>({ groups: [] }),
    decorationBar: useStore<ViewBar>({ groups: [] }),
    save: useStore<{ state: null }>({ state: null }),
    proposed: useStore<ViewProposed>({ itemId: null, seq: 0 }),
    reveal: useStore<ViewReveal>({ itemId: null, target: null, seq: 0 }),
    pointing: useStore<ViewPointing>({ documentId: null, prompt: null, marks: "", documents: [], seq: 0 }),
    across: useStore<ViewAcross>({ document: null, title: "", seq: 0 }),
    focus: useStore<ViewFocus>({ itemId: null, blockId: null, seq: 0 }),
    activity: useStore<ViewActivity>({ runs: [], seq: 0 }),
    replay: useStore<ViewReplay>({ ...NO_REPLAY }),
    answerAll: useStore<ViewAnswerAll>({ itemId: null, group: null, answer: null, seq: 0 }),
    toggleRun: useStore<ViewToggleRun>({ itemId: null, key: null, seq: 0 }),
    setRunChips$: noop,
    startDrag$: noop,
    setSelection$: noop,
    setPointing$: noop,
    setBranch$: noop,
    setMode$: noop,
    setTitle$: noop,
    setSaveState$: noop,
    targetGone$: noop,
    raiseMessage$: noop,
    openTarget$: noop,
    targetChanged$: noop,
    agentsChanged$: noop,
    composeCommand$: noop,
    composeBlock: useStore<ViewComposeBlock>({ itemId: null, text: "", seq: 0 }),
    agents: useStore<ViewAgents>({ runtimes: [], agent: null, speed: "fast", sending: false }),
    chooseAgent$: noop,
    commandOptions: useStore<ViewCommandOptions>({ byCommand: {} }),
    setCommandOption$: noop,
    chooseSpeed$: noop,
    refreshAgents$: $(async () => null),
    sendCommand$: $(async () => ({ ok: false as const, error: "not in this test" })),
    sendPinch$: $(async () => ({ ok: false as const, error: "not in this test" })),
    sendGesture$: $(async () => ({ ok: false as const, error: "not in this test" })),
    sendInstructed$: $(async () => ({ ok: false as const, error: "not in this test" })),
    openAlongRoute$: noop,
    blockControls$: $(async () => []),
    pressBlockControl$: $(async () => null),
    faces$: $(async () => ({})),
    focusedChild$: $(async () => ({ refusal: "no focused work here" })),
    emptied: useStore({ byParent: {} }),
    focusedWorkEmptied$: $(async () => undefined),
    takeEmptied$: $(() => null),
    bringBack$: $(async () => ({ refusal: "no focused work here" })),
    adoptChild$: $(async () => ({ refusal: "no focused work here" })),
  };
  useContextProvider(ViewBridgeContext, bridge);
  return jsx(Reader, {});
});

describe("the workspace on the view bridge", () => {
  it("Given a view mounted in a workspace, Then it reads the workspace's id off the bridge", async () => {
    const dom = await createDOM();
    await dom.render(jsx(Host, { workspaceId: "ws-4f2" }));
    const root = dom.screen as unknown as HTMLElement;
    expect(root.querySelector("[data-workspace-id]")?.getAttribute("data-workspace-id")).toBe("ws-4f2");
  });
});

describe("options set for one send", () => {
  it("clears them from the sent command once it is sent and keeps the rest", () => {
    const options: ViewCommandOptions = {
      byCommand: { "doc-1/blk-a": { instruction: "prof-9", variation: "var-1" }, "doc-1/blk-b": { variation: "var-2" } },
      onceByCommand: { "doc-1/blk-a": ["variation"], "doc-1/blk-b": ["variation"] },
    };
    const sent = afterSend(options, "doc-1", "blk-a");
    expect(sent.byCommand["doc-1/blk-a"]).toEqual({ instruction: "prof-9" });
    expect(sent.byCommand["doc-1/blk-b"]).toEqual({ variation: "var-2" });
    expect(sent.onceByCommand).toEqual({ "doc-1/blk-b": ["variation"] });
  });

  it("leaves a command with nothing set for one send as it was", () => {
    const options: ViewCommandOptions = { byCommand: { "doc-1/blk-a": { instruction: "prof-9" } } };
    expect(afterSend(options, "doc-1", "blk-a")).toBe(options);
  });
});
