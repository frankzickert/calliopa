import { afterEach, describe, expect, it, vi } from "vitest";

import { offeredKey, offeredRoster, readOffered, writeOffered } from "./offered";

/**
 * The service answers everything it can validate; the owner says which of those
 * are worth offering. **An empty set means everything**, so a fresh instance
 * offers what the services answer rather than nothing.
 */
const state = vi.hoisted(() => ({ held: null as unknown, written: [] as unknown[] }));
const services = vi.hoisted(() => ({ value: [] as unknown[] }));

vi.mock("~/server/kernel/client", () => ({
  kernelState: {
    read: async () => state.held,
    write: async (_c: string, record: unknown) => {
      state.written.push(record);
      return record;
    },
  },
}));
vi.mock("./media", () => ({ roster: async () => services.value }));

const higgsfield = {
  service: "higgsfield",
  signedIn: true,
  reason: null,
  models: [
    { model: "gpt_image_2", kind: "image", default: true },
    { model: "seedance_2_0_mini", kind: "video", default: true },
  ],
  openSet: { image: false, video: true },
};

afterEach(() => {
  state.held = null;
  state.written = [];
  services.value = [];
});

describe("which models the dropdown offers", () => {
  it("offers everything when the owner has chosen nothing", async () => {
    services.value = [higgsfield];
    const shown = await offeredRoster();
    expect(shown[0]?.models.map((one) => one.model)).toEqual(["gpt_image_2", "seedance_2_0_mini"]);
  });

  it("offers the owner's own set when there is one", async () => {
    services.value = [higgsfield];
    state.held = { id: "media", models: [offeredKey("higgsfield", "gpt_image_2")], named: [] };
    const shown = await offeredRoster();
    expect(shown[0]?.models.map((one) => one.model)).toEqual(["gpt_image_2"]);
  });

  it("offers a job type the owner named, because that set is open", async () => {
    services.value = [higgsfield];
    state.held = { id: "media", models: [offeredKey("higgsfield", "gpt_image_2")], named: ["seedance_2_5"] };
    const shown = await offeredRoster();
    const models = shown[0]?.models ?? [];
    expect(models.map((one) => one.model)).toEqual(["gpt_image_2", "seedance_2_5"]);
    // It follows the open set's kind: a named Higgsfield job type is a video.
    expect(models.find((one) => one.model === "seedance_2_5")?.kind).toBe("video");
  });

  it("names nothing twice when the owner names what the service already answers", async () => {
    services.value = [higgsfield];
    state.held = { id: "media", models: [], named: ["seedance_2_0_mini"] };
    const models = (await offeredRoster())[0]?.models ?? [];
    expect(models.filter((one) => one.model === "seedance_2_0_mini")).toHaveLength(1);
  });

  it("names nothing for a service whose sets are all closed", async () => {
    services.value = [{ ...higgsfield, service: "openart", openSet: { image: false, video: false } }];
    state.held = { id: "media", models: [], named: ["something"] };
    const models = (await offeredRoster())[0]?.models ?? [];
    expect(models.some((one) => one.model === "something")).toBe(false);
  });

  it("keeps what is written clean: no blanks, no repeats, trimmed", async () => {
    await writeOffered({
      models: ["a:b", "a:b", ""],
      named: ["  x  ", "x", "  "],
      names: { "a:b": "  Plates  ", "a:c": "   ", "a:d": 7 },
      icons: { "a:b": "sparkle" },
    });
    expect(state.written[0]).toEqual({
      id: "media",
      models: ["a:b"],
      named: ["x"],
      // A blank name is not a name, and a name that is not a string is none.
      names: { "a:b": "Plates" },
      icons: { "a:b": "sparkle" },
      // What each model takes, captured when it was offered. BO_0279_011
      axes: {},
    });
  });

  it("reads an absent or malformed record as nothing chosen", async () => {
    const nothing = { id: "media", models: [], named: [], names: {}, icons: {}, axes: {} };
    expect(await readOffered()).toEqual(nothing);
    state.held = { id: "media", models: "not a list", named: 7, names: "no", icons: [] };
    expect(await readOffered()).toEqual(nothing);
  });

  it("reads back what the owner called a model", async () => {
    state.held = { id: "media", models: [], named: [], names: { "a:b": "Plates" }, icons: { "a:b": "sparkle" } };
    const held = await readOffered();
    expect(held.names?.["a:b"]).toBe("Plates");
    expect(held.icons?.["a:b"]).toBe("sparkle");
  });
});

describe("what a model takes, kept with what is offered", () => {
  it("keeps only what is shaped like an axis", async () => {
    await writeOffered({
      models: ["a:b"],
      named: [],
      axes: {
        "a:b": [{ axis: "aspect-ratio", values: ["1:1", "16:9"], default: "1:1" }],
        "a:c": [{ axis: "resolution" }],
        "a:d": "not a list",
        "a:e": [],
      },
    });
    const written = state.written[0] as { axes: Record<string, unknown[]> };
    expect(Object.keys(written.axes)).toEqual(["a:b"]);
    expect(written.axes["a:b"]).toHaveLength(1);
  });

  it("reads a malformed axis record as none", async () => {
    state.held = { id: "media", models: [], named: [], axes: "no" };
    expect((await readOffered()).axes).toEqual({});
  });
});
