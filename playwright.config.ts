import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm --workspace @cpp-learn/server run start",
      url: "http://127.0.0.1:4173/api/v1/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 30_000,
    },
    {
      command: "npm --workspace @cpp-learn/web run dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env["CI"],
      timeout: 30_000,
    },
  ],
});
