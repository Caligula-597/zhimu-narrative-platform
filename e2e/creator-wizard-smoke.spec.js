import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  dismissModalIfOpen,
  goToView,
  injectHostContext,
  waitForCloudReady
} from "./helpers/fixture.mjs";

test.describe("创作者 · 向导创建测试房", () => {
  test.beforeEach(async ({ context, page }) => {
    await injectHostContext(context);
    await page.goto(BASE_URL);
    await waitForCloudReady(page);
  });

  test("向导走完五 step 后显示邀请码", async ({ page }) => {
    await goToView(page, "overview");
    await page.locator('[data-action="open-wizard"]').first().click();
    await expect(page.locator(".wizard-shell")).toBeVisible();

    for (let step = 0; step < 5; step += 1) {
      await page.locator("[data-wizard-next]").click();
      if (step < 4) await expect(page.locator(".wizard-shell")).toBeVisible();
    }

    await expect(page.locator("#modal-backdrop.show")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/邀请码/)).toBeVisible({ timeout: 10_000 });
    await dismissModalIfOpen(page);
  });
});
