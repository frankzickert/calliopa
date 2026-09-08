create table if not exists node (
  id text primary key,
  tenant_id text not null,
  created_at timestamp not null,
  updated_at timestamp not null
);

create table if not exists node_revision (
  id text primary key,
  node_id text not null references node(id),
  tenant_id text not null,
  content jsonb not null,
  parent_revision_id text references node_revision(id),
  status text not null check (status in ('candidate', 'established', 'archived', 'rejected')),
  classification text[] not null,
  schema_version integer not null,
  data_revision bigint not null,
  created_at timestamp not null,
  valid_from timestamp,
  created_by text not null,
  purpose text not null
);

create table if not exists relation (
  id text primary key,
  tenant_id text not null,
  type text not null,
  from_node_id text not null references node(id),
  to_kind text not null check (to_kind in ('node', 'relation')),
  to_node_id text references node(id),
  to_relation_id text references relation(id),
  polarity text not null check (polarity in ('positive', 'negative', 'neutral')),
  schema_version integer not null,
  data_revision bigint not null,
  created_at timestamp not null,
  created_by text not null,
  check (
    (to_kind = 'node' and to_node_id is not null and to_relation_id is null)
    or (to_kind = 'relation' and to_relation_id is not null and to_node_id is null)
  )
);

create table if not exists relation_validity (
  relation_id text primary key references relation(id),
  status text not null check (status in ('active', 'closed')),
  origin_node_id text not null references node(id),
  origin_from_revision_id text not null references node_revision(id),
  origin_to_revision_id text references node_revision(id),
  target_kind text not null check (target_kind in ('node', 'relation')),
  target_node_id text references node(id),
  target_relation_id text references relation(id),
  target_from_revision_id text references node_revision(id),
  target_to_revision_id text references node_revision(id),
  established_by text not null,
  closed_by text,
  data_revision bigint not null,
  updated_at timestamp not null,
  check (
    (target_kind = 'node' and target_node_id is not null and target_relation_id is null)
    or (target_kind = 'relation' and target_relation_id is not null and target_node_id is null)
  )
);

create index if not exists node_tenant_id_idx on node(tenant_id);
create index if not exists node_revision_tenant_id_idx on node_revision(tenant_id);
create index if not exists node_revision_status_idx on node_revision(status);
create index if not exists node_revision_node_id_status_idx on node_revision(node_id, status);
create index if not exists relation_tenant_id_status_idx on relation(tenant_id);
create index if not exists relation_validity_status_idx on relation_validity(status);
