-- The normalized events of a run, as the console reads them.
--
-- They are stored rather than streamed straight through because the shell
-- re-attaches to work by polling records: a reader who reloads mid-run, or
-- opens the console after one finished, sees what happened. The payload is the
-- contract's own shape, not the agent's.

create table agent_run_event (
    id       bigserial   primary key,
    run_id   uuid        not null references agent_run (id) on delete cascade,
    kind     text        not null,
    payload  jsonb       not null,
    at       timestamptz not null default now()
);

create index agent_run_event_run on agent_run_event (run_id, id);
