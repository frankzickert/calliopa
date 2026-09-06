-- Machine callers of the external API. A client is the identity; a credential
-- is what it presents. Only the verifier is stored, never the secret itself.

create table api_client (
    id         uuid        primary key default gen_random_uuid(),
    name       text        not null,
    state      text        not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint api_client_state check (state in ('active', 'suspended', 'revoked'))
);

create table api_credential (
    id           uuid        primary key default gen_random_uuid(),
    client_id    uuid        not null references api_client (id) on delete cascade,
    verifier     text        not null,
    is_current   boolean     not null default true,
    expires_at   timestamptz,
    issued_at    timestamptz not null default now(),
    last_used_at timestamptz
);

-- Rotation has no overlap window, so a client has at most one live credential.
create unique index api_credential_one_current on api_credential (client_id) where is_current;
