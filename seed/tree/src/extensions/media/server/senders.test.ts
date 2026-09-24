import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { iconFor, shortName } from "../lib/models";
import { axesOffered, mediaSenders, quoteToModel, senderParts, sendToModel, staleAxis } from "./senders";

/**
 * A model stands in the agent menu and a block is sent to it the way a block is
 * sent to an agent: **Send is the whole gesture, and it is the press that
 * spends** (`BO_0273_035`, user decision 2026-09-22). What it costs is reported
 * after, on the process and on the picture's own panel.
 */
const roster = vi.hoisted(() => ({ value: [] as unknown[] }));
const made = vi.hoisted(() => ({ calls: [] as unknown[], answer: { ok: true, processId: "p1" } as unknown }));

const prompt = vi.hoisted(() => ({ value: "a laurel" }));
const quoted = vi.hoisted(() => ({
  calls: [] as { path: string; body: unknown }[],
  ok: true,
  answer: { status: "ok", request: { cost_quote: { credits: 11 } } } as unknown,
}));

const record = vi.hoisted(() => ({ value: { id: "media", models: [], named: [], names: {}, icons: {} } as Record<string, unknown> }));

vi.mock("./offered", () => ({
  offeredRoster: async () => roster.value,
  readOffered: async () => record.value,
  offeredKey: (service: string, model: string) => `${service}:${model}`,
  captureAxes: async () => record.value,
}));
vi.mock("./make", () => ({
  makeGeneration: async (input: unknown) => {
    made.calls.push(input);
    return made.answer;
  },
  promptOf: async () => prompt.value,
}));
vi.mock("~/server/kernel/client", () => ({
  call: async (path: string, init: { body?: string }) => {
    quoted.calls.push({ path, body: init.body === undefined ? null : JSON.parse(init.body) });
    return { ok: quoted.ok, json: async () => quoted.answer };
  },
}));

const higgsfield = {
  service: "higgsfield",
  signedIn: true,
  reason: null,
  models: [
    { model: "seedream_v5_pro", kind: "image", default: false },
    { model: "seedance_2_5", kind: "video", default: false },
  ],
  openSet: { image: false, video: true },
};

const request = {
  workspaceId: "ws-1",
  sender: "media:higgsfield:seedream_v5_pro",
  documentId: "doc-1",
  blockId: "blk-a",
};

afterEach(() => {
  roster.value = [];
  record.value = { id: "media", models: [], named: [], names: {}, icons: {} };
  made.calls = [];
  made.answer = { ok: true, processId: "p1" };
});

describe("the models in the agent menu", () => {
  it("offers one sender per model, with a short name and its own icon", async () => {
    roster.value = [higgsfield];
    const offered = await mediaSenders();
    expect(offered.map((one) => one.id)).toEqual([
      "media:higgsfield:seedream_v5_pro",
      "media:higgsfield:seedance_2_5",
    ]);
    expect(offered[0]?.label).toBe("Seedream");
    // A model has no face, so it wears an icon: a picture or a moving picture.
    expect(offered[0]?.icon).toBe("image");
    expect(offered[1]?.icon).toBe("film-strip");
  });

  it("keeps a signed-out service listed, with the login to run", async () => {
    roster.value = [{ ...higgsfield, signedIn: false, reason: "run `higgsfield auth login`" }];
    const offered = await mediaSenders();
    expect(offered[0]?.selectable).toBe(false);
    expect(offered[0]?.reason).toBe("run `higgsfield auth login`");
  });

  it("gives a model nobody named its own id back", () => {
    expect(shortName("seedream_v5_pro")).toBe("Seedream");
    expect(shortName("some_job_type_you_typed")).toBe("some_job_type_you_typed");
    expect(iconFor("video")).toBe("film-strip");
  });

  it("reads a sender id apart, and refuses one that is not ours", () => {
    expect(senderParts("media:openart:byte-plus-seedream-5-pro")).toEqual({
      service: "openart",
      model: "byte-plus-seedream-5-pro",
    });
    expect(senderParts("codex")).toBeNull();
    expect(senderParts("media:")).toBeNull();
    expect(senderParts("media:higgsfield:")).toBeNull();
  });

  it("sends the block to the model, and that is the press that spends", async () => {
    roster.value = [higgsfield];
    const sent = await sendToModel(request);
    expect(sent.ok).toBe(true);
    expect(sent.processId).toBe("p1");
    expect(made.calls[0]).toMatchObject({
      documentId: "doc-1",
      blockId: "blk-a",
      service: "higgsfield",
      model: "seedream_v5_pro",
      kind: "image",
    });
  });

  it("refuses a command that names no block, since a picture is made from words", async () => {
    roster.value = [higgsfield];
    const sent = await sendToModel({ ...request, blockId: "" });
    expect(sent.ok).toBe(false);
    expect(sent.error).toContain("names none");
    expect(made.calls).toHaveLength(0);
  });

  it("refuses a model no longer offered, and a service signed out", async () => {
    roster.value = [{ ...higgsfield, models: [] }];
    expect((await sendToModel(request)).error).toContain("not offered any more");
    roster.value = [{ ...higgsfield, signedIn: false, reason: "run `higgsfield auth login`" }];
    expect((await sendToModel(request)).error).toBe("run `higgsfield auth login`");
    expect(made.calls).toHaveLength(0);
  });

  it("takes the name and the icon the owner gave a model", async () => {
    // The owner's naming is the only way a job type they typed themselves can
    // be called anything but its raw id. BO_0273_037
    roster.value = [higgsfield];
    record.value = {
      id: "media",
      models: [],
      named: [],
      names: { "higgsfield:seedream_v5_pro": "Plates" },
      icons: { "higgsfield:seedream_v5_pro": "sparkle" },
    };
    const offered = await mediaSenders();
    expect(offered[0]?.label).toBe("Plates");
    expect(offered[0]?.icon).toBe("sparkle");
    // Untouched models keep the extension's own.
    expect(offered[1]?.label).toBe("Seedance");
    expect(offered[1]?.icon).toBe("film-strip");
  });

  it("ignores an icon the shell's table does not hold", async () => {
    roster.value = [higgsfield];
    record.value = {
      id: "media", models: [], named: [],
      names: {}, icons: { "higgsfield:seedream_v5_pro": "not-an-icon" },
    };
    // The contract refuses an unknown icon by name, so a bad one falls back
    // rather than taking the whole roster down.
    expect((await mediaSenders())[0]?.icon).toBe("image");
  });
});

describe("what a model lets a person choose", () => {
  it("offers the ratio and the quality, and nothing else it captured", async () => {
    // A model reports more — background, variant, genre — and they are kept
    // and sent when chosen, but a menu is not a form. BO_0279_007
    const offered = axesOffered([
      { axis: "aspect-ratio", values: ["1:1", "16:9"], default: "1:1" },
      { axis: "resolution", values: ["1k", "2k"], default: "2k" },
      { axis: "background", values: ["auto", "transparent"], default: null },
    ]);
    expect(offered.map((one) => one.axis)).toEqual(["aspect-ratio", "resolution"]);
  });

  it("calls the resolution Quality, which is what a reader means by it", () => {
    const offered = axesOffered([{ axis: "resolution", values: ["1k", "2k"], default: "2k" }]);
    expect(offered[0]?.label).toBe("Quality");
    expect(offered[0]?.start).toBe("2k");
  });

  it("offers nothing for a model whose axes nobody could read", () => {
    // Still offered, and a press takes the vendor's own defaults. BO_0279_014
    expect(axesOffered(undefined)).toEqual([]);
    expect(axesOffered([{ axis: "aspect-ratio", values: [], default: null }])).toEqual([]);
  });
});

describe("a refusal that shows what was captured is stale", () => {
  const sent = [
    { axis: "aspect-ratio", label: "Ratio", values: ["1:1"], start: "1:1" },
    { axis: "resolution", label: "Quality", values: ["2k"], start: "2k" },
  ];

  it("reads an axis named in the vendor's own spelling", () => {
    // The adapters refuse in the vendor's vocabulary, which is not hyphenated.
    expect(staleAxis("gpt_image_2 takes aspect_ratio ['1:1', '16:9']", sent)).toBe(true);
    expect(staleAxis("gpt_image_2 takes resolution ['1k', '2k', '4k']", sent)).toBe(true);
  });

  it("reads the service's own spelling too", () => {
    expect(staleAxis("this model takes aspect-ratio [...]", sent)).toBe(true);
  });

  it("leaves a refusal about anything else alone", () => {
    // A workspace, a plan, a prompt: none of them says the captured set is wrong.
    expect(staleAxis("No workspace selected.", sent)).toBe(false);
    expect(staleAxis("the prompt is empty", sent)).toBe(false);
    expect(staleAxis("gpt_image_2 has no quality parameter", sent)).toBe(false);
  });

  it("says nothing is stale when nothing was chosen", () => {
    expect(staleAxis("takes aspect_ratio [...]", [])).toBe(false);
  });
});

describe("what a send would cost, before the press", () => {
  /**
   * The adapters' own dry run, which spends nothing and makes nothing
   * (`BO_0279_013`). Asked as the reader turns a control, so `4k` reads as
   * what it costs rather than as what `1k` costs.
   */
  beforeEach(() => {
    quoted.calls = [];
    quoted.ok = true;
    quoted.answer = { status: "ok", request: { cost_quote: { credits: 11 } } };
    prompt.value = "a laurel";
    roster.value = [higgsfield];
    record.value = {
      id: "media",
      models: [],
      named: [],
      names: {},
      icons: {},
      axes: {
        "higgsfield:seedream_v5_pro": [
          { axis: "aspect-ratio", values: ["1:1", "16:9"], default: "1:1" },
        ],
      },
    };
  });

  it("quotes the model and the axes chosen, and never the press", async () => {
    const answer = await quoteToModel({
      workspaceId: "ws-1",
      sender: "media:higgsfield:seedream_v5_pro",
      documentId: "doc-1",
      blockId: "blk-a",
      options: { "aspect-ratio": "16:9" },
    });
    expect(answer).toEqual({ ok: true, cost: "11 credits" });
    // The quote route and nothing that bills.
    expect(quoted.calls.map((one) => one.path)).toEqual(["/__kernel/media/quote"]);
    const sent = quoted.calls[0]?.body as { options?: unknown; prompt?: string };
    expect(sent.options).toEqual({ "aspect-ratio": "16:9" });
    expect(sent.prompt).toBe("a laurel");
  });

  it("drops a value the model does not offer rather than sending it", async () => {
    const answer = await quoteToModel({
      workspaceId: "ws-1",
      sender: "media:higgsfield:seedream_v5_pro",
      documentId: "doc-1",
      blockId: "blk-a",
      options: { "aspect-ratio": "21:9" },
    });
    expect(answer.ok).toBe(true);
    expect((quoted.calls[0]?.body as { options?: unknown }).options).toBeUndefined();
  });

  it("says nothing rather than a guess when the quote does not answer", async () => {
    quoted.answer = { status: "invalid", error: { message: "no" } };
    const answer = await quoteToModel({
      workspaceId: "ws-1",
      sender: "media:higgsfield:seedream_v5_pro",
      documentId: "doc-1",
      blockId: "blk-a",
    });
    expect(answer).toEqual({ ok: false });
  });

  it("says nothing for a block with no words, and asks nobody", async () => {
    prompt.value = "";
    const answer = await quoteToModel({
      workspaceId: "ws-1",
      sender: "media:higgsfield:seedream_v5_pro",
      documentId: "doc-1",
      blockId: "blk-a",
    });
    expect(answer).toEqual({ ok: false });
    expect(quoted.calls).toHaveLength(0);
  });
});
