/**
 * P8.0 Multi-Script Generalization Audit runner
 * Usage: node scripts/p8-generalization-audit.mjs
 *        node scripts/p8-generalization-audit.mjs --case=GEN-01
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditAllCases,
  auditOneCase,
  loadAllCaseFixtures,
  P8_CAPTURES_DIR,
} from "../shared/p8-generalization-runner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REPORT_DOC = path.join(ROOT, "docs/P8_0_MULTI_SCRIPT_GENERALIZATION_REPORT_ZH.md");

function parseCaseArg(argv) {
  const hit = argv.find((a) => a.startsWith("--case="));
  return hit ? hit.slice("--case=".length) : null;
}

function renderDoc(summary) {
  const lines = [
    "# P8.0 Multi-Script Generalization — Machine Report",
    "",
    `> 生成时间：${summary.generatedAt}`,
    "> Corpus：GEN-01～GEN-08（A–H 仍为 regression，不计入泛化证明）",
    "> Editorial Gate：✅ 完成 — 见 `docs/P8_0_GENERALIZATION_AUDIT_VERDICT_ZH.md`",
    "> 总裁决：`P8.0 Audit ✅` · `Universal Pipeline ❌`",
    "",
    "## Machine Gate 总表",
    "",
    "| case | title | pipeline | G1 | G2 | G3 | all | failureClass | players | stages draft |",
    "|---|---|---|---|---|---|---|---|---:|---:|",
  ];
  for (const r of summary.results) {
    lines.push(
      `| ${r.caseId} | ${r.title} | ${r.pipelineOk ? "OK" : "FAIL"} | ${r.gatePass.G1 ? "PASS" : "FAIL"} | ${r.gatePass.G2 ? "PASS" : "FAIL"} | ${r.gatePass.G3 ? "PASS" : "FAIL"} | ${r.gatePass.all ? "PASS" : "FAIL"} | ${r.failureClass || "—"} | ${r.counts.players ?? "—"} | ${r.counts.stagesDraft ?? "—"} |`,
    );
  }
  lines.push(
    "",
    "## 说明",
    "",
    "- G1 Contract（含 3 幕终幕 PAYOFF 语义）· G2 Semantic（contributions 读 `stages[]`）· G3 Downstream（含 GAME stage 引用完整性）",
    "- failureClass：`CONTRACT_FAILURE` / `GENERATION_FAILURE` / `CONTENT_QUALITY_FAILURE`（后者仅 Editorial）",
    "- 捕获目录：`captures/p8-generalization/GEN-xx/`",
    "- 最终产品裁决：`docs/P8_0_GENERALIZATION_AUDIT_VERDICT_ZH.md`",
    "",
  );
  return lines.join("\n");
}

function main() {
  const only = parseCaseArg(process.argv.slice(2));
  fs.mkdirSync(P8_CAPTURES_DIR, { recursive: true });

  let summary;
  if (only) {
    const row = loadAllCaseFixtures().find((r) => r.fixture.caseId === only);
    if (!row) {
      console.error("Unknown case", only);
      process.exit(1);
    }
    const { report } = auditOneCase(row.fixture, { writeCaptures: true });
    summary = {
      generatedAt: new Date().toISOString(),
      corpus: "P8.0B single",
      results: [report],
    };
  } else {
    summary = auditAllCases({ writeCaptures: true });
  }

  fs.writeFileSync(
    path.join(P8_CAPTURES_DIR, "machine-summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );
  fs.writeFileSync(REPORT_DOC, renderDoc(summary), "utf8");

  for (const r of summary.results) {
    const mark = r.gatePass.all ? "PASS" : "FAIL";
    console.log(
      mark,
      r.caseId,
      r.title,
      "pipeline=",
      r.pipelineOk,
      "G1/G2/G3=",
      `${r.gatePass.G1}/${r.gatePass.G2}/${r.gatePass.G3}`,
      r.failureClass || "",
      r.pipelineError ? r.pipelineError.message : "",
    );
  }

  console.log("wrote captures →", P8_CAPTURES_DIR);
  console.log("wrote report →", REPORT_DOC);
}

main();
