import { defineConfig, devices } from "@playwright/test"

// Production build first (`pnpm build`), then `pnpm test:e2e`. The servers are started by Playwright itself
// (never reused: reuseExistingServer false) and their output goes to E2E_SERVER_LOG so a hang stays diagnosable.
// Port 3000 = real key (desktop, mobile). Port 3001 = deliberately invalid key (project `failure`, AC-41/AC-42).
const serverLog = process.env.E2E_SERVER_LOG ?? "test-results/server.log"
const server = (port: number) => `mkdir -p "$(dirname ${serverLog})" && exec pnpm exec next start -p ${port} >> ${serverLog} 2>&1`

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000, // real model calls
  globalTimeout: 40 * 60_000, // full suite budget; per-spec runs override with --global-timeout
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: [
    {
      command: server(3000),
      url: "http://localhost:3000",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: server(3001),
      url: "http://localhost:3001",
      reuseExistingServer: false,
      timeout: 60_000,
      env: { OPENROUTER_API_KEY: "sk-or-v1-invalid" },
    },
  ],
  projects: [
    {
      name: "desktop",
      testIgnore: "failure.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      testIgnore: "failure.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 780 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "failure",
      testMatch: "failure.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3001" },
    },
  ],
})
