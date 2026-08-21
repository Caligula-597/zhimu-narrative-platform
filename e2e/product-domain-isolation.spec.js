import { expect, test } from "@playwright/test";

const PRODUCT_EXPECTATIONS = Object.freeze({
  "murder-mystery": {
    mode: "murder-mystery",
    key: "murder_mystery",
    label: "剧本杀",
    libraryHint: "运行空间",
    catalogVisible: true,
    runLabel: "打开剧本杀主持端",
    home: "creatorCockpit",
    homeSurface: ".creator-cockpit",
    visibleViews: ["creatorCockpit"],
    hiddenViews: ["tabletopMap", "boardGame"]
  },
  "tabletop-rpg": {
    mode: "tabletop-rpg",
    key: "tabletop_rpg",
    label: "跑团",
    libraryHint: "跑团专属地图、判定与遭遇",
    catalogVisible: false,
    runLabel: "进入跑团模拟",
    home: "tabletopMap",
    homeSurface: "[data-tabletop-map-page]",
    visibleViews: ["tabletopMap"],
    hiddenViews: ["creatorCockpit", "writer", "studio", "clues", "rooms", "boardGame"]
  },
  "board-game": {
    mode: "board-game",
    key: "board_game",
    label: "桌游",
    libraryHint: "桌游专属席位、组件与试玩",
    catalogVisible: false,
    runLabel: "运行可玩 Demo",
    home: "boardGame",
    homeSurface: "[data-board-workbench]",
    visibleViews: ["boardGame"],
    hiddenViews: ["creatorCockpit", "writer", "studio", "clues", "rooms", "tabletopMap"]
  }
});

test("the selected product exposes only its own creation surface", async ({ page }, testInfo) => {
  const expected = PRODUCT_EXPECTATIONS[testInfo.project.name];
  expect(expected, `missing product expectation for ${testInfo.project.name}`).toBeTruthy();
  const pageErrors = [];
  const failedResponses = [];
  const roomListRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (/\/api\/worlds\/[^/]+\/rooms(?:\?|$)/u.test(request.url())) roomListRequests.push(request.url());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  if (testInfo.project.name !== "murder-mystery") {
    await page.addInitScript(() => localStorage.setItem("zhimuNavAdvanced", "1"));
  }

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.zhimuViewLoader));
  await expect(page.locator("body")).toHaveAttribute("data-product-mode", expected.mode);
  await expect(page.locator("body")).toHaveAttribute("data-product-key", expected.key);
  await expect(page.locator("body")).toHaveAttribute("data-product-active", "1");
  await expect(page.locator(expected.homeSurface)).toBeVisible();
  await expect(page.locator(`[data-view="${expected.home}"]`)).toHaveAttribute("aria-current", "page");
  await expect(page.locator("#run-btn")).toContainText(expected.runLabel);

  for (const view of expected.visibleViews) {
    await expect(page.locator(`.main-nav [data-view="${view}"]`)).toBeVisible();
  }
  for (const view of expected.hiddenViews) {
    await expect(page.locator(`[data-view="${view}"]`).first()).toBeHidden();
  }
  if (testInfo.project.name !== "murder-mystery") {
    await expect(page.locator("#nav-advanced")).toBeHidden();
  }

  await page.locator("#create-world-btn").click();
  await expect(page.locator(".world-create-modal")).toContainText(`创建新${expected.label}`);
  await expect(page.locator("[data-world-create-type]")).toHaveCount(0);
  await page.locator("[data-world-create-cancel]").click();
  await expect(page.locator(".modal-backdrop")).not.toHaveClass(/show/);

  await page.locator(".world-switcher").click();
  await expect(page.locator(".world-library-modal")).toContainText(`${expected.label} · owner`);
  await expect(page.locator(".world-library-modal")).toContainText(expected.libraryHint);
  await expect(page.locator('[data-library-tab="catalog"]')).toHaveCount(expected.catalogVisible ? 1 : 0);
  await page.locator('[data-action="world-rename"]').click();
  await expect(page.locator(".modal")).toContainText(`重命名${expected.label}`);
  await page.locator("[data-close]").click();
  await expect(page.locator(".modal-backdrop")).not.toHaveClass(/show/);

  if (testInfo.project.name === "tabletop-rpg") {
    await expect(page.locator('[data-view="settings"]')).toBeHidden();
    await page.locator("#run-btn").click();
    await expect(page.locator("[data-tabletop-map-page]")).toBeVisible();
    const [saveResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "PATCH"
        && /\/api\/worlds\/[^/]+$/u.test(new URL(response.url()).pathname)),
      page.locator('[data-action="map-save"]').click()
    ]);
    expect(saveResponse.ok()).toBe(true);
    await expect(page.locator("body")).toHaveAttribute("data-product-mode", expected.mode);
    await expect(page.locator("[data-tabletop-map-page]")).toBeVisible();
  }
  if (testInfo.project.name === "board-game") {
    await expect(page.locator('[data-view="settings"]')).toBeHidden();
    await page.locator("#run-btn").click();
    await expect(page.locator('[data-board-tab="playground"]')).toHaveClass(/active/);
    await expect(page.locator("[data-board-playground], .board-playground-empty")).toBeVisible();
  }

  expect(pageErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
  if (testInfo.project.name !== "murder-mystery") expect(roomListRequests).toEqual([]);
});

test("the product home remains operable without horizontal overflow on mobile", async ({ page }, testInfo) => {
  const expected = PRODUCT_EXPECTATIONS[testInfo.project.name];
  expect(expected, `missing product expectation for ${testInfo.project.name}`).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.zhimuViewLoader));

  await expect(page.locator("body")).toHaveAttribute("data-product-mode", expected.mode);
  await expect(page.locator("body")).toHaveAttribute("data-product-key", expected.key);
  await expect(page.locator("body")).toHaveAttribute("data-product-active", "1");
  await expect(page.locator(expected.homeSurface)).toBeVisible();
  await expect(page.locator("#run-btn")).toBeVisible();
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1);

  if (testInfo.project.name !== "murder-mystery") {
    await page.locator("#run-btn").click();
    await expect(page.locator(expected.homeSurface)).toBeVisible();
  }
});
