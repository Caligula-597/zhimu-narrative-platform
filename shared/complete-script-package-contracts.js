/**
 * P8.2.0 CompleteScriptPackage V1 — product form of warehouse-six Complete Script Fixture.
 * Compiler continues to consume the fixture-shaped compile source only.
 */

export const COMPLETE_SCRIPT_PACKAGE_VERSION = 1;

export const COMPLETE_SCRIPT_PACKAGE_STATUSES = Object.freeze([
  "BLOCKED",
  "DRAFT",
  "READY_FOR_REVIEW",
  "READY_TO_COMPILE",
  "STALE",
  "INVALID",
]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, maximum = 800) {
  return String(value ?? "").trim().slice(0, maximum);
}

function cleanId(value) {
  return cleanText(value, 120).replace(/[^a-zA-Z0-9_\-.:]/g, "_");
}

function normalizeParagraphs(list) {
  return asArray(list)
    .map((p) => cleanText(p, 2000))
    .filter(Boolean);
}

function normalizeSection(value = {}) {
  const src = record(value);
  return {
    id: cleanId(src.id) || `sec-${Math.random().toString(36).slice(2, 8)}`,
    stageId: cleanId(src.stageId),
    title: cleanText(src.title, 160) || "段落",
    paragraphs: normalizeParagraphs(src.paragraphs),
    delivery: cleanText(src.delivery, 40) || undefined,
    unlockPermissionId: cleanId(src.unlockPermissionId) || undefined,
    type: cleanText(src.type, 40) || undefined,
    roleIds: asArray(src.roleIds).map(String).filter(Boolean),
    provenance: {
      sourceBeatIds: asArray(src.provenance?.sourceBeatIds).map(String),
      sourceClueIds: asArray(src.provenance?.sourceClueIds).map(String),
      sourceFactIds: asArray(src.provenance?.sourceFactIds).map(String),
    },
  };
}

export function normalizeCompleteScriptPackage(value = {}) {
  const src = record(value);
  const status = COMPLETE_SCRIPT_PACKAGE_STATUSES.includes(src.status) ? src.status : "DRAFT";
  const roles = asArray(src.roles).map((r) => {
    const row = record(r);
    const type = row.type === "HOST" ? "HOST" : "PLAYER";
    const explicitAssignable = row.playerAssignable;
    return {
      id: cleanId(row.id),
      name: cleanText(row.name, 80) || cleanId(row.id),
      type,
      characterId: cleanId(row.characterId) || undefined,
      // Honor explicit false (e.g. NPC_*); HOST never assignable
      playerAssignable:
        type === "HOST"
          ? false
          : explicitAssignable === false
            ? false
            : explicitAssignable === true
              ? true
              : true,
    };
  });

  const roleScripts = {};
  for (const [roleId, sections] of Object.entries(record(src.roleScripts))) {
    roleScripts[cleanId(roleId)] = asArray(sections).map(normalizeSection);
  }

  return {
    version: COMPLETE_SCRIPT_PACKAGE_VERSION,
    id: cleanId(src.id) || `csp-${Date.now().toString(36)}`,
    projectId: cleanId(src.projectId) || "project",
    source: {
      productionMasterDraftId: cleanId(src.source?.productionMasterDraftId) || undefined,
      productionMasterDraftRevision: cleanText(src.source?.productionMasterDraftRevision, 120) || undefined,
      sourceStoryStateRevision: Number(src.source?.sourceStoryStateRevision) || 0,
      sourceMasterOutlineRevision: cleanText(src.source?.sourceMasterOutlineRevision, 120) || undefined,
      creationSpecRevision:
        src.source?.creationSpecRevision != null
          ? Number(src.source.creationSpecRevision)
          : undefined,
    },
    status,
    metadata: {
      title: cleanText(src.metadata?.title || src.title, 160) || "完整剧本包",
      premiseSummary: cleanText(src.metadata?.premiseSummary, 400) || undefined,
      revision: Math.max(1, Math.trunc(Number(src.metadata?.revision || src.revision) || 1)),
    },
    roles,
    stages: asArray(src.stages).map((s) => {
      const row = record(s);
      return {
        id: cleanId(row.id || row.stageId),
        order: Number(row.order) || 0,
        title: cleanText(row.title, 120) || "阶段",
        stageRole: cleanText(row.stageRole, 40) || undefined,
        enterCondition: row.enterCondition || { type: "HOST_ADVANCE" },
        exitCondition: row.exitCondition || { type: "HOST_ADVANCE" },
        mechanismAnnotationIds: asArray(row.mechanismAnnotationIds).map(String),
      };
    }),
    hostScript: {
      documentId: cleanId(src.hostScript?.documentId) || "doc_host_manual",
      sections: asArray(src.hostScript?.sections).map(normalizeSection),
    },
    roleScripts,
    sharedScripts: asArray(src.sharedScripts).map(normalizeSection),
    publicScripts: asArray(src.publicScripts).map(normalizeSection),
    clues: asArray(src.clues).map((c) => {
      const row = record(c);
      return {
        id: cleanId(row.id || row.clueId),
        title: cleanText(row.title || row.label, 120) || "线索",
        stageId: cleanId(row.stageId || row.introducedAt),
        delivery: cleanText(row.delivery, 40) || "HOST_RELEASE",
        visibility: cleanText(row.visibility, 40) || "PUBLIC",
        paragraphs: normalizeParagraphs(row.paragraphs),
        documentId: cleanId(row.documentId) || `doc_${cleanId(row.id || row.clueId)}`,
        roleIds: asArray(row.roleIds).map(String),
        permissionId: cleanId(row.permissionId) || undefined,
        isMisleading: Boolean(row.isMisleading),
        isDecisive: Boolean(row.isDecisive),
        supportsFact: cleanText(row.supportsFact, 200) || undefined,
        provenance: {
          sourceClueId: cleanId(row.provenance?.sourceClueId || row.id || row.clueId),
          sourceBeatIds: asArray(row.provenance?.sourceBeatIds).map(String),
        },
      };
    }),
    endingContent: {
      finalStageId: cleanId(src.endingContent?.finalStageId) || undefined,
      resolutionMode: cleanText(src.endingContent?.resolutionMode, 40) || "MIXED",
      sections: asArray(src.endingContent?.sections).map(normalizeSection),
    },
    mechanismAnnotations: asArray(src.mechanismAnnotations),
    permissions: asArray(src.permissions),
    provenanceIndex: record(src.provenanceIndex),
    diagnostics: asArray(src.diagnostics),
    revision: Math.max(1, Math.trunc(Number(src.revision) || 1)),
    updatedAt: src.updatedAt != null ? String(src.updatedAt) : null,
  };
}
