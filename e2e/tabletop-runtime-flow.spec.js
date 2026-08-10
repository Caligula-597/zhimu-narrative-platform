import { expect, test } from "@playwright/test";

const HOST_URL = "http://127.0.0.1:5195";
const PLAY_URL = "http://127.0.0.1:5194";
const FIXTURE = {
  hostUserId: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
  playerUserId: "1d5e8155-a80f-4e7f-99f0-0ae317a35f35",
  worldId: "33333333-3333-4333-8444-555555550003",
  roomId: "55555555-5555-4555-8555-555555550001",
  inviteCode: "ROOM-LIVE-DRAFT"
};

async function prepareHost(context) {
  await context.addInitScript(({ hostUserId, worldId, roomId }) => {
    localStorage.setItem("zhimuDemoMode", "true");
    localStorage.setItem("zhimuDemoUserId", hostUserId);
    localStorage.removeItem("zhimuSessionToken");
    sessionStorage.removeItem("zhimuSessionToken");
    localStorage.setItem("zhimuHostWorldId", worldId);
    localStorage.setItem(`zhimuHostRoomId:${worldId}`, roomId);
  }, FIXTURE);
}

async function preparePlayer(context) {
  await context.addInitScript(({ playerUserId }) => {
    localStorage.setItem("zhimuDemoMode", "true");
    localStorage.setItem("zhimuDemoUserId", playerUserId);
    localStorage.removeItem("zhimuSessionToken");
    sessionStorage.removeItem("zhimuSessionToken");
  }, FIXTURE);
}

async function joinRoom(page) {
  await page.goto(PLAY_URL);
  await page.getByTestId("invite-code-input").fill(FIXTURE.inviteCode);
  await page.getByTestId("start-join").click();

  const role = page.locator(".role-card:not([disabled])").first();
  await role.waitFor({ state: "visible" });
  await role.click();
  await page.locator('[data-action="confirm-join"]').click();
  await page.locator("[data-game-tab-bar]").waitFor({ state: "visible" });
}

test("主持结算地点判定后更新变量、筛选结局并按确认同步给玩家", async ({ browser }) => {
  const hostContext = await browser.newContext({ locale: "zh-CN", viewport: { width: 1440, height: 1000 } });
  const playerContext = await browser.newContext({ locale: "zh-CN", viewport: { width: 390, height: 844 } });
  await prepareHost(hostContext);
  await preparePlayer(playerContext);

  const hostPage = await hostContext.newPage();
  const playerPage = await playerContext.newPage();
  const browserIssues = [];
  const expectedFixtureFailure = (url) => url.includes("/api/metrics/web-vitals")
    || url.includes("/api/platform/social/dm/conversations")
    || url.includes("/recap/latest");
  for (const [label, page] of [["host", hostPage], ["player", playerPage]]) {
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
  }

  try {
    await hostPage.goto(`${HOST_URL}/?room=${encodeURIComponent(FIXTURE.roomId)}`);
    await expect(hostPage.locator(".host-stage-panel")).toBeVisible({ timeout: 30_000 });
    await expect(hostPage.getByText("核验二次授权", { exact: true })).toBeVisible();

    await joinRoom(playerPage);
    await expect(playerPage.locator(".player-stage")).toBeVisible({ timeout: 30_000 });

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

    await hostPage.locator('[data-action="host-tabletop-clear-check"]').click();
    await expect(playerPage.locator("[data-player-tabletop-check]")).toHaveCount(0, { timeout: 15_000 });
    await expect(playerPage.locator("[data-player-tabletop-ending]")).toContainText(endingName);
    expect(browserIssues).toEqual([]);
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});
