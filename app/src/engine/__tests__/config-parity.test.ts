// Guard: the bundled fallback configs must be byte-identical to the canonical
// repo configs (config/*.v1.json). If this fails, run: npm run sync-config
import { readFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = join(__dirname, "..", "..", "..");
const repoRoot = join(appRoot, "..");

describe("bundled configs match the canonical repo configs", () => {
  for (const name of ["tree.v1.json", "onboarding.v1.json"]) {
    test(name, () => {
      const canonical = readFileSync(join(repoRoot, "config", name), "utf8");
      const bundled = readFileSync(join(appRoot, "src", "config", "bundled", name), "utf8");
      expect(bundled).toBe(canonical);
    });
  }
});

describe("engine purity: no React anywhere under src/engine", () => {
  test("engine modules never import react/react-native", () => {
    const dir = join(appRoot, "src", "engine");
    const files = ["types.ts", "engine.ts", "scoring.ts", "session.ts", "index.ts"];
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src).not.toMatch(/from\s+["']react/);
      expect(src).not.toMatch(/require\(["']react/);
    }
  });
});
