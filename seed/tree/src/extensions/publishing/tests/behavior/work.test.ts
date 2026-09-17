import { describe, expect, it } from "vitest";

import { readGraphEnv } from "~/server/ccgw/env";
import { readDocument } from "~/extensions/documents/server/documents";
import type { GraphOutcome } from "~/server/outcome";
import { createDeliverable, deleteDeliverable, listDeliverables, placeDeliverable, placeItem, readDeliverable, release } from "../../server/deliverables";
import { addExport, createProseItem, deleteItem, ingestItem, listStanding, readItem, reviseItem } from "../../server/items";
import { addPart, createShape, deleteShape, readShape, removePart, reorderPart, retitleShape, revisePart } from "../../server/shapes";
import { mp4, png } from "./media";

/**
 * The work layer over a real CCGW and a real kernel with its blob store, run
 * by the repository's kernel harness against a scratch graph seeded with
 * this extension's members: shapes composed and nested with every refusal,
 * ingest landing bytes as a referenced blob and read back, the same bytes
 * twice as one object, an unreadable file refused with nothing stored, a
 * replacement export superseding the first, a prose item's document,
 * placement with its rules, standing and gathered listings, and the deletes
 * that refuse while something points at what is deleted. PU_0002_007
 */

const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();

const success = <T>(outcome: GraphOutcome<T>): T => {
  expect(outcome, JSON.stringify(outcome)).toMatchObject({ outcome: "success" });
  if (outcome.outcome !== "success") throw new Error("unreachable");
  return outcome.result;
};

const refused = <T>(outcome: GraphOutcome<T>, rule: string): void => {
  expect(outcome, JSON.stringify(outcome)).toMatchObject({ outcome: "validationFailure" });
  if (outcome.outcome === "validationFailure") expect(outcome.failures[0].rule).toBe(rule);
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 320));

describe.skipIf(!configured)("the work layer", () => {
  const ids = { episode: "", series: "", main: "", still: "", notes: "", teaser: "", episodes: "", e1: "", s1: "", pngItem: "", mp4Item: "", prose: "" };

  it("Given a shape, Then parts are added in order, revised, reordered and one is removed; a nested shape refuses a cycle", async () => {
    ids.episode = success(await createShape({ title: "Episode" })).shapeId;
    ids.main = success(await addPart({ shapeId: ids.episode, part: { title: "Main video", class: "video", cardinality: "some", role: "main-video", constraints: { aspect: "9:16", maxDurationSeconds: 90 } } })).partId;
    await settle();
    ids.still = success(await addPart({ shapeId: ids.episode, part: { title: "Still", class: "image", cardinality: "any" } })).partId;
    await settle();
    ids.notes = success(await addPart({ shapeId: ids.episode, part: { title: "Field note", class: "prose", cardinality: "optional" } })).partId;
    await settle();
    ids.teaser = success(await addPart({ shapeId: ids.episode, part: { title: "Teaser", class: "image", cardinality: "one" } })).partId;
    await settle();
    const extra = success(await addPart({ shapeId: ids.episode, part: { title: "Extra", class: "file", cardinality: "any" } })).partId;
    await settle();

    refused(await addPart({ shapeId: ids.episode, part: { title: "", class: "video", cardinality: "any" } }), "partShape");
    refused(await addPart({ shapeId: ids.episode, part: { title: "Bad", class: "movie", cardinality: "any" } }), "partShape");
    refused(await addPart({ shapeId: ids.episode, part: { title: "Self", class: "shape", cardinality: "any", shape: ids.episode } }), "nestsItself");

    let shape = success(await readShape(ids.episode));
    expect(shape.parts.map((part) => part.title)).toEqual(["Main video", "Still", "Field note", "Teaser", "Extra"]);
    expect(shape.parts[0]).toMatchObject({ class: "video", cardinality: "some", role: "main-video", constraints: { aspect: "9:16", maxDurationSeconds: 90 } });

    success(await reorderPart({ shapeId: ids.episode, partId: ids.teaser, before: ids.main }));
    await settle();
    success(await revisePart({ shapeId: ids.episode, partId: ids.still, title: "Cinematic still", constraints: { minWidth: 1000 } }));
    await settle();
    success(await removePart({ shapeId: ids.episode, partId: extra }));
    await settle();
    shape = success(await readShape(ids.episode));
    expect(shape.parts.map((part) => part.title)).toEqual(["Teaser", "Main video", "Cinematic still", "Field note"]);
    expect(shape.parts[2]?.constraints).toEqual({ minWidth: 1000 });

    success(await retitleShape({ shapeId: ids.episode, title: "Episode (v2)" }));
    await settle();

    ids.series = success(await createShape({ title: "Series" })).shapeId;
    ids.episodes = success(await addPart({ shapeId: ids.series, part: { title: "Episodes", class: "shape", cardinality: "any", shape: ids.episode } })).partId;
    await settle();
    refused(await addPart({ shapeId: ids.episode, part: { title: "Back", class: "shape", cardinality: "any", shape: ids.series } }), "nestsItself");
    const series = success(await readShape(ids.series));
    expect(series.parts[0]).toMatchObject({ class: "shape", shape: ids.episode, shapeTitle: "Episode (v2)" });
    const episode = success(await readShape(ids.episode));
    expect(episode.nestedIn.map((found) => found.title)).toEqual(["Series"]);
  });

  it("Given files, Then ingest reads their facts, stores the bytes once, refuses the unreadable, and a prose item gets a document", async () => {
    const still = success(await ingestItem({ bytes: png(1920, 1080), mediaType: "image/png", filename: "key-art.png", label: "Key art" }));
    ids.pngItem = still.itemId;
    let item = success(await readItem(ids.pngItem));
    expect(item).toMatchObject({ class: "image", label: "Key art", width: 1920, height: 1080, synthetic: false });
    expect(item.exports).toHaveLength(1);
    expect(item.exports[0]).toMatchObject({ mediaType: "image/png", width: 1920, height: 1080, aspect: "16:9", provenance: "ingested" });
    expect(item.exports[0]?.hash.startsWith("sha256:")).toBe(true);

    // The same bytes twice land as one object: the second export names the first's hash.
    await settle();
    const again = success(await addExport({ itemId: ids.pngItem, bytes: png(1920, 1080), mediaType: "image/png" }));
    await settle();
    item = success(await readItem(ids.pngItem));
    expect(item.exports).toHaveLength(2);
    expect(new Set(item.exports.map((found) => found.hash)).size).toBe(1);

    // A replacement keeps the old export and closes the item's relation to it.
    const replacement = success(await addExport({ itemId: ids.pngItem, bytes: png(1080, 1920, 7), mediaType: "image/png", replaces: again.exportId }));
    await settle();
    item = success(await readItem(ids.pngItem));
    expect(item.exports.map((found) => found.exportId)).toContain(replacement.exportId);
    expect(item.exports.map((found) => found.exportId)).not.toContain(again.exportId);
    expect(item.exports.find((found) => found.exportId === replacement.exportId)?.aspect).toBe("9:16");

    refused(await ingestItem({ bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]), mediaType: "image/png", class: "image" }), "unreadableMedia");
    refused(await ingestItem({ bytes: png(10, 10), mediaType: "image/png", class: "video" }), "notAVideo");
    refused(await ingestItem({ bytes: new Uint8Array(0), mediaType: "application/pdf", class: "file" }), "emptyFile");

    const clip = success(await ingestItem({ bytes: mp4({ width: 1080, height: 1920, seconds: 60 }), mediaType: "video/mp4", filename: "main.mp4" }));
    ids.mp4Item = clip.itemId;
    const video = success(await readItem(ids.mp4Item));
    expect(video).toMatchObject({ class: "video", label: "main.mp4", durationSeconds: 60, width: 1080, height: 1920 });

    const prose = success(await createProseItem({ label: "Field note one" }));
    ids.prose = prose.itemId;
    const read = success(await readItem(ids.prose));
    expect(read.class).toBe("prose");
    expect(read.documentId).toBe(prose.documentId);
    const document = await readDocument(prose.documentId);
    expect(document.outcome).toBe("success");
    if (document.outcome === "success") expect(document.result.title).toBe("Field note one");

    await settle();
    success(await reviseItem({ itemId: ids.pngItem, alt: "The laurel over the city", synthetic: true }));
    await settle();
    item = success(await readItem(ids.pngItem));
    expect(item.alt).toBe("The laurel over the city");
    expect(item.synthetic).toBe(true);

    const standing = success(await listStanding());
    expect(standing.map((found) => found.itemId)).toEqual(expect.arrayContaining([ids.pngItem, ids.mp4Item, ids.prose]));
  });

  it("Given a deliverable, Then items are placed where they fit, refused where they do not, released, and nested deliverables gathered", async () => {
    ids.e1 = success(await createDeliverable({ shapeId: ids.episode, title: "E1" })).deliverableId;
    refused(await createDeliverable({ shapeId: "no-such-shape", title: "X" }), "unknownShape");
    await settle();

    refused(await placeItem({ deliverableId: ids.e1, partId: ids.main, itemId: ids.pngItem }), "doesNotFit");
    success(await placeItem({ deliverableId: ids.e1, partId: ids.still, itemId: ids.pngItem }));
    await settle();
    success(await placeItem({ deliverableId: ids.e1, partId: ids.teaser, itemId: ids.pngItem }));
    await settle();
    refused(await placeItem({ deliverableId: ids.e1, partId: ids.teaser, itemId: ids.pngItem }), "alreadyPlaced");
    success(await placeItem({ deliverableId: ids.e1, partId: ids.main, itemId: ids.mp4Item }));
    await settle();
    success(await placeItem({ deliverableId: ids.e1, partId: ids.notes, itemId: ids.prose }));
    await settle();

    // A second teaser is refused by cardinality; a long video by the duration limit.
    const second = success(await ingestItem({ bytes: png(500, 500, 3), mediaType: "image/png", label: "Second" }));
    refused(await placeItem({ deliverableId: ids.e1, partId: ids.teaser, itemId: second.itemId }), "doesNotFit");
    const long = success(await ingestItem({ bytes: mp4({ width: 1080, height: 1920, seconds: 200 }), mediaType: "video/mp4", label: "Long" }));
    const tooLong = await placeItem({ deliverableId: ids.e1, partId: ids.main, itemId: long.itemId });
    refused(tooLong, "doesNotFit");
    if (tooLong.outcome === "validationFailure") expect(tooLong.failures[0].detail).toContain("limits the duration to 90s");

    let e1 = success(await readDeliverable(ids.e1));
    const filled = Object.fromEntries(e1.parts.map((part) => [part.part.title, part.items.map((item) => item.itemId)]));
    expect(filled).toEqual({ Teaser: [ids.pngItem], "Main video": [ids.mp4Item], "Cinematic still": [ids.pngItem], "Field note": [ids.prose] });
    expect(e1.candidates.map((item) => item.itemId)).toEqual(expect.arrayContaining([second.itemId, long.itemId]));
    expect(e1.candidates.map((item) => item.itemId)).not.toContain(ids.pngItem);

    const standing = success(await listStanding());
    expect(standing.map((found) => found.itemId)).not.toContain(ids.pngItem);
    expect(standing.map((found) => found.itemId)).toContain(second.itemId);
    const gathered = success(await readItem(ids.pngItem));
    expect(gathered.gatheredBy.map((found) => found.title)).toEqual(["E1"]);

    refused(await deleteItem({ itemId: ids.pngItem, baseRevisionId: gathered.revisionId }), "itemGathered");
    refused(await deleteShape({ shapeId: ids.episode, baseRevisionId: success(await readShape(ids.episode)).revisionId }), "shapeInUse");
    refused(await removePart({ shapeId: ids.episode, partId: ids.still }), "partFilled");

    success(await release({ deliverableId: ids.e1, partId: ids.still, memberId: ids.pngItem }));
    await settle();
    e1 = success(await readDeliverable(ids.e1));
    expect(e1.parts.find((part) => part.part.title === "Cinematic still")?.items).toEqual([]);
    // Released from one part, the item still fills the other and is still gathered.
    expect(e1.parts.find((part) => part.part.title === "Teaser")?.items.map((item) => item.itemId)).toEqual([]);

    ids.s1 = success(await createDeliverable({ shapeId: ids.series, title: "Season 1" })).deliverableId;
    await settle();
    success(await placeDeliverable({ deliverableId: ids.s1, partId: ids.episodes, innerId: ids.e1 }));
    await settle();
    refused(await placeDeliverable({ deliverableId: ids.s1, partId: ids.episodes, innerId: ids.s1 }), "gathersItself");
    const s1 = success(await readDeliverable(ids.s1));
    expect(s1.parts[0]?.deliverables.map((found) => found.title)).toEqual(["E1"]);

    const listing = success(await listDeliverables());
    expect(listing.groups.map((group) => [group.shape.title, group.deliverables.map((found) => found.title)])).toEqual(
      expect.arrayContaining([
        ["Episode (v2)", ["E1"]],
        ["Series", ["Season 1"]],
      ]),
    );
  });

  it("Given the deliverables deleted, Then what they gathered stands again and the shape can go once nothing is shaped by it", async () => {
    let s1 = success(await readDeliverable(ids.s1));
    success(await deleteDeliverable({ deliverableId: ids.s1, baseRevisionId: s1.revisionId }));
    let e1 = success(await readDeliverable(ids.e1));
    success(await deleteDeliverable({ deliverableId: ids.e1, baseRevisionId: e1.revisionId }));
    await settle();
    const standing = success(await listStanding());
    expect(standing.map((found) => found.itemId)).toEqual(expect.arrayContaining([ids.pngItem, ids.mp4Item, ids.prose]));
    const item = success(await readItem(ids.pngItem));
    success(await deleteItem({ itemId: ids.pngItem, baseRevisionId: item.revisionId }));
    expect((await readItem(ids.pngItem)).outcome).toBe("noResult");

    const series = success(await readShape(ids.series));
    refused(await deleteShape({ shapeId: ids.episode, baseRevisionId: success(await readShape(ids.episode)).revisionId }), "shapeNested");
    success(await deleteShape({ shapeId: ids.series, baseRevisionId: series.revisionId }));
    await settle();
    const episode = success(await readShape(ids.episode));
    success(await deleteShape({ shapeId: ids.episode, baseRevisionId: episode.revisionId }));
    expect((await readShape(ids.episode)).outcome).toBe("noResult");
  });
});
