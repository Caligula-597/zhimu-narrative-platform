#!/usr/bin/env node
/**
 * Real LiveKit staging acceptance for one host and two already-joined players.
 *
 * The identities and room are deliberately provisioned outside this script so
 * a failed media run never creates or mutates production-like content. Tokens
 * must belong to short-lived staging-only accounts.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

export const REQUIRED_VOICE_E2E_ENV = Object.freeze([
  "VOICE_E2E_API_URL",
  "VOICE_E2E_HOST_URL",
  "VOICE_E2E_PLAY_URL",
  "VOICE_E2E_WORLD_ID",
  "VOICE_E2E_ROOM_ID",
  "VOICE_E2E_HOST_TOKEN",
  "VOICE_E2E_PLAYER_A_TOKEN",
  "VOICE_E2E_PLAYER_B_TOKEN",
]);

function normalizedUrl(value) {
  return String(value || "").trim().replace(/\/$/u, "");
}

export function readVoiceE2eConfig(env = process.env) {
  const missing = REQUIRED_VOICE_E2E_ENV.filter((key) => !String(env[key] || "").trim());
  if (missing.length) {
    throw new TypeError(`missing staging voice environment: ${missing.join(", ")}`);
  }
  return {
    apiUrl: normalizedUrl(env.VOICE_E2E_API_URL),
    hostUrl: normalizedUrl(env.VOICE_E2E_HOST_URL),
    playUrl: normalizedUrl(env.VOICE_E2E_PLAY_URL),
    worldId: String(env.VOICE_E2E_WORLD_ID),
    roomId: String(env.VOICE_E2E_ROOM_ID),
    hostToken: String(env.VOICE_E2E_HOST_TOKEN),
    playerAToken: String(env.VOICE_E2E_PLAYER_A_TOKEN),
    playerBToken: String(env.VOICE_E2E_PLAYER_B_TOKEN),
    evidenceDir: path.resolve(env.VOICE_E2E_EVIDENCE_DIR || path.join("output", `staging-voice-${Date.now()}`)),
  };
}

async function apiJson(config, token, pathname, options = {}) {
  const response = await fetch(`${config.apiUrl}${pathname}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

function assertGate(condition, message) {
  if (!condition) throw new Error(message);
}

async function newVoiceContext(browser, origin, setup, setupArg) {
  const context = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1280, height: 900 },
  });
  await context.grantPermissions(["microphone"], { origin: new URL(origin).origin });
  await context.addInitScript(setup, setupArg);
  return context;
}

async function waitForPlayerGame(page) {
  await page.locator("[data-game-tab-bar]").waitFor({ state: "visible", timeout: 60_000 });
}

async function openPlayerVoice(page) {
  await page.locator('[data-game-tab-bar] [data-action="switch-tab"][data-tab="voice"]').click();
  await page.locator(".voice-hub").waitFor({ state: "visible", timeout: 30_000 });
}

async function connectPlayerAudio(page) {
  const button = page.locator('[data-action="voice-live-connect"]');
  if (await button.isVisible().catch(() => false)) await button.click();
  await page.locator(".voice-hub").getByText("音频已连接", { exact: false }).waitFor({
    state: "visible",
    timeout: 60_000,
  });
}

async function screenshot(page, target) {
  await page.screenshot({ path: target, fullPage: false });
}

export async function runVoiceMediaAcceptance(config) {
  await fs.mkdir(config.evidenceDir, { recursive: true });
  const session = await apiJson(config, config.hostToken, `/api/rooms/${config.roomId}/voice-session`);
  assertGate(session.response.ok, `voice-session preflight failed: HTTP ${session.response.status}`);
  const roster = Array.isArray(session.body?.voiceRoster) ? session.body.voiceRoster : [];
  assertGate(roster.some((member) => member.member_type === "host"), "voice roster has no host");
  assertGate(roster.filter((member) => member.member_type === "player").length >= 2, "voice roster needs two joined players");
  assertGate(session.body?.voicePolicy?.privateRoomsEnabled === false, "staging room must begin before formal session start");

  const browser = await chromium.launch({
    headless: true,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });
  let hostContext;
  let playerAContext;
  let playerBContext;
  const startedAt = new Date();
  const report = {
    schemaVersion: 1,
    gate: "staging-livekit-three-party-media",
    roomId: config.roomId,
    startedAt: startedAt.toISOString(),
    status: "failed",
    checks: [],
  };
  const pass = (id) => report.checks.push({ id, status: "passed", at: new Date().toISOString() });

  try {
    hostContext = await newVoiceContext(browser, config.hostUrl, ({ token, worldId, roomId }) => {
      sessionStorage.setItem("zhimuSessionToken", token);
      localStorage.setItem("zhimuHostWorldId", worldId);
      localStorage.setItem(`zhimuHostRoomId:${worldId}`, roomId);
    }, { token: config.hostToken, worldId: config.worldId, roomId: config.roomId });
    playerAContext = await newVoiceContext(browser, config.playUrl, ({ token, roomId }) => {
      sessionStorage.setItem("zhimuSessionToken", token);
      localStorage.setItem("zhimuPlayActiveRoomId", roomId);
      localStorage.setItem("zhimuPlayGameTab", "home");
    }, { token: config.playerAToken, roomId: config.roomId });
    playerBContext = await newVoiceContext(browser, config.playUrl, ({ token, roomId }) => {
      sessionStorage.setItem("zhimuSessionToken", token);
      localStorage.setItem("zhimuPlayActiveRoomId", roomId);
      localStorage.setItem("zhimuPlayGameTab", "home");
    }, { token: config.playerBToken, roomId: config.roomId });

    const hostPage = await hostContext.newPage();
    const playerAPage = await playerAContext.newPage();
    const playerBPage = await playerBContext.newPage();
    await Promise.all([
      hostPage.goto(`${config.hostUrl}/?room=${encodeURIComponent(config.roomId)}`),
      playerAPage.goto(config.playUrl),
      playerBPage.goto(config.playUrl),
    ]);
    await Promise.all([
      hostPage.locator(".host-voice-panel").waitFor({ state: "visible", timeout: 60_000 }),
      waitForPlayerGame(playerAPage),
      waitForPlayerGame(playerBPage),
    ]);
    await Promise.all([openPlayerVoice(playerAPage), openPlayerVoice(playerBPage)]);
    await Promise.all([
      hostPage.locator('[data-action="host-voice-connect"]').click(),
      connectPlayerAudio(playerAPage),
      connectPlayerAudio(playerBPage),
    ]);
    await hostPage.getByText("主持语音在线", { exact: false }).waitFor({ state: "visible", timeout: 60_000 });
    await hostPage.locator(".host-voice-policy").getByText(/3\/3 人已连接音频/u).waitFor({ state: "visible", timeout: 60_000 });
    pass("main-room-host-and-two-players-connected");

    await Promise.all([
      playerAPage.locator(".voice-roster-list").getByText("主持", { exact: false }).waitFor({ state: "visible" }),
      playerBPage.locator(".voice-roster-list").getByText("主持", { exact: false }).waitFor({ state: "visible" }),
    ]);
    assertGate(await playerAPage.locator('[data-action="voice-room-create"]').isDisabled(), "private room enabled before formal start");
    pass("waiting-room-policy-enforced");

    await playerBPage.reload();
    await waitForPlayerGame(playerBPage);
    await openPlayerVoice(playerBPage);
    await playerBPage.locator(".voice-hub").getByText("全员主语音房", { exact: false }).waitFor({ state: "visible" });
    await connectPlayerAudio(playerBPage);
    pass("refresh-restores-main-room-and-reconnects-media");

    const start = hostPage.locator('[data-action="host-session-start"]');
    await start.click();
    await start.click();
    await hostPage.locator('[data-action="host-session-start"]').waitFor({ state: "detached", timeout: 30_000 });
    await playerAPage.locator('[data-game-tab-bar] [data-action="switch-tab"][data-tab="home"]').click();
    await openPlayerVoice(playerAPage);
    await playerAPage.locator('[data-action="voice-room-create"]').waitFor({ state: "visible" });
    assertGate(!await playerAPage.locator('[data-action="voice-room-create"]').isDisabled(), "private room did not open after formal start");
    pass("formal-start-opens-private-room-policy");

    const privateRoomName = `媒体密谈 ${Date.now()}`;
    await playerAPage.locator('[data-action="voice-room-create"]').click();
    await playerAPage.locator('[data-bind="modalDraft"]').fill(privateRoomName);
    await playerAPage.locator("[data-voice-invite]:not([disabled])").first().check();
    const createResponse = playerAPage.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname === `/api/rooms/${config.roomId}/voice-rooms`);
    await playerAPage.locator('[data-action="modal-create-voice"]').click();
    const privateResponse = await createResponse;
    assertGate(privateResponse.status() === 201, `private room creation failed: HTTP ${privateResponse.status()}`);
    const privateRoom = await privateResponse.json();
    await playerAPage.locator(".voice-hub").getByText(privateRoomName, { exact: false }).waitFor({ state: "visible", timeout: 60_000 });
    await playerAPage.locator(".voice-hub").getByText("音频已连接", { exact: false }).waitFor({ state: "visible", timeout: 60_000 });

    const forbidden = await apiJson(
      config,
      config.hostToken,
      `/api/rooms/${config.roomId}/voice-rooms/${privateRoom.id}/token`,
      { method: "POST", body: "{}" },
    );
    assertGate(forbidden.response.status === 403, `uninvited host received private token: HTTP ${forbidden.response.status}`);
    pass("uninvited-member-cannot-subscribe-private-room");

    await playerBPage.reload();
    await waitForPlayerGame(playerBPage);
    await openPlayerVoice(playerBPage);
    await playerBPage.locator('[data-action="voice-room"]').click();
    const privateOption = playerBPage.locator(".voice-option").filter({ hasText: privateRoomName });
    await privateOption.waitFor({ state: "visible", timeout: 30_000 });
    await privateOption.locator('[data-action="voice-join"]').click();
    await playerBPage.locator(".voice-hub").getByText(privateRoomName, { exact: false }).waitFor({ state: "visible", timeout: 60_000 });
    await playerBPage.locator(".voice-hub").getByText(/2 人在线/u).waitFor({ state: "visible", timeout: 60_000 });
    pass("invited-players-connect-private-media");

    await Promise.all([
      screenshot(hostPage, path.join(config.evidenceDir, "host-main-room.png")),
      screenshot(playerAPage, path.join(config.evidenceDir, "player-a-private-room.png")),
      screenshot(playerBPage, path.join(config.evidenceDir, "player-b-private-room.png")),
    ]);
    report.status = "passed";
    return report;
  } catch (error) {
    report.error = error?.message || String(error);
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.durationMs = Date.now() - startedAt.getTime();
    await fs.writeFile(path.join(config.evidenceDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await Promise.allSettled([hostContext?.close(), playerAContext?.close(), playerBContext?.close()]);
    await browser.close();
  }
}

async function main() {
  const config = readVoiceE2eConfig();
  const report = await runVoiceMediaAcceptance(config);
  console.log(`staging voice media gate: ${report.status}`);
  console.log(`evidence: ${config.evidenceDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`staging voice media gate failed: ${error.message}`);
    process.exitCode = 1;
  });
}
