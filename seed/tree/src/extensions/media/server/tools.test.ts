import { afterEach, describe, expect, it, vi } from "vitest";

import { currentBranch } from "~/server/ccgw/branch-scope";

import { TOOLS, ToolRefusal, answerTool } from "./tools";
import { FORMAT_STRUCTURE, INPUT_STRUCTURE, INSTRUCTION_STRUCTURE, VARIATION_STRUCTURE } from "~/extensions/structures/lib/structures";

/**
 * What an agent may reach (`calliopa-bootstrap`'s `BO_0312_041`,
 * `BO_0312_042`): a quote that spends nothing, `generate` — the one spending
 * tool, admitted by the kernel once per Send — and `collect_generation`, which
 * collects a paid job without paying again. Every refusal of `generate` comes
 * before the paid request; the kernel's own gate is proven in
 * `calliopa-bootstrap`'s `agenttools`. What is made, and with what, is the
 * format the run's instruction names, with the variation chosen beside Send put
 * over it (`BO_0336_022`, `BO_0336_025`).
 */
const kernel = vi.hoisted(() => ({
  calls: [] as { path: string; body?: unknown; grant?: string }[],
  signedIn: true,
  generationsOk: true,
  fileType: "image/png",
  jobState: "completed",
}));
/** The roles each document carries at the pin, as `structures` reads them. */
const graph = vi.hoisted(() => ({
  pins: [] as unknown[],
  roles: {} as Record<string, { structures: { id: string; values: Record<string, unknown> }[]; blocks?: { blockId: string; structures: { id: string; values: Record<string, unknown> }[] }[]; titles?: Record<string, string> }>,
}));
const doc = vi.hoisted(() => ({
  words: "a laurel on a hill",
  pictureAbove: true,
  /** Other documents' blocks, by document id: a format's words, a picture a
   * reference points into. The Send's document reads as the default. */
  documents: {} as Record<string, unknown[]>,
  /** Blocks of the Send's document below the prompt: pictures and videos a
   * command marks with #. */
  below: [] as unknown[],
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
            { service: "codex", signedIn: true, reason: null, models: [{ model: "codex-image", kind: "image", default: true }], openSet: {} },
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
    if (path === "/__kernel/media/generations")
      return kernel.generationsOk
        ? { ok: true, json: async () => ({ id: "job-1" }) }
        : { ok: false, json: async () => ({ error: "gpt_image_2 takes aspect_ratio 1:1, 3:2, 2:3" }) };
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
  readDocument: async (documentId: string) => ({
    outcome: "success",
    result: {
      blocks: doc.documents[documentId] ?? [
        ...(doc.pictureAbove ? [{ blockId: "pic-1", kind: "image", objectId: "a".repeat(64), mediaType: "image/png" }] : []),
        { blockId: "blk-1", kind: "text", runs: [{ text: doc.words }] },
        ...doc.below,
      ],
    },
  }),
  // The branch in force is recorded: the kernel stages what is composed into
  // the run's group, which refuses a CREATE composed against truth.
  composeMediaInsert: async (input: object) => {
    doc.composed.push({ ...input, branch: currentBranch() });
    return { ok: true, blockId: "made-1", statement: "CREATE (b:image {id: $b_id})", parameters: {} as Record<string, unknown> };
  },
  composeMediaFill: async (input: object) => {
    doc.filled.push({ ...input, branch: currentBranch() });
    return { ok: true, statement: "SET b.reference = $reference", parameters: {} };
  },
  fillMediaBlock: async () => ({ outcome: "success" }),
  insertBlock: async () => ({ outcome: "success" }),
}));

vi.mock("~/extensions/structures/server/structures", () => ({
  structuresOf: async (documentId: string, scope: { dataRevision?: number } = {}) => {
    graph.pins.push(scope.dataRevision);
    const held = graph.roles[documentId];
    if (held === undefined) return { outcome: "noResult" };
    return {
      outcome: "success",
      result: {
        documentId,
        dataRevision: 7,
        structures: held.structures,
        takeable: [],
        blocks: (held.blocks ?? []).map((block) => ({ ...block, kind: "text", parentId: null, takeable: [] })),
        inherited: [],
        referenceTitles: held.titles ?? {},
      },
    };
  },
}));

vi.mock("~/server/ccgw/blobs", () => ({
  readBlob: async () => new Uint8Array([9, 9]),
  putBlob: async () => ({ outcome: "success", result: { hash: `sha256:${"b".repeat(64)}`, size: 3 } }),
  blobHash: (id: string) => `sha256:${id}`,
  blobReference: (objectId: string, mediaType: string, size: number) => ({ _kind: "blob", hash: `sha256:${objectId}`, mediaType, size }),
}));
vi.mock("~/server/processes", () => ({ createProcess: async () => ({ id: "p" }), moveProcess: async () => undefined }));
vi.mock("~/server/session", () => ({ readSession: async () => null }));

const run = { id: "arun-1", group: "node:run-1", pin: 7, person: "frankzickert", document: "doc-1" };
const image = { ...run, instruction: "prof-img" };
const video = { ...run, instruction: "prof-vid" };
const spent = () => kernel.calls.filter((one) => one.path === "/__kernel/media/generations");

/** An instruction naming *Instagram square* (image, Higgsfield, gpt_image_2, 1:1,
 * 1k) with the variation *Story 9:16*, and one naming *Trailer* (video). */
const seed = (square: Record<string, unknown> = {}) => {
  graph.roles = {
    "prof-img": { structures: [{ id: INSTRUCTION_STRUCTURE, values: { format: "fmt-sq" } }], titles: { "fmt-sq": "Instagram square" } },
    "prof-vid": { structures: [{ id: INSTRUCTION_STRUCTURE, values: { format: "fmt-vid" } }], titles: { "fmt-vid": "Trailer" } },
    "prof-none": { structures: [{ id: INSTRUCTION_STRUCTURE, values: {} }] },
    "fmt-sq": {
      structures: [{ id: FORMAT_STRUCTURE, values: { type: "image", provider: "higgsfield", model: "gpt_image_2", ratio: "1:1", quality: "1k", ...square } }],
      blocks: [{ blockId: "var-story", structures: [{ id: VARIATION_STRUCTURE, values: { ratio: "9:16", model: "" } }] }, { blockId: "blk-plain", structures: [] }],
    },
    "fmt-vid": { structures: [{ id: FORMAT_STRUCTURE, values: { type: "video", provider: "higgsfield", model: "kling_video" } }] },
  };
};
seed();

afterEach(() => {
  seed();
  graph.pins = [];
  kernel.calls = [];
  kernel.signedIn = true;
  kernel.generationsOk = true;
  kernel.fileType = "image/png";
  kernel.jobState = "completed";
  doc.words = "a laurel on a hill";
  doc.pictureAbove = true;
  doc.documents = {};
  doc.below = [];
  doc.composed = [];
  doc.filled = [];
});

describe("what an agent may reach", () => {
  it("quotes what the instruction's format would make, without spending and without a session", async () => {
    const answer = await TOOLS.quote_generation({ input: { prompt: "a laurel", service: "openart", model: "byte-plus-seedream-5-pro" }, run: image });
    expect(answer.result).toEqual({ format: "Instagram square", service: "higgsfield", model: "gpt_image_2", status: "ok", cost: "$0.42" });
    expect(kernel.calls.at(-1)).toMatchObject({
      path: "/__kernel/media/quote",
      body: { service: "higgsfield", kind: "image", model: "gpt_image_2", prompt: "a laurel", options: { "aspect-ratio": "1:1", resolution: "1k" } },
    });
    expect(answer.stage).toBeUndefined();
  });

  it("refuses a quote without a format or words", async () => {
    await expect(TOOLS.quote_generation({ input: { prompt: "x" }, run })).rejects.toBeInstanceOf(ToolRefusal);
    await expect(TOOLS.quote_generation({ input: {}, run: image })).rejects.toBeInstanceOf(ToolRefusal);
  });

  // A tool's callback holds no person's session: every kernel call it makes
  // presents the grant the kernel handed it, or the prod gate reads it as
  // anonymous and every generator as signed out (BO_0312_063).
  it("answers a tool under the run's grant, so each kernel call presents it", async () => {
    const answer = await answerTool("quote_generation", {
      input: { prompt: "a laurel" },
      run: { ...image, grant: "grant-1" },
    });
    expect(answer.result).toMatchObject({ status: "ok", cost: "$0.42" });
    expect(kernel.calls.map((one) => one.grant)).toEqual(["grant-1", "grant-1", "grant-1"]);
  });

  it("offers the quote, the one spending tool and its collection", () => {
    expect(Object.keys(TOOLS)).toEqual(["read_format", "quote_generation", "generate", "collect_generation"]);
  });
});

describe("generate", () => {
  it("makes an image with the instruction's format: the pending block composed before the one paid request, read at the run's pin", async () => {
    const answer = await TOOLS.generate({ input: { block: "blk-1" }, run: image });
    expect(answer.result).toMatchObject({ status: "running", kind: "image", job: "job-1", block: "made-1", format: "Instagram square", model: "gpt_image_2" });
    expect(doc.composed).toEqual([
      expect.objectContaining({ documentId: "doc-1", placement: { after: "blk-1" }, block: expect.objectContaining({ kind: "image", alt: "a laurel on a hill" }) }),
    ]);
    // Composed in the run's group, where the kernel stages it: against truth
    // the CREATE names itself established and the group refuses it after the
    // job is paid for (the walk at pin 3796).
    expect(doc.composed[0]).toMatchObject({ branch: "node:run-1" });
    expect(spent()).toEqual([
      {
        path: "/__kernel/media/generations",
        body: { service: "higgsfield", kind: "image", model: "gpt_image_2", prompt: "a laurel on a hill", options: { "aspect-ratio": "1:1", resolution: "1k" } },
      },
    ]);
    expect(kernel.calls.at(-1)?.path).toBe("/__kernel/media/generations");
    expect(answer.stage?.[0]?.parameters["b_source"]).toMatchObject({ job: "job-1", service: "higgsfield", model: "gpt_image_2", format: "fmt-sq" });
    expect(graph.pins).toEqual([7, 7]);
  });

  it("puts the variation chosen beside Send over the format, an empty value its format's", async () => {
    await TOOLS.generate({ input: { block: "blk-1" }, run: { ...image, variation: "var-story" } });
    expect(spent()[0]?.body).toMatchObject({ model: "gpt_image_2", options: { "aspect-ratio": "9:16", resolution: "1k" } });
  });

  it("takes no model and no option from the run's own arguments", async () => {
    await TOOLS.generate({ input: { block: "blk-1", model: "kling_video", options: { "aspect-ratio": "16:9" } }, run: image });
    expect(spent()[0]?.body).toMatchObject({ kind: "image", model: "gpt_image_2", options: { "aspect-ratio": "1:1" } });
  });

  it("sends a value outside every suggestion as typed, and says the vendor's refusal in its own words", async () => {
    seed({ model: "nano_banana_9" });
    kernel.generationsOk = false;
    await expect(TOOLS.generate({ input: { block: "blk-1" }, run: image })).rejects.toThrow("gpt_image_2 takes aspect_ratio 1:1, 3:2, 2:3");
    expect(spent()[0]?.body).toMatchObject({ model: "nano_banana_9" });
  });

  it("makes a video with a video format, animating the picture above as @start", async () => {
    const answer = await TOOLS.generate({ input: { block: "blk-1", words: "@start the laurel sways" }, run: video });
    expect(answer.result).toMatchObject({ kind: "video", job: "job-1" });
    expect(doc.composed[0]).toMatchObject({ block: { kind: "video" } });
    expect(spent()[0]?.body).toMatchObject({
      kind: "video",
      model: "kling_video",
      prompt: "@start the laurel sways",
      references: [{ alias: "start", role: "start", mediaType: "image/png" }],
    });
  });

  it("refuses, before anything is composed or spent, what it cannot make", async () => {
    const refusals: [string, () => Promise<unknown>, RegExp][] = [
      ["no instruction", () => TOOLS.generate({ input: { block: "blk-1" }, run }), /Choose an instruction/u],
      ["an instruction naming no format", () => TOOLS.generate({ input: { block: "blk-1" }, run: { ...run, instruction: "prof-none" } }), /choose a format on the instruction/u],
      ["a format of another type", () => (seed({ type: "PDF" }), TOOLS.generate({ input: { block: "blk-1" }, run: image })), /makes PDF, not a picture or a video/u],
      ["no provider", () => (seed({ provider: "" }), TOOLS.generate({ input: { block: "blk-1" }, run: image })), /names no provider/u],
      // Codex makes nothing yet (BO_0320_014).
      ["Codex", () => (seed({ provider: "codex" }), TOOLS.generate({ input: { block: "blk-1" }, run: image })), /temporarily unavailable/u],
      ["a provider that is none", () => (seed({ provider: "midjourney" }), TOOLS.generate({ input: { block: "blk-1" }, run: image })), /no generation service here/u],
      ["no model", () => (seed({ model: "" }), TOOLS.generate({ input: { block: "blk-1" }, run: image })), /names no model/u],
      ["a variation not the format's", () => (seed(), TOOLS.generate({ input: { block: "blk-1" }, run: { ...image, variation: "blk-plain" } })), /not one of Instagram square's/u],
      ["a wordless block", () => ((doc.words = ""), TOOLS.generate({ input: { block: "blk-1" }, run: image })), /no words/u],
      ["a video with no picture above", () => ((doc.words = "sway"), (doc.pictureAbove = false), TOOLS.generate({ input: { block: "blk-1" }, run: video })), /none above this block/u],
      ["no block of this Send", () => TOOLS.generate({ input: {}, run: image }), /prompt block from this Send/u],
    ];
    for (const [why, act, says] of refusals) {
      await expect(act(), why).rejects.toThrow(says);
    }
    seed();
    kernel.signedIn = false;
    doc.words = "x";
    await expect(TOOLS.generate({ input: { block: "blk-1" }, run: image })).rejects.toThrow(/Sign in to Higgsfield/u);
    expect(spent()).toEqual([]);
    expect(doc.composed).toEqual([]);
  });
});

describe("collect_generation", () => {
  it("fills a pending video from its finished job without paying again", async () => {
    kernel.fileType = "video/mp4";
    const answer = await TOOLS.collect_generation({ input: { block: "made-1", job: "job-1" }, run: video });
    expect(answer.result).toMatchObject({ status: "completed", job: "job-1", block: "made-1" });
    expect(doc.filled[0]).toMatchObject({ blockId: "made-1", jobId: "job-1", reference: { mediaType: "video/mp4" }, branch: "node:run-1" });
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

/**
 * A format says what it takes (`ME_0002_010`–`ME_0002_012`): its inputs are
 * blocks of it using *Input*, the run reads them and the format's words with
 * `read_format`, and `generate` attaches what the call names under each
 * input's name and kind, refusing before anything is composed or spent what
 * the format does not take.
 */
describe("a format's inputs", () => {
  const clip = { ...run, instruction: "prof-clip" };
  const inputBlock = (blockId: string, values: Record<string, unknown>) => ({ blockId, structures: [{ id: INPUT_STRUCTURE, values }] });
  /** *Product clip*: a video format whose words say how it is used, with an
   * opening shot (start frame, required) and a closing shot (end frame). */
  const clipFormat = (opening: Record<string, unknown> = {}) => {
    graph.roles["prof-clip"] = { structures: [{ id: INSTRUCTION_STRUCTURE, values: { format: "fmt-clip" } }], titles: { "fmt-clip": "Product clip" } };
    graph.roles["fmt-clip"] = {
      structures: [{ id: FORMAT_STRUCTURE, values: { type: "video", provider: "higgsfield", model: "kling_video" } }],
      blocks: [
        { blockId: "how", structures: [] },
        inputBlock("in-open", { kind: "Start frame", name: "start", required: true, ...opening }),
        inputBlock("in-close", { kind: "End frame", name: "end" }),
        { blockId: "var-slow", structures: [{ id: VARIATION_STRUCTURE, values: {} }] },
      ],
    };
    doc.documents["fmt-clip"] = [
      { blockId: "how", kind: "text", runs: [{ text: "A slow product reveal, ten seconds." }] },
      { blockId: "in-open", kind: "text", runs: [{ text: "The product shot the clip opens on" }] },
      { blockId: "in-close", kind: "text", runs: [{ text: "Where it ends" }] },
      { blockId: "var-slow", kind: "text", runs: [{ text: "Slower" }] },
    ];
    doc.below = [
      { blockId: "pic-2", kind: "image", objectId: "c".repeat(64), mediaType: "image/jpeg" },
      { blockId: "vid-1", kind: "video", objectId: "d".repeat(64), mediaType: "video/mp4" },
      { blockId: "pic-pending", kind: "image" },
    ];
  };

  it("Given a format with inputs, When the run reads it, Then it is told the format's words and each input's name, kind and purpose, with nothing spent", async () => {
    clipFormat();
    const answer = await TOOLS.read_format({ input: {}, run: clip });
    expect(answer.result).toEqual({
      format: "Product clip",
      type: "video",
      provider: "higgsfield",
      model: "kling_video",
      words: "A slow product reveal, ten seconds.",
      inputs: [
        { name: "start", kind: "a start frame", required: true, for: "The product shot the clip opens on" },
        { name: "end", kind: "an end frame", required: false, for: "Where it ends" },
      ],
    });
    // A video format declaring none takes the picture above as @start.
    const plain = await TOOLS.read_format({ input: {}, run: video });
    expect((plain.result as { inputs: unknown[] }).inputs).toEqual([
      { name: "start", kind: "a start frame", required: true, for: "The picture above the block, the clip's first frame.", taken: "the picture above the block, unless the call names another" },
    ]);
    expect(spent()).toEqual([]);
  });

  it("Given a command pointing at two pictures, Then the video is made from the first to the second, each under its name and kind", async () => {
    clipFormat();
    await TOOLS.generate({ input: { block: "blk-1", words: "from @start to @end, slowly", inputs: { start: "pic-1", end: "pic-2" } }, run: clip });
    expect(spent()[0]?.body).toMatchObject({
      prompt: "from @start to @end, slowly",
      references: [
        { alias: "start", role: "start", mediaType: "image/png" },
        { alias: "end", role: "end", mediaType: "image/jpeg" },
      ],
    });
  });

  it("Given a reference into another document, Then the picture is read there", async () => {
    clipFormat();
    doc.documents["doc-2"] = [{ blockId: "far", kind: "image", objectId: "e".repeat(64), mediaType: "image/webp" }];
    await TOOLS.generate({ input: { block: "blk-1", words: "@start opens", inputs: { start: "doc-2/far" } }, run: clip });
    expect(spent()[0]?.body).toMatchObject({ references: [{ alias: "start", role: "start", mediaType: "image/webp" }] });
  });

  it("Given a reference video input, Then a made video is attached as a video", async () => {
    clipFormat({ kind: "Reference video", name: "motion" });
    await TOOLS.generate({ input: { block: "blk-1", words: "move like @motion", inputs: { motion: "vid-1" } }, run: clip });
    expect(spent()[0]?.body).toMatchObject({ references: [{ alias: "motion", role: "video", mediaType: "video/mp4" }] });
  });

  it("Given an image format, Then a quote carries what the call names, and nothing when it names nothing", async () => {
    clipFormat();
    await TOOLS.quote_generation({ input: { prompt: "from @start", inputs: { start: "pic-1" } }, run: clip });
    expect(kernel.calls.at(-1)).toMatchObject({ path: "/__kernel/media/quote", body: { references: [{ alias: "start", role: "start" }] } });
    await TOOLS.quote_generation({ input: { prompt: "a laurel" }, run: image });
    expect(kernel.calls.at(-1)?.body).not.toHaveProperty("references");
  });

  it("refuses, before anything is composed or spent, what the format does not take", async () => {
    const refusals: [string, () => void, Record<string, unknown>, RegExp][] = [
      ["an input the format does not declare", () => clipFormat(), { words: "@start @mood", inputs: { start: "pic-1", mood: "pic-2" } }, /takes no input mood; it takes start, end/u],
      ["an input on a format declaring none", () => seed(), { words: "@start", inputs: { start: "pic-1" } }, /Instagram square takes no inputs/u],
      ["a required input not given", () => clipFormat(), { words: "a slow pan" }, /needs a start frame, start, and the command points at none/u],
      ["a given input the words do not name", () => clipFormat(), { words: "a slow pan", inputs: { start: "pic-1" } }, /do not name @start/u],
      ["a picture's kind given a video", () => clipFormat(), { words: "@start", inputs: { start: "vid-1" } }, /takes a picture, and the block given for it is not one/u],
      ["a video's kind given a picture", () => clipFormat({ kind: "Reference video", name: "motion" }), { words: "@motion", inputs: { motion: "pic-1" } }, /takes a video/u],
      ["a picture not made yet", () => clipFormat(), { words: "@start", inputs: { start: "pic-pending" } }, /is not made yet/u],
      ["audio, which no block holds", () => clipFormat({ kind: "Reference audio", name: "voice" }), { words: "@voice", inputs: { voice: "pic-1" } }, /no block holds audio/u],
      ["an input with no kind", () => clipFormat({ kind: "" }), { words: "@start" }, /An input of Product clip names no kind/u],
      ["two inputs of one name", () => clipFormat({ name: "end" }), { words: "@end" }, /names two inputs end/u],
      ["the picture above not named", () => seed(), { words: "the laurel sways" }, /do not name @start/u],
    ];
    for (const [why, arrange, input, says] of refusals) {
      arrange();
      const instruction = why === "an input on a format declaring none" ? image : why === "the picture above not named" ? video : clip;
      await expect(TOOLS.generate({ input: { block: "blk-1", ...input }, run: instruction }), why).rejects.toThrow(says);
    }
    expect(spent()).toEqual([]);
    expect(doc.composed).toEqual([]);
  });
});

