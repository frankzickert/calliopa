-- Proposal writes (docs/system/revisioned-graph.md): a revision may now be
-- created as a `candidate` and answered later, so the state a revision holds no
-- longer says when it held truth. A revision that was staged, established and
-- then superseded moved twice, and one lifecycle stamp records only the last of
-- those moves, so history needs the point it became truth recorded on its own.

alter table graph_node_revision
    add column established_data_revision bigint;

-- Every revision written before this was created established, so it held truth
-- from the moment it existed.
update graph_node_revision
set established_data_revision = created_data_revision
where lifecycle in ('established', 'archived');

-- A revision carries the stamp exactly when it has held truth: `established`
-- still does, `archived` did until it was superseded, and `candidate` and
-- `rejected` never have. This is also what stops a revision that held truth
-- from being unaccepted after the fact.
alter table graph_node_revision
    add constraint graph_node_revision_established_when_truth
    check (
        (established_data_revision is null)
        = (lifecycle in ('candidate', 'rejected'))
    );

-- Lifecycle stays the one field an existing revision may change, and the
-- establishment stamp is written once alongside it. When a revision became
-- truth is history like the rest of the row, so it is never rewritten.
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
            and new.established_data_revision
                is distinct from old.established_data_revision
        )
    then
        raise exception 'graph_node_revision content is append-only; only its lifecycle and the stamp of its establishment may change'
            using errcode = 'restrict_violation';
    end if;
    return new;
end;
$$ language plpgsql;
