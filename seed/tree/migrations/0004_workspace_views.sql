alter table workspace
    add column preferred_views jsonb not null default '{}'::jsonb;
