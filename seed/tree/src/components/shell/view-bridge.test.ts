import { $, component$, jsx, useContext, useContextProvider, useStore } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import {
  type ViewActivity,
  type ViewAnswerAll,
  type ViewToggleRun, ViewBridgeContext, type ViewBridge, type ViewBar,
  type ViewFocus, type ViewAgents, type ViewComposeBlock, type ViewInspector, type ViewProposed, type ViewReveal } from "./view-bridge";

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
    focus: useStore<ViewFocus>({ itemId: null, blockId: null, seq: 0 }),
    activity: useStore<ViewActivity>({ runs: [], seq: 0 }),
    answerAll: useStore<ViewAnswerAll>({ itemId: null, group: null, answer: null, seq: 0 }),
    toggleRun: useStore<ViewToggleRun>({ itemId: null, key: null, seq: 0 }),
    setRunChips$: noop,
    startDrag$: noop,
    setSelection$: noop,
    setPointing$: noop,
    setBranch$: noop,
    setTitle$: noop,
    setSaveState$: noop,
    targetGone$: noop,
    raiseMessage$: noop,
    openTarget$: noop,
    targetChanged$: noop,
    agentsChanged$: noop,
    composeCommand$: noop,
    composeBlock: useStore<ViewComposeBlock>({ itemId: null, text: "", seq: 0 }),
    agents: useStore<ViewAgents>({ runtimes: [], agent: null, options: {}, cost: "", speed: "fast", sending: false }),
    chooseAgent$: noop,
    chooseOption$: noop,
    quoteSend$: $(async () => undefined),
    chooseSpeed$: noop,
    refreshAgents$: $(async () => null),
    sendCommand$: $(async () => ({ ok: false as const, error: "not in this test" })),
    sendGesture$: $(async () => ({ ok: false as const, error: "not in this test" })),
    retarget$: noop,
    blockControls$: $(async () => []),
    pressBlockControl$: $(async () => null),
    faces$: $(async () => ({})),
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
