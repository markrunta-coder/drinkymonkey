-- Drinkchart — incident logging data model
-- Postgres 15+ (Supabase-compatible). Design artifact: run order is top to bottom.
--
-- Principles (from Drinkchart_Incident_Tree_Spec_v0.1):
--   * The tree is data: tree_versions holds each published config verbatim.
--   * Answers are keyed (arc_id, node_id) and record the tree_version they were
--     captured under, so old incidents stay interpretable against their own tree.
--   * Arcs are reopenable: reopening is just another upsert into answers;
--     nothing is ever deleted by normal use.

-- gen_random_uuid() is built into Postgres 13+; on older installs:
-- create extension if not exists pgcrypto;

create table users (
    id          uuid primary key default gen_random_uuid(),
    created_at  timestamptz not null default now()
);
comment on table users is
    'Minimal identity anchor. Under Supabase Auth this becomes a profiles table referencing auth.users(id); kept standalone in the design artifact.';

create table tree_versions (
    version       integer primary key check (version >= 1),
    config        jsonb not null,
    notes         text,
    published_at  timestamptz not null default now()
);
comment on table tree_versions is
    'Each published tree config, verbatim. Shipping a new tree = inserting a row (after lint); never update or delete a published row — rollback means pointing clients at a previous version.';

create table arcs (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references users(id) on delete cascade,
    tree_version  integer not null references tree_versions(version),
    outcome       text check (outcome in ('drank', 'resisted', 'delayed')),
    status        text not null default 'open' check (status in ('open', 'complete')),
    occurred_at   timestamptz,
    tags          text[] not null default '{}',
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
comment on table arcs is
    'One arc = one incident (the struggle, not the drink). Live-urge arcs (E1) start with outcome null and status open.';
comment on column arcs.tree_version is
    'Tree version the arc was opened under. Individual answers carry their own version, which wins for interpretation.';
comment on column arcs.outcome is
    'Effective outcome, maintained by code from O1/D1 answers: null until logged; ''delayed'' becomes drank/resisted when D1 resolves; stays ''delayed'' (status open) on still_deciding. Raw O1/D1 values remain in answers.';
comment on column arcs.status is
    'open until the branch floor is met and the outcome is resolved. still_deciding and live-urge arcs stay open. Reopening a complete arc for late honesty does not flip status back — answers upsert regardless.';
comment on column arcs.occurred_at is
    'When the incident happened, denormalized from the T1 answer for querying (answered_at on T1 is when it was logged, not when it happened).';
comment on column arcs.tags is
    'Deterministic tags from the config''s tag_rules (e.g. broke-own-rule), recomputed by code whenever a contributing answer changes.';

create index arcs_user_occurred_idx on arcs (user_id, occurred_at desc);
create index arcs_user_open_idx     on arcs (user_id) where status = 'open';
create index arcs_tags_idx          on arcs using gin (tags);

create table answers (
    arc_id        uuid not null references arcs(id) on delete cascade,
    node_id       text not null,
    tree_version  integer not null references tree_versions(version),
    value         jsonb not null,
    answered_at   timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    primary key (arc_id, node_id)
);
comment on table answers is
    'One row per (arc, node). Re-answering — including reopening an arc days later — upserts the row. value shapes by input_type are documented in the repo README.';
comment on column answers.tree_version is
    'Version of the tree the answer was captured under; an arc reopened after a config push may hold answers from several versions.';

create index answers_node_idx on answers (node_id, tree_version);

-- Keep updated_at honest on every write.
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger arcs_touch_updated_at
    before update on arcs
    for each row execute function set_updated_at();

create trigger answers_touch_updated_at
    before update on answers
    for each row execute function set_updated_at();

-- Canonical answer upsert (arcs reopenable; late honesty always welcome):
--
--   insert into answers (arc_id, node_id, tree_version, value)
--   values ($1, $2, $3, $4)
--   on conflict (arc_id, node_id) do update
--      set value        = excluded.value,
--          tree_version = excluded.tree_version,
--          answered_at  = now();
