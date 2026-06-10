/** @typedef {import('@playwright/test').Page} Page */

export const E2E = {
  hostUserId: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
  playerUserId: "1d5e8155-a80f-4e7f-99f0-0ae317a35f35",
  worldId: "08646748-e4ae-446a-a5e7-ce59ca23ffc3",
  roomId: "e2e00001-e2e0-4000-8000-e2e000000001",
  inviteCode: "FOG-E2E-AUTO",
  roomName: "自动化测试 · 平行房"
};

/** Manual demo room — E2E must never write here. */
export const DEMO_ROOM = {
  roomId: "a65f94eb-a987-463c-bb81-aa482367e54a",
  inviteCode: "FOG-HARBOR-DEMO"
};

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4173";

/**
 * @param {import('@playwright/test').BrowserContext} context
 * @param {{ worldId?: string, roomId?: string | null }} [overrides]
 */
export async function injectDemoContext(context, overrides = {}) {
  const worldId = overrides.worldId ?? E2E.worldId;
  const roomId = overrides.roomId === undefined ? E2E.roomId : overrides.roomId;
  await context.addInitScript(({ worldId, roomId }) => {
    localStorage.setItem("zhimuDemoMode", "true");
    localStorage.removeItem("zhimuSessionToken");
    localStorage.setItem("zhimuActiveWorldId", worldId);
    if (roomId) localStorage.setItem(`zhimuActiveRoomId:${worldId}`, roomId);
    else localStorage.removeItem(`zhimuActiveRoomId:${worldId}`);
  }, { worldId, roomId });
}

/** Host browser: already in E2E parallel room. */
export async function injectHostContext(context) {
  return injectDemoContext(context, { worldId: E2E.worldId, roomId: E2E.roomId });
}

/** Player browser: world only — must join via invite code in UI. */
export async function injectPlayerPreJoinContext(context) {
  return injectDemoContext(context, { worldId: E2E.worldId, roomId: null });
}

export async function waitForCloudReady(page, timeout = 45_000) {
  await page.waitForFunction(() => {
    const state = window.zhimuState;
    const worldId = window.zhimuApi?.context?.worldId;
    return state && !state.cloudLoading && worldId && (state.cloudWorlds?.length || state.cloudStudio?.world);
  }, undefined, { timeout });
}

export async function waitForSectionCompleted(page, timeout = 20_000) {
  await page.waitForFunction(() => {
    const sections = window.zhimuState?.cloudPlayer?.sections || [];
    return sections.some((section) => section.completed);
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

/**
 * Player joins E2E parallel room through UI (DEMO_ROUTE Act 2 steps 4–5).
 * @param {Page} page
 * @param {string} [inviteCode]
 */
export async function joinRoomViaInviteUi(page, inviteCode = E2E.inviteCode) {
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
