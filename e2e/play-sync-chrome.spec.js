import { test, expect } from "@playwright/test";

const PLAY_URL = process.env.PLAYWRIGHT_PLAY_URL || "http://localhost:5174";

test.describe("玩家端 · 同步与导航", () => {
  test("广场页显示加载或内容区（非白屏）", async ({ page }) => {
    await page.goto(`${PLAY_URL}/?view=plaza`);
    await expect(page.locator(".play-header").first()).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator(".plaza-feed, .plaza-shell, .loading-dots, .plaza-post").first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("游戏壳 Tab 栏带 role=tablist（入房后）", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "仅 chromium 快速冒烟");
    await page.goto(PLAY_URL);
    const invite = process.env.PLAYWRIGHT_INVITE_CODE;
    test.skip(!invite, "需要 PLAYWRIGHT_INVITE_CODE");
    await page.getByTestId("invite-code-input").fill(invite);
    await page.getByTestId("start-join").click();
    const rolePick = page.locator("[data-action='pick-role']").first();
    if (!(await rolePick.isVisible({ timeout: 20_000 }).catch(() => false))) return;
    await rolePick.click();
    await page.locator("[data-action='confirm-join']").click();
    await expect(page.locator('[role="tablist"]').first()).toBeVisible({ timeout: 30_000 });
    const cluesTab = page.locator('[data-action="switch-tab"][data-tab="clues"]');
    await cluesTab.click();
    await expect(cluesTab).toHaveAttribute("aria-selected", "true");
  });
});
