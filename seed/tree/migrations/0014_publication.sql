-- The publication log: what actually happened at a destination
-- (docs/system/publishing.md, The Publication Log).
--
-- It is operational history rather than content, so it is an ordinary table and
-- not a graph node. A graph node accumulates revisions, and an entry here is
-- never revised: what it says happened is what happened.

create table publication (
    id            uuid        primary key default gen_random_uuid(),
    -- What went, and what kind of thing it is. A destination takes either a
    -- whole episode or an asset out of one, so the log is written in both
    -- shapes rather than in the asset one alone.
    record_id     uuid        not null,
    record_kind   text        not null,
    -- Which episode an asset publication was for. An asset may be held by any
    -- number of episodes, so an entry naming only the asset could not say.
    episode_id    uuid,
    -- The export that went, where the publication is asset-shaped.
    rendition_id  uuid,
    -- Every content-addressed object this publication sent. An object named
    -- here is permanent: the sweep never removes bytes a publication used, and
    -- because the id is the content's hash it names something that cannot have
    -- changed underneath it.
    object_ids    text[]      not null default '{}',
    -- The destination, which is a channel party in `connection`.
    channel       text        not null references connection (party),
    act           text        not null,
    outcome       text        not null,
    -- The destination's own id for what it now holds, on a success.
    external_id   text,
    -- What went wrong, on a failure. Never carries a presented secret.
    detail        text,
    at            timestamptz not null default now(),

    constraint publication_record_kind check (
        record_kind in ('episode', 'serial', 'asset', 'character', 'category')
    ),
    constraint publication_act check (act in ('publish', 'retire')),
    constraint publication_outcome check (outcome in ('succeeded', 'failed')),
    -- A success says what the destination now holds; a failure says why not.
    -- Neither is allowed to be silent about its own half.
    constraint publication_success_names_it check (
        outcome <> 'succeeded' or external_id is not null
    ),
    constraint publication_failure_says_why check (
        outcome <> 'failed' or detail is not null
    ),
    -- An asset publication is for an episode; an episode publication is not.
    constraint publication_asset_names_its_episode check (
        record_kind <> 'asset' or episode_id is not null
    )
);

-- Reading a record's state at one destination is the log's commonest question.
create index publication_record on publication (record_id, channel, at desc);

-- The whole value of the log is that it cannot be rewritten. Enforcing that in
-- the database rather than by convention means no code path, and no later
-- change, can quietly edit history.
create function publication_is_append_only() returns trigger
    language plpgsql as $$
begin
    raise exception 'publication is append-only: entries are added, never % ', tg_op;
end;
$$;

create trigger publication_no_rewrite
    before update or delete on publication
    for each row execute function publication_is_append_only();
