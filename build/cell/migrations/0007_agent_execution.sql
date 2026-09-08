create table if not exists agent_execution (
  id text primary key,
  request_id text,
  knowledge_system_id text not null,
  cell_id text not null,
  principal_type text not null,
  status text not null check (status in ('queued', 'leased', 'completed', 'failed', 'canceled')),
  task jsonb not null,
  lease_id text,
  lease_worker_id text,
  lease_expires_at timestamp,
  created_at timestamp not null,
  updated_at timestamp not null
);

create table if not exists agent_execution_lease (
  id text primary key,
  execution_id text not null references agent_execution(id),
  worker_id text not null,
  status text not null check (status in ('active', 'completed', 'failed', 'canceled', 'expired')),
  leased_at timestamp not null,
  expires_at timestamp not null,
  heartbeat_at timestamp not null,
  completed_at timestamp
);

create table if not exists agent_execution_event (
  id bigserial primary key,
  execution_id text not null references agent_execution(id),
  sequence integer not null,
  event_type text not null,
  event jsonb not null,
  created_at timestamp not null
);

create table if not exists agent_execution_result (
  execution_id text primary key references agent_execution(id),
  status text not null,
  result jsonb not null,
  created_at timestamp not null
);

create index if not exists agent_execution_scope_status_idx
  on agent_execution(knowledge_system_id, status, created_at);

create index if not exists agent_execution_lease_expiry_idx
  on agent_execution(status, lease_expires_at);

create index if not exists agent_execution_lease_active_idx
  on agent_execution_lease(status, expires_at);

create unique index if not exists agent_execution_event_sequence_unique
  on agent_execution_event(execution_id, sequence);
