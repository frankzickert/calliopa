# Revisioned Graph

## Revisioned Graph

- This topic is a link since `BO_0207_016`. What it described — the `src/server/graph/` primitives, transactions and as-of reads over the shell's own Postgres — retired with the shell's stores; the durable content store is the core's now.
- The shell's content lives in the one graph: CCGW's revisioned nodes, relations and validity windows, pinned reads at any data revision, and the candidate and established lifecycle are `ccgw.md`'s and `data-model.md`'s in the core; bytes are blobs under `binary-content.md`.
- **The bytes of a stored object reach the browser through `GET /api/blobs/<objectId>`**
  (`BO_0273_046`, found by the user on 2026-09-22). A blob lives in the object store behind CCGW,
  and CCGW's own `/v1/blobs` is not reachable from the app origin: nothing forwards `/v1` — the hop
  the core's `review.go` still calls *"vite.config"* went with the dev proxy — so every surface
  that pointed an element there drew nothing at all. The document's picture and the publishing
  item's preview both did, and a picture that had been made and paid for showed as an empty block.
  One route serves them, because a blob is the shell's own primitive rather than any extension's.
- The route takes the **bare object id**, the digest with `sha256:` taken off, which is what a
  block's reference carries once read; it puts the prefix back for CCGW, which refuses the bare
  form as `invalid_blob_hash`. Anything that is not 64 hex characters is answered as unknown
  without asking the store, and a hash that names nothing is answered the same way, so one cannot
  be told from the other.
- It serves `application/octet-stream`, mirroring retrieval rather than re-typing: the media type
  that knows what the bytes are lives on the reference, not in the request, and the block that
  draws a video retypes them itself (`binary-content.md`). The answer is cached as immutable and
  private — content-addressed bytes never change under their id, and the gate is per person.
- The hash is the capability: a 256-bit digest cannot be guessed and is only ever handed out by a
  surface its reader could already see. Beyond that the route is open to any signed-in person, as
  the session plugin makes every route here.
- The shell keeps no database, no bucket key and no gateway of its own (`ui-shell.md`, `BO_0207`); the history of the retired implementation stays in this topic's earlier revisions.
