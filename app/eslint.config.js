// ESLint flat config — eslint-config-expo, matched to the repo's existing
// style (2-space, double quotes; see tools/*.mjs). Formatting itself is
// Prettier's job (.prettierrc.json); lint stays semantic.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["node_modules/**", ".expo/**", "dist/**", "coverage/**"],
  },
]);
