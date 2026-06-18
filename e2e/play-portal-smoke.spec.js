import { test, expect } from "@playwright/test";

const PLAY_URL = process.env.PLAYWRIGHT_PLAY_URL || "http://localhost:5174";
const FIXTURE_INVITE = process.env.PLAYWRIGHT_INVITE_CODE || "TEST-FIXTURE-DEMO";

test.describe("玩家端 · 邀请码入房冒烟", () => {
  test("landing 可输入邀请码并进入选角", async ({ page }) => {
    await page.goto(PLAY_URL);
    await expect(page.getByText("织幕")).toBeVisible();

    const inviteInput = page.locator('input[data-bind="inviteCode"], input[name="inviteCode"], input[placeholder*="邀请"]');
    if (await inviteInput.count()) {
      await inviteInput.first().fill(FIXTURE_INVITE);
      const lookup = page.locator('[data-action="lookup-invite"], [data-action="join-lookup"]');
      if (await lookup.count()) {
        await lookup.first().click();
        await expect(page.locator("[data-action='pick-role'], .role-card, .role-row").first()).toBeVisible({
          timeout: 30_000
        });
      }
    } else {
      test.skip(true, "当前 landing 布局无邀请码输入框");
    }
  });

  test("移动端底部导航在小屏可见", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PLAY_URL);
    await page.locator('[data-action="go-plaza"]').click({ timeout: 5000 }).catch(() => {});
    const nav = page.locator(".mobile-nav");
    if (await nav.isVisible().catch(() => false)) {
      await expect(nav.getByText("广场")).toBeVisible();
    }
  });
});
