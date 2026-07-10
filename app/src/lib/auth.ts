// Anonymous-first auth (tech-stack ruling): the app must be usable before any
// identity exists. First launch signs in anonymously; the session persists in
// AsyncStorage. Account upgrade (Apple / magic link) is a stubbed settings
// screen only in Phase 2.
import type { Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

import { supabase } from "./supabaseClient";

const DEVICE_UUID_KEY = "dc_device_uuid";

/**
 * Stable device UUID in the iOS Keychain via expo-secure-store — survives
 * reinstall (HomeIsFine pattern), for continuity/dedupe alongside anonymous
 * auth. Falls back to AsyncStorage where SecureStore is unavailable.
 */
export async function getDeviceUuid(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_UUID_KEY);
    if (existing) return existing;
    const id = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_UUID_KEY, id, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
    return id;
  } catch {
    // SecureStore unavailable (e.g. some emulators): AsyncStorage fallback.
    const existing = await AsyncStorage.getItem(DEVICE_UUID_KEY);
    if (existing) return existing;
    const id = Crypto.randomUUID();
    await AsyncStorage.setItem(DEVICE_UUID_KEY, id);
    return id;
  }
}

/**
 * Returns the persisted session, or signs in anonymously on first launch.
 * Returns null when offline or when anonymous sign-ins are disabled in the
 * Supabase project (setup step in app/README.md) — the app still runs
 * locally; the offline queue holds writes until a session exists.
 */
export async function ensureSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn(`anonymous sign-in unavailable: ${error.message}`);
    return null;
  }
  return anon.session;
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
