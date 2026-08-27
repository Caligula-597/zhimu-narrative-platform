import { test, expect } from "@playwright/test";
import { API_BASE } from "./helpers/fixture.mjs";

const RESET_URL = `${API_BASE}/api/test/reset-verification`;

test.beforeEach(async ({ request }) => {
  const response = await request.post(RESET_URL);
  expect(response.ok()).toBeTruthy();
});

test("zero-world account creates an empty board-game world with only type and name", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?verify=fixture-link-token");
  await expect(page).not.toHaveURL(/verify=/);
  await expect(page.locator("[data-first-run-chooser]")).toBeVisible();
  await expect(page.getByRole("heading", { name: "你是第一次来织幕吗？" })).toBeVisible();
  await expect(page.locator("[data-first-run-chooser]")).toContainText("上传开本包");
  await expect(page.locator("[data-first-run-chooser]")).toContainText("先做世界规划");
  await expect(page.locator("#preview-btn")).toBeHidden();
  await expect(page.locator("#run-btn")).toBeHidden();
  await expect(page.locator("body")).toHaveAttribute("data-product-active", "0");
  await expect(page.locator("body")).toHaveAttribute("data-product-mode", "");
  await expect(page.locator("body")).toHaveAttribute("data-product-key", "");

  await page.locator("#create-world-btn").click();
  await expect(page.locator("[data-world-create-type]")).toHaveCount(3);
  await expect(page.locator('[data-world-create-type][aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator("[data-world-create-submit]")).toBeDisabled();
  await page.locator("[data-world-create-cancel]").click();

  await page.locator("#create-world-btn").click();
  await expect(page.locator(".world-create-shell")).toBeVisible();
  await page.locator('[data-world-create-type="board_game"]').click();
  await page.locator("[data-world-create-name]").fill("空白桌游原型");
  await page.getByRole("button", { name: "创建空白桌游" }).click();

  await expect(page.locator(".board-game-workbench")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "空白桌游原型" })).toBeVisible();
  await expect(page.locator(".board-component-empty")).toContainText("还没有组件");
  await expect(page.locator("#run-btn")).toBeVisible();
  await expect(page.locator("[data-wizard-invite-code]")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
