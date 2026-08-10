import { expect, test } from "@playwright/test";

test("tabletop map zoom buttons and wheel redraw the canvas with visible feedback", async ({ page }) => {
  const failedResponses = [];
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("/api/metrics/web-vitals")) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.zhimuViewLoader));
  const advancedToggle = page.locator('[data-action="toggle-nav-advanced"]');
  if (await advancedToggle.isVisible()) await advancedToggle.click();
  await page.locator('[data-view="tabletopMap"]').click();
  await page.locator("[data-tabletop-map-page]").waitFor({ state: "visible" });

  const panel = page.locator("[data-map-zoom]");
  const canvas = page.locator("[data-tabletop-map-canvas]");
  const output = page.locator("[data-map-zoom-output]");
  await expect(panel).toHaveAttribute("data-map-zoom", "1.00");
  await expect(output).toHaveText("100%");
  const before = await canvas.screenshot();

  await page.locator('[data-map-operation="zoom-in"]').click();
  await expect(panel).toHaveAttribute("data-map-zoom", "1.10");
  await expect(output).toHaveText("110%");
  const afterButton = await canvas.screenshot();
  expect(afterButton.equals(before)).toBe(false);

  await canvas.hover();
  await page.mouse.wheel(0, -120);
  await expect(panel).toHaveAttribute("data-map-zoom", "1.20");
  await expect(output).toHaveText("120%");

  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.9);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.56, canvasBox.y + canvasBox.height * 0.94, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => Number(await panel.getAttribute("data-map-pan-x"))).toBeGreaterThan(0.01);
  await expect.poll(async () => Number(await panel.getAttribute("data-map-pan-y"))).toBeGreaterThan(0.01);

  await page.locator('[data-map-operation="zoom-out"]').click();
  await expect(panel).toHaveAttribute("data-map-zoom", "1.10");
  await page.locator('[data-map-operation="rotate-right"]').click();
  await expect(panel).toHaveAttribute("data-map-rotation", "1");
  await page.locator('[data-map-operation="reset"]').click();
  await expect(panel).toHaveAttribute("data-map-zoom", "1.00");
  await expect(panel).toHaveAttribute("data-map-pan-x", "0.000");
  await expect(panel).toHaveAttribute("data-map-pan-y", "0.000");
  await expect(panel).toHaveAttribute("data-map-rotation", "0");
  expect(failedResponses).toEqual([]);
});

test("creator can add and author a location check template", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.zhimuViewLoader));
  const advancedToggle = page.locator('[data-action="toggle-nav-advanced"]');
  if (await advancedToggle.isVisible()) await advancedToggle.click();
  await page.locator('[data-view="tabletopMap"]').click();
  await page.locator("[data-tabletop-map-page]").waitFor({ state: "visible" });

  const cards = page.locator("[data-map-location-check]");
  const initialCount = await cards.count();
  await page.locator('[data-action="map-add-location-check"]').click();
  await expect(cards).toHaveCount(initialCount + 1);

  const created = cards.nth(initialCount);
  await created.locator('[data-map-location-check-field="label"]').fill("破解潮汐机关");
  await created.locator('[data-map-location-check-field="target"]').fill("15");
  await created.locator('[data-map-location-check-field="target"]').press("Tab");
  await created.locator('[data-map-location-check-field="rollMode"]').selectOption("advantage");
  const successEffects = created.locator('[data-map-check-effect="successEffects"]');
  const failureEffects = created.locator('[data-map-check-effect="failureEffects"]');
  expect(await successEffects.count()).toBeGreaterThan(0);
  expect(await failureEffects.count()).toBeGreaterThan(0);
  const successEffect = successEffects.first();
  const failureEffect = failureEffects.first();
  await successEffect.fill("7");
  await successEffect.press("Tab");
  await failureEffect.fill("-5");
  await failureEffect.press("Tab");
  await expect(created.locator('[data-map-location-check-field="label"]')).toHaveValue("破解潮汐机关");
  await expect(created.locator('[data-map-location-check-field="target"]')).toHaveValue("15");
  await expect(created.locator('[data-map-location-check-field="rollMode"]')).toHaveValue("advantage");
  await expect(successEffect).toHaveValue("7");
  await expect(failureEffect).toHaveValue("-5");
});
