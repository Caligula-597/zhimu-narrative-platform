import { test, expect } from "@playwright/test";
import {
  FIXTURE,
  joinPlayRoomViaUi,
} from "./helpers/fixture.mjs";

test.describe("独立玩家端 · 阅读开始埋点", () => {
  test("打开读者时 POST /sections/:id/start", async ({ page }) => {
    const startRequest = page.waitForRequest(
      (req) => req.method() === "POST" && /\/api\/rooms\/[^/]+\/sections\/[^/]+\/start/.test(req.url()),
      { timeout: 45_000 }
    );

    await joinPlayRoomViaUi(page, FIXTURE.inviteCode, "角色 B");
    await page.locator('[data-action="switch-tab"][data-tab="sections"]').click();
    await expect(page.locator(".sections-layout, .reader, [data-reader-body]").first()).toBeVisible({ timeout: 30_000 });

    const request = await startRequest;
    expect(request.url()).toMatch(/\/start$/);
    expect(request.headers()["x-trace-id"] || request.headers()["X-Trace-Id"]).toBeTruthy();
  });
});
