-- A front is published like everything else (docs/system/publishing.md, The
-- Publication Log and The Homepage Front).
--
-- It is the one publication that names no record here. An episode and an asset
-- exist in this workspace and are projected outward; a front exists only at the
-- destination, so the entry names the channel and every object it sent and has
-- no record id to carry. What the sweep must never remove is decided by what a
-- publication used rather than by what kind of thing it was, so a published
-- hero is protected by the same rule as a published still.

alter table publication alter column record_id drop not null;

alter table publication drop constraint publication_record_kind;

alter table publication add constraint publication_record_kind check (
    record_kind in ('episode', 'serial', 'asset', 'character', 'category', 'front')
);

-- Each kind says what it is about and nothing it is not: a front names the
-- destination alone, and everything else names the record it was.
alter table publication add constraint publication_front_names_no_record check (
    record_kind <> 'front' or record_id is null
);

alter table publication add constraint publication_record_named check (
    record_kind = 'front' or record_id is not null
);
