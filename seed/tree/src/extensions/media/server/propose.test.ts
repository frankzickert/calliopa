import { afterEach, describe, expect, it, vi } from "vitest";

import { proposeGeneration } from "./propose";

/**
 * A press proposes a picture that is not made yet. What matters and is easy to
 * get wrong: it is **staged**, never established — the insert runs inside a
 * branch scope of its own — it follows the block whose words are the prompt,
 * and it carries no reference, which is the pending state.
 */
const session = vi.hoisted(() => ({ value: null as unknown }));
const inserted = vi.hoisted(() => ({ calls: [] as { input: unknown; branch: string | undefined }[] }));

vi.mock("~/server/session", () => ({ readSession: async () => session.value }));
vi.mock("~/extensions/documents/server/documents", () => ({
  insertBlock: async (input: unknown) => {
    const { currentBranch } = await import("~/server/ccgw/branch-scope");
    inserted.calls.push({ input, branch: currentBranch() });
    return { outcome: "success", result: { blockId: "blk-new", revisionId: "r1", dataRevision: 7 } };
  },
}));

const person = { name: "frankzickert", class: "human", owner: true };
const whole = {
  documentId: "doc-1",
  afterBlockId: "blk-a",
  service: "higgsfield",
  model: "seedream_v5_pro",
  kind: "image",
  prompt: "  a laurel on a dark ground  ",
};

afterEach(() => {
  session.value = null;
  inserted.calls = [];
});

describe("proposing a generation", () => {
  it("stages a pending block into a group of its own, after the prompt", async () => {
    session.value = person;
    const proposed = await proposeGeneration(whole);
    expect(proposed.ok).toBe(true);
    expect(proposed.blockId).toBe("blk-new");
    expect(proposed.group).toMatch(/^node:media-/);

    const call = inserted.calls[0]!;
    // Staged, not established: the insert ran inside this generation's branch.
    expect(call.branch).toBe(proposed.group);
    const input = call.input as { block: Record<string, unknown>; placement: unknown };
    expect(input.placement).toEqual({ after: "blk-a" });
    expect(input.block["kind"]).toBe("image");
    // No reference: the picture is not made yet, and that is the whole state.
    expect(input.block["reference"]).toBeUndefined();
  });

  it("carries what is to make it, with the prompt trimmed", async () => {
    session.value = person;
    await proposeGeneration(whole);
    const input = inserted.calls[0]!.input as { block: { source: Record<string, unknown>; alt: string } };
    expect(input.block.source["service"]).toBe("higgsfield");
    expect(input.block.source["model"]).toBe("seedream_v5_pro");
    expect(input.block.source["prompt"]).toBe("a laurel on a dark ground");
    expect(input.block.alt).toBe("a laurel on a dark ground");
  });

  it("makes the kind the model declares, never a third value", async () => {
    session.value = person;
    await proposeGeneration({ ...whole, kind: "video" });
    await proposeGeneration({ ...whole, kind: "nonsense" });
    expect((inserted.calls[0]!.input as { block: { kind: string } }).block.kind).toBe("video");
    expect((inserted.calls[1]!.input as { block: { kind: string } }).block.kind).toBe("image");
  });

  it("gives each generation its own group", async () => {
    session.value = person;
    const first = await proposeGeneration(whole);
    const second = await proposeGeneration(whole);
    expect(first.group).not.toBe(second.group);
  });

  it("refuses without a signed-in person, and writes nothing", async () => {
    expect((await proposeGeneration(whole)).ok).toBe(false);
    session.value = { ...person, class: "agent" };
    expect((await proposeGeneration(whole)).ok).toBe(false);
    expect(inserted.calls).toHaveLength(0);
  });

  it("refuses with no model and with no words, and writes nothing", async () => {
    session.value = person;
    expect((await proposeGeneration({ ...whole, model: " " })).refusal).toBe("Choose a model first.");
    expect((await proposeGeneration({ ...whole, prompt: "  " })).refusal).toContain("no words");
    expect(inserted.calls).toHaveLength(0);
  });
});
