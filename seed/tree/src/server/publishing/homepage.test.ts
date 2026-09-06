import { describe, expect, it } from "vitest";

import type { DocumentView } from "../documents/assemble";
import type { AssetView, EpisodeView, RenditionView } from "../production/assemble";
import type { Binding } from "./bindings";
import type { SerialView } from "../production/assemble";
import type { Front } from "./front";
import type { EpisodeSubmission, FrontSubmission } from "./destinations";
import { projectEpisode, projectFront } from "./homepage";

/**
 * The projection reaches nothing. Every rule homepage would enforce is proved
 * here without a database, an account or egress, which is what the split
 * between the projection and the transport exists for.
 */

const rendition = (aspect: string, objectId: string): RenditionView => {
  const [w, h] = aspect.split(":").map(Number) as [number, number];
  return {
    renditionId: `r-${objectId}`,
    objectId,
    width: w * 120,
    height: h * 120,
    byteSize: 1024,
    contentType: "image/png",
    provenance: "ingested",
    aspect,
  };
};

const asset = (over: Partial<AssetView> = {}): AssetView => ({
  assetId: "asset-1",
  revisionId: "rev-1",
  role: "cinematic-image",
  medium: "image",
  synthetic: true,
  durationSeconds: null,
  width: 1920,
  height: 1080,
  transcript: null,
  altText: "A woman at a terminal.",
  label: null,
  renditions: [rendition("16:9", "a".repeat(64))],
  bodyDocumentId: null,
  categories: [],
  ...over,
});

const teaserAsset = (over: Partial<AssetView> = {}): AssetView =>
  asset({
    assetId: "teaser",
    role: "image-teaser",
    renditions: [
      rendition("16:9", "w".repeat(64)),
      rendition("9:16", "v".repeat(64)),
      rendition("1:1", "s".repeat(64)),
    ],
    ...over,
  });

const episode = (over: Partial<EpisodeView> = {}): EpisodeView => ({
  episodeId: "episode-1",
  revisionId: "rev-e",
  title: "The Interview",
  premise: "A hiring panel of one.",
  teaserText: "She was the only candidate who noticed.",
  teaserAssetId: "teaser",
  characters: [],
  position: null,
  homeSerial: null,
  alsoIn: [],
  assets: [teaserAsset()],
  ...over,
});

const binding = (over: Partial<Binding> = {}): Binding => ({
  recordId: "episode-1",
  recordKind: "episode",
  channel: "homepage",
  slug: "the-interview",
  listed: null,
  rootAddress: null,
  colour: null,
  ...over,
});

const document = (title: string, documentId = "doc-1"): DocumentView => ({
  documentId,
  revisionId: "rev-d",
  title,
  blocks: [
    {
      blockId: "b1",
      revisionId: "rev-b",
      containmentId: "c1",
      kind: "text",
      role: "paragraph",
      order: "a0",
      runs: [{ text: "Why a dashboard can be right.", marks: [] }],
    },
    {
      blockId: "b2",
      revisionId: "rev-b2",
      containmentId: "c2",
      kind: "divider",
      order: "a1",
    },
  ],
});

const submit = (over: Partial<EpisodeSubmission> = {}): EpisodeSubmission => ({
  episode: episode(),
  binding: binding(),
  referenced: new Map(),
  documents: new Map([["doc-1", document("Field note")]]),
  ...over,
});

const rulesOf = (result: ReturnType<typeof projectEpisode>): string[] => {
  if (result.ok) throw new Error("Expected a refusal.");
  return result.refusals.map((refusal) => refusal.rule);
};

describe("Projecting an episode onto homepage's document", () => {
  it("Given a complete episode, Then it projects and its address is its slug", () => {
    const result = projectEpisode(submit());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document).toMatchObject({
      title: "The Interview",
      premise: "A hiring panel of one.",
    });
    // The line that travels is inside the teaser, which is homepage's shape.
    expect(result.document.teaser.text).toBe("She was the only candidate who noticed.");
  });

  it("Given a teaser, Then its three formats become the three homepage requires", () => {
    const result = projectEpisode(submit());
    if (!result.ok) throw new Error("expected success");
    expect(result.document.teaser).toEqual({
      wide: "w".repeat(64),
      vertical: "v".repeat(64),
      square: "s".repeat(64),
      alt: "A woman at a terminal.",
      text: "She was the only candidate who noticed.",
    });
  });

  it("Given the teaser, Then it does not also appear among the stills", () => {
    const result = projectEpisode(
      submit({ episode: episode({ assets: [teaserAsset(), asset()] }) }),
    );
    if (!result.ok) throw new Error("expected success");
    expect(result.document.stills.map((still) => still.id)).toEqual(["asset-1"]);
  });

  it("Given production roles, Then each lands in homepage's matching slot", () => {
    const roles = [
      ["statement", "stills"],
      ["field-note", "prose"],
    ] as const;

    for (const [production, slot] of roles) {
      const held =
        production === "field-note"
          ? asset({
              role: "field-note",
              medium: "prose",
              renditions: [],
              bodyDocumentId: "doc-1",
            })
          : asset({
              role: production,
              medium: production === "statement" ? "image" : "video",
              durationSeconds: 62,
              transcript: "She looks up.",
            });
      const result = projectEpisode(
        submit({ episode: episode({ assets: [teaserAsset(), held] }) }),
      );
      if (!result.ok) throw new Error(`${production}: ${rulesOf(result).join(", ")}`);
      expect(result.document[slot], production).toHaveLength(1);
    }
  });
});

describe("What homepage would refuse, refused here first", () => {
  it("Given no premise or teaser text, Then both are named", () => {
    const rules = rulesOf(
      projectEpisode(submit({ episode: episode({ premise: null, teaserText: null }) })),
    );
    expect(rules).toContain("premiseRequired");
    expect(rules).toContain("teaserTextRequired");
  });

  it("Given no teaser named, Then it is refused", () => {
    expect(
      rulesOf(projectEpisode(submit({ episode: episode({ teaserAssetId: null }) }))),
    ).toContain("teaserRequired");
  });

  it("Given a teaser missing its square, Then the missing format is named", () => {
    const partial = teaserAsset({
      renditions: [rendition("16:9", "w".repeat(64)), rendition("9:16", "v".repeat(64))],
    });
    const result = projectEpisode(
      submit({ episode: episode({ assets: [partial] }) }),
    );
    expect(rulesOf(result)).toContain("teaserFormatMissing");
    if (result.ok) return;
    expect(result.refusals.map((r) => r.detail).join(" ")).toMatch(/square/);
  });

  it("Given a teaser with no alt text, Then it is refused", () => {
    expect(
      rulesOf(
        projectEpisode(submit({ episode: episode({ assets: [teaserAsset({ altText: null })] }) })),
      ),
    ).toContain("teaserNeedsAltText");
  });

  it("Given a film, Then it is refused until its bytes are at the video host", () => {
    const scene = asset({
      role: "main-video",
      medium: "video",
      durationSeconds: 62,
      transcript: "She looks up.",
    });
    expect(
      rulesOf(projectEpisode(submit({ episode: episode({ assets: [teaserAsset(), scene] }) }))),
    ).toContain("filmNeedsItsHostId");
  });

  it("Given a scene with no transcript or duration, Then both are named", () => {
    const scene = asset({
      role: "main-video",
      medium: "video",
      durationSeconds: null,
      transcript: null,
      altText: null,
    });
    const rules = rulesOf(
      projectEpisode(submit({ episode: episode({ assets: [teaserAsset(), scene] }) })),
    );
    expect(rules).toContain("filmNeedsDuration");
    expect(rules).toContain("filmNeedsTranscript");
  });

  it("Given a still with no alt text, Then it is refused", () => {
    expect(
      rulesOf(
        projectEpisode(
          submit({ episode: episode({ assets: [teaserAsset(), asset({ altText: null })] }) }),
        ),
      ),
    ).toContain("stillNeedsAltText");
  });

  it("Given an asset with no export, Then there is nothing to publish", () => {
    expect(
      rulesOf(
        projectEpisode(
          submit({ episode: episode({ assets: [teaserAsset(), asset({ renditions: [] })] }) }),
        ),
      ),
    ).toContain("noExport");
  });

  it("Given a serial with no address, Then the episode is refused naming it", () => {
    const withSerial = episode({
      homeSerial: {
        serialId: "serial-1",
        revisionId: "r",
        name: "Field Work",
        premise: null,
        ordered: true,
        state: "running",
        openingDocumentId: null,
        coverAssetId: null,
      },
      position: 4,
    });
    const result = projectEpisode(submit({ episode: withSerial }));
    expect(rulesOf(result)).toContain("unpublishedReference");
    if (result.ok) return;
    expect(result.refusals.map((r) => r.detail).join(" ")).toMatch(/Field Work/);
  });

  it("Given a bound serial, Then its address is what the episode names", () => {
    const withSerial = episode({
      homeSerial: {
        serialId: "serial-1",
        revisionId: "r",
        name: "Field Work",
        premise: null,
        ordered: true,
        state: "running",
        openingDocumentId: null,
        coverAssetId: null,
      },
      position: 4,
    });
    const result = projectEpisode(
      submit({
        episode: withSerial,
        referenced: new Map([
          ["serial-1", binding({ recordKind: "serial", slug: "field-work" })],
        ]),
      }),
    );
    if (!result.ok) throw new Error(rulesOf(result).join(", "));
    expect(result.document.homeSerial).toBe("field-work");
    expect(result.document.position).toBe(4);
  });

  it("Given an unbound category on an asset, Then it is refused naming the category", () => {
    const categorised = asset({
      categories: [
        { categoryId: "cat-1", revisionId: "r", label: "Human perspective", line: "People." },
      ],
    });
    const result = projectEpisode(
      submit({ episode: episode({ assets: [teaserAsset(), categorised] }) }),
    );
    expect(rulesOf(result)).toContain("unpublishedCategory");
  });

  it("Given no address for the episode, Then it is refused before anything else", () => {
    expect(rulesOf(projectEpisode(submit({ binding: binding({ slug: null }) })))).toContain(
      "slugRequired",
    );
  });

  it("Given several broken rules, Then every one is reported rather than the first", () => {
    const rules = rulesOf(
      projectEpisode(
        submit({
          episode: episode({
            premise: null,
            teaserText: null,
            assets: [teaserAsset({ altText: null })],
          }),
        }),
      ),
    );
    expect(rules.length).toBeGreaterThan(2);
  });
});

/**
 * The front. Homepage writes its site document whole and refuses one that names
 * anything it is not serving, so every one of those refusals is proved here
 * before a request could be made.
 */

const heroAsset = (over: Partial<AssetView> = {}): AssetView =>
  asset({
    assetId: "hero",
    role: "cinematic-image",
    altText: "The workshop at night.",
    renditions: [
      rendition("16:9", "h".repeat(64)),
      rendition("9:16", "i".repeat(64)),
      rendition("1:1", "j".repeat(64)),
    ],
    ...over,
  });

const scene = (over: Partial<AssetView> = {}): AssetView =>
  asset({
    assetId: "scene-1",
    role: "main-video",
    medium: "video",
    durationSeconds: 610,
    transcript: "Every word of it.",
    altText: null,
    ...over,
  });

const serial = (over: Partial<SerialView> = {}): SerialView => ({
  serialId: "serial-1",
  revisionId: "rev-s",
  name: "How I work",
  premise: "A working diary.",
  ordered: true,
  state: "running",
  openingDocumentId: null,
  coverAssetId: null,
  ...over,
});

const front = (over: Partial<Front> = {}): Front => ({
  channel: "homepage",
  headline: "Everything that happened this week",
  line: "A drama about the work.",
  heroAsset: "hero",
  flagshipEpisode: "episode-1",
  flagshipScene: "scene-1",
  entrySerial: "serial-1",
  wall: [],
  ...over,
});

const frontSubmission = (over: Partial<FrontSubmission> = {}): FrontSubmission => ({
  front: front(),
  hero: heroAsset(),
  flagship: episode({ assets: [teaserAsset(), scene()] }),
  entrySerial: serial(),
  referenced: new Map([
    ["episode-1", binding()],
    ["serial-1", binding({ recordId: "serial-1", recordKind: "serial", slug: "how-i-work" })],
  ]),
  published: new Set(["episode-1", "serial-1"]),
  ...over,
});

const frontRefusals = (over: Partial<FrontSubmission> = {}): readonly string[] => {
  const projected = projectFront(frontSubmission(over));
  return projected.ok ? [] : projected.refusals.map((refusal) => refusal.rule);
};

describe("Projecting a front", () => {
  it("Given a complete front, Then it becomes homepage's site document", () => {
    const projected = projectFront(frontSubmission());
    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    expect(projected.document).toMatchObject({
      hero: {
        headline: "Everything that happened this week",
        line: "A drama about the work.",
        media: { wide: "h".repeat(64), alt: "The workshop at night." },
        flagship: { episode: "the-interview", scene: "scene-1" },
      },
      entrySerial: "how-i-work",
      wall: [],
    });
  });

  it("Given a wall, Then it carries the addresses in the order it was authored", () => {
    const projected = projectFront(
      frontSubmission({
        front: front({ wall: ["episode-2", "episode-1"] }),
        referenced: new Map([
          ["episode-1", binding()],
          ["episode-2", binding({ recordId: "episode-2", slug: "the-second" })],
          ["serial-1", binding({ recordId: "serial-1", recordKind: "serial", slug: "how-i-work" })],
        ]),
        published: new Set(["episode-1", "episode-2", "serial-1"]),
      }),
    );
    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    expect(projected.document.wall).toEqual(["the-second", "the-interview"]);
  });

  it("Given a front with nothing written, Then every missing part is named at once", () => {
    expect(
      frontRefusals({
        front: front({
          headline: null,
          line: null,
          heroAsset: null,
          flagshipEpisode: null,
          flagshipScene: null,
          entrySerial: null,
        }),
        hero: null,
        flagship: null,
        entrySerial: null,
      }),
    ).toEqual(
      expect.arrayContaining([
        "headlineRequired",
        "lineRequired",
        "heroRequired",
        "frontIsIncomplete",
      ]),
    );
  });

  it("Given a hero that is not an image, Then it is refused, because the hero never loops", () => {
    expect(frontRefusals({ hero: heroAsset({ medium: "video" }) })).toContain(
      "heroIsAnImage",
    );
  });

  it("Given a hero missing a format, Then the missing one is named", () => {
    expect(
      frontRefusals({
        hero: heroAsset({ renditions: [rendition("16:9", "h".repeat(64))] }),
      }),
    ).toContain("heroFormatMissing");
  });

  it("Given a hero with no alt text, Then it is refused", () => {
    expect(frontRefusals({ hero: heroAsset({ altText: null }) })).toContain(
      "heroNeedsAltText",
    );
  });

  it("Given a flagship that is bound but not live there, Then it is refused", () => {
    expect(frontRefusals({ published: new Set(["serial-1"]) })).toContain(
      "unpublishedReference",
    );
  });

  it("Given an unordered entry serial, Then it is refused, because the left door leads to a beginning", () => {
    expect(frontRefusals({ entrySerial: serial({ ordered: false }) })).toContain(
      "entrySerialIsOrdered",
    );
  });

  it("Given a flagship scene the episode does not hold, Then it is refused", () => {
    expect(frontRefusals({ front: front({ flagshipScene: "elsewhere" }) })).toContain(
      "flagshipSceneNotHeld",
    );
  });

  it("Given a flagship scene that is a still, Then it is refused, because homepage does not slot it as a scene", () => {
    expect(
      frontRefusals({
        front: front({ flagshipScene: "still-1" }),
        flagship: episode({
          assets: [teaserAsset(), asset({ assetId: "still-1", role: "statement" })],
        }),
      }),
    ).toContain("flagshipSceneIsAScene");
  });

  it("Given the episode's teaser named as the flagship scene, Then it is refused", () => {
    expect(
      frontRefusals({
        front: front({ flagshipScene: "teaser" }),
      }),
    ).toContain("flagshipSceneIsAScene");
  });
});
