import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  dismissModalIfOpen,
  goToView,
  injectHostContext,
  waitForCloudReady
} from "./helpers/fixture.mjs";

test.describe("存档与复盘 · 主持入口", () => {
  test.beforeEach(async ({ context, page }) => {
    await injectHostContext(context);
    await page.goto(BASE_URL);
    await waitForCloudReady(page);
    await goToView(page, "archive");
  });

  test("存档页可创建 checkpoint 与复盘", async ({ page }) => {
    await expect(page.getByText("运行房存档")).toBeVisible();
    await expect(page.getByRole("button", { name: "＋ 创建存档点" })).toBeVisible();
    await expect(page.getByRole("button", { name: "生成复盘" })).toBeVisible();

    await page.getByRole("button", { name: "＋ 创建存档点" }).click();
    await expect(page.locator("#modal-backdrop.show")).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-studio-field="checkpointTitle"]').fill(`E2E 存档 ${Date.now()}`);
    await page.locator('[data-studio-field="checkpointDescription"]').fill("E2E archive smoke checkpoint");
    await page.locator("[data-checkpoint-submit]").click();
    await expect(page.locator("#toast.show, .checkpoint-list .checkpoint-card").first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "生成复盘" }).click();
    await expect(page.locator("#modal-backdrop.show")).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-studio-field="recapTitle"]').fill(`E2E 复盘 ${Date.now()}`);
    await page.locator('[data-studio-field="recapDescription"]').fill("E2E archive smoke recap");
    await page.locator("[data-recap-submit]").click();
    await expect(page.locator("#toast.show, .recap-list .recap-card").first()).toBeVisible({ timeout: 30_000 });
  });
});
