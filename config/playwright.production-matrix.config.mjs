import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = process.env.PLAYWRIGHT_MATRIX_OUTPUT_DIR
  || path.join(os.tmpdir(), "zhimu-production-matrix");

export default defineConfig({
  testDir: path.join(root, "e2e"),
  testMatch: "production-compatibility.spec.js",
  outputDir,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 3,
  retries: 1,
  reporter: "list",
  use: {
    locale: "zh-CN",
    colorScheme: "light",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chrome-stable-desktop",
      use: { browserName: "chromium", channel: "chrome", viewport: { width: 1366, height: 768 } }
    },
    {
      name: "edge-stable-desktop",
      use: { browserName: "chromium", channel: "msedge", viewport: { width: 1366, height: 768 } }
    },
    {
      name: "firefox-desktop",
      use: { browserName: "firefox", viewport: { width: 1366, height: 768 } }
    },
    {
      name: "webkit-safari-proxy-desktop",
      use: { browserName: "webkit", viewport: { width: 1366, height: 768 } }
    },
    {
      name: "pixel-7-emulation",
      use: { ...devices["Pixel 7"] }
    },
    {
      name: "iphone-14-webkit-emulation",
      use: { ...devices["iPhone 14"] }
    }
  ]
});
