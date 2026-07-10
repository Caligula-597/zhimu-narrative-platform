import { test, expect } from "@playwright/test";
import {
  FIXTURE,
  API_BASE,
  dismissModalIfOpen,
  gotoHostConsole,
  injectHostAppContext,
  refreshHostRoomState,
  waitForHostIdle,
} from "./helpers/fixture.mjs";

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} recommendedAction
 */
async function mockStuckHostPlayers(page, recommendedAction) {
  await page.route(`**/api/rooms/${FIXTURE.roomId}/host/players`, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const players = Array.isArray(body?.players) ? body.players : [];
    const joined = players.find((row) => row.joined) || players[0];
    if (joined) {
      joined.maybe_stuck = true;
      joined.recommended_action = recommendedAction;
      joined.stuck_label = "E2E 测试卡关";
      joined.suggested_nudge = "E2E 建议话术：请先阅读当前分幕。";
    }
    await route.fulfill({
      response,
      json: { ...body, players, stuckCount: 1 }
    });
  });
}

test.describe("主持台 · 卡关干预分支", () => {
  test.beforeEach(async ({ context, page }) => {
    await injectHostAppContext(context);
    await gotoHostConsole(page);
    await refreshHostRoomState(page);
  });

  test("unlock_section 打开手动解锁分幕弹窗", async ({ page }) => {
    await mockStuckHostPlayers(page, "unlock_section");
    await page.locator('[data-action="refresh-host-room"]').click();
    await waitForHostIdle(page);

    await page.locator('[data-action="host-stuck-intervene"]').first().click();
    await expect(page.getByRole("heading", { name: "手动解锁分幕" })).toBeVisible({ timeout: 10_000 });
    await dismissModalIfOpen(page);
  });

  test("inspect 打开玩家详情弹窗", async ({ page }) => {
    await mockStuckHostPlayers(page, "inspect");
    await page.locator('[data-action="refresh-host-room"]').click();
    await waitForHostIdle(page);

    await page.locator('[data-action="host-stuck-intervene"]').first().click();
    await expect(page.locator(".host-detail-modal, .modal.host-detail-modal")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".host-detail-list").first()).toBeVisible();
    await dismissModalIfOpen(page);
  });

  test("nudge 打开帮助卡关玩家提醒弹窗", async ({ page }) => {
    await mockStuckHostPlayers(page, "nudge");
    await page.locator('[data-action="refresh-host-room"]').click();
    await waitForHostIdle(page);

    await page.locator('[data-action="host-stuck-intervene"]').first().click();
    await expect(page.getByRole("heading", { name: "帮助卡关玩家" })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("[data-nudge-message]")).toContainText(/E2E 建议话术/);
    await dismissModalIfOpen(page);
  });

  test("API 返回 recommended_action 与 shared 路由一致", async ({ page }) => {
    const payload = await page.evaluate(async ({ roomId, hostUserId, apiBase }) => {
      const res = await fetch(`${apiBase}/api/rooms/${roomId}/host/players`, {
        headers: { "x-user-id": hostUserId }
      });
      return res.json();
    }, { roomId: FIXTURE.roomId, hostUserId: FIXTURE.hostUserId, apiBase: API_BASE });
    expect(Array.isArray(payload?.players)).toBe(true);
    for (const player of payload.players) {
      if (player.recommended_action) {
        expect(["invite", "none", "unlock_section", "nudge", "inspect"]).toContain(player.recommended_action);
      }
    }
  });
});
