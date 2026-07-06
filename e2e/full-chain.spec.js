import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  FIXTURE,
  dismissModalIfOpen,
  goToView,
  gotoHostConsole,
  injectHostAppContext,
  injectHostContext,
  joinPlayRoomViaUi,
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
      await joinPlayRoomViaUi(playPage, FIXTURE.inviteCode, "角色 B");
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

      await hostPage.locator('[data-action="host-manual-grant-clue"]').click();
      await hostPage.locator(".modal, .modal-backdrop.show").first().waitFor({ state: "visible", timeout: 10_000 });
      await hostPage.locator('[data-studio-field="grantClue"]').selectOption({ label: /测试线索/ });
      await hostPage.locator("[data-grant-role]").first().check();
      await hostPage.locator("[data-host-grant-submit]").click();
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

test.describe("Beta 主线 · 向导创建到玩家阅读", () => {
  test.beforeEach(async ({ context, page }) => {
    await injectHostContext(context);
    await page.goto(BASE_URL);
    await waitForCloudReady(page);
  });

  test("五 step 向导 → 邀请码 → 玩家入房读幕", async ({ browser, page }) => {
    const playContext = await browser.newContext();
    const playPage = await playContext.newPage();

    try {
      await goToView(page, "overview");
      await page.locator('[data-action="open-wizard"]').first().click();
      await expect(page.locator(".wizard-shell")).toBeVisible();
      for (let step = 0; step < 5; step += 1) {
        await page.locator("[data-wizard-next]").click();
      }
      await expect(page.locator("#modal-backdrop.show")).toBeVisible({ timeout: 90_000 });
      const inviteText = await page.locator("#modal").innerText();
      const inviteMatch = inviteText.match(/邀请码[:：]\s*([A-Z0-9-]+)/i);
      expect(inviteMatch).toBeTruthy();
      await dismissModalIfOpen(page);

      await joinPlayRoomViaUi(playPage, inviteMatch[1]);
      await playPage.locator('[data-action="switch-tab"][data-tab="sections"]').click();
      await expect(playPage.locator(".sections-layout, .reader").first()).toBeVisible({ timeout: 20_000 });
    } finally {
      await playContext.close();
    }
  });
});
