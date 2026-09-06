/**
 * P9.4 — walk CompleteScriptPackage text surfaces for quality scanners.
 */

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/**
 * @returns {Array<{ sectionId?: string, roleId?: string, stageId?: string, clueId?: string, kind: string, text: string }>}
 */
export function collectPackageTextUnits(pkg) {
  const draft = record(pkg);
  const units = [];

  for (const s of asArray(draft.hostScript?.sections)) {
    units.push({
      kind: "host",
      sectionId: s.id,
      stageId: s.stageId,
      text: asArray(s.paragraphs).join("\n"),
    });
  }
  for (const [roleId, sections] of Object.entries(record(draft.roleScripts))) {
    for (const s of asArray(sections)) {
      units.push({
        kind: "role",
        roleId,
        sectionId: s.id,
        stageId: s.stageId,
        text: asArray(s.paragraphs).join("\n"),
      });
    }
  }
  for (const s of asArray(draft.publicScripts)) {
    units.push({
      kind: "public",
      sectionId: s.id,
      stageId: s.stageId,
      text: asArray(s.paragraphs).join("\n"),
    });
  }
  for (const s of asArray(draft.sharedScripts)) {
    units.push({
      kind: "shared",
      sectionId: s.id,
      stageId: s.stageId,
      text: asArray(s.paragraphs).join("\n"),
    });
  }
  for (const c of asArray(draft.clues)) {
    units.push({
      kind: "clue",
      clueId: c.id,
      sectionId: c.documentId || c.id,
      stageId: c.stageId,
      text: [c.title, ...asArray(c.paragraphs)].filter(Boolean).join("\n"),
    });
  }
  for (const s of asArray(draft.endingContent?.sections)) {
    units.push({
      kind: "ending",
      sectionId: s.id,
      stageId: s.stageId || draft.endingContent?.finalStageId,
      text: asArray(s.paragraphs).join("\n"),
    });
  }
  return units.filter((u) => u.text && String(u.text).trim());
}

export function packageFullText(pkg) {
  return collectPackageTextUnits(pkg)
    .map((u) => u.text)
    .join("\n");
}

export function playerRoles(pkg) {
  return asArray(pkg?.roles).filter((r) => r?.type !== "HOST" && r?.playerAssignable !== false);
}

export function packageHasGameSurface(pkg) {
  const text = packageFullText(pkg);
  if (/竞价|拍卖|winnerCount|玩法结算|权限结算|投票结算/.test(text)) return true;
  if (asArray(pkg?.mechanismAnnotations).length) return true;
  if (asArray(pkg?.permissions).some((p) => /preview|bid|vote|auction/i.test(String(p?.id || "")))) {
    return true;
  }
  return Boolean(pkg?.qualityHints?.hasGame);
}
