-- Separation of duties: one row per extension under the policy, set and
-- cleared by the owner at runtime. Outside the graph for the licence's reason:
-- the policy governs acceptance, so it is not itself something a proposal can
-- change. BO_0212_001
create table if not exists public.core_separation_policy (
    extension_id text primary key,
    set_by       text not null,
    set_at       timestamptz not null default now()
);
