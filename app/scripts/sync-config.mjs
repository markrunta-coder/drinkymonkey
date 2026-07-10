// Copies the canonical repo configs (../config/*.v1.json) into the app bundle
// (src/config/bundled/). The bundled copies are the OFFLINE FALLBACK only —
// at session start the app fetches the latest published version from
// dc_tree_versions / dc_onboarding_versions and caches it (see lib/configStore.ts).
// A Jest test (config-parity.test.ts) fails the build if the copies drift
// from the canonical files. Run: npm run sync-config
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(appRoot, "..");
const dest = join(appRoot, "src", "config", "bundled");
mkdirSync(dest, { recursive: true });

for (const name of ["tree.v1.json", "onboarding.v1.json"]) {
  copyFileSync(join(repoRoot, "config", name), join(dest, name));
  console.log(`synced config/${name} -> app/src/config/bundled/${name}`);
}
