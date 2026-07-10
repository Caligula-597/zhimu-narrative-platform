import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  FIXTURE,
  injectDemoContext,
  joinRoomViaInviteUi,
} from "./helpers/fixture.mjs";

test.describe("主应用 · 嵌入式玩家阅读埋点", () => {
  test("打开读者时 POST /sections/:id/start", async ({ page, context }) => {
    await injectDemoContext(context, { worldId: FIXTURE.worldId, roomId: null });
    await page.goto(BASE_URL);

    const startRequest = page.waitForRequest(
      (req) => req.method() === "POST" && /\/api\/rooms\/[^/]+\/sections\/[^/]+\/start/.test(req.url()),
      { timeout: 45_000 }
    );

    await joinRoomViaInviteUi(page, FIXTURE.inviteCode);
    await expect(page.locator(".reader-card, [data-reader-body]").first()).toBeVisible({ timeout: 30_000 });

    const request = await startRequest;
    expect(request.url()).toMatch(/\/start$/);
    expect(request.headers()["x-trace-id"] || request.headers()["X-Trace-Id"]).toBeTruthy();
  });
});
