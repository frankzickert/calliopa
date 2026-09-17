import { describe, expect, it } from "vitest";

import type { DocumentView } from "~/extensions/documents/server/assemble";
import type { IndexContainer, IndexSlot } from "../../lib/content-index";
import type { BindingView, DeliverableView, ItemView } from "../../lib/work";
import { projectContainer, underAddress, type ContainerSubmission } from "./website";

/**
 * The website kind's projection over records, without a site: the container
 * document it answers, and every rule it refuses — a missing address, a
 * required field or slot left empty, a video with no host id, a crop
 * missing, an entry naming nothing, a reference to an unpublished gatherer,
 * a block the site does not take. PU_0003_004
 */

const container: IndexContainer = {
  key: "episodes",
  title: "Episode",
  description: "",
  route: "/episodes/{slug}",
  fields: [
    { key: "title", title: "Title", type: "line", container: null, slot: null, many: false, required: true },
    { key: "premise", title: "Premise", type: "line", container: null, slot: null, many: false, required: false },
    { key: "home_serial", title: "Home serial", type: "reference", container: "serials", slot: null, many: false, required: false },
    { key: "card_scene", title: "Card scene", type: "entry", container: null, slot: "scene", many: false, required: false },
  ],
};

const slots: IndexSlot[] = [
  { key: "scene", title: "Scene", description: "", class: "video", container: "episodes", required: false, aspect: null, aspects: [], fields: [{ key: "transcript", title: "Transcript", type: "text", container: null, slot: null, many: false, required: true }], formats: [], maxLength: null, maxCount: null, maxDurationSeconds: null },
  { key: "still", title: "Still", description: "", class: "image", container: "episodes", required: false, aspect: null, aspects: [], fields: [{ key: "alt", title: "Alt", type: "line", container: null, slot: null, many: false, required: true }], formats: [], maxLength: null, maxCount: null, maxDurationSeconds: null },
  { key: "teaser", title: "Teaser", description: "", class: "image", container: "episodes", required: true, aspect: null, aspects: ["16:9", "9:16"], fields: [], formats: [], maxLength: null, maxCount: 1, maxDurationSeconds: null },
  { key: "prose", title: "Prose", description: "", class: "prose", container: "episodes", required: false, aspect: null, aspects: [], fields: [], formats: [], maxLength: null, maxCount: null, maxDurationSeconds: null },
];

const part = (partId: string, title: string, cls: "video" | "image" | "prose") => ({ partId, title, class: cls, cardinality: "any" as const, role: "", constraints: {}, order: partId, shape: null, shapeTitle: null });

const image = (itemId: string, exports: readonly [number, number][], alt = "A picture"): ItemView => ({
  itemId,
  class: "image",
  label: itemId,
  durationSeconds: null,
  width: exports[0]?.[0] ?? null,
  height: exports[0]?.[1] ?? null,
  exportCount: exports.length,
  revisionId: "rev",
  synthetic: false,
  transcript: "",
  alt,
  exports: exports.map(([width, height], at) => ({ exportId: `${itemId}-${at}`, hash: `sha256:${itemId}${at}`.padEnd(71, "0"), mediaType: "image/png", size: 10, width, height, aspect: null, provenance: "ingested" as const })),
  documentId: null,
  gatheredBy: [],
});

const video = (itemId: string, transcript = "Words"): ItemView => ({
  ...image(itemId, [[1080, 1920]]),
  class: "video",
  durationSeconds: 60,
  transcript,
  exports: [{ exportId: `${itemId}-0`, hash: `sha256:${itemId}`.padEnd(71, "1"), mediaType: "video/mp4", size: 10, width: 1080, height: 1920, aspect: "9:16", provenance: "ingested" }],
});

const prose = (itemId: string, documentId: string): ItemView => ({ ...image(itemId, []), class: "prose", exports: [], documentId });

const summary = (item: ItemView) => ({ itemId: item.itemId, class: item.class, label: item.label, durationSeconds: item.durationSeconds, width: item.width, height: item.height, exportCount: item.exportCount });

const deliverable = (filled: { part: ReturnType<typeof part>; items: ItemView[] }[]): DeliverableView => ({
  deliverableId: "d-1",
  title: "E1",
  shapeId: "s-1",
  shapeTitle: "Episode",
  revisionId: "rev",
  parts: filled.map((entry) => ({ part: entry.part, items: entry.items.map(summary), deliverables: [] })),
  candidates: [],
});

const binding = (over: Partial<BindingView> = {}): BindingView => ({ bindingId: "b", recordId: "d-1", recordKind: "deliverable", channel: "c-1", address: "e1", number: null, fields: { title: "Episode one" }, disclosure: null, addressSettled: false, ...over });

const document = (documentId: string): DocumentView => ({
  documentId,
  revisionId: "rev",
  title: "Notes",
  blocks: [
    { kind: "text", blockId: "b1", revisionId: "r", containmentId: "c", order: "1", role: "h2", runs: [{ text: "Field note" }], standing: "neutral" },
    { kind: "text", blockId: "b2", revisionId: "r", containmentId: "c", order: "2", role: "paragraph", runs: [{ text: "The ", marks: [] }, { text: "point", marks: ["bold"] }], standing: "neutral" },
    { kind: "divider", blockId: "b3", revisionId: "r", containmentId: "c", order: "3" },
  ],
} as unknown as DocumentView);

const submission = (over: Partial<ContainerSubmission> = {}): ContainerSubmission => {
  const teaser = image("teaser", [[1920, 1080], [1080, 1920]]);
  const still = image("still", [[1600, 900]]);
  const clip = video("clip");
  const note = prose("note", "doc-1");
  return {
    container,
    slots,
    assignment: { container: "episodes", parts: [{ part: "p-scene", slot: "scene", host: "c-bunny" }, { part: "p-still", slot: "still", host: null }, { part: "p-teaser", slot: "teaser", host: null }, { part: "p-prose", slot: "prose", host: null }] },
    deliverable: deliverable([
      { part: part("p-scene", "Main video", "video"), items: [clip] },
      { part: part("p-still", "Still", "image"), items: [still] },
      { part: part("p-teaser", "Teaser", "image"), items: [teaser] },
      { part: part("p-prose", "Field note", "prose"), items: [note] },
    ]),
    binding: binding(),
    items: new Map([teaser, still, clip, note].map((item) => [item.itemId, item])),
    documents: new Map([["doc-1", document("doc-1")]]),
    gatherers: [{ container: "serials", address: "season-1", published: true }],
    hosts: new Map([["clip", "bunny-guid-1"]]),
    hostNames: new Map([["clip", "Bunny"]]),
    ...over,
  };
};

const rules = (found: ReturnType<typeof projectContainer>): string[] => (found.ok ? [] : found.refusals.map((refusal) => refusal.rule));

describe("projecting a container document", () => {
  it("Given a complete deliverable, Then the document carries the route, the fields, every slot entry by class, and the objects to declare", () => {
    const projected = projectContainer(submission());
    expect(projected.ok, JSON.stringify(projected)).toBe(true);
    if (!projected.ok) return;
    const document = projected.document;
    expect(document.route).toBe("/episodes/e1");
    expect(document.fields).toEqual({ title: "Episode one", home_serial: "season-1" });
    expect(document.slots["scene"]).toEqual([{ id: "clip", fields: { transcript: "Words" }, host: "bunny-guid-1" }]);
    expect(document.slots["still"]?.[0]).toMatchObject({ id: "still", fields: { alt: "A picture" } });
    expect(document.slots["still"]?.[0]?.media).toMatch(/^still0/u);
    expect(document.slots["teaser"]?.[0]?.crops).toEqual({ "16:9": expect.stringMatching(/^teaser0/u), "9:16": expect.stringMatching(/^teaser1/u) });
    expect(document.slots["prose"]?.[0]?.document?.blocks).toEqual([
      { type: "text", role: "h2", runs: [{ text: "Field note" }] },
      { type: "text", runs: [{ text: "The " }, { text: "point", marks: ["bold"] }] },
      { type: "divider" },
    ]);
    expect(document.objects.map((object) => object.objectId).sort()).toEqual(["still0".padEnd(64, "0"), "teaser0".padEnd(64, "0"), "teaser1".padEnd(64, "0")].sort());
  });

  it("Given no address, no title, an empty required slot and no host id, Then every rule is named at once", () => {
    const projected = projectContainer(
      submission({
        binding: binding({ address: null, fields: {} }),
        hosts: new Map(),
        deliverable: deliverable([{ part: part("p-scene", "Main video", "video"), items: [video("clip")] }]),
      }),
    );
    expect(rules(projected)).toEqual(expect.arrayContaining(["addressRequired", "fieldRequired", "slotRequired", "noVideoHost"]));
  });

  it("Given a crop missing, a slot field the item lacks, and an entry naming nothing, Then each is refused", () => {
    const teaser = image("teaser", [[1920, 1080]]);
    const still = image("still", [[1600, 900]], "");
    const projected = projectContainer(
      submission({
        binding: binding({ fields: { title: "Episode one", card_scene: "nope" } }),
        deliverable: deliverable([
          { part: part("p-teaser", "Teaser", "image"), items: [teaser] },
          { part: part("p-still", "Still", "image"), items: [still] },
        ]),
        items: new Map([teaser, still].map((item) => [item.itemId, item])),
      }),
    );
    expect(rules(projected)).toEqual(expect.arrayContaining(["cropMissing", "slotFieldRequired", "entryUnknown"]));
  });

  it("Given a gatherer not yet published at the channel, Then the reference is refused rather than sent", () => {
    const projected = projectContainer(submission({ gatherers: [{ container: "serials", address: "season-1", published: false }] }));
    expect(rules(projected)).toEqual(["referenceUnpublished"]);
  });

  it("Given a typed reference and no gatherer, Then the binding's value is sent", () => {
    const projected = projectContainer(submission({ gatherers: [], binding: binding({ fields: { title: "Episode one", home_serial: "typed-serial" } }) }));
    expect(projected.ok && projected.document.fields["home_serial"]).toBe("typed-serial");
  });

  it("Given a slot taking at most one and two items, Then it is refused naming the count", () => {
    const first = image("t1", [[1920, 1080], [1080, 1920]]);
    const second = image("t2", [[1920, 1080], [1080, 1920]]);
    const projected = projectContainer(
      submission({
        deliverable: deliverable([{ part: part("p-teaser", "Teaser", "image"), items: [first, second] }]),
        items: new Map([first, second].map((item) => [item.itemId, item])),
      }),
    );
    expect(rules(projected)).toEqual(["tooMany"]);
  });

  it("Given a prose body with a block the site does not take, Then it is refused naming the document", () => {
    const note = prose("note", "doc-1");
    const odd = { ...document("doc-1"), blocks: [{ kind: "unsupported", blockId: "x", revisionId: "r", containmentId: "c", order: "1", semanticType: "claim", content: {} }] } as unknown as DocumentView;
    const projected = projectContainer(
      submission({
        deliverable: deliverable([{ part: part("p-prose", "Field note", "prose"), items: [note] }, { part: part("p-teaser", "Teaser", "image"), items: [image("teaser", [[1920, 1080], [1080, 1920]])] }]),
        items: new Map([note, image("teaser", [[1920, 1080], [1080, 1920]])].map((item) => [item.itemId, item])),
        documents: new Map([["doc-1", odd]]),
      }),
    );
    expect(rules(projected)).toEqual(["unsupportedBlock"]);
  });
});

describe("placing a path under the address", () => {
  it("Given an address with a path, with or without its trailing slash, Then the kind's path follows it; at the root or unparseable, the path stands alone", () => {
    expect(underAddress("http://site.example:4460/v1/", "/index")).toBe("/v1/index");
    expect(underAddress("http://site.example:4460/v1", "/media")).toBe("/v1/media");
    expect(underAddress("https://site.example", "/episodes/e1")).toBe("/episodes/e1");
    expect(underAddress("https://site.example/", "/index")).toBe("/index");
    expect(underAddress("not an address", "/index")).toBe("/index");
  });
});
