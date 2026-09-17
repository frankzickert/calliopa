# PU_0003_FEAT_assignment-and-first-publish

Status: completed

Requested: 2026-09-14, after `PU_0002` completed. The two halves the extension holds — channels with what a site declares (`PU_0001`, `PU_0007`, `PU_0008`) and shapes with deliverables and items (`PU_0002`) — are not joined: a channel does not know which shape it takes, and nothing publishes. This change joins them and performs the first publish, to a website. It defines the **container document**, the one thing that reaches outside this repository: `homepage`'s `/v1` has to accept it, and `HP_0024` there records that it waits on this definition. The document is proposed here so both sides read the same text.

## Where This Starts

- A website channel holds the index the site declared: containers with routes and fields, slots typed by content class with constraints, fields of their own and crops, `entry` fields naming a slot of the same container, `required` on any field ([Website](../channels/website.md)). Nothing is assigned to any of it; `reconcileIndex` takes the assigned set as an input that is empty today.

- A deliverable is an instance of a shape, its parts filled by items with exports — content-addressed blobs — or a prose body document; a nested part holds deliverables of another shape ([Shapes And Deliverables](../shapes/shapes-and-deliverables.md)).

- The publishing model's fixed lines already say what this change builds: a binding is what one record is worth at one channel — its address, its per-channel copy as fields, its disclosure — and observed facts are the log's; the log is append-only, state at a channel is derived from it, a projection refusal is not a failed publication, a delivery failure is; every publication is a human act; a `2xx` that is not the platform's own answer is a failure; refuse, never skip ([Publishing](../publishing/publishing.md)).

- The website kind has no `publish` half; the kind contract reserves `project` and `deliver` over the kernel's brokered transport ([Channel Kinds](../channels/channel-kinds.md)). A video slot takes the id the video host answered, and no host exists before `PU_0004`.

- Homepage's own rules for what it accepts: records addressed by slug; every referenced record must be published there first; media must be stored before the record naming it; an unchanged republish keeps its timestamps; a retirement is a permanent tombstone; prose is exactly the shell's committed block vocabulary — the five text roles, the four marks, links, and the divider — and nothing else.

## Intent

* **A channel takes shapes.** On the channel tab, *Takes* assigns a shape to a container the site declares and each of the shape's parts to a slot of that container; a part of class `shape` is assigned to a container the nested shape is assigned to. The assignment is refused where the classes differ or the part's constraints cannot meet the slot's (a 16:9 part into a 9:16 slot, a prose part into an image slot), naming the rule; a slot the site marks `required` with nothing assigned is named as missing. Keys assigned this way are what `reconcileIndex` keeps when the site stops listing them.

* **A binding is authored per record and channel**: the record's address at the channel — the `{slug}` a route names, or the `{number}` — the values of the container's fields the site declares (title, premise, a date, a flag, a reference, an entry), written by the author or proposed by an agent, and the disclosure. The address is freely editable until the record has been published there, and a permanent citation target afterwards.

* **The projection is pure.** From a deliverable, its binding, the channel's index and assignment, and the bindings of what it references, it answers the container document or every rule it breaks: a required field or slot left empty, a part's item that does not fit the slot's constraints, a referenced record not yet published at the channel, a video slot with no host id, a prose body outside the vocabulary the site accepts. Nothing reaches the network.

* **A release is a human act with an order**: gather, project, declare and upload every object the document names (bytes the site already holds are declared and not sent), write the document, record. Retiring is the same act with the opposite intent. Each is one entry in the append-only log naming the deliverable, the channel, the act, what was sent, the outcome, the site's id and address, and the time.

* **What the author sees**: a deliverable's inspector carries one row per channel that takes its shape — never published, published at a time, retired, with what is missing before it can be — and the acts; the item's inspector the same for a channel that takes items. The channel tab's *Published* section lists the log's entries for it.

* **Proven without egress, and against a real site.** The projection and every refusal are unit-tested over records; the behaviour suite publishes to a stub site in the harness that validates what it receives against the index it serves — the `ST_0050` lesson; `verify:publish` publishes to a real site named by a channel and refuses rather than skips when none is configured.

## The Container Document

Proposed here for `homepage` to answer on. `PUT <address><route>` with the route's placeholders filled from the binding, `content-type: application/json`:

```
{
  "fields": {
    "<field key>": <value>          // line, text: string; date: ISO-8601; flag: boolean; integer: number;
                                    // reference: the address of a record published at this site, or a list when many;
                                    // entry: the id of an entry in the named slot of this document, or a list when many
  },
  "slots": {
    "<slot key>": [
      {
        "id": "<the id of the item filling the part>",    // stable across re-exports (PU_0008)
        "fields": { "<slot field key>": <value> },           // the slot's own fields, from the item's facts
        "media": "<sha256>",                                  // image, audio, file: one object, declared and uploaded first
        "crops": { "16:9": "<sha256>", "9:16": "<sha256>" }, // an image slot with `aspects`: one object per aspect
        "host": "<video id at the channel's video host>",     // video: never bytes
        "document": { "blocks": [ ... ] }                    // prose: the shell's block vocabulary, as the site accepts it
      }
    ]
  }
}
```

- Exactly one of `media`, `crops`, `host` and `document` per entry, by the slot's class. An entry's `fields` carry only what the slot declares; a slot field's value comes from the item alone (`PU_0007`, user decision).

- Media: `POST <address>/media` with `{mediaType, size, sha256}` answers `{mediaId, exists}` and, when absent, where to `PUT` the bytes — homepage's contract as it stands. Every object the document names is declared before the document is written.

- The site answers JSON: the stored record on `200` or `201`, the envelope `{error: {code, message, field?, rule?}}` on a refusal. Anything else is a failure, not a success.

- `DELETE <address><route>` retires; a body may name `supersededBy`, an address at the same site.

- A singleton container's document is the same shape at its fixed route.

## The Shape

- Types, declared with this change: `assignment` (`channel`, `shape`, `container`; and per part `part`, `slot`), `binding` (`recordId`, `recordKind` one of `deliverable`, `item`; `channel`; `address`; `number`; `fields`; `disclosure`), `release` (`recordId`, `recordKind`, `channel`, `act` one of `publish`, `retire`, `outcome` one of `succeeded`, `failed`, `objectIds`, `externalId`, `externalAddress`, `detail`, `at`); relations `takes` (channel to assignment) and `of` (assignment to shape). A binding and a release carry their keys as properties, checked by a read before the write. `reconcileIndex`'s assigned set is read from the assignments.

- The kind contract's `publish` half filled in for `website`: `projectContainer` over a submission — the deliverable read, its binding, the index, the assignment, the bindings and states of what it references, the bodies of its prose items — and `deliver` through the broker; the same split every later kind follows.

- The release order in `server/release.ts`; the log in `server/releases.ts` with `recordSuccess`, `recordFailure`, `stateAt`, `entriesFor`; the routes under `/api/x/publishing/`: `channels/[id]/takes` (`GET`, `PUT`), `deliverables/[id]/at` (`GET`: every channel that takes its shape with the binding, the state and what is missing), `deliverables/[id]/at/[channel]/binding` (`PUT`), `deliverables/[id]/at/[channel]/act` (`POST` with `publish` or `retire`), and the same for items.

- The channel tab's *Takes* and *Published* sections; the deliverable and item inspectors' rows and acts; the binding's fields written in the view's body.

- Deleting a record live at a channel refused naming the channel; deleting a channel anything was published to refused — retire instead, which keeps the log's destination; both promised by `PU_0001`'s docs and `PU_0002`'s.

- Out of scope: a video host (`PU_0004`); any kind but `website`; scheduling, budgets and windows; a homepage change accepting this document, which is `HP_0025` or later in that repository.

## Open Questions

- [ ] Functional question: where a reference field's value comes from — from the deliverable that gathers this one when its shape is assigned to the referenced container (an episode's home serial is the Series that gathers it, its address at the channel), from an address the author types on the binding, or both with the gathering deliverable first. Recommendation: both, gathering first.

- [ ] Functional question: what `{number}` is for a numbered container — the deliverable's place among what the gathering deliverable holds in that part, or a number the author types on the binding. Recommendation: the binding's, typed; a derived number moves when the list does.

- [ ] Functional question: a release that fails part-way — the site holds media and refuses the document — is logged as failed with what landed; does the author's next press retry from the document alone, since declared media is not sent again? Recommendation: yes; content addressing makes the retry cheap and there is nothing to undo.

- [ ] Functional question: does one `verify:publish` cover every kind's transport, or does each kind bring its own gate? `CA_0037` left this open. Recommendation: one gate per kind, named `verify:publish:<kind>`; the ordinary gate stays egress-free.
