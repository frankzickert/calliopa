import { afterEach, describe, expect, it, vi } from "vitest";

import { TOOLS, ToolRefusal, answerTool } from "./tools";

/**
 * What an agent may reach (`calliopa-bootstrap`'s `BO_0312_041`,
 * `BO_0312_042`): a quote that spends nothing, `generate` — the one spending
 * tool, admitted by the kernel once per Send — and `collect_generation`, which
 * collects a paid job without paying again. Every refusal of `generate` comes
 * before the paid request; the kernel's own gate is proven in
 * `calliopa-bootstrap`'s `agenttools`.
 */
const kernel = vi.hoisted(() => ({
  calls: [] as { path: string; body?: unknown; grant?: string }[],
  signedIn: true,
  generationsOk: true,
  fileType: "image/png",
  jobState: "completed",
}));
const doc = vi.hoisted(() => ({
  words: "a laurel on a hill",
  pictureAbove: true,
  composed: [] as unknown[],
  filled: [] as unknown[],
}));

vi.mock("~/server/kernel/client", () => ({
  // A tool's callback holds no session, so the kernel's state record refuses
  // it, as the prod gate does: what the owner set arrives with the call as
  // `settings` instead (BO_0276_007, BO_0312_063).
  kernelState: {
    read: async () => {
      throw new Error("sign in first");
    },
  },
  call: async (path: string, init?: RequestInit) => {
    // The grant in force when the call was made: the real client presents it.
    const { forwardedGrant } = await vi.importActual<typeof import("~/server/request-context")>("~/server/request-context");
    const grant = forwardedGrant();
    kernel.calls.push({ path, ...(typeof init?.body === "string" ? { body: JSON.parse(init.body) as unknown } : {}), ...(grant === undefined ? {} : { grant }) });
    if (path === "/__kernel/media/services") {
      return {
        ok: true,
        json: async () => ({
          services: [
            {
              service: "higgsfield",
              signedIn: kernel.signedIn,
              reason: kernel.signedIn ? null : "Sign in to Higgsfield in Settings.",
              models: [
                { model: "gpt_image_2", kind: "image", default: true },
                { model: "kling_video", kind: "video", default: true },
              ],
              openSet: {},
            },
          ],
        }),
      };
    }
    if (path === "/__kernel/media/generations") return { ok: kernel.generationsOk, json: async () => ({ id: "job-1" }) };
    if (path.endsWith("/file")) {
      return { ok: true, headers: new Headers({ "Content-Type": kernel.fileType }), arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    }
    if (path.startsWith("/__kernel/media/generations/")) {
      return { ok: true, json: async () => ({ state: kernel.jobState, service: "higgsfield", model: "kling_video" }) };
    }
    return { ok: true, json: async () => ({ status: "ok", cost: "$0.42" }) };
  },
}));

vi.mock("~/extensions/documents/server/documents", () => ({
  readDocument: async () => ({
    outcome: "success",
    result: {
      blocks: [
        ...(doc.pictureAbove ? [{ blockId: "pic-1", kind: "image", objectId: "a".repeat(64), mediaType: "image/png" }] : []),
        { blockId: "blk-1", kind: "text", runs: [{ text: doc.words }] },
      ],
    },
  }),
  composeMediaInsert: async (input: unknown) => {
    doc.composed.push(input);
    return { ok: true, blockId: "made-1", statement: "CREATE (b:image {id: $b_id})", parameters: {} as Record<string, unknown> };
  },
  composeMediaFill: async (input: unknown) => {
    doc.filled.push(input);
    return { ok: true, statement: "SET b.reference = $reference", parameters: {} };
  },
  fillMediaBlock: async () => ({ outcome: "success" }),
  insertBlock: async () => ({ outcome: "success" }),
}));

vi.mock("~/server/ccgw/blobs", () => ({
  readBlob: async () => new Uint8Array([9, 9]),
  putBlob: async () => ({ outcome: "success", result: { hash: `sha256:${"b".repeat(64)}`, size: 3 } }),
  blobHash: (id: string) => `sha256:${id}`,
  blobReference: (objectId: string, mediaType: string, size: number) => ({ _kind: "blob", hash: `sha256:${objectId}`, mediaType, size }),
}));
vi.mock("~/server/ccgw/branch-scope", () => ({ withBranch: (_branch: unknown, act: () => unknown) => act() }));
vi.mock("~/server/processes", () => ({ createProcess: async () => ({ id: "p" }), moveProcess: async () => undefined }));
vi.mock("~/server/session", () => ({ readSession: async () => null }));

const run = { id: "arun-1", group: "node:run-1", pin: 7, person: "frankzickert", document: "doc-1" };
const image = { ...run, profileType: "image", imageBackend: "higgsfield" };
const video = { ...run, profileType: "video", imageBackend: "higgsfield" };
const spent = () => kernel.calls.filter((one) => one.path === "/__kernel/media/generations");

afterEach(() => {
  kernel.calls = [];
  kernel.signedIn = true;
  kernel.generationsOk = true;
  kernel.fileType = "image/png";
  kernel.jobState = "completed";
  doc.words = "a laurel on a hill";
  doc.pictureAbove = true;
  doc.composed = [];
  doc.filled = [];
});

describe("what an agent may reach", () => {
  it("quotes without spending, and without a session", async () => {
    const answer = await TOOLS.quote_generation({ input: { service: "openart", model: "byte-plus-seedream-5-pro", prompt: "a laurel" }, run });
    expect(answer.result).toEqual({ status: "ok", cost: "$0.42" });
    expect(kernel.calls.map((one) => one.path)).toEqual(["/__kernel/media/services", "/__kernel/media/quote"]);
    expect(answer.stage).toBeUndefined();
  });

  it("refuses a quote without a service, a model or words", async () => {
    await expect(TOOLS.quote_generation({ input: { prompt: "x" }, run })).rejects.toBeInstanceOf(ToolRefusal);
    await expect(TOOLS.quote_generation({ input: { service: "openart", model: "m" }, run })).rejects.toBeInstanceOf(ToolRefusal);
  });

  // A tool's callback holds no person's session: every kernel call it makes
  // presents the grant the kernel handed it, or the prod gate reads it as
  // anonymous and every generator as signed out (BO_0312_063).
  it("answers a tool under the run's grant, so each kernel call presents it", async () => {
    const answer = await answerTool("quote_generation", {
      input: { service: "openart", model: "byte-plus-seedream-5-pro", prompt: "a laurel" },
      run: { ...run, grant: "grant-1" },
    });
    expect(answer.result).toEqual({ status: "ok", cost: "$0.42" });
    expect(kernel.calls.map((one) => one.grant)).toEqual(["grant-1", "grant-1"]);
  });

  it("offers the quote, the one spending tool and its collection", () => {
    expect(Object.keys(TOOLS)).toEqual(["quote_generation", "generate", "collect_generation"]);
  });
});

describe("generate", () => {
  it("makes an image under an image profile: the pending block composed before the one paid request, its job named", async () => {
    const answer = await TOOLS.generate({ input: { block: "blk-1" }, run: image });
    expect(answer.result).toMatchObject({ status: "running", kind: "image", job: "job-1", block: "made-1" });
    expect(doc.composed).toEqual([
      expect.objectContaining({ documentId: "doc-1", placement: { after: "blk-1" }, block: expect.objectContaining({ kind: "image", alt: "a laurel on a hill" }) }),
    ]);
    expect(spent()).toEqual([{ path: "/__kernel/media/generations", body: { service: "higgsfield", kind: "image", model: "gpt_image_2", prompt: "a laurel on a hill" } }]);
    expect(kernel.calls.at(-1)?.path).toBe("/__kernel/media/generations");
    expect(answer.stage?.[0]?.parameters["b_source"]).toMatchObject({ job: "job-1", service: "higgsfield", model: "gpt_image_2" });
  });

  it("makes a video under a video profile, animating the picture above", async () => {
    const answer = await TOOLS.generate({ input: { block: "blk-1", words: "the laurel sways" }, run: video });
    expect(answer.result).toMatchObject({ kind: "video", job: "job-1" });
    expect(doc.composed[0]).toMatchObject({ block: { kind: "video" } });
    expect(spent()[0]?.body).toMatchObject({
      kind: "video",
      model: "kling_video",
      prompt: "the laurel sways",
      references: [{ alias: "start", role: "start", mediaType: "image/png" }],
    });
  });

  it("refuses, before anything is spent, what it cannot make", async () => {
    const refusals: [string, () => Promise<unknown>, RegExp][] = [
      ["no generation profile", () => TOOLS.generate({ input: { block: "blk-1" }, run: { ...run, profileType: "instructions" } }), /image- or video-generation profile/u],
      // Codex is off for now (BO_0320_014), and never makes a video.
      ["a Codex image profile", () => TOOLS.generate({ input: { block: "blk-1" }, run: { ...image, imageBackend: "codex" } }), /temporarily unavailable/u],
      ["Codex for video", () => TOOLS.generate({ input: { block: "blk-1" }, run: { ...video, imageBackend: "codex" } }), /temporarily unavailable/u],
      ["a model not offered", () => TOOLS.generate({ input: { block: "blk-1", model: "kling_video" }, run: image }), /No offered image model/u],
      ["a wordless block", () => ((doc.words = ""), TOOLS.generate({ input: { block: "blk-1" }, run: image })), /no words/u],
      ["a video with no picture above", () => ((doc.words = "sway"), (doc.pictureAbove = false), TOOLS.generate({ input: { block: "blk-1" }, run: video })), /none above this block/u],
      ["no block of this Send", () => TOOLS.generate({ input: {}, run: image }), /prompt block from this Send/u],
    ];
    for (const [why, act, says] of refusals) {
      await expect(act(), why).rejects.toThrow(says);
    }
    kernel.signedIn = false;
    doc.words = "x";
    await expect(TOOLS.generate({ input: { block: "blk-1" }, run: image })).rejects.toThrow(/Sign in to Higgsfield/u);
    expect(spent()).toEqual([]);
    expect(doc.composed).toEqual([]);
  });

  it("follows what the owner offers, handed with the call rather than read from the state record", async () => {
    // Only the video model is offered, so an image profile has nothing to make with.
    await expect(
      TOOLS.generate({ input: { block: "blk-1" }, run: image, settings: { id: "media", models: ["higgsfield:kling_video"] } }),
    ).rejects.toThrow(/No offered image model/u);
    const answer = await TOOLS.generate({ input: { block: "blk-1" }, run: image, settings: { id: "media", models: ["higgsfield:gpt_image_2"] } });
    expect(answer.result).toMatchObject({ kind: "image", job: "job-1" });
  });

  it("says when the service refuses the job, after composing and without staging", async () => {
    kernel.generationsOk = false;
    await expect(TOOLS.generate({ input: { block: "blk-1" }, run: image })).rejects.toThrow(/refused the image job/u);
  });
});

describe("collect_generation", () => {
  it("fills a pending video from its finished job without paying again", async () => {
    kernel.fileType = "video/mp4";
    const answer = await TOOLS.collect_generation({ input: { block: "made-1", job: "job-1" }, run: video });
    expect(answer.result).toMatchObject({ status: "completed", job: "job-1", block: "made-1" });
    expect(doc.filled[0]).toMatchObject({ blockId: "made-1", jobId: "job-1", reference: { mediaType: "video/mp4" } });
    expect(spent()).toEqual([]);
  });

  it("answers a running job as running, and refuses a format it cannot keep", async () => {
    kernel.jobState = "running";
    expect((await TOOLS.collect_generation({ input: { block: "made-1", job: "job-1" }, run: image })).result).toEqual({ status: "running", job: "job-1" });
    kernel.jobState = "completed";
    kernel.fileType = "text/html";
    await expect(TOOLS.collect_generation({ input: { block: "made-1", job: "job-1" }, run: image })).rejects.toThrow(/unsupported format/u);
  });
});
