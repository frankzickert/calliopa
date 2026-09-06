-- Proposal writes (docs/system/api-authentication.md): a client carries the
-- class that says whether it may write truth directly or may only stage a
-- proposal. It is a property of the client, not of a credential, so rotating a
-- secret never changes what a caller may do.

alter table api_client
    add column identity_class text not null default 'writer';

-- The default existed to backfill. Every caller issued before this wrote truth
-- directly, and a record that refused to read would lock out a working
-- credential. Afterwards the class is named at issuance, so a write that names
-- none fails rather than granting the wider class by omission.
alter table api_client
    alter column identity_class drop default;

alter table api_client
    add constraint api_client_identity_class
    check (identity_class in ('writer', 'proposer'));
