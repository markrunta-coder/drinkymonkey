// Pure engine derivations — the behavioral core of the generic renderer,
// ported 1:1 from the reference harness (tools/preview.html, guarded by
// tools/smoke-preview.mjs). Everything here is a pure function of
// (config, answers): no React, no I/O, no state, fully deterministic.
import type { AnswerValue, Answers, ConfigNode, ConfigOption, FlowConfig, Outcome } from "./types";

export const isLinear = (config: FlowConfig): boolean => config.flow === "linear";

export function nodeById(config: FlowConfig, id: string): ConfigNode | undefined {
  return config.nodes.find((n) => n.id === id);
}

export const rawOutcome = (answers: Answers): Outcome | null =>
  (answers.O1?.value as Outcome | undefined) ?? null;

export const resolution = (answers: Answers): string | null => answers.D1?.value ?? null;

/** Effective outcome: 'delayed' resolves to drank/resisted when D1 is answered. */
export function effOutcome(answers: Answers): Outcome | null {
  const o = rawOutcome(answers);
  if (o !== "delayed") return o;
  if (resolution(answers) === "drank_anyway") return "drank";
  if (resolution(answers) === "didnt_drink") return "resisted";
  return null;
}

export const stillDeciding = (answers: Answers): boolean =>
  rawOutcome(answers) === "delayed" && resolution(answers) === "still_deciding";

/**
 * Required minimum: the raw branch's floor, plus — on a D1 redirect — the
 * target branch's floor nodes not already covered (delayed->drank adds QTY:
 * 4 taps total for that arc; each branch's own floor stays <=3. Spec rev B footnote).
 */
export function requiredIds(config: FlowConfig, answers: Answers): string[] {
  if (isLinear(config)) return [...(config.branches.main?.floor ?? [])];
  const o = rawOutcome(answers);
  if (!o) return ["O1"];
  const ids = [...(config.branches[o]?.floor ?? [])];
  const eff = effOutcome(answers);
  if (o === "delayed" && eff) {
    for (const id of config.branches[eff]?.floor ?? []) if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function selectedOption(node: ConfigNode, a: AnswerValue): ConfigOption | undefined {
  return (node.options ?? []).find((o) => o.value === a.value);
}

/** Is the node's answer complete (incl. requires_number/datetime companions)? */
export function answeredComplete(config: FlowConfig, answers: Answers, id: string): boolean {
  const a = answers[id];
  const n = nodeById(config, id);
  if (!a || !n) return false;
  switch (n.input_type) {
    case "tap":
      return true;
    case "single":
    case "chips": {
      if (!a.value) return false;
      const opt = selectedOption(n, a);
      if (opt?.requires_number && (a.number === undefined || a.number === null)) return false;
      if (opt?.requires_datetime && !a.datetime) return false;
      return true;
    }
    case "multi":
      return !!(a.values && a.values.length);
    case "number":
      return a.number !== undefined && a.number !== null;
    case "text":
      return !!(a.text && a.text.trim());
    default:
      return false; // unknown input_type: hidden by the renderer, never complete
  }
}

export function floorMet(config: FlowConfig, answers: Answers): boolean {
  const req = requiredIds(config, answers);
  if (isLinear(config)) return req.every((id) => answeredComplete(config, answers, id));
  return (
    !!rawOutcome(answers) &&
    !stillDeciding(answers) &&
    req.every((id) => answeredComplete(config, answers, id))
  );
}

/** Does the answer carry the value as primary, secondary, or a multi value? */
export function answerHasValue(a: AnswerValue | undefined, v: string): boolean {
  if (!a) return false;
  return a.value === v || a.secondary === v || (a.values ?? []).includes(v);
}

/** Deterministic tags, straight from the config's tag_rules. */
export function computeTags(config: FlowConfig, answers: Answers): string[] {
  const tags: string[] = [];
  for (const rule of config.tag_rules ?? []) {
    const a = answers[rule.node];
    const hit = (rule.if_value_in ?? []).some((v) => answerHasValue(a, v));
    const outcomeOk = !rule.if_outcome || effOutcome(answers) === rule.if_outcome;
    if (hit && outcomeOk) tags.push(rule.add_tag);
  }
  return tags;
}

// -------------------------------------------------------------- instruments

/** How onboarding nodes land in dc_profiles / dc_goals columns. */
export const PROFILE_MAP: Record<string, string> = {
  AGE: "age_band",
  GEN: "gender",
  DWK: "drinks_week_band",
  SINCE: "drinking_since",
  GOAL: "goal_type",
};

export interface InstrumentResult {
  name: string;
  score: number;
  band: string; // clean band value — what dc_profiles.screen_band stores
  provisional: boolean;
}

/**
 * Generic instrument scoring, reading the config's scoring section
 * (thresholds are config values, not code). Instruments whose sum_of nodes
 * are not all answered are omitted.
 */
export function scoreInstruments(config: FlowConfig, answers: Answers): InstrumentResult[] {
  const out: InstrumentResult[] = [];
  const genderNode = Object.keys(PROFILE_MAP).find((id) => PROFILE_MAP[id] === "gender");
  const gender = genderNode ? (answers[genderNode]?.value ?? null) : null;
  for (const [name, inst] of Object.entries(config.scoring ?? {})) {
    if (!inst.sum_of.every((id) => answeredComplete(config, answers, id))) continue;
    let score = 0;
    for (const id of inst.sum_of) {
      const n = nodeById(config, id);
      const opt = n ? selectedOption(n, answers[id]!) : undefined;
      score += opt?.score ?? 0;
    }
    let best: { band: string; min: number } | null = null;
    for (const [band, mins] of Object.entries(inst.bands)) {
      const min = gender != null && Number.isInteger(mins[gender]) ? mins[gender] : mins.default;
      if (score >= min && (best === null || min > best.min)) best = { band, min };
    }
    out.push({
      name,
      score,
      band: best ? best.band : "none",
      provisional: !!inst.provisional,
    });
  }
  return out;
}

/**
 * The dc_profiles/dc_goals values this flow's answers imply. Bands carry the
 * preview's " (provisional)" suffix for DISPLAY parity; persistence uses
 * scoreInstruments() and stores the clean band.
 */
export function derivedProfile(
  config: FlowConfig,
  answers: Answers
): Record<string, string | number | null> {
  const p: Record<string, string | number | null> = {};
  for (const [id, col] of Object.entries(PROFILE_MAP)) {
    if (nodeById(config, id)) p[col] = answers[id]?.value ?? null;
  }
  for (const inst of scoreInstruments(config, answers)) {
    p[`${inst.name}_score`] = inst.score;
    if (inst.name === "audit_c") {
      p.screen_band = inst.band + (inst.provisional ? " (provisional)" : "");
    } else {
      p[`${inst.name}_band`] = inst.band + (inst.provisional ? " (provisional)" : "");
    }
  }
  return p;
}

// ----------------------------------------------------------------- render helpers

export interface CardGroup {
  group: string | null;
  ids: string[];
}

/** Group consecutive ids that share a card_group (B3A + B3B render as one card). */
export function groupIds(config: FlowConfig, ids: string[]): CardGroup[] {
  const groups: CardGroup[] = [];
  for (const id of ids) {
    const g = nodeById(config, id)?.card_group;
    const last = groups[groups.length - 1];
    if (g && last && last.group === g) last.ids.push(id);
    else groups.push({ group: g ?? null, ids: [id] });
  }
  return groups;
}

/** Spawned nodes for a node's current answer (then_node rules render inline). */
export function spawnedNodeIds(config: FlowConfig, answers: Answers, id: string): string[] {
  const n = nodeById(config, id);
  if (!n) return [];
  return (n.spawn_rules ?? [])
    .filter(
      (r) =>
        r.then_node &&
        (r.if_value === "*" ? !!answers[id] : answerHasValue(answers[id], r.if_value))
    )
    .map((r) => r.then_node!);
}

/** Max cards shown per moment before "+ more" (behavioral reference: CARD_CAP=3). */
export const CARD_CAP = 3;

// ----------------------------------------------------------------- occurred_at

/**
 * Denormalize dc_arcs.occurred_at from the T1 answer (spec decision 9).
 * Deterministic conventions for the relative options:
 *   just_now / earlier_today -> now; last_night -> yesterday 21:00 local;
 *   yesterday -> yesterday 12:00 local; custom -> the picked datetime.
 */
export function occurredAtFromT1(a: AnswerValue | undefined, now: Date): Date | null {
  if (!a?.value) return null;
  const d = new Date(now.getTime());
  switch (a.value) {
    case "just_now":
    case "earlier_today":
      return d;
    case "last_night":
      d.setDate(d.getDate() - 1);
      d.setHours(21, 0, 0, 0);
      return d;
    case "yesterday":
      d.setDate(d.getDate() - 1);
      d.setHours(12, 0, 0, 0);
      return d;
    case "custom": {
      if (!a.datetime) return null;
      const parsed = new Date(a.datetime);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    default:
      return null;
  }
}
