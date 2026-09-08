-- Immutable creation marker on node_revision. BO_0080_008
--
-- data_revision is overwritten whenever a revision's status changes in place,
-- so an archived revision carries the revision it was archived at rather than
-- the one it was written at. That makes "what was current as of N"
-- unanswerable from the row alone: a revision written before N and archived
-- after N is filtered out by data_revision <= N, and its replacement is
-- filtered out too, so a published page would vanish from the public surface
-- the moment its author edited it.
--
-- created_data_revision is stamped once and never updated, so a revision is
-- resolvable as of N when it was written at or before N and had not yet been
-- archived by then.
--
-- Existing rows are backfilled from data_revision, which is exact for every
-- row that has never changed status and the best available answer for the
-- rest.
alter table if exists public.node_revision
  add column if not exists created_data_revision bigint not null default 0;

update public.node_revision
  set created_data_revision = data_revision
  where created_data_revision = 0;

create index if not exists node_revision_created_data_revision_idx
  on public.node_revision(created_data_revision);
