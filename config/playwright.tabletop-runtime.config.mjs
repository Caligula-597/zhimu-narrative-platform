import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureApiUrl = "http://127.0.0.1:4192";

export default defineConfig({
  testDir: path.join(root, "e2e"),
  testMatch: "tabletop-runtime-flow.spec.js",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: "list",
  use: {
    browserName: "chromium",
    locale: "zh-CN",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: [{
    command: "node scripts/browser-fixture-api.mjs",
    cwd: root,
    url: `${fixtureApiUrl}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      ZHIMU_BROWSER_FIXTURE_PORT: "4192"
    }
  }, {
    command: "npm run dev -- --host 127.0.0.1 --port 5193 --strictPort",
    cwd: root,
    url: "http://127.0.0.1:5193/",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_API_PROXY_TARGET: fixtureApiUrl
    }
  }, {
    command: "npx vite --host 127.0.0.1 --port 5195 --strictPort",
    cwd: path.join(root, "host"),
    url: "http://127.0.0.1:5195/",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_API_PROXY_TARGET: fixtureApiUrl
    }
  }, {
    command: "npx vite --host 127.0.0.1 --port 5194 --strictPort",
    cwd: path.join(root, "play"),
    url: "http://127.0.0.1:5194/",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_DEV_API_PROXY: fixtureApiUrl
    }
  }]
});
