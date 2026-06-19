import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  FIXTURE,
  API_BASE,
  dismissModalIfOpen,
  ensurePendingHostEvent,
  goToView,
  injectHostContext,
  waitForCloudReady
} from "./helpers/fixture.mjs";

test.describe("主持监控台 · 主持-玩家联动", () => {
  test.beforeEach(async ({ context, page }) => {
    await injectHostContext(context);
    await page.goto(BASE_URL);
    await waitForCloudReady(page);
    await goToView(page, "director");
  });

  test("待确认事件区与玩家表同时可见", async ({ page }) => {
    await expect(page.locator(".host-events-card")).toBeVisible();
    await expect(page.locator(".host-runtime-table")).toBeVisible();
    await expect(page.getByRole("button", { name: "刷新待确认事件" })).toBeVisible();
  });

  test("有待确认事件时显示主持-玩家提示条", async ({ page }) => {
    const hasEvents = await page.evaluate(async ({ roomId, apiBase, hostUserId }) => {
      const res = await fetch(`${apiBase}/api/rooms/${roomId}/host-events`, {
        headers: { "x-user-id": hostUserId }
      });
      const rows = await res.json();
      return Array.isArray(rows) && rows.length > 0;
    }, { roomId: FIXTURE.roomId, apiBase: API_BASE, hostUserId: FIXTURE.hostUserId });

    if (hasEvents) {
      await expect(page.locator(".host-wait-strip")).toBeVisible();
    } else {
      await expect(page.locator(".host-events-card .empty-state, .host-event-card").first()).toBeVisible();
    }
  });

  test("玩家实时动态卡片可展开", async ({ page }) => {
    await expect(page.getByText("玩家实时动态")).toBeVisible();
  });

  test("提醒等待中的玩家可打开并发送", async ({ page }) => {
    const hasPending = await ensurePendingHostEvent(page);
    const hasJoinedPlayers = await page.evaluate(
      () => (window.zhimuState?.cloudHostPlayers || []).some((player) => player.joined)
    );
    if (!hasPending || !hasJoinedPlayers) {
      test.skip(true, "fixture 无待确认事件或已入房玩家，跳过 nudge UI 测试");
      return;
    }

    const nudgeBtn = page.getByRole("button", { name: "提醒等待中的玩家" });
    await expect(nudgeBtn).toBeVisible();
    await nudgeBtn.click();
    await expect(page.locator("#modal-backdrop.show")).toBeVisible();
    await expect(page.getByRole("button", { name: "发送提醒" })).toBeVisible();
    await page.locator("[data-nudge-submit]").click();
    await dismissModalIfOpen(page);
    await expect(page.locator("#toast.show")).toContainText("已提醒", { timeout: 10_000 });
  });
});
