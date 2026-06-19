/** @type {import('@playwright/test').PlaywrightTestConfig} */
export default {
  testDir: "e2e",
  testMatch: "**/*.spec.js",
  timeout: 300_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4173",
    locale: "zh-CN",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "app",
      testMatch: "**/*.spec.js",
      testIgnore: ["**/play-portal-smoke.spec.js", "**/play-official-example.spec.js"]
    },
    {
      name: "play",
      testMatch: /play-(portal-smoke|official-example)\.spec\.js/,
      use: {
        baseURL: process.env.PLAYWRIGHT_PLAY_URL || "http://localhost:5174"
      }
    }
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: "node src/server.js",
          cwd: "backend",
          url: "http://localhost:4180/api/health/live",
          reuseExistingServer: true,
          timeout: 60_000,
          env: {
            ...process.env,
            ALLOW_DEMO_USER_HEADER: "true",
            OFFICIAL_EXAMPLE_WORLD_ID: "33333333-3333-4333-8444-555555550003"
          }
        },
        {
          command: "node server.js --dist",
          url: "http://localhost:4173/",
          reuseExistingServer: true,
          timeout: 60_000
        },
        {
          command: "npm run build --prefix play && npm run preview --prefix play",
          url: "http://localhost:5174/",
          reuseExistingServer: true,
          timeout: 120_000
        }
      ]
};
