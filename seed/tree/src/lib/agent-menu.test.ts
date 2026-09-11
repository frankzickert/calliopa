import { describe, expect, it } from "vitest";

import {
  AGENT_FACES,
  faceOf,
  menuKey,
  openingAgent,
  pick,
  type MenuState,
} from "./agent-menu";
import type { SelectableRuntime } from "./connections";

/**
 * The agent dropdown's decisions: where it opens, and what each key does.
 * BO_0228_011
 */
const agents: readonly SelectableRuntime[] = [
  { id: "codex", label: "Codex", selectable: true, reason: null },
  {
    id: "claude-code",
    label: "Claude Code",
    selectable: false,
    reason: "Claude Code is not signed in.",
  },
  { id: "hermes", label: "Hermes · gpt-5.5", selectable: true, reason: null },
];
const allRun = agents.map((agent) => ({
  ...agent,
  selectable: true,
  reason: null,
}));
const closed: MenuState = { open: false, active: 0 };
const openOn = (active: number): MenuState => ({ open: true, active });

describe("where the dropdown opens", () => {
  it("Given a choice that can run, Then it opens there and says nothing", () => {
    expect(openingAgent(agents, "hermes", "codex")).toEqual({
      agent: "hermes",
      notice: null,
    });
  });

  it("Given nothing chosen, Then it opens on what the gateway runs", () => {
    expect(openingAgent(agents, null, "hermes")).toEqual({
      agent: "hermes",
      notice: null,
    });
  });

  it("Given nothing chosen and the gateway on an agent that cannot run, Then it opens on the first that can", () => {
    expect(openingAgent(agents, null, "claude-code")).toEqual({
      agent: "codex",
      notice: null,
    });
  });

  it("Given a choice that cannot run, Then it opens on the running agent and says why, in words", () => {
    expect(openingAgent(agents, "claude-code", "codex")).toEqual({
      agent: "codex",
      notice: "Claude Code is not signed in — opened on Codex.",
    });
  });

  it("Given a choice nothing can stand in for, Then it stays and says no agent can run", () => {
    const none = agents.map((agent) => ({
      ...agent,
      selectable: false,
      reason: `${agent.label} is not signed in.`,
    }));
    expect(openingAgent(none, "hermes", "codex")).toEqual({
      agent: "hermes",
      notice: "Hermes · gpt-5.5 is not signed in — no agent can run a command.",
    });
  });

  it("Given a choice naming an agent no longer listed, Then it is read as nothing chosen", () => {
    expect(openingAgent(agents, "provider", "codex")).toEqual({
      agent: "codex",
      notice: null,
    });
  });

  it("Given no agents at all, Then it opens on none", () => {
    expect(openingAgent([], "codex", "codex")).toEqual({
      agent: null,
      notice: null,
    });
  });
});

describe("the dropdown's keys", () => {
  it("Given it closed, Then the arrows, Enter and Space open it on the chosen agent, Home and End at the ends", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Enter", " "]) {
      expect(menuKey(allRun, "hermes", closed, key)).toEqual({
        state: openOn(2),
        choose: null,
      });
    }
    expect(menuKey(allRun, "hermes", closed, "Home")?.state).toEqual(openOn(0));
    expect(menuKey(allRun, "codex", closed, "End")?.state).toEqual(openOn(2));
  });

  it("Given it open, Then the arrows move without wrapping", () => {
    expect(menuKey(allRun, "codex", openOn(0), "ArrowDown")?.state).toEqual(
      openOn(1),
    );
    expect(menuKey(allRun, "codex", openOn(2), "ArrowDown")?.state).toEqual(
      openOn(2),
    );
    expect(menuKey(allRun, "codex", openOn(0), "ArrowUp")?.state).toEqual(
      openOn(0),
    );
  });

  it("Given it open, Then Enter and Space choose an agent that can run and close", () => {
    expect(menuKey(agents, "codex", openOn(2), "Enter")).toEqual({
      state: { open: false, active: 2 },
      choose: "hermes",
    });
    expect(menuKey(agents, "codex", openOn(2), " ")?.choose).toBe("hermes");
  });

  it("Given it open on an agent that cannot run, Then choosing it changes nothing and the list stays open", () => {
    expect(menuKey(agents, "codex", openOn(1), "Enter")).toEqual({
      state: openOn(1),
      choose: null,
    });
    expect(pick(agents, 1)).toEqual({ state: openOn(1), choose: null });
  });

  it("Given it open, Then Escape and Tab close with the choice unchanged", () => {
    for (const key of ["Escape", "Tab"]) {
      expect(menuKey(agents, "codex", openOn(2), key)).toEqual({
        state: { open: false, active: 2 },
        choose: null,
      });
    }
  });

  it("Given a letter, Then it moves to the next agent it begins, and opens a closed list there", () => {
    expect(menuKey(allRun, "codex", openOn(0), "h")?.state).toEqual(openOn(2));
    expect(menuKey(allRun, "codex", openOn(0), "C")?.state).toEqual(openOn(1));
    expect(menuKey(allRun, "codex", closed, "h")?.state).toEqual(openOn(2));
    // A letter naming the chosen agent opens on it rather than past it.
    expect(menuKey(allRun, "claude-code", closed, "c")?.state).toEqual(
      openOn(1),
    );
  });

  it("Given a key that is not the dropdown's, Then it is left alone", () => {
    expect(menuKey(agents, "codex", closed, "Escape")).toBeNull();
    expect(menuKey(agents, "codex", openOn(0), "Shift")).toBeNull();
    expect(menuKey([], null, closed, "ArrowDown")).toBeNull();
  });

  it("Given a press on an option, Then an agent that can run is chosen and the list closes", () => {
    expect(pick(agents, 0)).toEqual({
      state: { open: false, active: 0 },
      choose: "codex",
    });
  });
});

describe("each agent's face", () => {
  it("Given an agent, Then its character's face, and Hermes's for anything unknown", () => {
    expect(faceOf("codex")).toBe("/agents/codey.webp");
    expect(faceOf("claude-code")).toBe("/agents/clauderic.webp");
    expect(faceOf("hermes")).toBe("/agents/ftrobot.webp");
    expect(faceOf(null)).toBe(AGENT_FACES.hermes);
    expect(faceOf("toString")).toBe(AGENT_FACES.hermes);
  });
});
