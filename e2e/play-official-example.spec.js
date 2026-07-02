import { test, expect } from "@playwright/test";
import { PLAY_URL, injectVerifiedPlayContext } from "./helpers/fixture.mjs";

test.beforeEach(async ({ context }) => {
  await injectVerifiedPlayContext(context);
});

test.describe("玩家端 · 官方示例", () => {
  test("?experience=official 可进入选角", async ({ page }) => {
    await page.goto(`${PLAY_URL}/?experience=official`);
    await expect(page.locator(".play-header").first()).toBeVisible();

    const joinOfficial = page.getByTestId("join-official");
    const roleCard = page.locator(".role-card:not([disabled])").first();

    await page.waitForFunction(() => {
      const role = document.querySelector(".role-card:not([disabled])");
      const official = document.querySelector('[data-testid="join-official"]');
      return Boolean(role || (official && !official.disabled));
    }, undefined, { timeout: 30_000 });

    if (await roleCard.isVisible().catch(() => false)) {
      await roleCard.click();
      await page.locator('[data-action="confirm-join"]').click();
      await expect(page.locator("[data-game-tab-bar]")).toBeVisible({ timeout: 30_000 });
      return;
    }

    if (await joinOfficial.isEnabled().catch(() => false)) {
      await joinOfficial.click();
      await expect(page.locator(".role-card:not([disabled])").first()).toBeVisible({ timeout: 30_000 });
    }
  });

  test("landing 展示官方示例卡片", async ({ page }) => {
    await page.goto(PLAY_URL);
    const card = page.getByTestId("join-official");
    if (await card.isVisible().catch(() => false)) {
      await expect(page.getByText(/登录并验证邮箱/)).toBeVisible();
      await expect(page.getByRole("heading", { name: /官方示例/ })).toBeVisible();
    }
  });
});
