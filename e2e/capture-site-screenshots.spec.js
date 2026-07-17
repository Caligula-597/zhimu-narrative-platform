/**
 * L2-06 · Capture real three-end screenshots for the marketing site.
 * Requires Playwright webServers (backend + main dist + play + host) — run via npm run capture:site-screenshots.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";
import {
  BASE_URL,
  dismissModalIfOpen,
  goToView,
  gotoHostConsole,
  injectHostAppContext,
  injectHostContext,
  injectVerifiedPlayContext,
  joinFixturePlayRoomViaUi,
  waitForCloudReady
} from "./helpers/fixture.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(root, "site", "public", "assets");
const VIEWPORT = { width: 1440, height: 900 };

test.describe.configure({ mode: "serial" });

test("capture creator, host, play, archive PNGs for site", async ({ browser }) => {
  mkdirSync(OUT_DIR, { recursive: true });

  const creatorCtx = await browser.newContext({ viewport: VIEWPORT, locale: "zh-CN" });
  await injectHostContext(creatorCtx);
  const creatorPage = await creatorCtx.newPage();
  await creatorPage.goto(BASE_URL);
  await waitForCloudReady(creatorPage);
  await dismissModalIfOpen(creatorPage);
  await goToView(creatorPage, "clues");
  await creatorPage.locator("[data-clue-flow-viewport]").waitFor({ state: "visible", timeout: 30_000 });
  await creatorPage.waitForTimeout(400);
  const creatorPath = path.join(OUT_DIR, "zhimu-screenshot-creator.png");
  await creatorPage.screenshot({ path: creatorPath, fullPage: false });
  await creatorCtx.close();

  const hostCtx = await browser.newContext({ viewport: VIEWPORT, locale: "zh-CN" });
  await injectHostAppContext(hostCtx);
  const hostPage = await hostCtx.newPage();
  await gotoHostConsole(hostPage);
  await hostPage.locator(".host-console-grid, .host-console").first().waitFor({ state: "visible", timeout: 30_000 });
  await hostPage.waitForTimeout(400);
  await hostPage.screenshot({ path: path.join(OUT_DIR, "zhimu-screenshot-host.png"), fullPage: false });
  await hostCtx.close();

  const playCtx = await browser.newContext({ viewport: VIEWPORT, locale: "zh-CN" });
  await injectVerifiedPlayContext(playCtx);
  const playPage = await playCtx.newPage();
  await joinFixturePlayRoomViaUi(playPage);
  await playPage.locator("[data-game-tab-bar]").waitFor({ state: "visible", timeout: 30_000 });
  await playPage.waitForTimeout(400);
  await playPage.screenshot({ path: path.join(OUT_DIR, "zhimu-screenshot-play.png"), fullPage: false });
  await playCtx.close();

  const archiveCtx = await browser.newContext({ viewport: VIEWPORT, locale: "zh-CN" });
  await injectHostContext(archiveCtx);
  const archivePage = await archiveCtx.newPage();
  await archivePage.goto(BASE_URL);
  await waitForCloudReady(archivePage);
  await dismissModalIfOpen(archivePage);
  await goToView(archivePage, "archive");
  await archivePage.locator("[data-action=\"create-recap\"], .checkpoint-list, .recap-card").first().waitFor({ state: "visible", timeout: 30_000 });
  await archivePage.waitForTimeout(400);
  await archivePage.screenshot({ path: path.join(OUT_DIR, "zhimu-screenshot-archive.png"), fullPage: false });
  await archiveCtx.close();

  copyFileSync(creatorPath, path.join(OUT_DIR, "zhimu-product-hero.png"));
});
