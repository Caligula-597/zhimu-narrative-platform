import { test, expect } from "@playwright/test";

const PLAY_URL = process.env.PLAYWRIGHT_PLAY_URL || "http://localhost:5174";
const FIXTURE_INVITE = process.env.PLAYWRIGHT_INVITE_CODE || "TEST-FIXTURE-DEMO";

test.describe("玩家端 · 邀请码入房冒烟", () => {
  test("landing 可输入邀请码并进入选角", async ({ page }) => {
    await page.goto(PLAY_URL);
    await expect(page.locator(".play-header").first()).toBeVisible();

    const inviteInput = page.getByTestId("invite-code-input");
    await expect(inviteInput).toBeVisible();
    await inviteInput.fill(FIXTURE_INVITE);

    await page.getByTestId("start-join").click();
    await expect(page.locator("[data-action='pick-role'], .role-card, .role-row").first()).toBeVisible({
      timeout: 30_000
    });
  });

  test("官方示例卡片说明登录要求", async ({ page }) => {
    await page.goto(PLAY_URL);
    const officialBtn = page.getByTestId("join-official");
    if (await officialBtn.isVisible().catch(() => false)) {
      await expect(page.getByText(/登录并验证邮箱/)).toBeVisible();
    }
  });

  test("移动端底部导航在小屏可见", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PLAY_URL);
    await expect(page.locator(".play-header").first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "进入广场" }).click();
    await expect(page.locator(".plaza-shell")).toBeVisible({ timeout: 20_000 });
    const nav = page.locator(".mobile-nav");
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await expect(nav.getByText("广场")).toBeVisible();
  });

  test("view=plaza URL opens plaza", async ({ page }) => {
    await page.goto(`${PLAY_URL}/?view=plaza`);
    await expect(page.locator(".mobile-nav, .play-header").first()).toBeVisible({ timeout: 15_000 });
  });
});
