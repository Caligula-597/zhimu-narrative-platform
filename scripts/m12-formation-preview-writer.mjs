/**
 * M12 Formation 受控生成实验 CLI（Preview Writer V1）
 *
 *   node scripts/m12-formation-preview-writer.mjs --mode=mock
 *   node scripts/m12-formation-preview-writer.mjs --mode=real
 *   node scripts/m12-formation-preview-writer.mjs --mode=real --audiences=P1,P2,HOST
 *
 * 链路（钉死）：
 *   ProjectStoryState → F2 Builder → F3 Gate → FORMATION_READY
 *   → Preview Writer Packet（可见性严格投射）→ Writer 模型（real|mock）→ 实际成品落盘
 *
 * 产物：captures/m12-formation-preview/<timestamp>/
 *   run.json            — 实验元数据（fixture、gate、audiences、diagnostics 汇总）
 *   packet-<id>.json    — 每个受众的 Writer Packet
 *   output-<id>.json    — 模型实际产出 + 自检 diagnostics
 *
 * 本实验不做 F4（Beat 压缩 / Integrator / PMD / Writer 产品化）。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProjectStoryState } from "../shared/story-mechanism-contracts.js";
import { upsertM12FormationArtifact } from "../shared/m12-formation-contracts.js";
import { buildM12FormationArtifact } from "../shared/m12-formation-builder.js";
import { validateM12Formation } from "../shared/m12-formation-validator.js";
import { buildM12FormationPreviewPackets } from "../shared/m12-formation-writer-packet.js";
import { runM12PreviewWriter, MockPreviewWriterLlm } from "../shared/m12-formation-preview-writer.js";
import { DeepseekScriptWriterLlm } from "../shared/deepseek-script-writer-llm.js";

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
  const fixturePath =
    argValue("--fixture") ||
    path.join(root, "fixtures/m12-formation/closed-after-hours-gold.json");
  const contextPath =
    argValue("--context") ||
    path.join(root, "fixtures/m12-formation/closed-after-hours-context.json");
  const audiencesArg = argValue("--audiences") || "P1,P2,HOST";
  const outDir =
    argValue("--out") ||
    path.join(
      root,
      "captures/m12-formation-preview",
      `${mode}-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    );

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const context = JSON.parse(fs.readFileSync(contextPath, "utf8"));
  const audiences = audiencesArg
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((token) => (token.toUpperCase() === "HOST" ? { type: "HOST" } : { type: "CHARACTER", characterId: token }));

  // ── 1. ProjectStoryState（权威）→ F2 Builder ────────────────────
  let state = createProjectStoryState({
    projectId: fixture.projectId,
    mechanismBlocks: [
      {
        id: fixture.sourceBlockId,
        templateId: "M12-1",
        revision: fixture.sourceBlockRevision,
        status: "USER_ACCEPTED",
        roleBindings: {
          bargainA: fixture.participants.seekerId,
          bargainB: fixture.participants.holderId,
        },
      },
    ],
  });

  const built = buildM12FormationArtifact({
    state,
    sourceBlockId: fixture.sourceBlockId,
    artifactId: fixture.id,
    authoredFormation: {
      stake: fixture.stake,
      nodes: fixture.nodes,
      formation: fixture.formation,
      proof: fixture.proof,
    },
  });
  if (!built.ok) {
    console.error("F2 Builder 拒绝：", JSON.stringify(built.errors, null, 2));
    process.exit(1);
  }
  state = upsertM12FormationArtifact(state, built.artifact);

  // ── 2. F3 Gate：必须 FORMATION_READY 才喂给 Writer ───────────────
  const gate = validateM12Formation({ state, artifactId: built.artifact.id });
  console.log(`F3 Gate decision: ${gate.decision}`);
  if (gate.decision !== "FORMATION_READY") {
    console.error("Formation 未通过 Gate，实验终止（不喂 Writer）：");
    console.error(JSON.stringify(gate.issues, null, 2));
    process.exit(1);
  }

  // ── 3. 可见性投射 → Writer Packets ──────────────────────────────
  const packetResult = buildM12FormationPreviewPackets({
    artifact: built.artifact,
    gateResult: gate,
    context,
    audiences,
  });
  if (!packetResult.ok) {
    console.error("Packet 构建失败：", JSON.stringify(packetResult.errors, null, 2));
    process.exit(1);
  }

  // ── 4. Writer（real | mock）────────────────────────────────────
  const llm = mode === "real" ? new DeepseekScriptWriterLlm() : new MockPreviewWriterLlm();
  if (mode === "real" && !llm.configured) {
    console.error("mode=real 但 DEEPSEEK_API_KEY 缺失（先配置 .env 或改用 --mode=mock）");
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const run = {
    experiment: "M12_FORMATION_CONTENT_GENERATION_PREVIEW_V1",
    mode,
    model: mode === "real" ? llm.modelId : "mock",
    fixture: path.relative(root, fixturePath),
    context: path.relative(root, contextPath),
    artifactId: built.artifact.id,
    gateDecision: gate.decision,
    audiences: [],
    allOk: true,
  };

  for (const packet of packetResult.packets) {
    const audienceId =
      packet.audienceType === "HOST" ? "HOST" : packet.audience.characterId;
    const label =
      packet.audienceType === "HOST" ? "主持手册" : `${packet.audience.name}角色本`;

    fs.writeFileSync(path.join(outDir, `packet-${audienceId}.json`), JSON.stringify(packet, null, 2));

    const result = await runM12PreviewWriter({ packet, llm });
    const entry = {
      audienceId,
      label,
      ok: result.ok,
      diagnostics: result.diagnostics,
    };
    run.audiences.push(entry);
    if (!result.ok) run.allOk = false;

    fs.writeFileSync(
      path.join(outDir, `output-${audienceId}.json`),
      JSON.stringify(
        {
          audienceId,
          label,
          output: result.output || null,
          raw: result.raw || null,
          diagnostics: result.diagnostics,
        },
        null,
        2,
      ),
    );

    console.log(
      `${result.ok ? "✔" : "✖"} ${label}（${audienceId}）` +
        ` parseOk=${result.diagnostics.parseOk}` +
        ` sections=${result.diagnostics.sectionCount}` +
        ` metaHits=${result.diagnostics.metaPromptHits.length}` +
        ` dealHits=${result.diagnostics.prewrittenDealHits.length}`,
    );
  }

  fs.writeFileSync(path.join(outDir, "run.json"), JSON.stringify(run, null, 2));
  console.log(`\n产物目录：${path.relative(root, outDir)}`);
  console.log(run.allOk ? "实验完成（全部受众产出成功）" : "实验完成（部分受众失败，见 run.json）");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
