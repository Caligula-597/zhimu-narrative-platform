/**
 * Knowledge boundary audit for a pilot folder (batch or single cell).
 *
 * Usage:
 *   node backend/scripts/audit-pilot-knowledge.mjs 停雪公馆
 *   node backend/scripts/audit-pilot-knowledge.mjs 停雪公馆 role-1 ch2
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deepseekConfig } from "../src/deepseek.js";
import {
  createPipelineKnowledgeBoundaryAudit,
  createPipelineKnowledgeBoundaryAuditBatch
} from "../src/pipeline-matrix-deepseek.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const slug = args[0] || "停雪公馆";
const roleKey = args[1];
const actKey = args[2];
const pilotDir = join(root, "examples", "pending-review", slug);

for (const file of [join(root, "backend", ".env"), join(root, ".env")]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function loadJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function loadActOutlines() {
  const actOutlines = {};
  const dir = join(pilotDir, "layers", "07-outlines");
  if (!existsSync(dir)) return actOutlines;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const [rk, ak] = f.replace(".json", "").split("_");
    actOutlines[rk] = actOutlines[rk] || {};
    actOutlines[rk][ak] = loadJson(join(dir, f));
  }
  return actOutlines;
}

function loadScripts(session) {
  const scripts = session.scripts ? JSON.parse(JSON.stringify(session.scripts)) : {};
  const dir = join(pilotDir, "layers", "09-scripts");
  if (!existsSync(dir)) return scripts;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const [rk, ak] = f.replace(".json", "").split("_");
    scripts[rk] = scripts[rk] || {};
    scripts[rk][ak] = loadJson(join(dir, f));
  }
  return scripts;
}

async function main() {
  if (!deepseekConfig().configured) {
    console.error("DEEPSEEK 未配置");
    process.exit(1);
  }
  const session = loadJson(join(pilotDir, "session.json"));
  const payload = {
    setting: session.setting,
    synopsis: session.synopsis,
    config: session.config,
    truthBible: session.truthBible,
    characterArchives: session.characterArchives,
    infoMatrix: session.infoMatrix,
    scripts: loadScripts(session),
    actOutlines: loadActOutlines()
  };

  if (roleKey && actKey) {
    const r = await createPipelineKnowledgeBoundaryAudit({ ...payload, roleKey, actKey });
    console.log(JSON.stringify({ cell: r.cell, heuristic: r.heuristic, audit: r.audit }, null, 2));
    return;
  }

  console.log(`▶ 知识边界审计 · ${slug} · ${payload.config.chapterKeys?.length || 0} 幕 × ${payload.characterArchives.roles.length} 角色`);
  const batch = await createPipelineKnowledgeBoundaryAuditBatch(payload);
  const outPath = join(pilotDir, "layers", "12-knowledge-audit.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    `${JSON.stringify({ slug, auditedAt: new Date().toISOString(), ...batch.summary, cells: batch.cells.map((c) => ({ cell: c.cell, passed: c.audit.passed, verdict: c.audit.verdict, heuristic: c.heuristic, leaks: c.audit.leaks })) }, null, 2)}\n`,
    "utf8"
  );
  console.log(`\npassed=${batch.passed} highLeaks=${batch.summary.highLeakCount} heuristic=${batch.summary.heuristicFlagged}`);
  for (const h of batch.summary.highLeaks) {
    console.log(`  [high] ${h.cell}: ${h.claim} — ${h.reason}`);
  }
  console.log(`\n${outPath}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
