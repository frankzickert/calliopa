create table workspace (
    id          uuid        primary key default gen_random_uuid(),
    is_default  boolean,
    tabs        jsonb       not null,
    active_tab  text,
    layout      jsonb       not null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create unique index workspace_one_default on workspace (is_default) where is_default;
