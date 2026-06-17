/**
 * Run full pipeline + overall story evaluation.
 * Usage: node scripts/test-deepseek-pipeline.mjs [--evaluate]
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDeepseekStorySpec,
  createDeepseekStoryOutline,
  createDeepseekStoryProposal,
  createDeepseekRoleMatrix,
  createDeepseekRoleSection,
  createDeepseekManuscriptSynopsis,
  createDeepseekStoryEvaluation,
  deepseekConfig
} from "../src/deepseek.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [join(root, ".env"), join(root, "..", ".env.staging")]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const withEvaluate = process.argv.includes("--evaluate") || process.argv.includes("--eval");

const brief = {
  title: "流水线实测 · 示例剧本",
  premise: "四名调查员在封闭货轮上调查失踪船长，线索指向旧日走私网络。",
  style: "悬疑调查，信息互补",
  playerCount: 4,
  chapterCount: 2,
  sceneCount: 4,
  investigationPointCount: 4,
  clueCount: 4,
  targetWordCount: 2000,
  requirements: "不要跑团数值；每章有明确转折。",
  evaluationFocus: "偏硬核推理；不要内奸/破坏公平的角色；允许船员关系张力"
};

async function step(label, fn) {
  const started = Date.now();
  process.stdout.write(`\n▶ ${label} … `);
  const result = await fn();
  console.log(`OK (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  return result;
}

function printEvaluation(ev) {
  const priorityLabel = { must_fix: "必改", should_fix: "建议改", optional: "可选" };
  const layerLabel = { brief: "brief", spec: "规格", outline: "总纲", structure: "编排", roleMatrix: "角色矩阵", section: "分幕", synopsis: "母稿" };
  console.log("\n════════════════ 整体评判 · 修改指导 ════════════════");
  console.log(`总评 (${ev.overallScore}/10): ${ev.verdict}`);
  console.log(`可导入: ${ev.readyForImport ? "是" : "否"}`);
  if (ev.styleAlignment?.summary) {
    console.log(`\n【风格契合 · ${ev.styleAlignment.matchLevel}】${ev.styleAlignment.summary}`);
    if (ev.styleAlignment.keepEmphasis?.length) console.log(`  强化: ${ev.styleAlignment.keepEmphasis.join("；")}`);
    if (ev.styleAlignment.adjustEmphasis?.length) console.log(`  微调: ${ev.styleAlignment.adjustEmphasis.join("；")}`);
  }
  if (ev.nextStepOrder?.length) console.log(`\n建议重生成顺序: ${ev.nextStepOrder.map((l) => layerLabel[l] || l).join(" → ")}`);
  console.log("\n【分项得分】");
  const labels = { playability: "可玩性", fairness: "公平推理", multiRoleDesign: "多人设计", pacing: "章节节奏", graphReady: "编排可落地", consistency: "内部一致", styleFit: "风格契合" };
  for (const [key, score] of Object.entries(ev.scores)) console.log(`  ${labels[key] || key}: ${score}/10`);
  if (ev.revisions?.length) {
    console.log("\n【分层修改方向】");
    ev.revisions.forEach((rev) => {
      console.log(`\n  [${priorityLabel[rev.priority] || rev.priority}] ${layerLabel[rev.targetLayer] || rev.targetLayer}${rev.targetKey ? ` · ${rev.targetKey}` : ""}`);
      console.log(`    问题: ${rev.problem}`);
      console.log(`    方向: ${rev.direction}`);
      if (rev.preserve) console.log(`    保留: ${rev.preserve}`);
      if (rev.promptHint) console.log(`    下轮提示: ${rev.promptHint}`);
    });
  }
  if (ev.strengths?.length) {
    console.log("\n【优点】");
    ev.strengths.forEach((item) => console.log(`  + ${item}`));
  }
  if (ev.issues?.length) {
    console.log("\n【问题清单】");
    ev.issues.forEach((item) => console.log(`  [${item.severity}] ${item.area}: ${item.detail}`));
  }
}

async function main() {
  const config = deepseekConfig();
  if (!config.configured) {
    console.error("SKIP: DEEPSEEK_API_KEY not configured");
    process.exit(0);
  }
  console.log(`DeepSeek pipeline · model=${config.model}${withEvaluate ? " · 含整体评判" : ""}`);

  const specResult = await step("Layer 0 · 规格", () => createDeepseekStorySpec(brief));
  const outlineResult = await step("Layer 1 · 总纲", () => createDeepseekStoryOutline({ ...brief, spec: specResult.spec }));
  const structureResult = await step("Layer 2 · 编排结构", () =>
    createDeepseekStoryProposal({ ...brief, spec: specResult.spec, outline: outlineResult.outline, skipOutline: true })
  );
  const matrixResult = await step("Layer 3 · 角色矩阵", () =>
    createDeepseekRoleMatrix({ ...brief, spec: specResult.spec, outline: outlineResult.outline, proposal: structureResult.proposal })
  );
  const role = matrixResult.roleMatrix.roles[0];
  const chapter = structureResult.proposal.chapters[0];
  const sectionResult = await step(`Layer 4 · 分幕 (${role.key}/${chapter.key})`, () =>
    createDeepseekRoleSection({
      ...brief,
      spec: specResult.spec,
      outline: outlineResult.outline,
      proposal: structureResult.proposal,
      roleMatrix: matrixResult.roleMatrix,
      roleKey: role.key,
      chapterKey: chapter.key
    })
  );
  const synopsisResult = await step("Layer 5 · 短母稿", () =>
    createDeepseekManuscriptSynopsis({
      ...brief,
      spec: specResult.spec,
      outline: outlineResult.outline,
      proposal: structureResult.proposal,
      roleMatrix: matrixResult.roleMatrix
    })
  );

  console.log("\n── 生成摘要 ──");
  console.log(`规格: ${specResult.spec.playerCount} 人 · ${specResult.spec.chapterKeys.length} 章`);
  console.log(`总纲: ${outlineResult.outline.logline}`);
  console.log(`结构: ${structureResult.proposal.scenes.length} 场景 · ${structureResult.proposal.edges.length} 边 · ${structureResult.proposal.clues.length} 线索`);
  console.log(`矩阵: ${matrixResult.roleMatrix.roles.map((r) => r.name).join(" / ")}`);
  console.log(`分幕样本: ${sectionResult.section.title} (${sectionResult.section.body.length} 字)`);
  console.log(`母稿: ${synopsisResult.synopsis.overallManuscript.length} 字`);

  if (withEvaluate) {
    const evalResult = await step("Layer 6 · 整体评判", () =>
      createDeepseekStoryEvaluation({
        brief,
        evaluationFocus: brief.evaluationFocus,
        spec: specResult.spec,
        outline: outlineResult.outline,
        proposal: structureResult.proposal,
        roleMatrix: matrixResult.roleMatrix,
        synopsis: synopsisResult.synopsis,
        sampleSection: sectionResult.section
      })
    );
    printEvaluation(evalResult.evaluation);
    console.log(`\n✓ 完成（7 次 API 调用：6 步生成 + 1 步评判）`);
  } else {
    console.log("\n✓ 流水线完成（6 次 API 调用）。加 --evaluate 可跑整体评判。");
  }
}

main().catch((error) => {
  console.error("\n✗", error.message || error);
  process.exit(1);
});
