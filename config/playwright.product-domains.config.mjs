import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const products = [
  { name: "murder-mystery", creationType: "murder_mystery", apiPort: 4200, appPort: 5200 },
  { name: "tabletop-rpg", creationType: "tabletop_rpg", apiPort: 4201, appPort: 5201 },
  { name: "board-game", creationType: "board_game", apiPort: 4202, appPort: 5202 }
];

export default defineConfig({
  testDir: path.join(root, "e2e"),
  testMatch: "product-domain-isolation.spec.js",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: "list",
  projects: products.map((product) => ({
    name: product.name,
    use: { baseURL: `http://127.0.0.1:${product.appPort}` }
  })),
  use: {
    browserName: "chromium",
    locale: "zh-CN",
    viewport: { width: 1440, height: 960 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: products.flatMap((product) => {
    const apiUrl = `http://127.0.0.1:${product.apiPort}`;
    return [{
      command: "node scripts/browser-fixture-api.mjs",
      cwd: root,
      url: `${apiUrl}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...process.env,
        ZHIMU_BROWSER_FIXTURE_PORT: String(product.apiPort),
        ZHIMU_BROWSER_FIXTURE_PRODUCT: product.creationType
      }
    }, {
      command: `npm run dev -- --host 127.0.0.1 --port ${product.appPort} --strictPort`,
      cwd: root,
      url: `http://127.0.0.1:${product.appPort}/`,
      reuseExistingServer: false,
      timeout: 90_000,
      env: {
        ...process.env,
        VITE_API_PROXY_TARGET: apiUrl
      }
    }];
  })
});
