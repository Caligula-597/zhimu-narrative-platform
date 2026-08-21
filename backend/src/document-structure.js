import {
  CREATOR_TERMINOLOGY,
  normalizeCreationType
} from "../../shared/creator-terminology.js";
import { groupNarrativeStructure } from "./document-structure-grouper.js";
import { evaluateDocumentStructureGate } from "./document-structure-gate.js";

export { CREATOR_TERMINOLOGY, normalizeCreationType } from "../../shared/creator-terminology.js";
export { groupNarrativeStructure } from "./document-structure-grouper.js";
export { evaluateDocumentStructureGate } from "./document-structure-gate.js";

export function analyzeNarrativeStructure(text, { filename = "", creationType = "murder_mystery" } = {}) {
  const normalizedType = normalizeCreationType(creationType);
  const grouped = groupNarrativeStructure(text, { filename });
  const counts = { role: 0, act: 0, scene: 0, clue: 0, secret: 0 };
  const actTitles = new Set();
  const sceneTitles = new Set();
  const clueTitles = new Set();
  for (const candidate of grouped.candidates) {
    if (candidate.type === "act") {
      actTitles.add(
        String(candidate.title ?? "")
          .trim()
          .toLocaleLowerCase("zh-CN")
      );
      continue;
    }
    if (candidate.type === "scene") {
      sceneTitles.add(
        String(candidate.title ?? "")
          .trim()
          .toLocaleLowerCase("zh-CN")
      );
      continue;
    }
    if (candidate.type === "clue") {
      clueTitles.add(
        String(candidate.title ?? "")
          .trim()
          .toLocaleLowerCase("zh-CN")
      );
      continue;
    }
    if (counts[candidate.type] != null) counts[candidate.type] += 1;
  }
  counts.act = actTitles.size;
  counts.scene = sceneTitles.size;
  counts.clue = clueTitles.size;
  const gate = evaluateDocumentStructureGate({
    candidates: grouped.candidates,
    text,
    filename,
    sectionBanners: grouped.sectionBanners,
    wasTruncated: grouped.wasTruncated,
    roleBookletCount: grouped.roleBookletCount
  });

  return {
    creationType: normalizedType,
    terminology: CREATOR_TERMINOLOGY[normalizedType],
    counts,
    candidateCount: grouped.candidates.length,
    candidates: grouped.candidates,
    structureSource: grouped.structureSource,
    sectionBanners: grouped.sectionBanners,
    roleBookletCount: grouped.roleBookletCount || 0,
    gate,
    warnings: gate.warnings
  };
}
