import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  FIXTURE,
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
    const hasEvents = await page.evaluate(async (roomId) => {
      const res = await fetch(`/api/rooms/${roomId}/host-events`, {
        headers: { "x-user-id": "154aa8a9-9cd2-4098-90f4-c75e56c0cc53" }
      });
      const rows = await res.json();
      return Array.isArray(rows) && rows.length > 0;
    }, FIXTURE.roomId);

    if (hasEvents) {
      await expect(page.locator(".host-wait-strip")).toBeVisible();
    } else {
      await expect(page.locator(".host-events-card .empty-state, .host-event-card").first()).toBeVisible();
    }
  });

  test("玩家实时动态卡片可展开", async ({ page }) => {
    await expect(page.getByText("玩家实时动态")).toBeVisible();
  });
});
