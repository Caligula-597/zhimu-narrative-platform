import { test, expect } from "@playwright/test";
import { FIXTURE, PLAY_URL, joinPlayRoomViaUi } from "./helpers/fixture.mjs";

test.describe("玩家端 同步与导航", () => {
  test("广场页显示加载或内容区（非白屏）", async ({ page }) => {
    await page.goto(PLAY_URL);
    await page.getByRole("button", { name: "进入广场" }).click();
    await expect(page.locator(".play-header").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".plaza-shell")).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator(".plaza-feed, .loading-dots, .plaza-post, .banner.error").first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test("游戏壳 Tab 栏带 role=tablist（入房后）", async ({ page }) => {
    const invite = process.env.PLAYWRIGHT_INVITE_CODE || FIXTURE.inviteCode;
    await joinPlayRoomViaUi(page, invite);
    await expect(page.locator('[role="tablist"]').first()).toBeVisible({ timeout: 30_000 });
    const cluesTab = page.locator('[data-action="switch-tab"][data-tab="clues"]');
    await cluesTab.click();
    await expect(cluesTab).toHaveAttribute("aria-selected", "true");
  });
});
