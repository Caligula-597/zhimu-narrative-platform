/**
 * P8.2.1 Provenance Diff — WriterResult vs Packet allow-lists.
 */

import { packetAllowLists } from "./script-production-packets.js";
import { normalizeScriptWriterResult } from "./script-writer-result-contracts.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/**
 * @returns {{
 *   status: "CLEAN" | "REVIEW_REQUIRED" | "INVALID",
 *   validSourceRefs: string[],
 *   unknownSourceRefs: string[],
 *   forbiddenSourceRefs: string[],
 *   unknownStageRefs: string[],
 *   unknownClueRefs: string[],
 *   unknownFactRefs: string[],
 *   proposedCanonicalChangeCount: number,
 *   errors: object[],
 * }}
 */
export function diffWriterResultAgainstPacket({ packet, result }) {
  const allows = packetAllowLists(packet);
  const normalized = normalizeScriptWriterResult(result);
  const errors = [];
  const validSourceRefs = [];
  const unknownSourceRefs = [];
  const forbiddenSourceRefs = [];
  const unknownStageRefs = [];
  const unknownClueRefs = [];
  const unknownFactRefs = [];

  const allowedBeats = new Set(allows.allowedSourceBeatIds);
  const allowedClues = new Set(allows.allowedClueIds);
  const allowedFacts = new Set(allows.allowedFactIds);
  const forbiddenFacts = new Set(allows.forbiddenFactIds);
  const stageIds = new Set(allows.stageIds);

  if (!asArray(normalized.sections).length) {
    errors.push({ code: "NO_SECTIONS", message: "WriterResult 无 sections" });
  }

  for (const sec of normalized.sections) {
    if (!sec.stageId) {
      errors.push({ code: "MISSING_STAGE_ID", message: `${sec.sectionId} 缺 stageId` });
    } else if (stageIds.size && !stageIds.has(sec.stageId)) {
      unknownStageRefs.push(sec.stageId);
      errors.push({ code: "UNKNOWN_STAGE", message: `未知 stage ${sec.stageId}` });
    }

    const prov = sec.provenance || {};
    const hasAny =
      asArray(prov.sourceBeatIds).length ||
      asArray(prov.sourceClueIds).length ||
      asArray(prov.sourceFactIds).length;
    if (!hasAny) {
      errors.push({ code: "NO_PROVENANCE", message: `${sec.sectionId} 缺 provenance` });
    }

    for (const id of asArray(prov.sourceBeatIds)) {
      if (allowedBeats.has(id)) validSourceRefs.push(`beat:${id}`);
      else {
        unknownSourceRefs.push(`beat:${id}`);
        errors.push({ code: "UNKNOWN_BEAT", message: `未知 beat ${id}` });
      }
    }
    for (const id of asArray(prov.sourceClueIds)) {
      if (allowedClues.has(id)) validSourceRefs.push(`clue:${id}`);
      else {
        unknownClueRefs.push(id);
        errors.push({ code: "UNKNOWN_CLUE", message: `未知 clue ${id}` });
      }
    }
    for (const id of asArray(prov.sourceFactIds)) {
      if (forbiddenFacts.has(id)) {
        forbiddenSourceRefs.push(id);
        errors.push({ code: "FORBIDDEN_FACT", message: `越权 fact ${id}` });
      } else if (allowedFacts.has(id)) {
        validSourceRefs.push(`fact:${id}`);
      } else {
        unknownFactRefs.push(id);
        errors.push({ code: "UNKNOWN_FACT", message: `未知 fact ${id}` });
      }
    }

    for (const claim of asArray(sec.canonicalClaims)) {
      if (claim.factId && forbiddenFacts.has(claim.factId)) {
        forbiddenSourceRefs.push(claim.factId);
        errors.push({ code: "FORBIDDEN_FACT_CLAIM", message: `claim 引用 forbidden ${claim.factId}` });
      }
      if (claim.factId && allowedFacts.size && !allowedFacts.has(claim.factId) && !forbiddenFacts.has(claim.factId)) {
        unknownFactRefs.push(claim.factId);
        errors.push({ code: "UNKNOWN_FACT_CLAIM", message: `claim 未知 fact ${claim.factId}` });
      }
    }

    for (const id of asArray(sec.inventedStageIds)) {
      unknownStageRefs.push(id);
      errors.push({ code: "NEW_STAGE", message: `不得新增 stage ${id}` });
    }
    for (const id of asArray(sec.inventedCharacterIds)) {
      errors.push({ code: "NEW_CHARACTER", message: `不得新增 character ${id}` });
    }

    if (packet?.kind === "CLUE_WRITER" && sec.clueSemanticsPatch) {
      const locked = record(packet.lockedSemantics);
      const patch = record(sec.clueSemanticsPatch);
      for (const key of [
        "clueId",
        "introducedAt",
        "isMisleading",
        "isDecisive",
      ]) {
        if (patch[key] != null && String(patch[key]) !== String(locked[key])) {
          errors.push({
            code: "CLUE_SEMANTICS_CHANGED",
            message: `不得改写 clue.${key}`,
          });
        }
      }
      if (
        patch.availableStages &&
        JSON.stringify(patch.availableStages) !== JSON.stringify(locked.availableStages)
      ) {
        errors.push({ code: "CLUE_LIFECYCLE_CHANGED", message: "不得改写 availableStages" });
      }
      if (
        patch.possibleFinders &&
        JSON.stringify(patch.possibleFinders) !== JSON.stringify(locked.possibleFinders)
      ) {
        errors.push({ code: "CLUE_FINDERS_CHANGED", message: "不得改写 possibleFinders" });
      }
    }

    if (packet?.kind === "ENDING") {
      for (const claim of asArray(sec.canonicalClaims)) {
        if (claim.claimId === "invented_culprit" || claim.type === "INVENT_CULPRIT") {
          errors.push({ code: "ENDING_INVENTS_TRUTH", message: "Ending 不得发明真凶身份" });
        }
      }
    }
  }

  const proposedCanonicalChangeCount = asArray(normalized.proposedCanonicalChanges).length;

  let status = "CLEAN";
  if (errors.length) status = "INVALID";
  else if (proposedCanonicalChangeCount > 0) status = "REVIEW_REQUIRED";

  return {
    status,
    validSourceRefs: unique(validSourceRefs),
    unknownSourceRefs: unique(unknownSourceRefs),
    forbiddenSourceRefs: unique(forbiddenSourceRefs),
    unknownStageRefs: unique(unknownStageRefs),
    unknownClueRefs: unique(unknownClueRefs),
    unknownFactRefs: unique(unknownFactRefs),
    proposedCanonicalChangeCount,
    errors,
  };
}

function unique(list) {
  return [...new Set(asArray(list))];
}
