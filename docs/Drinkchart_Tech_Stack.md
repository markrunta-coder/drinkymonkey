# Drinkchart — Tech Stack (Locked)

**July 2026 · Changes to this document require a deliberate decision, not drift.**

## Client
**React Native + Expo (managed workflow), TypeScript.** One codebase for iOS and Android. Chosen for: push notifications (the morning nudge requires real push, which a PWA cannot deliver reliably on iOS), OTA updates for config/copy iteration, EAS builds suited to an indie operation, and direct reuse of the existing JS/TS repo conventions and renderer logic.

## Backend
**Supabase (Postgres).** Already carries the DDL, views, and migrations. Provides auth, row-level security, and storage as needed. **Auth posture: anonymous-first** — a shame-sensitive product must be usable before any identity is created; account upgrade (Sign in with Apple / email) comes when the user wants sync or backup. RLS on from day one: users own their rows.

**Architecture ruling: client → Supabase direct, under RLS. No API middle layer.** Drinkchart v1 is CRUD on user-owned rows with no third-party side effects, so RLS is the correct boundary — no serverless function tier, no service-role key in the hot path, no keep-warm cron. Edge Functions enter only where genuine server-side logic exists (post-launch AI layer, IAP webhooks). This deliberately diverges from HomeIsFine's Twilio-Functions-mediated model, which earns its layer through messaging side effects Drinkchart doesn't have. Borrowed from HomeIsFine: a stable device UUID in Keychain via expo-secure-store (survives reinstall) for continuity and dedupe alongside anonymous auth. Separate Supabase project from HomeIsFine — no co-tenancy.

## Engine pattern (stack-agnostic by design)
Versioned JSON configs + a generic renderer; deterministic runtime; no AI anywhere in capture, assessment, metrics, or safety. New tree/onboarding versions ship as config, never as app releases. The lint and smoke-test harness guard every config change.

## Notifications
**Local scheduled notifications, not push, for v1.** The morning nudge is deterministic and fully device-knowable (arc open or missing its after-moment → schedule locally at capture time, cancel on resolution, respect `nudged_at`). No push tokens, no server sends, nothing about an open arc leaves the device to trigger a reminder — simpler and more private. Push infrastructure is deferred until a genuinely server-initiated message exists (none in v1). Pattern proven in HomeIsFine.

## Payments
**RevenueCat** over StoreKit/Play Billing. Subscriptions must go through store IAP (Apple rules); RevenueCat handles receipts, trials (1–2 months free per pricing model), restore, and both stores from one integration.

## Observability & analytics
**Sentry** for crashes. **No third-party behavioral analytics.** Product metrics (activation, logging frequency, bad-night logging rate, retention) are computed from our own database — incident content is sensitive and never leaves our stack. This is a privacy posture, not a tooling gap.

## AI layer (post-launch, gated)
Narrator + validator per the containment architecture, server-side only (Supabase Edge Function), never on-device, never at capture time. v1 launches with deterministic template narration; live AI is a post-launch milestone behind a flag. Model/provider choice deferred until then.

## Tooling
Node for lint/smoke/scripts; git (initialized); EAS Build; TestFlight / Play internal testing for distribution.

## Explicitly deferred
AI model selection; wearable integrations; web client; Android-specific work beyond fast-follow parity.
