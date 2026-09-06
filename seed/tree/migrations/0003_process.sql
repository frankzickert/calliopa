-- The process registry ships before any producer: records, states, and
-- transitions exist so the shell can report asynchronous work.

create table process (
    id           uuid        primary key default gen_random_uuid(),
    workspace_id uuid        not null references workspace (id) on delete cascade,
    title        text        not null,
    state        text        not null,
    step         text,
    error        text,
    item_id      text,
    item_kind    text,
    acknowledged boolean     not null default false,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create index process_workspace on process (workspace_id, created_at);
