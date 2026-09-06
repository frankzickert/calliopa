-- Outbound credentials (docs/system/settings.md): one row per external party
-- Calliopa presents a credential to. The secret is encrypted with
-- CALLIOPA_SECRETS_KEY (src/server/secrets.ts), so the database never holds it
-- in the clear, and the suffix stored beside it is all a row ever shows.

create table connection (
    party          text        primary key,
    secret         text,
    secret_suffix  text,
    state          text        not null default 'unconfigured',
    last_tested_at timestamptz,
    last_error     text,
    updated_at     timestamptz not null default now(),
    constraint connection_state check (state in (
        'unconfigured', 'configured', 'verified', 'failing'
    )),
    -- A suffix without a secret would say a key is set when none is stored.
    constraint connection_suffix_with_secret check (
        (secret is null) = (secret_suffix is null)
    )
);

-- The set of parties is application source, so the rows are seeded rather than
-- created. `honcho` holds the OpenAI key the agent's memory needs.
insert into connection (party) values ('honcho');
