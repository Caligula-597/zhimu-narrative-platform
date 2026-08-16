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
  await expect(page.getByRole("heading", { name: "先创建一个属于你的世界" })).toBeVisible();
  await expect(page.locator("[data-first-run-chooser]")).toContainText("选择类型 → 命名 → 进入工作区");

  await page.getByRole("button", { name: "创建空白世界 →" }).click();
  await expect(page.locator(".world-create-shell")).toBeVisible();
  await page.locator('[data-world-create-type="board_game"]').click();
  await page.locator("[data-world-create-name]").fill("空白桌游原型");
  await page.getByRole("button", { name: "创建空白桌游" }).click();

  await expect(page.locator(".board-game-workbench")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "空白桌游原型" })).toBeVisible();
  await expect(page.locator(".board-component-empty")).toContainText("还没有组件");
  await expect(page.locator("[data-wizard-invite-code]")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
