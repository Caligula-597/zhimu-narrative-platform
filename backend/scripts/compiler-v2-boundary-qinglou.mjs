#!/usr/bin/env node
/**
 * Mechanical bound-manuscript split trial (NO LLM / NO DeepSeek).
 *
 *   node backend/scripts/compiler-v2-boundary-qinglou.mjs
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveManuscriptBoundaries,
  segmentsToOpeningPackageInput
} from "../src/compiler-v2/manuscript-boundary-resolver.js";
import { createEmptyCompilerV2State } from "../src/compiler-v2/state.js";
import { runCompilerV2Pipeline } from "../src/compiler-v2/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const docxPath = path.join(root, "案例/561青楼/剧本.docx");
const outDir = path.join(root, "captures", "compiler-v2-trial", "qinglou-boundary-split");

const QINGLOU_CAST = ["白斋子", "齐剑心", "莫怀", "杜霄元", "陈一兔", "姜红儿", "舒悦"];

const buffer = await readFile(docxPath);
const result = resolveManuscriptBoundaries({
  buffer,
  characterNames: QINGLOU_CAST,
  minRoleChars: 800
});

const opening = segmentsToOpeningPackageInput(result.segments);

// Feed Stage 1–2 only (no LLM) to prove Opening Package path
const state = await runCompilerV2Pipeline(
  createEmptyCompilerV2State({ worldId: "qinglou_boundary", jobId: "boundary" }),
  {
    inputFiles: opening,
    toStage: "manuscript_ingest",
    enableTimelineLlm: false
  }
);

const report = {
  source: "案例/561青楼/剧本.docx",
  cast: QINGLOU_CAST,
  paragraphCount: result.paragraphs.length,
  validation: result.validation,
  sharedStages: result.sharedStages,
  preview: result.preview,
  compilerAfterIngest: {
    title: state.project?.title,
    titleStatus: state.project?.titleStatus,
    characters: (state.characters || []).map((c) => c.name),
    acts: (state.acts || []).map((a) => a.title),
    characterScripts: (state.characterScripts || []).length,
    crossTalk: (state.characterScripts || []).filter((s) => {
      const doc = (state.documents || []).find((d) => d.id === s.documentId);
      const ch = (state.characters || []).find((c) => c.id === s.characterId);
      return doc?.roleName && ch?.name && doc.roleName !== ch.name;
    }).length
  }
};

const md = `# 青楼合订本 Boundary Resolver（零 API）

来源：\`${report.source}\`

## Validation

\`\`\`json
${JSON.stringify(report.validation, null, 2)}
\`\`\`

## Shared stages suggestion

\`\`\`json
${JSON.stringify(report.sharedStages, null, 2)}
\`\`\`

## Split preview

| type | character | paras | chars | conf | head |
|---|---|---|---|---|---|
${report.preview
  .map(
    (p) =>
      `| ${p.type} | ${p.characterName || "-"} | ${p.startParagraph}–${p.endParagraph} | ${p.chars} | ${p.confidence.toFixed(2)}${p.needsConfirmation ? " ⚠" : ""} | ${p.head.replace(/\|/g, "/")} |`
  )
  .join("\n")}

## After Opening Package → Stage 1–2

\`\`\`json
${JSON.stringify(report.compilerAfterIngest, null, 2)}
\`\`\`
`;

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
await writeFile(path.join(outDir, "REPORT.md"), md, "utf8");
await writeFile(
  path.join(outDir, "opening-package.json"),
  JSON.stringify(
    {
      ...opening,
      hostHandbook: {
        filename: opening.hostHandbook?.filename,
        chars: opening.hostHandbook?.text?.length
      },
      roleScripts: opening.roleScripts.map((r) => ({
        characterName: r.characterName,
        filename: r.filename,
        chars: r.text.length
      }))
    },
    null,
    2
  ),
  "utf8"
);

console.log("paragraphs", report.paragraphCount);
console.log("validation", report.validation);
console.log(
  "roles",
  report.preview.filter((p) => p.type === "CHARACTER").map((p) => `${p.characterName}:${p.chars}`)
);
console.log("sharedStages", report.sharedStages?.label);
console.log("compiler", report.compilerAfterIngest);
console.log("→", outDir);
