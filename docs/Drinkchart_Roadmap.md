# Drinkchart — Roadmap to Production

**July 2026 · From current state through App Store push.**
Assumes indie pace (CC throughput + ~10–15 hrs/week of product attention). Calendar estimate to store push: **~14–18 weeks**, with clinical review the wildcard. Sequence is firm; durations are estimates.

---

## Four parallel tracks

**Track A — Design & content** (design chat + Babloo): everything authored as data for the build.
**Track B — Build** (CC): app, backend, engine.
**Track C — External** (Babloo drives): expert validation, clinical input, legal/policy.
**Track D — Acquisition** (parallel from day one, per the brief): content targeting the "why do I drink" question space; waitlist.

---

## Phase 0 — Foundation ✅ / in flight
Validation brief, incident tree spec rev B, tree config + schema + DDL + lint + preview + smoke, tech stack locked. Brief 003 (onboarding + AUDIT-C config) in flight.

## Phase 1 — Content authoring (Track A; starts now, overlaps everything)
- Incident assessment content set: driver-keyed "why this session probably happened / what it provided / what it cost," in the locked voice
- Embedded mind/body content set (generalized, hedged, cost-then-recovery narration)
- Action library final wording (8 driver-mapped actions)
- Trend-detection rule catalog (deterministic rules, template narrations)
- Safety: thresholds + programmatic message copy → **hand to clinical review immediately (longest external lead)**
- Expert validation round on the brief (Section 12 questions out; fold answers back into content)

**Gate G1:** assessment content + action library approved; clinical feedback on safety thresholds received.

## Phase 2 — App scaffold + capture loop (Track B; ~3–4 wks) ← Brief 004
- Expo scaffold (TS), Supabase wiring, anonymous-first auth, RLS policies
- Generic renderer ported to RN components (parity with preview harness: floor meter, spawns, 3-card cap, skip, free text, tags)
- Full capture flow: all four paths, local draft persistence, offline queue, canonical upsert sync
- Onboarding flow + AUDIT-C scoring
- Home: last-incident summary skeleton

**Gate G2:** capture loop on a device; founder dogfooding daily. Nothing else proceeds until logging feels right in real moments — this is the product.

## Phase 3 — Assess + dashboard (Track B; ~3 wks)
- Incident assessment surface rendering the Phase-1 content (deterministic, persisted) + "does this feel accurate?" loop
- Metrics dashboard from `arcs_for_metrics`
- Morning nudge (single, dismissible, `nudged_at`)
- Goals surface: neutral default, directional selection, action offer from the closed library

## Phase 4 — Trends + safety (Track B; ~2–3 wks)
- Trend-rule engine + **template-based narration** (no live AI at launch; AI narrator/validator is post-launch behind a flag)
- Safety pattern triggers + clinically reviewed programmatic messaging + routing surface

## Phase 5 — Hardening + beta (~3–4 wks calendar, overlaps P4)
- Privacy: data export + account deletion (Apple requirement), RLS audit
- Sentry, performance, offline edge cases
- TestFlight beta with 20–30 target-segment users
- **Gate G4 — the kill metric, instrumented from our own DB:** do beta users log their bad nights, and are they still logging in week 4? This answers the thesis ("does the mirror reveal patterns they didn't see?"). Weak numbers = fix capture/assessment before any launch spend.

## Phase 6 — Store readiness + launch (~2 wks + review cycles)
- RevenueCat + paywall (1–2 months free → $10/mo), restore purchases
- App Store package: 17+ age rating (alcohol references), privacy nutrition labels, health-disclaimer surfaces, ToS/Privacy Policy (external review — Track C), review notes stating wellness/self-insight positioning, not medical device
- iOS-first launch; **Android fast-follow** after iOS stabilizes (halves store overhead at launch; target demo skews iPhone)
- Submit → review cycles → production push

## Post-launch (v1.x)
AI narration behind flag (narrator → validator → code checks → fallback, per containment architecture); approved-response library promotion; Dry-January/Sober-October acquisition pushes; wearables exploration (the eventual moat).

---

## Track D — Acquisition (runs the whole time)
Landing page + waitlist early in Phase 2 (CC can build; doubles as SEO seed). Content pipeline on the "why do I drink" question space from Phase 3 onward. Beta recruits from sober-curious communities — the beta *is* the first acquisition test. Launch aims at a seasonal moment if timing allows.

## Decision defaults baked in (override deliberately)
iOS-first with Android fast-follow · anonymous-first auth · template-only trends at launch, AI post-launch · no third-party behavioral analytics.

## External dependencies to start now
Clinical reviewer(s) for safety thresholds/copy and action library · expert reviewers for the validation brief · ToS/privacy policy review before submission.
