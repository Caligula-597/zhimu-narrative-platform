import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureApiUrl = "http://127.0.0.1:4190";

// The spec shares API helpers with the full E2E suite. Keep its API origin
// aligned with this config's dedicated fixture server.
process.env.PLAYWRIGHT_API_URL = fixtureApiUrl;

export default defineConfig({
  testDir: path.join(root, "e2e"),
  testMatch: /empty-account-(auth|golden-path)\.spec\.js/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4191",
    browserName: "chromium",
    locale: "zh-CN",
    viewport: { width: 1366, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: [
    {
      command: "node scripts/browser-fixture-api.mjs",
      cwd: root,
      url: `${fixtureApiUrl}/api/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        ...process.env,
        ZHIMU_BROWSER_FIXTURE_PORT: "4190",
        ZHIMU_BROWSER_FIXTURE_AUTH: "verification",
        ZHIMU_BROWSER_FIXTURE_EMPTY_ACCOUNT: "true"
      }
    },
    {
      command: "npm run dev -- --port 4191 --strictPort",
      cwd: root,
      url: "http://127.0.0.1:4191/",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...process.env,
        VITE_API_PROXY_TARGET: fixtureApiUrl,
        VITE_REQUIRE_AUTH: "true",
        VITE_DEMO_MODE: "false"
      }
    }
  ]
});
