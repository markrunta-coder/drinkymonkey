// Offline sync queue — answers (and arc/profile/goal writes) queue locally in
// AsyncStorage and sync via the canonical upserts when the network allows.
// Ops are coalesced by key (one pending op per arc / per answer node), kept
// FIFO, and flushed sequentially; a failing flush leaves the queue intact for
// the next attempt. Deterministic; no server round-trip is ever required for
// capture to feel complete.
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  deleteAnswer,
  setGoal,
  setNudgedAt,
  upsertAnswer,
  upsertArc,
  upsertProfile,
  type AnswerRow,
  type ArcRow,
  type ProfileRow,
} from "./db";

export type SyncOp =
  | { kind: "arc_upsert"; arc: ArcRow }
  | { kind: "answer_upsert"; row: AnswerRow }
  | { kind: "answer_delete"; arc_id: string; node_id: string }
  | { kind: "nudged_at"; arc_id: string; nudged_at: string }
  | { kind: "profile_upsert"; row: ProfileRow }
  | { kind: "goal_set"; user_id: string; goal_type: string };

interface QueuedOp {
  key: string;
  op: SyncOp;
  attempts: number;
}

const QUEUE_KEY = "dc_sync_queue";
const MAX_ATTEMPTS = 8;

function opKey(op: SyncOp): string {
  switch (op.kind) {
    case "arc_upsert":
      return `arc:${op.arc.id}`;
    case "answer_upsert":
      return `answer:${op.row.arc_id}:${op.row.node_id}`;
    case "answer_delete":
      return `answer:${op.arc_id}:${op.node_id}`;
    case "nudged_at":
      return `nudge:${op.arc_id}`;
    case "profile_upsert":
      return `profile:${op.row.user_id}`;
    case "goal_set":
      return `goal:${op.user_id}`;
  }
}

async function readQueue(): Promise<QueuedOp[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(q: QueuedOp[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

/** Queue an op (coalescing on its key), then try to flush immediately. */
export async function enqueue(...ops: SyncOp[]): Promise<void> {
  const q = await readQueue();
  for (const op of ops) {
    const key = opKey(op);
    const i = q.findIndex((e) => e.key === key);
    const entry: QueuedOp = { key, op, attempts: 0 };
    if (i >= 0) q[i] = entry; // newer state supersedes the pending op
    else q.push(entry);
  }
  await writeQueue(q);
  await flush();
}

async function apply(op: SyncOp): Promise<void> {
  switch (op.kind) {
    case "arc_upsert":
      return upsertArc(op.arc);
    case "answer_upsert":
      return upsertAnswer(op.row);
    case "answer_delete":
      return deleteAnswer(op.arc_id, op.node_id);
    case "nudged_at":
      return setNudgedAt(op.arc_id, op.nudged_at);
    case "profile_upsert":
      return upsertProfile(op.row);
    case "goal_set":
      return setGoal(op.user_id, op.goal_type);
  }
}

let flushing = false;

/** Flush pending ops FIFO. Stops at the first failure; retries next call. */
export async function flush(): Promise<{ synced: number; pending: number }> {
  if (flushing) return { synced: 0, pending: (await readQueue()).length };
  flushing = true;
  try {
    let q = await readQueue();
    let synced = 0;
    while (q.length > 0) {
      const head = q[0];
      try {
        await apply(head.op);
        q = q.slice(1);
        synced++;
        await writeQueue(q);
      } catch {
        head.attempts += 1;
        if (head.attempts >= MAX_ATTEMPTS) {
          // A permanently failing op (e.g. constraint violation) must not
          // starve the queue forever; drop it after MAX_ATTEMPTS.
          console.warn(`dropping sync op after ${MAX_ATTEMPTS} attempts: ${head.key}`);
          q = q.slice(1);
        }
        await writeQueue(q);
        break; // likely offline — retry on the next flush
      }
    }
    return { synced, pending: q.length };
  } finally {
    flushing = false;
  }
}

export async function pendingCount(): Promise<number> {
  return (await readQueue()).length;
}
