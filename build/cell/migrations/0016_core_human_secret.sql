-- A human's password, under argon2id with its parameters on the row, apart
-- from the machine credentials: a chosen secret and a generated one are
-- opposite cases. One row per human account. BO_0208_002
create table if not exists public.core_human_secret (
    principal_name text primary key references public.core_principal (name),
    encoded_hash   text not null,
    set_at         timestamptz not null default now()
);
