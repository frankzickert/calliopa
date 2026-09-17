# PU_0007_FEAT_index-vocabulary

Status: completed

Requested: 2026-09-14, when the first site to implement the content index — `homepage`, `HP_0023_FEAT_content-index` in its repository — found that the vocabulary `PU_0001` parses cannot say four things its `/v1` already takes. Homepage ships its index with the one container today's vocabulary describes (the site document and its hero slots) and declares the rest once this change lands. The number skips the sketch's `PU_0002`–`PU_0006`, which the extension's docs already cite for shapes, the first publish, Bunny, YouTube and the manual kinds.

## Where This Starts

- `lib/content-index.ts` parses a container's `route` with `{number}` and `{parent}` as the only placeholders, and derives whether a container exists once or per number from the route; a `reference` to another container has no field type (`line`, `text`, `date`, `flag`); a slot has no fields of its own; an image slot is one class with one aspect ([Website](../channels/website.md) in this extension's docs).

- Homepage addresses every record by a slug the author chose, an episode names its home serial, its further serials, its characters and its card scene, and carries a position; a scene entry carries a transcript, a duration, dimensions and its Bunny video id, a still its alt text, prose its title, and every asset its label and categories; the teaser is one picture in three crops with one alt text.

- The publishing model already has a home for each: the address is the binding's ([Publishing](../publishing/publishing.md), Bindings); an item's machine facts, label and disclosure are the item's ([Shapes And Deliverables](../shapes/shapes-and-deliverables.md)); a picture in three crops is one item with three renditions. What is missing is the vocabulary to say, in the index, which of those a slot or a container takes.

## Intent

* A container may be addressed rather than numbered: its route names `{slug}`, and the record's address comes from its binding at the channel. `{number}` and `{parent}` stay as they are; a route names one of `{slug}` and `{number}`, never both.

* A container field may reference another container: type `reference` with the container it names, taking the address of a record published there; and a field may be an `integer`.

* A slot may declare fields of its own, typed as a container's are, filled from the item that fills the slot: the projection reads a scene's transcript, duration and dimensions off the item's machine facts, a still's alt text and prose's title the same way, and refuses an entry whose item lacks what the slot's field requires.

* An image slot may take one picture in several crops: `aspects` as a list beside `aspect`, filled from one item's renditions, one per aspect, and refused when a crop is missing.

* Every widening is additive: an index Homepage serves today parses unchanged, and a site that never declares the new properties is unaffected.

## The Shape

- The parser: `{slug}` accepted in a route, `isSingleton` and a new `isAddressed` derived from it; `reference` and `integer` field types, a `reference` field carrying `container` checked against the listed containers; `fields` on a slot, parsed as a container's; `aspects` on a slot, each one of the four aspects, unique. Every refusal named at the entry and field as today; `lib/content-index.test.ts` extended for each.

- The stored index and the tab: the new properties stored and shown — a route's placeholder, a field's reference target, a slot's fields and aspects.

- The assignment and the projection consume them with the first publish (`PU_0003`); this change gives the index the words and nothing publishes differently until then.

- Verification: the parser's unit tests; the behaviour suite's stub site declaring an addressed container with a reference field and a slot with fields and three aspects, read, stored and read back.

## Open Questions

- [ ] Functional question: whether a `reference` field takes one address or a list — an episode's further serials and its characters are lists, its home serial and card scene are one. Recommendation: `reference` with `many: true` for a list.

- [ ] Functional question: whether a slot's fields are filled from the item alone or may also be written per channel on the binding — a label an author wants only at one site. Recommendation: from the item, and the binding's copy fields stay the per-channel text (`PU_0003`).
