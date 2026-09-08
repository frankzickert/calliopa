-- Repair relation.type drift. Change 0032 added the type column to the 0002
-- core-table migration in place; an instance migrated before that edit keeps
-- the old table shape, because create table if not exists never alters an
-- existing table. Every relation insert names type, so a drifted instance
-- holds no relation rows and the not-null constraint is immediately
-- satisfiable; on an undrifted instance both statements are no-ops. BO_0086_005
set local search_path = public;

alter table public.relation
  add column if not exists type text not null default '';

alter table public.relation
  alter column type drop default;
