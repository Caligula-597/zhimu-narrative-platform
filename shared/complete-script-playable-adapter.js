/**
 * P8.2.0 CompleteScriptPackage → existing Playable Compiler source (warehouse-six shape).
 * Does not teach the compiler about PMD.
 */

import { normalizeCompleteScriptPackage } from "./complete-script-package-contracts.js";
import { compilePlayableProject } from "./playable-project-compiler.js";

/**
 * Thin identity-ish adapter: Package fields already mirror Complete Script Fixture.
 */
export function toPlayableCompileSource(pkgInput) {
  const pkg = normalizeCompleteScriptPackage(pkgInput);
  const endingStageId =
    pkg.endingContent?.finalStageId ||
    pkg.stages[pkg.stages.length - 1]?.id ||
    "";
  const endingAsPublic = asArray(pkg.endingContent?.sections).map((s) => ({
    id: s.id,
    stageId: s.stageId || endingStageId,
    title: s.title,
    paragraphs: s.paragraphs,
    type: "REVEAL",
    delivery: s.delivery || "CONDITION_UNLOCK",
    unlockPermissionId: s.unlockPermissionId,
  }));

  return {
    metadata: {
      fixtureId: pkg.id,
      revision: String(pkg.metadata.revision || pkg.revision || "1"),
      title: pkg.metadata.title,
      playerCount: pkg.roles.filter((r) => r.type === "PLAYER" && r.playerAssignable !== false)
        .length,
      sourceType: "COMPLETE_SCRIPT_PACKAGE",
    },
    roles: pkg.roles.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      characterId: r.characterId,
      playerAssignable: r.playerAssignable,
    })),
    stages: pkg.stages.map((s) => ({
      id: s.id,
      order: s.order,
      title: s.title,
      stageRole: s.stageRole,
      enterCondition: s.enterCondition,
      exitCondition: s.exitCondition,
      mechanismAnnotationIds: s.mechanismAnnotationIds || [],
    })),
    hostScript: {
      documentId: pkg.hostScript.documentId,
      sections: pkg.hostScript.sections.map((s) => ({
        id: s.id,
        stageId: s.stageId,
        title: s.title,
        paragraphs: s.paragraphs,
      })),
    },
    roleScripts: Object.fromEntries(
      Object.entries(pkg.roleScripts).map(([roleId, sections]) => [
        roleId,
        sections.map((s) => ({
          id: s.id,
          stageId: s.stageId,
          title: s.title,
          paragraphs: s.paragraphs,
          delivery: s.delivery,
          unlockPermissionId: s.unlockPermissionId,
        })),
      ]),
    ),
    sharedScripts: pkg.sharedScripts.map((s) => ({
      id: s.id,
      stageId: s.stageId,
      roleIds: s.roleIds,
      title: s.title,
      paragraphs: s.paragraphs,
    })),
    publicScripts: [
      ...pkg.publicScripts.map((s) => ({
        id: s.id,
        stageId: s.stageId,
        title: s.title,
        paragraphs: s.paragraphs,
        type: s.type,
        delivery: s.delivery,
        unlockPermissionId: s.unlockPermissionId,
      })),
      ...endingAsPublic,
    ],
    clues: pkg.clues.map((c) => ({
      id: c.id,
      title: c.title,
      stageId: c.stageId,
      delivery: c.delivery,
      visibility: c.visibility,
      paragraphs: c.paragraphs,
      documentId: c.documentId,
      roleIds: c.roleIds,
      permissionId: c.permissionId,
    })),
    mechanismAnnotations: pkg.mechanismAnnotations || [],
    permissions: pkg.permissions || [],
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function compileCompleteScriptPackage(pkgInput, options = {}) {
  const source = toPlayableCompileSource(pkgInput);
  return compilePlayableProject(source, options);
}
