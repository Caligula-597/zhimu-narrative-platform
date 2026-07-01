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
export const API_BASE = process.env.PLAYWRIGHT_API_URL || "http://localhost:4180";
export const HOST_URL = process.env.PLAYWRIGHT_HOST_URL || "http://localhost:5175";

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

export async function injectHostAppContext(context) {
  await context.addInitScript(({ worldId, roomId, hostUserId }) => {
    localStorage.setItem("zhimuDemoMode", "true");
    localStorage.setItem("zhimuDemoUserId", hostUserId);
    localStorage.removeItem("zhimuSessionToken");
    localStorage.setItem("zhimuHostWorldId", worldId);
    localStorage.setItem(`zhimuHostRoomId:${worldId}`, roomId);
  }, { worldId: FIXTURE.worldId, roomId: FIXTURE.roomId, hostUserId: FIXTURE.hostUserId });
}

/** @param {Page} page */
export async function gotoHostConsole(page) {
  await page.goto(`${HOST_URL}/?room=${encodeURIComponent(FIXTURE.roomId)}`);
  await page.locator(".host-console, .host-shell").first().waitFor({ state: "visible", timeout: 45_000 });
}

export async function injectPlayerPreJoinContext(context) {
  return injectDemoContext(context, { worldId: FIXTURE.worldId, roomId: null });
}

/** Demo creator with no active world — for wizard / first-run E2E. */
export async function injectFreshCreatorContext(context) {
  await context.addInitScript(() => {
    localStorage.setItem("zhimuDemoMode", "true");
    localStorage.removeItem("zhimuSessionToken");
    localStorage.removeItem("zhimuActiveWorldId");
    localStorage.removeItem("zhimuFirstRunDismissed");
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("zhimuActiveRoomId:")) localStorage.removeItem(key);
    }
  });
}

export const PLAY_URL = process.env.PLAYWRIGHT_PLAY_URL || "http://localhost:5174";

/** @param {Page} page @param {string} [inviteCode] @param {string} [roleName] */
export async function joinPlayRoomViaUi(page, inviteCode = FIXTURE.inviteCode, roleName) {
  await page.goto(PLAY_URL);
  await page.getByTestId("invite-code-input").fill(inviteCode);
  await page.getByTestId("start-join").click();
  const roleCards = page.locator(".role-card:not([disabled])");
  await roleCards.first().waitFor({ timeout: 30_000 });
  let target = roleName
    ? roleCards.filter({ hasText: roleName }).first()
    : roleCards.first();
  if (roleName && !(await target.isVisible().catch(() => false))) {
    target = roleCards.first();
  }
  await target.click();
  await page.locator('[data-action="confirm-join"]').click();
  await page.locator("[data-game-tab-bar]").waitFor({ state: "visible", timeout: 30_000 });
}

export async function waitForCloudReady(page, timeout = 45_000) {
  await page.waitForFunction(() => {
    const state = window.zhimuState;
    // `window.zhimuApi` bridge was removed; worldId is read from the loaded studio world.
    const worldId = state?.cloudStudio?.world?.id;
    return state && !state.cloudLoading && worldId && (state.cloudWorlds?.length || state.cloudStudio?.world);
  }, undefined, { timeout });
}

const ADVANCED_NAV_VIEWS = new Set(["writer", "clues", "rules", "archive"]);

/** @param {Page} page */
export async function goToView(page, view) {
  if (ADVANCED_NAV_VIEWS.has(view)) {
    const advanced = page.locator("#nav-advanced");
    if (await advanced.getAttribute("hidden").catch(() => null) !== null) {
      await page.locator('[data-action="toggle-nav-advanced"]').click();
      await advanced.waitFor({ state: "visible", timeout: 10_000 });
    }
  }
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
 * Refresh host events and report whether a pending event exists (for wait-strip / nudge E2E).
 * @param {Page} page
 */
export async function ensurePendingHostEvent(page) {
  await page.locator('[data-action="refresh-host-events"]').click({ timeout: 5000 }).catch(() => {});
  await page.waitForFunction(
    () => (window.zhimuState?.cloudHostEvents || []).some((row) => row.status === "pending"),
    undefined,
    { timeout: 15_000 }
  ).catch(() => {});
  return page.evaluate(async ({ roomId, hostUserId, apiBase }) => {
    const res = await fetch(`${apiBase}/api/rooms/${roomId}/host-events`, {
      headers: { "x-user-id": hostUserId }
    });
    const rows = res.ok ? await res.json() : [];
    return Array.isArray(rows) && rows.some((row) => row.status === "pending");
  }, { roomId: FIXTURE.roomId, hostUserId: FIXTURE.hostUserId, apiBase: API_BASE });
}

/** @param {Page} page */
export async function refreshHostRoomState(page) {
  await page.locator('[data-action="refresh-host-room"]').click({ timeout: 8000 }).catch(() => {});
  await page.waitForFunction(
    () => Array.isArray(window.zhimuState?.cloudHostPlayers),
    undefined,
    { timeout: 20_000 }
  ).catch(() => {});
}

/** @param {Page} page */
export async function hasJoinedWaitingHostPlayers(page) {
  return page.evaluate(async ({ roomId, hostUserId, apiBase }) => {
    const headers = { "x-user-id": hostUserId };
    const [eventsRes, playersRes] = await Promise.all([
      fetch(`${apiBase}/api/rooms/${roomId}/host-events`, { headers }),
      fetch(`${apiBase}/api/rooms/${roomId}/host/players`, { headers })
    ]);
    if (!eventsRes.ok || !playersRes.ok) return false;
    const events = await eventsRes.json();
    const playersPayload = await playersRes.json();
    const pending = Array.isArray(events) ? events.filter((row) => row.status === "pending") : [];
    const players = Array.isArray(playersPayload?.players) ? playersPayload.players : [];
    const joined = players.filter((player) => player.joined);
    if (!pending.length || !joined.length) return false;
    const waitingIds = new Set();
    for (const event of pending) {
      for (const roleId of event.trigger_players || []) waitingIds.add(String(roleId));
      for (const action of event.actions || []) {
        const roleId = action.roleSlotId ?? action.role_slot_id;
        if (roleId) waitingIds.add(String(roleId));
        for (const item of action.roleSlotIds || action.role_slot_ids || []) waitingIds.add(String(item));
      }
    }
    return waitingIds.size
      ? joined.some((player) => waitingIds.has(String(player.role_slot_id)))
      : joined.length > 0;
  }, { roomId: FIXTURE.roomId, hostUserId: FIXTURE.hostUserId, apiBase: API_BASE });
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
