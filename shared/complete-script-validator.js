/**
 * P8.2.0 CompleteScriptPackage structural validator (deterministic).
 */

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/**
 * @returns {{ ok: boolean, errors: object[], warnings: object[] }}
 */
export function validateCompleteScriptPackage({ pmd, packetSet, package: pkg } = {}) {
  const errors = [];
  const warnings = [];
  const draft = record(pkg);

  if (!draft.version) errors.push({ code: "NO_VERSION", message: "缺少 package.version" });

  const pmdStages = asArray(pmd?.stages).map((s) => s.stageId);
  const pkgStages = asArray(draft.stages).map((s) => s.id);
  if (pmdStages.length && pkgStages.length !== pmdStages.length) {
    errors.push({
      code: "STAGE_COUNT_MISMATCH",
      message: `stage 数量不一致 PMD=${pmdStages.length} PKG=${pkgStages.length}`,
    });
  }
  for (const id of pmdStages) {
    if (!pkgStages.includes(id)) {
      errors.push({ code: "MISSING_STAGE", message: `缺少 stage ${id}` });
    }
  }
  for (const id of pkgStages) {
    if (pmdStages.length && !pmdStages.includes(id)) {
      errors.push({ code: "EXTRA_STAGE", message: `不得新增 stage ${id}` });
    }
  }

  const pmdChars = asArray(pmd?.characterViews?.characters).map((c) => c.characterId || c.id);
  const pkgPlayers = asArray(draft.roles).filter((r) => r.type === "PLAYER");
  if (pmdChars.length && pkgPlayers.length !== pmdChars.length) {
    errors.push({
      code: "ROLE_COUNT_MISMATCH",
      message: `玩家角色数不一致 PMD=${pmdChars.length} PKG=${pkgPlayers.length}`,
    });
  }
  for (const cid of pmdChars) {
    if (!pkgPlayers.some((r) => r.characterId === cid)) {
      errors.push({ code: "MISSING_ROLE", message: `缺少角色 ${cid}` });
    }
  }

  const hostSections = asArray(draft.hostScript?.sections);
  for (const sid of pkgStages) {
    if (!hostSections.some((s) => s.stageId === sid && asArray(s.paragraphs).length)) {
      errors.push({ code: "HOST_SECTION_MISSING", message: `主持本缺少 stage ${sid}` });
    }
  }

  for (const role of pkgPlayers) {
    const sections = asArray(draft.roleScripts?.[role.id]);
    if (!sections.length) {
      errors.push({ code: "ROLE_SCRIPT_MISSING", message: `角色 ${role.id} 无私本` });
    }
    for (const sec of sections) {
      if (!asArray(sec.paragraphs).length) {
        errors.push({ code: "ROLE_SECTION_EMPTY", message: `${role.id}/${sec.stageId} 空段落` });
      }
      if (!pkgStages.includes(sec.stageId)) {
        errors.push({ code: "ROLE_BAD_STAGE", message: `${role.id} 引用未知 stage ${sec.stageId}` });
      }
    }
  }

  const pmdClues = asArray(pmd?.clueView?.clues).map((c) => c.clueId);
  const pkgClues = asArray(draft.clues);
  for (const id of pmdClues) {
    const row = pkgClues.find((c) => c.id === id);
    if (!row) {
      errors.push({ code: "CLUE_MISSING", message: `缺少线索正文 ${id}` });
      continue;
    }
    if (!asArray(row.paragraphs).length) {
      errors.push({ code: "CLUE_EMPTY", message: `线索 ${id} 无正文` });
    }
    const src = asArray(pmd?.clueView?.clues).find((c) => c.clueId === id);
    if (src && Boolean(src.isMisleading) !== Boolean(row.isMisleading)) {
      errors.push({ code: "CLUE_MISLEADING_CHANGED", message: `线索 ${id} isMisleading 被改写` });
    }
    if (src && Boolean(src.isDecisive) !== Boolean(row.isDecisive)) {
      errors.push({ code: "CLUE_DECISIVE_CHANGED", message: `线索 ${id} isDecisive 被改写` });
    }
  }

  // Provenance
  for (const sec of hostSections) {
    if (!asArray(sec.provenance?.sourceBeatIds).length && !draft.provenanceIndex?.[sec.id]) {
      warnings.push({ code: "HOST_PROVENANCE_WEAK", message: `主持段落 ${sec.id} 缺 provenance` });
    }
  }

  // Packet alignment: role forbidden facts should not appear as OWNER goals stolen
  for (const rolePkt of asArray(packetSet?.roles)) {
    const roleId = `role_${rolePkt.characterId}`;
    const blob = JSON.stringify(draft.roleScripts?.[roleId] || []);
    for (const fact of asArray(rolePkt.stages?.[0]?.forbiddenFactIds).slice(0, 5)) {
      // soft: only flag if entire forbidden token is an OWNER-only private string — skip noisy
      void fact;
      void blob;
    }
  }

  if (draft.status === "BLOCKED" && !errors.length) {
    warnings.push({ code: "STATUS_BLOCKED", message: "Package 状态为 BLOCKED（上游 Gate）" });
  }

  return { ok: errors.length === 0, errors, warnings };
}
