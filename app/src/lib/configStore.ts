// Config source of truth at runtime (README "how a new tree version ships"):
// at session start fetch the HIGHEST published version from
// dc_tree_versions / dc_onboarding_versions, cache it in AsyncStorage, and
// fall back to the cached copy, then to the bundled config/*.v1.json copies.
// New tree versions therefore reach clients as a config push, never an app
// release.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { bundledOnboarding, bundledTree } from "../config";
import type { FlowConfig } from "../engine/types";
import { supabase } from "./supabaseClient";

type ConfigKind = "tree" | "onboarding";

const TABLE: Record<ConfigKind, string> = {
  tree: "dc_tree_versions",
  onboarding: "dc_onboarding_versions",
};
const CACHE_KEY: Record<ConfigKind, string> = {
  tree: "dc_config_cache_tree",
  onboarding: "dc_config_cache_onboarding",
};
const BUNDLED: Record<ConfigKind, FlowConfig> = {
  tree: bundledTree,
  onboarding: bundledOnboarding,
};

async function readCache(kind: ConfigKind): Promise<FlowConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY[kind]);
    return raw ? (JSON.parse(raw) as FlowConfig) : null;
  } catch {
    return null;
  }
}

export async function loadConfig(kind: ConfigKind): Promise<FlowConfig> {
  try {
    const { data, error } = await supabase
      .from(TABLE[kind])
      .select("version, config")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data?.config) {
      const cfg = data.config as FlowConfig;
      await AsyncStorage.setItem(CACHE_KEY[kind], JSON.stringify(cfg)).catch(() => {});
      return cfg;
    }
  } catch {
    // offline / unauthenticated: fall through to cache, then bundle
  }
  return (await readCache(kind)) ?? BUNDLED[kind];
}

export async function loadConfigs(): Promise<{ tree: FlowConfig; onboarding: FlowConfig }> {
  const [tree, onboarding] = await Promise.all([loadConfig("tree"), loadConfig("onboarding")]);
  return { tree, onboarding };
}
