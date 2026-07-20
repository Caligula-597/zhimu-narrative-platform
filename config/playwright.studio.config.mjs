import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Isolated rendered regression: no database or shared E2E fixture required. */
export default {
  testDir: path.join(root, "e2e"),
  testMatch: ["studio-graph-drag.spec.js", "clue-flow-drag.spec.js", "creator-interaction-bridges.spec.js"],
  timeout: 30_000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    locale: "zh-CN",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    cwd: root,
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: true,
    timeout: 120_000
  }
};
