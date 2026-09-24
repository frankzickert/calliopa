import { afterEach, describe, expect, it, vi } from "vitest";

import { follow, makeGeneration } from "./make";

/**
 * The only path in Calliopa that spends money. What is proven here is the order
 * that makes a failure survivable: nothing is proposed or asked for without a
 * person, a model and words; the job id is on the process before anything can
 * go wrong after it; and a picture that was rejected while it was being made is
 * never forced back into the document.
 */
const session = vi.hoisted(() => ({ value: null as unknown }));
const kernel = vi.hoisted(() => ({
  calls: [] as { path: string; body: unknown }[],
  answers: {} as Record<string, unknown>,
}));
const processes = vi.hoisted(() => ({ made: [] as unknown[], moves: [] as unknown[] }));
const graph = vi.hoisted(() => ({
  proposed: [] as unknown[],
  filled: [] as { input: unknown; branch: string | undefined }[],
  blocks: [] as {
    blockId: string;
    kind: string;
    revisionId: string;
    runs?: unknown;
    objectId?: string;
    mediaType?: string;
  }[],
  stored: { outcome: "success", result: { hash: "sha256:" + "a".repeat(64), size: 9 } } as unknown,
  pictureBytes: new TextEncoder().encode("the picture"),
}));

vi.mock("~/server/session", () => ({ readSession: async () => session.value }));
vi.mock("~/server/processes", () => ({
  createProcess: async (_w: string, input: unknown) => {
    processes.made.push(input);
    return { id: "proc-1" };
  },
  moveProcess: async (id: string, change: unknown) => {
    processes.moves.push({ id, ...(change as object) });
    return null;
  },
}));
vi.mock("~/server/ccgw/blobs", async () => {
  const real = await vi.importActual<typeof import("~/server/ccgw/blobs")>("~/server/ccgw/blobs");
  return {
    ...real,
    putBlob: async () => graph.stored,
    readBlob: async () => graph.pictureBytes,
  };
});
vi.mock("~/extensions/documents/server/documents", async () => {
  const { currentBranch } = await import("~/server/ccgw/branch-scope");
  return {
    readDocument: async () => ({ outcome: "success", result: { blocks: graph.blocks } }),
    fillMediaBlock: async (input: unknown) => {
      graph.filled.push({ input, branch: currentBranch() });
      return { outcome: "success", result: { blockId: "blk-pending" } };
    },
    insertBlock: async () => ({ outcome: "success", result: { blockId: "blk-pending", revisionId: "r0" } }),
  };
});
vi.mock("~/server/kernel/client", () => ({
  call: async (path: string, init: { body?: string }) => {
    kernel.calls.push({ path, body: init.body === undefined ? null : JSON.parse(init.body) });
    const answer = kernel.answers[path.split("?")[0]!] as
      | { ok?: boolean; json?: unknown; bytes?: string; type?: string; refusal?: unknown }
      | undefined;
    const ok = answer?.ok !== false;
    return {
      ok,
      json: async () => (ok ? (answer?.json ?? {}) : (answer?.refusal ?? {})),
      arrayBuffer: async () => new TextEncoder().encode(answer?.bytes ?? "bytes").buffer,
      headers: { get: () => answer?.type ?? "image/png" },
    };
  },
}));

const person = { name: "frankzickert", class: "human", owner: true };
const whole = {
  workspaceId: "ws-1",
  documentId: "doc-1",
  blockId: "blk-a",
  service: "higgsfield",
  model: "seedream_v5_pro",
  kind: "image",
};

afterEach(() => {
  session.value = null;
  kernel.calls = [];
  kernel.answers = {};
  processes.made = [];
  processes.moves = [];
  graph.proposed = [];
  graph.filled = [];
  graph.blocks = [];
});

const withPrompt = () => {
  graph.blocks = [
    { blockId: "blk-a", kind: "text", revisionId: "r-a", runs: [{ text: "a laurel" }] },
    { blockId: "blk-pending", kind: "image", revisionId: "r-p" },
  ];
};

describe("making a moving picture", () => {
  /**
   * Neither generator makes a clip from words alone: both refuse with *at least one image,
   * video, or audio reference is required*. So a video send animates the picture above the
   * block, and a send with none is refused before a press can spend. User decision
   * 2026-09-22, `BO_0273_045`.
   */
  const clip = { ...whole, kind: "video", model: "seedance_2_5" };

  it("refuses a send with nothing above it to animate, and spends nothing", async () => {
    session.value = person;
    withPrompt();

    const making = await makeGeneration(clip);
    expect(making.ok).toBe(false);
    expect(making.refusal).toMatch(/made from a picture/);
    // Before everything: no block proposed, no process opened, nothing asked of the generator.
    expect(graph.proposed).toHaveLength(0);
    expect(processes.made).toHaveLength(0);
    expect(kernel.calls).toHaveLength(0);
  });

  it("animates the nearest picture above, as the clip's first frame", async () => {
    session.value = person;
    graph.blocks = [
      { blockId: "blk-old", kind: "image", revisionId: "r-o", objectId: "b".repeat(64) },
      { blockId: "blk-near", kind: "image", revisionId: "r-n", objectId: "c".repeat(64), mediaType: "image/webp" },
      { blockId: "blk-a", kind: "text", revisionId: "r-a", runs: [{ text: "it turns to the camera" }] },
      { blockId: "blk-pending", kind: "video", revisionId: "r-p" },
    ];
    kernel.answers["/__kernel/media/generations"] = { json: { id: "job-9" } };

    expect((await makeGeneration(clip)).ok).toBe(true);
    const started = kernel.calls.find((one) => one.path === "/__kernel/media/generations");
    const sent = (started?.body as { references?: { alias: string; role: string; mediaType: string; bytes: string }[] });
    expect(sent.references).toHaveLength(1);
    // The nearest, not the first: the one the reader just made is the one they mean.
    expect(sent.references?.[0]?.mediaType).toBe("image/webp");
    expect(sent.references?.[0]?.role).toBe("start");
    expect(Buffer.from(sent.references?.[0]?.bytes ?? "", "base64").toString()).toBe("the picture");
  });

  it("does not animate a picture that has not been made yet", async () => {
    session.value = person;
    graph.blocks = [
      // Proposed and still empty: there are no bytes to open on.
      { blockId: "blk-empty", kind: "image", revisionId: "r-e" },
      { blockId: "blk-a", kind: "text", revisionId: "r-a", runs: [{ text: "it turns" }] },
    ];
    const making = await makeGeneration(clip);
    expect(making.ok).toBe(false);
    expect(making.refusal).toMatch(/made from a picture/);
  });

  it("sends no references for a picture, which is made from words alone", async () => {
    session.value = person;
    withPrompt();
    kernel.answers["/__kernel/media/generations"] = { json: { id: "job-7" } };
    await makeGeneration(whole);
    const started = kernel.calls.find((one) => one.path === "/__kernel/media/generations");
    expect((started?.body as { references?: unknown }).references).toBeUndefined();
  });
});

describe("making a picture", () => {
  it("proposes, opens a process, and puts the job id on it before following", async () => {
    session.value = person;
    withPrompt();
    kernel.answers["/__kernel/media/generations"] = { json: { id: "job-7" } };

    const making = await makeGeneration(whole);
    expect(making.ok).toBe(true);
    expect(making.processId).toBe("proc-1");
    expect(making.blockId).toBe("blk-pending");

    // The prompt is the block's own words, never the caller's.
    const started = kernel.calls.find((one) => one.path === "/__kernel/media/generations");
    expect((started?.body as { prompt: string }).prompt).toBe("a laurel");

    // The job id is the only thing that collects a paid job without paying
    // again, so it must be recorded before anything after it can fail.
    const running = processes.moves.find((move) => (move as { state: string }).state === "running");
    expect((running as { step: string }).step).toBe("job job-7");
  });

  it("refuses without a person, without a model and without words, asking for nothing", async () => {
    withPrompt();
    expect((await makeGeneration(whole)).ok).toBe(false);
    session.value = person;
    expect((await makeGeneration({ ...whole, model: " " })).refusal).toBe("Choose a model first.");
    graph.blocks = [{ blockId: "blk-a", kind: "text", revisionId: "r-a", runs: [{ text: "   " }] }];
    expect((await makeGeneration(whole)).refusal).toContain("no words");
    expect(kernel.calls.filter((one) => one.path === "/__kernel/media/generations")).toHaveLength(0);
    expect(processes.made).toHaveLength(0);
  });

  it("fails the process in words when the generator will not take the job", async () => {
    session.value = person;
    withPrompt();
    kernel.answers["/__kernel/media/generations"] = { ok: false };

    const making = await makeGeneration(whole);
    // The proposal still stands: there is something to look at and to reject.
    expect(making.blockId).toBe("blk-pending");
    const failed = processes.moves.find((move) => (move as { state: string }).state === "failed");
    expect((failed as { error: string }).error).toContain("did not take the job");
  });

  it("says why the generator would not take it, in the generator's own words", async () => {
    // The refusal used to be thrown away and reported as "the generator did
    // not take the job", which hid a body the service had explained.
    // BO_0273_040
    session.value = person;
    withPrompt();
    kernel.answers["/__kernel/media/generations"] = {
      ok: false,
      refusal: { error: "no service 'nowhere' to sign in to" },
    };

    await makeGeneration(whole);
    const failed = processes.moves.find((move) => (move as { state: string }).state === "failed");
    expect((failed as { error: string }).error).toBe("no service 'nowhere' to sign in to");
  });

  it("falls back to its own words when the generator explains nothing", async () => {
    session.value = person;
    withPrompt();
    kernel.answers["/__kernel/media/generations"] = { ok: false, refusal: {} };

    await makeGeneration(whole);
    const failed = processes.moves.find((move) => (move as { state: string }).state === "failed");
    expect((failed as { error: string }).error).toContain("did not take the job");
  });

  it("stores what was made and fills the block already standing", async () => {
    withPrompt();
    kernel.answers["/__kernel/media/generations/job-7"] = { json: { state: "completed" } };
    kernel.answers["/__kernel/media/generations/job-7/file"] = { bytes: "png", type: "image/png" };

    await follow(
      { processId: "proc-1", jobId: "job-7", group: "node:media-1", documentId: "doc-1", blockId: "blk-pending" },
      { patienceMs: 2000, betweenMs: 5 },
    );

    const filled = graph.filled[0]!;
    // Staged into the generation's own group, onto the pending block's own
    // revision: the reader answers the proposal already in front of them.
    expect(filled.branch).toBe("node:media-1");
    const input = filled.input as { blockId: string; baseRevisionId: string; reference: { mediaType: string } };
    expect(input.blockId).toBe("blk-pending");
    expect(input.baseRevisionId).toBe("r-p");
    expect(input.reference.mediaType).toBe("image/png");
    expect(processes.moves.at(-1)).toMatchObject({ state: "completed" });
  });

  it("forces nothing back when the picture was rejected while it was being made", async () => {
    graph.blocks = [{ blockId: "blk-a", kind: "text", revisionId: "r-a", runs: [{ text: "a laurel" }] }];
    kernel.answers["/__kernel/media/generations/job-7"] = { json: { state: "completed" } };
    kernel.answers["/__kernel/media/generations/job-7/file"] = { bytes: "png" };

    await follow(
      { processId: "proc-1", jobId: "job-7", group: "node:media-1", documentId: "doc-1", blockId: "blk-pending" },
      { patienceMs: 2000, betweenMs: 5 },
    );

    expect(graph.filled).toHaveLength(0);
    expect(processes.moves.at(-1)).toMatchObject({ state: "completed" });
  });

  it("says what the generator said, and keeps the job id, when it does not finish", async () => {
    // The first two real sends failed with a message the job record held and
    // the process did not show. BO_0273_041
    kernel.answers["/__kernel/media/generations/job-7"] = {
      json: { state: "invalid", result: { error: { message: "--output must be versioned" } } },
    };

    await follow(
      { processId: "proc-1", jobId: "job-7", group: "node:media-1", documentId: "doc-1", blockId: "blk-pending" },
      { patienceMs: 2000, betweenMs: 5 },
    );

    const failed = processes.moves.at(-1) as { state: string; error: string };
    expect(failed.state).toBe("failed");
    expect(failed.error).toContain("--output must be versioned");
    expect(failed.error).toContain("job-7");
  });

  it("falls back to its own words when the generator explains nothing", async () => {
    kernel.answers["/__kernel/media/generations/job-7"] = { json: { state: "failed" } };

    await follow(
      { processId: "proc-1", jobId: "job-7", group: "node:media-1", documentId: "doc-1", blockId: "blk-pending" },
      { patienceMs: 2000, betweenMs: 5 },
    );

    const failed = processes.moves.at(-1) as { state: string; error: string };
    expect(failed.state).toBe("failed");
    expect(failed.error).toContain("job-7");
  });
});
