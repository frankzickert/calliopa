-- BO_0257_001: a read touches only the rows its statement names. The type and
-- the proposal stamp were compared inside content, so every typed read scanned
-- node_revision and unpacked every revision's content — ext.source code
-- included — to find a handful of rows. Stored at write, read from the column:
-- a filter or a metadata-only read never opens content.
alter table node_revision
  add column if not exists type text
  generated always as (coalesce(content->>'_type', content->>'type')) stored;
alter table node_revision
  add column if not exists proposal text
  generated always as (content->>'_proposal') stored;

create index if not exists node_revision_tenant_type_idx on node_revision(tenant_id, type);
-- The id property is the one fixed key every `{id: $x}` pattern pushes.
create index if not exists node_revision_content_id_idx on node_revision((content->>'id'));

-- The planner has no statistics for a new column until the table is analyzed;
-- without them it estimates one row per type and joins by scanning node.
analyze node_revision;
