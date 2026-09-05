import { defineConfig } from "@playwright/test";

import {
  e2eApiOrigin,
  e2eApiPort,
  e2eDataRoot,
  e2eRuntimeRoot,
  e2eWebOrigin,
  e2eWebPort,
  e2eWorkspaceRoot,
} from "./e2e/runtime.js";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "reference-production.spec.ts",
  fullyParallel: false,
  // Both browser suites share one bounded native compiler service and fixture
  // store. Serial workers keep those integration boundaries deterministic.
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: e2eWebOrigin,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node --import tsx apps/server/src/e2e-index.ts",
      env: {
        CPP_LEARN_DATA_ROOT: e2eDataRoot,
        CPP_LEARN_E2E_RUNTIME_ROOT: e2eRuntimeRoot,
        CPP_LEARN_PORT: e2eApiPort,
        CPP_LEARN_WORKSPACE_ROOT: e2eWorkspaceRoot,
      },
      url: `${e2eApiOrigin}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `node ../../node_modules/vite/bin/vite.js --port ${e2eWebPort}`,
      cwd: "apps/web",
      env: {
        CPP_LEARN_API_URL: e2eApiOrigin,
      },
      url: e2eWebOrigin,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
