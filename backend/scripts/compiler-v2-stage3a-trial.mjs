#!/usr/bin/env node
/**
 * Stage 3A V2 trial: 长生叹 HostHandbook → Stateful Host TRUE Timeline.
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
  scoreHostTrueTimelineV2
} from "../src/compiler-v2/benchmarks/changsheng-host-true-gold.js";
import { deepseekConfig } from "../src/deepseek-config.js";

const require = createRequire(import.meta.url);
require("dotenv").config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const outDir = path.join(root, "captures", "compiler-v2-trial", "changsheng-stage3a-v2-stateful");

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
    roleScripts: roleFiles.map((f) => ({
      filename: f,
      characterName: f.replace(/\.txt$/i, ""),
      text: byName[f]
    })),
    clueTextFiles: [],
    notes: "Stage 3A V2 trial — stateful host TRUE timeline only"
  };
}

function toMarkdown(report) {
  const s = report.score;
  const v2 = s.v2 || {};
  const lines = [
    `# Compiler V2 Stage 3A V2：长生叹 Host TRUE Timeline (Stateful)`,
    ``,
    `状态：**${report.status}** · ${report.elapsedMs}ms · calls=${report.meta?.calls ?? "?"}`,
    ``,
    `## Counts`,
    ``,
    `| Layer | Count |`,
    `|---|---|`,
    `| Candidates | **${v2.candidateCount ?? "?"}** |`,
    `| Canonical | **${v2.canonicalEventCount ?? "?"}** |`,
    `| Display Groups | **${v2.displayGroupCount ?? "?"}** |`,
    ``,
    `## V2 scorecard`,
    ``,
    `| Metric | Score | Target |`,
    `|---|---|---|`,
    `| Major Gold Recall | **${s.coverage.covered}/${s.coverage.total}** (${(s.coverage.rate * 100).toFixed(0)}%) | ≥13/14 |`,
    `| Hallucination | **${s.hallucination.flagged}** | 0 |`,
    `| SourceRef coverage | **${s.sourceRefs.withRefs}/${s.sourceRefs.total}** (${(s.sourceRefs.rate * 100).toFixed(0)}%) | 100% |`,
    `| SourceDisposition coverage | **${v2.sourceDispositionCoverage?.covered}/${v2.sourceDispositionCoverage?.total}** (${((v2.sourceDispositionCoverage?.rate || 0) * 100).toFixed(0)}%) | 100% |`,
    `| Silent candidate loss | **${v2.silentCandidateLoss ?? "?"}** | 0 |`,
    `| Gold temporal consistency | **${s.order.pairRate == null ? "n/a" : (s.order.pairRate * 100).toFixed(0) + "%"}** | ≥90% |`,
    `| Canonical→Display preservation | **${((v2.canonicalDisplayPreservation?.rate || 0) * 100).toFixed(0)}%** | 100% |`,
    `| Sourceless events | **${v2.sourcelessEvents ?? 0}** | 0 |`,
    ``,
    `## Project / Acts`,
    ``,
    "```json",
    JSON.stringify({ project: report.project, acts: report.acts }, null, 2),
    "```",
    ``,
    `## Canonical events (${report.events.length})`,
    ``,
    "```json",
    JSON.stringify(report.events, null, 2),
    "```",
    ``,
    `## Display groups (${report.displayGroups?.length || 0})`,
    ``,
    "```json",
    JSON.stringify(report.displayGroups || [], null, 2),
    "```",
    ``,
    `## Coverage detail`,
    ``,
    "```json",
    JSON.stringify(s.coverage.detail, null, 2),
    "```",
    ``,
    `## Meta`,
    ``,
    "```json",
    JSON.stringify(report.meta, null, 2),
    "```",
    ``
  ];
  return lines.join("\n");
}

if (!deepseekConfig().configured) {
  console.error("DEEPSEEK_API_KEY not configured (backend/.env)");
  process.exit(1);
}

console.log("Loading Opening Package (长生叹)… Stage 3A V2 Stateful Reader");
const inputFiles = await loadChangshengOpeningPackage();
const started = Date.now();

const state = await runCompilerV2Pipeline(
  createEmptyCompilerV2State({ worldId: "trial_changsheng_stage3a_v2", jobId: "stage3a_v2" }),
  {
    inputFiles,
    toStage: "timeline_compiler",
    enableTimelineLlm: true
  }
);

const elapsedMs = Date.now() - started;
const events = state.timelineEvents || [];
const host = (state.documents || []).find((d) => d.kind === "HOST_BOOK");
const hostSectionIds = (state.sourceSections || [])
  .filter((s) => s.documentId === host?.id)
  .map((s) => s.id);

const score = scoreHostTrueTimelineV2({
  candidates: state.eventCandidates || [],
  canonicalEvents: events,
  displayGroups: state.timelineDisplayGroups || [],
  sourceDispositions: state.sourceDispositions || [],
  candidateDispositions: state.candidateDispositions || [],
  hostSectionIds,
  gold: CHANGSHENG_HOST_TRUE_GOLD,
  sourceSections: state.sourceSections
});

const report = {
  label: "changsheng-stage3a-v2-stateful",
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
    stageId: e.stageId,
    locationHint: e.locationHint,
    participantNames: e.participantNames || e.participants,
    importance: e.importance,
    truthStatus: e.truthStatus,
    sourceSectionIds: e.sourceSectionIds,
    evidenceQuote: e.evidenceQuote
  })),
  displayGroups: state.timelineDisplayGroups || [],
  score,
  warnings: state.warnings,
  unresolved: state.unresolved
};

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "state.json"), JSON.stringify(state, null, 2), "utf8");
await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
await writeFile(path.join(outDir, "REPORT.md"), toMarkdown(report), "utf8");

const v2 = score.v2;
console.log(`\nDone in ${elapsedMs}ms → ${outDir}`);
console.log(
  `Candidates: ${v2.candidateCount} | Canonical: ${v2.canonicalEventCount} | Display Groups: ${v2.displayGroupCount}`
);
console.log(
  `recall=${score.coverage.covered}/${score.coverage.total} hallu=${score.hallucination.flagged} refs=${score.sourceRefs.rate} disp=${v2.sourceDispositionCoverage.rate} silent=${v2.silentCandidateLoss} order=${score.order.pairRate}`
);
