import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
});

test("草稿可保存，但残缺设计不能被确认为生成契约", async ({ page }) => {
  await page.evaluate(async () => {
    const { openCreatorMechanismWorkbench } = await import(
      "/src/views/creator-mechanism-workbench.js"
    );
    const root = document.querySelector("#content");
    window.__mechanismSaves = [];
    openCreatorMechanismWorkbench({
      root,
      value: {},
      onSave: async (design) => window.__mechanismSaves.push(design),
    });
  });

  await page.locator('[data-mechanism-save="confirmed"]').click();
  await expect(page.getByRole("alert")).toContainText("还不能确认并用于生成");
  await expect(page.getByRole("alert")).toContainText("玩家反复执行的动作");
  await expect(page.locator('[data-mechanism-design-field="title"]')).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.__mechanismSaves.length)).toBe(0);

  await page.locator('[data-mechanism-save="draft"]').click();
  await expect.poll(() =>
    page.evaluate(() => window.__mechanismSaves.at(-1)?.status),
  ).toBe("draft");

  const values = {
    title: "潮窗分洪许可",
    summary: "玩家每轮投入许可，在救援、供电与证据保全之间取舍。",
    recurringAction: "每轮选择一个区域并投入一份闸门许可",
    conflictReason: "救人、供电与保全证据不能同时完成",
    limitedResource: "三份开封许可",
    immediateFeedback: "未保护区域立即失去设施或证据",
    failureAdvance: "未达成共识时执行默认分洪并进入下一轮",
    genreSpecificity: "只适用于潮汐城的闸门代理制度",
    endingCausality: "前几轮保住的区域共同决定最终合闸路线",
  };
  for (const [key, value] of Object.entries(values)) {
    await page.locator(`[data-mechanism-design-field="${key}"]`).fill(value);
  }
  await page.locator('[data-mechanism-save="confirmed"]').click();
  await expect.poll(() =>
    page.evaluate(() => window.__mechanismSaves.at(-1)?.status),
  ).toBe("confirmed");
  await expect(page.locator(".mechanism-workbench-actions")).toContainText(
    "当前版本已确认为作者设定",
  );
});
