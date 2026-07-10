# Drinkchart — Concept & Design Validation Brief

**Version 0.9 · July 2026 · For expert review prior to detailed design**

---

## 1. Purpose of This Document

This brief consolidates the product concept, target segmentation, core design decisions, safety architecture, technical approach, and business model for Drinkchart, an alcohol self-insight app. It is written for external experts — clinical, behavioral, and product — to validate before detailed design begins.

We are specifically asking reviewers to challenge: (a) the behavioral thesis, (b) the target segmentation and its safety implications, (c) the incident-capture model, (d) the safety architecture, (e) the AI containment architecture, and (f) commercial viability. Section 12 lists the specific questions we want answered.

---

## 2. Problem and Thesis

The person we are building for already knows alcohol is bad for them. Information is not their gap. Their gap is that the pattern — the trigger, the internal fight, the loss, the morning verdict, the vow to do better, the repeat — happens in disconnected moments they never see as one loop. They experience the urge in one moment, the rationalization in another, the regret in a third, and memory never assembles these into a visible pattern. The question the app exists to answer is the one they ask themselves: *"Why do I drink even though I know better, and why can't I stop?"*

**Thesis:** Making the loop visible — capturing the struggle around the drink, not just the drink — creates self-insight that supports reduction without prescription. The app is a mirror and a journal, not a program. It reflects what the user is doing and why; the user draws the conclusions.

This is deliberately different from the two dominant intervention models in the market: structured curricula that teach users out of drinking, and moderation plans that budget users down. Both prescribe a direction. Drinkchart's bet is that for a meaningful segment of drinkers — particularly those for whom programs have already failed — understanding *why* precedes and enables *less*.

---

## 3. Target User and Segmentation

Our working model of the drinking market has four segments:

**Social drinker.** No perceived issue, no felt need to track or examine drinking. Not our user.

**Social-moving-to-real drinker.** A pattern is forming but self-perception lags behind it. These users are unlikely to seek help or download an app about their drinking. Not targeted — but they are the future pipeline, so nothing in the product should repel or shame them if they arrive early.

**Problem drinker — our prime user.** Self-description: *"I know I drink too much. I want to reduce or stop. I can't."* This person actively seeks help: they search "why do I keep drinking," read quit-lit, lurk in sober-curious communities, and have often already tried and abandoned a program or plan. They are findable, motivated, and underserved by directive products.

**Hard-core / dependent drinker.** Needs professional care. The app helps where it can, but its explicit job for this segment is to steer — respectfully and factually — toward professional help.

**Honest acknowledgment for reviewers:** the prime segment's self-description ("want to but can't") overlaps with mild-to-moderate alcohol use disorder; impaired control is a core diagnostic criterion. We are choosing this segment deliberately and with eyes open, and we respond to the choice with mandatory screening and safety routing (Section 9) rather than by pretending the segment is lighter than it is. We ask reviewers directly whether the safety architecture is adequate to the choice.

---

## 4. Market Position

The category is established and growing. Reframe is a neuroscience-based daily curriculum with courses, community, and a craving toolkit — effectively a school, with millions of downloads at roughly $99.99/year. Sunnyside is a moderation-first plan — weekly drink budgets, tracking, human coaching by text, and now naltrexone telehealth — at roughly $12/month for its basic tier. I Am Sober owns sobriety streaks and community. All of them are directional: they decide where the user should go and move them there.

**Our position: the neutral mirror.** Journal-first, struggle-first, and direction-neutral by default. The pitch, to a user for whom programs already failed: *"We won't tell you what to do. We'll show you what you're doing."*

Nobody in the market centers the internal struggle — the ambivalence, the fight, the resisted urge — as the primary tracked object. That is the whitespace.

**Defensibility, stated honestly:** every feature described in this document is copyable by a funded competitor within a quarter. The durable assets are (1) the voice — consistently non-judgmental in a category that struggles to be — and (2) the accumulated personal record, which becomes irreplaceable to the individual user over months. We are not claiming a technical moat.

---

## 5. What the App Is Not — Boundaries

Drinkchart is **not medical advice, diagnosis, or treatment**, and says so explicitly, repeatedly, and without fine print. It is not a sobriety program, not a coaching curriculum, not a recovery-identity product, and never alarmist.

All physiological and psychological impact content is **generalized, not personalized clinical claims**. The accuracy standard is directional ("roughly right for someone like you"), and the language is probabilistic throughout: *"about 12 hours after your last drink, this is probably what's happening."* Timing imprecision is named and owned in the copy, not hidden.

The voice is a **detached friend**: observational, warm, plain-spoken. It looks at whatever data it has and offers a sage read. It never lectures, never condescends, never moralizes. "Drink less" and "go see a doctor" are not its job — with one exception, defined in Section 9.

---

## 6. Core Concept: The Incident Arc

The foundational design decision: **an incident is not a drink log; it is the arc of a struggle.** The drink, if it happens, is the visible outcome of an internal event that started earlier and continues after.

One incident = one arc, with an outcome field: **drank / resisted / delayed**. Resisted urges are first-class incidents. This matters twice over: the fights the user *wins* are recorded (data no mainstream competitor captures), and over time those wins become the counter-evidence to "I'm a prisoner" — the app can show someone they resisted 14 urges and won 9, which directly answers the felt experience of powerlessness with their own record.

Each arc has three moments:

**Before — the trigger and the state.** What was true just before the urge. Not "occasion: dinner" but the internal condition: what the user was feeling, avoiding, or needing; where they were and with whom; whether they had already told themselves anything about today's drinking.

**The fight — the ambivalence.** Whether they resisted and for how long; the self-talk ("I shouldn't, but…"); what tipped the decision. This is the moment nothing else on the market captures, and it is the core of the product.

**After — the verdict.** Not just how they feel physically, but the verdict they passed on themselves: relief, regret, numbness, "again." Did the drink deliver what it promised? Physical aftermath (the embedded mind/body layer, Section 8) attaches here as context, not headline. The after-reflection is typically next-morning but available immediately.

**Progressive depth is the capture philosophy.** Every moment has a one-tap floor; a complete incident is possible in three taps. Depth is always invited, never required. Arcs are reopenable — an incident logged at the floor tonight can be filled in tomorrow. An optional full-depth interview is offered at first use for users who want to dig in immediately; skipping it costs nothing and the blanks can be filled later.

**Capture format:** tags and dropdowns wherever the input is structured (drivers, contexts, verdicts), with free text always available at every moment. This is deliberately also a journaling app — the free text is where honesty lives, the structure is what makes patterns analyzable, and the AI narration layer reads across free text over time to surface recurring self-talk.

**Drinking metrics ride inside the arc as light context, never as a separate chore.** If drinking happened: number of drinks *or a range* ("2–3," "4–6") as a first-class input, plus optional duration, place, and company. Onboarding and inline help define a standard drink (5 oz wine, 12 oz beer at ~5%, 1.5 oz spirits); the user chooses their own precision. Exact quantity and beverage type are deliberately de-emphasized — more accuracy is welcome, fixation is not. We accept the measurement wobble by design; the psychology is the signal, the units are context.

---

## 7. Product Surfaces

**Home.** A summary of the last incident — what happened, when, why it probably happened, what can be learned from it — plus two actions: add an incident, open the dashboard.

**Add Incident.** The three-moment arc capture described above, at whatever depth the user chooses.

**Incident Assessment.** Deterministic, persisted content (not live AI) rendered after an arc is logged, covering: why this session probably happened (the likely immediate driver), what alcohol provided in the moment (the expected benefit), and what it cost afterward (the embedded mind/body layer). Where the user has set a directional goal, one optional driver-specific action is offered. Every assessment ends with a validation prompt — *"Does this feel accurate?"* (yes / partly / no / add context) — which is a core learning loop: the user corrects the labeling, and the corrected label feeds the pattern engine.

**Dashboard — Metrics.** Factual and computed, fully deterministic: drinks this week/month, average drinks per drinking day, heavy-session frequency, alcohol-free days, consecutive drinking days, resisted-versus-drank ratio, change versus prior period.

**Dashboard — Trends and Tendencies.** Rolling 30- and 90-day patterns, never one night: primary drinking drivers, trigger frequency, context patterns, expected benefit versus actual reported outcome, which drivers produce the heaviest sessions, whether the underlying pattern is shifting, and which actions are most relevant to the current pattern. The organizing question: *under what circumstances do you drink, what immediate need appears to drive it, and what outcome follows?*

**Goals and Actions.** The default goal is **"understand my drinking"** — neutral, awareness-only. Under the neutral default the app is purely a mirror: it may ask pattern questions (*"this looks like stress relief — does that fit?"*) but offers no suggestions or direction. The user may choose a directional goal at any time: reduce overall drinking, fewer heavy sessions, more alcohol-free days, fewer consecutive drinking days, longer gaps or fuller recovery before the next session, earlier stopping times, or a maximum per week/session. Choosing a directional goal unlocks suggestions — always tied to the goal the user owns, never one the app imposed.

Suggestions come exclusively from an **approved, closed action library** mapped to observed drivers. Illustrative mappings: stress relief → insert a decompression ritual before the first drink; habit → change the time, place, or cue associated with drinking; social pressure → set the intended limit before arriving; boredom → replace the drinking window with a planned activity; sleep → compare alcohol nights against alcohol-free sleep; reward → create another end-of-day reward; craving → delay the first drink and track whether the urge changes; emotional escape → identify the emotion and an alternative response. Actions are optional, small, specific, linked to observed behavior, and measurable the following week. The library is human-authored and reviewed; AI selects from it and never invents actions.

**Turmoil and entrapment signals.** Preoccupation and internal conflict are meaningful signals distinct from consumption, but we capture them inside the arc, not as standalone surveys. The fight and after moments carry one-tap turmoil tags (*at war with myself, trapped, in control, resigned, didn't care, stuck again*), and the dashboard trends them over time — answering "am I stuck?" from the user's own moments. A standalone periodic prompt ("how much do you think about alcohol?") was considered and rejected: it risks inducing the rumination it measures, and that failure mode would be invisible in the data.

---

## 8. North Star — Voice, Mirror, and Value (Re-Alignment Baseline)

This section is the product's fixed point. When scope drifts, when copy gets written, when new contributors join, when a feature debate stalls — re-read this and re-align to it. Everything else in this document can evolve; this section changes only by deliberate decision.

**What we are.** A mirror and a journal for the person who drinks and wants to understand why. Our single job is to make visible a loop the user cannot assemble from memory: the trigger, the promise alcohol made, the fight, the outcome, the verdict — connected across weeks. The user already knows alcohol is bad; we never build for an information gap. We build for a visibility gap.

**The value we add, stated once.** Pattern reflection the user cannot get anywhere else, drawn from their own honestly captured moments, delivered without judgment. Secondary value: the act of logging and seeing trends is itself encouraging for someone struggling — and the record of urges resisted and fights won is evidence against "I'm a prisoner," told in the user's own data. If a feature does not serve visibility, honesty, or that encouragement, it does not belong.

**Narration style.** The voice is a detached friend: warm, plain, observational, unhurried. Surface copy is human and compressed — no jargon, nothing restated that the user already knows. Science lives in the fold, as flowing narration segmented by impact area — the cost first, then the recovery — never a lecture, never bullet lists. Every claim about the user's body or mind is probabilistic: "probably," "roughly," "for someone like you." Imprecision is named, not hidden. The embedded "what alcohol does to your mind/body" layer exists to answer *what it cost* inside the assessment — generalized, hedged, supporting content for the psychology core, never the product itself.

**How we prompt.** Invitation, never obligation. Every capture has a one-tap floor; depth is always offered and never required; arcs reopen so honesty can arrive late. The mirror may ask questions — *"this looks like stress relief; does that fit?"* — because a question is observation with a question mark. It may not suggest, direct, or coach until the user has chosen a directional goal, and then only from the approved library. We never prompt reflection out of context: signals like turmoil and preoccupation are captured as tags inside real moments, never as standalone surveys that could induce the rumination they measure. Every interpretation we offer is a hypothesis the user can correct — "does this feel accurate?" — never a verdict about who they are.

**The mirror's discipline.** We reflect; the user directs. The user is the authority on their own experience; our labels are drafts they edit. The default state is neutral — understand, not reduce — and neutrality is not passivity: a sharp reflection *is* the intervention. The single exception is programmatic safety: when a pattern suggests dependence, we say calmly that sudden stopping can be unsafe and that medical guidance is wise. That is the only sentence in the product that tells anyone what to do.

**Drift check.** Before shipping any feature, prompt, or line of copy, test it against five questions. Does it tell the user what to do without a goal they chose? Would it read as judgment or a verdict to someone on their worst morning? Does it state something about their body or mind as fact rather than probability? Does it demand precision or effort we promised not to require? Does it prompt reflection outside a real moment? One yes is drift — fix it or cut it.

---

## 9. Safety Architecture — v1 Mandatory

Because the prime segment overlaps mild-to-moderate AUD, safety is in v1 scope, not a backlog item.

**Screening.** AUDIT-C at onboarding, with an extended assessment offered when indicated by score or by observed pattern.

**Pattern triggers.** Deterministic rules — never AI judgment — watch for dependence-suggestive patterns such as sustained daily heavy use, escalating consecutive drinking days, and other threshold crossings to be defined with clinical input.

**Withdrawal caution — the one exception to neutrality.** When a pattern suggests possible physical dependence, the app delivers a calm, factual, programmatic note: abrupt cessation at this pattern of use can be medically unsafe, and medical guidance is advised before a major reduction. This is the single place the "we don't tell you what to do" stance yields, because a user acting on the app's own mirror — deciding to stop suddenly — could be harmed by uninformed abrupt cessation.

**Routing.** Users whose screening or pattern places them in the dependent segment are steered toward professional resources, respectfully, factually, and without alarm.

**All safety messaging is programmatic.** It is authored, reviewed, and triggered by code. It is never generated, paraphrased, or timed by AI.

---

## 10. Technical Architecture — AI Containment

The governing rule: **AI explains conclusions; it never creates the underlying facts or decides what is medically true.**

**Layer 1 — Deterministic facts.** All metrics are computed in code: consumption counts, frequencies, streaks, ratios, period comparisons, goal progress.

**Layer 2 — Deterministic trend detection.** Rules identify observations (consumption up 20%, heavy sessions moved from one to three, Fridays account for most heavy drinking, stated driver shifted from social to stress). No AI in detection.

**Layer 3 — Constrained AI narration.** A narrator model receives only structured inputs: computed metrics, detected trends, the user's goal, approved health-information excerpts, and the approved action options. Its job is to prioritize what matters, explain it naturally in the product voice, relate it to the user's goal, and select (not invent) a relevant action. It cannot calculate, cannot invent trends, and cannot assess medical risk.

**Layer 4 — Validation.** A second model performs claim-by-claim validation: every number, behavioral observation, and health statement in the narration must map to a specific metric, detected trend, or approved health-rule ID, or it is rejected. Code — not AI — then verifies numbers against the database, confirms referenced evidence IDs exist, enforces the output schema, checks for prohibited or alarmist language, and confirms required disclaimers. On failure: regenerate once, revalidate, then fall back to a programmatic response.

**Persistence and promotion.** Every generation is persisted with its input facts, detected trends, prompt and model versions, validation result, and user feedback. Recurring input patterns are promoted — after human review — into an approved response library keyed by pattern signature, so common cases reuse vetted content and live generation is reserved for genuinely new combinations.

**Incident assessments are deterministic, persisted content** — not live AI. The narration stack applies to the trends surface only. Safety messaging bypasses AI entirely (Section 9).

---

## 11. Business Model

**Pricing.** Freemium: one to two months fully featured free, then **$10/month**. Category comparables support the price point (Sunnyside basic ~$12/month; Reframe ~$99.99/year), and the prime segment — motivated problem drinkers rather than curious browsers — is the sub-population most willing to pay in this category.

**Revenue bar.** $5K MRR, i.e., roughly 500 subscribers at $10/month. This is an intentionally modest, indie-scale target matched to the build cost.

**Funnel reality, stated plainly.** At category-typical conversion (2–5% of downloads to paid) and early-stage churn (8–12%/month), 500 sustained subscribers implies roughly 12–20K cumulative downloads and an ongoing 1,000–1,500 quality downloads per month to offset churn. Paid acquisition is unlikely to pencil at this price point; the plan is **organic**: content targeting the "why do I drink" question space, sober-curious communities, and seasonal moments (Dry January, Sober October). Acquisition is a parallel workstream from day one, not a launch event.

**Retention thesis.** The journal compounds. Static educational content is exhaustible; the user's own accumulating record — their triggers, their fights, their verdicts, their pattern over months — is not, and it becomes personally irreplaceable. The product's stickiness rests on the record, not on novel content.

---

## 12. Known Risks and Questions for Reviewers

1. **Segment and safety adequacy.** Given that our prime segment overlaps mild-to-moderate AUD, is the safety architecture in Section 9 sufficient? What screening instruments, thresholds, and routing behaviors would you require before launch?
2. **Honesty at the moment of shame.** The product only works if users log their worst nights and lost fights — precisely when journaling tends to be abandoned. Does the non-judgmental voice plus one-tap floor plausibly maximize disclosure? What else would?
3. **Capture burden.** Is the three-moment arc, even with a one-tap floor and reopenable entries, sustainable for repeated real-world use — or is it too heavy for the moments it targets?
4. **Cold start.** Trends require weeks of data. Is the per-incident assessment alone enough value in the first 14 days to survive early churn?
5. **Neutral default versus efficacy.** Withholding all suggestions until the user opts into a directional goal protects the non-judgmental positioning but may sacrifice impact relative to brief-intervention evidence. Is the trade defensible?
6. **Driver taxonomy.** Is our self-labeling driver set (stress relief, habit, social pressure, social connection, boredom, sleep, reward, craving, emotional escape, celebration, confidence, enjoyment) the right clinical-adjacent vocabulary?
7. **Action library.** Are the driver-to-action mappings in Section 7 evidence-aligned and safe as written? What belongs in or out of the closed library?
8. **Turmoil tags.** We capture internal-conflict signals (*trapped, at war with myself, in control, stuck again*) as one-tap tags inside the fight and after moments and trend them as an entrapment signal — rather than running any standalone preoccupation survey. Is this in-moment approach meaningful and safe, and is the tag vocabulary right?
9. **AI containment.** Does the narrator/validator/code-check/fallback architecture in Section 10 meet your bar for AI-generated text adjacent to health behavior?
10. **Regulatory line.** Does anything here, as designed, cross into medical-device territory or make claims requiring clinical substantiation?

---

## 13. Deliberately Out of Scope for v1

Wearable integration (the eventual personalization path and moat), community features, predictive or just-in-time nudges, human coaching, medication pathways, and multi-substance tracking are all explicitly excluded from v1. The physiological content layer ships as embedded, generalized context — not as a live per-user model.

---

## 14. Immediately Next, After Validation

Field-level schema for the three arc moments (the tag sets for drivers, self-talk, and verdicts); the trend-detection rule catalog; safety thresholds and screening flow, defined with clinical input; final authoring of the action library; and the embedded mind/body content set. Detailed design begins once reviewers have responded to Section 12.
