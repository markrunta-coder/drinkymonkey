// Data access — client -> Supabase DIRECT, under RLS (tech-stack ruling).
// No API tier; every row the app touches is owned via auth.uid().
import type { Outcome } from "../engine/types";
import { supabase } from "./supabaseClient";

// Row shapes as persisted (db/schema.sql).
export interface ArcRow {
  id: string;
  user_id: string;
  tree_version: number;
  outcome: Outcome | null;
  status: "open" | "complete";
  occurred_at: string | null;
  tags: string[];
  nudged_at?: string | null;
}

export interface AnswerRow {
  arc_id: string;
  node_id: string;
  tree_version: number;
  value: Record<string, unknown>;
}

export interface ProfileRow {
  user_id: string;
  age_band: string;
  gender: string | null;
  drinks_week_band: string;
  drinking_since: string | null;
  audit_c_score: number;
  screen_band: string; // clean band value: none | elevated | high
  device_uuid: string;
  onboarding_version: number;
}

export interface GoalRow {
  id: string;
  user_id: string;
  goal_type: string;
  started_at: string;
  ended_at: string | null;
}

export async function upsertArc(arc: ArcRow): Promise<void> {
  const { error } = await supabase.from("dc_arcs").upsert(arc);
  if (error) throw error;
}

/** Canonical answer upsert: insert ... on conflict (arc_id, node_id) do update. */
export async function upsertAnswer(row: AnswerRow): Promise<void> {
  const { error } = await supabase
    .from("dc_answers")
    .upsert({ ...row, answered_at: new Date().toISOString() }, { onConflict: "arc_id,node_id" });
  if (error) throw error;
}

/** Un-answering / skipping a previously synced node removes its row. */
export async function deleteAnswer(arcId: string, nodeId: string): Promise<void> {
  const { error } = await supabase
    .from("dc_answers")
    .delete()
    .eq("arc_id", arcId)
    .eq("node_id", nodeId);
  if (error) throw error;
}

export async function setNudgedAt(arcId: string, nudgedAt: string): Promise<void> {
  const { error } = await supabase.from("dc_arcs").update({ nudged_at: nudgedAt }).eq("id", arcId);
  if (error) throw error;
}

export async function upsertProfile(row: ProfileRow): Promise<void> {
  const { error } = await supabase.from("dc_profiles").upsert(row);
  if (error) throw error;
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("dc_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileRow) ?? null;
}

/**
 * Goal changes use the end-active-then-insert pattern (db/schema.sql):
 * goal history is never deleted; exactly one active row per user.
 */
export async function setGoal(userId: string, goalType: string): Promise<void> {
  const { data, error } = await supabase
    .from("dc_goals")
    .select("id, goal_type")
    .eq("user_id", userId)
    .is("ended_at", null)
    .maybeSingle();
  if (error) throw error;
  if (data?.goal_type === goalType) return; // unchanged — keep the active row
  if (data) {
    const { error: endErr } = await supabase
      .from("dc_goals")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", data.id);
    if (endErr) throw endErr;
  }
  const { error: insErr } = await supabase
    .from("dc_goals")
    .insert({ user_id: userId, goal_type: goalType });
  if (insErr) throw insErr;
}

export async function fetchActiveGoal(userId: string): Promise<GoalRow | null> {
  const { data, error } = await supabase
    .from("dc_goals")
    .select("*")
    .eq("user_id", userId)
    .is("ended_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data as GoalRow) ?? null;
}

export async function fetchOpenArcs(userId: string): Promise<ArcRow[]> {
  const { data, error } = await supabase
    .from("dc_arcs")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ArcRow[]) ?? [];
}

export async function fetchLastCompleteArc(userId: string): Promise<ArcRow | null> {
  const { data, error } = await supabase
    .from("dc_arcs")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "complete")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ArcRow) ?? null;
}

export async function fetchArc(arcId: string): Promise<ArcRow | null> {
  const { data, error } = await supabase.from("dc_arcs").select("*").eq("id", arcId).maybeSingle();
  if (error) throw error;
  return (data as ArcRow) ?? null;
}

export async function fetchAnswers(arcId: string): Promise<AnswerRow[]> {
  const { data, error } = await supabase.from("dc_answers").select("*").eq("arc_id", arcId);
  if (error) throw error;
  return (data as AnswerRow[]) ?? [];
}
