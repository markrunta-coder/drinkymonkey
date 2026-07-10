// Bridges the pure session state to persistence: derives the dc_arcs row from
// the engine's arc state and diffs answers into canonical upsert/delete ops
// for the offline queue. Write-through: called on every answer mutation.
import { occurredAtFromT1 } from "../engine/engine";
import type { Answers, SessionState } from "../engine/types";
import type { AnswerRow, ArcRow } from "./db";
import { enqueue, type SyncOp } from "./queue";

/** The dc_arcs row implied by the current session (outcome/status/tags per engine). */
export function arcRowFromSession(
  arcId: string,
  userId: string,
  s: SessionState,
  now: Date = new Date()
): ArcRow {
  return {
    id: arcId,
    user_id: userId,
    tree_version: s.arc.tree_version ?? 1,
    outcome: s.arc.outcome,
    status: s.arc.status,
    occurred_at:
      occurredAtFromT1(s.arc.answers.T1, now)?.toISOString() ??
      (s.arc.entry === "urge_now" ? (s.arc.urge_at ?? now.toISOString()) : null),
    tags: s.arc.tags,
  };
}

/** Answer ops for what changed between two answer maps (upserts + deletes). */
export function diffAnswerOps(
  arcId: string,
  treeVersion: number,
  prev: Answers,
  next: Answers
): SyncOp[] {
  const ops: SyncOp[] = [];
  for (const [nodeId, value] of Object.entries(next)) {
    if (JSON.stringify(prev[nodeId]) !== JSON.stringify(value)) {
      ops.push({
        kind: "answer_upsert",
        row: {
          arc_id: arcId,
          node_id: nodeId,
          tree_version: treeVersion,
          value: value as Record<string, unknown>,
        } satisfies AnswerRow,
      });
    }
  }
  for (const nodeId of Object.keys(prev)) {
    if (!(nodeId in next)) ops.push({ kind: "answer_delete", arc_id: arcId, node_id: nodeId });
  }
  return ops;
}

/** Queue the arc row plus any changed answers (fire-and-forget safe). */
export async function syncSession(
  arcId: string,
  userId: string,
  prevAnswers: Answers,
  s: SessionState
): Promise<void> {
  const ops: SyncOp[] = [
    { kind: "arc_upsert", arc: arcRowFromSession(arcId, userId, s) },
    ...diffAnswerOps(arcId, s.arc.tree_version ?? 1, prevAnswers, s.arc.answers),
  ];
  await enqueue(...ops);
}
