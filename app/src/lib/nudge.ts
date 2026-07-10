// Morning nudge — LOCAL notifications only (Brief 004 addendum / tech-stack
// ruling): the nudge is deterministic and fully device-knowable, so it is
// scheduled on-device at capture time with expo-notifications. No push
// tokens, no server sends; nothing about an open arc leaves the device to
// trigger a reminder.
//
// Policy (spec rev B decision 5): ONE dismissible next-morning notification
// per arc EVER, unified across (a) open arcs (live-urge / still-deciding) and
// (b) drank arcs missing their after moment. nudged_at is set when the nudge
// is scheduled to fire and never cleared — cancellation on resolution stops
// delivery but never re-arms the arc.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import { answeredComplete, effOutcome } from "../engine/engine";
import type { Answers, FlowConfig } from "../engine/types";
import type { ArcRow } from "./db";
import { enqueue } from "./queue";

const MAP_KEY = "dc_nudge_notifications"; // arcId -> scheduled notification id
const NUDGE_HOUR = 9; // next morning, 09:00 local

async function readMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(MAP_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function writeMap(map: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(MAP_KEY, JSON.stringify(map)).catch(() => {});
}

/** Next 09:00 local at least an hour away — "next morning" for evening captures. */
export function nextMorning(now: Date): Date {
  const fire = new Date(now.getTime());
  fire.setHours(NUDGE_HOUR, 0, 0, 0);
  if (fire.getTime() - now.getTime() < 60 * 60 * 1000) fire.setDate(fire.getDate() + 1);
  return fire;
}

/** Does this arc need the morning nudge? Open arc, or drank arc missing its after moment. */
export function arcNeedsNudge(config: FlowConfig, arc: ArcRow, answers: Answers): boolean {
  if (arc.status === "open") return true;
  const eff = effOutcome(answers);
  if (eff !== "drank") return false;
  const afterIds = config.branches.drank?.cards?.after ?? [];
  return !afterIds.some((id) => answeredComplete(config, answers, id));
}

/**
 * Schedule the single morning nudge for an arc, honoring nudged_at (one per
 * arc EVER). Sets nudged_at (local arc row + queued DB update) at schedule
 * time. No-ops without notification permission — the nudge is an invitation,
 * never a requirement.
 */
export async function scheduleNudgeIfNeeded(
  config: FlowConfig,
  arc: ArcRow,
  answers: Answers,
  now: Date = new Date()
): Promise<string | null> {
  if (arc.nudged_at) return null; // one nudge per arc EVER
  if (!arcNeedsNudge(config, arc, answers)) return null;
  const map = await readMap();
  if (map[arc.id]) return null; // already scheduled

  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      const req = await Notifications.requestPermissionsAsync();
      if (!req.granted) return null;
    }
    const fireAt = nextMorning(now);
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Drinkchart",
        body:
          arc.status === "open"
            ? "Last night's entry is still open — say how it ended, if you want."
            : "Morning check-in for last night, if you feel like it.",
        data: { arcId: arc.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
    map[arc.id] = notificationId;
    await writeMap(map);
    const nudgedAt = fireAt.toISOString();
    await enqueue({ kind: "nudged_at", arc_id: arc.id, nudged_at: nudgedAt });
    return nudgedAt;
  } catch {
    return null; // notifications unavailable (e.g. web/emulator) — never block capture
  }
}

/** Cancel a pending (not-yet-fired) nudge when its arc resolves. nudged_at stays set. */
export async function cancelNudge(arcId: string): Promise<void> {
  const map = await readMap();
  const id = map[arcId];
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // already fired or platform without scheduling — nothing to cancel
  }
  delete map[arcId];
  await writeMap(map);
}
