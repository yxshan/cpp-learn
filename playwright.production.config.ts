import { defineConfig } from "@playwright/test";

import {
  e2eApiOrigin,
  e2eApiPort,
  e2eDataRoot,
  e2eWorkspaceRoot,
} from "./e2e/runtime.js";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "reference-production.spec.ts",
  retries: 0,
  reporter: "list",
  use: {
    baseURL: e2eApiOrigin,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node --import tsx apps/server/src/index.ts",
    env: {
      CPP_LEARN_DATA_ROOT: e2eDataRoot,
      CPP_LEARN_PORT: e2eApiPort,
      CPP_LEARN_WORKSPACE_ROOT: e2eWorkspaceRoot,
    },
    url: `${e2eApiOrigin}/api/v1/health`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
