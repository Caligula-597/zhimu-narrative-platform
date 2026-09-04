/**
 * P5.2 Integrator Semantic Bridge — DEV A–E + sealed held-out F–H
 *
 * Run: node scripts/integrator-product-trial.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  acceptStoryBlock,
  createDemoProjectState,
  editStorySlot,
  generateStoryMechanism,
} from "../shared/story-mechanism-engine.js";
import { integrateMasterOutline, listAcceptedStoryBlocks } from "../shared/master-outline-integrator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../captures/integrator-product-trial-v1");
const HELD_OUT_DIR = path.join(__dirname, "../captures/integrator-product-trial-p52-heldout");

function acceptLast(state, templateId) {
  const block = [...state.mechanismBlocks].reverse().find((b) => b.templateId === templateId);
  if (!block) throw new Error(`missing ${templateId}`);
  return acceptStoryBlock(state, block.id);
}

function addAccepted(state, templateId, preferredVariantId, { intentionalOverlap = false } = {}) {
  const next = generateStoryMechanism({
    templateId,
    projectStoryState: state,
    preferredVariantId,
    intentionalOverlap,
  });
  return acceptLast(next, templateId);
}

function forceHighOverlap(state) {
  const m01 = state.mechanismBlocks.find((b) => b.templateId === "M01-FRAMING");
  const m07 = state.mechanismBlocks.find((b) => b.familyId === "M07");
  const m08 = state.mechanismBlocks.find((b) => b.familyId === "M08");
  const killer = m01?.roleBindings?.culprit?.id;
  if (!killer || !m07 || !m08) return state;
  let next = state;
  next = editStorySlot(next, m08.id, "factionLead", killer);
  next = editStorySlot(next, m07.id, "bearer", killer);
  return next;
}

/** DEV / regression — 可针对通用错误调，禁止 Case ID 特判 */
const DEV_CASES = [
  {
    id: "A-standard-mystery",
    set: "DEV",
    title: "Case A：标准推理",
    intent: "M01 追凶 + M07 身份 + M08 隐藏阵营 → 应出现共享行动/因果，而非仅同角",
    build() {
      let s = createDemoProjectState();
      s.projectId = "trial-A";
      s.revision = 3;
      s = addAccepted(s, "M01-FRAMING", "V02");
      s = addAccepted(s, "M07-5", "V01", { intentionalOverlap: true });
      s = addAccepted(s, "M08-2", "V01", { intentionalOverlap: true });
      return s;
    },
  },
  {
    id: "B-identity-heavy",
    set: "DEV",
    title: "Case B：身份为主",
    intent: "双 M07 + M08 → 身份确认应能因果衔接到改属",
    build() {
      let s = createDemoProjectState();
      s.projectId = "trial-B";
      s.revision = 3;
      s = addAccepted(s, "M07-1", "V01");
      s = addAccepted(s, "M07-5", "V03", { intentionalOverlap: true });
      s = addAccepted(s, "M08-4", "V01", { intentionalOverlap: true });
      return s;
    },
  },
  {
    id: "C-faction-ensemble",
    set: "DEV",
    title: "Case C：群像阵营",
    intent: "双 M08 + M07 → 人物目标应可读，不单是机制容器",
    build() {
      let s = createDemoProjectState();
      s.projectId = "trial-C";
      s.revision = 3;
      s = addAccepted(s, "M08-1", "V07");
      s = addAccepted(s, "M08-6", "V01", { intentionalOverlap: true });
      s = addAccepted(s, "M07-2", "V01", { intentionalOverlap: true });
      return s;
    },
  },
  {
    id: "D-high-weave-overlap",
    set: "DEV",
    title: "Case D：高交织 / 有意重叠",
    intent: "同一角色多重职责 → 冲突诚实 + 语义交织，禁止仅凭同角标 INTERWOVEN",
    build() {
      let s = createDemoProjectState();
      s.projectId = "trial-D";
      s.revision = 4;
      s = addAccepted(s, "M01-FRAMING", "V02");
      s = addAccepted(s, "M07-5", "V01", { intentionalOverlap: true });
      s = addAccepted(s, "M08-1", "V01", { intentionalOverlap: true });
      s = forceHighOverlap(s);
      return s;
    },
  },
  {
    id: "E-low-affinity",
    set: "DEV",
    title: "Case E：低相关积木",
    intent: "应诚实 KEEP_PARALLEL；同场/同角不得冒充真正交织",
    build() {
      let s = createDemoProjectState();
      s.projectId = "trial-E";
      s.revision = 2;
      s = addAccepted(s, "M08-1", "V04");
      s = addAccepted(s, "M07-2", "V02", { intentionalOverlap: false });
      return s;
    },
  },
];

/** Held-out — 算法冻结后一次性评估，不再调参 */
const HELD_OUT_CASES = [
  {
    id: "F-framing-open-faction",
    set: "HELD_OUT",
    title: "Case F：嫁祸 + 公开阵营",
    intent: "未见组合：M01 + M08-1 + M07-3",
    build() {
      let s = createDemoProjectState();
      s.projectId = "trial-F";
      s.revision = 3;
      s = addAccepted(s, "M01-FRAMING", "V01");
      s = addAccepted(s, "M08-1", "V02");
      s = addAccepted(s, "M07-3", "V01", { intentionalOverlap: true });
      return s;
    },
  },
  {
    id: "G-memory-probe-rival",
    set: "HELD_OUT",
    title: "Case G：记忆恢复 + 探测 + 对立营",
    intent: "未见组合：M07-4 + M07-8 + M08-8",
    build() {
      let s = createDemoProjectState();
      s.projectId = "trial-G";
      s.revision = 3;
      s = addAccepted(s, "M07-4", "V01");
      s = addAccepted(s, "M07-8", "V01", { intentionalOverlap: true });
      s = addAccepted(s, "M08-8", "V01", { intentionalOverlap: true });
      return s;
    },
  },
  {
    id: "H-conditional-public-task",
    set: "HELD_OUT",
    title: "Case H：条件开放 + 公共任务",
    intent: "未见组合：M07-2 + M08-7 + M01",
    build() {
      let s = createDemoProjectState();
      s.projectId = "trial-H";
      s.revision = 3;
      s = addAccepted(s, "M07-2", "V01");
      s = addAccepted(s, "M08-7", "V01", { intentionalOverlap: true });
      s = addAccepted(s, "M01-FRAMING", "V03", { intentionalOverlap: true });
      return s;
    },
  },
];

const INTERWOVEN_KINDS = new Set(["WEAVE_CAUSAL", "WEAVE_STRONG", "WEAVE_SHARED_ACTION"]);
const COLOCATED_KINDS = new Set(["WEAVE_SHARED_SCENE", "WEAVE_SHARED_CHARACTER", "WEAVE_WEAK"]);

function weaveQualityStats(draft) {
  const links = draft.weaveLinks || [];
  const active = links.filter((l) => l.status !== "SPLIT");
  const byKind = {};
  const byQuality = { INTERWOVEN: 0, COLOCATED: 0, PARALLEL: 0 };
  for (const l of active) {
    byKind[l.kind] = (byKind[l.kind] || 0) + 1;
    const q = l.relationQuality || (INTERWOVEN_KINDS.has(l.kind) ? "INTERWOVEN" : COLOCATED_KINDS.has(l.kind) ? "COLOCATED" : "PARALLEL");
    byQuality[q] = (byQuality[q] || 0) + 1;
  }

  const fakeInterwoven = active.filter(
    (l) =>
      l.relationQuality === "INTERWOVEN" &&
      (l.kind === "WEAVE_SHARED_SCENE" || l.kind === "WEAVE_SHARED_CHARACTER"),
  ).length;

  const stages = draft.stages || [];
  let multiFamilyStages = 0;
  let singleFamilyStages = 0;
  let emptyMiddle = 0;
  for (let i = 0; i < stages.length; i += 1) {
    const st = stages[i];
    const fams = new Set(st.beats.map((b) => b.familyId));
    if (fams.size >= 2) multiFamilyStages += 1;
    else if (fams.size === 1 && st.beats.length) singleFamilyStages += 1;
    if (i > 0 && i < stages.length - 1 && st.beats.length === 0) emptyMiddle += 1;
  }

  const beats = stages.flatMap((s) => s.beats);
  const goalDriven = beats.filter((b) => b.semantics?.goal && b.semantics?.action).length;

  return {
    byKind,
    byQuality,
    interwoven: byQuality.INTERWOVEN || 0,
    colocated: byQuality.COLOCATED || 0,
    parallel: byQuality.PARALLEL || 0,
    fakeInterwoven,
    emptyMiddle,
    goalDriven,
    multiFamilyStages,
    singleFamilyStages,
    stageCount: stages.length,
    beatCount: beats.length,
  };
}

function agencyHints(draft) {
  const summaries = draft.stages.flatMap((s) => s.beats.map((b) => b.summary || ""));
  const goalVerbs = /为了|企图|阻止|潜入|掩护|背叛|招募|洗清|隐瞒|追查|确认|寻找/;
  const passive = /被揭露|获得信息|发现线索|身份被|推进|阶段完成/;
  const goalDriven = summaries.filter((t) => goalVerbs.test(t)).length;
  const containerLike = summaries.filter((t) => passive.test(t) && !goalVerbs.test(t)).length;
  return { goalDriven, containerLike, sample: summaries.slice(0, 8) };
}

function renderCaseMarkdown(caseDef, state, draft, stats, agency) {
  const blocks = listAcceptedStoryBlocks(state);
  const lines = [];
  lines.push(`# ${caseDef.title}`);
  lines.push("");
  lines.push(`> ${caseDef.intent}`);
  lines.push("");
  lines.push(`- Case id: \`${caseDef.id}\` · set: **${caseDef.set}**`);
  lines.push(`- sourceStoryStateRevision: ${draft.sourceStoryStateRevision}`);
  lines.push(`- accepted blocks: ${blocks.map((b) => `${b.templateId}(${b.title})`).join(" · ")}`);
  lines.push("");
  lines.push("## 程序指标（P5.2）");
  lines.push("");
  lines.push("| 项 | 值 |");
  lines.push("|---|---|");
  lines.push(`| stages | ${stats.stageCount} |`);
  lines.push(`| beats | ${stats.beatCount} |`);
  lines.push(`| empty middle stages | ${stats.emptyMiddle} |`);
  lines.push(`| INTERWOVEN (relationQuality) | ${stats.interwoven} |`);
  lines.push(`| COLOCATED | ${stats.colocated} |`);
  lines.push(`| PARALLEL / KEEP_PARALLEL | ${stats.parallel} |`);
  lines.push(`| fake INTERWOVEN (scene/char only) | ${stats.fakeInterwoven} |`);
  lines.push(`| goal-driven beats | ${stats.goalDriven} |`);
  lines.push(`| 跨家族同阶段 | ${stats.multiFamilyStages} |`);
  lines.push(`| weave by kind | ${JSON.stringify(stats.byKind)} |`);
  lines.push(`| conflictReport | ${draft.conflictReport.length} |`);
  lines.push(`| 目标驱动措辞 hits | ${agency.goalDriven} |`);
  lines.push("");
  lines.push("## 阶段骨架");
  lines.push("");
  for (const st of draft.stages) {
    lines.push(`### ${st.label} (\`${st.id}\`)`);
    lines.push("");
    if (!st.beats.length) {
      lines.push("_（空）_");
      lines.push("");
      continue;
    }
    const fams = [...new Set(st.beats.map((b) => b.familyId))];
    lines.push(`家族覆盖：${fams.join(", ")}${fams.length >= 2 ? " · 跨家族" : ""}`);
    lines.push("");
    for (const b of st.beats) {
      const chars = (b.characterIds || []).join("/") || "—";
      const woven = b.weaveGroupId ? " · 交织组" : "";
      const sem =
        b.semantics?.goal && b.semantics?.action
          ? ` · goal=${b.semantics.goal} / action=${b.semantics.action}`
          : "";
      lines.push(`- **[${b.familyId}] ${b.blockTitle}** — ${b.summary}`);
      lines.push(`  - chars: ${chars}${woven} · band=${b.phaseBand}${sem}`);
    }
    lines.push("");
  }
  lines.push("## 交织边（含 relationQuality + WHY）");
  lines.push("");
  for (const l of draft.weaveLinks.filter((x) => x.status !== "SPLIT").slice(0, 24)) {
    lines.push(`- **[${l.relationQuality || "?"}] ${l.kind}** — ${l.reason}`);
  }
  if (!draft.weaveLinks.length) lines.push("_无_");
  lines.push("");
  lines.push("## 冲突报告");
  lines.push("");
  if (!draft.conflictReport.length) lines.push("_无冲突项_");
  for (const c of draft.conflictReport) {
    lines.push(`- ⚠ [${c.type}/${c.severity}] ${c.summary}`);
  }
  lines.push("");
  lines.push("## 人工评分表");
  lines.push("");
  lines.push("| 指标 | 1–5 | 笔记 |");
  lines.push("|---|---:|---|");
  lines.push("| Whole-story clarity |  |  |");
  lines.push("| Weave quality (INTERWOVEN≠COLOCATED) |  |  |");
  lines.push("| Character agency |  |  |");
  lines.push("| Stage rhythm |  |  |");
  lines.push("| Conflict honesty |  |  |");
  lines.push("| Editability |  |  |");
  lines.push("");
  return lines.join("\n");
}

function runSet(cases, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const index = [];
  const results = [];
  for (const caseDef of cases) {
    try {
      const state = caseDef.build();
      const next = integrateMasterOutline(state);
      const draft = next.masterOutlineDraft;
      const stats = weaveQualityStats(draft);
      const agency = agencyHints(draft);
      fs.writeFileSync(path.join(outDir, `${caseDef.id}.md`), renderCaseMarkdown(caseDef, next, draft, stats, agency), "utf8");
      fs.writeFileSync(
        path.join(outDir, `${caseDef.id}.json`),
        JSON.stringify(
          {
            case: { id: caseDef.id, title: caseDef.title, intent: caseDef.intent, set: caseDef.set },
            stats,
            agency,
            draft,
            blocks: listAcceptedStoryBlocks(next).map((b) => ({
              id: b.id,
              templateId: b.templateId,
              title: b.title,
              familyId: b.familyId,
              roleBindings: b.roleBindings,
            })),
          },
          null,
          2,
        ),
        "utf8",
      );
      results.push({ id: caseDef.id, set: caseDef.set, stats, agency, conflictCount: draft.conflictReport.length, ok: true });
      index.push(
        `| ${caseDef.id} | ${stats.interwoven} | ${stats.colocated} | ${stats.parallel} | ${stats.emptyMiddle} | ${stats.fakeInterwoven} | ${stats.goalDriven} | ${draft.conflictReport.length} |`,
      );
      console.log(
        caseDef.set,
        caseDef.id,
        "IW",
        stats.interwoven,
        "COL",
        stats.colocated,
        "PAR",
        stats.parallel,
        "emptyMid",
        stats.emptyMiddle,
        "goalBeats",
        stats.goalDriven,
      );
    } catch (err) {
      console.error("FAIL", caseDef.id, err.code || err.message);
      results.push({ id: caseDef.id, set: caseDef.set, ok: false, error: err.message, code: err.code });
      index.push(`| ${caseDef.id} | FAIL | — | — | — | — | — | — |`);
    }
  }
  return { index, results };
}

function gateDev(results) {
  const checks = [];
  const ok = results.filter((r) => r.ok);
  for (const r of ok) {
    checks.push({
      id: r.id,
      emptyMiddle: r.stats.emptyMiddle === 0,
      fakeInterwoven: r.stats.fakeInterwoven === 0,
      goalDriven: r.stats.goalDriven >= 2,
      keepParallelIfE: r.id !== "E-low-affinity" || r.stats.parallel >= 1,
    });
  }
  const e = ok.find((r) => r.id === "E-low-affinity");
  return {
    emptyMiddleAllZero: ok.every((r) => r.stats.emptyMiddle === 0),
    fakeInterwovenAllZero: ok.every((r) => r.stats.fakeInterwoven === 0),
    goalDrivenMin2: ok.every((r) => r.stats.goalDriven >= 2),
    caseEHasKeepParallel: Boolean(e && e.stats.parallel >= 1),
    perCase: checks,
  };
}

function main() {
  const dev = runSet(DEV_CASES, OUT_DIR);
  const held = runSet(HELD_OUT_CASES, HELD_OUT_DIR);
  const gates = gateDev(dev.results);

  const scorecard = [
    "# P5.2 Integrator Semantic Bridge — SCORECARD",
    "",
    "> A–E = DEV/regression（可调通用逻辑）。F–H = held-out（冻结后一次跑）。",
    "",
    "## 程序 Gate（DEV A–E）",
    "",
    `| 检查 | 结果 |`,
    `|---|---|`,
    `| 中间空幕 = 0 | ${gates.emptyMiddleAllZero ? "PASS" : "FAIL"} |`,
    `| INTERWOVEN 不得仅由 shared scene/char 支撑 | ${gates.fakeInterwovenAllZero ? "PASS" : "FAIL"} |`,
    `| 每案 ≥2 goal-driven beats | ${gates.goalDrivenMin2 ? "PASS" : "FAIL"} |`,
    `| Case E 出现 KEEP_PARALLEL | ${gates.caseEHasKeepParallel ? "PASS" : "FAIL"} |`,
    "",
    "人工均分门槛：DEV ≥ 3.5；Held-out F–H ≥ 3.3（conflict honesty / editability ≥ 3）。",
    "",
    "## DEV A–E",
    "",
    "| id | INTERWOVEN | COLOCATED | PARALLEL | emptyMid | fakeIW | goalBeats | conflicts |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...dev.index,
    "",
    "## Held-out F–H",
    "",
    "| id | INTERWOVEN | COLOCATED | PARALLEL | emptyMid | fakeIW | goalBeats | conflicts |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...held.index,
    "",
    `生成时间：${new Date().toISOString()}`,
    "",
  ].join("\n");

  fs.writeFileSync(path.join(OUT_DIR, "SCORECARD.md"), scorecard, "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "README.md"), [
    "# Integrator Product Trial — P5.2",
    "",
    "- DEV A–E → `captures/integrator-product-trial-v1/`",
    "- Held-out F–H → `captures/integrator-product-trial-p52-heldout/`",
    "",
    "RelationQuality：`INTERWOVEN` ← CAUSAL/STRONG/SHARED_ACTION；`COLOCATED` ← SHARED_SCENE/CHARACTER；`PARALLEL` ← KEEP_PARALLEL。",
    "",
  ].join("\n"), "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "_summary.json"), JSON.stringify({ gates, dev: dev.results, held: held.results }, null, 2), "utf8");
  fs.writeFileSync(path.join(HELD_OUT_DIR, "SCORECARD.md"), scorecard, "utf8");
  console.log("gates", gates);
  console.log("wrote", OUT_DIR, "and", HELD_OUT_DIR);
}

main();
