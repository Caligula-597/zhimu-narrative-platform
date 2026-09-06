/**
 * P10.0 CLI — run GEN-01..08 quality audit and write report artifacts.
 *
 * Usage:
 *   node scripts/generated-script-quality-audit.mjs
 *   node scripts/generated-script-quality-audit.mjs --out captures/p10-quality-audit
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatQualityAuditMarkdown,
  runGeneratedScriptQualityAudit,
} from "../shared/generated-script-quality-audit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseOutDir(argv) {
  const idx = argv.indexOf("--out");
  if (idx >= 0 && argv[idx + 1]) return path.resolve(root, argv[idx + 1]);
  return path.resolve(root, "captures/p10-quality-audit");
}

async function main() {
  const outDir = parseOutDir(process.argv.slice(2));
  fs.mkdirSync(outDir, { recursive: true });

  const audit = await runGeneratedScriptQualityAudit();
  const jsonPath = path.join(outDir, "audit.json");
  const mdPath = path.join(outDir, "REPORT.md");
  const docsPath = path.resolve(root, "docs/P10_0_QUALITY_AUDIT_REPORT_ZH.md");

  fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  const md = formatQualityAuditMarkdown(audit);
  fs.writeFileSync(mdPath, md, "utf8");
  fs.writeFileSync(docsPath, md, "utf8");

  console.log(`P10.0 audit written:`);
  console.log(`  ${jsonPath}`);
  console.log(`  ${mdPath}`);
  console.log(`  ${docsPath}`);
  console.log(
    `  scored=${audit.aggregate.scoredSize}/${audit.aggregate.corpusSize} productionBlocked=${audit.aggregate.productionBlockedSize}`,
  );
  console.log(
    `  lowest: ${audit.aggregate.lowestDimensions.map((d) => `${d.id}=${d.average}`).join(", ") || "n/a"}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
