import { expect, test } from "@playwright/test";

test("creator relationship delete button reaches its lazily registered view method", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/**", async (route) => {
    if (!new URL(route.request().url()).pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.zhimuViewLoader));
  await page.evaluate(async () => {
    await import("/src/views/creator-workspaces.js");
    await import("/src/runtime/actions-creator-workspaces.js");
    const { setHtml } = await import("/shared/safe-dom.js");
    window.__relationshipDeleteConfirmCount = 0;
    window.confirm = () => {
      window.__relationshipDeleteConfirmCount += 1;
      return false;
    };
    setHtml(document.querySelector("#content"), '<button type="button" data-action="delete-relationship-inline" data-relationship-id="relationship-1">删除关系</button>');
  });

  await expect.poll(() => page.evaluate(async () => {
    const { getRuntime } = await import("/src/runtime/runtime-facade.js");
    const { getView } = await import("/src/runtime/view-registry.js");
    return [
      typeof getRuntime().handle,
      typeof window.zhimuActionsCreatorWorkspaces?.handleCreatorWorkspacesAction,
      typeof getView("creatorWorkspaces").deleteRelationshipInline
    ];
  })).toEqual(["function", "function", "function"]);

  await page.locator('[data-action="delete-relationship-inline"]').click();
  await expect.poll(() => page.evaluate(() => window.__relationshipDeleteConfirmCount)).toBe(1);
  expect(consoleErrors).toEqual([]);
});
