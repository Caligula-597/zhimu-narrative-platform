import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  FIXTURE,
  injectDemoContext,
  goToView,
  waitForCloudReady,
} from "./helpers/fixture.mjs";

test.describe("创作中心 · 玩后洞察漏斗", () => {
  test("复盘改本加载洞察并展示漏斗", async ({ page, context }) => {
    await injectDemoContext(context, { worldId: FIXTURE.worldId, roomId: FIXTURE.roomId });
    await page.goto(BASE_URL);
    await waitForCloudReady(page);

    await goToView(page, "insights");
    await expect(page.locator(".creator-analytics-panel")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-action="load-creator-analytics"]')).toBeVisible();

    await page.locator('[data-action="load-creator-analytics"]').click();
    await expect(page.locator(".insight-funnel")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".insight-funnel article")).toHaveCount(6);
    await expect(page.locator(".insight-funnel")).toContainText(/加入玩家|开始阅读|完成首幕/);
    await expect(page.locator("#toast.show, .toast")).toContainText(/玩后洞察|洞察/, { timeout: 10_000 });
  });
});
