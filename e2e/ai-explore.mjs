#!/usr/bin/env node
/**
 * AI / 启发式 UI 探索 — 模拟真人玩家在浏览器里操作织幕。
 *
 * 默认：目标驱动启发式（无需 API Key，适合本地反复跑）
 * 可选：--llm 使用 OpenAI 兼容接口做下一步决策（需 OPENAI_API_KEY 或 ZHIMU_E2E_LLM_API_KEY）
 *
 * Usage:
 *   node e2e/ai-explore.mjs                    # 启发式玩家，最多 40 步
 *   node e2e/ai-explore.mjs --llm --max 25     # LLM 驱动
 *   node e2e/ai-explore.mjs --headed           # 有界面观察
 *
 * 需 backend :4180 + frontend :4173 已启动（或 PLAYWRIGHT_SKIP_WEBSERVER 未设时由 playwright 拉起）。
 */
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASE_URL, E2E, dismissModalIfOpen, goToView, injectPlayerPreJoinContext, joinRoomViaInviteUi, waitForCloudReady } from "./helpers/demo.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const useLlm = args.has("--llm");
const headed = args.has("--headed");
const maxIdx = process.argv.indexOf("--max");
const maxSteps = maxIdx >= 0 ? Number(process.argv[maxIdx + 1]) || 40 : 40;

/** @typedef {{ label: string, selector: string, priority: number }} Candidate */

const GOALS = [
  { id: "player_view", test: async (page) => page.locator('[data-view="player"].active').isVisible() },
  { id: "read_section", test: async (page) => !(await page.locator('[data-action="read-cloud-next"]:not([disabled])').isVisible().catch(() => false)) },
  { id: "investigate", test: async (page) => !(await page.locator('[data-action="investigate-cloud"]:not([disabled])').isVisible().catch(() => false)) },
  { id: "archive", test: async (page) => /复盘|存档/.test(await page.locator("main").innerText().catch(() => "")) }
];

async function pageSnapshot(page) {
  return page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button:not([disabled]), [role=button]:not([disabled])")]
      .filter((el) => el.offsetParent !== null)
      .slice(0, 40)
      .map((el) => ({
        text: (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 80),
        action: el.dataset?.action || "",
        view: el.dataset?.view || ""
      }));
    const view = window.zhimuState?.view || "";
    const title = document.querySelector("#page-title")?.textContent || "";
    return { view, title, buttons, url: location.href };
  });
}

/** Heuristic: prefer player-progress actions like a curious player. */
async function heuristicPick(page) {
  /** @type {Candidate[]} */
  const candidates = [];

  const push = (label, selector, priority) => candidates.push({ label, selector, priority });

  if (await page.locator("#modal-backdrop.show").isVisible().catch(() => false)) {
    push("关闭弹窗", "#modal .primary-btn, #modal [data-close]", 100);
  } else {
    push("读完章节", '[data-action="read-cloud-next"]:not([disabled])', 90);
    push("调查探索点", '[data-action="investigate-cloud"]:not([disabled])', 85);
    push("标记重点", '[data-action="add-cloud-note"]', 50);
    push("玩家视角", '[data-view="player"]', 40);
    push("存档复盘", '[data-view="archive"]', 30);
    push("玩家入口", "#preview-btn", 35);
    push("打开笔记本", '[data-action="notebook"]', 20);
  }

  candidates.sort((a, b) => b.priority - a.priority);
  for (const item of candidates) {
    const loc = page.locator(item.selector).first();
    if (await loc.isVisible().catch(() => false)) return item;
  }
  return null;
}

async function llmPick(snapshot, goalHint) {
  const apiKey = process.env.ZHIMU_E2E_LLM_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = process.env.ZHIMU_E2E_LLM_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.ZHIMU_E2E_LLM_MODEL || "gpt-4o-mini";
  if (!apiKey) throw new Error("--llm 需要 OPENAI_API_KEY 或 ZHIMU_E2E_LLM_API_KEY");

  const prompt = `你是织幕互动叙事游戏的真人玩家。当前页面：${JSON.stringify(snapshot, null, 2)}
目标进度：${goalHint}
从 buttons 里选一个最像真人玩家会点的（返回 JSON：{"buttonText":"精确按钮文字"}）。只返回 JSON。`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    })
  });
  if (!response.ok) throw new Error(`LLM ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const raw = payload.choices?.[0]?.message?.content || "{}";
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw);
  return parsed.buttonText || parsed.text || "";
}

async function goalStatus(page) {
  const done = [];
  for (const goal of GOALS) {
    if (await goal.test(page)) done.push(goal.id);
  }
  return done;
}

function prepareE2eRoom() {
  const backend = path.join(root, "backend");
  for (const script of ["bootstrap-e2e-room.mjs", "reset-e2e-room.mjs"]) {
    const result = spawnSync(process.execPath, [path.join("scripts", script)], {
      cwd: backend,
      stdio: "inherit",
      env: process.env
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

async function main() {
  console.log(`织幕 AI 探索 · 副本房 ${E2E.inviteCode} · mode=${useLlm ? "llm" : "heuristic"} · max=${maxSteps}\n`);
  prepareE2eRoom();

  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({ baseURL: BASE_URL, locale: "zh-CN" });
  await injectPlayerPreJoinContext(context);
  const page = await context.newPage();

  await page.goto("/");
  await waitForCloudReady(page);
  await joinRoomViaInviteUi(page, E2E.inviteCode);

  const log = [];
  for (let step = 1; step <= maxSteps; step += 1) {
    const goals = await goalStatus(page);
    const snap = await pageSnapshot(page);
    console.log(`[${step}] view=${snap.view} title=${snap.title} goals=[${goals.join(",")}]`);

    if (goals.length === GOALS.length) {
      console.log("\n✓ 探索目标全部达成");
      break;
    }

    let action = null;
    if (useLlm) {
      const text = await llmPick(snap, goals.join(" → ") || "进入玩家视角并完成阅读与探索");
      action = text ? { label: `llm:${text}`, selector: `button:has-text("${text}")` } : null;
    } else {
      action = await heuristicPick(page);
    }

    if (!action) {
      console.warn("  无可点击元素，结束");
      break;
    }

    console.log(`  → ${action.label}`);
    log.push({ step, action: action.label, view: snap.view });

    await page.locator(action.selector).first().click({ timeout: 10_000 }).catch(async (err) => {
      console.warn(`  点击失败: ${err.message}`);
    });
    await page.waitForTimeout(800);
    await dismissModalIfOpen(page);
  }

  console.log("\n探索日志:", JSON.stringify(log, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
