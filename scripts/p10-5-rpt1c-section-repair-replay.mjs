/**
 * P10.5.1 RPT #1C Section Repair Replay — failed sections only, max 1 regen each.
 *
 *   node scripts/p10-5-rpt1c-section-repair-replay.mjs --mode=mock
 *   node scripts/p10-5-rpt1c-section-repair-replay.mjs --mode=real
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProjectStoryState } from "../shared/story-mechanism-contracts.js";
import { listAcceptedStoryBlocks } from "../shared/master-outline-integrator.js";
import { expandProductionMasterDraft } from "../shared/production-master-draft-expander.js";
import { buildScriptProductionPacketSet } from "../shared/script-production-packets.js";
import { enrichPacketSetWithNarrativeContext } from "../shared/script-writer-packet-enrichment.js";
import {
  attachGroundedProjectionsToPacketSet,
  auditProductionProjection,
} from "../shared/production-projection-audit.js";
import { buildGroundedExperienceProjection } from "../shared/production-projection-grounding.js";
import { semanticsBridgeForTemplate } from "../shared/complete-beat-semantics-data.js";
import { evaluateScriptProductionReadiness } from "../shared/script-production-gate.js";
import {
  regenerateScriptProductionJob,
} from "../shared/script-production-orchestrator.js";
import { runSectionScopedAdherenceRepair } from "../shared/script-writer-rendering-repair.js";
import { diffPackageRenderingAgainstGrounded } from "../shared/script-writer-rendering-adherence-diff.js";
import { DeterministicTestScriptWriter } from "../shared/deterministic-test-script-writer.js";
import { RealScriptWriter } from "../shared/real-script-writer.js";
import { DeepseekScriptWriterLlm } from "../shared/deepseek-script-writer-llm.js";
import { normalizeScriptWriterResult } from "../shared/script-writer-result-contracts.js";
import { packetAllowLists } from "../shared/script-production-packets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const RUN =
  process.env.RPT1C_RUN_DIR ||
  path.join(root, "trials/rpt-1-closed-after-hours/runs/2026-09-06T09-32-02-159Z");
const outPath =
  process.env.P10_5_REPAIR_OUT ||
  path.join(root, "captures/p10-5-rpt1c-section-repair-replay.json");

function loadEnvFiles(...files) {
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
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

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/**
 * Mock repair writer: when repairBrief present, emit adherence-safe stubs
 * (still provenance-linked). Used for offline replay without burning API.
 */
class AdherenceRepairStubWriter {
  async write(request) {
    const packet = request.packet || {};
    const kind = request.packetKind || packet.kind;
    const allows = packetAllowLists(packet);
    const brief = request.repairBrief;
    const name = packet.characterName || "角色";
    const seeker = brief?.mustKeep?.find((l) => l.startsWith("seeker ="))?.split("=")[1]?.trim() || "沈岚";
    const holder = brief?.mustKeep?.find((l) => l.startsWith("holder ="))?.split("=")[1]?.trim() || "梁赫";
    const stake =
      brief?.mustKeep?.find((l) => l.startsWith("stake ="))?.split("=")[1]?.trim() ||
      "未公开的预展目录册";

    const stages = Array.isArray(packet.stages) ? packet.stages : [{ stageId: "act1" }];
    const mk = (stageId, title, paragraphs) => ({
      sectionId: `${packet.characterId || kind}-${stageId}`,
      stageId,
      title,
      paragraphs,
      provenance: {
        sourceBeatIds: (allows.allowedSourceBeatIds || []).slice(0, 4),
        sourceClueIds: (allows.allowedClueIds || []).slice(0, 2),
        sourceFactIds: (allows.allowedFactIds || []).slice(0, 2),
      },
      canonicalClaims: [],
      inventedCharacterIds: [],
      inventedStageIds: [],
    });

    let sections = [];
    if (kind === "ROLE_SCRIPT") {
      const isSeeker = name === seeker;
      const isHolder = name === holder;
      const isPrimary = isSeeker || isHolder;
      sections = stages.map((st, i) => {
        const stageId = st.stageId || st || `act${i + 1}`;
        if (isHolder) {
          return mk(stageId, `修复·${name}`, [
            `你是${holder}。你开场掌握${stake}。${seeker}是需求方。`,
            `你提出可谈判条件。${seeker}可以接受、反提或拒绝——结果尚未发生，等待对方回应。`,
            `在对方明确回应之前，你不宣布成交，也不完成换手。`,
          ]);
        }
        if (isSeeker) {
          return mk(stageId, `修复·${name}`, [
            `你是${seeker}。你想得到${stake}，但它目前由${holder}掌握。`,
            `你试探对方开价，并准备接受、反提或拒绝。交接尚未发生。`,
            `你不会在开场声称自己已持有${stake}。`,
          ]);
        }
        return mk(stageId, `修复·${name}`, [
          `你是${name}。你在场观察相关行为，但不主导交换，也不核对自己的隐藏身份主线。`,
          `你可以看到公开后果，但不继承他人 OWNER 的目标与决策。`,
          `你不提出交换代价，也不完成目录册换手。`,
        ]);
      });
    } else if (kind === "PUBLIC_STAGE") {
      const stageId = packet.stageId || "act1";
      sections = [
        mk(stageId, "修复·公共", [
          `${seeker}与${holder}围绕${stake}进行试探。选择仍开放：接受、反提或拒绝。`,
          `同场者可感知紧张气氛。交接未自动完成。`,
        ]),
      ];
    } else if (kind === "HOST_SCRIPT") {
      sections = stages.map((st, i) => {
        const stageId = st.stageId || `act${i + 1}`;
        return mk(stageId, `修复·主持`, [
          `请推进本幕互动。${seeker}与${holder}的谈判结果由玩家决定，主持不宣布成交。`,
        ]);
      });
    } else {
      const det = new DeterministicTestScriptWriter();
      return det.write(request);
    }

    return normalizeScriptWriterResult({
      requestId: request.requestId,
      packetKind: kind,
      sections,
      proposedCanonicalChanges: [],
      diagnostics: [],
    });
  }
}

async function main() {
  loadEnvFiles(path.join(root, ".env"), path.join(root, "backend", ".env"));
  const mode = argValue("--mode") || "mock";

  const frozenPkg = readJson(path.join(RUN, "complete-script-package.json"));
  const frozenStates = readJson(path.join(RUN, "writer-section-states.json"));
  const projectionAudit = readJson(path.join(RUN, "projection-audit.json"));
  const contextProfile = readJson(path.join(RUN, "context-profile.json"));
  const storyStateRaw = readJson(path.join(RUN, "story-state.json"));
  const outline = readJson(path.join(RUN, "master-outline.json"));
  const pmdFrozen = readJson(path.join(RUN, "pmd.json"));

  const state = createProjectStoryState({
    ...storyStateRaw,
    masterOutlineDraft: outline,
  });
  const pmd = expandProductionMasterDraft(state, {
    title: pmdFrozen.title || "P10.5.1 repair",
    contextProfile,
    preserveId: pmdFrozen.id,
  });
  const gate = evaluateScriptProductionReadiness(pmd);
  const blocks = listAcceptedStoryBlocks(state);
  const groundedProjections = blocks
    .map((block) =>
      buildGroundedExperienceProjection({
        block,
        contextProfile,
        bridge: semanticsBridgeForTemplate(block.templateId),
      }),
    )
    .filter(Boolean);

  let packetSet = enrichPacketSetWithNarrativeContext(buildScriptProductionPacketSet(pmd), {
    contextProfile,
  });
  packetSet = attachGroundedProjectionsToPacketSet(packetSet, groundedProjections);
  const liveAudit = auditProductionProjection({
    storyState: state,
    productionMasterDraft: pmd,
    packetSet,
    contextProfile,
    groundedProjections,
  });

  // Seed section states from frozen #1C writer outputs so we repair the same failures
  const sectionStates = frozenStates.map((s) => ({
    ...s,
    packet: s.packet || packetSet.roles?.find((r) => `role:${r.characterId}` === s.sectionId) || s.packet,
  }));

  // Ensure packets attached for regenerate
  const jobsByKey = new Map();
  for (const role of packetSet.roles || []) {
    jobsByKey.set(`role:${role.characterId}`, role);
  }
  for (const pub of packetSet.publicStages || []) {
    jobsByKey.set(`public:${pub.stageId}`, pub);
  }
  jobsByKey.set("host", packetSet.host);
  jobsByKey.set("ending", packetSet.ending);

  const seededStates = sectionStates.map((s) => ({
    ...s,
    packet: s.packet || jobsByKey.get(s.sectionId) || s.packet,
    characterId: s.characterId || s.packet?.characterId || null,
  }));

  const production = {
    pmd,
    packetSet,
    gate,
    sectionStates: seededStates,
    package: frozenPkg,
    projectionAudit: liveAudit.ok ? liveAudit : projectionAudit,
    validation: { ok: true },
    contextRevision: contextProfile.revision,
  };

  const before = diffPackageRenderingAgainstGrounded({
    package: frozenPkg,
    groundedExperience: packetSet.groundedExperience,
    packetCaptures: production.projectionAudit.packetCaptures,
  });

  let writer;
  if (mode === "real") {
    const llm = new DeepseekScriptWriterLlm();
    if (!llm.configured) throw new Error("DEEPSEEK_NOT_CONFIGURED");
    writer = new RealScriptWriter({
      llm,
      contextRevision: contextProfile.revision,
    });
  } else {
    writer = new AdherenceRepairStubWriter();
  }

  const repair = await runSectionScopedAdherenceRepair({
    production,
    writer,
    regenerateJob: regenerateScriptProductionJob,
    issues: before.issues,
    contextProfile,
    maxRepairsPerSection: 1,
  });

  const report = {
    mode,
    runDir: RUN,
    before: {
      status: before.status,
      summary: before.summary,
      codes: before.codes,
    },
    after: {
      status: repair.adherenceAfter.status,
      summary: repair.adherenceAfter.summary,
      codes: repair.adherenceAfter.codes,
      ok: repair.adherenceAfter.ok,
    },
    repairLog: repair.repairLog,
    deltas: {
      relationInverted: [
        before.summary?.relationInverted ?? 0,
        repair.adherenceAfter.summary?.relationInverted ?? 0,
      ],
      roleScopeInvented: [
        before.summary?.roleScopeInvented ?? 0,
        repair.adherenceAfter.summary?.roleScopeInvented ?? 0,
      ],
      choicePreResolved: [
        before.summary?.choicePreResolved ?? 0,
        repair.adherenceAfter.summary?.choicePreResolved ?? 0,
      ],
      instructionLeak: [
        before.summary?.instructionLeak ?? 0,
        repair.adherenceAfter.summary?.instructionLeak ?? 0,
      ],
    },
    status: repair.status,
  };

  writeJson(outPath, report);
  console.log(JSON.stringify({ outPath, mode, status: repair.status, deltas: report.deltas, jobs: repair.repairLog.map((r) => r.jobKey) }, null, 2));

  if (!repair.adherenceAfter.ok) {
    console.error("P10.5.1 Section Repair Replay: still RENDERING_REVIEW_REQUIRED");
    process.exitCode = 1;
    return;
  }
  console.log("P10.5.1 Section Repair Replay PASS (four defect classes → 0)");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
