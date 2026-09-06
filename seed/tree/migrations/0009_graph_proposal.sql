-- Proposal writes (docs/system/graph-gateway.md): a group is one coherent
-- change staged by one caller against one root, holding the typed items a
-- human answers one at a time. Staged content lives in the graph as candidate
-- revisions; these tables hold what was proposed and what has been answered.

-- A revision that was staged became truth later than it was written, so when
-- it joined the document is its own fact. Without it a change accepted today
-- would report the day it was proposed.
alter table graph_node_revision
    add column established_at timestamptz;

update graph_node_revision
set established_at = created_at
where lifecycle in ('established', 'archived');

alter table graph_node_revision
    add constraint graph_node_revision_established_at
    check ((established_at is null) = (established_data_revision is null));

create table graph_proposal_group (
    id                    uuid        primary key default gen_random_uuid(),
    scope_id              uuid        not null references graph_scope (id),
    root_node_id          uuid        not null,
    -- The graph as the group was staged against. Acceptance reports a conflict
    -- rather than overwriting when truth an item names has moved since.
    base_data_revision    bigint      not null,
    staged_by             jsonb       not null,
    request               jsonb,
    created_data_revision bigint      not null,
    created_at            timestamptz not null default now(),
    constraint graph_proposal_group_root_scope
        foreign key (root_node_id, scope_id) references graph_node (id, scope_id)
);

create index graph_proposal_group_root on graph_proposal_group (root_node_id);

-- An item is the unit a human answers: the content it staged and the
-- operations its acceptance performs, committed together or not at all.
create table graph_proposal_item (
    id                    uuid        primary key default gen_random_uuid(),
    group_id              uuid        not null references graph_proposal_group (id),
    scope_id              uuid        not null references graph_scope (id),
    ordinal               integer     not null,
    -- The kind a reader sees. The domain names it; the gateway carries it.
    kind                  text        not null,
    -- The node the item concerns, when it names one that already exists.
    target_node_id        uuid,
    -- The candidate this item staged, and the revision it was staged against.
    staged_revision_id    uuid        references graph_node_revision (id),
    base_revision_id      uuid        references graph_node_revision (id),
    -- The relation work acceptance performs beyond establishing the candidate.
    accept_operations     jsonb       not null default '[]'::jsonb,
    answer                text,
    answered_data_revision bigint,
    created_at            timestamptz not null default now(),
    constraint graph_proposal_item_answer
        check (answer is null or answer in ('accepted', 'rejected')),
    -- An answer and its stamp arrive together, so an item is unanswered or
    -- answered and never half of either.
    constraint graph_proposal_item_answered
        check ((answer is null) = (answered_data_revision is null)),
    constraint graph_proposal_item_ordinal unique (group_id, ordinal)
);

create index graph_proposal_item_group on graph_proposal_item (group_id);
create index graph_proposal_item_target on graph_proposal_item (target_node_id)
    where target_node_id is not null;

-- A group is open while an item of it is unanswered. Deriving it is what keeps
-- the group from carrying a second account of its items that could disagree
-- with them.
create index graph_proposal_item_unanswered on graph_proposal_item (group_id)
    where answer is null;

-- The wall-clock stamp is written with the revision stamp beside it and is
-- history from that moment, like everything else on a revision.
create or replace function graph_node_revision_append_only() returns trigger as $$
begin
    if new.id <> old.id
        or new.node_id <> old.node_id
        or new.scope_id <> old.scope_id
        or new.content is distinct from old.content
        or new.semantic_type <> old.semantic_type
        or new.parent_revision_id is distinct from old.parent_revision_id
        or new.provenance is distinct from old.provenance
        or new.schema_version <> old.schema_version
        or new.created_data_revision <> old.created_data_revision
        or new.created_at <> old.created_at
        or (
            old.established_data_revision is not null
            and (
                new.established_data_revision
                    is distinct from old.established_data_revision
                or new.established_at is distinct from old.established_at
            )
        )
    then
        raise exception 'graph_node_revision content is append-only; only its lifecycle and the stamp of its establishment may change'
            using errcode = 'restrict_violation';
    end if;
    return new;
end;
$$ language plpgsql;
