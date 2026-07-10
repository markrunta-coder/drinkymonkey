// Headless smoke test for tools/preview.html — extracts the inline script,
// stubs the DOM, loads the real config, and drives every preset through
// its floor, checking floor counts, spawns, tags, and answer shapes.
// Usage: node tools/smoke-preview.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "tools/preview.html"), "utf8");
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) throw new Error("no script block found");
const src = m[1];

// --- DOM / fetch stubs ---
const elements = {};
function stubEl() {
  return {
    innerHTML: "", className: "", textContent: "",
    addEventListener() {}, dataset: {}, closest() { return null; },
  };
}
const documentStub = {
  querySelector(sel) { return elements[sel] ?? (elements[sel] = stubEl()); },
  querySelectorAll() { return []; },
  addEventListener() {},
};
const fetchStub = async () => { throw new Error("no network in smoke test"); };

const fn = new Function("document", "fetch", "alert", src + `
;return { initTree, preset, answerChip, mergeAnswer, skipNodes,
  requiredIds, floorMet, effOutcome, stillDeciding,
  getS: () => S, getTree: () => TREE };`);
const api = fn(documentStub, fetchStub, () => {});

const cfg = JSON.parse(readFileSync(join(root, "config/tree.v1.json"), "utf8"));
api.initTree(cfg, "smoke");

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? "ok " : "FAIL"} ${label}`);
  if (!cond) failures++;
};

// --- drank floor: O1 -> T1 -> QTY = 3 ---
api.preset("drank");
check("drank: floor is 3 required taps", api.requiredIds().length === 3);
check("drank: floor not met yet", !api.floorMet());
api.answerChip("T1", "last_night");
api.answerChip("QTY", "3_4");
check("drank: floor met after O1+T1+QTY", api.floorMet());
check("drank: effective outcome = drank", api.effOutcome() === "drank");

// QTY exact requires a number before the floor counts it
api.answerChip("QTY", "exact");
check("drank: QTY 'exact' without number blocks floor", !api.floorMet());
api.mergeAnswer("QTY", { number: 7 });
check("drank: QTY exact + number meets floor", api.floorMet());
check("drank: QTY shape is {value:'exact',number:7}",
  JSON.stringify(api.getS().arc.answers.QTY) === '{"value":"exact","number":7}');

// broke_own_rule: B4 intention x drank outcome (snake_case per rev B ruling)
api.answerChip("B4", "had_a_limit");
check("drank: broke_own_rule tag fires", api.getS().arc.tags.includes("broke_own_rule"));

// F1 real fight spawns depth (spawn rules read the answer)
api.answerChip("F1", "real_fight");
const f1 = api.getTree().nodes.find((n) => n.id === "F1");
check("F1 spawns F2 and F3 on real_fight",
  f1.spawn_rules.filter((r) => r.if_value === "real_fight").length === 2);

// B1 primary + secondary, social spawns B1a
api.answerChip("B1", "social");
api.answerChip("B1", "stress");
check("B1 secondary lands as {value:'social',secondary:'stress'}",
  JSON.stringify(api.getS().arc.answers.B1) === '{"value":"social","secondary":"stress"}');
api.answerChip("B1a", "going_along");
check("B1a answer accepted", api.getS().arc.answers.B1a.value === "going_along");

// --- resisted floor: O1 -> T1 = 2 ---
api.preset("resisted");
check("resisted: floor is 2 required taps", api.requiredIds().length === 2);
api.answerChip("T1", "just_now");
check("resisted: floor met after O1+T1", api.floorMet());

// --- delayed: still deciding keeps the arc open ---
api.preset("delayed");
check("delayed: floor is 3 required taps (O1,T1,D1)", api.requiredIds().length === 3);
api.answerChip("T1", "earlier_today");
api.answerChip("D1", "still_deciding");
check("delayed: still_deciding -> arc stays open", api.stillDeciding() && !api.floorMet());
check("delayed: delayed_first tag set", api.getS().arc.tags.includes("delayed_first"));
check("delayed: arc outcome stays 'delayed'", api.getS().arc.outcome === "delayed");
check("delayed: status stays open", api.getS().arc.status === "open");

// --- delayed -> drank anyway: redirect adds QTY (4 taps total, rev B footnote) ---
api.answerChip("D1", "still_deciding"); // toggle off
api.answerChip("D1", "drank_anyway");
check("delayed->drank: required grows to 4 (adds QTY)", api.requiredIds().length === 4);
check("delayed->drank: floor not met until QTY", !api.floorMet());
api.answerChip("QTY", "5_6");
check("delayed->drank: floor met at 4 taps", api.floorMet());
check("delayed->drank: effective outcome = drank", api.effOutcome() === "drank");
check("delayed->drank: delayed_first tag preserved", api.getS().arc.tags.includes("delayed_first"));
check("delayed->drank: arc outcome now effective 'drank'", api.getS().arc.outcome === "drank");

// --- delayed -> didn't drink: a win, delayed_first preserved ---
api.preset("delayed");
api.answerChip("T1", "yesterday");
api.answerChip("D1", "didnt_drink");
check("delayed->resisted: floor met (3 taps)", api.floorMet());
check("delayed->resisted: effective outcome = resisted", api.effOutcome() === "resisted");
check("delayed->resisted: delayed_first preserved (delay success)",
  api.getS().arc.tags.includes("delayed_first"));

// --- T1 custom requires a datetime ---
api.preset("resisted");
api.answerChip("T1", "custom");
check("T1 'custom' without datetime blocks floor", !api.floorMet());
api.mergeAnswer("T1", { datetime: "2026-07-09T22:30" });
check("T1 custom + datetime meets floor", api.floorMet());

// --- live urge: one tap is a complete entry ---
api.preset("live");
const live = api.getS();
check("live: E1 answered {value:'tapped'}", live.arc.answers.E1.value === "tapped");
check("live: entry mode urge_now, arc open", live.arc.entry === "urge_now" && live.arc.status === "open");
check("live: live_capture tag fires (tap sentinel rule)", live.arc.tags.includes("live_capture"));

// --- multi max_select cap (F5 <= 2) ---
api.preset("drank");
api.answerChip("F5", "trapped");
api.answerChip("F5", "resigned");
api.answerChip("F5", "in_control"); // over cap, must be ignored
check("F5 max_select 2 enforced",
  JSON.stringify(api.getS().arc.answers.F5.values) === '["trapped","resigned"]');

// --- skip clears the answer ---
api.answerChip("B2", "stressed");
api.skipNodes("B2");
check("skip removes the answer", api.getS().arc.answers.B2 === undefined);

/* ================= onboarding (linear flow) ================= */
const onboarding = JSON.parse(readFileSync(join(root, "config/onboarding.v1.json"), "utf8"));
api.initTree(onboarding, "smoke-onboarding");

const floor = api.requiredIds();
const defaulted = floor.filter((id) => onboarding.nodes.find((n) => n.id === id)?.default_value !== undefined);
check("onboarding: floor is 6 required nodes", floor.length === 6);
check("onboarding: required path is 5 taps (goal preselected), under the 8-tap ceiling",
  floor.length - defaulted.length === 5 && floor.length <= 8);
check("onboarding: GOAL defaults to understand_my_drinking",
  api.getS().arc.answers.GOAL?.value === "understand_my_drinking");
check("onboarding: floor not met before answering", !api.floorMet());

api.answerChip("AGE", "25_39");
api.answerChip("DWK", "8_14");
api.answerChip("AC1", "2_3_week");        // 3
api.answerChip("AC2", "3_4");             // 1
api.answerChip("AC3", "less_than_monthly"); // 1
check("onboarding: floor met after 5 taps", api.floorMet());

let d = api.getS().arc.derived;
check("onboarding: derived audit_c_score = 5", d.audit_c_score === 5);
check("onboarding: score 5, no gender -> elevated (default threshold 4, provisional)",
  d.screen_band === "elevated (provisional)");
check("onboarding: profile mapping (age_band, goal_type)",
  d.age_band === "25_39" && d.goal_type === "understand_my_drinking");

// gender-sensitive banding through the harness
api.answerChip("GEN", "woman");
d = api.getS().arc.derived;
check("onboarding: woman threshold applies", d.screen_band === "elevated (provisional)");
api.skipNodes("GEN");
check("onboarding: GEN skippable, floor still met", api.floorMet());

/* ================= scoring module: 3 known input/output sets ================= */
const { auditC, screenBand, scoreInstrument } = await import(
  new URL("file://" + join(root, "tools/scoring.mjs").replace(/\\/g, "/"))
);
const bands = onboarding.scoring.audit_c.bands;

// set 1: all zeros -> 0, none for everyone
check("auditC(0,0,0) = 0", auditC(0, 0, 0) === 0);
check("score 0 -> none (woman)", screenBand(0, "woman", bands) === "none");
check("score 0 -> none (man)", screenBand(0, "man", bands) === "none");

// set 2: (1,1,1) -> 3, elevated for women only
check("auditC(1,1,1) = 3", auditC(1, 1, 1) === 3);
check("score 3 -> elevated (woman)", screenBand(3, "woman", bands) === "elevated");
check("score 3 -> none (man)", screenBand(3, "man", bands) === "none");
check("score 3 -> none (gender skipped)", screenBand(3, null, bands) === "none");
check("score 4 -> elevated (man)", screenBand(4, "man", bands) === "elevated");

// set 3: (2,2,3) -> 7 high; (4,4,4) -> 12 high
check("auditC(2,2,3) = 7", auditC(2, 2, 3) === 7);
check("score 7 -> high (any gender)", screenBand(7, "woman", bands) === "high" && screenBand(7, "man", bands) === "high");
check("auditC(4,4,4) = 12 -> high", screenBand(auditC(4, 4, 4), null, bands) === "high");

// out-of-range input throws
let threw = false;
try { auditC(5, 0, 0); } catch { threw = true; }
check("auditC rejects out-of-range items", threw);

// scoreInstrument agrees with the harness path
const si = scoreInstrument(onboarding, "audit_c",
  { AC1: { value: "2_3_week" }, AC2: { value: "3_4" }, AC3: { value: "less_than_monthly" } }, "woman");
check("scoreInstrument matches harness (5, elevated)", si.score === 5 && si.band === "elevated");

console.log(failures ? `\n${failures} FAILURE(S)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
