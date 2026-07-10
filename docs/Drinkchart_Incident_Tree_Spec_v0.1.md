# Drinkchart — Incident Tree Specification v0.1

**Detailed design · Incident logging · July 2026**
**Governing rules:** deterministic tree, versioned config (data, not code), no AI at runtime. Floor ≤3 taps. Depth invited, never required. Free text available at every moment. Arcs reopenable.

---

## 1. Structure Overview

An incident is one **arc** with three moments (before / fight / after) plus an outcome. The tree is a set of **nodes** (questions) with **spawn rules** (deterministic conditionals). The app renders nodes generically from a versioned JSON config; answers persist per node with the tree version they came from.

Two entry modes, one outcome gate, then per-branch moment cards.

```
ENTRY ─┬─ E1 "Urge right now" (live)  → open arc, timestamp, ≤3 quick chips, app backs off
       └─ E2 "Log something"          → O1 Outcome → T1 Timing → branch
O1 Outcome: drank | resisted | delayed
D1 (if delayed): "And then?" → drank anyway | didn't drink | still deciding (arc stays open)
```

---

## 2. Floor Paths (required minimum)

| Branch | Floor | Taps |
|---|---|---|
| Drank | outcome → timing → quantity | 3 |
| Resisted | outcome → timing | 2 |
| Delayed | outcome → timing → D1 resolution | 3 |
| Live urge (E1) | one tap | 1 |

**Done** is visible the moment the floor is met. Everything below is invited cards — max 3 visible, "more" reveals the rest, every card skippable.

---

## 3. Node Catalog

### Entry & outcome

| ID | Prompt | Type | Options | Required | Spawns |
|---|---|---|---|---|---|
| E1 | Urge right now | tap | — | — | opens arc; offers B2, B3 as quick chips |
| E2 | Log something | tap | — | — | O1 |
| O1 | What happened? | single | drank / resisted / delayed | yes | branch; delayed→D1 |
| D1 | And then? | single | drank anyway / didn't drink / still deciding | yes (delayed) | drank anyway→drank branch; didn't→resisted branch; still→arc stays open |
| T1 | When? | single | just now / earlier today / last night / yesterday / pick date-time | yes | — |

### Drank branch — floor

| ID | Prompt | Type | Options | Required |
|---|---|---|---|---|
| QTY | How much, roughly? | chips or number | 1–2 / 3–4 / 5–6 / 7–9 / 10+ / exact # | yes |

### Before (all branches, optional cards)

| ID | Prompt | Type | Options | Spawns |
|---|---|---|---|---|
| B1 | What was behind it? | single primary + optional 1 secondary | stress / habit·routine / social / boredom / sleep / reward / craving / escape / other+text | — (driver drill-downs are v2 tree expansions) |
| B2 | How were you feeling? | multi ≤3 | stressed / anxious / bored / lonely / tired / flat / angry / happy / restless / numb | — |
| B3 | Where / with whom? | two singles | home / bar / restaurant / someone's / event / out · alone / partner / friends / family / colleagues | — |
| B4 | Had you told yourself anything about drinking today? | single | wasn't going to / had a limit / no plan / planned to | "wasn't going to" or "had a limit" + outcome=drank → auto-tag **broke-own-rule** |

### Fight (drank path)

| ID | Prompt | Type | Options | Spawns |
|---|---|---|---|---|
| F1 | Was there a moment of deciding? | single | automatic / brief hesitation / real fight | real fight → F2, F3 |
| F2 | How long did you hold out? | single | minutes / about an hour / hours / most of the day | — |
| F3 | What tipped it? | single+text | urge got stronger / someone offered / "just one" / "screw it" / deserved it / autopilot / other | — |
| F4 | Sound familiar? (self-talk) | multi+text | "just one" / "I deserve it" / "hard day" / "start tomorrow" / "everyone is" / "I can handle it" | — |
| F5 | The fight felt like… (turmoil) | multi ≤2 | at war with myself / trapped / in control / resigned / didn't care / stuck again | — |

### Fight (resisted path)

| ID | Prompt | Type | Options |
|---|---|---|---|
| F2 | (same hold-out node) | | |
| F6 | What got you through? | multi+text | did something else / waited it out / remembered why / left the situation / talked to someone / ate or drank something else |
| F5 | (same turmoil node) | | |

### After (drank path — prompted next morning if absent; available immediately)

| ID | Prompt | Type | Options |
|---|---|---|---|
| A1 | Did it do what you wanted? | single | yes / partly / no / made it worse |
| A2 | This morning's verdict | single+text | relief / fine with it / mixed / regret / numb / "again" |
| A3 | Body check | single | fine / meh / rough  *(keys embedded mind/body content with QTY)* |
| A4 | (turmoil node F5 set, re-asked) | multi ≤2 | same six tags |
| A5 | Anything else? (journal) | free text | always present, every moment |

### After (resisted path)

| ID | Prompt | Type | Options |
|---|---|---|---|
| A6 | How do you feel about it now? | single | proud / relieved / still fighting it / exhausted / no big deal |

### Optional metrics (drank, one card)

| ID | Prompt | Type | Options |
|---|---|---|---|
| M1 | Over how long? | single | <1h / 1–2h / 2–4h / all evening |
| M2 | Food? | single | none / some / a meal |
| M3 | What kind? | multi | wine / beer / spirits / mixed *(deprioritized by design)* |

---

## 4. Branching Rules — v1

Deliberately shallow. Only three conditionals exist in v1: **F1 → F2/F3** (real fight spawns depth), **B4 × O1 → broke-own-rule tag**, **D1 → branch resolution**. Depth from entry never exceeds 3. Driver drill-downs (stress → source; social → pressure vs. connection), context-conditional questions, and history-aware prompts are v2+ tree versions, added when incident data shows which branches earn their place.

## 5. Tree-as-Config Contract

- Tree ships as versioned JSON: `nodes[] {id, moment, prompt, input_type, options[], max_select, required, spawn_rules[]}` + floor declaration per branch.
- App renders any valid config generically. New tree version = config push, never an app release.
- Answers persist as `(arc_id, node_id, tree_version, value, answered_at)` — old incidents stay interpretable against their own tree version.
- Runtime is fully deterministic. Offline analysis (free-text themes, card engagement/skip rates) informs which nodes the *next* tree version adds — that is the only place AI touches the tree, and never live.

## 6. Node → Dashboard Traceability

Every node exists because something reads it. If a node feeds nothing, it gets cut.

| Node(s) | Feeds |
|---|---|
| B1 | primary drivers, driver × quantity, driver → heaviest sessions, action selection |
| B4 × O1 | broke-own-rule rate (the dissonance trend) |
| F5 / A4 | entrapment trend ("am I stuck?") over 30/90 days |
| A1 vs B1 | promise gap: expected benefit vs. delivered |
| F2, F6 | what resistance tactics work *for this user* — personal pattern, resisted-side |
| O1 ratio | resisted-vs-drank record (the wins) |
| QTY, T1, M1 | all consumption metrics: weekly, per-day, heavy-session, consecutive days, AF days |
| B2, B3 | context patterns, trigger frequency |
| A2, A5 | verdict trends; AI narration reads journal text across time for recurring self-talk |

## 7. Onboarding Implications (slimmed)

The tree collects context per-incident, so onboarding shrinks to: age band, gender (optional), self-reported drinks/week baseline, drinking-since (optional), AUDIT-C screen, goal (default: understand my drinking). **Weight and height are dropped** — they served the retired physiological engine and feed nothing in the current design.

## 8. Open Decisions (blocking v1 config)

1. Driver start-set — proposed: the 8 above + other (each maps 1:1 to an existing approved action; celebration/confidence/enjoyment deferred to v2).
2. Quantity bands — proposed chips: 1–2 / 3–4 / 5–6 / 7–9 / 10+ / exact.
3. Delayed as resolvable state (arc stays open on "still deciding").
4. Onboarding drop of weight/height.
5. After-moment nudge: one dismissible next-morning notification for arcs missing the after moment.
6. Backend assumption: Postgres (Supabase-compatible) for the data model draft.
