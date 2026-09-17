import type { ExportView, ItemView } from "../../lib/work";
import { Refusals, type Kind, type Projected, type Transport } from "./contract";

/**
 * Bunny Stream: a video library as a channel of its own, taking video items.
 * Its configuration is the library's address at Bunny —
 * `https://video.bunnycdn.com/library/<numeric id>` — so the kind's paths sit
 * under it the way a website's sit under its address, and the kernel's
 * broker needs no fixed address written beside the fields. The key travels
 * as Bunny's own `AccessKey` header; the probe lists one video of the
 * library, the smallest authenticated call and one that changes nothing.
 * PU_0004_001
 */

/** What the kernel's broker takes in one JSON body; the bytes travel base64 inside it. */
export const BROKER_BODY_LIMIT = 512 * 1024 * 1024;

/** The largest export the broker can carry: base64 grows bytes by a third, and the envelope takes a little. */
export const MAX_UPLOAD_BYTES = Math.floor((BROKER_BODY_LIMIT * 3) / 4) - 1024 * 1024;

export interface VideoSubmission {
  readonly item: ItemView;
  /** What Bunny shows: the deliverable's title with the part's, or the item's label alone. */
  readonly title: string;
}

export interface VideoUpload {
  readonly itemId: string;
  readonly title: string;
  readonly export: ExportView;
}

/**
 * The projection: which bytes go to Bunny under which title, or every rule
 * broken — the item is not a video, it has no export, its export is larger
 * than the broker carries. The first export is the rendition that goes: a
 * video item's exports are one video in its renditions, and the ingested
 * one comes first.
 */
export function projectVideo(submission: VideoSubmission): Projected<VideoUpload> {
  const refusals = new Refusals();
  const item = submission.item;
  const label = item.label || "this item";
  if (item.class !== "video") refusals.refuse("notAVideo", `Bunny Stream takes video, and ${label} is ${item.class}.`);
  const first = item.exports[0];
  if (first === undefined) refusals.refuse("noExport", `${label} has no export to upload.`);
  else if (first.size > MAX_UPLOAD_BYTES) {
    refusals.refuse("tooLargeToBroker", `${label} is ${Math.round(first.size / 1048576)} MB, and the kernel's broker carries at most ${Math.floor(MAX_UPLOAD_BYTES / 1048576)} MB in one request; a streamed upload arrives with BO_0252.`);
  }
  const title = submission.title.trim();
  if (title === "") refusals.refuse("titleRequired", "Bunny shows a title, and there is none.");
  if (refusals.any || first === undefined) return { ok: false, refusals: refusals.refusals };
  return { ok: true, document: { itemId: item.itemId, title, export: first } };
}

export type Delivered = { readonly ok: true; readonly externalId: string; readonly externalAddress: string } | { readonly ok: false; readonly detail: string };

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

const refusalOf = (status: number, body: unknown, text: string): string => {
  const message = (body as { message?: unknown } | null)?.message;
  return typeof message === "string" ? `${status}: ${message}` : `${status}: ${text.slice(0, 200)}`;
};

/**
 * The two calls the Stream API takes: create the video under its title,
 * answering the guid, then put the bytes to it. A `2xx` that is not Bunny's
 * JSON is a failure. The address the paths sit under is the library's.
 */
export async function deliverVideo(transport: Transport, party: string, upload: VideoUpload, bytesOf: (hash: string) => Promise<Uint8Array>, onStep: (step: string) => Promise<void> = async () => undefined): Promise<Delivered> {
  await onStep(`creating ${upload.title} at Bunny`);
  let created: { status: number; text: string };
  try {
    created = await transport.send(party, { method: "POST", path: "/videos", body: { title: upload.title }, contentType: "application/json" });
  } catch (error) {
    return { ok: false, detail: `Creating ${upload.title} at Bunny did not reach it: ${error instanceof Error ? error.message : String(error)}` };
  }
  const answer = parse(created.text) as { guid?: unknown } | null | undefined;
  if (created.status < 200 || created.status >= 300 || answer === undefined || answer === null || typeof answer.guid !== "string" || answer.guid === "") {
    return { ok: false, detail: `Creating ${upload.title} at Bunny: ${refusalOf(created.status, answer, created.text)}` };
  }
  const guid = answer.guid;
  await onStep(`uploading ${Math.max(1, Math.round(upload.export.size / 1048576))} MB to Bunny`);
  const bytes = await bytesOf(upload.export.hash);
  let uploaded: { status: number; text: string };
  try {
    uploaded = await transport.send(party, { method: "PUT", path: `/videos/${guid}`, bytes, contentType: "application/octet-stream" });
  } catch (error) {
    return { ok: false, detail: `Uploading ${upload.title} to Bunny did not reach it: ${error instanceof Error ? error.message : String(error)}` };
  }
  const body = parse(uploaded.text);
  if (uploaded.status < 200 || uploaded.status >= 300 || body === undefined || body === null) {
    return { ok: false, detail: `Uploading ${upload.title} to Bunny: ${refusalOf(uploaded.status, body, uploaded.text)}` };
  }
  return { ok: true, externalId: guid, externalAddress: `/videos/${guid}` };
}

/** Retires a video at Bunny: `DELETE` on it. */
export async function retireVideo(transport: Transport, party: string, guid: string): Promise<Delivered> {
  let answer: { status: number; text: string };
  try {
    answer = await transport.send(party, { method: "DELETE", path: `/videos/${guid}` });
  } catch (error) {
    return { ok: false, detail: `Retiring ${guid} at Bunny did not reach it: ${error instanceof Error ? error.message : String(error)}` };
  }
  const body = parse(answer.text);
  if (answer.status < 200 || answer.status >= 300 || body === undefined) {
    return { ok: false, detail: `Retiring ${guid} at Bunny: ${refusalOf(answer.status, body, answer.text)}` };
  }
  return { ok: true, externalId: guid, externalAddress: `/videos/${guid}` };
}

export const bunnyStream: Kind = {
  id: "bunny-stream",
  label: "Bunny Stream",
  purpose: "The video host a website's video slots name: a Bunny Stream library the videos are uploaded to",
  credential: "apiKey",
  fields: [
    {
      key: "address",
      label: "Library",
      hint: "The library's address at Bunny Stream, for example https://video.bunnycdn.com/library/512345",
      check: "address",
    },
  ],
  authorization: { header: "AccessKey", scheme: "", secretField: "apiKey" },
  probe: { method: "GET", url: "{configuration.address}/videos?itemsPerPage=1", expectStatus: 200 },
  offer: { fixed: [{ key: "video", title: "Video", class: "video", required: true, aspect: null, formats: [], maxLength: null, maxCount: 1, maxDurationSeconds: null }] },
  units: ["item"],
  acts: ["publish", "retire"],
  publish: {
    project: (submission) => projectVideo(submission as VideoSubmission),
    deliver: (transport, party, document) => deliverVideo(transport, party, document as VideoUpload, async () => new Uint8Array()),
  },
};

/** Whether a kind takes items of a class — the test a video slot's host must pass. */
export const takesItemsOf = (kind: Kind, cls: string): boolean => kind.units.includes("item") && "fixed" in kind.offer && kind.offer.fixed.some((slot) => slot.class === cls);
