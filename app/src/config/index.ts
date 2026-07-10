// Bundled config fallbacks — byte-for-byte copies of the canonical repo
// configs (config/*.v1.json), synced by scripts/sync-config.mjs and guarded
// by src/engine/__tests__/config-parity.test.ts. The live source of truth is
// dc_tree_versions / dc_onboarding_versions (see lib/configStore.ts); these
// exist so first-run and fully-offline sessions still render.
import type { FlowConfig } from "../engine/types";
import onboardingV1 from "./bundled/onboarding.v1.json";
import treeV1 from "./bundled/tree.v1.json";

export const bundledTree = treeV1 as unknown as FlowConfig;
export const bundledOnboarding = onboardingV1 as unknown as FlowConfig;
