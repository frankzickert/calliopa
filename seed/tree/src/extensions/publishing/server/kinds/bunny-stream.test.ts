import { describe, expect, it } from "vitest";

import type { ItemView } from "../../lib/work";
import type { Transport } from "./contract";
import { MAX_UPLOAD_BYTES, bunnyStream, deliverVideo, projectVideo, retireVideo, takesItemsOf } from "./bunny-stream";
import { website } from "./website";

/**
 * The Bunny Stream kind without Bunny: the projection over an item and every
 * refusal, and the two calls over a recording transport. PU_0004_001
 */

const video = (over: Partial<ItemView> = {}): ItemView => ({
  itemId: "clip",
  class: "video",
  label: "Main",
  durationSeconds: 45,
  width: 1080,
  height: 1920,
  exportCount: 1,
  revisionId: "rev",
  synthetic: false,
  transcript: "",
  alt: "",
  exports: [{ exportId: "clip-0", hash: "sha256:clip", mediaType: "video/mp4", size: 1024, width: 1080, height: 1920, aspect: "9:16", provenance: "ingested" }],
  documentId: null,
  gatheredBy: [],
  ...over,
});

const rules = (found: ReturnType<typeof projectVideo>): string[] => (found.ok ? [] : found.refusals.map((refusal) => refusal.rule));

describe("projecting a video for Bunny", () => {
  it("Given a video with an export and a title, Then the first export goes under the title", () => {
    const projected = projectVideo({ item: video(), title: "E1 — Main video" });
    expect(projected.ok).toBe(true);
    if (projected.ok) expect(projected.document).toMatchObject({ itemId: "clip", title: "E1 — Main video", export: { exportId: "clip-0" } });
  });

  it("Given an image, no export, or an export the broker cannot carry, Then each is refused by name", () => {
    expect(rules(projectVideo({ item: video({ class: "image" }), title: "x" }))).toEqual(["notAVideo"]);
    expect(rules(projectVideo({ item: video({ exports: [] }), title: "x" }))).toEqual(["noExport"]);
    const big = video({ exports: [{ exportId: "clip-0", hash: "sha256:clip", mediaType: "video/mp4", size: MAX_UPLOAD_BYTES + 1, width: 1080, height: 1920, aspect: "9:16", provenance: "ingested" }] });
    expect(rules(projectVideo({ item: big, title: "x" }))).toEqual(["tooLargeToBroker"]);
    expect(rules(projectVideo({ item: video(), title: "  " }))).toEqual(["titleRequired"]);
  });
});

interface Sent {
  readonly method: string;
  readonly path: string;
  readonly body?: unknown;
  readonly bytes?: Uint8Array;
}

const recording = (answers: readonly { status: number; text: string }[]): { transport: Transport; sent: Sent[] } => {
  const sent: Sent[] = [];
  let at = 0;
  return {
    sent,
    transport: {
      send: async (_party, input) => {
        sent.push({ method: input.method, path: input.path, ...(input.body === undefined ? {} : { body: input.body }), ...(input.bytes === undefined ? {} : { bytes: input.bytes }) });
        return answers[at++] ?? { status: 500, text: "" };
      },
    },
  };
};

describe("delivering to Bunny", () => {
  const upload = { itemId: "clip", title: "E1 — Main video", export: video().exports[0]! };

  it("Given Bunny answering a guid and then success, Then the create carries the title, the put carries the bytes, and the guid is the id", async () => {
    const { transport, sent } = recording([{ status: 200, text: JSON.stringify({ guid: "g-1", title: "E1 — Main video" }) }, { status: 200, text: JSON.stringify({ success: true, statusCode: 200 }) }]);
    const delivered = await deliverVideo(transport, "p", upload, async () => new Uint8Array([1, 2, 3]));
    expect(delivered).toEqual({ ok: true, externalId: "g-1", externalAddress: "/videos/g-1" });
    expect(sent[0]).toMatchObject({ method: "POST", path: "/videos", body: { title: "E1 — Main video" } });
    expect(sent[1]).toMatchObject({ method: "PUT", path: "/videos/g-1" });
    expect(sent[1]?.bytes).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("Given a refused key, a create without a guid, or a put answering HTML, Then the failure carries Bunny's words and nothing more is sent", async () => {
    const refused = await deliverVideo(recording([{ status: 401, text: JSON.stringify({ success: false, message: "Unauthorized" }) }]).transport, "p", upload, async () => new Uint8Array());
    expect(refused).toMatchObject({ ok: false, detail: expect.stringContaining("401: Unauthorized") });
    const noGuid = recording([{ status: 200, text: JSON.stringify({ title: "x" }) }]);
    expect(await deliverVideo(noGuid.transport, "p", upload, async () => new Uint8Array())).toMatchObject({ ok: false });
    expect(noGuid.sent).toHaveLength(1);
    const html = recording([{ status: 200, text: JSON.stringify({ guid: "g-2" }) }, { status: 200, text: "<html>restarting</html>" }]);
    expect(await deliverVideo(html.transport, "p", upload, async () => new Uint8Array())).toMatchObject({ ok: false, detail: expect.stringContaining("Uploading") });
  });

  it("Given a retirement, Then it is a delete on the video", async () => {
    const { transport, sent } = recording([{ status: 200, text: JSON.stringify({ success: true }) }]);
    expect(await retireVideo(transport, "p", "g-1")).toMatchObject({ ok: true, externalId: "g-1" });
    expect(sent[0]).toMatchObject({ method: "DELETE", path: "/videos/g-1" });
  });
});

describe("the kind's descriptor", () => {
  it("Given the descriptor, Then it takes items of class video, presents the key as AccessKey and probes the library", () => {
    expect(takesItemsOf(bunnyStream, "video")).toBe(true);
    expect(takesItemsOf(bunnyStream, "image")).toBe(false);
    expect(takesItemsOf(website, "video")).toBe(false);
    expect(bunnyStream.authorization).toEqual({ header: "AccessKey", scheme: "", secretField: "apiKey" });
    expect(bunnyStream.probe.url).toBe("{configuration.address}/videos?itemsPerPage=1");
  });
});
