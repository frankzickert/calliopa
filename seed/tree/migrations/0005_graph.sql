-- The revisioned graph: four durable primitives plus the scope every record
-- carries and the counter that orders every write. Identity is a generated
-- UUID, so no consumer ever sees Postgres row identity.

-- Calliopa is one shared graph whose records are explicitly scoped. One scope
-- exists and nothing selects or routes by it; it is stored so a later projects
-- or tenancy change partitions content without backfilling history.
create table graph_scope (
    id         uuid        primary key default gen_random_uuid(),
    name       text        not null unique,
    created_at timestamptz not null default now()
);

insert into graph_scope (name) values ('calliopa');

-- One monotonic data revision for the whole graph. Allocation updates the
-- single row, so the row lock serializes graph transactions and commit order
-- is revision order: an as-of read at N never misses a write that committed
-- before the write it can see.
create table graph_data_revision (
    only_row boolean not null primary key default true,
    current  bigint  not null default 0,
    constraint graph_data_revision_single check (only_row)
);

insert into graph_data_revision (only_row, current) values (true, 0);

create function graph_next_data_revision() returns bigint as $$
    update graph_data_revision set current = current + 1 returning current;
$$ language sql;

-- A node is identity. It owns no content.
create table graph_node (
    id         uuid        primary key default gen_random_uuid(),
    scope_id   uuid        not null references graph_scope (id),
    created_at timestamptz not null default now(),
    constraint graph_node_scoped_identity unique (id, scope_id)
);

-- A revision is immutable content. Lifecycle state is the one field that
-- changes on an existing row, and it carries its own stamp: the creation stamp
-- says the row existed at a point, the lifecycle stamp says whether its
-- present state is the state it held then.
create table graph_node_revision (
    id                      uuid        primary key default gen_random_uuid(),
    node_id                 uuid        not null,
    scope_id                uuid        not null,
    content                 jsonb       not null,
    semantic_type           text        not null,
    lifecycle               text        not null,
    parent_revision_id      uuid,
    provenance              jsonb       not null,
    schema_version          integer     not null,
    created_data_revision   bigint      not null,
    lifecycle_data_revision bigint      not null,
    created_at              timestamptz not null default now(),
    constraint graph_node_revision_lifecycle
        check (lifecycle in ('candidate', 'established', 'archived', 'rejected')),
    -- A revision is stamped with its node's scope, never another one.
    constraint graph_node_revision_scope
        foreign key (node_id, scope_id) references graph_node (id, scope_id),
    constraint graph_node_revision_node_identity unique (id, node_id),
    -- A parent revision is always a revision of the same node.
    constraint graph_node_revision_parent
        foreign key (parent_revision_id, node_id)
        references graph_node_revision (id, node_id)
);

-- At most one revision of a node is established. The index is checked per
-- statement, so superseding archives the outgoing revision before inserting
-- the incoming one.
create unique index graph_node_revision_one_established
    on graph_node_revision (node_id) where lifecycle = 'established';

create index graph_node_revision_history
    on graph_node_revision (node_id, created_data_revision);

-- A relation is a directed fact, immutable after creation, pointing at a node
-- or at another relation.
create table graph_relation (
    id             uuid        primary key default gen_random_uuid(),
    scope_id       uuid        not null references graph_scope (id),
    relation_type  text        not null,
    from_node_id   uuid        not null,
    to_node_id     uuid,
    to_relation_id uuid,
    provenance     jsonb       not null,
    schema_version integer     not null,
    data_revision  bigint      not null,
    created_at     timestamptz not null default now(),
    constraint graph_relation_one_target
        check ((to_node_id is null) <> (to_relation_id is null)),
    constraint graph_relation_scoped_identity unique (id, scope_id),
    -- No relation crosses a scope boundary. A null endpoint leaves its
    -- composite reference unchecked, which is what the target choice needs.
    constraint graph_relation_origin_scope
        foreign key (from_node_id, scope_id) references graph_node (id, scope_id),
    constraint graph_relation_node_target_scope
        foreign key (to_node_id, scope_id) references graph_node (id, scope_id),
    constraint graph_relation_relation_target_scope
        foreign key (to_relation_id, scope_id) references graph_relation (id, scope_id)
);

create index graph_relation_origin on graph_relation (from_node_id);
create index graph_relation_node_target on graph_relation (to_node_id)
    where to_node_id is not null;
create index graph_relation_relation_target on graph_relation (to_relation_id)
    where to_relation_id is not null;

-- Validity records when a relation applies, relative to the revisions of its
-- endpoints. Changing or removing a relation closes this row; the relation
-- itself is never rewritten or deleted.
create table graph_relation_validity (
    relation_id               uuid        primary key references graph_relation (id),
    scope_id                  uuid        not null references graph_scope (id),
    status                    text        not null,
    origin_node_id            uuid        not null,
    origin_from_revision_id   uuid        not null references graph_node_revision (id),
    origin_to_revision_id     uuid        references graph_node_revision (id),
    target_node_id            uuid,
    target_from_revision_id   uuid        references graph_node_revision (id),
    target_to_revision_id     uuid        references graph_node_revision (id),
    target_relation_id        uuid        references graph_relation (id),
    established_by            jsonb       not null,
    closed_by                 jsonb,
    established_data_revision bigint      not null,
    closed_data_revision      bigint,
    updated_at                timestamptz not null default now(),
    constraint graph_relation_validity_status
        check (status in ('active', 'closed')),
    -- Closed and open states are complete: a closed row records when and by
    -- what, an active row records neither.
    constraint graph_relation_validity_closure
        check (
            (status = 'closed') = (closed_data_revision is not null)
            and (status = 'closed') = (closed_by is not null)
        )
);

create index graph_relation_validity_active
    on graph_relation_validity (relation_id) where status = 'active';

-- Immutability is enforced here rather than by convention, so nothing reaching
-- this database can rewrite history.

create function graph_reject_update() returns trigger as $$
begin
    raise exception '% is immutable after creation', tg_table_name
        using errcode = 'restrict_violation';
end;
$$ language plpgsql;

create trigger graph_node_immutable
    before update on graph_node
    for each row execute function graph_reject_update();

create trigger graph_relation_immutable
    before update on graph_relation
    for each row execute function graph_reject_update();

create function graph_node_revision_append_only() returns trigger as $$
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
    then
        raise exception 'graph_node_revision content is append-only; only lifecycle may change'
            using errcode = 'restrict_violation';
    end if;
    return new;
end;
$$ language plpgsql;

create trigger graph_node_revision_append_only
    before update on graph_node_revision
    for each row execute function graph_node_revision_append_only();

create function graph_relation_validity_closure_only() returns trigger as $$
begin
    if new.relation_id <> old.relation_id
        or new.scope_id <> old.scope_id
        or new.origin_node_id <> old.origin_node_id
        or new.origin_from_revision_id <> old.origin_from_revision_id
        or new.target_node_id is distinct from old.target_node_id
        or new.target_from_revision_id is distinct from old.target_from_revision_id
        or new.target_relation_id is distinct from old.target_relation_id
        or new.established_by is distinct from old.established_by
        or new.established_data_revision <> old.established_data_revision
    then
        raise exception 'graph_relation_validity may only be closed, never rewritten'
            using errcode = 'restrict_violation';
    end if;
    return new;
end;
$$ language plpgsql;

create trigger graph_relation_validity_closure_only
    before update on graph_relation_validity
    for each row execute function graph_relation_validity_closure_only();
