import { test, expect } from "@playwright/test";
import { BASE_URL, goToView, injectHostContext, waitForCloudReady } from "./helpers/fixture.mjs";

test.describe("创作者 · 角色私人档案", () => {
  test.beforeEach(async ({ context, page }) => {
    await injectHostContext(context);
    await page.goto(BASE_URL);
    await waitForCloudReady(page);
    await goToView(page, "writer");
    await expect(page.locator(".writer-archives")).toBeVisible();
  });

  test("档案只加载一次，展开、编辑席位、新增分幕和保存均可操作", async ({ page }) => {
    let archiveGets = 0;
    page.on("request", (request) => {
      if (request.method() === "GET" && /\/bible\/role-archives$/.test(new URL(request.url()).pathname)) archiveGets += 1;
    });

    await page.locator('[data-action="load-writer-archives"]').click();
    await page.waitForTimeout(500);
    expect(archiveGets).toBeLessThanOrEqual(1);

    const panels = page.locator('[data-collapse-panel^="writer:archive:"]');
    await expect(panels).toHaveCount(3);
    const second = panels.nth(1);
    await second.locator(".collapse-panel-toggle").click();
    await expect(second).toHaveClass(/is-open/);
    await page.waitForTimeout(800);
    await expect(second).toHaveClass(/is-open/);

    await page.locator('[data-action="creator-edit-role"]').first().click();
    await expect(page.locator("#modal-backdrop.show")).toBeVisible();
    await expect(page.locator('[data-studio-field="privateProfile"]')).toBeVisible();
    await page.locator("#modal [data-close]").click();

    await page.locator('[data-action="creator-add-section"]').first().click();
    await expect(page.locator("#modal-backdrop.show")).toBeVisible();
    await expect(page.locator('.manuscript-editor-modal [data-studio-field="body"]')).toBeVisible();
    await page.locator("#modal [data-close]").click();

    const archive = page.locator("[data-role-archive]").first();
    const goal = archive.locator('[data-archive-field="externalGoal"]');
    const original = await goal.inputValue();
    const marker = `角色档案交互回归-${Date.now()}`;
    try {
      await goal.fill(marker);
      const patch = page.waitForResponse((response) =>
        response.request().method() === "PATCH" && response.url().includes("/bible/role-archives/")
      );
      await archive.locator('[data-action="save-role-archive"]').click();
      expect((await patch).ok()).toBeTruthy();
      await expect(page.locator("[data-role-archive]").first().locator('[data-archive-field="externalGoal"]')).toHaveValue(marker);
    } finally {
      const refreshedArchive = page.locator("[data-role-archive]").first();
      await refreshedArchive.locator('[data-archive-field="externalGoal"]').fill(original);
      const restore = page.waitForResponse((response) =>
        response.request().method() === "PATCH" && response.url().includes("/bible/role-archives/")
      );
      await refreshedArchive.locator('[data-action="save-role-archive"]').click();
      await restore;
    }
  });
});
