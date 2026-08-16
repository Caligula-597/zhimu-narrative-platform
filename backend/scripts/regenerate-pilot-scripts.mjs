/**
 * Batch-regenerate pilot act outlines + player scripts (fresh prose, new literary style).
 * Keeps truth / matrix / characters; does not reuse prior script bodies.
 *
 * Usage:
 *   node backend/scripts/regenerate-pilot-scripts.mjs 停雪公馆 --style luxun
 *   node backend/scripts/regenerate-pilot-scripts.mjs 停雪公馆 --style delicate --skip-outlines
 *   node backend/scripts/regenerate-pilot-scripts.mjs 停雪公馆 --no-readthrough
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deepseekConfig } from "../src/deepseek.js";
import { buildLiteraryStyleCard } from "../src/prompts/matrix-literary-styles.js";
import {
  createPipelineActOutline,
  createPipelineMatrixPlayerScript,
  createPipelineMatrixScriptReadthroughEvaluation
} from "../src/pipeline-matrix-deepseek.js";
import { renderHumanReviewFiles } from "./matrix-pilot-review-render.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const slug = args[0] || "停雪公馆";
const pilotDir = join(root, "examples", "pending-review", slug);
const styleFlag = process.argv.find((a) => a.startsWith("--style="));
const styleArg = process.argv[process.argv.indexOf("--style") + 1];
const newStyle = styleFlag?.split("=")[1] || styleArg || "luxun";
const skipOutlines = process.argv.includes("--skip-outlines");
const noReadthrough = process.argv.includes("--no-readthrough");
const resume = process.argv.includes("--resume");

async function withRetry(label, fn, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await step(attempt > 1 ? `${label} (重试 ${attempt}/${maxAttempts})` : label, fn);
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        console.warn(`  ⚠ ${err.message || err} — 将重试`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
  throw lastErr;
}

function loadExistingScript(roleKey, actKey) {
  const p = join(pilotDir, `layers/09-scripts/${roleKey}_${actKey}.json`);
  return existsSync(p) ? loadJson(p) : null;
}

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

function writeJson(rel, data) {
  const path = join(pilotDir, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeText(rel, text) {
  const path = join(pilotDir, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

function clearDir(rel, exts = [".json", ".md"]) {
  const dir = join(pilotDir, rel);
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    if (exts.some((e) => f.endsWith(e))) unlinkSync(join(dir, f));
  }
}

async function step(label, fn) {
  process.stdout.write(`\n▶ ${label} … `);
  const t0 = Date.now();
  const result = await fn();
  console.log(`✓ ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return result;
}

async function main() {
  const cfg = deepseekConfig();
  if (!cfg.configured) {
    console.error("✗ DEEPSEEK_API_KEY 未配置，无法在线重生剧本");
    process.exit(1);
  }

  const sessionPath = join(pilotDir, "session.json");
  if (!existsSync(sessionPath)) {
    console.error(`✗ 找不到 ${sessionPath}`);
    process.exit(1);
  }

  const session = loadJson(sessionPath);
  const payload = {
    setting: { ...session.setting },
    synopsis: session.synopsis,
    config: session.config,
    truthBible: session.truthBible,
    characterArchives: session.characterArchives,
    clueNetwork: session.clueNetwork,
    infoMatrix: session.infoMatrix,
    reasoningNovel: existsSync(join(pilotDir, "layers/05-reasoning-novel.json"))
      ? loadJson(join(pilotDir, "layers/05-reasoning-novel.json"))
      : session.reasoningNovel,
    hostRunbooks: session.hostRunbooks
  };

  const prevStyle = payload.setting.literaryStyle;
  payload.setting.literaryStyle = newStyle;
  const styleCard = buildLiteraryStyleCard(payload.setting);
  payload.setting.literaryStyleLabel = styleCard.literaryStyleLabel;

  console.log(`\n=== ${slug} · 批量重生剧本 ===`);
  console.log(`体裁：${prevStyle} → ${newStyle}（${styleCard.literaryStyleLabel}）`);
  console.log(`模型：${cfg.model}`);

  const roles = payload.characterArchives.roles;
  const keys = payload.config.chapterKeys;
  payload.actOutlines = {};
  payload.scripts = {};

  if (!skipOutlines && !resume) {
    let n = 0;
    const total = roles.length * keys.length;
    for (const role of roles) {
      payload.actOutlines[role.key] = {};
      for (const actKey of keys) {
        n += 1;
        const r = await withRetry(`大纲 ${n}/${total} · ${role.name}/${actKey}`, () =>
          createPipelineActOutline({ ...payload, roleKey: role.key, actKey })
        );
        payload.actOutlines[role.key][actKey] = r.actOutline;
        writeJson(`layers/07-outlines/${role.key}_${actKey}.json`, r.actOutline);
      }
    }
  } else {
    for (const role of roles) {
      payload.actOutlines[role.key] = {};
      for (const actKey of keys) {
        const p = join(pilotDir, `layers/07-outlines/${role.key}_${actKey}.json`);
        payload.actOutlines[role.key][actKey] = existsSync(p) ? loadJson(p) : null;
      }
    }
  }

  if (!resume) {
    clearDir("layers/09-scripts");
    clearDir("scripts");
    clearDir("scripts-by-role");
  }

  let n = 0;
  const total = roles.length * keys.length;
  for (const role of roles) {
    payload.scripts[role.key] = payload.scripts[role.key] || {};
    for (const actKey of keys) {
      n += 1;
      if (resume) {
        const existing = loadExistingScript(role.key, actKey);
        if (existing?.body) {
          payload.scripts[role.key][actKey] = existing;
          console.log(`\n▶ 剧本 ${n}/${total} · ${role.name}/${actKey} … 跳过（已存在）`);
          continue;
        }
      }
      const r = await withRetry(`剧本 ${n}/${total} · ${role.name}/${actKey}`, () =>
        createPipelineMatrixPlayerScript({
          ...payload,
          roleKey: role.key,
          actKey,
          actOutline: payload.actOutlines[role.key][actKey],
          scripts: {},
          deAiPass: true
        })
      );
      payload.scripts[role.key][actKey] = r.script;
      writeJson(`layers/09-scripts/${role.key}_${actKey}.json`, r.script);
      writeJson(`layers/06-scripts/${role.key}_${actKey}.json`, r.script);
    }
  }

  for (const role of roles) {
    payload.scripts[role.key] = payload.scripts[role.key] || {};
    for (const actKey of keys) {
      if (!payload.scripts[role.key][actKey]) {
        const p = join(pilotDir, `layers/09-scripts/${role.key}_${actKey}.json`);
        if (existsSync(p)) payload.scripts[role.key][actKey] = loadJson(p);
      }
    }
  }

  writeJson("layers/01-setup.json", {
    setting: payload.setting,
    synopsis: payload.synopsis,
    config: payload.config
  });

  renderHumanReviewFiles(payload, writeText);

  session.setting = payload.setting;
  session.scripts = payload.scripts;
  session.actOutlines = payload.actOutlines;
  writeJson("session.json", session);

  writeJson("manifest.json", {
    ...loadJson(join(pilotDir, "manifest.json")),
    literaryStyle: newStyle,
    literaryStyleLabel: styleCard.literaryStyleLabel,
    regeneratedAt: new Date().toISOString(),
    promptVersion: "matrix-v5.6-expressive"
  });

  let readthrough = null;
  if (!noReadthrough) {
    const evalResult = await step("通读评判", () =>
      createPipelineMatrixScriptReadthroughEvaluation({
        setting: payload.setting,
        synopsis: payload.synopsis,
        config: payload.config,
        characterArchives: payload.characterArchives,
        scripts: payload.scripts
      })
    );
    readthrough = evalResult.evaluation;
    writeJson("layers/10-readthrough-evaluation.json", {
      slug,
      scoredAt: new Date().toISOString(),
      scoringStandard: "script-readthrough",
      literaryStyle: newStyle,
      literaryStyleLabel: styleCard.literaryStyleLabel,
      regenerated: true,
      llmEvaluation: readthrough
    });
  }

  console.log(`\n✓ 已写入 ${pilotDir}`);
  if (readthrough) {
    console.log(`\n通读 overallScore: ${readthrough.overallScore}`);
    console.log("  scores:", JSON.stringify(readthrough.scores));
    console.log(`  readyForPlayers: ${readthrough.readyForPlayers}`);
    console.log(`  verdict: ${readthrough.verdict}`);
    if (readthrough.weakCells?.length) {
      console.log("  weakCells:");
      for (const w of readthrough.weakCells.slice(0, 5)) {
        console.log(`    ${w.cell}: ${w.why}`);
      }
    }
    if (readthrough.standoutCells?.length) {
      console.log("  standoutCells:");
      for (const s of readthrough.standoutCells.slice(0, 3)) {
        console.log(`    ${s.cell}: ${s.why}`);
      }
    }
  }
}

main().catch((e) => {
  console.error("\n✗", e.message || e);
  process.exit(1);
});
