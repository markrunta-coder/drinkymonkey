// Behavior-parity suite: every check from tools/smoke-preview.mjs (the
// behavioral reference for the renderer), ported 1:1 against the pure TS
// engine. A thin harness reproduces the preview API (initTree / preset /
// answerChip / mergeAnswer / skipNodes ...) over the immutable engine.
import onboardingCfg from "../../config/bundled/onboarding.v1.json";
import treeCfg from "../../config/bundled/tree.v1.json";
import {
  effOutcome as engEffOutcome,
  floorMet as engFloorMet,
  requiredIds as engRequiredIds,
  stillDeciding as engStillDeciding,
} from "../engine";
import { auditC, scoreInstrument, screenBand } from "../scoring";
import {
  answerChip as sAnswerChip,
  blankSession,
  mergeAnswer as sMergeAnswer,
  presetSession,
  skipNodes as sSkipNodes,
} from "../session";
import type { AnswerValue, FlowConfig, IncidentPreset, SessionState } from "../types";

// ---- harness: the reference preview's API over the pure engine ----
let TREE: FlowConfig;
let S: SessionState;

const api = {
  initTree(cfg: FlowConfig) {
    TREE = cfg;
    S = blankSession(cfg);
  },
  preset(p: IncidentPreset | "reset") {
    S = presetSession(TREE, p, new Date().toISOString());
  },
  answerChip(id: string, v: string) {
    S = sAnswerChip(TREE, S, id, v);
  },
  mergeAnswer(id: string, patch: Partial<AnswerValue>) {
    S = sMergeAnswer(TREE, S, id, patch);
  },
  skipNodes(ids: string) {
    S = sSkipNodes(TREE, S, ids);
  },
  requiredIds: () => engRequiredIds(TREE, S.arc.answers),
  floorMet: () => engFloorMet(TREE, S.arc.answers),
  effOutcome: () => engEffOutcome(S.arc.answers),
  stillDeciding: () => engStillDeciding(S.arc.answers),
  getS: () => S,
  getTree: () => TREE,
};

const cfg = treeCfg as unknown as FlowConfig;
const onboarding = onboardingCfg as unknown as FlowConfig;

describe("incident tree parity (tools/smoke-preview.mjs)", () => {
  beforeAll(() => api.initTree(cfg));

  test("drank floor: O1 -> T1 -> QTY = 3", () => {
    api.preset("drank");
    // drank: floor is 3 required taps
    expect(api.requiredIds().length).toBe(3);
    // drank: floor not met yet
    expect(api.floorMet()).toBe(false);
    api.answerChip("T1", "last_night");
    api.answerChip("QTY", "3_4");
    // drank: floor met after O1+T1+QTY
    expect(api.floorMet()).toBe(true);
    // drank: effective outcome = drank
    expect(api.effOutcome()).toBe("drank");
  });

  test("QTY exact requires a number before the floor counts it", () => {
    api.answerChip("QTY", "exact");
    // drank: QTY 'exact' without number blocks floor
    expect(api.floorMet()).toBe(false);
    api.mergeAnswer("QTY", { number: 7 });
    // drank: QTY exact + number meets floor
    expect(api.floorMet()).toBe(true);
    // drank: QTY shape is {value:'exact',number:7}
    expect(JSON.stringify(api.getS().arc.answers.QTY)).toBe('{"value":"exact","number":7}');
  });

  test("broke_own_rule: B4 intention x drank outcome (snake_case per rev B)", () => {
    api.answerChip("B4", "had_a_limit");
    // drank: broke_own_rule tag fires
    expect(api.getS().arc.tags).toContain("broke_own_rule");
  });

  test("F1 real fight spawns depth (spawn rules read the answer)", () => {
    api.answerChip("F1", "real_fight");
    const f1 = api.getTree().nodes.find((n) => n.id === "F1")!;
    // F1 spawns F2 and F3 on real_fight
    expect(f1.spawn_rules!.filter((r) => r.if_value === "real_fight").length).toBe(2);
  });

  test("B1 primary + secondary, social spawns B1a", () => {
    api.answerChip("B1", "social");
    api.answerChip("B1", "stress");
    // B1 secondary lands as {value:'social',secondary:'stress'}
    expect(JSON.stringify(api.getS().arc.answers.B1)).toBe(
      '{"value":"social","secondary":"stress"}'
    );
    api.answerChip("B1a", "going_along");
    // B1a answer accepted
    expect(api.getS().arc.answers.B1a!.value).toBe("going_along");
  });

  test("resisted floor: O1 -> T1 = 2", () => {
    api.preset("resisted");
    // resisted: floor is 2 required taps
    expect(api.requiredIds().length).toBe(2);
    api.answerChip("T1", "just_now");
    // resisted: floor met after O1+T1
    expect(api.floorMet()).toBe(true);
  });

  test("delayed: still deciding keeps the arc open", () => {
    api.preset("delayed");
    // delayed: floor is 3 required taps (O1,T1,D1)
    expect(api.requiredIds().length).toBe(3);
    api.answerChip("T1", "earlier_today");
    api.answerChip("D1", "still_deciding");
    // delayed: still_deciding -> arc stays open
    expect(api.stillDeciding() && !api.floorMet()).toBe(true);
    // delayed: delayed_first tag set
    expect(api.getS().arc.tags).toContain("delayed_first");
    // delayed: arc outcome stays 'delayed'
    expect(api.getS().arc.outcome).toBe("delayed");
    // delayed: status stays open
    expect(api.getS().arc.status).toBe("open");
  });

  test("delayed -> drank anyway: redirect adds QTY (4 taps total, rev B footnote)", () => {
    api.answerChip("D1", "still_deciding"); // toggle off
    api.answerChip("D1", "drank_anyway");
    // delayed->drank: required grows to 4 (adds QTY)
    expect(api.requiredIds().length).toBe(4);
    // delayed->drank: floor not met until QTY
    expect(api.floorMet()).toBe(false);
    api.answerChip("QTY", "5_6");
    // delayed->drank: floor met at 4 taps
    expect(api.floorMet()).toBe(true);
    // delayed->drank: effective outcome = drank
    expect(api.effOutcome()).toBe("drank");
    // delayed->drank: delayed_first tag preserved
    expect(api.getS().arc.tags).toContain("delayed_first");
    // delayed->drank: arc outcome now effective 'drank'
    expect(api.getS().arc.outcome).toBe("drank");
  });

  test("delayed -> didn't drink: a win, delayed_first preserved", () => {
    api.preset("delayed");
    api.answerChip("T1", "yesterday");
    api.answerChip("D1", "didnt_drink");
    // delayed->resisted: floor met (3 taps)
    expect(api.floorMet()).toBe(true);
    // delayed->resisted: effective outcome = resisted
    expect(api.effOutcome()).toBe("resisted");
    // delayed->resisted: delayed_first preserved (delay success)
    expect(api.getS().arc.tags).toContain("delayed_first");
  });

  test("T1 custom requires a datetime", () => {
    api.preset("resisted");
    api.answerChip("T1", "custom");
    // T1 'custom' without datetime blocks floor
    expect(api.floorMet()).toBe(false);
    api.mergeAnswer("T1", { datetime: "2026-07-09T22:30" });
    // T1 custom + datetime meets floor
    expect(api.floorMet()).toBe(true);
  });

  test("live urge: one tap is a complete entry", () => {
    api.preset("live");
    const live = api.getS();
    // live: E1 answered {value:'tapped'}
    expect(live.arc.answers.E1!.value).toBe("tapped");
    // live: entry mode urge_now, arc open
    expect(live.arc.entry === "urge_now" && live.arc.status === "open").toBe(true);
    // live: live_capture tag fires (tap sentinel rule)
    expect(live.arc.tags).toContain("live_capture");
  });

  test("multi max_select cap (F5 <= 2)", () => {
    api.preset("drank");
    api.answerChip("F5", "trapped");
    api.answerChip("F5", "resigned");
    api.answerChip("F5", "in_control"); // over cap, must be ignored
    // F5 max_select 2 enforced
    expect(JSON.stringify(api.getS().arc.answers.F5!.values)).toBe('["trapped","resigned"]');
  });

  test("skip clears the answer", () => {
    api.answerChip("B2", "stressed");
    api.skipNodes("B2");
    // skip removes the answer
    expect(api.getS().arc.answers.B2).toBeUndefined();
  });
});

describe("onboarding (linear flow) parity", () => {
  beforeAll(() => api.initTree(onboarding));

  test("floor, preselected goal, 5-tap required path", () => {
    const floor = api.requiredIds();
    const defaulted = floor.filter(
      (id) => onboarding.nodes.find((n) => n.id === id)?.default_value !== undefined
    );
    // onboarding: floor is 6 required nodes
    expect(floor.length).toBe(6);
    // onboarding: required path is 5 taps (goal preselected), under the 8-tap ceiling
    expect(floor.length - defaulted.length === 5 && floor.length <= 8).toBe(true);
    // onboarding: GOAL defaults to understand_my_drinking
    expect(api.getS().arc.answers.GOAL?.value).toBe("understand_my_drinking");
    // onboarding: floor not met before answering
    expect(api.floorMet()).toBe(false);
  });

  test("floor met after 5 taps; derived score/band/profile", () => {
    api.answerChip("AGE", "25_39");
    api.answerChip("DWK", "8_14");
    api.answerChip("AC1", "2_3_week"); // 3
    api.answerChip("AC2", "3_4"); // 1
    api.answerChip("AC3", "less_than_monthly"); // 1
    // onboarding: floor met after 5 taps
    expect(api.floorMet()).toBe(true);

    let d = api.getS().arc.derived!;
    // onboarding: derived audit_c_score = 5
    expect(d.audit_c_score).toBe(5);
    // onboarding: score 5, no gender -> elevated (default threshold 4, provisional)
    expect(d.screen_band).toBe("elevated (provisional)");
    // onboarding: profile mapping (age_band, goal_type)
    expect(d.age_band === "25_39" && d.goal_type === "understand_my_drinking").toBe(true);

    // gender-sensitive banding through the harness
    api.answerChip("GEN", "woman");
    d = api.getS().arc.derived!;
    // onboarding: woman threshold applies
    expect(d.screen_band).toBe("elevated (provisional)");
    api.skipNodes("GEN");
    // onboarding: GEN skippable, floor still met
    expect(api.floorMet()).toBe(true);
  });
});

describe("scoring module: 3 known input/output sets (tools/scoring.mjs port)", () => {
  const bands = onboarding.scoring!.audit_c.bands;

  test("set 1: all zeros -> 0, none for everyone", () => {
    expect(auditC(0, 0, 0)).toBe(0);
    expect(screenBand(0, "woman", bands)).toBe("none");
    expect(screenBand(0, "man", bands)).toBe("none");
  });

  test("set 2: (1,1,1) -> 3, elevated for women only", () => {
    expect(auditC(1, 1, 1)).toBe(3);
    expect(screenBand(3, "woman", bands)).toBe("elevated");
    expect(screenBand(3, "man", bands)).toBe("none");
    expect(screenBand(3, null, bands)).toBe("none");
    expect(screenBand(4, "man", bands)).toBe("elevated");
  });

  test("set 3: (2,2,3) -> 7 high; (4,4,4) -> 12 high", () => {
    expect(auditC(2, 2, 3)).toBe(7);
    expect(screenBand(7, "woman", bands) === "high" && screenBand(7, "man", bands) === "high").toBe(
      true
    );
    expect(screenBand(auditC(4, 4, 4), null, bands)).toBe("high");
  });

  test("out-of-range input throws", () => {
    expect(() => auditC(5, 0, 0)).toThrow(RangeError);
  });

  test("scoreInstrument agrees with the harness path", () => {
    const si = scoreInstrument(
      onboarding,
      "audit_c",
      { AC1: { value: "2_3_week" }, AC2: { value: "3_4" }, AC3: { value: "less_than_monthly" } },
      "woman"
    );
    expect(si.score === 5 && si.band === "elevated").toBe(true);
  });
});

// The smoke reference is 57 checks; the expect() count above must never drop
// below it. (Some tests carry several checks, exactly like the reference.)
