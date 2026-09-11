import { describe, expect, it } from "vitest";

import {
  withoutItems,
  destinationOf,
  faceOf,
  heldEdit,
  proposalNames,
  proposerName,
  proposerOf,
  stepPlacement,
  toneOf,
  type Placed,
} from "./proposals";

/**
 * Who proposed a change and what the reader sees of it; where a moved
 * proposal goes; and which input to a proposal's text accepts it.
 * BO_0233_003
 */

const claudeRun = { _type: "agent.run", agent: "claude-code", executedBy: "claude-code (claude-sonnet-5)" };

describe("who proposed a group", () => {
  it("Given a run's provenance node, Then the agent it names, whatever account staged it", () => {
    const proposer = proposerOf(claudeRun, ["agent:hermes"]);
    expect(proposer).toEqual({ kind: "agent", agent: "claude-code", executedBy: "claude-code (claude-sonnet-5)" });
    expect(proposerName(proposer)).toBe("Claude Code (claude-sonnet-5)");
    expect(toneOf(proposer)).toBe("claude");
    expect(faceOf(proposer)).toEqual({ kind: "image", src: "/agents/clauderic.webp" });
  });

  it("Given a person's staging into an agent's group, Then the agent still proposed it", () => {
    expect(proposerOf(claudeRun, ["agent:hermes", "frankzickert"])).toMatchObject({ agent: "claude-code" });
  });

  it("Given a group only people staged, Then the person, with a person's face and colour", () => {
    const proposer = proposerOf(undefined, ["frankzickert"]);
    expect(proposer).toEqual({ kind: "person", name: "frankzickert" });
    expect(toneOf(proposer)).toBe("person");
    expect(faceOf(proposer)).toEqual({ kind: "icon", icon: "user" });
  });

  it("Given an agent's stamp and no provenance node, Then an agent, never a guessed name", () => {
    const proposer = proposerOf(undefined, ["agent:hermes"]);
    expect(proposer).toEqual({ kind: "agent", agent: null, executedBy: "" });
    expect(proposerName(proposer)).toBe("an agent");
    expect(faceOf(proposer)).toEqual({ kind: "icon", icon: "robot" });
    expect(toneOf(proposer)).toBe("person");
  });

  it("Given a Claude run from before BO_0228 that was not observed delegating, Then what reasoned", () => {
    const proposer = proposerOf(
      { agent: "claude-code", executedBy: "provider (selected claude-code was not observed delegating)" },
      ["agent:hermes"],
    );
    expect(proposer).toMatchObject({ agent: "provider" });
    // The parenthesis is an explanation, not a model.
    expect(proposerName(proposer)).toBe("Hermes");
    expect(toneOf(proposer)).toBe("hermes");
  });

  it("Given each agent, Then its own face and colour", () => {
    expect(toneOf(proposerOf({ agent: "codex", executedBy: "codex" }, []))).toBe("codex");
    expect(faceOf(proposerOf({ agent: "codex", executedBy: "codex" }, []))).toEqual({ kind: "image", src: "/agents/codey.webp" });
    expect(faceOf(proposerOf({ agent: "hermes", executedBy: "hermes (gpt-5.5)" }, []))).toEqual({
      kind: "image",
      src: "/agents/ftrobot.webp",
    });
    expect(proposerName(proposerOf({ agent: "hermes", executedBy: "hermes (gpt-5.5)" }, []))).toBe("Hermes (gpt-5.5)");
  });

  it("Given a kind and a proposer, Then every name in words", () => {
    const names = proposalNames("replace", proposerOf(claudeRun, []), null);
    expect(names).toEqual({
      block: "Proposed rewrite by Claude Code (claude-sonnet-5)",
      face: "Proposed by Claude Code (claude-sonnet-5)",
      accept: "Accept Claude Code's rewrite",
      reject: "Reject Claude Code's rewrite",
      acceptAll: "Accept all of Claude Code's proposed changes",
    });
    expect(proposalNames("move", proposerOf(undefined, ["sam"]), "would move to the end").block).toBe(
      "Proposed move by sam, would move to the end",
    );
  });
});

const blocks: Placed[] = [
  { blockId: "a", order: "b", words: "Opening." },
  { blockId: "b", order: "d", words: "The storm arrives" },
  { blockId: "c", order: "f", words: "Closing." },
];

describe("where a proposal goes", () => {
  it("Given a key, Then where it would move in words, the block itself left out", () => {
    expect(destinationOf("c", blocks, "x")).toBe("would move before “The storm arrives”");
    expect(destinationOf("g", blocks, "x")).toBe("would move to the end");
    expect(destinationOf("e", blocks, "c")).toBe("would move to the end");
  });

  it("Given an arrow press, Then one place up or down, and nothing past either end", () => {
    // Between the first and second block.
    expect(stepPlacement("c", blocks, "x", -1)).toEqual({ before: "a" });
    expect(stepPlacement("c", blocks, "x", 1)).toEqual({ before: "c" });
    expect(stepPlacement("e", blocks, "x", 1)).toEqual({ at: "end" });
    expect(stepPlacement("a", blocks, "x", -1)).toBeNull();
    expect(stepPlacement("g", blocks, "x", 1)).toBeNull();
  });

  it("Given a proposal moving a block that stands, Then that block is not its own neighbour", () => {
    // Block b's proposal sits at its own key; up is before a, down before c.
    expect(stepPlacement("d", blocks, "b", -1)).toEqual({ before: "a" });
    expect(stepPlacement("d", blocks, "b", 1)).toEqual({ at: "end" });
  });
});

describe("which input accepts a proposal", () => {
  const runs = [{ text: "Tone: dry." }];

  it("Given typed text, Then it accepts and replays the text at the caret", () => {
    const held = heldEdit("insertText", "!", runs, 10, 10);
    expect(held).toEqual({ accept: true, replay: { runs: [{ text: "Tone: dry.!" }], at: 11 } });
  });

  it("Given a selection typed over, a paste and a deletion, Then each replayed", () => {
    expect(heldEdit("insertText", "wet", runs, 6, 9)).toMatchObject({ replay: { runs: [{ text: "Tone: wet." }], at: 9 } });
    expect(heldEdit("insertFromPaste", "very ", runs, 6, 6)).toMatchObject({ replay: { runs: [{ text: "Tone: very dry." }] } });
    expect(heldEdit("deleteContentBackward", null, runs, 10, 10)).toMatchObject({ replay: { runs: [{ text: "Tone: dry" }], at: 9 } });
    expect(heldEdit("deleteContentForward", null, runs, 0, 0)).toMatchObject({ replay: { runs: [{ text: "one: dry." }], at: 0 } });
  });

  it("Given an input that changes nothing, Then it accepts nothing", () => {
    expect(heldEdit("historyUndo", null, runs, 3, 3)).toEqual({ accept: false });
    expect(heldEdit("deleteContentBackward", null, runs, 0, 0)).toEqual({ accept: false });
    expect(heldEdit("deleteContentForward", null, runs, 10, 10)).toEqual({ accept: false });
    expect(heldEdit("insertText", "", runs, 4, 4)).toEqual({ accept: false });
  });

  it("Given a change the block itself carries out, Then it accepts and replays nothing", () => {
    expect(heldEdit("insertParagraph", null, runs, 4, 4)).toEqual({ accept: true, replay: null });
    expect(heldEdit("formatBold", null, runs, 0, 4)).toEqual({ accept: true, replay: null });
  });
});

describe("a proposals list narrowed by what was answered", () => {
  it("Given answered items, Then they leave, their emptied groups too, and the count follows", () => {
    const list = {
      documentId: "d",
      unanswered: 3,
      groups: [
        { groupId: "g1", items: [{ itemId: "a" }, { itemId: "b" }] },
        { groupId: "g2", items: [{ itemId: "c" }] },
      ],
    };
    expect(withoutItems(list, ["b", "c"])).toEqual({
      documentId: "d",
      unanswered: 1,
      groups: [{ groupId: "g1", items: [{ itemId: "a" }] }],
    });
    expect(withoutItems(list, [])).toBe(list);
  });
});

