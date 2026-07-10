# Drinkchart — Incident Tree design artifacts

Design artifacts for the deterministic, versioned incident-logging tree
(spec: `docs/Drinkchart_Incident_Tree_Spec_v0.1.md`, **rev B** — canonical).
No app code, no AI at runtime.

| Path | What it is |
|---|---|
| `schema/tree-config.schema.json` | JSON Schema for flow configs — incident trees and linear flows (onboarding) |
| `config/tree.v1.json` | Seed incident tree v1 — the spec's node catalog, spawn rules, and floors, verbatim |
| `config/onboarding.v1.json` | Onboarding flow v1 — profile bands, AUDIT-C verbatim, goal selection |
| `db/schema.sql` | Postgres DDL (Supabase, `dc_` prefix, RLS): arcs, answers, profiles, goals, config stores, views |
| `tools/lint-tree.mjs` | Config lint — the source of truth for validity (zero dependencies) |
| `tools/scoring.mjs` | Pure AUDIT-C scoring: `auditC(q1,q2,q3)` → 0–12, `screenBand(score, gender, bands)` |
| `tools/preview.html` | Click-testable preview of any config — renders the canonical JSON generically |
| `tools/smoke-preview.mjs` | Headless test: capture floors, spawns, tags, onboarding flow, scoring |

## Preview harness

`tools/preview.html` renders the real `config/tree.v1.json` — one canonical
config, no embedded copy. Serve the repo root (`python -m http.server`) and
open `/tools/preview.html`; opened straight from disk it falls back to a file
picker (browsers block fetch on `file://`). It keeps the floor meter, spawn
behavior, 3-card cap, skip semantics, tag display, and a live arc-JSON
inspector whose `answers` are the exact jsonb shapes the database stores.
Every future tree version is click-testable by pointing it at the new config.
A headless smoke test drives all four presets through their floors, including
the delayed→drank 4-tap redirect and tag preservation.

## How a new tree version ships (no app release)

The app renders any valid config generically, so the tree evolves by config
push alone:

1. **Copy, never mutate.** `config/tree.v1.json` → `config/tree.v2.json`;
   bump `tree_version`. A published config file is immutable.
2. **Evolve additively.** Node ids and option values are stable forever —
   never reuse or repurpose one. Add nodes and options freely; retire a node
   by omitting it from the new version. Old answers stay interpretable because
   each carries the `tree_version` it was captured under.
3. **Lint.** `node tools/lint-tree.mjs config/tree.v2.json` — must exit 0.
   It enforces: unique ids, valid spawn targets and `if_value`s, no cycles,
   spawn-chain depth ≤ 3, floor ≤ 3 required nodes per branch, required-nodes-
   only-in-floors, and full reachability (a node nothing renders is an error).
4. **Publish.** `insert into tree_versions (version, config) values (2, '<json>');`
   Published rows are never updated or deleted.
5. **Clients pick it up.** At session start the app fetches the highest
   version and renders it. New answers persist with version 2; arcs opened
   under v1 simply continue — each answer records its own version.
6. **Rollback** = pointing clients back at the previous version row.

Forward-compatibility rule for the renderer: ignore unknown node fields, and
fall back to hiding any node whose `input_type` it does not recognize —
that is what lets future config versions add capabilities without stranding
old app builds.

## Onboarding as a config (Brief 003)

Onboarding is the same engine: `config/onboarding.v1.json` is a **linear
flow** (`"flow": "linear"`) rendered by the same generic renderer. Schema
extensions that made this possible (all minimal, all documented in the schema
itself): `flow` (incident | linear), linear moments (`profile`/`audit`/`goal`),
a `main` branch with an ordered `sequence`, `default_value` (the goal
preselects `understand_my_drinking`), per-option `score`, and a top-level
`scoring` section. Lint enforces floor ≤ 3 for incident flows and ≤ 8 for
linear flows; the shipped required path is **5 taps** (age, drinks/week,
AUDIT-C ×3 — goal is preselected).

**Scoring.** AUDIT-C items carry `score: 0–4` on their options; the total is
0–12. Thresholds are **config values, never code**, in
`scoring.audit_c.bands` — currently *elevated* ≥ 3 (women) / ≥ 4 (men, other,
or gender skipped), *high* ≥ 7. **These bands are PROVISIONAL pending
clinical review.** `tools/scoring.mjs` is the pure mechanism
(`auditC`, `screenBand`, `scoreInstrument`); it contains no safety copy and
no routing — programmatic safety messaging is authored design-side.

**Naming ruling (rev B):** all tags and machine names are snake_case —
`broke_own_rule`, `delayed_first`, `live_capture`. The schema and lint
enforce the pattern.

## Answer value shapes (`answers.value` jsonb)

| input_type | Shape | Example |
|---|---|---|
| tap | `{"value":"tapped"}` | E1 (timestamp = `answered_at`) |
| single | `{"value":...}` + `"text"` when `allow_free_text` | A2: `{"value":"regret","text":"…"}` |
| single + `allow_secondary` | `{"value":...,"secondary":...}` | B1: `{"value":"stress","secondary":"boredom"}` |
| multi | `{"values":[...]}` + optional `"text"` | F5: `{"values":["trapped","resigned"]}` |
| chips | `{"value":...}` or `{"value":"exact","number":n}` | QTY: `{"value":"3_4"}` |
| option with `requires_datetime` | adds `"datetime"` (ISO 8601) | T1: `{"value":"custom","datetime":"2026-07-09T22:30:00Z"}` |
| number | `{"number":n}` | |
| text | `{"text":"…"}` | A5 |

## Decisions made where the spec left room (approved, Brief 002)

1. **`input_type` gains `tap`** — the spec's E1/E2 entry type, absent from the
   brief's enum.
2. **B3 is split into `B3A` (where) + `B3B` (who), joined by `card_group`** —
   the spec's "two singles" on one card, kept as two nodes so each answer
   persists independently.
3. **B1's "single primary + optional 1 secondary" is `allow_secondary`** on a
   single-select, persisting `{primary, secondary}` in one answer.
4. **The spec's "+text" notation is `allow_free_text`** (node-level companion
   field); "other+text"-style options use option-level `requires_text`.
   QTY "exact #" and T1 "pick date-time" use `requires_number` /
   `requires_datetime` the same way.
5. **`tag_rules` is a top-level section** — the B4 × O1 → `broke_own_rule`
   conditional produces a tag, not a node, so `spawn_rules` cannot express it.
   Tags are recomputed by code whenever a contributing answer changes.
6. **`spawn_rules` gains `then_branch` and `then_action:"keep_open"`** for D1:
   "drank anyway" / "didn't drink" redirect the arc into the target branch's
   remaining floor and cards; "still deciding" leaves the arc open.
   Consequence: delayed → drank costs 4 taps total, but each branch's own
   floor stays ≤ 3, which is how the spec's floor table counts it.
7. **Depth is defined as nodes in a conditional spawn chain** (E2 → O1 → D1
   is exactly 3, the v1 maximum). The linear floor is bounded by the separate
   floor ≤ 3 rule.
8. **A4 is a distinct node id** (F5's turmoil options re-asked in the after
   moment) so fight-time and after-time answers coexist on one arc.
9. **`arcs.outcome` stores the *effective* outcome** — `delayed` resolves to
   `drank`/`resisted` when D1 is answered; raw O1/D1 values remain in
   `answers`. `arcs.occurred_at` is denormalized from T1 for querying.
10. **Live-urge arcs (E1)** open with `outcome` null and `status` open; the
    user resolves them later through the normal O1 flow on the same arc.
11. **Versions are integers**, not semver — configs are append-only and
    total-ordered; there is nothing for a patch/minor distinction to express.
12. **B1a is the fourth v1 conditional** (Decision 1, Brief 002): a single
    "social" chip drills into *going along / enjoying the company*, restoring
    the 1:1 driver→action mapping. Node ids allow a lowercase drill-down
    suffix (`B1a`); tag names match the spec's spelling exactly
    (superseded by the rev B snake_case ruling: `broke_own_rule`, `delayed_first`).

## Resolved decisions (Brief 002 — none remaining open)

- **Metrics ruling** (spec rev B §6): all consumption metrics and the
  resisted-vs-drank ratio read the arc's *effective* outcome; the
  `delayed_first` tag (set by a `tag_rules` entry on O1) feeds the
  delay-success metric; still-deciding arcs are excluded from all metrics and
  live only in the open-arc queue. Encoded as the `arcs_for_metrics` and
  `open_arc_queue` views in `db/schema.sql`.
- **Nudge policy** (Decision 5): ONE dismissible next-morning notification
  per arc, unified across drank arcs missing the after moment and unresolved
  live-urge arcs — tracked by `arcs.nudged_at`; non-null means never again.
- **Quantity bands** confirmed: 1–2 / 3–4 / 5–6 / 7–9 / 10+ / exact number.
- **Delayed** confirmed as built: resolvable; still-deciding keeps the arc open.
- **Onboarding** drops weight/height; **driver start-set** is the spec's
  8 + other; **backend** is Postgres/Supabase as drafted.
