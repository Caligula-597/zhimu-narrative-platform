import { test, expect } from "@playwright/test";
import { BASE_URL, HOST_URL, PLAY_URL, injectHostContext, waitForCloudReady } from "./helpers/fixture.mjs";

const TRUSTED_TYPES_CSP = "trusted-types zhimu-html; require-trusted-types-for 'script'";

async function enforceTrustedTypesOnDocuments(page) {
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        "content-security-policy": TRUSTED_TYPES_CSP
      }
    });
  });
}

function collectTrustedTypesErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => {
    if (/TrustedHTML|Trusted Types|trusted type/i.test(error.message)) errors.push(error.message);
  });
  return errors;
}

test.describe("Trusted Types 强制模式 · 三端", () => {
  test("主应用可启动", async ({ context, page }) => {
    await injectHostContext(context);
    await enforceTrustedTypesOnDocuments(page);
    const errors = collectTrustedTypesErrors(page);
    await page.goto(BASE_URL);
    await waitForCloudReady(page);
    await expect(page.locator("#content")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("Host 可启动", async ({ page }) => {
    await enforceTrustedTypesOnDocuments(page);
    const errors = collectTrustedTypesErrors(page);
    await page.goto(HOST_URL);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator(".host-shell, .host-login, main").first()).toBeVisible({ timeout: 20_000 });
    expect(errors).toEqual([]);
  });

  test("Play 可启动", async ({ page }) => {
    await enforceTrustedTypesOnDocuments(page);
    const errors = collectTrustedTypesErrors(page);
    await page.goto(PLAY_URL);
    await expect(page.locator(".play-header").first()).toBeVisible({ timeout: 20_000 });
    expect(errors).toEqual([]);
  });
});
