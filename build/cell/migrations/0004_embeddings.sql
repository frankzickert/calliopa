create table if not exists commit_log (
  id text primary key,
  data_revision bigint not null,
  schema_version integer not null,
  committed_at timestamp not null,
  principal text not null,
  purpose text,
  item_id text,
  idempotency_key text,
  statement text not null,
  parameters jsonb not null,
  operation_kinds text[] not null,
  affected_nodes text[] not null,
  affected_revisions text[] not null,
  affected_relations text[] not null,
  result jsonb not null
);

create unique index if not exists commit_log_idempotency_key_unique
  on commit_log(idempotency_key)
  where idempotency_key is not null;

create index if not exists commit_log_data_revision_idx on commit_log(data_revision);
create index if not exists commit_log_schema_version_idx on commit_log(schema_version);
create index if not exists commit_log_affected_nodes_idx on commit_log using gin(affected_nodes);
create index if not exists commit_log_affected_revisions_idx on commit_log using gin(affected_revisions);
create index if not exists commit_log_affected_relations_idx on commit_log using gin(affected_relations);

create table if not exists revision_embedding (
  artifact_revision_id text primary key references node_revision(id),
  source_revision_id text not null references node_revision(id),
  method text not null,
  vector vector(1536) not null,
  generated_at timestamp not null
);

create unique index if not exists revision_embedding_source_method_unique
  on revision_embedding(source_revision_id, method);

create index if not exists revision_embedding_vector_hnsw_idx
  on revision_embedding
  using hnsw (vector vector_cosine_ops);
