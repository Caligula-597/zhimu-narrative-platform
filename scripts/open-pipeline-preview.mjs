#!/usr/bin/env node
/** Open browser to writer view with AI pipeline modal (local preview). */
import { chromium } from "@playwright/test";
import { injectDemoContext, goToView, waitForCloudReady, BASE_URL, dismissModalIfOpen } from "../e2e/helpers/fixture.mjs";

const browser = await chromium.launch({ headless: false, channel: "msedge" }).catch(() => chromium.launch({ headless: false }));
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await injectDemoContext(context);
const page = await context.newPage();
await page.goto(BASE_URL);
await waitForCloudReady(page).catch(() => {});
await dismissModalIfOpen(page);
await goToView(page, "writer");
await page.locator('[data-action="deepseek-pipeline"]').click();
await page.locator("#modal-backdrop.show").waitFor({ state: "visible", timeout: 20000 });
console.log(`AI pipeline modal opened — ${BASE_URL}`);
try {
  await page.waitForTimeout(30 * 60 * 1000);
} catch {
  console.log("Browser closed.");
}
