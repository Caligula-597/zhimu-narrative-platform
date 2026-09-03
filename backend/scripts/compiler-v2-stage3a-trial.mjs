#!/usr/bin/env node
/**
 * Stage 3A trial: 长生叹 HostHandbook → TRUE Timeline (+ 5-metric score).
 *
 * Usage (from repo root):
 *   node backend/scripts/compiler-v2-stage3a-trial.mjs
 *
 * Requires DEEPSEEK_API_KEY in backend/.env
 */
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createEmptyCompilerV2State } from "../src/compiler-v2/state.js";
import { runCompilerV2Pipeline } from "../src/compiler-v2/index.js";
import {
  CHANGSHENG_HOST_TRUE_GOLD,
  scoreHostTrueTimeline
} from "../src/compiler-v2/benchmarks/changsheng-host-true-gold.js";
import { deepseekConfig } from "../src/deepseek-config.js";

const require = createRequire(import.meta.url);
require("dotenv").config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const outDir = path.join(root, "captures", "compiler-v2-trial", "changsheng-stage3a-host-true");

async function loadChangshengOpeningPackage() {
  const dir = path.join(root, "data-zhimu", "changsheng-tan");
  const files = await readdir(dir);
  const txts = files.filter((f) => f.endsWith(".txt"));
  const byName = Object.fromEntries(
    await Promise.all(txts.map(async (f) => [f, await readFile(path.join(dir, f), "utf8")]))
  );
  const hostName = txts.find((f) => f.includes("主持"));
  if (!hostName) throw new Error("missing 主持人.txt");
  const roleFiles = txts.filter((f) => f !== hostName);
  return {
    rightsConfirmed: true,
    creationType: "murder_mystery",
    hostHandbook: { filename: hostName, text: byName[hostName] },
    // Include roles for Stage1 identity, but Stage 3A must ignore them
    roleScripts: roleFiles.map((f) => ({
      filename: f,
      characterName: f.replace(/\.txt$/i, ""),
      text: byName[f]
    })),
    clueTextFiles: [],
    notes: "Stage 3A trial — host TRUE timeline only"
  };
}

function toMarkdown(report) {
  const s = report.score;
  const lines = [
    `# Compiler V2 Stage 3A：长生叹 Host TRUE Timeline`,
    ``,
    `状态：**${report.status}** · ${report.elapsedMs}ms · model chunks=${report.meta?.chunks ?? "?"} calls=${report.meta?.calls ?? "?"}`,
    ``,
    `## Five metrics (primary)`,
    ``,
    `| Metric | Score |`,
    `|---|---|`,
    `| 1. 重大事件覆盖 | **${s.coverage.covered}/${s.coverage.total}** (${(s.coverage.rate * 100).toFixed(0)}%) |`,
    `| 2. 幻觉率（启发式） | **${s.hallucination.flagged}/${s.eventCount}** (${(s.hallucination.rate * 100).toFixed(0)}%) |`,
    `| 3. 微动作嫌疑（粒度） | **${s.granularity.microActionSuspects}**（结局碎片嫌疑 ${s.granularity.endingSplinterSuspects ?? 0}；目标约 15–35 条，实得 ${s.eventCount}） |`,
    `| 4. Gold 相对顺序 | **${s.order.pairRate == null ? "n/a" : (s.order.pairRate * 100).toFixed(0) + "%"}** |`,
    `| 5. SourceRefs 覆盖 | **${s.sourceRefs.withRefs}/${s.sourceRefs.total}** (${(s.sourceRefs.rate * 100).toFixed(0)}%) |`,
    ``,
    `## Project / Acts`,
    ``,
    "```json",
    JSON.stringify({ project: report.project, acts: report.acts }, null, 2),
    "```",
    ``,
    `## Timeline events (${report.events.length})`,
    ``,
    "```json",
    JSON.stringify(report.events, null, 2),
    "```",
    ``,
    `## Coverage detail`,
    ``,
    "```json",
    JSON.stringify(s.coverage.detail, null, 2),
    "```",
    ``,
    `## Hallucination flags`,
    ``,
    "```json",
    JSON.stringify(s.hallucination.detail, null, 2),
    "```",
    ``,
    `## Warnings / Unresolved`,
    ``,
    "```json",
    JSON.stringify({ warnings: report.warnings, unresolved: report.unresolved }, null, 2),
    "```",
    ``
  ];
  return lines.join("\n");
}

if (!deepseekConfig().configured) {
  console.error("DEEPSEEK_API_KEY not configured (backend/.env)");
  process.exit(1);
}

console.log("Loading Opening Package (长生叹)…");
const inputFiles = await loadChangshengOpeningPackage();
const started = Date.now();

const state = await runCompilerV2Pipeline(
  createEmptyCompilerV2State({ worldId: "trial_changsheng_stage3a", jobId: "stage3a" }),
  {
    inputFiles,
    toStage: "timeline_compiler",
    enableTimelineLlm: true
  }
);

const elapsedMs = Date.now() - started;
const events = state.timelineEvents || [];
const score = scoreHostTrueTimeline(events, CHANGSHENG_HOST_TRUE_GOLD, {
  sourceSections: state.sourceSections
});

const report = {
  label: "changsheng-stage3a-host-true",
  status: state.job?.status,
  elapsedMs,
  project: {
    title: state.project?.title,
    titleStatus: state.project?.titleStatus,
    playerCount: state.project?.playerCount,
    actCount: state.project?.actCount
  },
  acts: (state.acts || []).map((a) => a.title),
  meta: state.timelineMeta || null,
  events: events.map((e) => ({
    order: e.order,
    title: e.title,
    summary: e.summary,
    time: e.time,
    actId: e.actId,
    locationHint: e.locationHint,
    participantNames: e.participantNames,
    truthStatus: e.truthStatus,
    sourceSectionIds: e.sourceSectionIds,
    evidenceQuote: e.evidenceQuote
  })),
  score,
  warnings: state.warnings,
  unresolved: state.unresolved
};

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "state.json"), JSON.stringify(state, null, 2), "utf8");
await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
await writeFile(path.join(outDir, "REPORT.md"), toMarkdown(report), "utf8");

console.log(`\nDone in ${elapsedMs}ms → ${outDir}`);
console.log(
  `events=${events.length} coverage=${score.coverage.covered}/${score.coverage.total} hallu=${score.hallucination.flagged} refs=${score.sourceRefs.withRefs}/${score.sourceRefs.total} order=${score.order.pairRate}`
);
