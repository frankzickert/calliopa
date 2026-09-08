create extension if not exists age;
create extension if not exists vector;

create table if not exists schema_version (
  version integer primary key,
  applied_at timestamp not null
);

create sequence if not exists data_revision_seq as bigint;

load 'age';
set local search_path = ag_catalog, "$user", public;

do $$
begin
  perform ag_catalog.create_graph('project_graph');
exception
  when duplicate_schema then null;
  when duplicate_object then null;
end;
$$;
