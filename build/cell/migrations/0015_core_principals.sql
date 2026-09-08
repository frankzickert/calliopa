-- The core's caller registry: principals, their one current credential, and
-- the epoch from which createdBy stamps are verified rather than asserted.
-- Plain tables in CCGW's own database, outside the graph: an account someone
-- could stage is not a gate, and the licence count is a SELECT. BO_0206_001
create table if not exists public.core_principal (
    name       text primary key,
    kind       text not null check (kind in ('human', 'agent', 'system')),
    class      text not null check (class in ('human', 'agent')),
    state      text not null check (state in ('active', 'suspended', 'retired')),
    owner      boolean not null default false,
    created_at timestamptz not null default now()
);
create unique index if not exists core_principal_one_owner on public.core_principal ((owner)) where owner;

create table if not exists public.core_credential (
    id             text primary key,
    principal_name text not null references public.core_principal (name),
    verifier       text not null,
    current        boolean not null default true,
    expires_at     timestamptz,
    issued_at      timestamptz not null default now(),
    last_used_at   timestamptz
);
create unique index if not exists core_credential_one_current on public.core_credential (principal_name) where current;

create table if not exists public.core_auth_epoch (
    singleton     boolean primary key default true check (singleton),
    data_revision bigint not null,
    recorded_at   timestamptz not null default now()
);
