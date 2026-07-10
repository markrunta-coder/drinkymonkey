// Types for the versioned flow config (schema/tree-config.schema.json) and
// the runtime session/arc state. Hand-written from the schema — kept minimal
// and forward-compatible: the renderer ignores unknown node fields and hides
// nodes with an unrecognized input_type (README forward-compatibility rule).
//
// PURE MODULE: no React, no react-native, no I/O anywhere in src/engine.

export type FlowKind = "incident" | "linear";

export type Moment =
  "entry" | "outcome" | "before" | "fight" | "after" | "metrics" | "profile" | "audit" | "goal";

export type InputType = "tap" | "single" | "multi" | "chips" | "number" | "text";

export type Outcome = "drank" | "resisted" | "delayed";

export interface ConfigOption {
  value: string;
  label: string;
  requires_text?: boolean;
  requires_number?: boolean;
  requires_datetime?: boolean;
  score?: number;
}

export interface SpawnRule {
  if_value: string; // an option value, or "*" for any answer
  then_node?: string;
  then_branch?: Outcome | "live";
  then_action?: "keep_open";
}

export interface ConfigNode {
  id: string;
  moment: Moment;
  prompt: string;
  input_type: InputType | (string & {}); // unknown input types are hidden, not fatal
  options?: ConfigOption[];
  max_select?: number;
  required?: boolean;
  default_value?: string;
  allow_secondary?: boolean;
  allow_free_text?: boolean;
  card_group?: string;
  spawn_rules?: SpawnRule[];
  notes?: string;
}

export interface Branch {
  floor: string[];
  sequence?: string[]; // linear flows only
  cards?: Partial<Record<"before" | "fight" | "after" | "metrics", string[]>>;
  entry_chips?: string[];
}

export interface TagRule {
  node: string;
  if_value_in: string[];
  if_outcome?: Outcome;
  add_tag: string;
}

export interface InstrumentBands {
  [band: string]: { default: number; [gender: string]: number };
}

export interface Instrument {
  sum_of: string[];
  bands: InstrumentBands;
  provisional?: boolean;
  notes?: string;
}

export interface FlowConfig {
  tree_version: number;
  flow?: FlowKind; // absent = "incident"
  notes?: string;
  nodes: ConfigNode[];
  branches: Partial<Record<"live" | "drank" | "resisted" | "delayed" | "main", Branch>>;
  tag_rules?: TagRule[];
  scoring?: Record<string, Instrument>;
}

// ---------------------------------------------------------------- answers
// The canonical jsonb shapes persisted in dc_answers.value (README table).
export interface AnswerValue {
  value?: string; // tap/single/chips (tap uses the sentinel "tapped")
  secondary?: string; // single + allow_secondary (B1)
  values?: string[]; // multi
  text?: string; // free text / requires_text / text nodes
  number?: number; // number / requires_number
  datetime?: string; // ISO 8601, requires_datetime
}

export type Answers = Record<string, AnswerValue>;

// ---------------------------------------------------------------- session
export type ArcStatus = "open" | "complete";

/** The arc under capture — mirrors what dc_arcs + dc_answers persist. */
export interface ArcState {
  tree_version: number | null;
  entry: "urge_now" | "retrospective" | null;
  urge_at: string | null;
  status: ArcStatus;
  outcome: Outcome | null; // EFFECTIVE outcome, per DB semantics
  tags: string[];
  answers: Answers;
  journal: Record<string, string>; // per-moment free text (render-level affordance)
  derived?: Record<string, string | number | null>; // linear flows: profile preview
}

export type SessionMode = "live" | "log" | "flow" | null;

export interface SessionState {
  mode: SessionMode;
  liveOpen: boolean;
  saved: boolean;
  skipped: Record<string, boolean>;
  moreShown: Record<string, boolean>;
  arc: ArcState;
}

export type IncidentPreset = "live" | "drank" | "resisted" | "delayed";
