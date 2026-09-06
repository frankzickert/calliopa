import { describe, expect, it } from "vitest";

import {
  ASSET_MEDIA,
  ASSET_ROLES,
  productionSchema,
  renditionAspect,
  type AssetContent,
} from "./vocabulary";

const validateAsset = (content: unknown): string | null => {
  const definition = productionSchema.nodes["asset"];
  if (definition === undefined) throw new Error("No definition for asset.");
  return definition.validate(content as never);
};

const video = (over: Record<string, unknown> = {}): unknown => ({
  role: "main-video",
  medium: "video",
  synthetic: true,
  durationSeconds: 62,
  ...over,
});

const image = (over: Record<string, unknown> = {}): unknown => ({
  role: "cinematic-image",
  medium: "image",
  synthetic: true,
  width: 1920,
  height: 1080,
  ...over,
});

const prose = (over: Record<string, unknown> = {}): unknown => ({
  role: "field-note",
  medium: "prose",
  synthetic: false,
  ...over,
});

describe("the committed production vocabulary", () => {
  it("Given the schema, Then it defines what an episode is made of", () => {
    expect(Object.keys(productionSchema.nodes).sort()).toEqual([
      "asset",
      "category",
      "character",
      "episode",
      "rendition",
      "serial",
    ]);
    expect(Object.keys(productionSchema.relations).sort()).toEqual([
      "alsoIn",
      "body",
      "categorised",
      "cover",
      "description",
      "exports",
      "features",
      "holds",
      "homeSerial",
      "opening",
      "portrait",
      "teaser",
    ]);
  });

  it("Given the role set, Then it is the production inventory rather than a destination's slots", () => {
    expect([...ASSET_ROLES]).toEqual([
      "complete-episode",
      "main-video",
      "teaser",
      "crossover",
      "blooper",
      "cinematic-image",
      "statement",
      "image-teaser",
      "field-note",
    ]);
  });

  it("Given the media set, Then bytes and prose are both assets", () => {
    expect([...ASSET_MEDIA]).toEqual(["video", "image", "prose"]);
  });
});

describe("validating an asset's role and medium", () => {
  it("Given every role on a prose asset, Then each is acceptable", () => {
    for (const role of ASSET_ROLES) {
      expect(validateAsset(prose({ role }))).toBeNull();
    }
  });

  it("Given a role no build knows, Then the asset is refused naming the permitted set", () => {
    const refusal = validateAsset(prose({ role: "director-commentary" }));
    expect(refusal).toMatch(/director-commentary/);
    expect(refusal).toMatch(/complete-episode/);
  });

  it("Given a medium no build knows, Then the asset is refused naming the permitted set", () => {
    const refusal = validateAsset({ role: "teaser", medium: "audio", synthetic: true });
    expect(refusal).toMatch(/audio/);
    expect(refusal).toMatch(/video, image, prose/);
  });

  it("Given content that is not a record, Then the asset is refused", () => {
    expect(validateAsset("an asset")).toMatch(/carries content/);
  });
});

describe("stating whether an asset is synthetic", () => {
  it("Given a stated disclosure, Then either answer is acceptable", () => {
    expect(validateAsset(video({ synthetic: true }))).toBeNull();
    expect(validateAsset(video({ synthetic: false }))).toBeNull();
  });

  it("Given no disclosure, Then the asset is refused rather than defaulted", () => {
    const { synthetic: _omitted, ...withoutDisclosure } = video() as Record<
      string,
      unknown
    >;
    expect(validateAsset(withoutDisclosure)).toMatch(/synthetic/);
  });
});

describe("refusing facts that contradict the medium", () => {
  it("Given a video with a duration, Then it is acceptable", () => {
    expect(validateAsset(video())).toBeNull();
  });

  it("Given a video with no duration, Then it is refused naming the rule", () => {
    const { durationSeconds: _omitted, ...withoutDuration } = video() as Record<
      string,
      unknown
    >;
    expect(validateAsset(withoutDuration)).toMatch(/duration in seconds/);
  });

  it("Given a video with a duration of zero or less, Then it is refused", () => {
    expect(validateAsset(video({ durationSeconds: 0 }))).toMatch(/greater than zero/);
    expect(validateAsset(video({ durationSeconds: -3 }))).toMatch(/greater than zero/);
  });

  it("Given a video carrying dimensions, Then it is refused, because those belong to a rendition", () => {
    expect(validateAsset(video({ width: 1080, height: 1920 }))).toMatch(/rendition/);
  });

  it("Given an image with both dimensions, Then it is acceptable", () => {
    expect(validateAsset(image())).toBeNull();
  });

  it("Given an image with one dimension only, Then it is refused", () => {
    const { height: _omitted, ...withoutHeight } = image() as Record<string, unknown>;
    expect(validateAsset(withoutHeight)).toMatch(/width and a height/);
  });

  it("Given an image with fractional pixels, Then it is refused", () => {
    expect(validateAsset(image({ width: 1920.5 }))).toMatch(/whole pixel/);
  });

  it("Given an image carrying a duration, Then it is refused", () => {
    expect(validateAsset(image({ durationSeconds: 12 }))).toMatch(/no duration/);
  });

  it("Given a prose asset with neither, Then it is acceptable", () => {
    expect(validateAsset(prose())).toBeNull();
  });

  it("Given a prose asset carrying bytes' facts, Then it is refused", () => {
    expect(validateAsset(prose({ durationSeconds: 40 }))).toMatch(/no duration/);
    expect(validateAsset(prose({ width: 800, height: 600 }))).toMatch(/no dimensions/);
  });
});

describe("the optional machine facts", () => {
  it("Given a transcript and alt text, Then they are acceptable", () => {
    const complete: AssetContent = {
      role: "main-video",
      medium: "video",
      synthetic: true,
      durationSeconds: 62,
      transcript: "She looks up.",
      altText: "A woman at a terminal.",
    };
    expect(validateAsset(complete)).toBeNull();
  });

  it("Given no transcript, Then the asset is acceptable, because that is a destination's rule", () => {
    expect(validateAsset(video())).toBeNull();
    expect(validateAsset(image())).toBeNull();
  });

  it("Given a transcript or alt text that is not text, Then the asset is refused", () => {
    expect(validateAsset(video({ transcript: 12 }))).toMatch(/transcript is text/);
    expect(validateAsset(image({ altText: [] }))).toMatch(/alt text is text/);
  });
});

const validateNode = (semanticType: string, content: unknown): string | null => {
  const definition = productionSchema.nodes[semanticType];
  if (definition === undefined) throw new Error(`No definition for ${semanticType}.`);
  return definition.validate(content as never);
};

const rendition = (over: Record<string, unknown> = {}): unknown => ({
  objectId: "a".repeat(64),
  width: 1080,
  height: 1920,
  byteSize: 4_200_000,
  contentType: "video/mp4",
  provenance: "ingested",
  ...over,
});

describe("the production relations", () => {
  it("Given the schema, Then an episode holds assets rather than containing them", () => {
    const holds = productionSchema.relations["holds"];
    expect(holds?.fromNodes).toEqual(["episode"]);
    expect(holds?.toNodes).toEqual(["asset"]);
    expect(productionSchema.relations["contains"]).toBeUndefined();
  });

  it("Given the schema, Then bytes and a body hang off an asset separately", () => {
    expect(productionSchema.relations["exports"]?.toNodes).toEqual(["rendition"]);
    expect(productionSchema.relations["body"]?.toNodes).toEqual(["document"]);
  });

  it("Given the schema, Then both serial memberships run from an episode to a serial", () => {
    for (const name of ["homeSerial", "alsoIn"]) {
      expect(productionSchema.relations[name]?.fromNodes).toEqual(["episode"]);
      expect(productionSchema.relations[name]?.toNodes).toEqual(["serial"]);
    }
  });
});

describe("validating an episode", () => {
  it("Given a title, Then the episode is acceptable with or without a position", () => {
    expect(validateNode("episode", { title: "The Interview" })).toBeNull();
    expect(validateNode("episode", { title: "The Interview", position: 4 })).toBeNull();
  });

  it("Given no title, Then the episode is refused", () => {
    expect(validateNode("episode", {})).toMatch(/title/);
  });

  it("Given a position that is not a whole number above zero, Then it is refused", () => {
    expect(validateNode("episode", { title: "A", position: 0 })).toMatch(/position/);
    expect(validateNode("episode", { title: "A", position: 1.5 })).toMatch(/position/);
  });
});

describe("validating a serial", () => {
  it("Given a name, an order and a state, Then the serial is acceptable", () => {
    expect(
      validateNode("serial", { name: "Field Work", ordered: true, state: "running" }),
    ).toBeNull();
  });

  it("Given no stated order, Then it is refused rather than defaulted", () => {
    expect(validateNode("serial", { name: "Field Work", state: "running" })).toMatch(
      /whether it is ordered/,
    );
  });

  it("Given a state outside the set, Then it is refused naming the set", () => {
    const refusal = validateNode("serial", {
      name: "Field Work",
      ordered: false,
      state: "paused",
    });
    expect(refusal).toMatch(/paused/);
    expect(refusal).toMatch(/running, complete/);
  });
});

describe("validating a rendition", () => {
  it("Given bytes named by their hash, Then the rendition is acceptable", () => {
    expect(validateNode("rendition", rendition())).toBeNull();
  });

  it("Given an object id that is not a SHA-256, Then it is refused", () => {
    expect(validateNode("rendition", rendition({ objectId: "teaser-vertical" }))).toMatch(
      /SHA-256/,
    );
  });

  it("Given no dimensions or no size, Then it is refused", () => {
    expect(validateNode("rendition", rendition({ width: 0 }))).toMatch(/dimensions/);
    expect(validateNode("rendition", rendition({ byteSize: undefined }))).toMatch(
      /size in bytes/,
    );
  });

  it("Given a provenance outside the set, Then it is refused naming the set", () => {
    const refusal = validateNode("rendition", rendition({ provenance: "imported" }));
    expect(refusal).toMatch(/imported/);
    expect(refusal).toMatch(/ingested, produced/);
  });
});

describe("a rendition's aspect", () => {
  it("Given dimensions, Then the aspect is reduced from them rather than stored", () => {
    expect(renditionAspect({ width: 1920, height: 1080 })).toBe("16:9");
    expect(renditionAspect({ width: 1080, height: 1920 })).toBe("9:16");
    expect(renditionAspect({ width: 1080, height: 1080 })).toBe("1:1");
  });

  it("Given two sizes of one shape, Then they answer the same aspect", () => {
    expect(renditionAspect({ width: 3840, height: 2160 })).toBe(
      renditionAspect({ width: 1280, height: 720 }),
    );
  });
});

describe("validating what an episode and a serial write", () => {
  it("Given no premise or teaser text, Then the episode is acceptable", () => {
    expect(validateNode("episode", { title: "The Interview" })).toBeNull();
  });

  it("Given a premise and a teaser text, Then both are acceptable", () => {
    expect(
      validateNode("episode", {
        title: "The Interview",
        premise: "A hiring panel of one.",
        teaserText: "She was the only candidate who noticed.",
      }),
    ).toBeNull();
  });

  it("Given a premise that is not text, Then the episode is refused", () => {
    expect(validateNode("episode", { title: "A", premise: 12 })).toMatch(/premise is text/);
  });

  it("Given a serial premise, Then it is optional and text", () => {
    const serial = { name: "Field Work", ordered: false, state: "running" as const };
    expect(validateNode("serial", serial)).toBeNull();
    expect(validateNode("serial", { ...serial, premise: "Work, seen twice." })).toBeNull();
    expect(validateNode("serial", { ...serial, premise: [] })).toMatch(/premise is text/);
  });
});

describe("validating an asset's label", () => {
  it("Given no label, Then the asset is acceptable", () => {
    expect(validateAsset(prose())).toBeNull();
  });

  it("Given a label, Then it is acceptable", () => {
    expect(validateAsset(prose({ label: "The other side" }))).toBeNull();
  });

  it("Given a label that is not text, Then the asset is refused", () => {
    expect(validateAsset(prose({ label: 7 }))).toMatch(/label is text/);
  });
});

describe("validating a category and a character", () => {
  it("Given a label and a line, Then the category is acceptable", () => {
    expect(
      validateNode("category", {
        label: "Human perspective",
        line: "People. Pressure. Consequences.",
      }),
    ).toBeNull();
  });

  it("Given no label, Then the category is refused", () => {
    expect(validateNode("category", { line: "People." })).toMatch(/carries a label/);
    expect(validateNode("category", { label: "", line: "People." })).toMatch(
      /carries a label/,
    );
  });

  it("Given no line, Then the category is refused", () => {
    expect(validateNode("category", { label: "Human perspective" })).toMatch(
      /carries a line/,
    );
  });

  it("Given a name, Then the character is acceptable", () => {
    expect(validateNode("character", { name: "Iris" })).toBeNull();
  });

  it("Given no name, Then the character is refused", () => {
    expect(validateNode("character", {})).toMatch(/carries a name/);
    expect(validateNode("character", { name: "" })).toMatch(/carries a name/);
  });
});

describe("the relations these records hang on", () => {
  it("Given the schema, Then a category is named by an asset and a character by an episode", () => {
    expect(productionSchema.relations["categorised"]?.fromNodes).toEqual(["asset"]);
    expect(productionSchema.relations["categorised"]?.toNodes).toEqual(["category"]);
    expect(productionSchema.relations["features"]?.fromNodes).toEqual(["episode"]);
    expect(productionSchema.relations["features"]?.toNodes).toEqual(["character"]);
  });

  it("Given the schema, Then prose targets are documents and image ones are assets", () => {
    expect(productionSchema.relations["description"]?.toNodes).toEqual(["document"]);
    expect(productionSchema.relations["opening"]?.toNodes).toEqual(["document"]);
    expect(productionSchema.relations["portrait"]?.toNodes).toEqual(["asset"]);
    expect(productionSchema.relations["cover"]?.toNodes).toEqual(["asset"]);
    expect(productionSchema.relations["teaser"]?.toNodes).toEqual(["asset"]);
  });
});
