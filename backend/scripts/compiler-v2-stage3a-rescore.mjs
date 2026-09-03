#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreHostTrueTimeline } from "../src/compiler-v2/benchmarks/changsheng-host-true-gold.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(root, "captures", "compiler-v2-trial", "changsheng-stage3a-host-true");

const state = JSON.parse(await readFile(path.join(dir, "state.json"), "utf8"));
const report = JSON.parse(await readFile(path.join(dir, "report.json"), "utf8"));
const score = scoreHostTrueTimeline(state.timelineEvents, undefined, {
  sourceSections: state.sourceSections
});
report.score = score;
report.events = (state.timelineEvents || []).map((e) => ({
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
}));

const s = score;
const md = `# Compiler V2 Stage 3A：长生叹 Host TRUE Timeline

状态：**${report.status}** · ${report.elapsedMs}ms · chunks=${report.meta?.chunks} calls=${report.meta?.calls} consolidated=${report.meta?.consolidated}

## Five metrics (primary)

| Metric | Score |
|---|---|
| 1. 重大事件覆盖 | **${s.coverage.covered}/${s.coverage.total}** (${(s.coverage.rate * 100).toFixed(0)}%) |
| 2. 幻觉率（启发式） | **${s.hallucination.flagged}/${s.eventCount}** (${(s.hallucination.rate * 100).toFixed(0)}%) |
| 3. 微动作嫌疑（粒度） | **${s.granularity.microActionSuspects}**（结局碎片 ${s.granularity.endingSplinterSuspects}；目标约 15–35，实得 ${s.eventCount}） |
| 4. Gold 相对顺序 | **${s.order.pairRate == null ? "n/a" : (s.order.pairRate * 100).toFixed(0) + "%"}** |
| 5. SourceRefs 覆盖 | **${s.sourceRefs.withRefs}/${s.sourceRefs.total}** (${(s.sourceRefs.rate * 100).toFixed(0)}%) |

## Timeline events (${report.events.length})

\`\`\`json
${JSON.stringify(report.events, null, 2)}
\`\`\`

## Coverage detail

\`\`\`json
${JSON.stringify(s.coverage.detail, null, 2)}
\`\`\`
`;

await writeFile(path.join(dir, "report.json"), JSON.stringify(report, null, 2), "utf8");
await writeFile(path.join(dir, "REPORT.md"), md, "utf8");
console.log(
  `coverage=${s.coverage.covered}/${s.coverage.total} hallu=${s.hallucination.flagged} order=${s.order.pairRate} refs=${s.sourceRefs.withRefs}/${s.sourceRefs.total} n=${s.eventCount}`
);
for (const c of s.coverage.detail) {
  console.log(c.covered ? "OK" : "MISS", c.goldId, "→", c.matchedTitle || "");
}
