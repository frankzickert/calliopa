-- blob_reference is the append-only record of the blob hashes each committed
-- change-set references, written in the same transaction as the commit_log
-- row. It is not refcounting — nothing ever decrements — but it is what gives
-- GC and the restore blob-integrity pass an index instead of a recursive scan
-- over all revision content. BO_0091_006
create table if not exists blob_reference (
    hash          text   not null,
    data_revision bigint not null,
    commit_id     text   not null,
    recorded_at   timestamp not null default now(),
    primary key (hash, commit_id)
);

create index if not exists blob_reference_data_revision_idx on blob_reference(data_revision);
