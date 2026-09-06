/**
 * P10.4 RPT #1B Packet Probe — offline, no real model.
 *
 * Rebuilds PMD + packets from frozen story-state with grounding fixes,
 * then hard-gates Writer inputs.
 *
 *   node scripts/p10-4-rpt1b-packet-probe.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expandProductionMasterDraft } from "../shared/production-master-draft-expander.js";
import { buildScriptProductionPacketSet } from "../shared/script-production-packets.js";
import { enrichPacketSetWithNarrativeContext } from "../shared/script-writer-packet-enrichment.js";
import {
  attachGroundedProjectionsToPacketSet,
  auditProductionProjection,
  traceProductionProjection,
} from "../shared/production-projection-audit.js";
import { buildGroundedExperienceProjection } from "../shared/production-projection-grounding.js";
import { semanticsBridgeForTemplate } from "../shared/complete-beat-semantics-data.js";
import { listAcceptedStoryBlocks } from "../shared/master-outline-integrator.js";
import { createProjectStoryState } from "../shared/story-mechanism-contracts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const RUN =
  process.env.RPT1B_RUN_DIR ||
  path.join(
    root,
    "trials/rpt-1-closed-after-hours/runs/2026-09-06T08-03-37-863Z",
  );
const outPath =
  process.env.P10_4_PROBE_OUT ||
  path.join(root, "captures/p10-4-rpt1b-packet-probe.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const frozenStory = readJson(path.join(RUN, "story-state.json"));
const frozenOutline = readJson(path.join(RUN, "master-outline.json"));
const frozenPmd = readJson(path.join(RUN, "pmd.json"));
const frozenPkg = readJson(path.join(RUN, "complete-script-package.json"));
const contextProfile = readJson(path.join(RUN, "context-profile.json"));

const state = createProjectStoryState({
  ...frozenStory,
  masterOutlineDraft: frozenOutline,
});

const baselineTrace = traceProductionProjection({
  storyState: state,
  masterOutline: frozenOutline,
  productionMasterDraft: frozenPmd,
  packetSet: null,
  package: frozenPkg,
  contextProfile,
});

const pmd = expandProductionMasterDraft(state, {
  title: "P10.4 Packet Probe",
  contextProfile,
  preserveId: frozenPmd.id,
});

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

const audit = auditProductionProjection({
  storyState: state,
  productionMasterDraft: pmd,
  packetSet,
  contextProfile,
  groundedProjections,
});

const afterTrace = traceProductionProjection({
  storyState: state,
  masterOutline: frozenOutline,
  productionMasterDraft: pmd,
  packetSet,
  package: null,
  contextProfile,
});

const report = {
  runDir: RUN,
  baselineTrace: {
    issues: baselineTrace.issues,
    sampleStoryStake: baselineTrace.resolvedStoryInstance?.plotValues?.contestedStake,
    samplePacket: baselineTrace.packetProjection,
  },
  afterFixTrace: {
    issues: afterTrace.issues,
    pmdSampleGoals: afterTrace.pmdProjection?.sampleGoals,
  },
  audit: {
    status: audit.status,
    ok: audit.ok,
    unresolvedSymbolicSlots: audit.unresolvedSymbolicSlots,
    abstractRequiredFields: audit.abstractRequiredFields,
    roleScopeLeaks: audit.roleScopeLeaks,
    underspecifiedActions: audit.underspecifiedActions,
    issues: audit.issues,
  },
  packetCaptures: audit.packetCaptures,
  writerWouldSee: {
    m12: audit.packetCaptures?.[0] || null,
    roleP6ParticipantSample: (() => {
      const p6 = (packetSet.roles || []).find((r) => r.characterId === "P6");
      const contrib = (p6?.stages || [])
        .flatMap((s) => s.contributions || [])
        .find((c) => c.templateId === "M07-1");
      return contrib
        ? {
            roleInBeat: contrib.roleInBeat,
            semanticRole: contrib.semanticRole,
            visibility: contrib.visibility,
            action: contrib.action,
            goal: contrib.goal,
          }
        : null;
    })(),
  },
};

writeJson(outPath, report);
console.log(JSON.stringify({ outPath, status: audit.status, ok: audit.ok }, null, 2));
if (!audit.ok) {
  console.error("P10.4 Packet Probe BLOCKED");
  console.error(JSON.stringify(audit.issues, null, 2));
  process.exit(1);
}
console.log("P10.4 Packet Probe PASS (no real model)");
