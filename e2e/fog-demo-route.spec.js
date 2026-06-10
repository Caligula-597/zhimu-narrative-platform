/**
 * DEMO_ROUTE.md Acts 1–5 — dual-browser Playwright E2E.
 * Uses isolated parallel room FOG-E2E-AUTO (never touches FOG-HARBOR-DEMO).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import {
  E2E,
  dismissModalIfOpen,
  goToView,
  injectHostContext,
  injectPlayerPreJoinContext,
  joinRoomViaInviteUi,
  waitForCloudReady,
  waitForSectionCompleted
} from "./helpers/demo.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");

function runBackendScript(label, scriptName) {
  const result = spawnSync(process.execPath, [path.join("scripts", scriptName)], {
    cwd: backend,
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) throw new Error(`${label} failed — is DATABASE_URL set and db seeded?`);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  runBackendScript("bootstrap-e2e-room", "bootstrap-e2e-room.mjs");
  runBackendScript("reset-e2e-room", "reset-e2e-room.mjs");
});

test("雾港 Demo 全链路（E2E 副本房）", async ({ browser }) => {
  test.setTimeout(300_000);

  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext();
  await injectHostContext(hostContext);
  await injectPlayerPreJoinContext(playerContext);

  const hostPage = await hostContext.newPage();
  const playerPage = await playerContext.newPage();

  // ── Act 1: Host — overview + studio (authoring still shared at world level) ──
  await hostPage.goto("/");
  await waitForCloudReady(hostPage);
  await goToView(hostPage, "overview");
  await expect(hostPage.locator("main")).toContainText(/雾港|章节|云端/, { timeout: 15_000 });

  await goToView(hostPage, "studio");
  await expect(hostPage.locator("main")).toContainText(/旧港|档案馆|编排|场景/, { timeout: 15_000 });

  // ── Act 2: Player — invite join + reading + note ────────────────────────
  await playerPage.goto("/");
  await waitForCloudReady(playerPage);
  await joinRoomViaInviteUi(playerPage, E2E.inviteCode);
  await expect(playerPage.locator("main")).toContainText(/自动化测试|E2E|平行房|顾言/, { timeout: 15_000 });

  const readBtn = playerPage.locator('[data-action="read-cloud-next"]:not([disabled])');
  await expect(readBtn).toBeVisible({ timeout: 20_000 });
  await expect(playerPage.locator(".reader-card h3")).toContainText(/档案馆|抵达/);

  await playerPage.locator('[data-action="add-cloud-note"]').click({ timeout: 5000 }).catch(() => {});

  await readBtn.click();
  await waitForSectionCompleted(playerPage);

  const readBtn2 = playerPage.locator('[data-action="read-cloud-next"]:not([disabled])');
  await expect(readBtn2).toBeVisible({ timeout: 15_000 });
  await expect(playerPage.locator(".reader-card h3")).toContainText(/撕去|一页/);
  await readBtn2.click();
  await playerPage.waitForFunction(() => {
    const sections = window.zhimuState?.cloudPlayer?.sections || [];
    return sections.filter((section) => section.completed).length >= 2;
  }, undefined, { timeout: 25_000 });

  // ── Act 3: Host monitor + SSE ───────────────────────────────────────────
  await goToView(hostPage, "director");
  await hostPage.locator('[data-action="refresh-host-room"]').click();
  await hostPage.locator('[data-action="refresh-host-players"]').click();

  await expect(hostPage.locator(".director-poll-hint")).toContainText(/实时推送已连接|15 秒自动刷新/, {
    timeout: 25_000
  });

  await hostPage.waitForFunction(
    () => (window.zhimuState?.cloudHostPlayers || []).some((player) => /顾言/.test(player.role_name || "")),
    undefined,
    { timeout: 30_000 }
  );

  const hostTable = hostPage.locator(".host-runtime-table");
  await expect(hostTable).toContainText(/顾言/);
  await expect(hostTable).toContainText(/2\/2|1\/2/);

  const progressBefore = await hostTable.innerText();
  await playerPage.locator('[data-action="add-cloud-note"]').first().click({ timeout: 3000 }).catch(() => {});
  await hostPage.waitForFunction(
    (prev) => document.querySelector(".host-runtime-table")?.innerText !== prev,
    progressBefore,
    { timeout: 20_000 }
  ).catch(() => {});

  // ── Act 4: Explore + host confirm ───────────────────────────────────────
  const rackBtn = playerPage
    .locator(".location-row")
    .filter({ has: playerPage.locator("strong", { hasText: "旧报架" }) })
    .locator('[data-action="investigate-cloud"]:not([disabled])');
  await expect(rackBtn).toBeVisible({ timeout: 15_000 });

  const investigateDone = playerPage.waitForResponse(
    (resp) => resp.url().includes("/investigate") && resp.request().method() === "POST",
    { timeout: 30_000 }
  );
  await rackBtn.click();
  await expect(playerPage.locator("#modal-backdrop.show")).toBeVisible({ timeout: 15_000 });
  await playerPage.locator("#modal .primary-btn").click();
  expect((await investigateDone).ok()).toBeTruthy();
  await dismissModalIfOpen(playerPage);

  await playerPage.waitForFunction(() => (window.zhimuState?.cloudPlayer?.clues || []).length > 0, undefined, {
    timeout: 20_000
  });

  await hostPage.locator('[data-action="refresh-host-events"]').click();
  const executeBtn = hostPage.locator('[data-action="execute-host-event"]').first();
  await expect(executeBtn).toBeVisible({ timeout: 25_000 });
  await executeBtn.click();
  await playerPage.waitForFunction(
    () => (window.zhimuState?.cloudExploration?.scenes || []).some((scene) => scene.name?.includes("档案密室")),
    undefined,
    { timeout: 25_000 }
  );

  // ── Act 5: Checkpoint + recap (both sides) ───────────────────────────────
  const cpLabel = `E2E-cp-${Date.now()}`;
  const recapLabel = `E2E-recap-${Date.now()}`;

  await hostPage.locator('[data-action="create-checkpoint"]').click();
  await expect(hostPage.locator("#modal-backdrop.show")).toBeVisible();
  await hostPage.locator('[data-studio-field="checkpointTitle"]').fill(cpLabel);
  await hostPage.locator("[data-checkpoint-submit]").click();
  await expect(hostPage.locator("#toast")).toContainText(/存档/, { timeout: 15_000 });
  await dismissModalIfOpen(hostPage);

  await goToView(hostPage, "archive");
  await hostPage.locator('[data-action="refresh-cloud"]').click();
  await hostPage.waitForFunction(
    (label) => (window.zhimuState?.cloudCheckpoints || []).some((row) => row.label === label),
    cpLabel,
    { timeout: 20_000 }
  );

  await hostPage.locator('[data-action="create-recap"]').click();
  await expect(hostPage.locator("#modal-backdrop.show")).toBeVisible();
  await hostPage.locator('[data-studio-field="recapTitle"]').fill(recapLabel);
  const recapPost = hostPage.waitForResponse(
    (resp) => resp.url().includes("/recaps") && resp.request().method() === "POST",
    { timeout: 30_000 }
  );
  await hostPage.locator("[data-recap-submit]").click();
  expect((await recapPost).ok()).toBeTruthy();
  await dismissModalIfOpen(hostPage);

  await hostPage.waitForFunction(
    (label) => (window.zhimuState?.cloudRecaps || []).some((row) => row.label === label),
    recapLabel,
    { timeout: 20_000 }
  );
  await expect(hostPage.locator("main")).toContainText(recapLabel, { timeout: 15_000 });

  await goToView(playerPage, "archive");
  await playerPage.locator('[data-action="refresh-cloud"]').click();
  await expect(playerPage.locator("main")).toContainText(/存档|复盘/, { timeout: 15_000 });

  await hostContext.close();
  await playerContext.close();
});
