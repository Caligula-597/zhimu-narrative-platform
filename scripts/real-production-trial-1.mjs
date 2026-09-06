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
  console.log(`Real Production Trial #1`);
  console.log(`  mode=${mode}`);
  console.log(`  input=${inputPath}`);
  console.log(`  out=${outDir}`);

  const result = await runRealProductionTrial({
    trialInput,
    outDir,
    writerMode: mode,
  });

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
