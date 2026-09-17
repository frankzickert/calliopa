# PU_0008_FEAT_entry-references

Status: completed

Requested: 2026-09-14, when `homepage` (`HP_0024` in its repository) found that the index vocabulary, widened by `PU_0007`, still has no word for a field naming one of the record's *own* slot entries: an episode's card scene, the site document's flagship scene. A `reference` names a container; a `line` carrying an entry's id says nothing a client can check, and a wrong id refused only at the site's boundary at publish time is the lesson studio's `ST_0050` taught. Homepage leaves both undeclared until this lands; the site document cannot publish through the channel before it, since its flagship scene is required — and nothing publishes through a channel before `PU_0003` anyway.

## Where This Starts

- A field type is one of `line`, `text`, `date`, `flag`, `reference`, `integer`; a `reference` carries the container it names and `many` ([Website](../channels/website.md), *What A Site May Declare Beyond The First Vocabulary*).

- A slot entry has no identity on this side yet. What identifies one entry among several in a slot — the id the site keeps, the id the client sends — is part of the container document's wire shape, which `PU_0003` defines together with the assignment and the projection. Homepage's own rule is that every asset carries an author-supplied `id`, unique within its episode, because a derived identity would change when the media is re-exported.

- So the word and the wire shape are one decision: a field can only name an entry by an id both sides agree on.

## Intent

* A field may name **one of the record's own slot entries**: type `entry`, carrying `slot` — a slot of the same container — and `many` for a list. Its value is the id of an entry in that slot of the same record, and a client can check it before anything is sent: the entry must exist in the deliverable being published.

* An entry's identity is the item's own, stable across re-exports: the client sends each entry with the id of the item that fills the slot, so a field naming an entry names an item the projection can find, and the site keeps that id as the entry's. This is the wire shape's rule, decided here so the field type has something to point at, and carried into `PU_0003`.

* The widening is additive: an index that declares no `entry` field parses unchanged.

## The Shape

- The parser: `entry` in `FIELD_TYPES`; a field of that type carries `slot`, checked against the slots the index lists under the field's own container — including one listed after the field — and refused naming the entry when it is not one, or when it belongs to another container; `many` allowed on `entry` as on `reference`; `slot` refused on any other type.

- The stored index and the tab: the field shown as *entry of <slot>* or *entries of <slot>*.

- The projection (`PU_0003`) fills an `entry` field from the deliverable's items in that slot and refuses one naming an item the deliverable does not gather there.

- Verification: the parser's unit tests for the field, the cross-container refusal and the later-listed slot; the behaviour suite's stub site declaring an `entry` field, read, stored and read back.

## Open Questions

- [ ] Functional question: whether an `entry` field may be `required` by the site while the vocabulary has no `required` on fields at all — homepage's flagship scene is required with its flagship episode. Recommendation: `required` on any field type, as an additive property, in this change; the projection refuses a required field left empty.
