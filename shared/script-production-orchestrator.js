/**
 * P8.2.1 Script Production Orchestrator — Gate → Writer → Diff → Package merge → validate.
 */

import { evaluateScriptProductionReadiness } from "./script-production-gate.js";
import { buildScriptProductionPacketSet } from "./script-production-packets.js";
import {
  buildScriptWriterRequest,
  normalizeScriptWriterResult,
} from "./script-writer-result-contracts.js";
import { diffWriterResultAgainstPacket } from "./script-writer-provenance-diff.js";
import { normalizeCompleteScriptPackage } from "./complete-script-package-contracts.js";
import { validateCompleteScriptPackage } from "./complete-script-validator.js";
import { DeterministicTestScriptWriter } from "./deterministic-test-script-writer.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Explicit approval — READY_TO_COMPILE only when clean.
 */
export function approveCompleteScriptPackage(pkg, validation, { sectionStates = [] } = {}) {
  const normalized = normalizeCompleteScriptPackage(pkg);
  const invalidSections = asArray(sectionStates).filter((s) => s.status === "INVALID");
  const reviewSections = asArray(sectionStates).filter((s) => s.status === "REVIEW_REQUIRED");
  const proposed = asArray(normalized.diagnostics).some((d) => d.code === "HAS_PROPOSED_CANON");

  if (!validation?.ok || invalidSections.length || reviewSections.length || proposed) {
    return {
      ok: false,
      package: {
        ...normalized,
        status: invalidSections.length ? "INVALID" : "READY_FOR_REVIEW",
      },
      reason: !validation?.ok
        ? "validation_failed"
        : invalidSections.length
          ? "invalid_sections"
          : "review_required",
    };
  }
  if (normalized.status === "BLOCKED" || normalized.status === "STALE") {
    return { ok: false, package: normalized, reason: "blocked_or_stale" };
  }
  return {
    ok: true,
    package: { ...normalized, status: "READY_TO_COMPILE" },
    reason: "approved",
  };
}

function mergeWriterSectionsIntoPackage({ pmd, packetSet, sectionStates, gate, projectId, now }) {
  const hostRole = {
    id: "role_host",
    name: "主持人",
    type: "HOST",
    playerAssignable: false,
  };
  const playerRoles = asArray(pmd?.characterViews?.characters).map((c, i) => {
    const characterId = c.characterId || c.id || String(i);
    const isNpc = /^NPC_/i.test(String(characterId));
    return {
      id: `role_${characterId}`,
      name: c.name || characterId,
      type: "PLAYER",
      characterId,
      playerAssignable: !isNpc,
    };
  });

  const stages = asArray(pmd?.stages)
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((st, index) => ({
      id: st.stageId,
      order: st.order ?? index,
      title: st.title,
      stageRole: st.stageRole,
      enterCondition: index === 0 ? { type: "HOST_START" } : { type: "HOST_ADVANCE" },
      exitCondition: { type: "HOST_ADVANCE" },
      mechanismAnnotationIds: [],
    }));

  const byKind = new Map();
  for (const st of sectionStates) {
    const kind = st.packetKind;
    if (!byKind.has(kind)) byKind.set(kind, []);
    byKind.get(kind).push(st);
  }

  const provenanceIndex = {};
  const pickSections = (kind) =>
    asArray(byKind.get(kind)).flatMap((st) =>
      asArray(st.result?.sections).map((sec) => {
        provenanceIndex[sec.sectionId] = {
          ...sec.provenance,
          sectionStatus: st.status,
        };
        return {
          id: sec.sectionId,
          stageId: sec.stageId,
          title: sec.title,
          paragraphs: sec.paragraphs,
          provenance: sec.provenance,
        };
      }),
    );

  const hostSections = pickSections("HOST_SCRIPT");
  const publicScripts = pickSections("PUBLIC_STAGE");
  const endingSections = pickSections("ENDING");

  const roleScripts = {};
  for (const st of asArray(byKind.get("ROLE_SCRIPT"))) {
    const cid = st.characterId || st.packet?.characterId;
    const roleId = `role_${cid}`;
    roleScripts[roleId] = asArray(st.result?.sections).map((sec) => {
      provenanceIndex[sec.sectionId] = {
        sourceCharacterId: cid,
        ...sec.provenance,
        sectionStatus: st.status,
      };
      return {
        id: sec.sectionId,
        stageId: sec.stageId,
        title: sec.title,
        paragraphs: sec.paragraphs,
        provenance: sec.provenance,
      };
    });
  }

  const clues = asArray(byKind.get("CLUE_WRITER")).map((st) => {
    const packet = st.packet;
    const sec = asArray(st.result?.sections)[0];
    const clueId = packet?.clueId;
    provenanceIndex[`clue:${clueId}`] = {
      sourceClueId: clueId,
      ...(sec?.provenance || {}),
      sectionStatus: st.status,
    };
    return {
      id: clueId,
      title: packet?.supportsFact || clueId,
      stageId: packet?.introducedAt || packet?.stageId || stages[0]?.id,
      delivery: "HOST_RELEASE",
      visibility: packet?.possibleFinders?.length === 1 ? "PRIVATE" : "PUBLIC",
      paragraphs: sec?.paragraphs || [`【线索】${packet?.supportsFact || clueId}`],
      documentId: `doc_${clueId}`,
      roleIds: (packet?.possibleFinders || []).map((id) => `role_${id}`),
      isMisleading: Boolean(packet?.isMisleading),
      isDecisive: Boolean(packet?.isDecisive),
      supportsFact: packet?.supportsFact,
      provenance: provenanceIndex[`clue:${clueId}`],
    };
  });

  const invalidCount = sectionStates.filter((s) => s.status === "INVALID").length;
  const proposedCount = sectionStates.reduce(
    (n, s) => n + asArray(s.result?.proposedCanonicalChanges).length,
    0,
  );

  let status = "READY_FOR_REVIEW";
  if (gate.status === "BLOCKED") status = "BLOCKED";
  else if (invalidCount) status = "INVALID";

  const diagnostics = [
    ...gate.blockers.map((b) => ({ ...b, lane: "blocker" })),
    ...gate.fillableGaps.map((b) => ({ ...b, lane: "fillable" })),
    ...sectionStates
      .filter((s) => s.status === "INVALID")
      .flatMap((s) =>
        asArray(s.diff?.errors).map((e) => ({
          ...e,
          lane: "writer",
          sectionId: s.sectionId,
        })),
      ),
  ];
  if (proposedCount) {
    diagnostics.push({
      code: "HAS_PROPOSED_CANON",
      message: `proposedCanonicalChanges=${proposedCount}`,
      severity: "warn",
      lane: "canon",
    });
  }

  return normalizeCompleteScriptPackage({
    id: `csp-writer-${pmd?.id || projectId}`,
    projectId,
    source: {
      productionMasterDraftId: pmd?.id,
      productionMasterDraftRevision: String(pmd?.sourceMasterOutlineRevision || ""),
      sourceStoryStateRevision: pmd?.sourceStoryStateRevision || 0,
      sourceMasterOutlineRevision: pmd?.sourceMasterOutlineRevision,
    },
    status,
    metadata: {
      title: pmd?.title || "完整剧本包（Writer）",
      premiseSummary: pmd?.premiseSummary,
      revision: 1,
    },
    roles: [hostRole, ...playerRoles],
    stages,
    hostScript: { documentId: "doc_host_manual", sections: hostSections },
    roleScripts,
    sharedScripts: [],
    publicScripts,
    clues,
    endingContent: {
      finalStageId: packetSet?.ending?.finalStageId,
      resolutionMode: packetSet?.ending?.resolutionMode,
      sections: endingSections,
    },
    mechanismAnnotations: [],
    permissions: [],
    provenanceIndex,
    diagnostics,
    revision: 1,
    updatedAt: typeof now === "function" ? now() : now,
  });
}

/**
 * @param {{ pmd: object, writer?: { write: Function }, projectId?: string, now?: Function }} args
 */
export async function runScriptProduction({
  pmd,
  writer = new DeterministicTestScriptWriter(),
  projectId = "project",
  now = () => new Date().toISOString(),
} = {}) {
  const gate = evaluateScriptProductionReadiness(pmd);
  if (gate.status === "BLOCKED") {
    return {
      gate,
      packetSet: null,
      sectionStates: [],
      package: normalizeCompleteScriptPackage({
        id: `csp-blocked-${projectId}`,
        projectId,
        status: "BLOCKED",
        diagnostics: gate.blockers,
        roles: [{ id: "role_host", name: "主持人", type: "HOST" }],
        stages: [],
        hostScript: { sections: [] },
        roleScripts: {},
      }),
      validation: { ok: false, errors: gate.blockers, warnings: [] },
    };
  }

  const packetSet = buildScriptProductionPacketSet(pmd);
  const jobs = [
    { packetKind: "HOST_SCRIPT", packet: packetSet.host, key: "host" },
    ...asArray(packetSet.roles).map((p) => ({
      packetKind: "ROLE_SCRIPT",
      packet: p,
      key: `role:${p.characterId}`,
      characterId: p.characterId,
    })),
    ...asArray(packetSet.clues).map((p) => ({
      packetKind: "CLUE_WRITER",
      packet: p,
      key: `clue:${p.clueId}`,
    })),
    ...asArray(packetSet.publicStages).map((p) => ({
      packetKind: "PUBLIC_STAGE",
      packet: p,
      key: `public:${p.stageId}`,
    })),
    { packetKind: "ENDING", packet: packetSet.ending, key: "ending" },
  ];

  const sectionStates = [];
  for (const job of jobs) {
    const request = buildScriptWriterRequest({
      requestId: `req-${job.key}`,
      packetKind: job.packetKind,
      packet: job.packet,
    });
    const raw = await writer.write(request);
    const result = normalizeScriptWriterResult({
      ...raw,
      packetKind: job.packetKind,
      requestId: request.requestId,
    });
    const diff = diffWriterResultAgainstPacket({ packet: job.packet, result });
    let status = "GENERATED";
    if (diff.status === "INVALID") status = "INVALID";
    else if (diff.status === "REVIEW_REQUIRED") status = "REVIEW_REQUIRED";

    sectionStates.push({
      sectionId: job.key,
      status,
      result,
      diff,
      packet: job.packet,
      packetKind: job.packetKind,
      characterId: job.characterId,
    });
  }

  const pkg = mergeWriterSectionsIntoPackage({
    pmd,
    packetSet,
    sectionStates,
    gate,
    projectId,
    now,
  });

  const validation = validateCompleteScriptPackage({
    pmd,
    packetSet,
    package: pkg,
  });

  return {
    gate,
    packetSet,
    sectionStates,
    package: pkg,
    validation,
  };
}
