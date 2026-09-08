set local search_path = public;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'node',
    'node_revision',
    'relation',
    'relation_validity',
    'commit_log',
    'revision_embedding'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is null
       and to_regclass(format('ag_catalog.%I', table_name)) is not null then
      execute format('alter table ag_catalog.%I set schema public', table_name);
    end if;
  end loop;
end;
$$;

alter table public.relation
  add column if not exists classification text[] not null default array['unclassified']::text[];

alter table public.relation
  alter column classification drop default;
