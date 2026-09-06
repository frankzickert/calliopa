-- The migration ledger bootstraps itself; no content model is introduced here.

create table schema_migrations (
    version     text        primary key,
    applied_at  timestamptz not null default now()
);
