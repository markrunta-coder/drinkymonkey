// Local draft persistence — the in-progress arc survives app kill.
// Written through on EVERY answer mutation (CaptureScreen), cleared on save
// or explicit discard.
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SessionState } from "../engine/types";

const DRAFT_KEY = "dc_capture_draft";

export interface CaptureDraft {
  arcId: string;
  session: SessionState;
  updatedAt: string;
  nudgedAt?: string | null; // carried through so a reopened arc is never nudged twice
}

export async function saveDraft(draft: CaptureDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage full/unavailable: capture continues in memory
  }
}

export async function loadDraft(): Promise<CaptureDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as CaptureDraft) : null;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // best-effort
  }
}
