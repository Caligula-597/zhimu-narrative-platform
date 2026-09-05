/**
 * P8.2.2 Production coverage — read-only report over PMD + Package (+ optional Playable).
 * Does not invent content; only measures gaps.
 */

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function unique(list) {
  return [...new Set(asArray(list).filter(Boolean).map(String))];
}

export function isNpcCharacterId(characterId) {
  return /^NPC_/i.test(String(characterId || ""));
}

export function assignablePlayerRoles(pkg) {
  return asArray(pkg?.roles).filter((r) => r.type === "PLAYER" && r.playerAssignable !== false);
}

/**
 * @returns {{
 *   characterCoverage: object[],
 *   stageCoverage: object[],
 *   clueCoverage: object,
 *   truthCoverage: object,
 *   endingCoverage: object,
 *   assignablePlayerCount: number,
 *   stageCount: number,
 *   ok: boolean,
 *   errors: object[],
 * }}
 */
export function buildScriptCoverageReport({ pmd, package: pkg, playableProject = null } = {}) {
  const stages = asArray(pmd?.stages)
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const stageIds = stages.map((s) => s.stageId);
  const finalStageId = stageIds[stageIds.length - 1];

  const hostSections = asArray(pkg?.hostScript?.sections);
  const stageCoverage = stageIds.map((stageId) => {
    const hostOk = hostSections.some((s) => s.stageId === stageId && asArray(s.paragraphs).length);
    return {
      stageId,
      hasHostSection: hostOk,
      hostSectionIds: hostSections.filter((s) => s.stageId === stageId).map((s) => s.id),
    };
  });

  const characterCoverage = asArray(pmd?.characterViews?.characters)
    .filter((c) => !isNpcCharacterId(c.characterId || c.id))
    .map((ch) => {
      const characterId = ch.characterId || ch.id;
      const roleId = `role_${characterId}`;
      const expectedContributionStageIds = unique(
        asArray(ch.stages)
          .filter((st) => asArray(st.contributions).length > 0)
          .map((st) => st.stageId),
      );
      const produced = asArray(pkg?.roleScripts?.[roleId]);
      const producedSectionStageIds = unique(produced.map((s) => s.stageId));
      const missingStageIds = expectedContributionStageIds.filter(
        (id) => !producedSectionStageIds.includes(id),
      );
      return {
        characterId,
        roleId,
        expectedContributionStageIds,
        producedSectionStageIds,
        missingStageIds,
        sectionCount: produced.length,
        nonEmpty: produced.every((s) => asArray(s.paragraphs).length > 0),
      };
    });

  const pmdClues = asArray(pmd?.clueView?.clues);
  const pkgClues = asArray(pkg?.clues);
  const clueCoverage = {
    pmdClueIds: pmdClues.map((c) => c.clueId),
    packageClueIds: pkgClues.map((c) => c.id),
    missingInPackage: pmdClues
      .map((c) => c.clueId)
      .filter((id) => !pkgClues.some((c) => c.id === id)),
    extraInPackage: pkgClues
      .map((c) => c.id)
      .filter((id) => !pmdClues.some((c) => c.clueId === id)),
    fidelityIssues: [],
    playableClueIds: asArray(playableProject?.clues).map((c) => c.id),
  };

  for (const pmdClue of pmdClues) {
    const pkgClue = pkgClues.find((c) => c.id === pmdClue.clueId);
    if (!pkgClue) continue;
    if (Boolean(pkgClue.isMisleading) !== Boolean(pmdClue.isMisleading)) {
      clueCoverage.fidelityIssues.push({
        clueId: pmdClue.clueId,
        field: "isMisleading",
      });
    }
    if (Boolean(pkgClue.isDecisive) !== Boolean(pmdClue.isDecisive)) {
      clueCoverage.fidelityIssues.push({
        clueId: pmdClue.clueId,
        field: "isDecisive",
      });
    }
    const expectedStage = pmdClue.introducedAt || pmdClue.stageId;
    if (expectedStage && pkgClue.stageId !== expectedStage) {
      clueCoverage.fidelityIssues.push({
        clueId: pmdClue.clueId,
        field: "introducedAt",
        expected: expectedStage,
        actual: pkgClue.stageId,
      });
    }
    if (!asArray(pkgClue.paragraphs).length) {
      clueCoverage.fidelityIssues.push({ clueId: pmdClue.clueId, field: "emptyParagraphs" });
    }
    if (!record(pkgClue.provenance).sourceClueIds?.length && !pkg?.provenanceIndex?.[`clue:${pmdClue.clueId}`]) {
      clueCoverage.fidelityIssues.push({ clueId: pmdClue.clueId, field: "missingProvenance" });
    }
  }

  const finalTruthEvents = asArray(pmd?.truthView?.events).filter((e) => e.stageId === finalStageId);
  const endingSections = asArray(pkg?.endingContent?.sections);
  const endingBeatIds = unique(
    endingSections.flatMap((s) => asArray(s.provenance?.sourceBeatIds)),
  );
  const truthCoverage = {
    finalStageId,
    finalTruthBeatIds: finalTruthEvents.map((e) => e.beatId).filter(Boolean),
    endingProvenanceBeatIds: endingBeatIds,
    missingFinalTruthBeatIds: finalTruthEvents
      .map((e) => e.beatId)
      .filter((id) => id && !endingBeatIds.includes(id)),
    endingSectionCount: endingSections.length,
    endingNonEmpty: endingSections.every((s) => asArray(s.paragraphs).length > 0),
  };

  const endingPlayableUnits = asArray(playableProject?.contentUnits).filter(
    (cu) =>
      cu.stageId === finalStageId &&
      (String(cu.id).includes("ending") || cu.sourceRef?.sectionId === "ending_truth"),
  );
  const endingCoverage = {
    packageEndingSections: endingSections.map((s) => s.id),
    playableEndingUnitIds: endingPlayableUnits.map((u) => u.id),
    hasPlayableEndingContent: endingPlayableUnits.length > 0,
  };

  const errors = [];
  for (const st of stageCoverage) {
    if (!st.hasHostSection) errors.push({ code: "MISSING_HOST_SECTION", stageId: st.stageId });
  }
  for (const ch of characterCoverage) {
    if (!ch.sectionCount) errors.push({ code: "MISSING_ROLE_SCRIPT", characterId: ch.characterId });
    for (const stageId of ch.missingStageIds) {
      errors.push({
        code: "MISSING_ROLE_STAGE_SECTION",
        characterId: ch.characterId,
        stageId,
      });
    }
    if (!ch.nonEmpty) errors.push({ code: "EMPTY_ROLE_SECTION", characterId: ch.characterId });
  }
  for (const id of clueCoverage.missingInPackage) {
    errors.push({ code: "MISSING_CLUE", clueId: id });
  }
  for (const issue of clueCoverage.fidelityIssues) {
    errors.push({ code: "CLUE_FIDELITY", ...issue });
  }
  for (const id of truthCoverage.missingFinalTruthBeatIds) {
    errors.push({ code: "MISSING_ENDING_TRUTH_PROVENANCE", beatId: id });
  }
  if (!truthCoverage.endingNonEmpty || !truthCoverage.endingSectionCount) {
    errors.push({ code: "EMPTY_ENDING" });
  }
  if (playableProject && !endingCoverage.hasPlayableEndingContent) {
    errors.push({ code: "ENDING_NOT_IN_PLAYABLE" });
  }

  return {
    characterCoverage,
    stageCoverage,
    clueCoverage,
    truthCoverage,
    endingCoverage,
    assignablePlayerCount: assignablePlayerRoles(pkg).length,
    stageCount: stageIds.length,
    ok: errors.length === 0,
    errors,
  };
}

/**
 * ContentUnit → Package section → provenanceIndex → PMD refs
 */
export function buildSectionToContentUnitTrace({ package: pkg, playableProject }) {
  const provenanceIndex = record(pkg?.provenanceIndex);
  const rows = [];
  for (const cu of asArray(playableProject?.contentUnits)) {
    const sectionId = cu.sourceRef?.sectionId;
    if (!sectionId) continue;
    const prov =
      provenanceIndex[sectionId] ||
      provenanceIndex[`clue:${sectionId}`] ||
      record(findPackageSection(pkg, sectionId)?.provenance);
    rows.push({
      contentUnitId: cu.id,
      sectionId,
      stageId: cu.stageId,
      visibility: cu.audience?.visibility,
      provenance: {
        sourceBeatIds: asArray(prov.sourceBeatIds),
        sourceClueIds: asArray(prov.sourceClueIds),
        sourceFactIds: asArray(prov.sourceFactIds),
      },
    });
  }
  return rows;
}

function findPackageSection(pkg, sectionId) {
  for (const s of asArray(pkg?.hostScript?.sections)) if (s.id === sectionId) return s;
  for (const s of asArray(pkg?.publicScripts)) if (s.id === sectionId) return s;
  for (const s of asArray(pkg?.endingContent?.sections)) if (s.id === sectionId) return s;
  for (const sections of Object.values(record(pkg?.roleScripts))) {
    for (const s of asArray(sections)) if (s.id === sectionId) return s;
  }
  for (const c of asArray(pkg?.clues)) if (c.id === sectionId) return c;
  return null;
}

export function buildClueEndToEndTrace({ pmd, package: pkg, playableProject }) {
  return asArray(pmd?.clueView?.clues).map((pmdClue) => {
    const pkgClue = asArray(pkg?.clues).find((c) => c.id === pmdClue.clueId);
    const playableClue = asArray(playableProject?.clues).find((c) => c.id === pmdClue.clueId);
    const contentUnit = asArray(playableProject?.contentUnits).find(
      (cu) => cu.id === playableClue?.contentUnitId,
    );
    return {
      clueId: pmdClue.clueId,
      pmd: {
        isMisleading: Boolean(pmdClue.isMisleading),
        isDecisive: Boolean(pmdClue.isDecisive),
        introducedAt: pmdClue.introducedAt || pmdClue.stageId,
      },
      package: pkgClue
        ? {
            isMisleading: Boolean(pkgClue.isMisleading),
            isDecisive: Boolean(pkgClue.isDecisive),
            stageId: pkgClue.stageId,
            hasParagraphs: asArray(pkgClue.paragraphs).length > 0,
            provenance: pkgClue.provenance || pkg?.provenanceIndex?.[`clue:${pmdClue.clueId}`],
          }
        : null,
      playable: playableClue
        ? {
            stageId: playableClue.stageId,
            contentUnitId: playableClue.contentUnitId,
            hasContentUnit: Boolean(contentUnit),
            sourceSectionId: contentUnit?.sourceRef?.sectionId,
          }
        : null,
      ok: Boolean(pkgClue && playableClue && contentUnit),
    };
  });
}
