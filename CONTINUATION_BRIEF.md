# CC CONTINUATION BRIEF — Drinkchart

**July 11, 2026 · State of the build after Briefs 001–004 + SDK pin.**
Read this first in any new session; then the canonical docs in `docs/`
(Design Validation Brief, Incident Tree Spec **rev B**, Tech Stack **locked**,
Roadmap). The user directs work via numbered "CC BRIEF" messages with
explicit dispositions; do not re-litigate decided items.

---

## 1. What Drinkchart is (one paragraph)

An alcohol self-insight app — a **neutral mirror**, journal-first,
direction-neutral. The tracked object is the *arc of a struggle*
(before / fight / after; outcome drank / resisted / delayed), not the drink.
Governing constraints: deterministic runtime, versioned JSON configs rendered
generically (new tree = config push, never an app release), capture floor
≤ 3 taps, **no AI anywhere at runtime**, safety messaging programmatic-only,
snake_case for all tags/machine names.

## 2. Done and verified (Briefs 001–004)

| Track | State |
|---|---|
| Incident tree | CLOSED. `config/tree.v1.json` — 27 nodes, 4 conditionals (F1→F2/F3, B4×O1→`broke_own_rule`, D1 branch resolution, B1=social→B1a), tags `broke_own_rule` / `delayed_first` / `live_capture` |
| Onboarding | CLOSED. `config/onboarding.v1.json` — linear flow, 5-tap required path, AUDIT-C verbatim (scores 0–4), goal preselected `understand_my_drinking`; thresholds are CONFIG VALUES in `scoring.audit_c.bands`, **PROVISIONAL pending clinical review** (elevated ≥3 women / ≥4 default, high ≥7) |
| Schema/engine | `schema/tree-config.schema.json` covers incident + linear flows; `tools/lint-tree.mjs` enforces per-flow rules; `tools/scoring.mjs` pure scoring |
| Preview/tests | `tools/preview.html` (config picker, both flows); `tools/smoke-preview.mjs` — 57 checks green |
| Database | Live on Supabase project **momentum_engine** (`uofnnmixmjqhoumbbcfe`), migration `drinkchart_init`, all tables **`dc_` prefixed**, RLS on (owner via `auth.uid()`, configs read-only). v1 configs published in `dc_tree_versions` / `dc_onboarding_versions`. `db/schema.sql` is canonical |
| App (Phase 2) | `app/` — Expo managed, TypeScript, **SDK 54** (pinned for the test iPhone's Expo Go; matches HomeIsFine). Pure engine in `app/src/engine/` (no React imports), generic `FlowRenderer` for both flows, all four capture paths, AsyncStorage drafts (arc survives kill), offline queue → canonical `(arc_id,node_id)` upsert, anonymous-first auth + Keychain device UUID, onboarding → `dc_profiles`/`dc_goals`, home skeleton, **local-only** morning nudge honoring `nudged_at` (one per arc, ever) |
| Verification | Jest 3 suites / 27 tests (incl. all 57 parity checks), tsc + ESLint clean, iOS export bundles, RLS proof script passed live 19/19 (`app/scripts/rls-check.mjs`) |

Git: `master` @ `ebd21d9`, pushed to github.com/markrunta-coder/drinkymonkey.
History is one reviewable commit per brief chunk.

## 3. Blocked on the owner (do these before dogfooding)

1. **Enable anonymous sign-ins**: Supabase dashboard → project
   `momentum_engine` → Authentication → Sign In / Providers → Anonymous.
   Code is wired; until flipped the app runs local-only and queues writes.
2. Delete throwaway RLS test users `dc.rls.test.a/b@gmail.com` afterwards.
3. **Gate G2 dogfooding** (roadmap): `cd app && npx expo start`, scan with
   Expo Go on the test iPhone. Nothing else proceeds until logging feels
   right in real moments — this is the product.

## 4. Standing risks / flags (decided or deferred, not forgotten)

- **Co-tenancy**: placement in momentum_engine was an explicit directive and
  contradicts the locked tech-stack ruling (separate project). That project
  has ~78 RLS-off trading tables reachable by the anon key the app ships.
  Revisit before any external user; `db/schema.sql` + a `supabase/` CLI
  structure make the move cheap.
- **Provisional thresholds**: AUDIT-C bands await clinical review (Track C,
  the longest external lead — should already be in flight).
- **Spec header nit**: docs spec says "rev B" in the header now; keep tag
  spellings snake_case everywhere.
- Phase-2 known limits: fully-offline arcs appear in Home lists only after a
  queue flush; datetime entry is a plain ISO text field.

## 5. Next up (roadmap Phase 3, after G2 passes)

Awaiting **Brief 005** — expected scope per roadmap:
- Incident assessment surface rendering the Phase-1 authored content
  (deterministic, persisted; "does this feel accurate?" loop). Content
  arrives design-side **as data — do not stub it**.
- Metrics dashboard reading `dc_arcs_for_metrics` (effective outcome;
  still-deciding excluded; delay-success via `delayed_first`).
- Goals surface (neutral default; directional choice unlocks the closed
  action library — library arrives as data).
- Morning-nudge polish against real dogfooding feedback.

Also parallel: landing page + waitlist (Track D) can start any time.

## 6. Ground rules for any new session (recap)

Deterministic only; no AI at runtime; config is data — never hard-code a
question or threshold; every config change must pass
`node tools/lint-tree.mjs <config>` and `node tools/smoke-preview.mjs`;
app changes must keep tsc/ESLint/Jest green; Windows host — no iOS
simulator, verify headlessly; commit in reviewable chunks; snake_case
machine names; the mirror never tells the user what to do (single exception:
programmatic withdrawal caution, authored design-side).
