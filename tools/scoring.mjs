// AUDIT-C scoring — pure functions, no I/O, no state.
// Thresholds are CONFIG VALUES (config/onboarding.v1.json -> scoring.audit_c.bands),
// passed in by the caller — never hard-coded here. The shipped bands are
// PROVISIONAL pending clinical review: elevated >= 3 (women) / >= 4 (men, other,
// or gender skipped), high >= 7. Mechanism only — safety copy and routing are
// authored design-side and are not this module's concern.

/** Sum the three AUDIT-C items (each 0-4) into the 0-12 total. Throws on invalid input. */
export function auditC(q1, q2, q3) {
  for (const [i, q] of [q1, q2, q3].entries()) {
    if (!Number.isInteger(q) || q < 0 || q > 4) {
      throw new RangeError(`AUDIT-C item ${i + 1} must be an integer 0-4, got ${JSON.stringify(q)}`);
    }
  }
  return q1 + q2 + q3;
}

/**
 * Map a score to a screening band using config-supplied thresholds.
 * bands: { <band>: { default: n, [gender]: n } } — e.g. the onboarding config's
 * { elevated: { woman: 3, default: 4 }, high: { default: 7 } }.
 * gender: option value ("woman", "man", "other") or null/undefined when skipped.
 * Returns the highest-threshold band the score meets, or "none".
 */
export function screenBand(score, gender, bands) {
  if (!Number.isInteger(score) || score < 0) {
    throw new RangeError(`score must be a non-negative integer, got ${JSON.stringify(score)}`);
  }
  let best = null;
  for (const [band, mins] of Object.entries(bands)) {
    const min = gender != null && Number.isInteger(mins[gender]) ? mins[gender] : mins.default;
    if (score >= min && (best === null || min > best.min)) best = { band, min };
  }
  return best ? best.band : "none";
}

/**
 * Convenience: score a set of config answers directly.
 * config: a linear-flow config with a scoring.<instrument> section.
 * answers: { nodeId: { value } } — the canonical answer shapes.
 * Returns { score, band } (band uses the gender answer when the config's flow captured one via a "GEN" node).
 */
export function scoreInstrument(config, instrument, answers, gender = null) {
  const inst = config.scoring?.[instrument];
  if (!inst) throw new Error(`config has no scoring.${instrument}`);
  let score = 0;
  for (const id of inst.sum_of) {
    const node = config.nodes.find((n) => n.id === id);
    const a = answers[id];
    if (!a || a.value === undefined) throw new Error(`missing answer for scored node ${id}`);
    const opt = (node?.options ?? []).find((o) => o.value === a.value);
    if (!opt || opt.score === undefined) throw new Error(`answer ${JSON.stringify(a.value)} on ${id} has no score`);
    score += opt.score;
  }
  return { score, band: screenBand(score, gender, inst.bands) };
}
