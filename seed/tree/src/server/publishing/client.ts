import type postgres from "postgres";

import { connectionSecret, readConnection } from "~/extensions/settings/server/connections";

/**
 * The transport half: the only part of a destination that reaches the network.
 *
 * It carries no rule about what may be published. Everything a destination
 * would refuse is refused by its projection before a request is made, so what
 * arrives here is a document already believed good and what comes back is that
 * destination's own verdict on it.
 */

export interface Delivered {
  /** The destination's own id for what it now holds. */
  readonly externalId: string;
}

export type DeliveryOutcome =
  | { readonly ok: true; readonly result: Delivered }
  | { readonly ok: false; readonly detail: string };

export interface ChannelAccess {
  readonly address: string;
  readonly token: string;
}

/**
 * The address and token a channel holds. A channel with either missing is not
 * reachable, and saying which is missing is what tells an operator what to do.
 */
export async function channelAccess(
  db: postgres.Sql,
  key: Buffer,
  party: string,
): Promise<ChannelAccess | { readonly missing: string }> {
  const record = await readConnection(db, party);
  const address = record?.configuration["address"] ?? "";
  if (address === "") return { missing: `${party} holds no address.` };
  const token = await connectionSecret(db, key, party);
  if (token === null) return { missing: `${party} holds no key.` };
  return { address, token };
}

/** One request to a destination, with its refusal reported in its own words. */
async function send(
  access: ChannelAccess,
  path: string,
  init: { readonly method: string; readonly body?: string; readonly bytes?: Uint8Array },
): Promise<{ readonly status: number; readonly body: unknown; readonly text: string }> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${access.token}`,
  };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.bytes !== undefined) headers["content-type"] = "application/octet-stream";

  const payload: BodyInit | null =
    init.body ??
    (init.bytes === undefined
      ? null
      : new Blob([new Uint8Array(init.bytes).slice().buffer as ArrayBuffer]));
  const response = await fetch(new URL(path, access.address), {
    method: init.method,
    headers,
    body: payload,
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text === "" ? null : (JSON.parse(text) as unknown);
  } catch {
    body = null;
  }
  return { status: response.status, body, text };
}

/**
 * A destination's refusal in its own words. Homepage answers one envelope
 * everywhere under `/v1`, so its message is what the log records rather than a
 * status code an author cannot act on.
 */
function refusalText(status: number, body: unknown, text: string): string {
  const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
  if (error?.message !== undefined) {
    return `${status} ${error.code ?? "error"}: ${error.message}`;
  }
  return `${status} ${text.slice(0, 200)}`;
}

/**
 * Whether a response is the API answering at all.
 *
 * A status alone does not say so. An application serving a page for a route it
 * does not have, or an error overlay while it is failing to start, answers 200
 * with HTML — and a publish that read that as success would record a
 * publication nobody performed. Every write here answers JSON, so anything else
 * is a destination that did not do what was asked.
 */
function notTheApi(
  status: number,
  body: unknown,
  text: string,
): string | null {
  if (body !== null && typeof body === "object") return null;
  return (
    `${status} from a destination that did not answer the API. ` +
    `It replied with ${text.trim() === "" ? "an empty body" : "something that is not JSON"}, ` +
    `which usually means the address names something other than the destination, ` +
    `or that the destination is not serving.`
  );
}

/**
 * Puts media at the destination.
 *
 * Declaring first is what makes this cheap: bytes the destination already holds
 * answer that they exist and no upload follows, so a republication of an
 * unchanged episode moves no media at all.
 */
export async function ensureMedia(
  access: ChannelAccess,
  media: {
    readonly objectId: string;
    readonly bytes: Uint8Array;
    readonly contentType: string;
  },
): Promise<DeliveryOutcome> {
  const declared = await send(access, "/v1/media", {
    method: "POST",
    body: JSON.stringify({
      mimeType: media.contentType,
      bytes: media.bytes.byteLength,
      sha256: media.objectId,
    }),
  });
  if (declared.status !== 200 && declared.status !== 201) {
    return { ok: false, detail: refusalText(declared.status, declared.body, declared.text) };
  }
  const declaredStrange = notTheApi(declared.status, declared.body, declared.text);
  if (declaredStrange !== null) return { ok: false, detail: declaredStrange };
  const answer = declared.body as { mediaId?: string; exists?: boolean } | null;
  if (answer?.exists === true) {
    return { ok: true, result: { externalId: answer.mediaId ?? media.objectId } };
  }

  const uploaded = await send(access, `/v1/media/${media.objectId}`, {
    method: "PUT",
    bytes: media.bytes,
  });
  if (uploaded.status !== 200 && uploaded.status !== 201) {
    return { ok: false, detail: refusalText(uploaded.status, uploaded.body, uploaded.text) };
  }
  const strange = notTheApi(uploaded.status, uploaded.body, uploaded.text);
  if (strange !== null) return { ok: false, detail: strange };
  return { ok: true, result: { externalId: answer?.mediaId ?? media.objectId } };
}

/** Publishes one record. The destination upserts, so this creates or replaces. */
export async function putRecord(
  access: ChannelAccess,
  input: {
    readonly collection: "episodes" | "serials" | "characters" | "categories";
    readonly slug: string;
    readonly document: unknown;
  },
): Promise<DeliveryOutcome> {
  const response = await send(access, `/v1/${input.collection}/${input.slug}`, {
    method: "PUT",
    body: JSON.stringify(input.document),
  });
  if (response.status !== 200 && response.status !== 201) {
    return { ok: false, detail: refusalText(response.status, response.body, response.text) };
  }
  const strange = notTheApi(response.status, response.body, response.text);
  if (strange !== null) return { ok: false, detail: strange };
  return { ok: true, result: { externalId: input.slug } };
}

/**
 * Publishes a destination's front.
 *
 * There is no id in the path and no collection: a front is the one document a
 * destination serves as itself, written whole and replacing what was there. It
 * is never retired, so there is no counterpart to this.
 */
export async function putFront(
  access: ChannelAccess,
  document: unknown,
): Promise<DeliveryOutcome> {
  const response = await send(access, "/v1/site", {
    method: "PUT",
    body: JSON.stringify(document),
  });
  if (response.status !== 200 && response.status !== 201) {
    return { ok: false, detail: refusalText(response.status, response.body, response.text) };
  }
  const strange = notTheApi(response.status, response.body, response.text);
  if (strange !== null) return { ok: false, detail: strange };
  // The destination's own name for what it now holds. A front has no id there,
  // and the document it serves as itself is what it is called.
  return { ok: true, result: { externalId: "site" } };
}

/**
 * Retires one record. The destination reserves the address forever and answers
 * it with a tombstone afterwards, so this ends what is served without erasing
 * what was published.
 */
export async function retireRecord(
  access: ChannelAccess,
  input: {
    readonly collection: "episodes" | "serials" | "characters";
    readonly slug: string;
  },
): Promise<DeliveryOutcome> {
  const response = await send(access, `/v1/${input.collection}/${input.slug}`, {
    method: "DELETE",
  });
  if (response.status !== 200 && response.status !== 204) {
    return { ok: false, detail: refusalText(response.status, response.body, response.text) };
  }
  // A retirement may answer no body at all, which is the one write here that
  // legitimately carries nothing.
  if (response.status !== 204) {
    const strange = notTheApi(response.status, response.body, response.text);
    if (strange !== null) return { ok: false, detail: strange };
  }
  return { ok: true, result: { externalId: input.slug } };
}
