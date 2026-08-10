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

test("主持发起并公开地点判定后，玩家端按阶段同步且不泄露另一条结局", async ({ browser }) => {
  const hostContext = await browser.newContext({ locale: "zh-CN", viewport: { width: 1440, height: 1000 } });
  const playerContext = await browser.newContext({ locale: "zh-CN", viewport: { width: 390, height: 844 } });
  await prepareHost(hostContext);
  await preparePlayer(playerContext);

  const hostPage = await hostContext.newPage();
  const playerPage = await playerContext.newPage();

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

    await hostPage.locator('[data-action="host-tabletop-clear-check"]').click();
    await expect(playerPage.locator("[data-player-tabletop-check]")).toHaveCount(0, { timeout: 15_000 });
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});
