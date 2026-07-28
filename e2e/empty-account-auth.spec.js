import { test, expect } from "@playwright/test";

const RESET_URL = "http://127.0.0.1:4190/api/test/reset-verification";

test.beforeEach(async ({ request }) => {
  const response = await request.post(RESET_URL);
  expect(response.ok()).toBeTruthy();
});

test("email code verification enters a responsive zero-world workspace", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.locator("#modal-backdrop.show")).toBeVisible();
  await page.locator('[data-studio-field="registerName"]').fill("空账号验收");
  await page.locator('[data-studio-field="registerEmail"]').fill("empty-account@example.invalid");
  await page.locator('[data-studio-field="registerPassword"]').fill("fixture-password-8");
  await page.locator("[data-auth-register]").click();

  await expect(page.locator("[data-auth-verification-code]")).toBeVisible();
  await page.locator("[data-auth-verification-code]").fill("246810");
  await page.locator("[data-auth-verify-code]").click();

  await expect(page.locator("#modal-backdrop")).not.toHaveClass(/show/);
  await expect(page.locator("#content")).toContainText("当前账号还没有剧本");

  const advanced = page.locator("#nav-advanced");
  if (await advanced.getAttribute("hidden") !== null) {
    await page.locator('[data-action="toggle-nav-advanced"]').click();
    await expect(advanced).toBeVisible();
  }

  const views = [
    ["creatorCockpit", "创作驾驶舱"],
    ["constitution", "创作宪法"],
    ["diagnostics", "作品诊断中心"],
    ["playtest", "AI 玩家试跑实验室"],
    ["writer", "角色私人剧本"],
    ["truth", "谜底与关系"],
    ["studio", "剧情编排图谱"],
    ["clues", "线索管理"],
    ["rules", "自动化规则"],
    ["miniGames", "小游戏设计"],
    ["archive", "存档与复盘"],
    ["settings", "世界设置"],
    ["account", "账号与资产"]
  ];

  for (const [view, title] of views) {
    const nav = page.locator(`.nav-item[data-view="${view}"]:visible`);
    await expect(nav).toHaveCount(1);
    await nav.click();
    await expect(page.locator("#page-title")).toHaveText(title);
    await expect(page.locator("#content")).not.toContainText("正在加载该功能模块");
    await expect(page.locator("#content")).not.toContainText("功能模块加载失败");
  }

  await page.locator('.nav-item[data-view="diagnostics"]:visible').click();
  await expect(page.locator("#content")).toContainText("创建或选择剧本后");
  await expect(page.locator("#content")).not.toContainText("正在运行结构诊断");

  await page.locator('.nav-item[data-view="account"]:visible').click();
  await expect(page.locator("#content")).toContainText("browser-fixture@getzhimu.local");
  expect(pageErrors).toEqual([]);
});

test("email verification link logs in and removes the one-time URL token", async ({ page }) => {
  await page.goto("/?verify=fixture-link-token");
  await expect(page.locator("#content")).toContainText("当前账号还没有剧本");
  await expect(page).not.toHaveURL(/verify=/);
  await expect(page.locator("#modal-backdrop")).not.toHaveClass(/show/);
});
