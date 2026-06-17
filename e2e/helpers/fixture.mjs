/** Playwright helpers — CI test fixture (TEST-FIXTURE-DEMO), not a specific story script. */

/** @typedef {import('@playwright/test').Page} Page */

export const FIXTURE = {
  hostUserId: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
  playerUserId: "1d5e8155-a80f-4e7f-99f0-0ae317a35f35",
  worldId: "11111111-2222-4333-8444-555555550001",
  roomId: "11111111-2222-4333-8444-555555550002",
  inviteCode: "TEST-FIXTURE-DEMO"
};

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4173";

/**
 * @param {import('@playwright/test').BrowserContext} context
 * @param {{ worldId?: string, roomId?: string | null }} [overrides]
 */
export async function injectDemoContext(context, overrides = {}) {
  const worldId = overrides.worldId ?? FIXTURE.worldId;
  const roomId = overrides.roomId === undefined ? FIXTURE.roomId : overrides.roomId;
  await context.addInitScript(({ worldId, roomId }) => {
    localStorage.setItem("zhimuDemoMode", "true");
    localStorage.removeItem("zhimuSessionToken");
    localStorage.setItem("zhimuActiveWorldId", worldId);
    if (roomId) localStorage.setItem(`zhimuActiveRoomId:${worldId}`, roomId);
    else localStorage.removeItem(`zhimuActiveRoomId:${worldId}`);
  }, { worldId, roomId });
}

export async function injectHostContext(context) {
  return injectDemoContext(context, { worldId: FIXTURE.worldId, roomId: FIXTURE.roomId });
}

export async function injectPlayerPreJoinContext(context) {
  return injectDemoContext(context, { worldId: FIXTURE.worldId, roomId: null });
}

export async function waitForCloudReady(page, timeout = 45_000) {
  await page.waitForFunction(() => {
    const state = window.zhimuState;
    const worldId = window.zhimuApi?.context?.worldId;
    return state && !state.cloudLoading && worldId && (state.cloudWorlds?.length || state.cloudStudio?.world);
  }, undefined, { timeout });
}

/** @param {Page} page */
export async function goToView(page, view) {
  await page.locator(`.nav-item[data-view="${view}"]`).click();
  await page.waitForFunction((v) => window.zhimuState?.view === v, view, { timeout: 15_000 });
}

/** @param {Page} page */
export async function dismissModalIfOpen(page) {
  const backdrop = page.locator("#modal-backdrop.show");
  if (await backdrop.isVisible().catch(() => false)) {
    const primary = page.locator("#modal .primary-btn").first();
    if (await primary.isVisible().catch(() => false)) await primary.click();
    else await page.locator("#modal [data-close]").first().click();
    await backdrop.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
  }
}

/** @param {Page} page */
export async function joinRoomViaInviteUi(page, inviteCode = FIXTURE.inviteCode) {
  await page.locator("#preview-btn").click();
  await page.locator("#modal-backdrop.show").waitFor({ state: "visible", timeout: 10_000 });
  await page.locator("[data-join-code]").fill(inviteCode);
  await page.locator("[data-join-lookup]").click();
  await page.waitForFunction(() => {
    const select = document.querySelector("[data-join-role]");
    return select && !select.disabled && select.value;
  }, undefined, { timeout: 20_000 });
  await page.locator("[data-join-submit]").click();
  await page.waitForFunction(() => window.zhimuState?.view === "player", undefined, { timeout: 20_000 });
  await waitForCloudReady(page);
}
