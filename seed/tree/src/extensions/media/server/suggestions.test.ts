import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * What a format's fields suggest (`calliopa-bootstrap`'s `BO_0336_020`): the
 * services signed in, the chosen service's models for the format's type, and
 * the chosen model's ratios and qualities as the vendor describes them, each
 * description kept so a vendor down for a minute does not empty the list.
 * The kernel is the seam; what it answers stands in for the media service.
 */
const kernel = vi.hoisted(() => ({
  asked: [] as string[],
  services: [] as unknown[],
  described: true,
}));

vi.mock("~/server/kernel/client", () => ({
  call: async (path: string) => {
    kernel.asked.push(path);
    if (path === "/__kernel/media/services") return { ok: kernel.services.length > 0, json: async () => ({ services: kernel.services }) };
    if (path.startsWith("/__kernel/media/models/")) {
      return kernel.described
        ? {
            ok: true,
            json: async () => ({
              service: "higgsfield",
              model: "gpt_image_2",
              kind: "image",
              axes: [
                { axis: "aspect-ratio", vendorKey: "aspect_ratio", takes: "flag", values: ["1:1", "3:2", "2:3"], default: "1:1" },
                { axis: "resolution", vendorKey: "resolution", takes: "flag", values: ["1k", "2k"], default: null },
                { axis: "quality", vendorKey: "quality", takes: "flag", values: ["low", "high"], default: null },
              ],
            }),
          }
        : { ok: false, json: async () => ({}) };
    }
    return { ok: false, json: async () => ({}) };
  },
}));

const { SUGGESTION_SOURCES, forgetDescriptions, qualityAxisOf } = await import("./suggestions");
const source = (name: string) => SUGGESTION_SOURCES.find((one) => one.name === name)!;

const roster = (signedIn: boolean) => [
  { service: "codex", signedIn: true, reason: null, models: [{ model: "codex-image", kind: "image", default: true }], openSet: {}, workspaces: null },
  {
    service: "higgsfield",
    signedIn,
    reason: signedIn ? null : "run `higgsfield auth login`",
    models: [
      { model: "gpt_image_2", kind: "image", default: true },
      { model: "seedance_2_0_mini", kind: "video", default: true },
    ],
    openSet: {},
    workspaces: [],
  },
  { service: "openart", signedIn: false, reason: "Not signed in.", models: [], openSet: {}, workspaces: null },
];

afterEach(() => {
  kernel.asked = [];
  kernel.services = [];
  kernel.described = true;
  forgetDescriptions();
});

describe("a format's suggestions", () => {
  it("suggests the generation services signed in, never Codex, and says when none is", async () => {
    kernel.services = roster(true);
    expect(await source("provider").answer({})).toEqual({ suggestions: [{ value: "higgsfield", label: "Higgsfield" }] });
    kernel.services = roster(false);
    expect((await source("provider").answer({})).note).toBe("Nothing is signed in: sign in to Higgsfield or OpenArt in Settings.");
    kernel.services = [];
    expect((await source("provider").answer({})).note).toBe("The media service is not answering.");
  });

  it("suggests the provider's models that make the format's type, under the vendor's own names", async () => {
    kernel.services = roster(true);
    expect(await source("model").answer({ provider: "higgsfield", type: "image" })).toEqual({ suggestions: [{ value: "gpt_image_2" }] });
    expect(await source("model").answer({ provider: "higgsfield", type: "video" })).toEqual({ suggestions: [{ value: "seedance_2_0_mini" }] });
    expect((await source("model").answer({})).note).toBe("Choose a provider first.");
    kernel.services = roster(false);
    expect((await source("model").answer({ provider: "higgsfield", type: "image" })).note).toBe("run `higgsfield auth login`");
  });

  it("suggests the model's ratios and its resolutions as qualities, the model's own marked", async () => {
    expect(await source("ratio").answer({ provider: "higgsfield", model: "gpt_image_2" })).toEqual({
      suggestions: [{ value: "1:1", label: "1:1 (the model's own)" }, { value: "3:2" }, { value: "2:3" }],
    });
    expect(await source("quality").answer({ provider: "higgsfield", model: "gpt_image_2" })).toEqual({ suggestions: [{ value: "1k" }, { value: "2k" }] });
    expect((await source("ratio").answer({ provider: "higgsfield" })).note).toBe("Choose a provider and a model first.");
  });

  it("keeps what the vendor said, so a vendor not answering leaves it, and sends a quality under the axis it came from", async () => {
    expect(qualityAxisOf("higgsfield", "gpt_image_2")).toBe("resolution");
    await source("quality").answer({ provider: "higgsfield", model: "gpt_image_2" });
    kernel.described = false;
    expect((await source("ratio").answer({ provider: "higgsfield", model: "gpt_image_2" })).suggestions).toHaveLength(3);
    forgetDescriptions();
    expect((await source("ratio").answer({ provider: "higgsfield", model: "gpt_image_2" })).note).toBe("The media service is not answering.");
  });
});
