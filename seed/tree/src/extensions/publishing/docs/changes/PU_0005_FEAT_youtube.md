# PU_0005_FEAT_youtube

Status: idea

Requested: 2026-09-15, after the first publish to homepage and the Bunny Stream kind (`PU_0004`). YouTube is the first social kind, the strategy's primary destination: Shorts at 9:16 up to 180 s carry the complete episode, and the anthology goes long. It depends on `BO_0252` in `calliopa-bootstrap` — the kernel's `oauth` credential kind, headers through the broker, and a streamed blob slice — and on the settings row that change brings.

## Where This Starts

- A kind is code against one contract: credential, fields, probe, offer, units, acts, a pure projection and a transport through the broker ([Channel Kinds](../channels/channel-kinds.md)). `bunny-stream` is the first kind whose unit is the item: an item's tab carries its rows at the channels that take its class, and `publishItem` and `retireItem` in `server/release.ts` run the order — today through Bunny's functions by name, since it is the only such kind ([Bunny Stream](../channels/bunny-stream.md), [Channels](../channels/channels.md)).

- A publish runs as a process the tab follows, with the steps the transport reports ([Publishing](../publishing/publishing.md), A Publish Is A Process).

- A binding is what a record is worth at a channel — its address, its fields, its disclosure; an item's binding at a Bunny channel holds the disclosure alone, since a fixed offer declares no fields ([Publishing](../publishing/publishing.md), Bindings).

- What YouTube takes, verified 2026-09-15 against `developers.google.com`: `videos.insert` under the `https://www.googleapis.com/auth/youtube` scope, which the device flow allows; the resumable session on the API's own host; `snippet.title` (at most 100 characters), `snippet.description` (at most 5000), `snippet.tags`, `snippet.categoryId`, `status.privacyStatus` (`private`, `unlisted`, `public`), `status.selfDeclaredMadeForKids`, `status.containsSyntheticMedia` — the altered-content disclosure is settable through the API, which the strategy's `destinations.yaml` had assumed it was not; `videos.delete` retires. A video is a Short by YouTube's own rule — vertical and at most 180 s — not by a flag. Quota: 10,000 units a day by default and a *Video Uploads* bucket of 100 calls a day.

- **Every upload from an API project that has not passed Google's compliance audit is locked to private** (projects created after 2020-07-28; the audit takes two to four weeks and asks for a description of the use, a demo video of the sign-in, and agreement to the API Services Terms). The author applies for the audit; this change is built and proven against a stub, and its walk against YouTube waits until the audit has passed, so the first real publish is public. User decision, 2026-09-15.

## Intent

* **YouTube is a channel kind**, `youtube`: credential `oauth` — the device flow, the client id and secret on the party's row, *Sign in* there — probed by `GET /youtube/v3/channels?part=id&mine=true` expecting `200` under the address `https://www.googleapis.com`; its offer is fixed, one slot of class `video` with no constraint of its own, since whether a video is a Short is YouTube's rule; its unit is the **item**; its acts are `publish` and `retire`. User decision, 2026-09-15: items, from the item's tab, as at Bunny; a deliverable's two main videos are two publishes.

* **An item's binding at a YouTube channel carries the video's words**: `title` (line, required, at most 100 characters), `description` (text, at most 5000), `tags` (lines), `category` (line, a YouTube category id), `privacy` (`private`, `unlisted` or `public`, `private` until chosen), `made_for_kids` (flag). The disclosure comes from the item's own `synthetic`, never typed twice. A kind whose unit is the item declares these fields on its offer, and the item's row at the channel draws them as the deliverable's row draws a site's.

* **The projection is pure**: the item a video with an export, the words within their limits, the privacy one of the three; every rule refused at once. **The delivery is the resumable session**: the metadata and the size open it and answer the session URI; the bytes go in chunks of 8 MiB — a multiple of 256 KiB — each a blob slice the broker streams with its `Content-Range`, the step *uploading k of N*; a `308` says what arrived and the next chunk follows it; `201` carries the video, whose id is the external id and `https://youtu.be/<id>` the external address, and whose answered `privacyStatus` is what the log records — *private, until the API project passes Google's audit* when it differs from what was asked. A republish of the same export is a new upload, since YouTube holds videos, not bytes by hash; the row says so before the press.

* **Retiring is `videos.delete`**, logged as any retirement.

* **`publishItem` and `retireItem` run through the kind**, not through Bunny's functions by name: the kind contract's `publish` half takes the transport, the bytes by hash, and the progress callback, and answers what was delivered; `retire` beside it. Bunny moves onto the same shape.

* **Proven** over records in the unit suite — every refusal, the chunking arithmetic; in the behaviour suite against a stub YouTube in the harness that validates the session (the initiating headers, the metadata, each chunk's `Content-Range` against what it holds, the `308`/`Range` dance, the final `201`, `videos.delete`) reached through the broker with a bearer the stub accepts — the party written as `apiKey` for the suite, since the transport cannot tell; and by `verify:publish:youtube`, the gate that fails rather than skips without a verified `youtube` channel and an item, run once the audit has passed.

## Design

- `server/kinds/youtube.ts`: the descriptor; `bindingFields` on the kind (the six fields above, typed as index fields are, so `fieldValueRefusal` and the row's inputs serve them unchanged); `projectVideo` over the item and its binding answering `{ metadata, export }`; `deliverVideo(transport, party, upload, progress)` opening the session with `headers` and reading `location`, then chunks by `body: {blob, range}`; `retireVideo`. Paths: `/youtube/v3/…` for the API, `/upload/youtube/v3/videos` for the session, both declared as the party's prefixes.

- `server/kinds/contract.ts`: the `publish` half becomes `{ project(submission), deliver(transport, party, document, bytes, progress), retire(transport, party, externalId) }` with `bytes` a `{ hash, size }` handle the transport streams; `server/release.ts` dispatches an item's publish and retirement through the channel's kind; `bunny-stream.ts` implements the same shape.

- `~/server/kernel/client`'s `request` gains `headers`, `blob` with `range`, and answers `location` and `range` (`BO_0252`'s shell half, landed with it).

- `views/item.tsx` draws a kind's binding fields in the item's row and writes them through `items/[id]/at/[channel]/binding`, which `bindItem` widens to the kind's fields.

- `tests/behavior/youtube.ts`: the stub; `tests/publish/youtube.test.ts`: the gate; `package.json` gains `verify:publish:youtube`.

## Out Of Scope

- Thumbnails (`thumbnails.set` from an image item) and scheduling (`publishAt`): a later `PU` change once the first video is public.

- Playlists, comments, analytics.

- The redirect flow and every platform that needs it.
