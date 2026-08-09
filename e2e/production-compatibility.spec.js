import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const surfaces = [
  { name: "site", url: "https://getzhimu.com/", mainId: "main-content" },
  { name: "creator", url: "https://app.getzhimu.com/", mainId: "creator-main" },
  { name: "host", url: "https://host.getzhimu.com/", mainId: "host-main" },
  { name: "player", url: "https://play.getzhimu.com/", mainId: "play-main" }
];

for (const surface of surfaces) {
  test(`${surface.name} passes the production compatibility contract`, async ({ page }, testInfo) => {
    const runtimeErrors = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 500 && response.url().includes("getzhimu.com")) {
        runtimeErrors.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (message.text().startsWith("Failed to load resource:")) return;
      const source = message.location().url || "";
      if (!source || source.includes("getzhimu.com")) runtimeErrors.push(message.text());
    });

    const response = await page.goto(surface.url, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${surface.url} must return a successful document`).toBeLessThan(400);
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(page.locator(`#${surface.mainId}`)).toBeVisible();
    await expect(page.locator("vite-error-overlay, nextjs-portal, #webpack-dev-server-client-overlay")).toHaveCount(0);

    const requiresProgrammaticFocus = testInfo.project.name.includes("webkit")
      || testInfo.project.name.includes("emulation");
    if (requiresProgrammaticFocus) {
      await page.locator(".skip-link").focus();
    } else {
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press("Tab");
    }
    await expect(page.locator(".skip-link")).toBeFocused();
    await page.locator(".skip-link").press("Enter");
    await expect(page.locator(`#${surface.mainId}`)).toBeFocused();

    const viewport = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(viewport.scrollWidth, `${surface.name} must not overflow horizontally`).toBeLessThanOrEqual(
      viewport.clientWidth + 1
    );

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const blockingViolations = axe.violations.filter(({ impact }) => impact === "critical" || impact === "serious");
    expect(blockingViolations, JSON.stringify(blockingViolations, null, 2)).toEqual([]);
    expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);

    await page.screenshot({
      path: testInfo.outputPath(`${surface.name}.png`),
      fullPage: false
    });
  });
}
