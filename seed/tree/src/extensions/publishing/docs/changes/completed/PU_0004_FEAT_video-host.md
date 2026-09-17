# PU_0004_FEAT_video-host

Status: completed

Requested: 2026-09-14, on the `PU_0003` walk. The first publish to homepage stops at the scene: *Scene takes the id of a video at the channel's video host, and synced-sts.mp4 has none there yet.* Homepage stores no video bytes; it plays what Bunny Stream holds and expects the id Bunny answered. Until a video can be published to Bunny, no video slot can be filled, which is every episode. This change makes Bunny Stream a channel kind of its own, publishes video items there, and carries the id each publication answered into a website's video slot.

## Where This Starts

- A website channel is one party record, `publishing-<channelId>`, with the site's address and key, probed by `GET <address>/index` ([Website](../channels/website.md)); the settings extension lists one row per channel through the roster (`CA_0049`).

- The projection over a video slot refuses `noVideoHost` for every video, and the release hands it an empty `hosts` map (`server/release.ts`, `projectContainer` in `server/kinds/website.ts`). The container document's video entry carries `host` — the id at the host — beside the slot's fields ([Website](../channels/website.md), The Container Document).

- Homepage's index declares `scene` and `fragment` with a field `host_id` (*Bunny Stream video id*) beside `label`, `transcript`, `duration_seconds`, `width`, `height` (`HP_0024` there). The container document places the id on the entry as `host`; the field would place it among the slot's fields.

- A kind's unit may be an item; the item's rows at its channels and *Publish to <channel>* on its tab were deferred by `PU_0003` to the first kind taking items ([Channels](../channels/channels.md)).

- `calliopa-video` held a static `bunny` party — a numeric library id beside the key, `AccessKey` as the header, probed by listing one video — and never built the upload (`CA_0037_006` open there). The kernel's broker forwards a JSON or base64 body of up to 512 MiB; a streamed body from a blob hash arrives with `BO_0252`.

- The analysis said Bunny is not a channel but a host a website channel names. Reversed by user decision on 2026-09-14: Bunny Stream is a channel kind like any other, and a video's id there is a publication the log records, which a website's slot then uses.

## Intent

* **Bunny Stream is a channel kind.** `bunny-stream`: credential `apiKey` presented as `AccessKey`, one configuration field — the numeric library id — probed by listing one video of the library; its offer is fixed, one slot of class `video` with no constraint of its own; its unit is the **item**; its acts are `publish` and `retire`. The channel is created, configured, tested, retired and deleted as a website channel is.

* **A video item is published to Bunny from its tab.** The item tab gains *At its channels* — one row per channel whose unit is an item and whose slot takes the item's class — and *Publish to <channel>* in its inspector, as the deliverable tab has. Publishing uploads the export's bytes once, logs the entry with the id Bunny answered as the external id, and derives the state as for any record; the same bytes published again upload nothing. A replaced rendition is a new upload; the old video stays at Bunny (user decision, 2026-09-14).

* **The website's slot names its host.** On a website channel's *Takes*, a video slot is assigned a part and the channel that hosts it — a `bunny-stream` channel this instance holds. The projection fills the entry's `host` from the item's live publication at that channel and refuses `noVideoHost` naming the item and the host channel — *publish synced-sts.mp4 to Bunny first* — while there is none. Nothing is typed; the shape stays free of channels.

* **The id travels as the entry's `host`**, as the container document proposes; homepage's `host_id` field is not filled and is homepage's to drop from its index in the change that accepts the container document (user decision, 2026-09-14). An observed id is never a field an author could type.

* **Bunny shows `<deliverable title> — <part title>`** as the video's title when the item fills a part, and the item's label when it stands alone (user decision, 2026-09-14).

* **Proven without egress, and against Bunny.** The kind's projection and every refusal over records; the upload order and the log against a stub host in the harness that validates what it receives — the create call, the bytes, the id it answers, a wrong key refused; a website publish filling `host` from the publication and refusing while there is none; `verify:publish:bunny-stream` publishing a named item to a named channel, failing rather than skipping without them.

## Design

- `server/kinds/bunny-stream.ts`: the kind against the same contract as `website` — descriptor with `libraryId` checked as `numeric`, `authorization: { header: "AccessKey", scheme: "", secretField: "apiKey" }`, probe `GET https://video.bunnycdn.com/library/{configuration.libraryId}/videos?itemsPerPage=1` expecting `200`, `offer` fixed to one video slot, `units: ["item"]`, `acts: ["publish", "retire"]`; a pure `project` over an item answering the upload (title, media type, the export to send) or its refusals — no export, not a video, above the broker's size; `deliver`: `POST /library/{libraryId}/videos` with the title, then `PUT /library/{libraryId}/videos/{guid}` with the bytes, answering the guid; `retire`: `DELETE /library/{libraryId}/videos/{guid}`. The party's address is `https://video.bunnycdn.com`, written by the kind rather than typed, and the paths are placed under `/library/<libraryId>` the way the website kind places its own under the address.

- The assignment of a website's video slot gains `host` — a channel id — beside `slot`; `assignPart` refuses a host that is not a `bunny-stream` channel or is retired; `readTakes` and the Takes form carry it (a select of the instance's `bunny-stream` channels, required for a video slot).

- `submissionFor` in `server/release.ts` builds `hosts` from the log: for every video item, `liveAt(item, host channel)`'s external id. `projectContainer` is unchanged.

- The item's rows: `items/[id]/at` (`GET`), `items/[id]/at/[channel]/binding` (`PUT`: the disclosure, since a Bunny slot declares no fields), `items/[id]/at/[channel]/act` (`POST`), sharing `server/release.ts` with the deliverable's; `readAt` answers rows for a kind whose unit is an item.

- Size: the broker takes the bytes base64 in a JSON body of at most 512 MiB, so an export above roughly 380 MB is refused before the upload as `tooLargeToBroker`, naming `BO_0252` which streams a blob by hash. Homepage's episodes are minutes long and fit.

- Vocabulary: no new node type; `assignment.parts[].host` is a property. The harness fixture and the vocabulary-absence count are unchanged unless a member is added.

## Out Of Scope

- Any other host, and a social kind's own upload (`PU_0005`, `BO_0252`).

- Waiting for Bunny's encoding, or reading playback state back.

- Streaming a body from a blob hash through the broker (`BO_0252`).

- Deleting a superseded video at Bunny.
