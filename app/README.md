# Drinkchart app (Brief 004 — Phase 2 scaffold + capture loop)

Expo managed workflow, TypeScript. The app is a **generic renderer over the
versioned configs** — behavior parity with `tools/preview.html`, verified by
porting every check in `tools/smoke-preview.mjs` into Jest
(`src/engine/__tests__/smoke-parity.test.ts`). Deterministic throughout; **no
AI calls anywhere**; client → Supabase **direct under RLS** — no API tier, no
service-role key anywhere in this directory.

## Run

```
cd app
npm install
cp .env.example .env      # publishable values; env preferred over the code fallback
npx expo start            # Expo Go on a device, or a dev build
```

Verification (none of it needs a simulator):

```
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (eslint-config-expo flat)
npm test            # jest — pure engine only (57 ported reference checks + guards)
npm run rls-check   # RLS proof against the live project (see below)
```

## Structure

| Path | What it is |
|---|---|
| `src/engine/` | **Pure logic, no React imports** (guarded by a test): requiredIds, effOutcome, floorMet, answeredComplete, tag rules, instrument scoring (port of `tools/scoring.mjs` — thresholds read from config, never code), immutable session transitions, occurred_at denormalization |
| `src/ui/FlowRenderer.tsx` | Generic RN renderer: floor meter, inline `then_node` spawns, 3-card cap with “+ more”, skip, `card_group`, `allow_secondary`, `allow_free_text`, `requires_text/number/datetime`, `default_value`, tag display |
| `src/screens/` | Capture (all four entry paths), Onboarding (same renderer, linear flow), Home skeleton, Settings (upgrade stubs), Dashboard stub |
| `src/lib/` | supabase client, anonymous auth + device UUID, config store, db layer, offline queue, draft persistence, local morning nudge |
| `src/config/bundled/` | Byte-identical copies of `config/*.v1.json` (`npm run sync-config`; drift fails a Jest guard) |
| `scripts/rls-check.mjs` | Two-session RLS proof with the anon key only |

## Decisions (Brief 004 asked for these to be documented)

**Navigation: `@react-navigation/native-stack`, hand-rolled from the blank
TypeScript template.** expo-router's file-based routing buys little for five
screens and would couple the renderer to the filesystem; a typed stack
(`src/navigation.ts`) is the smallest thing that works.

**Supabase config: `.env` via Expo's `EXPO_PUBLIC_*` inlining** (see
`.env.example`; `.env` is gitignored). `src/lib/supabaseClient.ts` falls back
to the committed publishable key so a fresh clone runs — the publishable/anon
key is safe to expose (everything is behind RLS), but env wins so key rotation
never needs a code change. **Never** put a service-role key anywhere in `app/`.

**db/schema.sql stays canonical; no `supabase/` CLI migrations directory
(for now).** The DDL is already applied to the shared `momentum_engine`
project as migration `drinkchart_init`, and the tech-stack doc rules the
co-tenancy should be revisited before launch. Adopting the Supabase CLI
structure is the natural move **when Drinkchart gets its own project** — at
that point `db/schema.sql` becomes `supabase/migrations/0001_init.sql`
verbatim. Until then a second copy of the DDL would only invite drift.

**Config source at runtime:** fetch the highest published version from
`dc_tree_versions` / `dc_onboarding_versions` at session start → cache in
AsyncStorage → fall back to the bundled copies. New tree versions reach
clients as a config push, never an app release.

**Datetime entry (`requires_datetime`, T1 “pick date & time”) is a plain ISO
text field** for Phase 2 — structure over polish; avoids a native
datetime-picker dependency that can't be exercised without a device. Swap for
a real picker during dogfooding polish.

**occurred_at conventions** (spec decision 9, engine `occurredAtFromT1`):
`just_now`/`earlier_today` → now; `last_night` → yesterday 21:00 local;
`yesterday` → yesterday 12:00 local; `custom` → the picked datetime.

## Capture persistence model

- **Write-through draft:** every answer mutation rewrites the AsyncStorage
  draft — an in-progress arc survives app kill; Home offers “resume”.
- **Offline queue:** every mutation also enqueues (a) the arc row implied by
  the engine (effective outcome, status, occurred_at, tags) and (b) per-answer
  upserts/deletes, coalesced by key, flushed FIFO on capture, app start, and
  every return to Home. Answers sync via the canonical upsert
  (`.upsert(..., { onConflict: "arc_id,node_id" })`).
- **Reopen:** open arcs list on Home; reopening loads the arc's answers and
  continues on the same arc — re-answering is just another upsert.
- **Known Phase-2 limit:** an arc captured fully offline lives in the queue
  (and draft) until a flush succeeds; the Home lists read the server, so it
  appears there only after sync.

## Morning nudge (LOCAL notifications only — addendum)

`expo-notifications.scheduleNotificationAsync`, scheduled **at capture time**
for any arc that needs it (open arc, or drank arc missing its after moment),
fire time = next 09:00 local at least an hour away. Cancelled on resolution.
`nudged_at` is set when the nudge is scheduled and never cleared — **one
nudge per arc EVER**, even across reopen (the server value is threaded
through reopen and drafts). No push tokens, no server sends; nothing about an
open arc leaves the device to trigger a reminder.

Note: local scheduled notifications need a real device (Expo Go on iOS works;
simulators don't deliver). Nothing in CI verification depends on them.

## Setup steps a human must do

1. **Enable anonymous sign-ins** in the Supabase dashboard for project
   `uofnnmixmjqhoumbbcfe`: Authentication → Sign In / Providers → “Allow
   anonymous sign-ins”. The code path (`supabase.auth.signInAnonymously()`)
   is wired and the session persists in AsyncStorage, but the project
   currently returns `anonymous_provider_disabled` and this setting is not
   reachable through the tooling available to CC. Until it's flipped, the app
   runs in local-only mode (queue holds writes; nothing syncs).
2. Optional cleanup: two throwaway RLS test users exist on the project
   (`dc.rls.test.a@gmail.com`, `dc.rls.test.b@gmail.com`, password in
   `scripts/rls-check.mjs`). They were needed because anonymous sign-in is
   disabled; once it's enabled, `rls-check` uses anonymous sessions and the
   users can be deleted.
3. Before launch: revisit the shared-project co-tenancy (tech-stack doc rules
   “separate Supabase project, no co-tenancy”; current placement follows an
   explicit directive).

## RLS check

`npm run rls-check` creates two sessions with the anon key and proves: A can
insert/select own `dc_arcs`/`dc_answers`/`dc_profiles`/`dc_goals`; B sees 0 of
A's rows and cannot update/delete/forge them; both read `dc_tree_versions`
but cannot insert into it (19 checks). It tries anonymous sign-in first and
falls back to the pre-provisioned email users while anonymous is disabled.
Last run: **all 19 checks passed** (email-fallback sessions).

## Account upgrade (stub)

Settings lists “Sign in with Apple” and “email magic link” as disabled/coming
soon — deliberately unimplemented in Phase 2 (anonymous-first posture).
