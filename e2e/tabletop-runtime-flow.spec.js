import { expect, test } from "@playwright/test";

const CREATOR_URL = "http://127.0.0.1:5193";
const HOST_URL = "http://127.0.0.1:5195";
const PLAY_URL = "http://127.0.0.1:5194";
const FIXTURE = {
  hostUserId: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
  playerUserId: "1d5e8155-a80f-4e7f-99f0-0ae317a35f35",
  worldId: "33333333-3333-4333-8444-555555550003"
};

async function prepareCreator(context) {
  await context.addInitScript(({ hostUserId, worldId }) => {
    if (!location.href.startsWith("http")) return;
    localStorage.setItem("zhimuDemoMode", "true");
    localStorage.setItem("zhimuDemoUserId", hostUserId);
    localStorage.setItem("zhimuFirstRunDismissed", "1");
    localStorage.setItem(`zhimuFirstRunDismissed:user:${encodeURIComponent(hostUserId)}`, "1");
    localStorage.removeItem("zhimuSessionToken");
    sessionStorage.removeItem("zhimuSessionToken");
    localStorage.setItem("zhimuActiveWorldId", worldId);
    localStorage.removeItem(`zhimuActiveRoomId:${worldId}`);
  }, FIXTURE);
}

async function prepareHost(context, roomId) {
  await context.addInitScript(({ hostUserId, worldId, roomId }) => {
    if (!location.href.startsWith("http")) return;
    localStorage.setItem("zhimuDemoMode", "true");
    localStorage.setItem("zhimuDemoUserId", hostUserId);
    localStorage.removeItem("zhimuSessionToken");
    sessionStorage.removeItem("zhimuSessionToken");
    localStorage.setItem("zhimuHostWorldId", worldId);
    localStorage.setItem(`zhimuHostRoomId:${worldId}`, roomId);
  }, { ...FIXTURE, roomId });
}

async function preparePlayer(context) {
  await context.addInitScript(({ playerUserId }) => {
    if (!location.href.startsWith("http")) return;
    localStorage.setItem("zhimuDemoMode", "true");
    localStorage.setItem("zhimuDemoUserId", playerUserId);
    localStorage.removeItem("zhimuSessionToken");
    sessionStorage.removeItem("zhimuSessionToken");
  }, FIXTURE);
}

async function joinRoom(page, inviteCode) {
  await page.goto(PLAY_URL);
  await page.getByTestId("invite-code-input").fill(inviteCode);
  await page.getByTestId("start-join").click();

  const role = page.locator(".role-card:not([disabled])").first();
  await role.waitFor({ state: "visible" });
  await role.click();
  await page.locator('[data-action="confirm-join"]').click();
  await page.locator("[data-game-tab-bar]").waitFor({ state: "visible" });
}

test("创作者发布地图后，主持切场与结算可在断线恢复后同步给玩家", async ({ browser }, testInfo) => {
  const creatorContext = await browser.newContext({ locale: "zh-CN", viewport: { width: 1440, height: 1000 } });
  await prepareCreator(creatorContext);
  const creatorPage = await creatorContext.newPage();
  const browserIssues = [];
  const expectedFixtureFailure = (url) => url.includes("/api/metrics/web-vitals")
    || url.includes("/api/platform/social/dm/conversations")
    || url.includes("/recap/latest");
  const trackBrowserIssues = (label, page) => {
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const value = message.text();
      if (value.includes("/api/metrics/web-vitals") || value.startsWith("Failed to load resource:")) return;
      browserIssues.push(`${label} console: ${value}`);
    });
    page.on("pageerror", (error) => browserIssues.push(`${label} pageerror: ${error.message}`));
    page.on("response", (response) => {
      if (response.status() >= 400 && !expectedFixtureFailure(response.url())) {
        browserIssues.push(`${label} response: ${response.status()} ${response.url()}`);
      }
    });
  };
  trackBrowserIssues("creator", creatorPage);

  let hostContext;
  let playerContext;

  try {
    await creatorPage.goto(CREATOR_URL, { waitUntil: "domcontentloaded" });
    await creatorPage.waitForFunction(() => Boolean(window.zhimuViewLoader) && !window.zhimuState?.cloudLoading);
    const advancedToggle = creatorPage.locator('[data-action="toggle-nav-advanced"]');
    if (await advancedToggle.isVisible()) await advancedToggle.click();
    await creatorPage.locator('[data-view="tabletopMap"]').click();
    await creatorPage.locator("[data-tabletop-map-page]").waitFor({ state: "visible" });
    await creatorPage.locator('[data-action="map-select-location"][data-location-id="review-room"]').click();
    await expect(creatorPage.locator('[data-map-location-field="segmentKey"]')).toHaveValue("authorization-review");
    const playerDescription = creatorPage.locator('[data-map-location-field="description"]');
    await playerDescription.fill("环形审查屏已对齐二次授权记录，玩家可在这里逐条抽取已授权证物。");
    const [saveResponse] = await Promise.all([
      creatorPage.waitForResponse((response) => response.request().method() === "PATCH"
        && new URL(response.url()).pathname === `/api/worlds/${FIXTURE.worldId}`, { timeout: 15_000 }),
      creatorPage.locator('[data-action="map-save"]').click()
    ]);
    expect(saveResponse.ok()).toBe(true);

    await creatorPage.locator('[data-view="creatorCockpit"]').click();
    await creatorPage.locator('[data-cockpit-stage="launch"]').click();
    await creatorPage.locator('[data-cockpit-item="test-room"]').click();
    await creatorPage.locator('[data-go="publish"]').click();
    await creatorPage.locator('[data-action="create-world-release"]').waitFor({ state: "visible" });
    await creatorPage.locator("#world-release-label").fill("三端闭环验收版");
    const [releaseResponse] = await Promise.all([
      creatorPage.waitForResponse((response) => response.request().method() === "POST"
        && new URL(response.url()).pathname === `/api/worlds/${FIXTURE.worldId}/releases`),
      creatorPage.locator('[data-action="create-world-release"]').click()
    ]);
    expect(releaseResponse.ok()).toBe(true);
    const release = await releaseResponse.json();

    await creatorPage.locator('[data-action="world-rooms"]').click();
    await creatorPage.locator("[data-room-draft=name]").waitFor({ state: "visible" });
    await creatorPage.locator("[data-room-draft=name]").fill("三端真实验收房");
    await creatorPage.locator("[data-room-draft=releaseId]").selectOption(release.id);
    const [roomResponse] = await Promise.all([
      creatorPage.waitForResponse((response) => response.request().method() === "POST"
        && new URL(response.url()).pathname === `/api/worlds/${FIXTURE.worldId}/rooms`),
      creatorPage.locator('[data-action="room-create"]').click()
    ]);
    expect(roomResponse.ok()).toBe(true);
    const room = await roomResponse.json();
    expect(room.contentBinding?.release?.id).toBe(release.id);
    await expect(creatorPage.locator(".room-workspace-row").filter({ hasText: room.invite_code })).toHaveCount(1);
    await testInfo.attach("creator-map-release", {
      body: await creatorPage.screenshot({ fullPage: false }),
      contentType: "image/png"
    });

    hostContext = await browser.newContext({ locale: "zh-CN", viewport: { width: 1440, height: 1000 } });
    playerContext = await browser.newContext({ locale: "zh-CN", viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await prepareHost(hostContext, room.id);
    await preparePlayer(playerContext);
    const hostPage = await hostContext.newPage();
    const playerPage = await playerContext.newPage();
    trackBrowserIssues("host", hostPage);
    trackBrowserIssues("player", playerPage);

    await hostPage.goto(`${HOST_URL}/?room=${encodeURIComponent(room.id)}`);
    await expect(hostPage.locator(".host-stage-panel")).toBeVisible({ timeout: 30_000 });
    await expect(hostPage.getByText("核验二次授权", { exact: true })).toBeVisible();

    await joinRoom(playerPage, room.invite_code);
    await expect(playerPage.locator(".player-stage")).toBeVisible({ timeout: 30_000 });
    await expect(playerPage.locator(".player-stage-current")).toContainText("环形审查屏已对齐二次授权记录");
    await expect(playerPage.locator(".player-stage")).not.toContainText("隐藏事实");

    const playerProjection = await playerPage.evaluate(async (roomId) => {
      const response = await fetch(`/api/rooms/${roomId}/current-state`);
      return response.json();
    }, room.id);
    expect(playerProjection.currentBeat.host).toBeNull();
    expect(playerProjection.presentation.map.host).toBeNull();
    expect(playerProjection.presentation.map.locations.map((location) => location.id)).not.toContain("appeal-terminal");

    await playerPage.locator(".voice-compact").click();
    await expect(playerPage.locator(".voice-hub")).toContainText("全员主语音房");
    await expect(playerPage.locator(".voice-roster-list")).toContainText("主持");
    await expect(playerPage.locator('[data-action="voice-room-create"]')).toBeDisabled();
    await playerPage.locator('[data-game-tab-bar] [data-action="switch-tab"][data-tab="home"]').click();

    const hostStart = hostPage.locator('[data-action="host-session-start"]');
    await hostStart.click();
    await expect(hostStart).toContainText("再次确认");
    const [startResponse] = await Promise.all([
      hostPage.waitForResponse((response) => response.request().method() === "POST"
        && new URL(response.url()).pathname === `/api/rooms/${room.id}/host/start`, { timeout: 15_000 }),
      hostStart.click()
    ]);
    expect(startResponse.ok()).toBe(true);
    await expect(hostPage.locator('[data-action="host-session-start"]')).toHaveCount(0);
    await expect.poll(async () => playerPage.evaluate(async (roomId) => {
      const response = await fetch(`/api/rooms/${roomId}/voice-session`);
      const payload = await response.json();
      return payload.voicePolicy?.privateRoomsEnabled;
    }, room.id), { timeout: 15_000 }).toBe(true);
    await playerPage.locator(".voice-compact").click();
    await expect(playerPage.locator('[data-action="voice-room-create"]')).toBeEnabled({ timeout: 15_000 });
    await expect(playerPage.locator(".voice-room-policy")).toContainText("正式开始");
    await playerPage.locator('[data-game-tab-bar] [data-action="switch-tab"][data-tab="home"]').click();

    await expect(playerPage.locator("[data-player-location-discovery]")).toHaveAttribute("aria-busy", "false", { timeout: 15_000 });
    await playerPage.locator('[data-action="tabletop-draw-clue"]').click();
    await expect(playerPage.locator("[data-player-location-clue]")).toBeVisible();
    await expect(playerPage.locator("[data-player-location-clue]")).not.toContainText("主持");

    await playerPage.locator('[data-game-tab-bar] [data-action="switch-tab"][data-tab="explore"]').click();
    await expect(playerPage.locator("[data-player-tabletop-global-alert]")).toHaveCount(0);
    await playerContext.setOffline(true);
    await expect(playerPage.locator("[data-sync-banner] .sync-banner")).toContainText("离线", { timeout: 15_000 });
    await hostPage.locator('[data-action="host-tabletop-start-encounter"]').click();
    await playerContext.setOffline(false);
    await expect(playerPage.locator("[data-player-tabletop-global-alert]")).toBeVisible({ timeout: 15_000 });
    await expect(playerPage.locator("[data-player-tabletop-global-alert]")).toContainText("遭遇");
    await playerPage.locator('[data-player-tabletop-global-alert] [data-tab="home"]').click();
    await expect(playerPage.locator("[data-player-tabletop-encounter]")).toBeVisible();
    await hostPage.locator('[data-action="host-tabletop-end-encounter"]').click();
    await expect(playerPage.locator("[data-player-tabletop-encounter]")).toHaveCount(0, { timeout: 15_000 });

    await hostPage.locator('[data-action="host-tabletop-start-check"][data-check-id="verify-authorization"]').click();
    await expect(hostPage.locator("[data-host-tabletop-check]")).toContainText("核验二次授权");
    await expect(playerPage.locator("[data-player-tabletop-check]")).toContainText("核验二次授权", { timeout: 15_000 });
    await expect(playerPage.locator("[data-player-tabletop-check]")).toContainText("主持人发起判定");
    await expect(playerPage.locator("[data-player-tabletop-check]")).not.toContainText("你确认了二次授权缺失");
    await expect(playerPage.locator("[data-player-tabletop-check]")).not.toContainText("日志链不完整");

    await hostPage.locator('[data-action="host-tabletop-roll-check"]').click();
    await expect(hostPage.locator(".host-stage-check-result")).toBeVisible();
    await expect(playerPage.locator(".player-stage-check-result")).toBeVisible({ timeout: 15_000 });

    const playerResult = await playerPage.locator("[data-player-tabletop-check]").innerText();
    const successVisible = playerResult.includes("你确认了二次授权缺失");
    const failureVisible = playerResult.includes("日志链不完整");
    expect(successVisible || failureVisible).toBe(true);
    expect(successVisible && failureVisible).toBe(false);

    await expect(playerPage.locator("[data-player-tabletop-check-changes]")).toHaveCount(0);
    await hostPage.locator('[data-action="host-tabletop-apply-check-outcome"]').click();
    await expect(hostPage.locator("[data-host-tabletop-check-changes]")).toContainText("已写入房间变量");
    await expect(playerPage.locator("[data-player-tabletop-check-changes]")).toContainText("联盟信誉", { timeout: 15_000 });

    const endingAction = hostPage.locator('[data-action="host-tabletop-publish-ending"]:not([disabled])').first();
    await expect(endingAction).toBeVisible();
    const endingCard = endingAction.locator("xpath=ancestor::article");
    const endingName = (await endingCard.locator("h5").innerText()).trim();
    expect(["申诉通过", "维持冻结"]).toContain(endingName);
    await endingAction.click();
    await expect(playerPage.locator("[data-player-tabletop-ending]")).toContainText(endingName, { timeout: 15_000 });

    await playerPage.reload();
    await playerPage.locator("[data-game-tab-bar]").waitFor({ state: "visible" });
    await expect(playerPage.locator("[data-player-tabletop-ending]")).toContainText(endingName, { timeout: 15_000 });
    await expect(playerPage.locator("[data-player-tabletop-check-changes]")).toContainText("联盟信誉");

    await hostPage.locator('[data-action="host-tabletop-clear-check"]').click();
    await expect(playerPage.locator("[data-player-tabletop-check]")).toHaveCount(0, { timeout: 15_000 });
    await expect(playerPage.locator("[data-player-tabletop-ending]")).toContainText(endingName);
    await expect(playerPage.locator("[data-sync-banner] .sync-banner")).toContainText("状态已追平");
    await testInfo.attach("player-recovered-ending", {
      body: await playerPage.screenshot({ fullPage: false }),
      contentType: "image/png"
    });
    expect(browserIssues).toEqual([]);
  } finally {
    await creatorContext.close();
    await hostContext?.close();
    await playerContext?.close();
  }
});
