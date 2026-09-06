-- What a record is worth at one destination (docs/system/publishing.md,
-- A Destination Binding). Keyed by the record and the destination, never
-- stored on the record itself: an address and a catalogue visibility are
-- meaningless anywhere but the destination that has them.
--
-- Observed facts are not here. When a record was first published, how the last
-- attempt went, and what state it is in are the publication log's answers, and
-- a copy of them here could disagree with the history it summarised.

create table destination_binding (
    record_id    uuid        not null,
    record_kind  text        not null,
    channel      text        not null references connection (party),
    -- The record's address at this destination. Episodes, serials and
    -- characters get pages; a category does not.
    slug         text,
    -- Whether this destination's index lists the serial. An episode inherits
    -- its home serial's, so it carries none of its own.
    listed       boolean,
    -- A serial may declare an address of its own that the destination treats
    -- as canonical.
    root_address text,
    -- A category's colour is the one value it has that only means anything
    -- against the ground a particular surface paints.
    colour       text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),

    primary key (record_id, channel),

    constraint destination_binding_record_kind check (
        record_kind in ('episode', 'serial', 'character', 'category')
    ),
    -- A slug is an address, so it is shaped like one wherever it appears.
    constraint destination_binding_slug_shape check (
        slug is null or slug ~ '^[a-z0-9-]+$'
    ),
    constraint destination_binding_root_address_shape check (
        root_address is null or root_address ~ '^/[a-z0-9/-]*$'
    ),
    -- Each kind carries what it has and nothing it does not, so a binding
    -- cannot hold a colour for an episode or a slug for a category.
    constraint destination_binding_addressed_kinds check (
        record_kind = 'category' or (slug is not null and colour is null)
    ),
    constraint destination_binding_category check (
        record_kind <> 'category'
        or (slug is null and listed is null and root_address is null)
    ),
    constraint destination_binding_listing_is_a_serials check (
        record_kind = 'serial' or (listed is null and root_address is null)
    )
);

-- An address identifies one record at one destination within its own kind, the
-- way the destination's own paths are namespaced by kind.
create unique index destination_binding_address
    on destination_binding (channel, record_kind, slug)
    where slug is not null;
