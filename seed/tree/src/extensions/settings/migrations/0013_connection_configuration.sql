-- A channel is a destination the author's work goes to, and it needs values
-- beside its secret to reach one (docs/system/settings.md, Channels). The
-- configuration is readable, unlike the secret: an address is not a credential.
--
-- The set of channels is application source like the party list, so the row is
-- seeded here rather than created at runtime.

alter table connection
    add column configuration jsonb not null default '{}'::jsonb;

-- A status party holds neither a secret nor configuration: everything it shows
-- is read live from what the agent reports.
alter table connection
    add constraint connection_status_has_no_configuration check (
        kind <> 'status' or configuration = '{}'::jsonb
    );

-- `homepage` is the first channel: the site this instance publishes to. It
-- holds that instance's address and the `hpk_` token issued in that repository.
insert into connection (party, kind) values ('homepage', 'apiKey');
