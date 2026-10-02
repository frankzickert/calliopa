-- Every store names its writes across stores: a random origin minted once, and
-- the origin's own gap-free counter on every commit-log row and on every row a
-- commit writes or updates, so a later sync with another store exchanges
-- exactly what the other side lacks. data_revision stays the local ordering.
-- Re-runnable: a second run finds nothing unnamed. BO_0319_001

create table if not exists public.store_origin (
    singleton     boolean primary key default true check (singleton),
    origin        text not null,
    last_sequence bigint not null default 0,
    created_at    timestamptz not null default now()
);

insert into public.store_origin (origin)
select 'origin:' || replace(gen_random_uuid()::text, '-', '')
where not exists (select 1 from public.store_origin);

alter table public.commit_log
    add column if not exists origin text,
    add column if not exists origin_sequence bigint;
alter table public.node_revision
    add column if not exists origin text,
    add column if not exists origin_sequence bigint;
alter table public.relation
    add column if not exists origin text,
    add column if not exists origin_sequence bigint;
alter table public.relation_validity
    add column if not exists origin text,
    add column if not exists origin_sequence bigint;

-- Commits written before the origin existed are numbered in the order they
-- were written, continuing after whatever the counter already holds.
with o as (select origin, last_sequence from public.store_origin),
numbered as (
    select c.id, o.last_sequence + row_number() over (order by c.data_revision, c.committed_at, c.id) as seq
    from public.commit_log c, o
    where c.origin is null
)
update public.commit_log c
set origin = (select origin from o), origin_sequence = n.seq
from numbered n, o
where c.id = n.id;

update public.store_origin s
set last_sequence = greatest(s.last_sequence, coalesce((select max(origin_sequence) from public.commit_log where origin = s.origin), 0));

create unique index if not exists commit_log_origin_sequence_idx on public.commit_log (origin, origin_sequence);

-- A row carries the pair of the commit that last wrote it: the commit at its
-- data_revision (one join), and only for a row no commit matches — none on a
-- graph written through CCGW — the nearest commit below, else above.
create temporary table origin_at_revision on commit drop as
select data_revision, max(origin) as origin, max(origin_sequence) as origin_sequence
from public.commit_log
where origin is not null
group by data_revision;

create or replace function pg_temp.origin_pair_near(revision bigint, out origin text, out origin_sequence bigint) as $$
    select a.origin, a.origin_sequence
    from origin_at_revision a
    order by (a.data_revision > revision), abs(a.data_revision - revision), a.origin_sequence desc
    limit 1
$$ language sql stable;

update public.node_revision r
set origin = a.origin, origin_sequence = a.origin_sequence
from origin_at_revision a
where r.origin is null and r.data_revision = a.data_revision;

update public.node_revision r
set origin = p.origin, origin_sequence = p.origin_sequence
from (select distinct data_revision from public.node_revision where origin is null) d,
     lateral pg_temp.origin_pair_near(d.data_revision) p
where r.origin is null and r.data_revision = d.data_revision;

update public.relation r
set origin = a.origin, origin_sequence = a.origin_sequence
from origin_at_revision a
where r.origin is null and r.data_revision = a.data_revision;

update public.relation r
set origin = p.origin, origin_sequence = p.origin_sequence
from (select distinct data_revision from public.relation where origin is null) d,
     lateral pg_temp.origin_pair_near(d.data_revision) p
where r.origin is null and r.data_revision = d.data_revision;

update public.relation_validity r
set origin = a.origin, origin_sequence = a.origin_sequence
from origin_at_revision a
where r.origin is null and r.data_revision = a.data_revision;

update public.relation_validity r
set origin = p.origin, origin_sequence = p.origin_sequence
from (select distinct data_revision from public.relation_validity where origin is null) d,
     lateral pg_temp.origin_pair_near(d.data_revision) p
where r.origin is null and r.data_revision = d.data_revision;
