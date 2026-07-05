#!/usr/bin/env node
/**
 * Single-layer matrix pipeline smoke — for prompt iteration without full pilot cost.
 *
 * Usage:
 *   node backend/scripts/matrix-layer-smoke.mjs --layer script --role role-3 --act ch2
 *   node backend/scripts/matrix-layer-smoke.mjs --layer matrix   # info matrix only
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCreativePipeline } from "../src/deepseek.js";
import {
  createPipelineCharacterArchives,
  createPipelineInfoMatrix,
  createPipelineMatrixPlayerScript,
  createPipelineTruthBible
} from "../src/pipeline-matrix-deepseek.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const backendRoot = join(root, "backend");
const slug = "雾港回声";
const exampleDir = join(root, "examples", "pending-review", slug);

for (const file of [join(backendRoot, ".env"), join(root, ".env")]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function loadJson(rel) {
  const path = join(exampleDir, rel);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

const baseInput = loadJson("layers/01-setup.json") || {
  setting: { theme: "雾港回声", playerCount: 4, chapterCount: 3, volumeTier: "demo", pov: "second" },
  synopsis: { body: "暴雨夜灯塔失联。", charactersSketch: "", truthSketch: "", redHerringsSketch: "" }
};

const layer = arg("layer", "script");
const roleKey = arg("role", "role-3");
const actKey = arg("act", "ch1");

async function main() {
  const { setting, synopsis, config } = resolveCreativePipeline(baseInput);
  let payload = { setting, synopsis, config };

  if (layer === "truth") {
    const r = await createPipelineTruthBible(payload);
    console.log(JSON.stringify({ layer, killer: r.truthBible.killer, summaryLen: r.truthBible.summary?.length }, null, 2));
    return;
  }

  payload.truthBible = loadJson("layers/02-truth-bible.json") || (await createPipelineTruthBible(payload)).truthBible;

  if (layer === "characters") {
    const r = await createPipelineCharacterArchives(payload);
    console.log(JSON.stringify({ layer, roles: r.characterArchives.roles.map((r) => r.key) }, null, 2));
    return;
  }

  payload.characterArchives =
    loadJson("layers/03-character-archives.json") || (await createPipelineCharacterArchives(payload)).characterArchives;

  if (layer === "matrix") {
    const r = await createPipelineInfoMatrix(payload);
    console.log(JSON.stringify({ layer, rows: r.infoMatrix.rows.length, clues: r.infoMatrix.clues.length }, null, 2));
    return;
  }

  payload.infoMatrix =
    loadJson("layers/04-info-matrix.json") || (await createPipelineInfoMatrix(payload)).infoMatrix;
  payload.scripts = {};

  const r = await createPipelineMatrixPlayerScript({ ...payload, roleKey, actKey, deAiPass: false });
  console.log(
    JSON.stringify(
      {
        layer: "script",
        roleKey,
        actKey,
        mode: r.scriptGenerationMode,
        bodyLen: r.script.body?.length,
        structuredGates: r.structuredGates,
        hasStructured: Boolean(r.script.structured),
        feelings: r.script.structured?.feelingsPack?.emotions?.slice(0, 2)
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
