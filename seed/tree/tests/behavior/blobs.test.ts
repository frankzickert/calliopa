import { describe, expect, it } from "vitest";

import { readGraphEnv } from "../../src/server/ccgw/env";
import { putBlob } from "../../src/server/ccgw/blobs";
import { onGet } from "../../src/routes/api/blobs/[objectId]/index";

/**
 * The shell's blob route, against a real store (`BO_0273_046`).
 *
 * This is the round trip nothing tested: bytes stored under a prefixed digest,
 * asked for by the bare object id a block carries, and answered. The defect it
 * stands against had two halves, and a unit test saw neither — the surfaces
 * asked CCGW's own `/v1/blobs`, which the app origin does not forward, and
 * they asked for it by the id with `sha256:` stripped, which CCGW refuses as
 * `invalid_blob_hash`. A made picture drew nothing.
 */

const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();

interface Answered {
  status: number;
  bytes: Uint8Array | null;
  body: unknown;
  headers: Record<string, string>;
}

/** Enough of a request event for a handler that reads params and sends bytes. */
const ask = async (objectId: string): Promise<Answered> => {
  const answered: Answered = { status: 0, bytes: null, body: null, headers: {} };
  const event = {
    params: { objectId },
    cacheControl: () => undefined,
    headers: { set: (name: string, value: string) => (answered.headers[name] = value) },
    json: (status: number, body: unknown) => {
      answered.status = status;
      answered.body = body;
    },
    send: (status: number, bytes: Uint8Array) => {
      answered.status = status;
      answered.bytes = bytes;
    },
  };
  await (onGet as unknown as (e: unknown) => Promise<void>)(event);
  return answered;
};

describe.skipIf(!configured)("the bytes of a stored object", () => {
  it("answers the bytes that were stored, asked for by the bare object id", async () => {
    const bytes = new TextEncoder().encode(`a blob for BO_0273_046 ${Date.now()}`);
    const stored = await putBlob(bytes);
    expect(stored.outcome).toBe("success");
    if (stored.outcome !== "success") return;

    // What a block carries: the digest with its algorithm prefix taken off.
    const objectId = stored.result.hash.replace(/^sha256:/u, "");
    expect(objectId).toMatch(/^[0-9a-f]{64}$/u);

    const answered = await ask(objectId);
    expect(answered.status).toBe(200);
    expect(answered.bytes === null ? null : Array.from(answered.bytes)).toEqual(Array.from(bytes));
  });

  it("serves an octet stream, as retrieval does, so the mirror rule holds", async () => {
    const stored = await putBlob(new TextEncoder().encode(`mirror ${Date.now()}`));
    if (stored.outcome !== "success") throw new Error("the blob was not stored");
    const answered = await ask(stored.result.hash.replace(/^sha256:/u, ""));
    expect(answered.headers["Content-Type"]).toBe("application/octet-stream");
  });

  it("answers a hash that names nothing as unknown, not as an error", async () => {
    const answered = await ask("0".repeat(64));
    expect(answered.status).toBe(404);
  });

  it("refuses anything that is not an object id, without asking the store", async () => {
    for (const bad of ["", "abc123", "../secrets", `sha256:${"a".repeat(64)}`, "A".repeat(64)]) {
      expect((await ask(bad)).status).toBe(404);
    }
  });
});
