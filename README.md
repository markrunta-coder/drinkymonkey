# Drinkchart — Incident Tree design artifacts

Design artifacts for the deterministic, versioned incident-logging tree
(spec: `docs/Drinkchart_Incident_Tree_Spec_v0.1.md`). No app code, no UI,
no AI at runtime.

| Path | What it is |
|---|---|
| `schema/tree-config.schema.json` | JSON Schema for tree configs (documentation + IDE validation) |
| `config/tree.v1.json` | Seed tree v1 — the spec's node catalog, spawn rules, and floors, verbatim |
| `db/schema.sql` | Postgres DDL: `users`, `tree_versions`, `arcs`, `answers` |
| `tools/lint-tree.mjs` | Config lint — the source of truth for validity (zero dependencies) |

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

## Decisions made where the spec left room (flag anything wrong)

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
5. **`tag_rules` is a top-level section** — the B4 × O1 → `broke-own-rule`
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

## Open questions for the product owner

- Should a live-urge arc left unresolved get the same one-dismissible
  next-morning nudge as arcs missing the after moment (spec open decision 5)?
- B1's merged "social" driver vs. the brief's 1:1 driver→action rule: the
  action library distinguishes social *pressure* from social *connection* —
  either split the option in v1 or define a merged action mapping.
- Where do "delayed"-resolved arcs land in dashboard metrics (they are absent
  from the spec's traceability table)?
