-- An agent run: one goal, one API client, one workspace, and the process
-- record the shell already knows how to report.
--
-- The run exists as its own table rather than as columns on `process` because
-- the registry is generic and an agent run is not: it carries a client, a
-- runtime, and the revision it read at, none of which a render or a transcode
-- would have.

create table agent_run (
    id                 uuid        primary key default gen_random_uuid(),
    process_id         uuid        not null references process (id) on delete cascade,
    workspace_id       uuid        not null references workspace (id) on delete cascade,
    client_id          uuid        not null references api_client (id),
    -- The run identifier the agent gave us, once it has accepted the goal.
    -- Null while the run is ours alone and the agent has not answered yet.
    agent_run_id       text,
    goal               text        not null,
    runtime            text        not null,
    model              text,
    -- The graph as the run found it. Acceptance compares against this.
    base_data_revision bigint      not null,
    state              text        not null,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index agent_run_process on agent_run (process_id);
create index agent_run_client on agent_run (client_id, created_at);

-- One active run per client, enforced by the database rather than by whoever
-- remembers to check. The agent's tool configuration is global, so a second
-- concurrent run would stage into whichever group the tool server happened to
-- resolve; making that unrepresentable is cheaper than detecting it.
create unique index agent_run_one_active
    on agent_run (client_id)
    where state in ('queued', 'running');
