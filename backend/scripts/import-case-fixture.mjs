/**
 * Import a structured murder-mystery case fixture into a new world.
 *
 * Usage:
 *   node backend/scripts/import-case-fixture.mjs cheese-6p
 *   node backend/scripts/import-case-fixture.mjs qinglou-561
 *
 * Requires DATABASE_URL (and a seeded FIXTURE.hostUserId capable of world.create).
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pool } from "../src/db.js";
import { createWorldFromContentPackage } from "../src/routes/content-package-helpers.js";
import { FIXTURE } from "./fixture-constants.mjs";

const CASE_KEYS = Object.freeze({
  "cheese-6p": "cheese-6p",
  "qinglou-561": "qinglou-561",
  cheese: "cheese-6p",
  qinglou: "qinglou-561"
});

function resolveCaseKey(raw = "cheese-6p") {
  const key = String(raw || "").trim().toLowerCase();
  return CASE_KEYS[key] || null;
}

async function loadCasePackage(caseKey) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const packagePath = path.join(root, "fixtures", "cases", caseKey, "package.mjs");
  const mod = await import(pathToFileURL(packagePath).href);
  const pkg = mod.default || mod.cheeseCasePackage || mod.qinglouCasePackage;
  if (!pkg?.data) {
    throw new Error(`Case package missing data export: ${packagePath}`);
  }
  return pkg;
}

async function main(argv = process.argv.slice(2)) {
  const caseKey = resolveCaseKey(argv[0] || "cheese-6p");
  if (!caseKey) {
    console.error("Usage: node backend/scripts/import-case-fixture.mjs <cheese-6p|qinglou-561>");
    process.exitCode = 1;
    return;
  }

  const pkg = await loadCasePackage(caseKey);
  const name = pkg.data.world?.name || pkg.meta?.title || caseKey;
  const summary = pkg.data.world?.summary || pkg.meta?.notes || "";
  const result = await createWorldFromContentPackage(FIXTURE.hostUserId, {
    name,
    summary,
    requestId: `case-fixture:${caseKey}:${Date.now()}`,
    data: pkg.data
  });

  const imported = result.imported || {};
  console.log(JSON.stringify({
    caseKey,
    worldId: result.world?.id || null,
    worldName: result.world?.name || name,
    deduplicated: Boolean(result.deduplicated),
    imported: {
      chapters: imported.chapters ?? 0,
      roles: imported.roles ?? 0,
      sections: imported.sections ?? 0,
      scenes: imported.scenes ?? 0,
      clues: imported.clues ?? 0,
      materialBooklets: imported.materialBooklets ?? 0,
      points: imported.points ?? 0,
      edges: imported.edges ?? 0,
      rules: imported.rules ?? 0
    },
    warnings: result.warnings || []
  }, null, 2));
}

const isCli = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCli) {
  try {
    await main();
  } catch (error) {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

export { main, resolveCaseKey, loadCasePackage };
