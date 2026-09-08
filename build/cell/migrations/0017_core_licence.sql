-- The licence the core holds: one row, the file verbatim, outside the graph
-- for identity's reason — a graph node is revisioned, stageable and reachable
-- by the mutation path the licence gates. And the expiry mark on an account:
-- a demotion by licence expiry or removal remembers itself, so a renewal
-- restores exactly the accounts it dropped. BO_0213_004
create table if not exists public.core_licence (
    singleton    boolean primary key default true check (singleton),
    raw          text not null,
    installed_at timestamptz not null default now(),
    installed_by text not null
);

alter table public.core_principal
    add column if not exists demoted_by_expiry boolean not null default false;
