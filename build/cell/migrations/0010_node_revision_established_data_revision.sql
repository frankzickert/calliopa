-- Establishment marker on node_revision. BO_0083_001 BO_0083_002
--
-- created_data_revision records when a row came into being and data_revision
-- records its last status transition, which rewinds one step but not two: a
-- revision that went candidate -> established -> archived is ambiguous for
-- as-of markers before its establishment, and the one-step rewind misreports
-- a then-pending candidate as established at such markers.
--
-- established_data_revision is stamped once when a revision reaches
-- established and never updated afterward, including by archive. Zero means
-- never established.
alter table if exists public.node_revision
  add column if not exists established_data_revision bigint not null default 0;

-- Backfill for established rows: the last transition the row records is its
-- establishment, and a revision created established has data_revision equal
-- to created_data_revision, so data_revision is exact for both paths.
update public.node_revision
  set established_data_revision = data_revision
  where established_data_revision = 0 and status = 'established';

-- Backfill for archived rows: the establishment is the last status-transition
-- commit recorded strictly between creation and archival; a row with no such
-- commit was created established. As with the 0009 backfill this is the best
-- available answer for historical rows -- a commit that lists the revision and
-- carries a set_status among other operations without transitioning this row
-- can stamp late -- while every row written after this migration is stamped
-- exactly at write time.
update public.node_revision nr
  set established_data_revision = coalesce((
    select max(cl.data_revision)
    from public.commit_log cl
    where cl.affected_revisions @> array[nr.id]
      and cl.operation_kinds @> array['set_status']
      and cl.data_revision > nr.created_data_revision
      and cl.data_revision < nr.data_revision
  ), nr.created_data_revision)
  where nr.established_data_revision = 0 and nr.status = 'archived';

-- Legacy alignment: any row still missing its creation stamp gets it from
-- data_revision, exactly as the 0009 backfill did, so no store needs a
-- fallback for unstamped rows. BO_0083_002
update public.node_revision
  set created_data_revision = data_revision
  where created_data_revision = 0;

create index if not exists node_revision_established_data_revision_idx
  on public.node_revision(established_data_revision);
