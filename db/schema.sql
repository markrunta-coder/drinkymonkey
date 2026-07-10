-- Drinkchart — data model (Postgres / Supabase)
-- All tables carry the dc_ prefix: Drinkchart shares the Momentum_engine
-- Supabase project, so the prefix marks which tables belong to this app.
--
-- Identity: Supabase auth (anonymous-first) — auth.users is the anchor;
-- there is no separate app users table. RLS is on from day one: users own
-- their rows; config tables are read-only to clients.
--
-- Principles (from Incident Tree Spec v0.1 rev B):
--   * The tree is data: dc_tree_versions / dc_onboarding_versions hold each
--     published config verbatim. Publishing = inserting a row, never updating.
--   * Answers are keyed (arc_id, node_id) and record the tree_version they
--     were captured under, so old incidents stay interpretable.
--   * Arcs are reopenable: reopening is just another upsert into dc_answers.
--   * Tags are snake_case machine names (rev B ruling): broke_own_rule,
--     delayed_first, live_capture.

-- ============================================================ config stores

create table dc_tree_versions (
    version       integer primary key check (version >= 1),
    config        jsonb not null,
    notes         text,
    published_at  timestamptz not null default now()
);
comment on table dc_tree_versions is
    'Published incident-tree configs, verbatim. Append-only; rollback = pointing clients at a previous version.';

create table dc_onboarding_versions (
    version       integer primary key check (version >= 1),
    config        jsonb not null,
    notes         text,
    published_at  timestamptz not null default now()
);
comment on table dc_onboarding_versions is
    'Published onboarding (linear-flow) configs, incl. AUDIT-C items and PROVISIONAL screening thresholds as config values. Append-only.';

-- ================================================================== capture

create table dc_arcs (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references auth.users(id) on delete cascade,
    tree_version  integer not null references dc_tree_versions(version),
    outcome       text check (outcome in ('drank', 'resisted', 'delayed')),
    status        text not null default 'open' check (status in ('open', 'complete')),
    occurred_at   timestamptz,
    tags          text[] not null default '{}',
    nudged_at     timestamptz,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
comment on table dc_arcs is
    'One arc = one incident (the struggle, not the drink). Live-urge arcs (E1) start with outcome null and status open.';
comment on column dc_arcs.outcome is
    'Effective outcome, maintained by code from O1/D1 answers: null until logged; ''delayed'' becomes drank/resisted when D1 resolves; stays ''delayed'' (status open) on still_deciding. Raw O1/D1 values remain in dc_answers.';
comment on column dc_arcs.tags is
    'Deterministic tags from the config''s tag_rules, recomputed by code whenever a contributing answer changes. broke_own_rule = B4 intention x drank outcome; delayed_first = O1 was delayed (preserved after D1 resolves for the delay-success metric); live_capture = arc opened via E1.';
comment on column dc_arcs.nudged_at is
    'Nudge policy (Brief 002 d.5 / Brief 004 addendum): ONE dismissible next-morning LOCAL notification per arc, unified across drank arcs missing the after moment and unresolved live-urge arcs. Scheduled on-device at capture time, cancelled on resolution; non-null means never nudge this arc again.';
comment on column dc_arcs.occurred_at is
    'When the incident happened, denormalized from the T1 answer for querying.';

create index dc_arcs_user_occurred_idx on dc_arcs (user_id, occurred_at desc);
create index dc_arcs_user_open_idx     on dc_arcs (user_id) where status = 'open';
create index dc_arcs_tags_idx          on dc_arcs using gin (tags);

create table dc_answers (
    arc_id        uuid not null references dc_arcs(id) on delete cascade,
    node_id       text not null,
    tree_version  integer not null references dc_tree_versions(version),
    value         jsonb not null,
    answered_at   timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    primary key (arc_id, node_id)
);
comment on table dc_answers is
    'One row per (arc, node). Re-answering — including reopening an arc days later — upserts the row. Canonical upsert:
     insert into dc_answers (arc_id, node_id, tree_version, value) values ($1,$2,$3,$4)
     on conflict (arc_id, node_id) do update
       set value = excluded.value, tree_version = excluded.tree_version, answered_at = now();';

create index dc_answers_node_idx on dc_answers (node_id, tree_version);

-- ============================================================== onboarding

create table dc_profiles (
    user_id             uuid primary key references auth.users(id) on delete cascade,
    age_band            text not null,
    gender              text,
    drinks_week_band    text not null,
    drinking_since      text,
    audit_c_score       integer not null check (audit_c_score between 0 and 12),
    screen_band         text not null check (screen_band in ('none', 'elevated', 'high')),
    device_uuid         text,
    onboarding_version  integer not null references dc_onboarding_versions(version),
    onboarded_at        timestamptz not null default now(),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);
comment on table dc_profiles is
    'Onboarding results. Band columns hold the option values of the onboarding config version recorded in onboarding_version.';
comment on column dc_profiles.screen_band is
    'From screen_band(audit_c_score, gender) with thresholds read from the onboarding config — PROVISIONAL pending clinical review. Mechanism only: safety copy and routing are authored design-side.';
comment on column dc_profiles.device_uuid is
    'Stable device UUID from Keychain (expo-secure-store), survives reinstall — continuity/dedupe alongside anonymous auth (Brief 004 addendum).';

create table dc_goals (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    goal_type   text not null check (goal_type in (
                    'understand_my_drinking', 'reduce_overall', 'fewer_heavy_sessions',
                    'more_af_days', 'fewer_consecutive_days', 'longer_gaps',
                    'earlier_stop', 'weekly_max')),
    started_at  timestamptz not null default now(),
    ended_at    timestamptz,
    created_at  timestamptz not null default now()
);
comment on table dc_goals is
    'Goal history, never deleted. Changing goals = end the active row (ended_at) and insert the new one. Default at onboarding: understand_my_drinking (neutral; suggestions stay locked until a directional goal is chosen).';

-- Exactly one active goal per user.
create unique index dc_goals_one_active_idx on dc_goals (user_id) where ended_at is null;
create index dc_goals_user_idx on dc_goals (user_id, started_at desc);

-- ================================================================= triggers

create or replace function dc_set_updated_at() returns trigger
language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger dc_arcs_touch_updated_at
    before update on dc_arcs
    for each row execute function dc_set_updated_at();
create trigger dc_answers_touch_updated_at
    before update on dc_answers
    for each row execute function dc_set_updated_at();
create trigger dc_profiles_touch_updated_at
    before update on dc_profiles
    for each row execute function dc_set_updated_at();

-- ==================================================================== views

-- Metrics ruling (spec rev B section 6): all consumption metrics and the
-- resisted-vs-drank ratio read the EFFECTIVE outcome. delayed -> drank anyway
-- counts as drank; delayed -> didn't drink counts as resisted (a win), with
-- the delayed_first tag preserved for the delay-success metric.
-- "Still deciding" arcs are excluded from all metrics until resolved; they
-- live only in the open-arc queue.
create view dc_arcs_for_metrics
with (security_invoker = true) as
select *
from dc_arcs
where outcome in ('drank', 'resisted');
comment on view dc_arcs_for_metrics is
    'The only arc source metrics may read. outcome here is already effective. delay-success rate = count(outcome = ''resisted'' and ''delayed_first'' = any(tags)) / count(''delayed_first'' = any(tags)). security_invoker: RLS of the querying user applies.';

create view dc_open_arc_queue
with (security_invoker = true) as
select *
from dc_arcs
where status = 'open';
comment on view dc_open_arc_queue is
    'Unresolved arcs: still-deciding delays and live-urge captures awaiting an outcome. Invisible to metrics. The (local) next-morning nudge reads this queue plus drank arcs missing the after moment, and skips any arc with nudged_at set.';

-- ====================================================================== RLS
-- Client talks to Supabase directly under RLS — no API tier (tech stack doc).

alter table dc_tree_versions       enable row level security;
alter table dc_onboarding_versions enable row level security;
alter table dc_arcs                enable row level security;
alter table dc_answers             enable row level security;
alter table dc_profiles            enable row level security;
alter table dc_goals               enable row level security;

-- Configs: readable by any signed-in client (incl. anonymous); publish is
-- service-role only (no insert/update/delete policies).
create policy dc_tree_versions_read on dc_tree_versions
    for select to authenticated using (true);
create policy dc_onboarding_versions_read on dc_onboarding_versions
    for select to authenticated using (true);

-- User-owned rows: full access to the owner, nothing to anyone else.
create policy dc_arcs_owner on dc_arcs
    for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy dc_answers_owner on dc_answers
    for all to authenticated
    using (exists (select 1 from dc_arcs a where a.id = arc_id and a.user_id = auth.uid()))
    with check (exists (select 1 from dc_arcs a where a.id = arc_id and a.user_id = auth.uid()));

create policy dc_profiles_owner on dc_profiles
    for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy dc_goals_owner on dc_goals
    for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
