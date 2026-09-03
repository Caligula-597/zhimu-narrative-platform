#!/usr/bin/env node
/**
 * Offline Compiler V2 trial — Opening Package slots only (no merged-block role guessing).
 *
 * Usage:
 *   node backend/scripts/compiler-v2-trial.mjs
 *
 * Acceptance focus (no LLM): Project title, Characters from slots,
 * CharacterScripts zero cross-talk, Acts = real 第N幕, Clues from clue slots.
 */
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createEmptyCompilerV2State,
  summarizeStateForStatus
} from "../src/compiler-v2/state.js";
import { runCompilerV2Pipeline } from "../src/compiler-v2/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const outRoot = path.join(root, "captures", "compiler-v2-trial");

function preview(text, n = 120) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);
}

/**
 * Run Stage 1 → toStage via real Opening Package input contract.
 */
async function runFromOpeningPackage({ worldId, label, inputFiles, toStage = "clue_asset" }) {
  const initial = createEmptyCompilerV2State({ worldId, jobId: `trial_${label}` });
  return runCompilerV2Pipeline(initial, { inputFiles, toStage });
}

function reportFromState(label, sourceNote, state, extra = {}) {
  const summary = summarizeStateForStatus(state);
  const scriptsByChar = new Map();
  for (const s of state.characterScripts || []) {
    const name = (state.characters || []).find((c) => c.id === s.characterId)?.name || "?";
    if (!scriptsByChar.has(name)) scriptsByChar.set(name, []);
    scriptsByChar.get(name).push(s);
  }

  // Cross-talk check: each script's document must match character
  const crossTalk = [];
  for (const s of state.characterScripts || []) {
    const doc = (state.documents || []).find((d) => d.id === s.documentId);
    const ch = (state.characters || []).find((c) => c.id === s.characterId);
    if (doc?.roleName && ch?.name && doc.roleName !== ch.name) {
      crossTalk.push({ scriptId: s.id, docRole: doc.roleName, charName: ch.name });
    }
    if (doc?.characterId && doc.characterId !== s.characterId) {
      crossTalk.push({ scriptId: s.id, reason: "document.characterId mismatch" });
    }
  }

  const sectionLens = (state.sourceSections || []).map((s) => (s.originalText || "").length);
  const maxSection = sectionLens.length ? Math.max(...sectionLens) : 0;
  const avgSection = sectionLens.length
    ? Math.round(sectionLens.reduce((a, b) => a + b, 0) / sectionLens.length)
    : 0;

  return {
    label,
    sourceNote,
    status: state.job?.status,
    stoppedAt: state.job?.currentStage,
    project: state.project,
    counts: summary.counts,
    characters: (state.characters || []).map((c) => ({
      name: c.name,
      nameStatus: c.nameStatus,
      nameSource: c.nameSource,
      scriptCount: (scriptsByChar.get(c.name) || []).length,
      documentFilename: (state.documents || []).find((d) => d.id === c.documentId)?.filename
    })),
    acts: (state.acts || []).map((a) => ({ title: a.title, explicit: a.explicit })),
    crossTalk,
    sourceSectionStats: {
      count: sectionLens.length,
      maxChars: maxSection,
      avgChars: avgSection,
      over8k: sectionLens.filter((n) => n > 8000).length
    },
    sampleCharacterScripts: (state.characterScripts || []).slice(0, 8).map((s) => ({
      character: (state.characters || []).find((c) => c.id === s.characterId)?.name,
      title: s.title,
      bodyPreview: preview(s.originalContent, 100),
      documentId: s.documentId,
      sourceSectionIds: s.sourceSectionIds
    })),
    sampleSourceSections: (state.sourceSections || []).slice(0, 6).map((s) => ({
      headingPath: s.headingPath,
      preview: preview(s.originalText, 80),
      chars: (s.originalText || "").length,
      offsets: [s.startOffset, s.endOffset]
    })),
    sampleClues: (state.clues || []).slice(0, 12).map((c) => ({
      title: c.title,
      sourceSlot: c.sourceSlot,
      sourceFile: c.sourceFile,
      preview: preview(c.content, 80)
    })),
    scenes: (state.scenes || []).map((s) => s.name),
    mechanisms: (state.mechanisms || []).map((m) => ({
      title: m.title,
      matchStatus: m.matchStatus,
      matchedTemplateKey: m.matchedTemplateKey
    })),
    unresolved: (state.unresolved || []).map((u) => ({
      stage: u.stage,
      kind: u.kind,
      field: u.field,
      message: u.message
    })),
    warnings: (state.warnings || []).map((w) => ({
      stage: w.stage,
      code: w.code,
      message: w.message
    })),
    ...extra
  };
}

function toMarkdown(report) {
  const acceptance = [
    `### Acceptance checklist (no LLM)`,
    ``,
    `| Check | Result |`,
    `|---|---|`,
    `| Project title HIGH / null | \`${report.project?.title ?? "null"}\` / ${report.project?.titleStatus} |`,
    `| Characters from slots only | ${report.characters?.length ?? 0} |`,
    `| CharacterScript cross-talk | ${report.crossTalk?.length ? "FAIL " + report.crossTalk.length : "PASS 0"} |`,
    `| Acts explicit 第N幕 only | ${(report.acts || []).map((a) => a.title).join(", ") || "（空 — 无假 fallback Act）"} |`,
    `| Clues from clue slots | ${report.counts?.clues ?? 0} (files: ${[...new Set((report.sampleClues || []).map((c) => c.sourceFile))].join(", ") || "none"}) |`,
    `| SourceSection max chars | ${report.sourceSectionStats?.maxChars ?? 0} (avg ${report.sourceSectionStats?.avgChars ?? 0}) |`,
    ``
  ];

  return [
    `# Compiler V2 试跑：${report.label}`,
    "",
    `来源：${report.sourceNote}`,
    "",
    `状态：**${report.status}** · stoppedAt=\`${report.stoppedAt}\` · ${report.elapsedMs}ms`,
    "",
    ...acceptance,
    "## Project",
    "",
    "```json",
    JSON.stringify(report.project, null, 2),
    "```",
    "",
    "## Counts",
    "",
    "```json",
    JSON.stringify(report.counts, null, 2),
    "```",
    "",
    "## Characters",
    "",
    "```json",
    JSON.stringify(report.characters, null, 2),
    "```",
    "",
    "## Acts",
    "",
    "```json",
    JSON.stringify(report.acts, null, 2),
    "```",
    "",
    "## Cross-talk",
    "",
    "```json",
    JSON.stringify(report.crossTalk, null, 2),
    "```",
    "",
    "## Sample character scripts",
    "",
    "```json",
    JSON.stringify(report.sampleCharacterScripts, null, 2),
    "```",
    "",
    "## Sample source sections",
    "",
    "```json",
    JSON.stringify(report.sampleSourceSections, null, 2),
    "```",
    "",
    "## Sample clues",
    "",
    "```json",
    JSON.stringify(report.sampleClues, null, 2),
    "```",
    "",
    "## Scenes / Mechanisms (should be empty without LLM / mechanism slot)",
    "",
    "```json",
    JSON.stringify({ scenes: report.scenes, mechanisms: report.mechanisms }, null, 2),
    "```",
    "",
    "## Unresolved",
    "",
    "```json",
    JSON.stringify(report.unresolved, null, 2),
    "```",
    "",
    "## Warnings",
    "",
    "```json",
    JSON.stringify(report.warnings, null, 2),
    "```",
    ""
  ].join("\n");
}

/** 长生叹：真 Opening Package（主持 + 每人一份角色本） */
async function loadChangshengTanOpeningPackage() {
  const dir = path.join(root, "data-zhimu", "changsheng-tan");
  const files = await readdir(dir);
  const txts = files.filter((f) => f.endsWith(".txt"));
  const byName = Object.fromEntries(
    await Promise.all(txts.map(async (f) => [f, await readFile(path.join(dir, f), "utf8")]))
  );

  const hostName = txts.find((f) => f.includes("主持"));
  if (!hostName) throw new Error("changsheng-tan: missing 主持人.txt");
  const roleFiles = txts.filter((f) => f !== hostName);

  return {
    label: "changsheng-tan-slots",
    sourceNote:
      "Opening Package 槽位：data-zhimu/changsheng-tan/{主持人.txt + 6 角色.txt}；不猜归属；toStage=clue_asset",
    inputFiles: {
      rightsConfirmed: true,
      creationType: "murder_mystery",
      hostHandbook: { filename: hostName, text: byName[hostName] },
      roleScripts: roleFiles.map((f) => ({
        filename: f,
        characterName: f.replace(/\.txt$/i, ""),
        text: byName[f]
      })),
      clueTextFiles: [],
      clueImages: [],
      notes: "试跑备注：长生叹无独立线索槽文件"
    }
  };
}

/**
 * 青楼：仅主持手册原文（JSON blocks 合并为 hostHandbook）。
 * 故意不做角色启发式切分 —— 缺少 roleScripts 槽位时应 NEEDS_CONFIRMATION。
 * 若后续有分角色上传，再补 roleScripts。
 */
async function loadQinglouHostOnlyOpeningPackage() {
  const jsonPath = path.join(root, "data-zhimu", "qinglou-v0.1-chat", "qinglou-v0.1.json");
  const data = JSON.parse(await readFile(jsonPath, "utf8"));
  const blocks = data.sources?.[0]?.blocks || [];
  if (!blocks.length) throw new Error("qinglou JSON has no source blocks");

  // Host-only: first imprint region before role books typically ~BLK0–60
  // BUT we do not split roles from the rest — rest is ignored until real role uploads exist.
  const hostEnd = 61;
  const hostText = blocks
    .slice(0, hostEnd)
    .map((b) => b.text)
    .join("\n\n");

  return {
    label: "qinglou-host-slot-only",
    sourceNote:
      "Opening Package：仅 hostHandbook=qinglou-v0.1.json BLK0–60 合并正文；roleScripts=[]（不启发式切角色）；无线索槽。验证：标题=青楼、不串台、不伪造幕/线索",
    inputFiles: {
      rightsConfirmed: true,
      creationType: "murder_mystery",
      hostHandbook: { filename: "组织者手册.txt", text: hostText },
      roleScripts: [],
      clueTextFiles: [],
      clueImages: [],
      notes: "试跑：青楼尚无分角色 Opening Package 文件；角色槽故意留空"
    }
  };
}

async function runOne(pack) {
  console.log(`\n=== Running ${pack.label} ===`);
  console.log(pack.sourceNote);
  const started = Date.now();
  const state = await runFromOpeningPackage({
    worldId: `trial_${pack.label}`,
    label: pack.label,
    inputFiles: pack.inputFiles,
    toStage: "clue_asset"
  });
  // Still run integrity for structural warnings without inventing timeline/mech
  const { STAGE_RUNNERS } = await import("../src/compiler-v2/index.js");
  let withIntegrity = await STAGE_RUNNERS.integrity_check(state);
  withIntegrity = {
    ...withIntegrity,
    job: { ...withIntegrity.job, status: "needs_review", currentStage: "clue_asset+integrity" }
  };

  const elapsedMs = Date.now() - started;
  const report = reportFromState(pack.label, pack.sourceNote, withIntegrity, { elapsedMs });

  const dir = path.join(outRoot, pack.label);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "state.json"), JSON.stringify(withIntegrity, null, 2), "utf8");
  await writeFile(path.join(dir, "report.json"), JSON.stringify(report, null, 2), "utf8");
  await writeFile(path.join(dir, "REPORT.md"), toMarkdown(report), "utf8");
  console.log(`done in ${elapsedMs}ms → ${dir}`);
  console.log(
    `  title=${report.project?.title} chars=${report.characters.length} scripts=${report.counts.characterScripts} acts=${report.acts.map((a) => a.title).join("|")} crossTalk=${report.crossTalk.length} clues=${report.counts.clues}`
  );
  return report;
}

const reports = [];
reports.push(await runOne(await loadChangshengTanOpeningPackage()));
reports.push(await runOne(await loadQinglouHostOnlyOpeningPackage()));

await mkdir(outRoot, { recursive: true });
await writeFile(
  path.join(outRoot, "summary.json"),
  JSON.stringify(
    reports.map((r) => ({
      label: r.label,
      status: r.status,
      elapsedMs: r.elapsedMs,
      project: { title: r.project?.title, titleStatus: r.project?.titleStatus },
      counts: r.counts,
      characters: (r.characters || []).map((c) => c.name),
      acts: r.acts,
      crossTalk: r.crossTalk?.length || 0,
      unresolvedCount: r.unresolved.length,
      warningCount: r.warnings.length
    })),
    null,
    2
  ),
  "utf8"
);

console.log("\n=== SUMMARY ===");
for (const r of reports) {
  console.log(
    `${r.label}: title=${r.project?.title} chars=${r.characters.length} scripts=${r.counts.characterScripts} acts=${(r.acts || []).map((a) => a.title).join(",")} crossTalk=${r.crossTalk.length} clues=${r.counts.clues} warn=${r.warnings.length}`
  );
}
console.log(`Artifacts: ${outRoot}`);
