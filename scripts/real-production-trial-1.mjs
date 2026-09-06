/**
 * Real Production Trial #1 CLI
 *
 *   node scripts/real-production-trial-1.mjs --mode=mock
 *   node scripts/real-production-trial-1.mjs --mode=real
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runRealProductionTrial } from "../shared/real-production-trial.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnvFiles(...files) {
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

function argValue(flag) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : undefined;
}

async function main() {
  loadEnvFiles(path.join(root, ".env"), path.join(root, "backend", ".env"));

  const mode = argValue("--mode") || (process.env.DEEPSEEK_API_KEY ? "real" : "mock");
  const inputPath =
    argValue("--input") ||
    path.join(root, "trials/rpt-1-closed-after-hours/trial-input.json");
  const outDir =
    argValue("--out") ||
    path.join(root, "trials/rpt-1-closed-after-hours/runs", new Date().toISOString().replace(/[:.]/g, "-"));

  const trialInput = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const label =
    trialInput.trialId === "RPT-1C"
      ? "RPT #1C Post-P10.4 Projection Rerun"
      : trialInput.trialId === "RPT-1B"
        ? "RPT #1B Post-P10.3 Real Rerun"
        : "Real Production Trial #1";
  console.log(label);
  console.log(`  mode=${mode}`);
  console.log(`  input=${inputPath}`);
  console.log(`  out=${outDir}`);

  const result = await runRealProductionTrial({
    trialInput,
    outDir,
    writerMode: mode,
  });

  if (trialInput.trialId === "RPT-1B" || trialInput.trialId === "RPT-1C") {
    const pkg = JSON.parse(fs.readFileSync(path.join(outDir, "complete-script-package.json"), "utf8"));
    const storyState = JSON.parse(fs.readFileSync(path.join(outDir, "story-state.json"), "utf8"));
    const candidatePlan = JSON.parse(fs.readFileSync(path.join(outDir, "story-candidate-plan.json"), "utf8"));
    const projectionAuditPath = path.join(outDir, "projection-audit.json");
    const projectionAudit = fs.existsSync(projectionAuditPath)
      ? JSON.parse(fs.readFileSync(projectionAuditPath, "utf8"))
      : null;

    if (trialInput.trialId === "RPT-1B") {
      const { writeM12SurvivalPacket } = await import("../shared/rpt1b-m12-survival-probe.js");
      const probe = writeM12SurvivalPacket(outDir, { package: pkg, storyState, candidatePlan });
      const packet = `# RPT #1B — 人工审看包

> 对照 #1A：\`trials/rpt-1-closed-after-hours/runs/2026-09-06T04-19-32-742Z/\`
> 协议：\`docs/RPT1B_POST_P10_3_REAL_RERUN_ZH.md\`

## 机器 SYSTEM 摘要

| 项 | 值 |
|---|---|
| trialVerdict | ${result.trialVerdict} |
| Quality | ${result.quality?.status} · ${result.quality?.totalScore} |
| Hard blockers | ${result.quality?.hardBlockers ?? "?"} |
| 作者确认 / 救火 | ${result.humanIntervention?.authorConfirmations} / ${result.humanIntervention?.developerFirefighting} |
| 推荐 bundle | ${(probe.preWriter.recommendedBundle || []).join(" + ")} |
| 接受 blocks | ${probe.acceptedBlocks.join(" + ")} |

## 请先读

1. [\`readable-scripts.md\`](./readable-scripts.md)
2. [\`complete-script-package.json\`](./complete-script-package.json)
3. 再看 [\`quality-report.json\`](./quality-report.json) 与 [\`m12-fidelity-survival-probe.json\`](./m12-fidelity-survival-probe.json)

## 双 verdict（留给你填）

| Verdict | 裁决 |
|---|---|
| SYSTEM_VERDICT | |
| CHANGE_VERDICT (P10.3) | |

## M12 Fidelity Survival 五问

${probe.survivalChecklistForHuman.map((q) => `- [ ] ${q}`).join("\n")}

## 与 #1A 透镜对照

| 项 | #1A | #1B |
|---|---:|---|
| 前20分钟欲望 | 2/5 | |
| 幕间换挡 | 2/5 | |
| 六人声音 | 1/5 | |
| GAME | N/A | |
| 终局兑现 | 2/5 | |
| M12 Survival | — | |
`;
      fs.writeFileSync(path.join(outDir, "HUMAN_REVIEW_PACKET.md"), packet, "utf8");
      console.log(`  m12Survival hasM12=${probe.hasM12} crimeSmell=${probe.heuristics.crimeCaptureSmell}`);
    } else {
      const { writeP104SurvivalPacket } = await import("../shared/rpt1c-p104-survival-probe.js");
      const { writeM12SurvivalPacket } = await import("../shared/rpt1b-m12-survival-probe.js");
      writeM12SurvivalPacket(outDir, { package: pkg, storyState, candidatePlan });
      const probe = writeP104SurvivalPacket(outDir, {
        package: pkg,
        storyState,
        candidatePlan,
        projectionAudit,
      });
      const six = probe.sixChecks;
      const packet = `# RPT #1C — 人工审看包

> 对照 #1B：\`trials/rpt-1-closed-after-hours/runs/2026-09-06T08-03-37-863Z/\`
> 协议：\`docs/RPT1C_POST_P10_4_PROJECTION_RERUN_ZH.md\`
> P10.4 Packet Gate：\`e469598\`

## 机器 SYSTEM 摘要

| 项 | 值 |
|---|---|
| trialVerdict | ${result.trialVerdict} |
| Quality | ${result.quality?.status} · ${result.quality?.totalScore} |
| Hard blockers | ${result.quality?.hardBlockers ?? "?"} |
| 作者确认 / 救火 | ${result.humanIntervention?.authorConfirmations} / ${result.humanIntervention?.developerFirefighting} |
| Projection audit | ${probe.preWriter.projectionAuditStatus ?? "n/a"} |
| 推荐 bundle | ${(probe.preWriter.recommendedBundle || []).join(" + ")} |
| 接受 blocks | ${probe.acceptedBlocks.join(" + ")} |

## 机器六项启发式（非正式裁决）

| 检查 | heuristicPass |
|---|---|
| Slot | ${six.slotSurvival.heuristicPass} (leaks=${six.slotSurvival.leakCount}) |
| Stake | ${six.stakeSurvival.heuristicPass} |
| Motivation | ${six.motivationSurvival.heuristicPass} |
| Terms | ${six.termsSurvival.heuristicPass} (templateSmell=${six.termsSurvival.stillTemplateSmell}) |
| Exchange | ${six.exchangeSurvival.heuristicPass} (narrationSmell=${six.exchangeSurvival.narrationSmell}) |
| Aftermath | ${six.aftermathSurvival.heuristicPass} |
| Role scope 方序 | ${probe.roleScope.heuristicPass} (fangXuOwnerHits=${probe.roleScope.fangXuOwnerArcHits}) |

## 请先读

1. [\`readable-scripts.md\`](./readable-scripts.md)
2. [\`complete-script-package.json\`](./complete-script-package.json)
3. [\`p10-4-projection-survival-probe.json\`](./p10-4-projection-survival-probe.json)
4. [\`projection-audit.json\`](./projection-audit.json)（若有）

## 双 verdict（留给你填）

| Verdict | 裁决 |
|---|---|
| SYSTEM_VERDICT | |
| P10_4_CHANGE_VERDICT | |

## P10.4 Survival 清单

${probe.survivalChecklistForHuman.map((q) => `- [ ] ${q}`).join("\n")}

## 透镜（记录，非主判据）

| 项 | #1A | #1B | #1C |
|---|---:|---:|---|
| 前20分钟欲望 | 2 | 2.5 | |
| 幕间换挡 | 2 | 3 | |
| 六人声音 | 1 | 1 | |
| GAME | N/A | N/A | |
| 终局兑现 | 2 | 2.5 | |
`;
      fs.writeFileSync(path.join(outDir, "HUMAN_REVIEW_PACKET.md"), packet, "utf8");
      console.log(
        `  p104Survival slots=${six.slotSurvival.leakCount} stake=${six.stakeSurvival.heuristicPass} fangXuOwner=${probe.roleScope.fangXuOwnerArcHits}`,
      );
    }
  }
  console.log(`  verdict=${result.trialVerdict}`);
  console.log(`  quality=${result.quality?.status} score=${result.quality?.totalScore}`);
  console.log(
    `  interventions author=${result.humanIntervention?.authorConfirmations} firefight=${result.humanIntervention?.developerFirefighting}`,
  );
  console.log(`  elapsedMs=${result.elapsedMs}`);
  console.log(`  artifacts: ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
