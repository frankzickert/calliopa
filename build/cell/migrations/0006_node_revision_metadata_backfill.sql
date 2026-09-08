set local search_path = public;

alter table public.node_revision
  add column if not exists tenant_id text;

update public.node_revision nr
set tenant_id = n.tenant_id
from public.node n
where nr.node_id = n.id
  and nr.tenant_id is null;

alter table public.node_revision
  alter column tenant_id set not null;

alter table public.node_revision
  add column if not exists purpose text;

update public.node_revision
set purpose = 'bootstrap'
where purpose is null;

alter table public.node_revision
  alter column purpose set not null;

create index if not exists node_revision_tenant_id_idx on public.node_revision(tenant_id);
