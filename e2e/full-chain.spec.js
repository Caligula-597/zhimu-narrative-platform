import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  goToView,
  gotoHostConsole,
  injectHostAppContext,
  injectHostContext,
  joinFixturePlayRoomViaUi,
  refreshHostRoomState,
  waitForCloudReady,
  waitForHostIdle,
} from "./helpers/fixture.mjs";

test.describe.configure({ mode: "serial" });

test.describe("Beta 主线 · fixture 全链路", () => {
  test("玩家加入 → 阅读 → 主持推进 → 存档复盘", async ({ browser, page }) => {
    const playContext = await browser.newContext();
    const hostContext = await browser.newContext();
    const playPage = await playContext.newPage();
    const hostPage = await hostContext.newPage();

    try {
      await joinFixturePlayRoomViaUi(playPage, "角色 B");
      await playPage.locator('[data-action="switch-tab"][data-tab="sections"]').click();
      await expect(playPage.locator(".sections-layout, .reader").first()).toBeVisible({ timeout: 20_000 });
      const completeBtn = playPage.locator('[data-action="complete-section"]').first();
      if (await completeBtn.isVisible().catch(() => false)) {
        await completeBtn.click();
        await expect(playPage.getByText(/已完成阅读|标记阅读完成/)).toBeVisible({ timeout: 15_000 });
      }

      await injectHostAppContext(hostContext);
      await gotoHostConsole(hostPage);
      await refreshHostRoomState(hostPage);
      await expect(hostPage.locator(".host-runtime-table")).toContainText(/已完成|阅读|1\//, { timeout: 30_000 });

      await hostPage.locator('.host-manual-actions [data-action="host-manual-grant-clue"]').click();
      const clueWorkspace = hostPage.locator('[data-host-operation-workspace][data-operation-kind="grant-clue"]');
      await expect(clueWorkspace).toBeVisible({ timeout: 10_000 });
      const clueSelect = clueWorkspace.locator('[data-host-operation-field="clueId"]');
      const clueValue = await clueSelect.locator("option").filter({ hasText: "测试线索" }).first().getAttribute("value");
      expect(clueValue).toBeTruthy();
      await clueSelect.selectOption(clueValue);
      const roleBTarget = clueWorkspace.getByRole("checkbox", { name: /角色 B/ });
      await expect(roleBTarget).toHaveCount(1);
      await roleBTarget.check();
      await clueWorkspace.locator('[data-action="host-operation-submit"]').click();
      await waitForHostIdle(hostPage);
      await expect(playPage.getByText(/测试线索/)).toBeVisible({ timeout: 20_000 });

      await injectHostContext(page.context());
      await page.goto(BASE_URL);
      await waitForCloudReady(page);
      await goToView(page, "archive");
      await expect(page.getByText("运行房存档")).toBeVisible();

      await page.getByRole("button", { name: "＋ 创建存档点" }).click();
      await expect(page.locator("#modal-backdrop.show")).toBeVisible({ timeout: 10_000 });
      await page.locator('[data-studio-field="checkpointTitle"]').fill(`主线 E2E ${Date.now()}`);
      await page.locator("[data-checkpoint-submit]").click();
      await expect(page.locator("#toast.show, .checkpoint-list .checkpoint-card").first()).toBeVisible({
        timeout: 30_000,
      });

      await page.getByRole("button", { name: "生成复盘" }).click();
      await expect(page.locator("#modal-backdrop.show")).toBeVisible({ timeout: 10_000 });
      await page.locator('[data-studio-field="recapTitle"]').fill(`主线复盘 ${Date.now()}`);
      await page.locator("[data-recap-submit]").click();
      await expect(page.locator("#toast.show, .recap-list .recap-card").first()).toBeVisible({
        timeout: 30_000,
      });
    } finally {
      await playContext.close();
      await hostContext.close();
    }
  });
});

test.describe("Beta 主线 · 极简创建到桌游原型", () => {
  test.beforeEach(async ({ context, page }) => {
    await injectHostContext(context);
    await page.goto(BASE_URL);
    await waitForCloudReady(page);
  });

  test("选择桌游并命名 → 空白组件工坊 → 添加自定义状态", async ({ page }) => {
    await page.locator("#create-world-btn").click();
    await expect(page.locator(".world-create-shell")).toBeVisible();
    await page.locator('[data-world-create-type="board_game"]').click();
    await page.locator("[data-world-create-name]").fill(`桌游原型 ${Date.now()}`);
    await page.getByRole("button", { name: "创建空白桌游" }).click();
    await expect(page.locator(".board-game-workbench")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".board-component-row")).toHaveCount(0);

    await page.getByRole("button", { name: /自定义组件/ }).click();
    await page.locator('[data-board-component-field="name"]').fill("双面身份标记");
    await page.getByRole("button", { name: "＋ 添加状态" }).click();
    await page.locator('[data-board-state-field="label"]').fill("朝向");
    await page.locator('[data-board-state-field="initialValue"]').fill("隐藏面");
    await page.locator("[data-board-save]").click();
    await expect(page.locator("#toast.show")).toContainText("桌游组件已保存");
  });
});
