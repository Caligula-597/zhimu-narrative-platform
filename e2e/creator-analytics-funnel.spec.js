import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  FIXTURE,
  injectDemoContext,
  waitForCloudReady,
} from "./helpers/fixture.mjs";

test.describe("创作中心 · 玩后洞察漏斗", () => {
  test("复盘改本加载洞察并展示漏斗", async ({ page, context }) => {
    await injectDemoContext(context, { worldId: FIXTURE.worldId, roomId: FIXTURE.roomId });
    await page.goto(BASE_URL);
    await waitForCloudReady(page);

    // The detailed insights page is intentionally no longer a sidebar item.
    // Exercise the creator's real product path so this contract follows the
    // cockpit information architecture instead of a removed legacy nav entry.
    await page.locator('[data-cockpit-stage="launch"]').click();
    await page.locator('[data-cockpit-item="feedback"]').click();
    await expect(page.locator('.feedback-embed-grid [data-go="insights"]')).toBeVisible();
    await page.locator('.feedback-embed-grid [data-go="insights"]').click();
    await page.waitForFunction(() => window.zhimuState?.view === "insights", undefined, { timeout: 15_000 });
    await expect(page.locator(".creator-analytics-panel")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-action="load-creator-analytics"]')).toBeVisible();

    await page.locator('[data-action="load-creator-analytics"]').click();
    await expect(page.locator(".insight-funnel")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".insight-funnel article")).toHaveCount(6);
    await expect(page.locator(".insight-funnel")).toContainText(/加入玩家|开始阅读|完成首幕/);
    await expect(page.locator("#toast.show, .toast")).toContainText(/玩后洞察|洞察/, { timeout: 10_000 });
  });
});
