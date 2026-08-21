import { test, expect } from "@playwright/test";
import { API_BASE } from "./helpers/fixture.mjs";

const RESET_URL = `${API_BASE}/api/test/reset-verification`;

test.beforeEach(async ({ request }) => {
  const response = await request.post(RESET_URL);
  expect(response.ok()).toBeTruthy();
});

test("email code verification enters a responsive zero-world workspace", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.locator("#modal-backdrop.show")).toBeVisible();
  await page.locator('[data-studio-field="registerName"]').fill("空账号验收");
  await page.locator('[data-studio-field="registerEmail"]').fill("empty-account@example.invalid");
  await page.locator('[data-studio-field="registerPassword"]').fill("fixture-password-8");
  await page.locator("[data-auth-register]").click();

  await expect(page.locator("[data-auth-verification-code]")).toBeVisible();
  await page.locator("[data-auth-verification-code]").fill("246810");
  await page.locator("[data-auth-verify-code]").click();

  await expect(page.locator("#modal-backdrop")).not.toHaveClass(/show/);
  await expect(page.locator("#content")).toContainText("先创建一个属于你的世界");
  await expect(page.locator("body")).toHaveAttribute("data-product-active", "0");
  await expect(page.locator("body")).toHaveAttribute("data-product-mode", "");
  await expect(page.locator("body")).toHaveAttribute("data-product-key", "");

  const productViews = [
    "creatorCockpit", "constitution", "diagnostics", "playtest", "writer", "truth",
    "studio", "clues", "rules", "miniGames", "archive", "settings", "tabletopMap", "boardGame"
  ];
  for (const view of productViews) {
    await expect(page.locator(`.nav-item[data-view="${view}"]`).first()).toBeHidden();
  }
  await expect(page.locator("#nav-advanced")).toBeHidden();

  await page.locator('.nav-item[data-view="account"]:visible').click();
  await expect(page.locator("#content")).toContainText("browser-fixture@getzhimu.local");
  expect(pageErrors).toEqual([]);
});

test("email verification link logs in and removes the one-time URL token", async ({ page }) => {
  await page.goto("/?verify=fixture-link-token");
  await expect(page.locator("#content")).toContainText("先创建一个属于你的世界");
  await expect(page).not.toHaveURL(/verify=/);
  await expect(page.locator("#modal-backdrop")).not.toHaveClass(/show/);
});

test("mobile verification link keeps an empty account responsive across protected views", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/?verify=fixture-link-token");
  await expect(page).not.toHaveURL(/verify=/);
  await expect(page.locator("#modal-backdrop")).not.toHaveClass(/show/);
  await expect(page.locator("#content")).toContainText("先创建一个属于你的世界");

  await expect(page.locator("body")).toHaveAttribute("data-product-active", "0");
  await expect(page.locator("body")).toHaveAttribute("data-product-mode", "");
  await expect(page.locator("body")).toHaveAttribute("data-product-key", "");
  await expect(page.locator("#nav-advanced")).toBeHidden();
  await expect(page.locator('.nav-item[data-view="writer"]')).toBeHidden();

  await page.locator('.mobile-account-nav[data-view="account"]:visible').click();
  await expect(page.locator("#page-title")).toHaveText("账号与资产");
  await expect(page.locator("#content")).toContainText("browser-fixture@getzhimu.local");
  expect(pageErrors).toEqual([]);
});
