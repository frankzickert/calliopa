-- A connection is one of two kinds. An `apiKey` party takes a secret Calliopa
-- stores and presents; a `status` party takes none and holds only what
-- something else reports about it.
--
-- The status rows are the agent's runtimes. Their credentials live in the
-- runtimes' own homes on the agent's volume and never enter this table, so
-- what a row holds is a registration and what it shows is read live.

alter table connection
    add column kind text not null default 'apiKey',
    add constraint connection_kind check (kind in ('apiKey', 'status'));

-- A status party never has a secret, whatever else changes.
alter table connection
    add constraint connection_status_has_no_secret check (
        kind <> 'status' or (secret is null and secret_suffix is null)
    );

insert into connection (party, kind) values
    ('hermes', 'status'),
    ('codex', 'status'),
    ('claude-code', 'status');
