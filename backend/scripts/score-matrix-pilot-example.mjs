/**
 * Re-score a matrix pilot folder.
 *
 * Usage:
 *   node backend/scripts/score-matrix-pilot-example.mjs
 *   node backend/scripts/score-matrix-pilot-example.mjs 停雪公馆 --readthrough
 *   node backend/scripts/score-matrix-pilot-example.mjs 雾港回声 --no-llm
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deepseekConfig } from "../src/deepseek.js";
import {
  createPipelineMatrixEvaluation,
  createPipelineMatrixScriptReadthroughEvaluation,
  createPipelineKnowledgeBoundaryAuditBatch,
  createPipelineInnocentScriptsTruthInference
} from "../src/pipeline-matrix-deepseek.js";
import { collectPriorRoleKnowledge } from "../src/prompts/matrix-knowledge-audit.js";
import { renderInnocentInferenceMarkdown } from "../src/prompts/matrix-innocent-inference.js";
import { pipelineWordTargets } from "../src/pipeline-matrix-model.js";
import { resolveKillerRoleKey, actIndex } from "../src/prompts/matrix-prompt-engine.js";
import {
  applyStructuredGates,
  scanRigidClockTimestamps,
  validateActionLog,
  validateDialogueLog
} from "../src/pipeline-matrix-structured-script.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const slug = args[0] || "雾港回声";
const pilotDir = join(root, "examples", "pending-review", slug);
const noLlm = process.argv.includes("--no-llm");
const readthrough = process.argv.includes("--readthrough");
const knowledgeAudit = process.argv.includes("--knowledge-audit") || readthrough;

for (const file of [join(root, "backend", ".env"), join(root, ".env")]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadActOutlinesFromDir() {
  const actOutlines = {};
  const dir = join(pilotDir, "layers", "07-outlines");
  if (!existsSync(dir)) return actOutlines;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const [roleKey, actKey] = f.replace(".json", "").split("_");
    actOutlines[roleKey] = actOutlines[roleKey] || {};
    actOutlines[roleKey][actKey] = loadJson(join(dir, f));
  }
  return actOutlines;
}

function loadScriptsFromDir(session) {
  const scripts =
    session.scripts && typeof session.scripts === "object"
      ? JSON.parse(JSON.stringify(session.scripts))
      : {};
  const dir = join(pilotDir, "layers", "09-scripts");
  if (!existsSync(dir)) return scripts;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const [roleKey, actKey] = f.replace(".json", "").split("_");
    scripts[roleKey] = scripts[roleKey] || {};
    scripts[roleKey][actKey] = loadJson(join(dir, f));
  }
  return scripts;
}

async function main() {
  const sessionPath = join(pilotDir, "session.json");
  const session = existsSync(sessionPath)
    ? loadJson(sessionPath)
    : {
        ...loadJson(join(pilotDir, "layers", "01-setup.json")),
        truthBible: loadJson(join(pilotDir, "layers", "02-truth-bible.json")),
        characterArchives: loadJson(join(pilotDir, "layers", "03-character-archives.json")),
        infoMatrix: loadJson(join(pilotDir, "layers", "04-info-matrix.json"))
      };

  const { setting, synopsis, config, truthBible, characterArchives } = session;
  const infoMatrixPath = join(pilotDir, "layers", "04-info-matrix.json");
  const infoMatrix = existsSync(infoMatrixPath) ? loadJson(infoMatrixPath) : session.infoMatrix;
  const scripts = loadScriptsFromDir(session);
  const actOutlines = loadActOutlinesFromDir();

  const killerKey = resolveKillerRoleKey(truthBible, characterArchives);
  const targets = pipelineWordTargets(setting);
  const minWords = config.wordsPerSectionMin || targets.minScript;
  const finalIdx = Math.max(0, (config.chapterKeys?.length || 1) - 1);
  const killerAwareness = setting.killerAwareness || "self-aware";

  const cellReports = [];
  const gateFailCounts = {};

  if (!readthrough) {
  for (const [roleKey, acts] of Object.entries(scripts)) {
    for (const [actKey, script] of Object.entries(acts || {})) {
      const matrixRow = infoMatrix.rows.find((r) => r.roleKey === roleKey && r.actKey === actKey);
      const isKiller = killerKey === roleKey;
      const actIdx = actIndex(config, actKey);
      const structured = script.structured;
      const actionLog = structured?.actionLog || validateActionLog({ narrative: script.body?.slice(0, 2000) || "" });
      const dialogueLog = structured?.dialogueLog || validateDialogueLog({ narrative: "" });
      const feelingsPack = structured?.feelingsPack || { puzzles: [], emotions: [] };

      const priorKnowledge = collectPriorRoleKnowledge(actOutlines, roleKey, actKey, config);
      const keys = config.chapterKeys || [];
      const actIdxNum = keys.indexOf(actKey);
      const priorScriptBodies = [];
      if (actIdxNum > 0) {
        for (const k of keys.slice(0, actIdxNum)) {
          const b = acts?.[k]?.body;
          if (b) priorScriptBodies.push(b);
        }
      }

      const gated = applyStructuredGates({
        actionLog,
        feelingsPack,
        dialogueLog,
        roleKey,
        characterArchives,
        infoMatrix,
        matrixRow: matrixRow || { roleKey, actKey, newClueIds: [] },
        actKey,
        config,
        isKiller,
        actIndex: actIdx,
        finalActIndex: finalIdx,
        minWords,
        killerAwareness,
        actOutline: actOutlines[roleKey]?.[actKey],
        priorKnowledgeFacts: priorKnowledge.facts,
        priorScriptBodies
      });

      const clock = scanRigidClockTimestamps(script.body || "");

      for (const [name, g] of Object.entries(gated.gates)) {
        if (g.passed === false && name !== "clockTimestampAdvisory") {
          gateFailCounts[name] = (gateFailCounts[name] || 0) + 1;
        }
      }

      cellReports.push({
        cell: `${roleKey}_${actKey}`,
        roleKey,
        actKey,
        isKiller,
        bodyLen: (script.body || "").length,
        mechanicalPassed: gated.passed,
        fails: Object.entries(gated.gates)
          .filter(([name, g]) => g.passed === false && name !== "clockTimestampAdvisory")
          .map(([k]) => k),
        clockTimestamps: clock.count,
        clockAdvisory: Boolean(clock.advisory),
        gateDetails: Object.fromEntries(
          Object.entries(gated.gates).map(([k, v]) => [
            k,
            {
              passed: v.passed,
              violations: v.violations?.slice(0, 3)
            }
          ])
        )
      });
    }
  }
  }

  const outlineReports = [];
  const outlinesDir = join(pilotDir, "layers", "07-outlines");
  if (existsSync(outlinesDir)) {
    for (const f of readdirSync(outlinesDir)) {
      if (!f.endsWith(".json")) continue;
      const o = loadJson(join(outlinesDir, f));
      const sig = o.signatureClues?.length || 0;
      const personalSources = (o.knowledgeSources || []).filter((k) =>
        /私人|亲眼|独有|专|亲耳/.test(k.source || "")
      ).length;
      const clockInOutline = (o.outline?.match(/\d{1,2}:\d{2}/g) || []).length;
      outlineReports.push({
        cell: f.replace(".json", ""),
        signatureClues: sig,
        personalSourceCount: personalSources,
        clockInOutline,
        hasSignature: sig >= 1 || personalSources >= 2
      });
    }
  }

  const mechPassed = cellReports.filter((c) => c.mechanicalPassed).length;
  const mechTotal = cellReports.length;

  let innocentInference = null;
  if (!noLlm && !readthrough && deepseekConfig().configured && Object.keys(scripts).length) {
    console.log("▶ 非凶手推真相（未读 truth bible）…");
    innocentInference = await createPipelineInnocentScriptsTruthInference({
      setting,
      synopsis,
      config,
      truthBible,
      characterArchives,
      scripts
    });
    const inferPath = join(pilotDir, "layers", "11-innocent-inference.json");
    writeFileSync(inferPath, `${JSON.stringify(innocentInference, null, 2)}\n`, "utf8");
    const mdPath = join(pilotDir, "truth", "INFERENCE-FROM-INNOCENTS.md");
    mkdirSync(dirname(mdPath), { recursive: true });
    writeFileSync(
      mdPath,
      `${renderInnocentInferenceMarkdown({
        inference: innocentInference.inference,
        comparison: innocentInference.comparison,
        mechanical: innocentInference.mechanical,
        killerRoleKey: innocentInference.killerRoleKey,
        characterArchives
      })}\n`,
      "utf8"
    );
  }

  let llmEvaluation = null;
  if (!noLlm && deepseekConfig().configured) {
    if (readthrough) {
      console.log("▶ LLM 通读评判（全部角色剧本，无机制/矩阵）…");
      const result = await createPipelineMatrixScriptReadthroughEvaluation({
        setting,
        synopsis,
        config,
        characterArchives,
        scripts
      });
      llmEvaluation = result.evaluation;
    } else {
      console.log("▶ LLM 评判（v5.4 prompt）…");
      const result = await createPipelineMatrixEvaluation({
        setting,
        synopsis,
        config,
        truthBible,
        infoMatrix,
        scripts
      });
      llmEvaluation = result.evaluation;
    }
  }

  let knowledgeBoundaryAudit = null;
  if (!noLlm && knowledgeAudit && deepseekConfig().configured && Object.keys(scripts).length) {
    console.log("▶ 知识边界审计（真相×纲要×前幕铺垫）…");
    knowledgeBoundaryAudit = await createPipelineKnowledgeBoundaryAuditBatch({
      setting,
      synopsis,
      config,
      truthBible,
      characterArchives,
      infoMatrix,
      scripts,
      actOutlines
    });
    const auditPath = join(pilotDir, "layers", "12-knowledge-audit.json");
    mkdirSync(dirname(auditPath), { recursive: true });
    writeFileSync(
      auditPath,
      `${JSON.stringify(
        {
          slug,
          auditedAt: new Date().toISOString(),
          ...knowledgeBoundaryAudit.summary,
          cells: knowledgeBoundaryAudit.cells.map((c) => ({
            cell: c.cell,
            passed: c.audit.passed,
            verdict: c.audit.verdict,
            heuristic: c.heuristic,
            leaks: c.audit.leaks
          }))
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  }

  const report = {
    slug,
    scoredAt: new Date().toISOString(),
    scoringStandard: readthrough ? "script-readthrough" : "matrix-2.0",
    killerKey,
    killerAwareness,
    mechanical: readthrough
      ? null
      : {
          passedCells: mechPassed,
          totalCells: mechTotal,
          passRatePct: mechTotal ? Math.round((mechPassed / mechTotal) * 100) : 0,
          gateFailCounts,
          clockHeavyCells: cellReports.filter((c) => c.clockAdvisory).length
        },
    outlines: readthrough
      ? null
      : {
          withSignature: outlineReports.filter((o) => o.hasSignature).length,
          total: outlineReports.length,
          clockHeavyOutlines: outlineReports.filter((o) => o.clockInOutline >= 5).length
        },
    cells: readthrough ? undefined : cellReports,
    outlineCells: readthrough ? undefined : outlineReports,
    innocentInference: innocentInference
      ? {
          killerMatch: innocentInference.mechanical.killerMatch,
          inferredKiller: innocentInference.mechanical.inferredKiller,
          truthKiller: innocentInference.mechanical.truthKiller,
          confidence: innocentInference.inference?.inferred?.confidence,
          fairnessVerdict: innocentInference.comparison?.fairnessVerdict,
          passed: innocentInference.passed
        }
      : null,
    llmEvaluation,
    knowledgeBoundaryAudit: knowledgeBoundaryAudit
      ? {
          passed: knowledgeBoundaryAudit.passed,
          ...knowledgeBoundaryAudit.summary
        }
      : null
  };

  const outPath = join(
    pilotDir,
    "layers",
    readthrough ? "10-readthrough-evaluation.json" : "10-score-v54-retro.json"
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`\n=== ${slug} · ${readthrough ? "通读评分" : "v5.4 回溯评分"} ===\n`);
  if (!readthrough) {
  console.log(`机械门禁：${mechPassed}/${mechTotal} 格通过 (${report.mechanical.passRatePct}%)`);
  console.log(`钟点过密 advisory：${report.mechanical.clockHeavyCells}/${mechTotal} 格`);
  console.log(`大纲含特色/个人来源：${report.outlines.withSignature}/${report.outlines.total} 格`);
  if (Object.keys(gateFailCounts).length) {
    console.log("门禁失败汇总：", JSON.stringify(gateFailCounts));
  }
  for (const c of cellReports.filter((x) => !x.mechanicalPassed)) {
    console.log(`  ✗ ${c.cell}: ${c.fails.join(", ")}`);
  }
  }
  if (innocentInference) {
    console.log(
      `\n非凶手推真相：killerMatch=${innocentInference.mechanical.killerMatch} (${innocentInference.mechanical.inferredKiller} vs ${innocentInference.mechanical.truthKiller}) fairness=${innocentInference.comparison.fairnessVerdict}`
    );
  }
  if (llmEvaluation) {
    console.log(`\nLLM overallScore: ${llmEvaluation.overallScore}`);
    console.log("  scores:", JSON.stringify(llmEvaluation.scores));
    if (readthrough) {
      console.log(`  readyForPlayers: ${llmEvaluation.readyForPlayers}`);
      if (llmEvaluation.weakCells?.length) {
        console.log("  weakCells (top 5):");
        for (const w of llmEvaluation.weakCells.slice(0, 5)) {
          console.log(`    ${w.cell}: ${w.why}`);
        }
      }
      if (llmEvaluation.standoutCells?.length) {
        console.log("  standoutCells:");
        for (const s of llmEvaluation.standoutCells.slice(0, 3)) {
          console.log(`    ${s.cell}: ${s.why}`);
        }
      }
    } else {
      console.log(`  readyForSync: ${llmEvaluation.readyForSync}`);
    }
    console.log(`  verdict: ${llmEvaluation.verdict}`);
    if (llmEvaluation.issues?.length) {
      console.log("  issues (top 5):");
      for (const i of llmEvaluation.issues.slice(0, 5)) {
        console.log(`    [${i.severity}] ${i.area}: ${i.detail}`);
      }
    }
  } else {
    console.log(noLlm ? "\n（--no-llm，未跑 LLM）" : "\n（DEEPSEEK 未配置，未跑 LLM）");
  }
  if (knowledgeBoundaryAudit) {
    console.log(
      `\n知识边界审计：passed=${knowledgeBoundaryAudit.passed} highLeaks=${knowledgeBoundaryAudit.summary.highLeakCount} heuristic=${knowledgeBoundaryAudit.summary.heuristicFlagged}`
    );
    for (const h of knowledgeBoundaryAudit.summary.highLeaks.slice(0, 5)) {
      console.log(`  [high] ${h.cell}: ${h.claim || h.reason} — ${h.excerpt?.slice(0, 60)}`);
    }
  }
  console.log(`\n完整报告：${outPath}`);
}

main().catch((e) => {
  console.error("✗", e.message || e);
  process.exit(1);
});
