load 'age';
set local search_path = ag_catalog, "$user", public;

do $$
begin
  perform ag_catalog.create_vlabel('project_graph', 'Node');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  perform ag_catalog.create_vlabel('project_graph', 'NodeRevision');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  perform ag_catalog.create_vlabel('project_graph', 'Relation');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  perform ag_catalog.create_elabel('project_graph', 'REVISION_OF');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  perform ag_catalog.create_elabel('project_graph', 'PARENT');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  perform ag_catalog.create_elabel('project_graph', 'FROM');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  perform ag_catalog.create_elabel('project_graph', 'TO');
exception
  when duplicate_object then null;
end;
$$;
