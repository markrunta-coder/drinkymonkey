#!/usr/bin/env node
// Lint a Drinkchart incident-tree config. Zero dependencies.
//
// Usage: node tools/lint-tree.mjs config/tree.v1.json
//
// Enforces the governing rules from Drinkchart_Incident_Tree_Spec_v0.1:
//   * structural validity (mirrors schema/tree-config.schema.json)
//   * unique node ids; unique option values per node
//   * every spawn target exists; if_value is a real option value (or "*")
//   * no cycles in the spawn graph
//   * spawn-chain depth <= 3 (a conditional chain may involve at most 3 nodes;
//     the linear floor is bounded separately by the floor rule)
//   * floor <= 3 nodes per branch; floor nodes exist and are required
//   * required nodes appear in a floor (depth is invited, never required)
//   * every node is reachable (floor, cards, entry chips, or spawn) — a node
//     nothing reads is a node that gets cut
//   * tag_rules reference real nodes, values, and outcomes
//
// Exit code: 0 clean (warnings allowed), 1 errors found, 2 unusable input.

import { readFileSync } from "node:fs";

const MOMENTS = ["entry", "outcome", "before", "fight", "after", "metrics"];
const INPUT_TYPES = ["tap", "single", "multi", "chips", "number", "text"];
const CHOICE_TYPES = ["single", "multi", "chips"];
const BRANCHES = ["live", "drank", "resisted", "delayed"];
const CARD_MOMENTS = ["before", "fight", "after", "metrics"];
const OUTCOMES = ["drank", "resisted", "delayed"];
const MAX_FLOOR = 3;
const MAX_DEPTH = 3;

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const path = process.argv[2];
if (!path) {
  console.error("usage: node tools/lint-tree.mjs <config.json>");
  process.exit(2);
}

let cfg;
try {
  cfg = JSON.parse(readFileSync(path, "utf8"));
} catch (e) {
  console.error(`cannot read or parse ${path}: ${e.message}`);
  process.exit(2);
}

// ---------------------------------------------------------------- structure
if (!Number.isInteger(cfg.tree_version) || cfg.tree_version < 1) {
  err("tree_version must be a positive integer");
}
if (!Array.isArray(cfg.nodes) || cfg.nodes.length === 0) {
  console.error("nodes must be a non-empty array — nothing else to check");
  process.exit(2);
}
if (typeof cfg.branches !== "object" || cfg.branches === null) {
  console.error("branches must be an object — nothing else to check");
  process.exit(2);
}

// ------------------------------------------------------------------- nodes
const byId = new Map();
for (const n of cfg.nodes) {
  if (typeof n.id !== "string" || !/^[A-Z][A-Za-z0-9]{0,7}$/.test(n.id)) {
    err(`node id ${JSON.stringify(n.id)} is invalid (expected e.g. "O1", "B3A", drill-down "B1a")`);
    continue;
  }
  if (byId.has(n.id)) {
    err(`duplicate node id ${n.id}`);
    continue; // keep the first definition so its rules are still checked
  }
  byId.set(n.id, n);
}

for (const [id, n] of byId) {
  if (!MOMENTS.includes(n.moment)) {
    err(`${id}: moment ${JSON.stringify(n.moment)} is not one of ${MOMENTS.join(" | ")}`);
  }
  if (typeof n.prompt !== "string" || n.prompt.trim() === "") {
    err(`${id}: prompt is required`);
  }
  if (!INPUT_TYPES.includes(n.input_type)) {
    err(`${id}: input_type ${JSON.stringify(n.input_type)} is not one of ${INPUT_TYPES.join(" | ")}`);
    continue;
  }

  const isChoice = CHOICE_TYPES.includes(n.input_type);
  if (isChoice) {
    if (!Array.isArray(n.options) || n.options.length < 2) {
      err(`${id}: ${n.input_type} needs at least 2 options`);
    } else {
      const seen = new Set();
      for (const o of n.options) {
        if (typeof o.value !== "string" || !/^[a-z0-9_]+$/.test(o.value)) {
          err(`${id}: option value ${JSON.stringify(o.value)} is invalid (lowercase snake_case)`);
          continue;
        }
        if (seen.has(o.value)) err(`${id}: duplicate option value "${o.value}"`);
        seen.add(o.value);
        if (typeof o.label !== "string" || o.label === "") {
          err(`${id}: option "${o.value}" needs a label`);
        }
      }
    }
  } else if (n.options !== undefined) {
    err(`${id}: input_type ${n.input_type} must not define options`);
  }

  if (n.max_select !== undefined) {
    if (n.input_type !== "multi") {
      err(`${id}: max_select is only valid on multi`);
    } else if (
      !Number.isInteger(n.max_select) ||
      n.max_select < 1 ||
      n.max_select > (n.options?.length ?? 0)
    ) {
      err(`${id}: max_select must be an integer in 1..${n.options?.length ?? 0}`);
    }
  }
  if (n.allow_secondary && n.input_type !== "single") {
    err(`${id}: allow_secondary is only valid on single`);
  }

  const optionValues = new Set((n.options ?? []).map((o) => o.value));
  for (const [i, r] of (n.spawn_rules ?? []).entries()) {
    const where = `${id}: spawn_rules[${i}]`;
    const targets = ["then_node", "then_branch", "then_action"].filter((k) => r[k] !== undefined);
    if (targets.length !== 1) {
      err(`${where} must set exactly one of then_node | then_branch | then_action`);
    }
    if (typeof r.if_value !== "string") {
      err(`${where} needs an if_value`);
    } else if (r.if_value !== "*" && !optionValues.has(r.if_value)) {
      err(`${where}: if_value "${r.if_value}" is not an option value of ${id}`);
    }
    if (r.then_node !== undefined && !byId.has(r.then_node)) {
      err(`${where}: spawn target "${r.then_node}" does not exist`);
    }
    if (r.then_branch !== undefined && !BRANCHES.includes(r.then_branch)) {
      err(`${where}: then_branch "${r.then_branch}" is not one of ${BRANCHES.join(" | ")}`);
    }
    if (r.then_action !== undefined && r.then_action !== "keep_open") {
      err(`${where}: then_action must be "keep_open"`);
    }
  }
}

// ---------------------------------------------------------------- branches
const referenced = new Set();
for (const b of Object.keys(cfg.branches)) {
  if (!BRANCHES.includes(b)) err(`unknown branch "${b}"`);
}
for (const b of BRANCHES) {
  const br = cfg.branches[b];
  if (!br) {
    err(`branch "${b}" is missing`);
    continue;
  }
  if (!Array.isArray(br.floor) || br.floor.length === 0) {
    err(`branch ${b}: floor must be a non-empty array`);
  } else {
    if (br.floor.length > MAX_FLOOR) {
      err(`branch ${b}: floor has ${br.floor.length} nodes (max ${MAX_FLOOR})`);
    }
    for (const id of br.floor) {
      if (!byId.has(id)) {
        err(`branch ${b}: floor node "${id}" does not exist`);
        continue;
      }
      referenced.add(id);
      const n = byId.get(id);
      if (n.input_type !== "tap" && n.required !== true) {
        err(`branch ${b}: floor node ${id} must be required:true`);
      }
    }
  }
  for (const m of Object.keys(br.cards ?? {})) {
    if (!CARD_MOMENTS.includes(m)) {
      err(`branch ${b}: unknown card moment "${m}"`);
      continue;
    }
    const list = br.cards[m];
    if (!Array.isArray(list)) {
      err(`branch ${b}: cards.${m} must be an array`);
      continue;
    }
    const seen = new Set();
    for (const id of list) {
      if (!byId.has(id)) {
        err(`branch ${b}: cards.${m} references missing node "${id}"`);
        continue;
      }
      if (seen.has(id)) err(`branch ${b}: cards.${m} lists ${id} twice`);
      seen.add(id);
      referenced.add(id);
      const n = byId.get(id);
      if (n.moment !== m) {
        warn(`branch ${b}: node ${id} (moment "${n.moment}") is listed under cards.${m}`);
      }
      if (n.required === true) {
        err(`branch ${b}: cards.${m} lists ${id} which is required:true — cards must be skippable`);
      }
    }
  }
  for (const id of br.entry_chips ?? []) {
    if (!byId.has(id)) {
      err(`branch ${b}: entry_chips references missing node "${id}"`);
      continue;
    }
    referenced.add(id);
  }
}

// Required nodes must sit in some floor: depth is invited, never required.
const floorIds = new Set(
  BRANCHES.flatMap((b) => cfg.branches[b]?.floor ?? []).filter((id) => byId.has(id))
);
for (const [id, n] of byId) {
  if (n.required === true && !floorIds.has(id)) {
    err(`${id} is required:true but belongs to no branch floor — depth must stay optional`);
  }
}

// --------------------------------------------------------------- tag rules
for (const [i, t] of (cfg.tag_rules ?? []).entries()) {
  const where = `tag_rules[${i}]`;
  if (typeof t.add_tag !== "string" || !/^[a-z0-9][a-z0-9_-]*$/.test(t.add_tag)) {
    err(`${where}: add_tag ${JSON.stringify(t.add_tag)} is invalid (lowercase, - or _ separators)`);
  }
  const n = byId.get(t.node);
  if (!n) {
    err(`${where}: node "${t.node}" does not exist`);
    continue;
  }
  const optionValues = new Set((n.options ?? []).map((o) => o.value));
  if (!Array.isArray(t.if_value_in) || t.if_value_in.length === 0) {
    err(`${where}: if_value_in must be a non-empty array`);
  } else {
    for (const v of t.if_value_in) {
      if (!optionValues.has(v)) err(`${where}: "${v}" is not an option value of ${t.node}`);
    }
  }
  if (t.if_outcome !== undefined && !OUTCOMES.includes(t.if_outcome)) {
    err(`${where}: if_outcome "${t.if_outcome}" is not one of ${OUTCOMES.join(" | ")}`);
  }
}

// ------------------------------------------- spawn graph: cycles and depth
const edges = new Map(); // node id -> [spawn-target node ids]
for (const [id, n] of byId) {
  edges.set(
    id,
    (n.spawn_rules ?? []).map((r) => r.then_node).filter((t) => t !== undefined && byId.has(t))
  );
}

// Cycle detection: DFS with colors (0 unseen, 1 on stack, 2 done).
const color = new Map();
const stack = [];
let cycle = null;
function dfs(id) {
  color.set(id, 1);
  stack.push(id);
  for (const next of edges.get(id) ?? []) {
    if (cycle) return;
    const c = color.get(next) ?? 0;
    if (c === 1) {
      cycle = [...stack.slice(stack.indexOf(next)), next];
      return;
    }
    if (c === 0) dfs(next);
  }
  stack.pop();
  color.set(id, 2);
}
for (const id of byId.keys()) {
  if ((color.get(id) ?? 0) === 0) dfs(id);
  if (cycle) break;
}
if (cycle) {
  err(`spawn graph has a cycle: ${cycle.join(" -> ")}`);
} else {
  // Depth: nodes in the longest spawn chain, from any chain root.
  // The spec's "depth from entry never exceeds 3": E2 -> O1 -> D1 is exactly 3.
  const memo = new Map();
  const chainLen = (id) => {
    if (memo.has(id)) return memo.get(id);
    const kids = edges.get(id) ?? [];
    const len = 1 + (kids.length ? Math.max(...kids.map(chainLen)) : 0);
    memo.set(id, len);
    return len;
  };
  for (const id of byId.keys()) {
    const len = chainLen(id);
    if (len > MAX_DEPTH) {
      const path = [id];
      let cur = id;
      while ((edges.get(cur) ?? []).length) {
        cur = (edges.get(cur) ?? []).reduce((a, b) => (chainLen(a) >= chainLen(b) ? a : b));
        path.push(cur);
      }
      err(`spawn chain exceeds depth ${MAX_DEPTH}: ${path.join(" -> ")} (${len} nodes)`);
    }
  }
}

// ------------------------------------------------------------ reachability
// Seeds: entry nodes, every floor node, every card, every entry chip.
// Expand through spawn edges. Anything left over is a node nothing renders.
const reachable = new Set(referenced);
for (const [id, n] of byId) if (n.moment === "entry") reachable.add(id);
let grew = true;
while (grew) {
  grew = false;
  for (const id of [...reachable]) {
    for (const next of edges.get(id) ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        grew = true;
      }
    }
  }
}
for (const id of byId.keys()) {
  if (!reachable.has(id)) {
    err(`${id} is unreachable — not in any floor, card list, entry chips, or spawn chain`);
  }
}

// ------------------------------------------------------------------ report
const rel = path.replace(/\\/g, "/");
if (warnings.length) {
  console.log(`warnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  ~ ${w}`);
}
if (errors.length) {
  console.log(`errors (${errors.length}):`);
  for (const e of errors) console.log(`  x ${e}`);
  console.log(`\n${rel}: FAIL — ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(
  `${rel}: OK — tree_version ${cfg.tree_version}, ${byId.size} nodes, ` +
    `${[...byId.values()].reduce((s, n) => s + (n.spawn_rules?.length ?? 0), 0)} spawn rules, ` +
    `${warnings.length} warning(s)`
);
process.exit(0);
