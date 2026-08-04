import { test, expect } from "@playwright/test";
import {
  gotoHostConsole,
  injectHostAppContext,
  joinFixturePlayRoomViaUi,
  refreshHostRoomState,
  waitForHostIdle,
} from "./helpers/fixture.mjs";

test.describe("运行时主链路 · 发线索与开放场景", () => {
  test("主持发线索后玩家收到；主持开放场景后玩家可探索", async ({ browser }) => {
    test.setTimeout(180_000);
    const hostContext = await browser.newContext();
    const playContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const playPage = await playContext.newPage();

    try {
      await joinFixturePlayRoomViaUi(playPage);
      await expect(playPage.locator("[data-game-tab-bar]")).toBeVisible({ timeout: 30_000 });

      await injectHostAppContext(hostContext);
      await gotoHostConsole(hostPage);
      await refreshHostRoomState(hostPage);

      await hostPage.getByRole("button", { name: "发线索", exact: true }).click();
      const clueWorkspace = hostPage.locator('[data-host-operation-workspace][data-operation-kind="grant-clue"]');
      await expect(clueWorkspace).toBeVisible({ timeout: 10_000 });
      const clueSelect = clueWorkspace.locator('[data-host-operation-field="clueId"]');
      const clueValue = await clueSelect.locator("option").filter({ hasText: "测试线索" }).first().getAttribute("value");
      await clueSelect.selectOption(clueValue);
      const grantRole = clueWorkspace.locator('[data-host-operation-field="roleSlotIds"]').first();
      await grantRole.check();
      await clueWorkspace.locator('[data-action="host-operation-submit"]').click();
      await waitForHostIdle(hostPage);

      await expect(playPage.getByText(/获得线索：测试线索|测试线索/)).toBeVisible({ timeout: 20_000 });
      await playPage.locator('[data-primary-tab="investigation"]').click();
      await expect(playPage.locator(".clues-layout, .clues-sidebar").first()).toBeVisible({ timeout: 10_000 });
      await expect(playPage.getByText("测试线索").first()).toBeVisible();

      await hostPage.locator('[data-action="host-manual-unlock-scene"]').click();
      const sceneWorkspace = hostPage.locator('[data-host-operation-workspace][data-operation-kind="unlock-scene"]');
      await expect(sceneWorkspace).toBeVisible({ timeout: 10_000 });
      const sceneSelect = sceneWorkspace.locator('[data-host-operation-field="sceneId"]');
      const sceneValue = await sceneSelect.locator("option").filter({ hasText: "场景 B" }).first().getAttribute("value");
      await sceneSelect.selectOption(sceneValue);
      await sceneWorkspace.locator('[data-action="host-operation-submit"]').click();
      await waitForHostIdle(hostPage);

      await playPage.locator('[data-primary-tab="investigation"]').click();
      await expect(playPage.getByText("场景 B").first()).toBeVisible({ timeout: 25_000 });
    } finally {
      // Both applications keep SSE connections open. Close their pages first so
      // context disposal does not wait on long-lived network activity, and do
      // not let cleanup hide the result of the business-flow assertions.
      await Promise.allSettled([hostPage.close(), playPage.close()]);
      await Promise.allSettled([hostContext.close(), playContext.close()]);
    }
  });
});
