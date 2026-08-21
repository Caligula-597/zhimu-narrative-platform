import { clampInteger, cleanText } from "../prompts/shared.js";
import { MAX_PLAYERS, MAX_WORD_COUNT, MIN_PLAYERS, MIN_WORD_COUNT } from "./constants.js";
import { assertArray } from "./primitives.js";

function cleanStringList(value, { maxItems = 20, maxLength = 200 } = {}) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => cleanText(item, maxLength)).filter(Boolean))].slice(0, maxItems)
    : [];
}

function cleanOrderedStringList(value, { maxItems = 20, maxLength = 200 } = {}) {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : [];
}

function normalizeOutlineGenerationContract(raw) {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    batchItemId: cleanText(value.batchItemId, 40),
    outlineRevision: cleanText(value.outlineRevision, 20) || "2.2",
    premiseAnchors: cleanOrderedStringList(value.premiseAnchors, { maxItems: 8, maxLength: 160 }),
    playerNames: cleanStringList(value.playerNames, { maxItems: 8, maxLength: 80 }),
    playerIdentityRequirements: cleanOrderedStringList(value.playerIdentityRequirements, { maxItems: 8, maxLength: 160 }),
    genreMode: cleanText(value.genreMode, 40),
    contributionTypes: cleanOrderedStringList(value.contributionTypes, { maxItems: 8, maxLength: 40 }),
    stateKeys: cleanStringList(value.stateKeys, { maxItems: 12, maxLength: 80 }),
    stateKeysAreExhaustive: value.stateKeysAreExhaustive === true,
    stateTypes: cleanOrderedStringList(value.stateTypes, { maxItems: 12, maxLength: 20 }),
    stateSetChapterKeys: cleanOrderedStringList(value.stateSetChapterKeys, { maxItems: 12, maxLength: 80 }),
    stateControlModes: Array.isArray(value.stateControlModes)
      ? value.stateControlModes.slice(0, 12).map((entry) => cleanText(entry, 40))
      : [],
    fixedStateValues: Array.isArray(value.fixedStateValues)
      ? value.fixedStateValues.slice(0, 12).map((entry) => cleanText(entry, 160))
      : [],
    resourceKeys: cleanStringList(value.resourceKeys, { maxItems: 8, maxLength: 80 }),
    resourceContracts: Array.isArray(value.resourceContracts)
      ? value.resourceContracts.slice(0, 8).map((resource) => ({
          key: cleanText(resource?.key, 80),
          name: cleanText(resource?.name, 120),
          meaning: cleanText(resource?.meaning, 800),
          initialValue: Number(resource?.initialValue),
          minimum: Number(resource?.minimum),
          maximum: Number(resource?.maximum),
          ownerType: cleanText(resource?.ownerType, 20),
          ownerKey: cleanText(resource?.ownerKey, 80),
          recoverable: resource?.recoverable === true
        }))
      : [],
    resourceUsagePlans: Array.isArray(value.resourceUsagePlans)
      ? value.resourceUsagePlans.slice(0, 8).map((plan) => ({
          resourceKey: cleanText(plan?.resourceKey, 80),
          chapterKeys: cleanOrderedStringList(plan?.chapterKeys, { maxItems: 8, maxLength: 80 }),
          operation: cleanText(plan?.operation, 20),
          amount: Number(plan?.amount),
          placement: cleanText(plan?.placement, 40)
        }))
      : [],
    resourcePolicies: Array.isArray(value.resourcePolicies)
      ? value.resourcePolicies.slice(0, 8).map((policy) => ({
          resourceKey: cleanText(policy?.resourceKey, 80),
          minimumOptionalUses: clampInteger(policy?.minimumOptionalUses, 1, 8, 1),
          maximumMandatoryUses: clampInteger(policy?.maximumMandatoryUses, 0, 8, 0),
          placement: cleanText(policy?.placement, 80) || "chapterBeats.decision.options.effects",
          optionalUseChapterKeys: cleanOrderedStringList(policy?.optionalUseChapterKeys, { maxItems: 8, maxLength: 80 })
        }))
      : [],
    evidenceProvenanceGroups: cleanOrderedStringList(value.evidenceProvenanceGroups, { maxItems: 12, maxLength: 80 }),
    evidenceSourceTypes: cleanOrderedStringList(value.evidenceSourceTypes, { maxItems: 12, maxLength: 80 }),
    evidenceSourceContracts: Array.isArray(value.evidenceSourceContracts)
      ? value.evidenceSourceContracts.slice(0, 16).map((entry) => ({
          evidenceKey: cleanText(entry?.evidenceKey, 80),
          provenanceGroup: cleanText(entry?.provenanceGroup, 80),
          sourceType: cleanText(entry?.sourceType, 80),
          originRootKeys: cleanOrderedStringList(entry?.originRootKeys, { maxItems: 8, maxLength: 80 }),
          commonCauseKeys: cleanOrderedStringList(entry?.commonCauseKeys, { maxItems: 8, maxLength: 80 }),
          independenceDomain: cleanText(entry?.independenceDomain, 160),
          methodDomain: cleanText(entry?.methodDomain, 80)
        }))
      : [],
    spotlightChapterKeys: cleanOrderedStringList(value.spotlightChapterKeys, { maxItems: 8, maxLength: 80 }),
    roleEndingInfluences: Array.isArray(value.roleEndingInfluences)
      ? value.roleEndingInfluences.slice(0, 8).map((entry) => ({
          roleKey: cleanText(entry?.roleKey, 80),
          stateKey: cleanText(entry?.stateKey, 80),
          chapterKey: cleanText(entry?.chapterKey, 80),
          influenceMode: cleanText(entry?.influenceMode, 40) || "causal-path",
          causalAnchorKey: cleanText(entry?.causalAnchorKey, 80)
        }))
      : [],
    requiredConclusionEvidenceKeys: cleanOrderedStringList(value.requiredConclusionEvidenceKeys, { maxItems: 12, maxLength: 80 }),
    hookEvidenceRequirements: Array.isArray(value.hookEvidenceRequirements)
      ? value.hookEvidenceRequirements.slice(0, 4).map((entry) => ({
          hookIndex: clampInteger(entry?.hookIndex, 0, 3, 0),
          evidenceKeys: cleanOrderedStringList(entry?.evidenceKeys, { maxItems: 8, maxLength: 80 })
        }))
      : [],
    roleActionChapterKeys: Array.isArray(value.roleActionChapterKeys)
      ? value.roleActionChapterKeys.slice(0, 8).map((entry) => ({
          roleKey: cleanText(entry?.roleKey, 80),
          chapterKeys: cleanOrderedStringList(entry?.chapterKeys, { maxItems: 12, maxLength: 80 })
        }))
      : [],
    semanticInvariants: Array.isArray(value.semanticInvariants)
      ? value.semanticInvariants.slice(0, 12).map((entry) => ({
          key: cleanText(entry?.key, 80),
          statement: cleanText(entry?.statement, 1000),
          requiredPatterns: cleanOrderedStringList(entry?.requiredPatterns, { maxItems: 8, maxLength: 300 }),
          forbiddenPatterns: cleanOrderedStringList(entry?.forbiddenPatterns, { maxItems: 8, maxLength: 300 })
        }))
      : [],
    forbiddenStateKeys: cleanStringList(value.forbiddenStateKeys, { maxItems: 20, maxLength: 80 }),
    endingTitleTokens: cleanStringList(value.endingTitleTokens, { maxItems: 12, maxLength: 120 }),
    storyEngine: cleanText(value.storyEngine, 1000),
    existenceStatusMechanism: cleanText(value.existenceStatusMechanism, 600),
    truthKnowledgeDistribution: cleanText(value.truthKnowledgeDistribution, 600),
    playerRelationshipTopology: cleanText(value.playerRelationshipTopology, 600),
    finalChoiceType: cleanText(value.finalChoiceType, 600),
    themeExpression: cleanText(value.themeExpression, 600),
    antagonistType: cleanText(value.antagonistType, 600),
    mysteryObjectType: cleanText(value.mysteryObjectType, 600),
    truthRevealMethod: cleanText(value.truthRevealMethod, 600),
    chapterCausalPattern: cleanText(value.chapterCausalPattern, 600),
    evidenceModalityMix: cleanText(value.evidenceModalityMix, 600),
    powerStructure: cleanText(value.powerStructure, 600),
    endingMechanism: cleanText(value.endingMechanism, 600),
    styleDeviceSeeds: cleanStringList(value.styleDeviceSeeds, { maxItems: 8, maxLength: 200 })
  };
}

export function normalizeStoryBrief(input = {}) {
  const playerCount = clampInteger(input.playerCount, MIN_PLAYERS, MAX_PLAYERS, 6);
  const chapterCount = clampInteger(input.chapterCount, 1, 12, 3);
  const wordsPerChapter = clampInteger(
    input.wordsPerChapter,
    2000,
    12000,
    clampInteger(input.targetWordCount, MIN_WORD_COUNT, MAX_WORD_COUNT, chapterCount * 8000) / Math.max(chapterCount, 1)
  );
  const conflicts = cleanText(input.conflicts || input.requirements, 3000);
  return {
    title: cleanText(input.title, 120) || "未命名剧本杀",
    premise: cleanText(input.premise, 12000),
    conflicts,
    wordsPerChapter,
    style: cleanText(input.style, 800) || "悬疑调查，信息逐步揭示，适合线上长线剧本杀",
    audience: cleanText(input.audience, 400) || "线上剧本杀玩家",
    requirements: conflicts,
    roleRequirements: cleanText(input.roleRequirements, 3000),
    evaluationFocus: cleanText(input.evaluationFocus, 3000),
    generationContract: normalizeOutlineGenerationContract(input.generationContract),
    existingManuscript: cleanText(input.existingManuscript, 12000),
    playerCount,
    targetWordCount: clampInteger(input.targetWordCount, MIN_WORD_COUNT, MAX_WORD_COUNT, chapterCount * wordsPerChapter),
    chapterCount,
    sceneCount: clampInteger(input.sceneCount, 1, 40, Math.max(chapterCount * 2, 6)),
    investigationPointCount: clampInteger(input.investigationPointCount, 1, 80, Math.max(chapterCount * 3, 8)),
    clueCount: clampInteger(input.clueCount, 1, 80, Math.max(chapterCount * 3, 8))
  };
}

export function validateStorySpec(raw, brief) {
  const value = raw && typeof raw === "object" ? raw : {};
  const playerCount = clampInteger(value.playerCount, MIN_PLAYERS, MAX_PLAYERS, brief.playerCount);
  const chapterCount = clampInteger(value.chapterCount, 1, 12, brief.chapterCount);
  const chapterKeys = assertArray(value.chapterKeys ?? [], "chapterKeys").slice(0, 12).map((key, index) => cleanText(key, 40) || `chapter-${index + 1}`);
  while (chapterKeys.length < chapterCount) chapterKeys.push(`chapter-${chapterKeys.length + 1}`);
  return {
    title: cleanText(value.title, 120) || brief.title,
    playerCount,
    chapterCount: chapterKeys.length,
    chapterKeys: chapterKeys.slice(0, chapterCount),
    targetWordCount: clampInteger(value.targetWordCount, MIN_WORD_COUNT, MAX_WORD_COUNT, brief.targetWordCount),
    wordsPerSectionMin: clampInteger(value.wordsPerSectionMin, 150, 800, 250),
    sceneCount: clampInteger(value.sceneCount, 1, 40, brief.sceneCount),
    investigationPointCount: clampInteger(value.investigationPointCount, 1, 80, brief.investigationPointCount),
    clueCount: clampInteger(value.clueCount, 1, 80, brief.clueCount),
    constraints: assertArray(value.constraints ?? [], "constraints").slice(0, 12).map((item) => cleanText(item, 300)),
    notes: assertArray(value.notes ?? [], "notes").slice(0, 12).map((item) => cleanText(item, 500))
  };
}
