/**
 * P5.1 Integrator Product Trial — seed 5 cases, run weave, emit readable reports.
 * No algorithm changes: evaluate product quality of MasterOutlineDraft.
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

function acceptLast(state, templateId) {
  const block = [...state.mechanismBlocks].reverse().find((b) => b.templateId === templateId);
  if (!block) throw new Error(`missing ${templateId}`);
  return acceptStoryBlock(state, block.id);
}

function addAccepted(state, templateId, preferredVariantId, { intentionalOverlap = false } = {}) {
  let next = generateStoryMechanism({
    templateId,
    projectStoryState: state,
    preferredVariantId,
    intentionalOverlap,
  });
  return acceptLast(next, templateId);
}

/** Case D: force shared character across M01 culprit / M08 lead / M07 bearer */
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

const CASES = [
  {
    id: "A-standard-mystery",
    title: "Case A：标准推理",
    intent: "M01 追凶 + M07 身份 + M08 隐藏阵营 → 应共享行动/线索，而非三条并排",
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
    title: "Case B：身份为主",
    intent: "双 M07 + M08 → 警惕「异常→揭示」机械流水线",
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
    title: "Case C：群像阵营",
    intent: "双 M08 + M07 → 多角色负载与阵营是否爆炸",
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
    title: "Case D：高交织 / 有意重叠",
    intent: "同一角色 = 真凶 + 阵营领袖 + 身份承担者 → 复杂人物还是负载爆表",
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
    title: "Case E：低相关积木",
    intent: "应诚实 KEEP_PARALLEL，禁止为「织」而强缝",
    build() {
      let s = createDemoProjectState();
      s.projectId = "trial-E";
      s.revision = 2;
      // 公开阵营 + 条件触发开放：接口弱相关
      s = addAccepted(s, "M08-1", "V04");
      s = addAccepted(s, "M07-2", "V02", { intentionalOverlap: true });
      return s;
    },
  },
];

function weaveQualityStats(draft) {
  const links = draft.weaveLinks || [];
  const active = links.filter((l) => l.status !== "SPLIT");
  const byKind = {};
  for (const l of active) {
    byKind[l.kind] = (byKind[l.kind] || 0) + 1;
  }
  const interwoven = active.filter((l) =>
    ["WEAVE_STRONG", "WEAVE_SHARED_SCENE", "WEAVE_CAUSAL"].includes(l.kind),
  ).length;
  const colocatedOnly = active.filter((l) => l.kind === "WEAVE_WEAK").length;
  const parallel = active.filter((l) => l.kind === "KEEP_PARALLEL").length;
  const sharedChar = active.filter((l) => l.kind === "WEAVE_SHARED_CHARACTER").length;

  const stages = draft.stages || [];
  let multiFamilyStages = 0;
  let singleFamilyStages = 0;
  for (const st of stages) {
    const fams = new Set(st.beats.map((b) => b.familyId));
    if (fams.size >= 2) multiFamilyStages += 1;
    else if (fams.size === 1 && st.beats.length) singleFamilyStages += 1;
  }

  return {
    byKind,
    interwoven,
    colocatedOnly,
    parallel,
    sharedChar,
    multiFamilyStages,
    singleFamilyStages,
    stageCount: stages.length,
    beatCount: stages.reduce((n, s) => n + s.beats.length, 0),
  };
}

function agencyHints(draft) {
  // Heuristic flags for human review — not auto-pass
  const summaries = draft.stages.flatMap((s) => s.beats.map((b) => b.summary || ""));
  const goalVerbs = /为了|企图|阻止|潜入|掩护|背叛|招募|洗清|隐瞒|追查/;
  const passive = /被揭露|获得信息|发现线索|身份被|推进/;
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
  lines.push(`- Case id: \`${caseDef.id}\``);
  lines.push(`- sourceStoryStateRevision: ${draft.sourceStoryStateRevision}`);
  lines.push(`- accepted blocks: ${blocks.map((b) => `${b.templateId}(${b.title})`).join(" · ")}`);
  lines.push("");
  lines.push("## 自动结构统计（非人工分）");
  lines.push("");
  lines.push("| 项 | 值 |");
  lines.push("|---|---|");
  lines.push(`| stages | ${stats.stageCount} |`);
  lines.push(`| beats | ${stats.beatCount} |`);
  lines.push(`| 跨家族同阶段 (COLOCATED 候选) | ${stats.multiFamilyStages} |`);
  lines.push(`| 单家族阶段 | ${stats.singleFamilyStages} |`);
  lines.push(`| INTERWOVEN 边 (STRONG/SHARED_SCENE/CAUSAL) | ${stats.interwoven} |`);
  lines.push(`| SHARED_CHARACTER | ${stats.sharedChar} |`);
  lines.push(`| WEAVE_WEAK (同阶段弱连) | ${stats.colocatedOnly} |`);
  lines.push(`| KEEP_PARALLEL | ${stats.parallel} |`);
  lines.push(`| weave by kind | ${JSON.stringify(stats.byKind)} |`);
  lines.push(`| conflictReport | ${draft.conflictReport.length} |`);
  lines.push(`| 目标驱动措辞 hits | ${agency.goalDriven} |`);
  lines.push(`| 容器式措辞 hits | ${agency.containerLike} |`);
  lines.push("");
  lines.push("## 阶段骨架（人工审阅主视图）");
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
    lines.push(`家族覆盖：${fams.join(", ")}${fams.length >= 2 ? " · **COLOCATED**" : ""}`);
    lines.push("");
    for (const b of st.beats) {
      const chars = (b.characterIds || []).join("/") || "—";
      const woven = b.weaveGroupId ? " · 同场组" : "";
      lines.push(`- **[${b.familyId}] ${b.blockTitle}** — ${b.summary}`);
      lines.push(`  - chars: ${chars}${woven} · band=${b.phaseBand} · stageKey=${b.stageKey || "—"}`);
    }
    lines.push("");
  }
  lines.push("## 交织边");
  lines.push("");
  for (const l of draft.weaveLinks.filter((x) => x.status !== "SPLIT").slice(0, 20)) {
    lines.push(`- **${l.kind}** — ${l.reason}`);
    if (l.sharedCharacterIds?.length) lines.push(`  - shared: ${l.sharedCharacterIds.join(", ")}`);
  }
  if (!draft.weaveLinks.length) lines.push("_无_");
  lines.push("");
  lines.push("## 冲突报告");
  lines.push("");
  if (!draft.conflictReport.length) lines.push("_无冲突项_");
  for (const c of draft.conflictReport) {
    lines.push(`- ⚠ [${c.type}/${c.severity}] ${c.summary}`);
    lines.push(`  - 建议：${(c.suggestions || []).map((s) => s.label).join(" / ")}`);
  }
  lines.push("");
  lines.push("## 角色负载 Top");
  lines.push("");
  for (const r of (draft.characterLoadReport || []).slice(0, 8)) {
    const roles = (r.roles || []).map((x) => `${x.narrativeRole || x.slotId}@${x.blockId.slice(0, 8)}`).join(", ");
    lines.push(`- **${r.name}** load=${r.totalLoad} — ${roles}`);
  }
  lines.push("");
  lines.push("## 人工评分表（本文件下方由审阅填写）");
  lines.push("");
  lines.push("| 指标 | 1–5 | 笔记 |");
  lines.push("|---|---:|---|");
  lines.push("| Whole-story clarity |  |  |");
  lines.push("| Weave quality (INTERWOVEN≠COLOCATED) |  |  |");
  lines.push("| Character agency |  |  |");
  lines.push("| Stage rhythm |  |  |");
  lines.push("| Conflict honesty |  |  |");
  lines.push("| Editability (推断：局部 API 存在；本轮脚本未交互验证) |  |  |");
  lines.push("");
  lines.push("### 一句话主线（新人应能复述）");
  lines.push("");
  lines.push("> （审阅填写）");
  lines.push("");
  lines.push("### 是否值得继续写详细母稿？");
  lines.push("");
  lines.push("> （是 / 否 / 有条件）");
  lines.push("");
  return lines.join("\n");
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const index = [];
  const results = [];

  for (const caseDef of CASES) {
    try {
      const state = caseDef.build();
      const next = integrateMasterOutline(state);
      const draft = next.masterOutlineDraft;
      const stats = weaveQualityStats(draft);
      const agency = agencyHints(draft);
      const md = renderCaseMarkdown(caseDef, next, draft, stats, agency);
      const mdPath = path.join(OUT_DIR, `${caseDef.id}.md`);
      const jsonPath = path.join(OUT_DIR, `${caseDef.id}.json`);
      fs.writeFileSync(mdPath, md, "utf8");
      fs.writeFileSync(
        jsonPath,
        JSON.stringify(
          {
            case: { id: caseDef.id, title: caseDef.title, intent: caseDef.intent },
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
      results.push({ caseDef, stats, agency, conflictCount: draft.conflictReport.length, ok: true });
      index.push(`| ${caseDef.id} | ${caseDef.title} | ${stats.interwoven} | ${stats.multiFamilyStages} | ${stats.parallel} | ${draft.conflictReport.length} |`);
      console.log(
        caseDef.id,
        "beats",
        stats.beatCount,
        "INTERWOVEN",
        stats.interwoven,
        "COLOCATED-stages",
        stats.multiFamilyStages,
        "PARALLEL",
        stats.parallel,
        "conflicts",
        draft.conflictReport.length,
      );
    } catch (err) {
      console.error("FAIL", caseDef.id, err.code || err.message);
      results.push({ caseDef, ok: false, error: err.message, code: err.code });
      index.push(`| ${caseDef.id} | ${caseDef.title} | FAIL | — | — | — |`);
    }
  }

  const readme = [
    "# Integrator Product Trial V1",
    "",
    "> P5.1 — 验证 MasterOutlineDraft 是否像「人会认可的整本骨架」，不改算法。",
    "",
    "区分：",
    "",
    "- **COLOCATED**：同一阶段出现多个家族 beat（并排同幕）",
    "- **INTERWOVEN**：存在 STRONG / SHARED_SCENE / CAUSAL 交织边（共享行动/因果）",
    "",
    "## Cases",
    "",
    "| id | 标题 | INTERWOVEN 边 | 跨家族阶段 | KEEP_PARALLEL | conflicts |",
    "|---|---|---:|---:|---:|---:|",
    ...index,
    "",
    "人工总分见 `SCORECARD.md`。",
    "",
    `生成时间：${new Date().toISOString()}`,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, "README.md"), readme, "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "_summary.json"), JSON.stringify(results, null, 2), "utf8");
  console.log("wrote", OUT_DIR);
}

main();
