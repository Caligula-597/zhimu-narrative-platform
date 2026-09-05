/**
 * P7.0 Playable Fixture Compiler — deterministic, lossless text, validate-only effects.
 */

import {
  normalizePlayableProject,
  normalizeRuntimeEffect,
  playableSourceFingerprint,
  PLAYABLE_PROJECT_SCHEMA_VERSION,
} from "./playable-project-contracts.js";
import {
  buildWarehouseSixFixture,
  WAREHOUSE_SIX_FIXTURE_ID,
  WAREHOUSE_SIX_FIXTURE_REVISION,
} from "./playable-fixtures/warehouse-six.js";

export class PlayableCompileError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PlayableCompileError";
    this.code = code;
    this.details = details;
  }
}

function stableJoinParagraphs(paragraphs) {
  return (paragraphs || []).map((p) => String(p)).join("\n");
}

function srcRef(partial) {
  return {
    sourceType: partial.sourceType || "FIXTURE",
    sourceDocumentId: partial.sourceDocumentId,
    characterId: partial.characterId,
    stageId: partial.stageId,
    sectionId: partial.sectionId,
    paragraphRange: partial.paragraphRange,
    label: partial.label,
  };
}

function diag(severity, code, message, sourceRefs = []) {
  return { severity, code, message, sourceRefs };
}

function familyOfTemplate(templateId) {
  const m = String(templateId || "").match(/^(M\d+)/);
  return m ? m[1] : "";
}

/**
 * Compile a CompleteScriptFixture → PlayableProject
 */
export function compilePlayableProject(sourceBundle, options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const compiledAt = typeof now === "function" ? now() : now;
  const fixture = sourceBundle || buildWarehouseSixFixture();
  const meta = fixture.metadata || {};
  const diagnostics = [];

  const idSet = new Set();
  function claimId(id, label) {
    if (!id) {
      diagnostics.push(diag("ERROR", "DUPLICATE_ID", `${label} missing id`));
      return;
    }
    if (idSet.has(id)) {
      diagnostics.push(diag("ERROR", "DUPLICATE_ID", `Duplicate id: ${id}`));
    }
    idSet.add(id);
  }

  const roles = (fixture.roles || []).map((r) => {
    claimId(r.id, "role");
    return {
      id: r.id,
      characterId: r.characterId,
      name: r.name,
      type: r.type,
      playerAssignable: r.playerAssignable !== false && r.type !== "HOST",
      sourceRefs: [
        srcRef({
          sourceType: r.type === "HOST" ? "HOST_SCRIPT" : "CHARACTER_SCRIPT",
          characterId: r.characterId || r.id,
          label: `role:${r.id}`,
        }),
      ],
    };
  });

  const roleIds = new Set(roles.map((r) => r.id));
  const playerRoleIds = roles.filter((r) => r.type === "PLAYER").map((r) => r.id);
  const stageIds = new Set((fixture.stages || []).map((s) => s.id));

  const contentUnits = [];
  const clues = [];
  const mechanismPlacements = [];
  const stageBuckets = new Map();

  for (const st of fixture.stages || []) {
    claimId(st.id, "stage");
    stageBuckets.set(st.id, {
      contentUnitIds: [],
      clueIds: [],
      mechanismPlacementIds: [],
    });
  }

  function pushUnit(unit) {
    claimId(unit.id, "contentUnit");
    if (!stageIds.has(unit.stageId)) {
      diagnostics.push(
        diag("ERROR", "UNKNOWN_STAGE_REF", `Content ${unit.id} references unknown stage ${unit.stageId}`, [
          unit.sourceRef,
        ]),
      );
    }
    for (const rid of unit.audience.roleIds || []) {
      if (!roleIds.has(rid)) {
        diagnostics.push(
          diag("ERROR", "UNKNOWN_ROLE_REF", `Content ${unit.id} references unknown role ${rid}`, [
            unit.sourceRef,
          ]),
        );
      }
    }
    if (!unit.sourceRef) {
      diagnostics.push(diag("ERROR", "MISSING_SOURCE_REF", `Content ${unit.id} missing sourceRef`));
    }
    contentUnits.push(unit);
    const bucket = stageBuckets.get(unit.stageId);
    if (bucket) bucket.contentUnitIds.push(unit.id);
  }

  // Host sections → HOST_ONLY
  for (const sec of fixture.hostScript?.sections || []) {
    const content = stableJoinParagraphs(sec.paragraphs);
    pushUnit({
      id: `cu_host_${sec.id}`,
      type: "TEXT",
      stageId: sec.stageId,
      audience: { roleIds: roles.filter((r) => r.type === "HOST").map((r) => r.id), visibility: "HOST_ONLY" },
      delivery: "AUTO_ON_STAGE",
      content,
      title: sec.title,
      sourceRef: srcRef({
        sourceType: "HOST_SCRIPT",
        sourceDocumentId: fixture.hostScript.documentId,
        stageId: sec.stageId,
        sectionId: sec.id,
        label: sec.title,
      }),
    });
  }

  // Role private scripts
  for (const [roleId, sections] of Object.entries(fixture.roleScripts || {})) {
    if (!roleIds.has(roleId)) {
      diagnostics.push(diag("ERROR", "UNKNOWN_ROLE_REF", `roleScripts key unknown: ${roleId}`));
      continue;
    }
    for (const sec of sections) {
      const content = stableJoinParagraphs(sec.paragraphs);
      const delivery = sec.delivery || "AUTO_ON_STAGE";
      pushUnit({
        id: `cu_${sec.id}`,
        type: "TEXT",
        stageId: sec.stageId,
        audience: { roleIds: [roleId], visibility: "PRIVATE" },
        delivery,
        content,
        title: sec.title,
        unlockCondition: sec.unlockPermissionId
          ? { type: "PERMISSION", permissionId: sec.unlockPermissionId }
          : undefined,
        sourceRef: srcRef({
          sourceType: "CHARACTER_SCRIPT",
          sourceDocumentId: `doc_${roleId}`,
          characterId: roleId,
          stageId: sec.stageId,
          sectionId: sec.id,
          label: sec.title,
        }),
        metadata: sec.unlockPermissionId ? { unlockPermissionId: sec.unlockPermissionId } : undefined,
      });
    }
  }

  // Shared
  for (const sec of fixture.sharedScripts || []) {
    const content = stableJoinParagraphs(sec.paragraphs);
    pushUnit({
      id: `cu_${sec.id}`,
      type: "TEXT",
      stageId: sec.stageId,
      audience: { roleIds: [...(sec.roleIds || [])], visibility: "SHARED" },
      delivery: "AUTO_ON_STAGE",
      content,
      title: sec.title,
      sourceRef: srcRef({
        sourceType: "CHARACTER_SCRIPT",
        stageId: sec.stageId,
        sectionId: sec.id,
        label: sec.title,
      }),
    });
  }

  // Public
  for (const sec of fixture.publicScripts || []) {
    const content = stableJoinParagraphs(sec.paragraphs);
    pushUnit({
      id: `cu_${sec.id}`,
      type: "TEXT",
      stageId: sec.stageId,
      audience: { roleIds: [...playerRoleIds], visibility: "PUBLIC" },
      delivery: "AUTO_ON_STAGE",
      content,
      title: sec.title,
      sourceRef: srcRef({
        sourceType: "HOST_SCRIPT",
        stageId: sec.stageId,
        sectionId: sec.id,
        label: sec.title,
      }),
    });
  }

  // Clues → ContentUnit (single source of truth) + PlayableClue
  const permissionContentMap = new Map();
  for (const clue of fixture.clues || []) {
    const cuId = `cu_clue_${clue.id}`;
    const content = stableJoinParagraphs(clue.paragraphs);
    const visibility = clue.visibility || "PUBLIC";
    let roleIdsForClue = [...(clue.roleIds || [])];
    if (visibility === "PUBLIC") roleIdsForClue = [...playerRoleIds];
    if (visibility === "HOST_ONLY") roleIdsForClue = roles.filter((r) => r.type === "HOST").map((r) => r.id);

    pushUnit({
      id: cuId,
      type: "CLUE",
      stageId: clue.stageId,
      audience: { roleIds: roleIdsForClue, visibility },
      delivery:
        clue.delivery === "AUTO"
          ? "AUTO_ON_STAGE"
          : clue.delivery === "CONDITION_UNLOCK"
            ? "CONDITION_UNLOCK"
            : "HOST_RELEASE",
      content,
      title: clue.title,
      unlockCondition: clue.permissionId
        ? { type: "PERMISSION", permissionId: clue.permissionId }
        : undefined,
      sourceRef: srcRef({
        sourceType: "CLUE",
        sourceDocumentId: clue.documentId,
        stageId: clue.stageId,
        sectionId: clue.id,
        label: clue.title,
      }),
      metadata: clue.permissionId ? { unlockPermissionId: clue.permissionId } : undefined,
    });

    claimId(clue.id, "clue");
    clues.push({
      id: clue.id,
      title: clue.title,
      contentUnitId: cuId,
      stageId: clue.stageId,
      defaultAudience: { roleIds: roleIdsForClue, visibility },
      delivery: clue.delivery || "HOST_RELEASE",
      repeatable: false,
      sourceRef: srcRef({
        sourceType: "CLUE",
        sourceDocumentId: clue.documentId,
        stageId: clue.stageId,
        sectionId: clue.id,
        label: clue.title,
      }),
    });
    const bucket = stageBuckets.get(clue.stageId);
    if (bucket) bucket.clueIds.push(clue.id);

    if (clue.permissionId) {
      if (!permissionContentMap.has(clue.permissionId)) {
        permissionContentMap.set(clue.permissionId, { contentUnitIds: [], clueIds: [] });
      }
      permissionContentMap.get(clue.permissionId).clueIds.push(clue.id);
      permissionContentMap.get(clue.permissionId).contentUnitIds.push(cuId);
    }
  }

  // Track private units gated by permission
  for (const cu of contentUnits) {
    const pid = cu.metadata?.unlockPermissionId || cu.unlockCondition?.permissionId;
    if (pid) {
      if (!permissionContentMap.has(pid)) {
        permissionContentMap.set(pid, { contentUnitIds: [], clueIds: [] });
      }
      const row = permissionContentMap.get(pid);
      if (!row.contentUnitIds.includes(cu.id)) row.contentUnitIds.push(cu.id);
    }
  }

  // Mechanism placements (define only — do not run)
  const knownTemplates = new Set(["M03-1", "M03-2", "M03-3", "M03-4", "M03-5", "M09-1", "M09-2", "M09-3", "M09-4", "M09-5"]);
  for (const ann of fixture.mechanismAnnotations || []) {
    claimId(ann.id, "placement");
    if (!stageIds.has(ann.stageId)) {
      diagnostics.push(
        diag("ERROR", "UNKNOWN_STAGE_REF", `Placement ${ann.id} unknown stage ${ann.stageId}`),
      );
    }
    if (!knownTemplates.has(ann.mechanismTemplateId)) {
      diagnostics.push(
        diag("ERROR", "UNKNOWN_MECHANISM", `Unknown mechanism template ${ann.mechanismTemplateId}`, [
          srcRef({ label: ann.id }),
        ]),
      );
    }
    const pr = ann.participantRule || { type: "ALL_PLAYERS" };
    if (pr.type === "ROLE_IDS" || pr.type === "EXCLUDE_ROLE_IDS") {
      for (const rid of pr.roleIds || []) {
        if (!roleIds.has(rid)) {
          diagnostics.push(
            diag(
              "ERROR",
              "INVALID_MECHANISM_PARTICIPANTS",
              `Placement ${ann.id} unknown participant ${rid}`,
            ),
          );
        }
      }
    }

    let introContentUnitId;
    if (ann.introParagraphs?.length) {
      introContentUnitId = `cu_intro_${ann.id}`;
      pushUnit({
        id: introContentUnitId,
        type: "SYSTEM",
        stageId: ann.stageId,
        audience: { roleIds: [...playerRoleIds], visibility: "PUBLIC" },
        delivery: "HOST_RELEASE",
        content: stableJoinParagraphs(ann.introParagraphs),
        title: `${ann.title}·开场说明`,
        sourceRef: srcRef({
          sourceType: "SYSTEM_AUTHORED",
          stageId: ann.stageId,
          sectionId: `intro_${ann.id}`,
          label: ann.title,
        }),
      });
    }

    const outcomeBindings = [];
    for (const ob of ann.outcomeBindings || []) {
      const effects = (ob.effects || []).map((e) => normalizeRuntimeEffect(e));
      for (const ef of effects) {
        if (ef.valid === false || ef.type === "INVALID") {
          diagnostics.push(
            diag(
              "ERROR",
              "INVALID_OUTCOME_BINDING",
              `Placement ${ann.id} has invalid effect: ${ef.error || ef.type}`,
            ),
          );
        }
      }
      outcomeBindings.push({
        outcomeMatcher: ob.outcomeMatcher || {},
        effects,
      });
    }

    mechanismPlacements.push({
      id: ann.id,
      mechanismTemplateId: ann.mechanismTemplateId,
      familyId: ann.familyId || familyOfTemplate(ann.mechanismTemplateId),
      stageId: ann.stageId,
      title: ann.title,
      trigger: ann.trigger || "HOST_START",
      participantRule: pr,
      introContentUnitId,
      runtimeConfig: ann.runtimeConfig || {},
      outcomeBindings,
      fallback: ann.fallback,
      sourceRef: srcRef({
        sourceType: "SYSTEM_AUTHORED",
        stageId: ann.stageId,
        sectionId: ann.id,
        label: ann.title,
      }),
    });
    const bucket = stageBuckets.get(ann.stageId);
    if (bucket) bucket.mechanismPlacementIds.push(ann.id);
  }

  const permissions = (fixture.permissions || []).map((p) => {
    const mapped = permissionContentMap.get(p.id) || { contentUnitIds: [], clueIds: [] };
    return {
      id: p.id,
      grants: p.grants || ["VIEW_CONTENT"],
      contentUnitIds: mapped.contentUnitIds,
      clueIds: mapped.clueIds,
      summary: p.summary,
    };
  });

  // Stages
  const stages = (fixture.stages || [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((st) => {
      const bucket = stageBuckets.get(st.id) || {
        contentUnitIds: [],
        clueIds: [],
        mechanismPlacementIds: [],
      };
      return {
        id: st.id,
        order: st.order,
        title: st.title,
        stageRole: st.stageRole,
        contentUnitIds: bucket.contentUnitIds,
        clueIds: bucket.clueIds,
        mechanismPlacementIds: bucket.mechanismPlacementIds,
        enterCondition: st.enterCondition,
        exitCondition: st.exitCondition,
        sourceRefs: [
          srcRef({
            sourceType: "FIXTURE",
            stageId: st.id,
            label: st.title,
          }),
        ],
      };
    });

  const startStageId = stages[0]?.id || "";
  const finalStageId = stages[stages.length - 1]?.id;

  if (!startStageId) {
    diagnostics.push(diag("ERROR", "MISSING_START_STAGE", "No stages in fixture"));
  }

  // Player content coverage
  for (const role of roles.filter((r) => r.type === "PLAYER")) {
    const own = contentUnits.filter(
      (cu) => cu.audience.visibility === "PRIVATE" && cu.audience.roleIds.includes(role.id),
    );
    if (own.length < 1) {
      diagnostics.push(
        diag("ERROR", "MISSING_ROLE_CONTENT", `Player role ${role.id} has no private content`),
      );
    } else if (own.length < 2) {
      diagnostics.push(
        diag("WARN", "MISSING_ROLE_CONTENT", `Player role ${role.id} has fewer than 2 private units`),
      );
    }
  }

  // Orphan content (not listed on any stage bucket — should not happen if pushUnit works)
  for (const cu of contentUnits) {
    const listed = stages.some((s) => s.contentUnitIds.includes(cu.id));
    if (!listed) {
      diagnostics.push(diag("WARN", "ORPHAN_CONTENT", `Content ${cu.id} not listed on a stage`));
    }
  }
  for (const clue of clues) {
    const listed = stages.some((s) => s.clueIds.includes(clue.id));
    if (!listed) {
      diagnostics.push(diag("WARN", "ORPHAN_CLUE", `Clue ${clue.id} not listed on a stage`));
    }
    const cu = contentUnits.find((c) => c.id === clue.contentUnitId);
    if (!cu) {
      diagnostics.push(diag("ERROR", "ORPHAN_CLUE", `Clue ${clue.id} missing content unit`));
    } else if (cu.content !== stableJoinParagraphs(
      (fixture.clues || []).find((c) => c.id === clue.id)?.paragraphs || [],
    )) {
      diagnostics.push(
        diag("ERROR", "CLUE_CONTENT_MISMATCH", `Clue ${clue.id} content diverged from fixture`),
      );
    }
  }

  const errorCount = diagnostics.filter((d) => d.severity === "ERROR").length;
  const status = errorCount > 0 ? "INVALID" : "READY";

  const source = {
    sourceType: meta.sourceType || "FIXTURE",
    sourceId: meta.fixtureId || WAREHOUSE_SIX_FIXTURE_ID,
    sourceRevision: meta.revision || WAREHOUSE_SIX_FIXTURE_REVISION,
    fixtureId: meta.fixtureId || WAREHOUSE_SIX_FIXTURE_ID,
    fingerprint: playableSourceFingerprint({
      sourceType: meta.sourceType || "FIXTURE",
      sourceId: meta.fixtureId || WAREHOUSE_SIX_FIXTURE_ID,
      sourceRevision: meta.revision || WAREHOUSE_SIX_FIXTURE_REVISION,
      fixtureId: meta.fixtureId || WAREHOUSE_SIX_FIXTURE_ID,
    }),
    compiledAt,
  };

  const project = normalizePlayableProject({
    id: options.projectId || `pp-${meta.fixtureId || WAREHOUSE_SIX_FIXTURE_ID}`,
    worldId: options.worldId,
    title: meta.title || "Playable Project",
    status,
    isStale: false,
    source,
    roles,
    stages,
    contentUnits,
    clues,
    mechanismPlacements,
    permissions,
    runtimeConfig: {
      startStageId,
      finalStageId,
      allowHostOverride: true,
      pinSnapshotOnSessionStart: true,
    },
    diagnostics,
    revision: 0,
    updatedAt: compiledAt,
  });

  return project;
}

export function compileWarehouseSixFixture(options = {}) {
  return compilePlayableProject(buildWarehouseSixFixture(), options);
}

export function assertSourceFidelity(fixture, project) {
  const issues = [];
  for (const [roleId, sections] of Object.entries(fixture.roleScripts || {})) {
    for (const sec of sections) {
      const cu = project.contentUnits.find((c) => c.id === `cu_${sec.id}`);
      const expected = stableJoinParagraphs(sec.paragraphs);
      if (!cu) {
        issues.push(`missing unit cu_${sec.id}`);
        continue;
      }
      if (cu.content !== expected) {
        issues.push(`rewritten text for ${sec.id}`);
      }
    }
  }
  return issues;
}

export { buildWarehouseSixFixture, WAREHOUSE_SIX_FIXTURE_ID, WAREHOUSE_SIX_FIXTURE_REVISION };
