import { describe, expect, it } from "vitest";

import { aspectOf, constraintsOf, formatOf, partRefusal, placementRefusal, type PartRecord } from "./vocabulary";

/**
 * The pure rules a placement is checked by, and what a part must be: proven
 * over plain values, without a graph. PU_0002_007
 */

const part = (over: Partial<PartRecord> = {}): PartRecord => ({
  partId: "p1",
  title: "Main video",
  class: "video",
  cardinality: "any",
  role: "",
  constraints: {},
  order: "i",
  shape: null,
  ...over,
});

const video = { class: "video" as const, durationSeconds: 60, width: 1080, height: 1920 };
const vertical = { mediaType: "video/mp4", width: 1080, height: 1920 };
const wide = { mediaType: "video/mp4", width: 1920, height: 1080 };

describe("what fills a part", () => {
  it("Given a part of another class, Then the item is refused naming both classes", () => {
    expect(placementRefusal(part({ class: "image" }), video, [vertical], 0)).toBe("Main video takes image, and this item is video.");
    expect(placementRefusal(part({ class: "shape", shape: "s2" }), video, [vertical], 0)).toBe("Main video takes a deliverable of a shape, not an item.");
  });

  it("Given a part taking one, Then a second item is refused, while any number takes more", () => {
    expect(placementRefusal(part({ cardinality: "one" }), video, [vertical], 1)).toBe("Main video takes one item and already holds one.");
    expect(placementRefusal(part({ cardinality: "optional" }), video, [vertical], 1)).toBe("Main video takes one item and already holds one.");
    expect(placementRefusal(part({ cardinality: "some" }), video, [vertical], 3)).toBeNull();
    expect(placementRefusal(part({ cardinality: "any" }), video, [vertical], 3)).toBeNull();
  });

  it("Given an aspect, Then one export at it is enough and none is refused", () => {
    expect(placementRefusal(part({ constraints: { aspect: "9:16" } }), video, [wide, vertical], 0)).toBeNull();
    expect(placementRefusal(part({ constraints: { aspect: "9:16" } }), video, [wide], 0)).toBe("Main video needs an export at 9:16, and this item has none.");
  });

  it("Given a duration limit, Then a longer item and one stating no duration are refused", () => {
    expect(placementRefusal(part({ constraints: { maxDurationSeconds: 90 } }), video, [vertical], 0)).toBeNull();
    expect(placementRefusal(part({ constraints: { maxDurationSeconds: 45 } }), video, [vertical], 0)).toBe("Main video limits the duration to 45s, and this item runs 60s.");
    expect(placementRefusal(part({ constraints: { maxDurationSeconds: 45 } }), { ...video, durationSeconds: null }, [vertical], 0)).toBe(
      "Main video limits the duration to 45s, and this item states none.",
    );
  });

  it("Given dimensions and formats, Then one export meeting them is enough", () => {
    expect(placementRefusal(part({ constraints: { minWidth: 1080, minHeight: 1080 } }), video, [vertical], 0)).toBeNull();
    expect(placementRefusal(part({ constraints: { minWidth: 1920 } }), video, [vertical], 0)).toBe("Main video needs an export of at least 1920×0, and this item has none.");
    expect(placementRefusal(part({ constraints: { formats: ["MP4"] } }), video, [vertical], 0)).toBeNull();
    expect(placementRefusal(part({ constraints: { formats: ["webm"] } }), video, [vertical], 0)).toBe("Main video takes webm, and this item has no export in one of them.");
  });
});

describe("what a part must be", () => {
  const input = { title: "Still", class: "image", cardinality: "any", constraints: {}, shape: null };

  it("refuses a blank title, an unknown class or cardinality, and a nested part without a shape", () => {
    expect(partRefusal({ ...input, title: " " })).toBe("A part needs a title.");
    expect(partRefusal({ ...input, class: "movie" })).toBe("A part's class is one of video, image, audio, prose, file, shape.");
    expect(partRefusal({ ...input, cardinality: "two" })).toBe("A part's cardinality is one of one, optional, some, any.");
    expect(partRefusal({ ...input, class: "shape" })).toBe("A part of class shape names the shape it nests.");
    expect(partRefusal({ ...input, shape: "s2" })).toBe("Only a part of class shape names a shape.");
    expect(partRefusal({ ...input, class: "shape", shape: "s2", constraints: { aspect: "1:1" } })).toBe("A part of class shape takes no constraints.");
  });

  it("refuses constraints outside the vocabulary and accepts the rest", () => {
    expect(partRefusal({ ...input, constraints: { aspect: "2:3" as never } })).toBe("aspect is one of 16:9, 9:16, 1:1, 4:5.");
    expect(partRefusal({ ...input, constraints: { maxDurationSeconds: 0 } })).toBe("maxDurationSeconds is a number above zero.");
    expect(partRefusal({ ...input, constraints: { formats: [""] } })).toBe("formats is a list of media subtypes.");
    expect(partRefusal({ ...input, constraints: { aspect: "1:1", minWidth: 1080, formats: ["png"] } })).toBeNull();
  });

  it("keeps only the constraint keys the vocabulary names", () => {
    expect(constraintsOf({ aspect: "1:1", colour: "red", maxDurationSeconds: 3, formats: ["png"], minWidth: null })).toEqual({ aspect: "1:1", maxDurationSeconds: 3, formats: ["png"] });
    expect(constraintsOf("nope")).toEqual({});
  });
});

describe("derived facts", () => {
  it("reduces dimensions to an aspect and reads a format off a media type", () => {
    expect(aspectOf(1920, 1080)).toBe("16:9");
    expect(aspectOf(1080, 1920)).toBe("9:16");
    expect(aspectOf(1080, 1350)).toBe("4:5");
    expect(aspectOf(500, 500)).toBe("1:1");
    expect(aspectOf(null, 10)).toBeNull();
    expect(formatOf("video/mp4")).toBe("mp4");
    expect(formatOf("image/jpeg; charset=binary")).toBe("jpeg");
  });
});
