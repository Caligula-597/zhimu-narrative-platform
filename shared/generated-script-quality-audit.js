/**
 * P10.0 Generated Script Quality Audit — read-only.
 * CreationSpec/fixture → PMD → Real Writer → Package → P9.4 Quality Gate → aggregate.
 * Does not mutate P9 contracts, does not auto-rewrite, does not expand mechanism library.
 */

import path from "node:path";
import {
  GEN_CASE_IDS,
  listCaseFixturePaths,
  loadCaseFixture,
  buildProjectStoryStateFromFixture,
} from "./p8-generalization-runner.js";
import { integrateMasterOutline } from "./master-outline-integrator.js";
import { expandProductionMasterDraft } from "./production-master-draft-expander.js";
import { buildProjectContextProfile } from "./project-context-profile.js";
import { buildGen05ContextProfile, buildGen05GameNarrativePlan } from "./game-narrative-gen05-fixture.js";
import { MockScriptWriterLlm } from "./script-writer-llm-port.js";
import { RealScriptWriter } from "./real-script-writer.js";
import { literaryMockFromMessages } from "./script-writer-mock-handlers.js";
import { runScriptProduction } from "./script-production-orchestrator.js";
import { evaluateContentQuality } from "./content-quality-gate.js";
import {
  CONTENT_QUALITY_DIMENSIONS,
  CONTENT_QUALITY_STATUSES,
} from "./content-quality-contracts.js";

export const GENERATED_SCRIPT_QUALITY_AUDIT_VERSION = 1;
export const P10_0_AUDIT_FOCUS = Object.freeze({
  "GEN-01": "推理公平性 / M01",
  "GEN-02": "古风 Context / 阵营",
  "GEN-03": "科幻世界专属性",
  "GEN-04": "无凶手群像 / 终局兑现",
  "GEN-05": "GAME 参与欲",
  "GEN-06": "情感 / 平行结构",
  "GEN-07": "高交织 / 角色负载",
  "GEN-08": "公共任务 / success-failure",
});

const FIXED_NOW = () => "2026-09-06T12:00:00.000Z";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

/** Map GEN case → Context profile inputs (data-driven tags; no architecture change). */
export function contextProfileForCase(fixture, { now = FIXED_NOW } = {}) {
  const caseId = fixture.caseId;
  const genre = String(fixture.premise?.genre || "");
  const tags = asArray(fixture.projectConfig?.genreTags).map(String);
  if (caseId === "GEN-05") return buildGen05ContextProfile({ now });
  if (caseId === "GEN-03") {
    return buildProjectContextProfile({
      creationSpec: { setting: { era: "SCI_FI" }, genreTags: ["科幻", "身份权限", ...tags] },
      premise: fixture.premise,
      preferredPresetId: "SCI_FI_FACILITY",
      now,
    });
  }
  if (caseId === "GEN-02" || caseId === "GEN-07") {
    return buildProjectContextProfile({
      creationSpec: { setting: { era: "ANCIENT" }, genreTags: ["古风", ...tags] },
      premise: fixture.premise,
      preferredPresetId: "ANCIENT_COURT",
      now,
    });
  }
  if (caseId === "GEN-04") {
    return buildProjectContextProfile({
      creationSpec: { setting: { era: "CONTEMPORARY" }, genreTags: ["校园", ...tags] },
      premise: fixture.premise,
      preferredPresetId: "CAMPUS_REALISTIC",
      now,
    });
  }
  if (caseId === "GEN-06") {
    return buildProjectContextProfile({
      creationSpec: { setting: { era: "CONTEMPORARY" }, genreTags: ["情感", "平行", ...tags] },
      premise: fixture.premise,
      explicitBindings: {
        core_object: { kind: "OBJECT", label: "两封没有寄出的信" },
      },
      now,
    });
  }
  // GEN-01 / GEN-08 default contemporary
  return buildProjectContextProfile({
    creationSpec: {
      setting: { era: "CONTEMPORARY" },
      genreTags: [genre, ...tags].filter(Boolean),
    },
    premise: fixture.premise,
    now,
  });
}

export function gameNarrativePlanForCase(fixture, contextProfile, pmd) {
  if (fixture.caseId !== "GEN-05") return null;
  if (!pmd?.stages?.length) return null;
  const plan = buildGen05GameNarrativePlan({ contextProfile });
  const stageIds = asArray(pmd.stages).map((s) => s.stageId);
  plan.bindings = asArray(plan.bindings).map((b, i) => ({
    ...b,
    stageId: stageIds[Math.min(i + 1, stageIds.length - 1)] || b.stageId,
  }));
  return plan;
}

export function extractStoryFamilies(fixture, pmd) {
  const fromPlan = asArray(fixture.storyPlan)
    .map((row) => String(row.templateId || "").split("-")[0])
    .filter(Boolean);
  const fromPmd = [];
  for (const st of asArray(pmd?.stages)) {
    for (const b of asArray(st.beats)) {
      if (b.familyId) fromPmd.push(String(b.familyId));
      else if (b.mechanismId) fromPmd.push(String(b.mechanismId).slice(0, 3));
    }
  }
  return [...new Set([...fromPlan, ...fromPmd])];
}

export function createAuditWriter({ now = FIXED_NOW, contextRevision = null, gameNarrativeRevision = null } = {}) {
  const llm = new MockScriptWriterLlm({
    handler: literaryMockFromMessages,
    modelId: "mock-literary-p10",
    adapterId: "literary-mock-v1",
  });
  return new RealScriptWriter({
    llm,
    now,
    contextRevision,
    gameNarrativeRevision,
    providerAdapterId: "literary-mock-v1",
    modelId: "mock-literary-p10",
  });
}

/**
 * Audit a single GEN case end-to-end (read-only).
 */
export async function auditGeneratedScriptCase(caseId, opts = {}) {
  const now = opts.now || FIXED_NOW;
  const file = listCaseFixturePaths().find((p) => path.basename(p).startsWith(caseId));
  if (!file) throw new Error(`missing fixture ${caseId}`);
  const fixture = loadCaseFixture(file);
  let state = buildProjectStoryStateFromFixture(fixture);
  state = integrateMasterOutline(state, { now });
  const pmd = expandProductionMasterDraft(state, {
    now,
    title: `${fixture.caseId} ${fixture.title}`,
  });
  const contextProfile = contextProfileForCase(fixture, { now });
  const gameNarrativePlan =
    opts.attachGameNarrative === false
      ? null
      : gameNarrativePlanForCase(fixture, contextProfile, pmd);
  const families = extractStoryFamilies(fixture, pmd);
  const genre = String(fixture.premise?.genre || fixture.projectConfig?.genreTags?.[0] || "未标注");

  const writer = opts.writer || createAuditWriter({
    now,
    contextRevision: contextProfile.revision,
    gameNarrativeRevision: gameNarrativePlan?.revision ?? null,
  });

  const production = await runScriptProduction({
    pmd,
    writer,
    projectId: `p10-audit-${caseId.toLowerCase()}`,
    now,
    contextProfile,
    gameNarrativePlan,
  });

  const productionGateStatus = production.gate?.status || "UNKNOWN";
  const productionBlocked = productionGateStatus === "BLOCKED";
  const productionBlockers = asArray(production.gate?.blockers).map((b) => ({
    type: b.type,
    message: b.message,
  }));

  let qualityReport = null;
  if (!productionBlocked && production.package) {
    qualityReport = await evaluateContentQuality({
      package: production.package,
      now,
      hardBlockerOptions: opts.hardBlockerOptions || {},
    });
  }

  return {
    caseId: fixture.caseId,
    title: fixture.title,
    auditFocus: P10_0_AUDIT_FOCUS[fixture.caseId] || "",
    genre,
    storyFamilies: families,
    contextPresetId: contextProfile.presetId,
    productionGateStatus,
    productionBlocked,
    productionBlockers,
    packageStatus: production.package?.status || null,
    writerAdapterId: "RealScriptWriter/literary-mock-v1",
    quality: qualityReport
      ? {
          status: qualityReport.status,
          totalScore: qualityReport.totalScore,
          hardBlockers: qualityReport.hardBlockers,
          dimensions: qualityReport.dimensions.map((d) => ({
            id: d.id,
            label: d.label,
            score: d.score,
            weightedScore: d.weightedScore,
            weaknesses: d.weaknesses,
          })),
          aiPatterns: qualityReport.aiPatterns.map((p) => ({
            type: p.type,
            count: p.count,
          })),
          topProblems: qualityReport.topProblems,
          revisionPriorities: qualityReport.revisionPriorities,
        }
      : null,
    notes: productionBlocked
      ? "Production Gate BLOCKED — 未进入 Real Writer 成品质量评分（诚实记录，不绕过 OWNER/结构阻断）。"
      : undefined,
  };
}

function emptyDimAvg() {
  return Object.fromEntries(CONTENT_QUALITY_DIMENSIONS.map((d) => [d.id, { sum: 0, n: 0, label: d.label }]));
}

/**
 * Aggregate per-case audit rows into P10.0 failure distribution.
 */
export function aggregateQualityAudit(caseRows = []) {
  const rows = asArray(caseRows);
  const scored = rows.filter((r) => r.quality && !r.productionBlocked);
  const dimAvg = emptyDimAvg();
  const statusCounts = Object.fromEntries(CONTENT_QUALITY_STATUSES.map((s) => [s, 0]));
  statusCounts.PRODUCTION_BLOCKED = 0;
  const bandCounts = {
    production_blocked: 0,
    quality_blocked: 0,
    below_65: 0,
    band_65_74: 0,
    band_75_79: 0,
    band_80_plus: 0,
  };
  const aiPatternHits = new Map();
  const hardBlockerHits = new Map();
  const productionBlockerHits = new Map();
  const genreBuckets = new Map();
  const familyBuckets = new Map();
  const weaknessHits = new Map();

  for (const row of rows) {
    if (row.productionBlocked) {
      bandCounts.production_blocked += 1;
      statusCounts.PRODUCTION_BLOCKED += 1;
      for (const b of asArray(row.productionBlockers)) {
        productionBlockerHits.set(b.type, (productionBlockerHits.get(b.type) || 0) + 1);
      }
      continue;
    }
    const q = row.quality;
    if (!q) continue;
    statusCounts[q.status] = (statusCounts[q.status] || 0) + 1;
    if (q.status === "QUALITY_BLOCKED") bandCounts.quality_blocked += 1;
    else if (q.totalScore < 65) bandCounts.below_65 += 1;
    else if (q.totalScore < 75) bandCounts.band_65_74 += 1;
    else if (q.totalScore < 80) bandCounts.band_75_79 += 1;
    else bandCounts.band_80_plus += 1;

    for (const d of asArray(q.dimensions)) {
      if (!dimAvg[d.id]) continue;
      dimAvg[d.id].sum += Number(d.score) || 0;
      dimAvg[d.id].n += 1;
      for (const w of asArray(d.weaknesses)) {
        weaknessHits.set(w, (weaknessHits.get(w) || 0) + 1);
      }
    }
    for (const p of asArray(q.aiPatterns)) {
      aiPatternHits.set(p.type, (aiPatternHits.get(p.type) || 0) + 1);
    }
    for (const b of asArray(q.hardBlockers)) {
      hardBlockerHits.set(b.type, (hardBlockerHits.get(b.type) || 0) + 1);
    }

    const g = row.genre || "未标注";
    if (!genreBuckets.has(g)) genreBuckets.set(g, { n: 0, scoreSum: 0, blocked: 0 });
    const gb = genreBuckets.get(g);
    gb.n += 1;
    gb.scoreSum += Number(q.totalScore) || 0;

    for (const fam of asArray(row.storyFamilies)) {
      if (!familyBuckets.has(fam)) familyBuckets.set(fam, { n: 0, scoreSum: 0, dimSums: emptyDimAvg() });
      const fb = familyBuckets.get(fam);
      fb.n += 1;
      fb.scoreSum += Number(q.totalScore) || 0;
      for (const d of asArray(q.dimensions)) {
        if (!fb.dimSums[d.id]) continue;
        fb.dimSums[d.id].sum += Number(d.score) || 0;
        fb.dimSums[d.id].n += 1;
      }
    }
  }

  const dimensionAverages = Object.fromEntries(
    Object.entries(dimAvg).map(([id, v]) => [
      id,
      { label: v.label, average: v.n ? round1(v.sum / v.n) : null, sampleSize: v.n },
    ]),
  );

  const topAiPatterns = [...aiPatternHits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([type, count]) => ({ type, count, ofScored: scored.length }));

  const topWeaknesses = [...weaknessHits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([text, count]) => ({ text, count }));

  const lowestDimensions = Object.entries(dimensionAverages)
    .filter(([, v]) => v.average != null)
    .sort((a, b) => a[1].average - b[1].average)
    .slice(0, 3)
    .map(([id, v]) => ({ id, label: v.label, average: v.average }));

  return {
    version: GENERATED_SCRIPT_QUALITY_AUDIT_VERSION,
    corpusSize: rows.length,
    scoredSize: scored.length,
    productionBlockedSize: rows.filter((r) => r.productionBlocked).length,
    bandCounts,
    statusCounts,
    dimensionAverages,
    lowestDimensions,
    topAiPatterns,
    topWeaknesses,
    productionBlockerHits: Object.fromEntries(productionBlockerHits),
    hardBlockerHits: Object.fromEntries(hardBlockerHits),
    byGenre: Object.fromEntries(
      [...genreBuckets.entries()].map(([genre, v]) => [
        genre,
        {
          sampleSize: v.n,
          averageTotal: v.n ? round1(v.scoreSum / v.n) : null,
        },
      ]),
    ),
    byStoryFamily: Object.fromEntries(
      [...familyBuckets.entries()].map(([fam, v]) => [
        fam,
        {
          sampleSize: v.n,
          averageTotal: v.n ? round1(v.scoreSum / v.n) : null,
          weakestDim: Object.entries(v.dimSums)
            .filter(([, x]) => x.n)
            .map(([id, x]) => ({ id, average: round1(x.sum / x.n) }))
            .sort((a, b) => a.average - b.average)[0] || null,
        },
      ]),
    ),
  };
}

export async function runGeneratedScriptQualityAudit(opts = {}) {
  const caseIds = asArray(opts.caseIds).length ? opts.caseIds : [...GEN_CASE_IDS];
  const cases = [];
  for (const caseId of caseIds) {
    cases.push(await auditGeneratedScriptCase(caseId, opts));
  }
  const aggregate = aggregateQualityAudit(cases);
  return {
    version: GENERATED_SCRIPT_QUALITY_AUDIT_VERSION,
    evaluatedAt: typeof opts.now === "function" ? opts.now() : FIXED_NOW(),
    writerMode: "RealScriptWriter + literary-mock-v1 (CI-stable generated path)",
    scope: "GEN-01..GEN-08 only; no GEN-09; no P9 contract changes",
    cases,
    aggregate,
  };
}

/** Render aggregate + cases as markdown body for docs/captures. */
export function formatQualityAuditMarkdown(audit) {
  const agg = audit.aggregate;
  const lines = [];
  lines.push("# P10.0 Generated Script Quality Audit Report");
  lines.push("");
  lines.push(`> evaluatedAt: \`${audit.evaluatedAt}\``);
  lines.push(`> writerMode: ${audit.writerMode}`);
  lines.push(`> scope: ${audit.scope}`);
  lines.push("");
  lines.push("## 时代位置");
  lines.push("");
  lines.push("```text");
  lines.push("P8 Infrastructure Era                ✅ CLOSED");
  lines.push("P9 Content Factory Foundation        ✅ CLOSED");
  lines.push("P10.0 Generated Script Quality Audit ← 本报告");
  lines.push("P10.1                                → 待本报告决定下一刀");
  lines.push("```");
  lines.push("");
  lines.push("## 先看结论（不是平均分）");
  lines.push("");
  lines.push("| 桶 | 数量 |");
  lines.push("|---|---:|");
  lines.push(`| Production Gate BLOCKED（未写成） | ${agg.bandCounts.production_blocked} |`);
  lines.push(`| QUALITY_BLOCKED | ${agg.bandCounts.quality_blocked} |`);
  lines.push(`| 总分 < 65 | ${agg.bandCounts.below_65} |`);
  lines.push(`| 65–74 | ${agg.bandCounts.band_65_74} |`);
  lines.push(`| 75–79 | ${agg.bandCounts.band_75_79} |`);
  lines.push(`| 80+ | ${agg.bandCounts.band_80_plus} |`);
  lines.push(`| 进入质量评分的样本 | ${agg.scoredSize} / ${agg.corpusSize} |`);
  lines.push("");

  if (agg.productionBlockedSize) {
    lines.push("### Production 阻断（内容工厂上游债）");
    lines.push("");
    lines.push("以下 case **从未进入 Real Writer 成品**，因此不算进七维平均——否则会把「写不好」和「写不出来」混在一起：");
    lines.push("");
    for (const c of audit.cases.filter((x) => x.productionBlocked)) {
      const types = asArray(c.productionBlockers).map((b) => b.type).join(", ");
      lines.push(`- **${c.caseId} ${c.title}** — ${types || c.productionGateStatus}`);
    }
    lines.push("");
    lines.push("Production blocker 频次：");
    lines.push("");
    for (const [type, n] of Object.entries(agg.productionBlockerHits)) {
      lines.push(`- \`${type}\` × ${n}`);
    }
    lines.push("");
  }

  lines.push("## Quality Failure Distribution（仅 scored 样本）");
  lines.push("");
  lines.push("| 维度 | 均分 (1–5) | n |");
  lines.push("|---|---:|---:|");
  for (const d of CONTENT_QUALITY_DIMENSIONS) {
    const row = agg.dimensionAverages[d.id];
    lines.push(`| ${d.id.replace(/^[A-Z]_/, "")} ${row.label} | ${row.average ?? "—"} | ${row.sampleSize} |`);
  }
  lines.push("");
  lines.push("最低三维：");
  agg.lowestDimensions.forEach((d, i) => {
    lines.push(`${i + 1}. **${d.label}** = ${d.average}`);
  });
  lines.push("");

  lines.push("## Top recurring problems");
  lines.push("");
  lines.push("### AI patterns");
  lines.push("");
  if (!agg.topAiPatterns.length) lines.push("- （无）");
  for (const p of agg.topAiPatterns) {
    lines.push(`- \`${p.type}\` — ${p.count}/${p.ofScored} scored`);
  }
  lines.push("");
  lines.push("### Dimension weaknesses");
  lines.push("");
  if (!agg.topWeaknesses.length) lines.push("- （无）");
  for (const w of agg.topWeaknesses.slice(0, 8)) {
    lines.push(`- ${w.text} — ${w.count}`);
  }
  lines.push("");

  lines.push("## By genre / story family");
  lines.push("");
  lines.push("### Genre（scored）");
  lines.push("");
  for (const [genre, v] of Object.entries(agg.byGenre)) {
    lines.push(`- **${genre}** — n=${v.sampleSize}, avgTotal=${v.averageTotal}`);
  }
  lines.push("");
  lines.push("### Story family（scored）");
  lines.push("");
  for (const [fam, v] of Object.entries(agg.byStoryFamily)) {
    const weak = v.weakestDim ? `${v.weakestDim.id}=${v.weakestDim.average}` : "—";
    lines.push(`- **${fam}** — n=${v.sampleSize}, avgTotal=${v.averageTotal}, weakest=${weak}`);
  }
  lines.push("");

  lines.push("## Per-case detail");
  lines.push("");
  lines.push("| Case | Focus | Gate | Quality | Total | 最低维 |");
  lines.push("|---|---|---|---|---:|---|");
  for (const c of audit.cases) {
    if (c.productionBlocked) {
      lines.push(`| ${c.caseId} | ${c.auditFocus} | BLOCKED | — | — | — |`);
      continue;
    }
    const dims = asArray(c.quality?.dimensions).slice().sort((a, b) => a.score - b.score);
    const low = dims[0] ? `${dims[0].id}=${dims[0].score}` : "—";
    lines.push(
      `| ${c.caseId} | ${c.auditFocus} | ${c.productionGateStatus} | ${c.quality?.status} | ${c.quality?.totalScore ?? "—"} | ${low} |`,
    );
  }
  lines.push("");

  lines.push("## 下一刀建议（不预锁 P10.1 名称）");
  lines.push("");
  const aAvg = agg.dimensionAverages.A_CHARACTER_AGENCY?.average;
  const eAvg = agg.dimensionAverages.E_AESTHETIC_VOICE?.average;
  let step = 1;
  if (agg.productionBlockedSize >= 4) {
    lines.push(
      `${step}. **主瓶颈是「写不出来」不是「写不好」**：${agg.productionBlockedSize}/8 因 \`${Object.keys(agg.productionBlockerHits).join("/")}\` 卡在 Production Gate。下一刀若只改 Writer/文风，对多数 GEN 零收益。优先清 OWNER/冲突债，扩大可评分样本。`,
    );
    step += 1;
  }
  if (agg.scoredSize > 0 && agg.lowestDimensions[0]) {
    lines.push(
      `${step}. **在已写出的 ${agg.scoredSize} 本上，最低维是 ${agg.lowestDimensions[0].label}（${agg.lowestDimensions[0].average}）**；A/B 相对 ${aAvg ?? "—"}/${agg.dimensionAverages.B_INFORMATION_FAIRNESS?.average ?? "—"}。`,
    );
    step += 1;
  }
  if (eAvg != null && eAvg <= 2.5) {
    lines.push(
      `${step}. **E 维偏低的解读需带 writerMode 注脚**：本报告使用 \`literary-mock-v1\`（CI 稳定渲染），会放大 SAME_VOICE / ABSTRACT_STAKES。在清完 Production 债、并有真实模型抽检之前，**不要把「开 Writer V2」当成唯一答案**；但 mock 路径已证明：当前渲染层尚未达到 QUALITY_PASS。`,
    );
    step += 1;
  } else if (agg.topAiPatterns[0]) {
    lines.push(
      `${step}. **最高频 AI pattern：\`${agg.topAiPatterns[0].type}\`（${agg.topAiPatterns[0].count}/${agg.topAiPatterns[0].ofScored}）**。`,
    );
  }
  lines.push("");
  lines.push("> 本报告只读。不自动重写、不改 P9 合同、不扩机制库。");
  lines.push("");
  return lines.join("\n");
}
