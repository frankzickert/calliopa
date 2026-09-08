import type { GraphOutcome } from "../outcome";
import { graphEnv } from "./env";

/**
 * Bytes through CCGW. `BO_0207_016`
 *
 * CCGW is the only door to the object store (`binary-content.md`): the shell
 * holds no bucket key and reaches no S3 surface. An upload goes to
 * `PUT /v1/blobs` immediately before the revision that references it, and
 * the answer is the algorithm-prefixed hash the reference carries; retrieval
 * is `GET /v1/blobs/{hash}`, an opaque octet stream, since every meaning —
 * the media type included — lives in the referencing revision. A referenced
 * blob is permanent; an upload nothing references is CCGW's own garbage
 * collection to sweep.
 */

/** The canonical reference shape a revision carries at top level. */
export interface BlobReference {
  readonly _kind: "blob";
  /** Algorithm-prefixed: `sha256:<hex>`. The sole identity and integrity carrier. */
  readonly hash: string;
  /** Advisory presentation metadata, taken from the upload and the author's intent. */
  readonly mediaType: string;
  readonly size: number;
  readonly filename?: string;
}

export const HASH_PREFIX = "sha256:";

/** The hash a blob reference carries for an object id (the bare hex digest). */
export const blobHash = (objectId: string): string => `${HASH_PREFIX}${objectId}`;

/** The object id a blob hash names, or null when it is not a sha256 hash. */
export const objectIdOfHash = (hash: string): string | null =>
  hash.startsWith(HASH_PREFIX) && /^[0-9a-f]{64}$/.test(hash.slice(HASH_PREFIX.length))
    ? hash.slice(HASH_PREFIX.length)
    : null;

export const blobReference = (objectId: string, mediaType: string, size: number): BlobReference => ({
  _kind: "blob",
  hash: blobHash(objectId),
  mediaType,
  size,
});

/** Whether a value is a blob reference as `binary-content.md` shapes it. */
export function isBlobReference(value: unknown): value is BlobReference {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate["_kind"] === "blob" &&
    typeof candidate["hash"] === "string" &&
    objectIdOfHash(candidate["hash"]) !== null &&
    typeof candidate["mediaType"] === "string" &&
    typeof candidate["size"] === "number"
  );
}

/** Uploads bytes and answers the hash CCGW computed for them. */
export async function putBlob(bytes: Uint8Array): Promise<GraphOutcome<{ readonly hash: string; readonly size: number }>> {
  let response: Response;
  try {
    response = await fetch(`${graphEnv().ccgwUrl}/v1/blobs`, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream" },
      body: bytes.slice().buffer as ArrayBuffer,
    });
  } catch (error) {
    return { outcome: "storageError", detail: `CCGW is unreachable: ${String(error)}` };
  }
  const text = await response.text();
  let body: { hash?: string; size?: number; diagnostics?: { code?: string; message?: string }[] } = {};
  try {
    body = text === "" ? {} : (JSON.parse(text) as typeof body);
  } catch {
    body = {};
  }
  if (response.status === 413) {
    return {
      outcome: "validationFailure",
      failures: [{ operation: null, rule: "blobTooLarge", detail: body.diagnostics?.[0]?.message ?? "the blob exceeds CCGW's maximum" }],
    };
  }
  if (response.status !== 200 || typeof body.hash !== "string") {
    return { outcome: "storageError", detail: body.diagnostics?.[0]?.message ?? `CCGW answered ${response.status} to the upload` };
  }
  return { outcome: "success", result: { hash: body.hash, size: body.size ?? bytes.byteLength } };
}

/** Reads a blob's bytes back, which a destination upload needs. */
export async function readBlob(hash: string): Promise<Uint8Array> {
  const response = await fetch(`${graphEnv().ccgwUrl}/v1/blobs/${encodeURIComponent(hash)}`);
  if (!response.ok) {
    throw new Error(`CCGW answered ${response.status} for blob ${hash}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
