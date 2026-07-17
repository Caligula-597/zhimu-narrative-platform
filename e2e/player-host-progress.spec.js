import { test, expect } from "@playwright/test";
import {
  gotoHostConsole,
  injectHostAppContext,
  joinFixturePlayRoomViaUi,
  refreshHostRoomState,
} from "./helpers/fixture.mjs";

test.describe("主持台 · 玩家阅读进度联动", () => {
  test("玩家标记分幕完成后主持台可见进度", async ({ browser }) => {
    const hostContext = await browser.newContext();
    const playContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const playPage = await playContext.newPage();

    try {
      await joinFixturePlayRoomViaUi(playPage, "角色 B");
      await playPage.locator('[data-action="switch-tab"][data-tab="sections"]').click();
      await expect(playPage.locator(".sections-layout, .reader").first()).toBeVisible({ timeout: 20_000 });
      const completeBtn = playPage.locator('[data-action="complete-section"]').first();
      const alreadyDone = playPage.locator(".done-note");
      if (!(await completeBtn.isVisible().catch(() => false))) {
        await expect(alreadyDone).toBeVisible({ timeout: 5000 });
      } else {
        await completeBtn.click();
        await expect(playPage.getByText(/已完成阅读|标记阅读完成/)).toBeVisible({ timeout: 15_000 });
      }

      await injectHostAppContext(hostContext);
      await gotoHostConsole(hostPage);
      await refreshHostRoomState(hostPage);

      await expect(hostPage.locator(".host-runtime-table")).toContainText(/1\/|已完成|阅读/, {
        timeout: 30_000
      });
    } finally {
      await hostContext.close();
      await playContext.close();
    }
  });
});
