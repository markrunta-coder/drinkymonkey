// Jest runs ONLY the pure engine modules (app/src/engine) — plain TypeScript,
// no React, no react-native, so no jest-expo preset is needed and nothing
// here depends on an iOS simulator. UI is exercised on-device (Gate G2).
/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
          resolveJsonModule: true,
          esModuleInterop: true,
          strict: true,
          skipLibCheck: true,
          types: ["jest", "node"],
        },
        diagnostics: { warnOnly: false },
      },
    ],
  },
};
