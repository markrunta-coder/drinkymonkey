// Pure session-state transitions — the answering semantics of the reference
// harness (tools/preview.html), ported as immutable functions:
// (config, session, ...) -> new session. No React, no I/O.
import {
  computeTags,
  derivedProfile,
  effOutcome,
  floorMet,
  isLinear,
  nodeById,
  rawOutcome,
} from "./engine";
import type {
  AnswerValue,
  Answers,
  FlowConfig,
  IncidentPreset,
  SessionState,
} from "./types";

/** A fresh session for the given config (linear flows preset default_value answers). */
export function blankSession(config: FlowConfig): SessionState {
  const s: SessionState = {
    mode: null,
    liveOpen: false,
    saved: false,
    skipped: {},
    moreShown: {},
    arc: {
      tree_version: config.tree_version,
      entry: null,
      urge_at: null,
      status: "open",
      outcome: null,
      tags: [],
      answers: {},
      journal: {},
    },
  };
  if (isLinear(config)) {
    s.mode = "flow"; // linear flows have no entry hero
    for (const n of config.nodes) {
      if (n.default_value !== undefined) s.arc.answers[n.id] = { value: n.default_value };
    }
  }
  return syncArc(config, s);
}

/** Recompute the arc's derived fields (tags, effective outcome, status). */
export function syncArc(config: FlowConfig, s: SessionState): SessionState {
  const answers = s.arc.answers;
  if (isLinear(config)) {
    return {
      ...s,
      arc: {
        ...s.arc,
        status: floorMet(config, answers) ? "complete" : "open",
        derived: derivedProfile(config, answers),
      },
    };
  }
  return {
    ...s,
    arc: {
      ...s.arc,
      tags: computeTags(config, answers),
      // delayed until D1 resolves — DB semantics (spec decision 9)
      outcome: effOutcome(answers) ?? rawOutcome(answers),
      status: floorMet(config, answers) ? "complete" : "open",
    },
  };
}

function withAnswer(
  config: FlowConfig,
  s: SessionState,
  id: string,
  a: AnswerValue | null
): SessionState {
  const answers: Answers = { ...s.arc.answers };
  if (a === null) delete answers[id];
  else answers[id] = a;
  const skipped = { ...s.skipped };
  delete skipped[id];
  return syncArc(config, { ...s, skipped, arc: { ...s.arc, answers } });
}

/** Tap a chip: toggle semantics for single/chips/multi, incl. allow_secondary (B1). */
export function answerChip(
  config: FlowConfig,
  s: SessionState,
  id: string,
  v: string
): SessionState {
  const n = nodeById(config, id);
  if (!n) return s;
  const cur = s.arc.answers[id];
  if (n.input_type === "multi") {
    const values = cur?.values ? [...cur.values] : [];
    const i = values.indexOf(v);
    if (i >= 0) values.splice(i, 1);
    else if (!n.max_select || values.length < n.max_select) values.push(v);
    return withAnswer(
      config,
      s,
      id,
      values.length ? { ...(cur ?? {}), values } : cur?.text ? { text: cur.text } : null
    );
  }
  // single / chips
  if (n.allow_secondary && cur?.value) {
    if (cur.value === v) return withAnswer(config, s, id, null); // clear all
    if (cur.secondary === v) {
      const a = { ...cur };
      delete a.secondary;
      return withAnswer(config, s, id, a); // clear secondary
    }
    return withAnswer(config, s, id, { ...cur, secondary: v }); // set/replace secondary
  }
  if (cur?.value === v) return withAnswer(config, s, id, null); // toggle off
  return withAnswer(config, s, id, { value: v }); // fresh pick drops stale extras
}

/** Merge a partial answer (text / number / datetime companions). Empty values clear keys. */
export function mergeAnswer(
  config: FlowConfig,
  s: SessionState,
  id: string,
  patch: Partial<AnswerValue>
): SessionState {
  const cur = s.arc.answers[id] ?? {};
  const a: Record<string, unknown> = { ...cur, ...patch };
  for (const k of Object.keys(a)) {
    if (a[k] === "" || a[k] === null || a[k] === undefined) delete a[k];
  }
  return withAnswer(config, s, id, Object.keys(a).length ? (a as AnswerValue) : null);
}

/** Skip nodes (comma-separated ids, matching the reference API): clears their answers. */
export function skipNodes(config: FlowConfig, s: SessionState, ids: string): SessionState {
  const skipped = { ...s.skipped };
  const answers = { ...s.arc.answers };
  for (const id of ids.split(",")) {
    skipped[id] = true;
    delete answers[id];
  }
  return syncArc(config, { ...s, skipped, arc: { ...s.arc, answers } });
}

/** Set a moment's journal free text (render-level affordance; not a node answer). */
export function setJournal(s: SessionState, moment: string, text: string): SessionState {
  const journal = { ...s.arc.journal };
  if (text) journal[moment] = text;
  else delete journal[moment];
  return { ...s, arc: { ...s.arc, journal } };
}

/** Start a session in one of the four incident entry paths. */
export function presetSession(
  config: FlowConfig,
  p: IncidentPreset | "reset",
  nowIso: string
): SessionState {
  if (p === "reset" || isLinear(config)) return blankSession(config);
  let s = blankSession(config);
  if (p === "live") {
    s = {
      ...s,
      mode: "live",
      arc: {
        ...s.arc,
        entry: "urge_now",
        urge_at: nowIso,
        answers: { E1: { value: "tapped" } },
      },
    };
  } else {
    s = {
      ...s,
      mode: "log",
      arc: { ...s.arc, entry: "retrospective", answers: { O1: { value: p } } },
    };
  }
  return syncArc(config, s);
}
