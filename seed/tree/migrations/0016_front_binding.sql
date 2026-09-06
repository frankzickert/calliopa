-- What a destination shows as itself (docs/system/publishing.md, A Destination
-- Binding and The Homepage Front).
--
-- A front is the destination's own document rather than a record it holds, so
-- this binding is keyed by the destination alone: there is no record for it to
-- be keyed by, which is why it is a table of its own rather than a further kind
-- in `destination_binding`.
--
-- Observed facts are absent for the reason they are absent from every binding:
-- when a front was last published and how the attempt went are the publication
-- log's answers, and a copy here could disagree with the history it summarised.
--
-- Every value is nullable because a front is written over time. What a complete
-- one must carry is its projection's refusal, the way an episode's premise is
-- required by whichever destination requires it and not by the store that holds
-- it.

create table front_binding (
    channel          text        primary key references connection (party),
    headline         text,
    line             text,
    -- The hero's picture. An ordinary asset that no episode holds, so it is
    -- named here and carried nowhere else.
    hero_asset       uuid,
    -- A scene as well as an episode, because scenes are unranked at the
    -- destination and its hero plays one film large.
    flagship_episode uuid,
    flagship_scene   uuid,
    entry_serial     uuid,
    -- The wall's order is authored, so it is a list rather than a set.
    wall             uuid[]      not null default '{}',
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),

    -- A value that is present and empty is one nobody wrote. Clearing it says
    -- that; an empty string says it while claiming to be a value.
    constraint front_binding_headline_said check (headline is null or headline <> ''),
    constraint front_binding_line_said check (line is null or line <> '')
);
