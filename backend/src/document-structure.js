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
  for (const candidate of grouped.candidates) {
    if (counts[candidate.type] != null) counts[candidate.type] += 1;
  }
  const gate = evaluateDocumentStructureGate({
    candidates: grouped.candidates,
    text,
    filename,
    sectionBanners: grouped.sectionBanners,
    wasTruncated: grouped.wasTruncated
  });

  return {
    creationType: normalizedType,
    terminology: CREATOR_TERMINOLOGY[normalizedType],
    counts,
    candidateCount: grouped.candidates.length,
    candidates: grouped.candidates,
    structureSource: grouped.structureSource,
    sectionBanners: grouped.sectionBanners,
    gate,
    warnings: gate.warnings
  };
}
