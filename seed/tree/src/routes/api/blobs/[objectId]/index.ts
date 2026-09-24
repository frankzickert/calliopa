import type { RequestHandler } from "@builder.io/qwik-city";

import { readBlob } from "~/server/ccgw/blobs";

/**
 * The bytes of a stored object, to the browser (`BO_0273_046`).
 *
 * A blob lives in the object store behind CCGW, and CCGW's own retrieval route
 * is not reachable from the app origin: nothing forwards `/v1` any more — the
 * hop `review.go` still describes as *"vite.config"* went with the dev proxy —
 * so every surface that pointed an element at `/v1/blobs/…` drew nothing. The
 * document's media block and the publishing item's preview both did. This is
 * the one route that serves them, because a blob is the shell's own primitive
 * rather than any extension's.
 *
 * **The media type is the mirror rule's**: retrieval serves every object as
 * `application/octet-stream`, which an `<img>` sniffs its own way past but a
 * media element will not, so a video is still fetched and retyped by the block
 * that draws it (`docs/system/binary-content.md`). Re-typing here would mean
 * trusting a caller's word about what bytes are, and the reference that knows
 * is not in this request.
 *
 * The hash is the capability: it is a 256-bit digest of the content, so it
 * cannot be guessed, and it is only ever handed out by a surface the reader
 * could already see. Beyond that the route is open to any signed-in person, as
 * the session plugin makes every route here.
 */

/** The bare object id: the digest with its algorithm prefix taken off. */
const OBJECT_ID = /^[0-9a-f]{64}$/u;

export const onGet: RequestHandler = async (event) => {
  const objectId = event.params.objectId ?? "";
  if (!OBJECT_ID.test(objectId)) {
    event.json(404, { error: "No such object." });
    return;
  }
  // Content-addressed, so the bytes under an id never change: the browser is
  // told it may keep them, which is what stops a document re-fetching every
  // picture it draws. Private, because the gate is per person.
  event.cacheControl({ maxAge: 31536000, public: false, immutable: true });
  let bytes: Uint8Array;
  try {
    bytes = await readBlob(`sha256:${objectId}`);
  } catch {
    // Unreadable and absent are one answer: a hash that names nothing here
    // must not be distinguishable from one the store refused.
    event.json(404, { error: "No such object." });
    return;
  }
  event.headers.set("Content-Type", "application/octet-stream");
  event.send(200, bytes);
};
