import { test, expect } from "@playwright/test";
import { BASE_URL, injectHostContext, waitForCloudReady } from "./helpers/fixture.mjs";

test.describe("创作者 · 极简创建世界", () => {
  test.beforeEach(async ({ context, page }) => {
    await injectHostContext(context);
    await page.goto(BASE_URL);
    await waitForCloudReady(page);
  });

  test("只选择类型和命名即可进入桌游组件工坊", async ({ page }) => {
    await page.locator("#create-world-btn").click();
    await expect(page.locator(".world-create-shell")).toBeVisible();
    await page.locator('[data-world-create-type="board_game"]').click();
    await page.locator("[data-world-create-name]").fill("自由桌游实验室");
    await page.getByRole("button", { name: "创建空白桌游" }).click();
    await expect(page.locator(".board-game-workbench")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /牌堆 \/ 卡组/ }).click();
    await expect(page.locator("[data-board-component-editor]")).toBeVisible();
    await expect(page.locator(".board-component-row")).toHaveCount(1);
  });
});
