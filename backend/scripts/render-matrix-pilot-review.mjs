/**
 * Re-render human review MD from an existing pending-review folder (no API).
 * Usage: node backend/scripts/render-matrix-pilot-review.mjs [slug]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderHumanReviewFiles } from "./matrix-pilot-review-render.mjs";
import { buildProposalFromMatrix } from "../src/pipeline-matrix-model.js";
import { buildPipelineImportPackage } from "../src/pipeline-matrix-deepseek.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const slug = process.argv[2] || "雾港回声";
const dir = join(root, "examples", "pending-review", slug);
const sessionPath = join(dir, "session.json");

if (!existsSync(sessionPath)) {
  console.error(`找不到 ${sessionPath}`);
  process.exit(1);
}

const session = JSON.parse(readFileSync(sessionPath, "utf8"));
const payload = {
  setting: session.setting,
  synopsis: session.synopsis,
  config: session.config,
  truthBible: session.truthBible,
  characterArchives: session.characterArchives,
  infoMatrix: session.infoMatrix,
  hostRunbooks: session.hostRunbooks,
  scripts: session.scripts,
  evaluation: session.evaluation
};

function writeText(rel, text) {
  const path = join(dir, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
  console.log(`  wrote ${rel}`);
}

console.log(`Rendering review files → ${dir}`);
renderHumanReviewFiles(payload, writeText);

session.proposal = buildProposalFromMatrix({
  setting: session.setting,
  config: session.config,
  truthBible: session.truthBible,
  infoMatrix: session.infoMatrix
});
writeFileSync(join(dir, "session.json"), `${JSON.stringify(session, null, 2)}\n`, "utf8");
writeFileSync(join(dir, "import-package.json"), `${JSON.stringify(buildPipelineImportPackage(session), null, 2)}\n`, "utf8");
console.log("✓ done");
