import { test, expect } from "@playwright/test";
import {
  FIXTURE,
  gotoHostConsole,
  injectHostAppContext,
  joinPlayRoomViaUi,
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
      await joinPlayRoomViaUi(playPage, FIXTURE.inviteCode);
      await expect(playPage.locator("[data-game-tab-bar]")).toBeVisible({ timeout: 30_000 });

      await injectHostAppContext(hostContext);
      await gotoHostConsole(hostPage);
      await refreshHostRoomState(hostPage);

      await hostPage.getByRole("button", { name: "发线索", exact: true }).click();
      await hostPage.locator(".modal, .modal-backdrop.show").first().waitFor({ state: "visible", timeout: 10_000 });
      const clueSelect = hostPage.locator('[data-studio-field="grantClue"]');
      const clueValue = await clueSelect.locator("option").filter({ hasText: "测试线索" }).first().getAttribute("value");
      await clueSelect.selectOption(clueValue);
      const grantRole = hostPage.locator("[data-grant-role]").first();
      await grantRole.check();
      await hostPage.locator("[data-host-grant-submit]").click();
      await waitForHostIdle(hostPage);

      await expect(playPage.getByText(/获得线索：测试线索|测试线索/)).toBeVisible({ timeout: 20_000 });
      await playPage.locator('[data-action="switch-tab"][data-tab="clues"]').click();
      await expect(playPage.locator(".clues-layout, .clues-sidebar").first()).toBeVisible({ timeout: 10_000 });
      await expect(playPage.getByText("测试线索").first()).toBeVisible();

      await hostPage.locator('[data-action="host-manual-unlock-scene"]').click();
      await hostPage.locator(".modal, .modal-backdrop.show").first().waitFor({ state: "visible", timeout: 10_000 });
      const sceneSelect = hostPage.locator('[data-studio-field="unlockScene"]');
      const sceneValue = await sceneSelect.locator("option").filter({ hasText: "场景 B" }).first().getAttribute("value");
      await sceneSelect.selectOption(sceneValue);
      await hostPage.locator("[data-host-scene-submit]").click();
      await waitForHostIdle(hostPage);

      await playPage.locator('[data-action="switch-tab"][data-tab="explore"]').click();
      await expect(playPage.getByText("场景 B").first()).toBeVisible({ timeout: 25_000 });
    } finally {
      await hostContext.close();
      await playContext.close();
    }
  });
});
