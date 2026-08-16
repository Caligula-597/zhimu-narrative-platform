/**
 * Matrix-first pipeline — validators, word targets, mechanical proposal builder.
 */
import { throwErr } from "./api-errors.js";
import { cleanText } from "./prompts/shared.js";
import { buildEntityUnlockSchedule, serializeEntitySchedule } from "./prompts/matrix-entity-unlock.js";
import { normalizePlayStructure, playStructureProfile } from "../../shared/play-structure.js";

const MAX_PLAYERS = 8;
const CLUE_SCOPES = new Set(["private", "pair", "group", "bridge", "mainline", "public_anchor", "texture"]);
const CLUE_FUNCTIONS = new Set(["truth", "relationship", "branch", "action", "emotion", "texture"]);
const CLUE_MISSING_EFFECTS = new Set(["emotional_loss", "branch_closed", "harder_inference", "ending_shift", "none"]);
const CLUE_LINK_TYPES = new Set(["supports", "contradicts", "recontextualizes", "unlocks", "echoes"]);
const CLUE_TRACE_MODES = new Set(["none_high_cost", "ambiguous", "attributable"]);
const CLUE_REASONING_MODES = new Set(["observation", "testimony", "comparison", "sequence", "material_test", "relationship", "rule_application", "mixed"]);
const TRUTH_NODE_SCOPES = new Set(["mainline", "branch", "relationship", "context"]);
const TRUTH_NODE_IMPORTANCE = new Set(["critical", "supporting", "local"]);

function assertArray(value, name) {
  if (!Array.isArray(value)) throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 返回的 ${name} 不是数组`);
  return value;
}

function uniqueKeys(items, name) {
  const keys = new Set();
  for (const item of items) {
    const key = item?.key;
    if (!key || typeof key !== "string") throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 返回的 ${name} 缺少 key`);
    if (keys.has(key)) throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 返回的 ${name} 存在重复 key：${key}`);
    keys.add(key);
  }
  return keys;
}

export const VOLUME_TIERS = ["demo", "standard", "epic"];

export function pipelineWordTargets(setting = {}) {
  const tier = VOLUME_TIERS.includes(setting.volumeTier) ? setting.volumeTier : "standard";
  const map = {
    demo: { perScript: 800, minScript: 400, label: "示范档" },
    standard: { perScript: 1500, minScript: 600, label: "标准档" },
    epic: { perScript: 4000, minScript: 2000, label: "完整档" }
  };
  return { tier, ...map[tier] };
}

export function pipelineScriptMinWords(session) {
  const setting = session?.setting || {};
  return session?.config?.wordsPerSectionMin || pipelineWordTargets(setting).minScript;
}

export function validateTruthBible(raw, config, setting = {}) {
  const value = raw && typeof raw === "object" ? raw : {};
  const playStructure = normalizePlayStructure(value.playStructure || setting.playStructure);
  const structureProfile = playStructureProfile(playStructure);
  const chapterKeys = config?.chapterKeys || [];
  const physicalTimeline = assertArray(value.physicalTimeline ?? value.timeline ?? [], "physicalTimeline")
    .slice(0, 24)
    .map((row, index) => ({
      id: cleanText(row.id, 40) || `t-${index + 1}`,
      time: cleanText(row.time, 120),
      event: cleanText(row.event, 800),
      participants: assertArray(row.participants ?? [], "timeline.participants").slice(0, 8).map((p) => cleanText(p, 80))
    }));
  const timeline = physicalTimeline;
  const supernaturalRules = assertArray(value.supernaturalRules ?? [], "supernaturalRules")
    .slice(0, 8)
    .map((row) => ({
      rule: cleanText(row.rule, 600),
      visibility: cleanText(row.visibility, 32) || "HOST_ONLY",
      observableEffect: cleanText(row.observableEffect, 300)
    }));
  const misdirections = assertArray(value.misdirections ?? [], "misdirections").slice(0, 5).map((row, index) => ({
    layer: Number(row.layer) || index + 1,
    surface: cleanText(row.surface, 600),
    misleading: cleanText(row.misleading, 600),
    resolution: cleanText(row.resolution, 600)
  }));
  const spoilerGates = assertArray(value.spoilerGates ?? [], "spoilerGates").slice(0, 12).map((row) => ({
    actKey: chapterKeys.includes(row.actKey) ? row.actKey : chapterKeys[0],
    forbiddenFacts: assertArray(row.forbiddenFacts ?? [], "forbiddenFacts").slice(0, 12).map((f) => cleanText(f, 300))
  }));
  let summary = cleanText(value.summary, 4000);
  const killer = cleanText(value.killer, 200);
  const method = cleanText(value.method, 1200);
  const motive = cleanText(value.motive, 1200);
  const playerExperiencePromise = cleanText(value.playerExperiencePromise, 1200);
  const retellableMoment = cleanText(value.retellableMoment, 1200);
  const worldSpecificActions = assertArray(value.worldSpecificActions ?? [], "worldSpecificActions").slice(0, 8).map((row) => ({
    action: cleanText(row?.action, 400),
    whyOnlyHere: cleanText(row?.whyOnlyHere, 600),
    changes: cleanText(row?.changes, 600)
  }));
  const centralQuestion = cleanText(value.centralQuestion, 800);
  const sharedObjective = cleanText(value.sharedObjective, 1200);
  const publicCrisis = cleanText(value.publicCrisis, 1600);
  const irreversibleDeadline = cleanText(value.irreversibleDeadline, 600);
  const objectiveFacts = assertArray(value.objectiveFacts ?? [], "objectiveFacts").slice(0, 24).map((row, index) => ({
    key: cleanText(row?.key, 40) || `fact-${index + 1}`,
    statement: cleanText(row?.statement, 800),
    observableBy: assertArray(row?.observableBy ?? [], "objectiveFacts.observableBy").slice(0, 8).map((item) => cleanText(item, 80)),
    disputedBy: assertArray(row?.disputedBy ?? [], "objectiveFacts.disputedBy").slice(0, 8).map((item) => cleanText(item, 80))
  }));
  const truthNodes = assertArray(value.truthNodes ?? [], "truthNodes").slice(0, 24).map((row, index) => ({
    key: cleanText(row?.key, 40) || `truth-${index + 1}`,
    statement: cleanText(row?.statement, 1000),
    scope: TRUTH_NODE_SCOPES.has(row?.scope) ? row.scope : "mainline",
    importance: TRUTH_NODE_IMPORTANCE.has(row?.importance) ? row.importance : "supporting",
    involvedRoleKeys: assertArray(row?.involvedRoleKeys ?? [], "truthNodes.involvedRoleKeys").slice(0, 8).map((item) => cleanText(item, 40)),
    causedByTruthNodeKeys: assertArray(row?.causedByTruthNodeKeys ?? [], "truthNodes.causedByTruthNodeKeys").slice(0, 8).map((item) => cleanText(item, 40)),
    consequenceIfUnknown: cleanText(row?.consequenceIfUnknown, 600)
  }));
  const truthNodeKeys = uniqueKeys(truthNodes, "truthNodes");
  for (const node of truthNodes) {
    if (!node.statement) throwErr("DEEPSEEK_OUTPUT_INVALID", `真相节点 ${node.key} 缺少客观事实陈述`);
    if (node.causedByTruthNodeKeys.some((key) => !truthNodeKeys.has(key))) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `真相节点 ${node.key} 引用了未知前因节点`);
    }
  }
  const rawEndingAxes = assertArray(value.endingAxes ?? [], "endingAxes");
  if (structureProfile.requiresPlayableDecision && rawEndingAxes.length > 6) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "叙事结局轴不得超过 6 个；细粒度运行变量不能全部冒充主结局维度");
  }
  const endingAxes = rawEndingAxes.slice(0, 6).map((row, index) => ({
    key: cleanText(row?.key, 40) || `axis-${index + 1}`,
    label: cleanText(row?.label, 160),
    lowMeaning: cleanText(row?.lowMeaning, 500),
    highMeaning: cleanText(row?.highMeaning, 500),
    changedBy: assertArray(row?.changedBy ?? [], "endingAxes.changedBy").slice(0, 12).map((item) => cleanText(item, 80))
  }));
  const endingAxisKeys = uniqueKeys(endingAxes, "endingAxes");
  const rawEndingRoutes = assertArray(value.endingRoutes ?? [], "endingRoutes");
  if (structureProfile.requiresPlayableDecision && rawEndingRoutes.length > 8) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "主叙事结局不得超过 8 条；角色尾声差异应作为修饰项而非继续增加主路线");
  }
  const endingRoutes = rawEndingRoutes.slice(0, 8).map((row, index) => ({
    key: cleanText(row?.key, 40) || `ending-${index + 1}`,
    title: cleanText(row?.title, 160),
    consequence: cleanText(row?.consequence, 1200),
    priority: Number.isFinite(Number(row?.priority)) ? Number(row.priority) : 0,
    isDefault: row?.isDefault === true,
    requirements: assertArray(row?.requirements ?? [], "endingRoutes.requirements").slice(0, 8).map((requirement) => ({
      axisKey: cleanText(requirement?.axisKey, 40),
      operator: ["gt", "gte", "eq", "lte", "lt"].includes(requirement?.operator) ? requirement.operator : "gte",
      value: Number.isFinite(Number(requirement?.value)) ? Number(requirement.value) : 0
    }))
  }));
  uniqueKeys(endingRoutes, "endingRoutes");
  const allowedRoleKeys = new Set(Array.from({ length: Math.max(1, Number(config?.playerCount) || 6) }, (_, index) => `role-${index + 1}`));
  const roleEpilogues = assertArray(value.roleEpilogues ?? [], "roleEpilogues")
    .slice(0, allowedRoleKeys.size)
    .map((row, roleIndex) => ({
      roleKey: cleanText(row?.roleKey, 40) || `role-${roleIndex + 1}`,
      variants: assertArray(row?.variants ?? [], "roleEpilogues.variants").slice(0, 3).map((variant, variantIndex) => ({
        key: cleanText(variant?.key, 40) || `role-${roleIndex + 1}-epilogue-${variantIndex + 1}`,
        title: cleanText(variant?.title, 160),
        consequence: cleanText(variant?.consequence, 1000),
        priority: Number.isFinite(Number(variant?.priority)) ? Number(variant.priority) : 0,
        isDefault: variant?.isDefault === true,
        requirements: assertArray(variant?.requirements ?? [], "roleEpilogues.requirements").slice(0, 6).map((requirement) => ({
          axisKey: cleanText(requirement?.axisKey, 40),
          operator: ["gt", "gte", "eq", "lte", "lt"].includes(requirement?.operator) ? requirement.operator : "gte",
          value: Number.isFinite(Number(requirement?.value)) ? Number(requirement.value) : 0
        }))
      }))
    }));
  const seenEpilogueRoles = new Set();
  for (const epilogue of roleEpilogues) {
    if (!allowedRoleKeys.has(epilogue.roleKey) || seenEpilogueRoles.has(epilogue.roleKey)) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `角色尾声引用未知或重复角色：${epilogue.roleKey}`);
    }
    seenEpilogueRoles.add(epilogue.roleKey);
    uniqueKeys(epilogue.variants, `roleEpilogues.${epilogue.roleKey}.variants`);
    const defaults = epilogue.variants.filter((variant) => variant.isDefault);
    if (epilogue.variants.length && defaults.length !== 1) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `${epilogue.roleKey} 的角色尾声必须恰好包含一个默认变体`);
    }
    for (const variant of epilogue.variants) {
      if (!variant.title || !variant.consequence || (!variant.isDefault && !variant.requirements.length)) {
        throwErr("DEEPSEEK_OUTPUT_INVALID", `${epilogue.roleKey}/${variant.key} 缺少标题、可见后果或判定条件`);
      }
      if (variant.requirements.some((requirement) => !endingAxisKeys.has(requirement.axisKey))) {
        throwErr("DEEPSEEK_OUTPUT_INVALID", `${epilogue.roleKey}/${variant.key} 引用了未知结局轴`);
      }
    }
  }
  if (summary.length < 200) {
    summary = cleanText(
      [value.summary, publicCrisis, centralQuestion, motive, method, timeline.map((t) => t.event).join("；")].filter(Boolean).join("\n"),
      4000
    );
  }
  if (summary.length < 200) throwErr("DEEPSEEK_OUTPUT_INVALID", "真相档案摘要过短（至少 200 字）");
  if (structureProfile.requiresCulprit && (!killer || !method)) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "推理案件的真相档案需包含凶手与手法");
  }
  if (structureProfile.requiresPlayableDecision && (!sharedObjective || !centralQuestion || !publicCrisis || !irreversibleDeadline || endingAxes.length < 2)) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "阵营/机制/混合结构需包含共同目标、公共危机、不可逆期限、核心决定与至少两个结局轴");
  }
  if (structureProfile.requiresPlayableDecision) {
    const defaults = endingRoutes.filter((route) => route.isDefault);
    if (endingRoutes.length < 3 || defaults.length !== 1) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", "可玩结构需提供至少三个可结算结局，且恰好一个是默认结局");
    }
    for (const route of endingRoutes) {
      if (!route.title || !route.consequence || (!route.isDefault && !route.requirements.length)) {
        throwErr("DEEPSEEK_OUTPUT_INVALID", `结局 ${route.key} 缺少标题、可见后果或判定条件`);
      }
      if (route.requirements.some((requirement) => !endingAxisKeys.has(requirement.axisKey))) {
        throwErr("DEEPSEEK_OUTPUT_INVALID", `结局 ${route.key} 引用了未知结局轴`);
      }
    }
  }
  return {
    playStructure,
    summary,
    playerExperiencePromise,
    retellableMoment,
    worldSpecificActions,
    sharedObjective,
    centralQuestion,
    publicCrisis,
    irreversibleDeadline,
    objectiveFacts,
    truthNodes,
    endingAxes,
    endingRoutes,
    roleEpilogues,
    settlementPrinciple: cleanText(value.settlementPrinciple, 1200),
    killer,
    method,
    motive,
    victim: cleanText(value.victim, 200),
    timeline,
    physicalTimeline,
    supernaturalRules,
    misdirections,
    spoilerGates,
    hostNotes: cleanText(value.hostNotes, 3000),
    suggestions: assertArray(value.suggestions ?? [], "suggestions").slice(0, 12).map((s) => cleanText(s, 500))
  };
}

export function scanEndingComposition(truthBible, config, setting = {}) {
  const structureProfile = playStructureProfile(setting.playStructure || truthBible?.playStructure);
  if (!structureProfile.requiresPlayableDecision) return { passed: true, skipped: true, violations: [] };
  const expectedRoleKeys = Array.from({ length: Math.max(1, Number(config?.playerCount) || 6) }, (_, index) => `role-${index + 1}`);
  const byRole = new Map((truthBible?.roleEpilogues || []).map((item) => [item.roleKey, item]));
  const violations = [];
  for (const roleKey of expectedRoleKeys) {
    const epilogue = byRole.get(roleKey);
    if (!epilogue || epilogue.variants?.length < 2) {
      violations.push({
        code: "role_epilogue_missing",
        roleKey,
        targetStage: "truth",
        message: `${roleKey} 缺少至少两个由结局轴结算的个人尾声变体`
      });
    }
  }
  return {
    passed: violations.length === 0,
    skipped: false,
    mainEndingCount: truthBible?.endingRoutes?.length || 0,
    roleEpilogueCount: [...byRole.values()].reduce((count, item) => count + (item.variants?.length || 0), 0),
    violations
  };
}

export function scanTruthNodeDesign(truthBible) {
  const nodes = truthBible?.truthNodes || [];
  const critical = nodes.filter((node) => node.importance === "critical");
  const local = nodes.filter((node) => node.importance === "local" || node.scope === "relationship" || node.scope === "branch");
  const violations = [];
  if (nodes.length < 4) violations.push({ code: "truth_nodes_too_thin", message: "完整真相至少应拆成 4 个可独立拼回的节点" });
  if (!critical.length) violations.push({ code: "critical_truth_missing", message: "没有会改变主线判断的 critical 真相节点" });
  if (!local.length) violations.push({ code: "local_truth_missing", message: "没有只服务局部关系或支线的真相节点，容易把所有内容挤进单一主线" });
  if (!truthBible?.sharedObjective) violations.push({ code: "shared_objective_missing", message: "缺少玩家在冲突中仍必须暂时合作完成的现实目标" });
  return { passed: violations.length === 0, violations, metrics: { total: nodes.length, critical: critical.length, local: local.length } };
}

export function validateCharacterArchives(raw, config, setting = {}, truthBible = {}) {
  const value = raw && typeof raw === "object" ? raw : {};
  const structureProfile = playStructureProfile(setting.playStructure);
  const playerCount = config?.playerCount || 6;
  const chapterKeys = config?.chapterKeys || [];
  const truthNodeKeys = new Set((truthBible?.truthNodes || []).map((node) => node.key));
  const roles = assertArray(value.roles ?? [], "roles").slice(0, MAX_PLAYERS);
  if (roles.length !== playerCount) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", `角色档案需恰好 ${playerCount} 位，实际 ${roles.length} 位`);
  }
  for (const [index, role] of roles.entries()) {
    if (!role.key) role.key = `role-${index + 1}`;
    role.name = cleanText(role.name, 80);
    role.publicIdentity = cleanText(role.publicIdentity || role.publicProfile, 800);
    role.pronouns = ["他", "她", "TA"].includes(cleanText(role.pronouns, 8))
      ? cleanText(role.pronouns, 8)
      : "TA";
    role.hiddenIdentity = cleanText(role.hiddenIdentity, 1200);
    role.motive = cleanText(role.motive, 800);
    role.relationships = cleanText(role.relationships, 1200);
    role.timelineActions = cleanText(role.timelineActions, 1500);
    role.innerConflict = cleanText(role.innerConflict, 800);
    role.voiceHints = cleanText(role.voiceHints, 600);
    role.immediateWant = cleanText(role.immediateWant, 600);
    role.privateInterest = cleanText(role.privateInterest, 800);
    role.nonNegotiable = cleanText(role.nonNegotiable, 600);
    role.decisionPower = cleanText(role.decisionPower, 800);
    role.failureCost = cleanText(role.failureCost, 800);
    role.agencyProfile = {
      agencyProof: cleanText(role?.agencyProfile?.agencyProof, 800),
      dependencyProof: cleanText(role?.agencyProfile?.dependencyProof, 800),
      exposurePlan: assertArray(role?.agencyProfile?.exposurePlan ?? [], "agencyProfile.exposurePlan").slice(0, 12).map((item) => ({
        actKey: chapterKeys.includes(item?.actKey) ? item.actKey : chapterKeys[0],
        interaction: cleanText(item?.interaction, 500),
        affectedRoleKeys: assertArray(item?.affectedRoleKeys ?? [], "agencyProfile.affectedRoleKeys").slice(0, 8).map((key) => cleanText(key, 40))
      })),
      removalImpact: cleanText(role?.agencyProfile?.removalImpact, 1000)
    };
    role.playableMoves = assertArray(role.playableMoves ?? [], "playableMoves").slice(0, 8).map((item) => cleanText(item, 400));
    role.resources = assertArray(role.resources ?? [], "resources").slice(0, 8).map((item, resourceIndex) => ({
      key: cleanText(item?.key, 40) || `${role.key}-resource-${resourceIndex + 1}`,
      name: cleanText(item?.name, 120),
      amount: Number.isFinite(Number(item?.amount)) ? Number(item.amount) : 1,
      transferable: item?.transferable !== false,
      meaning: cleanText(item?.meaning, 500)
    }));
    role.relationshipDebts = assertArray(role.relationshipDebts ?? [], "relationshipDebts").slice(0, 8).map((item) => ({
      roleKey: cleanText(item?.roleKey, 40),
      debt: cleanText(item?.debt, 600),
      leverage: cleanText(item?.leverage, 500),
      fractureCondition: cleanText(item?.fractureCondition, 500)
    }));
    role.knownTruthNodeKeys = assertArray(role.knownTruthNodeKeys ?? [], "knownTruthNodeKeys").slice(0, 12).map((item) => cleanText(item, 40));
    role.partialTruths = assertArray(role.partialTruths ?? [], "partialTruths").slice(0, 12).map((item) => ({
      truthNodeKey: cleanText(item?.truthNodeKey, 40),
      fragment: cleanText(item?.fragment, 800),
      misinterpretation: cleanText(item?.misinterpretation, 800),
      learnedInActKey: chapterKeys.includes(item?.learnedInActKey) ? item.learnedInActKey : chapterKeys[0]
    }));
    role.lies = assertArray(role.lies ?? [], "lies").slice(0, 5).map((l) => cleanText(l, 400));
    role.actTasks = assertArray(role.actTasks ?? [], "actTasks").slice(0, 12).map((row) => ({
      actKey: chapterKeys.includes(row.actKey) ? row.actKey : chapterKeys[0],
      tasks: assertArray(row.tasks ?? [], "tasks").slice(0, 6).map((t) => cleanText(t, 300)),
      tips: cleanText(row.tips, 600)
    }));
    if (!role.name) throwErr("DEEPSEEK_OUTPUT_INVALID", `角色 ${role.key} 缺少 name`);
    if (truthNodeKeys.size && (
      role.knownTruthNodeKeys.some((key) => !truthNodeKeys.has(key)) ||
      role.partialTruths.some((item) => !truthNodeKeys.has(item.truthNodeKey))
    )) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `角色 ${role.key} 引用了不存在的真相节点`);
    }
    if (structureProfile.requiresPlayableDecision && (
      !role.immediateWant || !role.nonNegotiable || !role.failureCost ||
      role.playableMoves.length < 2 || role.relationshipDebts.length < 1
    )) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `角色 ${role.key} 缺少可玩处境：需即时欲望、不可退让项、失败代价、关系债务和至少两种主动行动；不要求机械配发独占权限`);
    }
  }
  uniqueKeys(roles, "roles");
  const truthStressTests = assertArray(value.truthStressTests ?? [], "truthStressTests").slice(0, 24).map((item) => ({
    truthNodeKey: cleanText(item?.truthNodeKey, 40),
    roleKeys: assertArray(item?.roleKeys ?? [], "truthStressTests.roleKeys").slice(0, 8).map((key) => cleanText(key, 40)),
    pressureChain: cleanText(item?.pressureChain, 1200),
    behaviorVerdict: ["credible", "character_revision", "truth_revision"].includes(item?.behaviorVerdict)
      ? item.behaviorVerdict
      : "character_revision",
    contradiction: cleanText(item?.contradiction, 1000),
    revisionTarget: cleanText(item?.revisionTarget, 500)
  }));
  return {
    roles,
    truthStressTests,
    suggestions: assertArray(value.suggestions ?? [], "suggestions").slice(0, 12).map((s) => cleanText(s, 500))
  };
}

export function validateClueNetwork(raw, config, characterArchives, truthBible = {}, setting = {}) {
  const value = raw && typeof raw === "object" ? raw : {};
  const chapterKeys = config?.chapterKeys || [];
  const roleKeys = new Set((characterArchives?.roles || []).map((role) => role.key));
  const truthNodeByKey = new Map((truthBible?.truthNodes || []).map((node) => [node.key, node]));
  const clues = assertArray(value.clues ?? [], "clueNetwork.clues").slice(0, 80).map((rawClue, index) => {
    const clue = rawClue && typeof rawClue === "object" ? rawClue : {};
    const rawActKey = cleanText(clue.actKey, 40);
    if (rawActKey && chapterKeys.length && !chapterKeys.includes(rawActKey)) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `线索 ${clue.key || index + 1} 引用了未知幕：${rawActKey}`);
    }
    const scope = CLUE_SCOPES.has(clue.scope) ? clue.scope : "private";
    const clueFunction = CLUE_FUNCTIONS.has(clue.function) ? clue.function : "truth";
    const missingRaw = clue.missingEffect && typeof clue.missingEffect === "object" ? clue.missingEffect : {};
    const interferenceRaw = clue.interference && typeof clue.interference === "object" ? clue.interference : {};
    const acquisitionRaw = clue.acquisition && typeof clue.acquisition === "object" ? clue.acquisition : {};
    return {
      key: cleanText(clue.key, 40) || `clue-${index + 1}`,
      name: cleanText(clue.name, 160),
      description: cleanText(clue.description, 1200),
      hostMeaning: cleanText(clue.hostMeaning, 1200),
      actKey: rawActKey || chapterKeys[0],
      scope,
      function: clueFunction,
      involvedRoleKeys: assertArray(clue.involvedRoleKeys ?? [], "clue.involvedRoleKeys").slice(0, 8).map((item) => cleanText(item, 40)),
      holderRoleKeys: assertArray(clue.holderRoleKeys ?? [], "clue.holderRoleKeys").slice(0, 8).map((item) => cleanText(item, 40)),
      interpreterRoleKeys: assertArray(clue.interpreterRoleKeys ?? [], "clue.interpreterRoleKeys").slice(0, 8).map((item) => cleanText(item, 40)),
      misreaderRoleKeys: assertArray(clue.misreaderRoleKeys ?? [], "clue.misreaderRoleKeys").slice(0, 8).map((item) => cleanText(item, 40)),
      truthNodeKeys: assertArray(clue.truthNodeKeys ?? [], "clue.truthNodeKeys").slice(0, 8).map((item) => cleanText(item, 40)),
      grantMode: ["auto", "host_confirm", "explore"].includes(clue.grantMode) ? clue.grantMode : "host_confirm",
      source: cleanText(clue.source, 48) || "ClueCard",
      physicalForm: cleanText(clue.physicalForm, 400),
      affordances: assertArray(clue.affordances ?? [], "clue.affordances").slice(0, 8).map((item) => cleanText(item, 200)),
      acquisition: {
        method: cleanText(acquisitionRaw.method, 600),
        location: cleanText(acquisitionRaw.location, 240),
        condition: cleanText(acquisitionRaw.condition, 500),
        sceneKey: cleanText(acquisitionRaw.sceneKey, 40)
      },
      misleadingRead: cleanText(clue.misleadingRead, 800),
      recontextualizedByClueKeys: assertArray(clue.recontextualizedByClueKeys ?? [], "clue.recontextualizedByClueKeys").slice(0, 8).map((item) => cleanText(item, 40)),
      publicImpact: cleanText(clue.publicImpact, 800),
      interference: {
        canHide: interferenceRaw.canHide === true,
        canDestroy: interferenceRaw.canDestroy === true,
        canSwap: interferenceRaw.canSwap === true,
        cost: cleanText(interferenceRaw.cost, 600),
        costSeverity: ["low", "medium", "high"].includes(interferenceRaw.costSeverity) ? interferenceRaw.costSeverity : "medium",
        traceMode: CLUE_TRACE_MODES.has(interferenceRaw.traceMode)
          ? interferenceRaw.traceMode
          : (interferenceRaw.traceClueKey ? "attributable" : "none_high_cost"),
        traceClueKey: cleanText(interferenceRaw.traceClueKey, 40),
        attributionCondition: cleanText(interferenceRaw.attributionCondition, 500)
      },
      missingEffect: {
        type: CLUE_MISSING_EFFECTS.has(missingRaw.type) ? missingRaw.type : "none",
        description: cleanText(missingRaw.description, 700)
      },
      settlementUse: cleanText(clue.settlementUse, 600),
      conflictingInterpretations: assertArray(clue.conflictingInterpretations ?? [], "clue.conflictingInterpretations").slice(0, 6).map((item) => cleanText(item, 300))
    };
  });
  if (!clues.length) throwErr("DEEPSEEK_OUTPUT_INVALID", "线索网络至少需要一条线索");
  const clueKeys = uniqueKeys(clues, "clueNetwork.clues");
  for (const clue of clues) {
    if (!clue.name || !clue.description || !clue.hostMeaning || !clue.acquisition.method || !clue.missingEffect.description) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `线索 ${clue.key} 缺少名称、玩家可见内容、主持含义、取得方式或缺失后果`);
    }
    const referencedRoles = [
      ...clue.involvedRoleKeys,
      ...clue.holderRoleKeys,
      ...clue.interpreterRoleKeys,
      ...clue.misreaderRoleKeys
    ];
    if (referencedRoles.some((roleKey) => !roleKeys.has(roleKey))) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `线索 ${clue.key} 引用了未知角色`);
    }
    if (clue.truthNodeKeys.some((key) => !truthNodeByKey.has(key))) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `线索 ${clue.key} 引用了未知真相节点`);
    }
    if (clue.scope === "private" && clue.involvedRoleKeys.length > 1) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `私人线索 ${clue.key} 不应强连多名角色`);
    }
    if (clue.scope === "pair" && clue.involvedRoleKeys.length !== 2) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `双人线索 ${clue.key} 必须恰好关联两名角色`);
    }
    if (clue.scope === "group" && (clue.involvedRoleKeys.length < 2 || clue.involvedRoleKeys.length > 3)) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `小组线索 ${clue.key} 应只关联两到三名角色`);
    }
    if (roleKeys.size > 2 && clue.involvedRoleKeys.length === roleKeys.size && clue.scope !== "public_anchor") {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `线索 ${clue.key} 强行关联全员；只有公共锚点允许改变全桌共同现实`);
    }
    if (clue.scope === "public_anchor" && !clue.publicImpact) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `公共锚点 ${clue.key} 必须说明怎样改变全桌共同现实`);
    }
    if (clue.recontextualizedByClueKeys.some((key) => !clueKeys.has(key))) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `线索 ${clue.key} 的重释关系引用了未知线索`);
    }
    const interferable = clue.interference.canHide || clue.interference.canDestroy || clue.interference.canSwap;
    if (interferable && !clue.interference.cost) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `可干扰线索 ${clue.key} 必须登记真实代价`);
    }
    if (interferable && clue.interference.traceMode === "none_high_cost" && clue.interference.costSeverity !== "high") {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `线索 ${clue.key} 若可无痕干扰，必须支付 high 级别代价`);
    }
    if (interferable && ["ambiguous", "attributable"].includes(clue.interference.traceMode) && !clue.interference.traceClueKey) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `线索 ${clue.key} 的 ${clue.interference.traceMode} 干扰模式必须登记次生痕迹`);
    }
    if (clue.interference.traceClueKey && !clueKeys.has(clue.interference.traceClueKey)) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `线索 ${clue.key} 的干扰痕迹引用了未知线索`);
    }
  }

  const truthCoverage = assertArray(value.truthCoverage ?? [], "clueNetwork.truthCoverage").slice(0, 24).map((rawCoverage, index) => ({
    truthNodeKey: cleanText(rawCoverage?.truthNodeKey, 40),
    paths: assertArray(rawCoverage?.paths ?? [], "truthCoverage.paths").slice(0, 8).map((rawPath, pathIndex) => ({
      key: cleanText(rawPath?.key, 40) || `path-${index + 1}-${pathIndex + 1}`,
      channel: cleanText(rawPath?.channel, 80),
      clueKeys: assertArray(rawPath?.clueKeys ?? [], "truthCoverage.path.clueKeys").slice(0, 12).map((item) => cleanText(item, 40)),
      requiredRoleKeys: assertArray(rawPath?.requiredRoleKeys ?? [], "truthCoverage.path.requiredRoleKeys").slice(0, 8).map((item) => cleanText(item, 40)),
      requiredInterpreterRoleKeys: assertArray(rawPath?.requiredInterpreterRoleKeys ?? [], "truthCoverage.path.requiredInterpreterRoleKeys").slice(0, 8).map((item) => cleanText(item, 40)),
      requiredActKeys: assertArray(rawPath?.requiredActKeys ?? [], "truthCoverage.path.requiredActKeys").slice(0, 8).map((item) => cleanText(item, 40)),
      reasoningMode: CLUE_REASONING_MODES.has(rawPath?.reasoningMode) ? rawPath.reasoningMode : "mixed",
      dependencyMetadataComplete:
        Array.isArray(rawPath?.requiredRoleKeys) &&
        Array.isArray(rawPath?.requiredInterpreterRoleKeys) &&
        Array.isArray(rawPath?.requiredActKeys) &&
        rawPath.requiredActKeys.length > 0 &&
        CLUE_REASONING_MODES.has(rawPath?.reasoningMode)
    })),
    fallback: cleanText(rawCoverage?.fallback, 1000)
  }));
  const coverageByTruth = new Map();
  for (const coverage of truthCoverage) {
    if (!truthNodeByKey.has(coverage.truthNodeKey)) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `线索覆盖表引用了未知真相节点：${coverage.truthNodeKey}`);
    }
    if (coverageByTruth.has(coverage.truthNodeKey)) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `真相节点 ${coverage.truthNodeKey} 的覆盖表重复`);
    }
    coverageByTruth.set(coverage.truthNodeKey, coverage);
    const signatures = new Set();
    const usedClueKeys = new Set();
    const channels = new Set();
    for (const path of coverage.paths) {
      if (!path.clueKeys.length || path.clueKeys.some((key) => !clueKeys.has(key))) {
        throwErr("DEEPSEEK_OUTPUT_INVALID", `真相节点 ${coverage.truthNodeKey} 存在空路径或未知线索`);
      }
      const signature = [...new Set(path.clueKeys)].sort().join("|");
      if (signatures.has(signature)) {
        throwErr("DEEPSEEK_OUTPUT_INVALID", `真相节点 ${coverage.truthNodeKey} 的两条还原路径实际相同`);
      }
      if (path.clueKeys.some((key) => usedClueKeys.has(key))) {
        throwErr("DEEPSEEK_OUTPUT_INVALID", `真相节点 ${coverage.truthNodeKey} 的所谓独立路径共用了同一条线索`);
      }
      if (path.channel && channels.has(path.channel)) {
        throwErr("DEEPSEEK_OUTPUT_INVALID", `真相节点 ${coverage.truthNodeKey} 的独立路径应来自不同信息渠道`);
      }
      signatures.add(signature);
      path.clueKeys.forEach((key) => usedClueKeys.add(key));
      if (path.channel) channels.add(path.channel);
    }
  }
  for (const node of truthNodeByKey.values()) {
    if (node.importance !== "critical") continue;
    const coverage = coverageByTruth.get(node.key);
    if (!coverage || coverage.paths.length < 2 || !coverage.fallback) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `关键真相 ${node.key} 需要至少两条独立线索路径和不卡局兜底`);
    }
  }

  const links = assertArray(value.links ?? [], "clueNetwork.links").slice(0, 120).map((rawLink) => ({
    fromClueKey: cleanText(rawLink?.fromClueKey, 40),
    toClueKey: cleanText(rawLink?.toClueKey, 40),
    relationType: CLUE_LINK_TYPES.has(rawLink?.relationType) ? rawLink.relationType : "supports",
    reason: cleanText(rawLink?.reason, 600)
  }));
  for (const link of links) {
    if (!clueKeys.has(link.fromClueKey) || !clueKeys.has(link.toClueKey) || link.fromClueKey === link.toClueKey) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", "线索关系存在未知节点或自环");
    }
  }
  const publicAnchorKeys = assertArray(value.publicAnchorKeys ?? [], "clueNetwork.publicAnchorKeys").slice(0, 16).map((item) => cleanText(item, 40));
  for (const key of publicAnchorKeys) {
    const clue = clues.find((item) => item.key === key);
    if (!clue || clue.scope !== "public_anchor") {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `publicAnchorKeys 中的 ${key} 不是公共锚点`);
    }
  }
  const declaredPublic = new Set(publicAnchorKeys);
  const missingPublic = clues.filter((clue) => clue.scope === "public_anchor" && !declaredPublic.has(clue.key));
  if (missingPublic.length) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", `公共锚点未登记到 publicAnchorKeys：${missingPublic.map((clue) => clue.key).join("、")}`);
  }
  return {
    version: cleanText(value.version, 40) || "1.0",
    clues,
    truthCoverage,
    links,
    publicAnchorKeys: [...new Set(publicAnchorKeys)],
    suggestions: assertArray(value.suggestions ?? [], "clueNetwork.suggestions").slice(0, 12).map((item) => cleanText(item, 500))
  };
}

export function scanClueNetworkDesign(clueNetwork, config, characterArchives, setting = {}) {
  const clues = clueNetwork?.clues || [];
  const chapterKeys = config?.chapterKeys || [];
  const players = Math.max(1, characterArchives?.roles?.length || config?.playerCount || 1);
  const target = Math.max(16, Math.min(40, players * Math.max(3, chapterKeys.length) + players));
  const minimum = Math.max(12, Math.floor(target * 0.65));
  const localScopes = new Set(["private", "pair", "group"]);
  const localCount = clues.filter((clue) => localScopes.has(clue.scope)).length;
  const publicAnchors = clues.filter((clue) => clue.scope === "public_anchor");
  const violations = [];
  if (clues.length < minimum) {
    violations.push({ code: "clue_network_too_thin", message: `建议约 ${target} 条线索，至少先形成 ${minimum} 条有效线索；当前 ${clues.length} 条` });
  }
  if (clues.length && localCount / clues.length < 0.4) {
    violations.push({ code: "local_clue_ratio_low", message: "局部/双人/小组线索不足四成，线索网络仍然过度围绕全桌主线" });
  }
  if (publicAnchors.length > Math.max(1, chapterKeys.length)) {
    violations.push({ code: "too_many_public_anchors", message: "公共锚点多于幕数，可能把局部关系重新做成全员广播" });
  }
  for (const actKey of chapterKeys) {
    const actClues = clues.filter((clue) => clue.actKey === actKey);
    if (!actClues.length) violations.push({ code: "act_without_clues", actKey, message: `${actKey} 没有可取得线索` });
    if (playStructureProfile(setting.playStructure).requiresPlayableDecision && !actClues.some((clue) => clue.physicalForm && clue.affordances.length)) {
      violations.push({ code: "act_without_operable_material", actKey, message: `${actKey} 没有可操作实体物料` });
    }
  }
  return {
    passed: violations.length === 0,
    blocked: violations.length > 0,
    targetClueCount: target,
    minimumClueCount: minimum,
    metrics: {
      total: clues.length,
      localCount,
      localRatio: clues.length ? Number((localCount / clues.length).toFixed(3)) : 0,
      publicAnchorCount: publicAnchors.length
    },
    violations
  };
}

export function validateInfoMatrix(raw, config, characterArchives, setting = {}, truthBible = {}, clueNetwork = null) {
  const value = raw && typeof raw === "object" ? raw : {};
  const structureProfile = playStructureProfile(setting.playStructure);
  const chapterKeys = config?.chapterKeys || [];
  const roleKeys = new Set((characterArchives?.roles || []).map((r) => r.key));
  const endingAxisKeys = new Set((truthBible?.endingAxes || []).map((axis) => axis?.key).filter(Boolean));
  const clueSource = clueNetwork?.clues?.length ? clueNetwork.clues : value.clues ?? [];
  const clues = assertArray(clueSource, "clues").slice(0, 80).map((rawClue, index) => ({
    ...rawClue,
    key: cleanText(rawClue?.key, 40) || `clue-${index + 1}`,
    name: cleanText(rawClue?.name, 120),
    description: cleanText(rawClue?.description || rawClue?.summary, 1200),
    hostMeaning: cleanText(rawClue?.hostMeaning, 1200),
    actKey: chapterKeys.includes(rawClue?.actKey) ? rawClue.actKey : chapterKeys[0],
    scope: CLUE_SCOPES.has(rawClue?.scope) ? rawClue.scope : "mainline",
    function: CLUE_FUNCTIONS.has(rawClue?.function) ? rawClue.function : "truth",
    involvedRoleKeys: assertArray(rawClue?.involvedRoleKeys ?? [], "clue.involvedRoleKeys").slice(0, 8).map((item) => cleanText(item, 40)),
    holderRoleKeys: assertArray(rawClue?.holderRoleKeys ?? [], "clue.holderRoleKeys").slice(0, 8).map((item) => cleanText(item, 40)),
    interpreterRoleKeys: assertArray(rawClue?.interpreterRoleKeys ?? [], "clue.interpreterRoleKeys").slice(0, 8).map((item) => cleanText(item, 40)),
    misreaderRoleKeys: assertArray(rawClue?.misreaderRoleKeys ?? [], "clue.misreaderRoleKeys").slice(0, 8).map((item) => cleanText(item, 40)),
    truthNodeKeys: assertArray(rawClue?.truthNodeKeys ?? [], "clue.truthNodeKeys").slice(0, 8).map((item) => cleanText(item, 40)),
    grantMode: ["auto", "host_confirm", "explore"].includes(rawClue?.grantMode) ? rawClue.grantMode : "auto",
    source: cleanText(rawClue?.source, 48) || "ClueCard",
    physicalForm: cleanText(rawClue?.physicalForm, 400),
    affordances: assertArray(rawClue?.affordances ?? [], "clue.affordances").slice(0, 8).map((item) => cleanText(item, 180)),
    acquisition: rawClue?.acquisition && typeof rawClue.acquisition === "object" ? rawClue.acquisition : {},
    misleadingRead: cleanText(rawClue?.misleadingRead, 800),
    recontextualizedByClueKeys: assertArray(rawClue?.recontextualizedByClueKeys ?? [], "clue.recontextualizedByClueKeys").slice(0, 8).map((item) => cleanText(item, 40)),
    publicImpact: cleanText(rawClue?.publicImpact, 800),
    interference: rawClue?.interference && typeof rawClue.interference === "object" ? rawClue.interference : {},
    missingEffect: rawClue?.missingEffect && typeof rawClue.missingEffect === "object" ? rawClue.missingEffect : {},
    conflictingInterpretations: assertArray(rawClue?.conflictingInterpretations ?? [], "clue.conflictingInterpretations").slice(0, 6).map((item) => cleanText(item, 300)),
    settlementUse: cleanText(rawClue?.settlementUse, 600)
  }));
  const publicEnvironmentByAct =
    value.publicEnvironmentByAct && typeof value.publicEnvironmentByAct === "object"
      ? Object.fromEntries(
          chapterKeys.map((key) => [key, cleanText(value.publicEnvironmentByAct[key], 800)])
        )
      : {};
  const scenes = assertArray(value.scenes ?? [], "scenes")
    .slice(0, 24)
    .map((s, index) => ({
      key: cleanText(s.key, 40) || `scene-${index + 1}`,
      name: cleanText(s.name, 80),
      actKey: chapterKeys.includes(s.actKey) ? s.actKey : chapterKeys[0],
      clueIds: assertArray(s.clueIds ?? [], "scene.clueIds").slice(0, 8).map((id) => cleanText(id, 40))
    }));
  const mechanicalTriggers = assertArray(value.mechanicalTriggers ?? [], "mechanicalTriggers")
    .slice(0, 16)
    .map((t, index) => ({
      key: cleanText(t.key, 40) || `trigger-${index + 1}`,
      actKey: chapterKeys.includes(t.actKey) ? t.actKey : chapterKeys[0],
      if: cleanText(t.if, 200),
      then: cleanText(t.then, 200),
      hostNote: cleanText(t.hostNote, 300)
    }));
  const decisions = assertArray(value.decisions ?? [], "decisions").slice(0, 16).map((decision, index) => ({
    key: cleanText(decision?.key, 40) || `decision-${index + 1}`,
    actKey: chapterKeys.includes(decision?.actKey) ? decision.actKey : chapterKeys[0],
    question: cleanText(decision?.question, 500),
    deadline: cleanText(decision?.deadline, 300),
    defaultEffect: cleanText(decision?.defaultEffect, 500),
    defaultAxisEffects: assertArray(decision?.defaultAxisEffects ?? [], "decision.defaultAxisEffects").slice(0, 8).map((effect) => ({
      axisKey: cleanText(effect?.axisKey, 40),
      delta: Number.isFinite(Number(effect?.delta)) ? Number(effect.delta) : 0
    })),
    options: assertArray(decision?.options ?? [], "decision.options").slice(0, 8).map((option, optionIndex) => ({
      key: cleanText(option?.key, 40) || `option-${optionIndex + 1}`,
      label: cleanText(option?.label, 240),
      immediateEffect: cleanText(option?.immediateEffect, 600),
      benefitingRoleKeys: assertArray(option?.benefitingRoleKeys ?? [], "decision.benefitingRoleKeys").slice(0, 8).map((item) => cleanText(item, 40)),
      harmedRoleKeys: assertArray(option?.harmedRoleKeys ?? [], "decision.harmedRoleKeys").slice(0, 8).map((item) => cleanText(item, 40)),
      counterplayRoleKeys: assertArray(option?.counterplayRoleKeys ?? [], "decision.counterplayRoleKeys").slice(0, 8).map((item) => cleanText(item, 40)),
      counterplay: cleanText(option?.counterplay, 500),
      tradeoff: cleanText(option?.tradeoff, 600),
      axisEffects: assertArray(option?.axisEffects ?? [], "decision.axisEffects").slice(0, 8).map((effect) => ({
        axisKey: cleanText(effect?.axisKey, 40),
        delta: Number.isFinite(Number(effect?.delta)) ? Number(effect.delta) : 0
      }))
    }))
  }));
  const decisionKeys = new Set(decisions.map((decision) => decision.key));
  const actContracts = assertArray(value.actContracts ?? [], "actContracts").slice(0, 12).map((contract, index) => ({
    actKey: chapterKeys.includes(contract?.actKey) ? contract.actKey : chapterKeys[index] || chapterKeys[0],
    title: cleanText(contract?.title, 160),
    publicSituation: cleanText(contract?.publicSituation, 1000),
    deadline: cleanText(contract?.deadline, 300),
    mandatoryDecisionKey: cleanText(contract?.mandatoryDecisionKey, 40),
    entryState: cleanText(contract?.entryState, 600),
    exitState: cleanText(contract?.exitState, 600),
    temporarySharedGoal: cleanText(contract?.temporarySharedGoal, 800),
    cooperationPayoff: cleanText(contract?.cooperationPayoff, 800),
    branchOpenings: assertArray(contract?.branchOpenings ?? [], "actContract.branchOpenings").slice(0, 8).map((item) => cleanText(item, 400)),
    resourceChanges: assertArray(contract?.resourceChanges ?? [], "actContract.resourceChanges").slice(0, 12).map((item) => cleanText(item, 300)),
    sceneSequence: assertArray(contract?.sceneSequence ?? [], "actContract.sceneSequence").slice(0, 6).map((scene, sceneIndex) => ({
      sceneKey: cleanText(scene?.sceneKey, 40) || `${contract?.actKey || `act-${index + 1}`}-scene-${sceneIndex + 1}`,
      location: cleanText(scene?.location, 160),
      timeWindow: cleanText(scene?.timeWindow, 120),
      mode: ["exploration", "cooperation", "negotiation", "confrontation", "recovery"].includes(scene?.mode) ? scene.mode : "exploration",
      changeMode: ["conflict", "misunderstanding", "missed_connection", "mutual_restraint", "cooperation", "false_victory", "quiet_revaluation"].includes(scene?.changeMode)
        ? scene.changeMode
        : (["negotiation", "confrontation"].includes(scene?.mode) ? "conflict" : "cooperation"),
      presentRoleKeys: assertArray(scene?.presentRoleKeys ?? [], "scene.presentRoleKeys").slice(0, 8).map((item) => cleanText(item, 40)),
      entryAction: cleanText(scene?.entryAction, 400),
      conflictObject: cleanText(scene?.conflictObject, 300),
      explorationChoices: assertArray(scene?.explorationChoices ?? [], "scene.explorationChoices").slice(0, 6).map((item) => ({
        action: cleanText(item?.action, 400),
        possibleGain: cleanText(item?.possibleGain ?? item?.gain, 400),
        risk: cleanText(item?.risk, 400)
      })),
      cooperationRequirement: cleanText(scene?.cooperationRequirement, 500),
      roleDemands: assertArray(scene?.roleDemands ?? [], "scene.roleDemands").slice(0, 8).map((item) => ({
        roleKey: cleanText(item?.roleKey, 40),
        demand: cleanText(item?.demand, 400)
      })),
      observableBeats: assertArray(scene?.observableBeats ?? [], "scene.observableBeats").slice(0, 12).map((item, beatIndex) => ({
        key: cleanText(item?.key, 40) || `${scene?.sceneKey || `scene-${sceneIndex + 1}`}-shared-${beatIndex + 1}`,
        actorRoleKey: cleanText(item?.actorRoleKey, 40),
        actionOrLine: cleanText(item?.actionOrLine, 500),
        object: cleanText(item?.object, 200),
        sequence: Number.isFinite(Number(item?.sequence)) ? Number(item.sequence) : beatIndex + 1,
        memoryAgreement: ["shared", "disputed", "partial"].includes(item?.memoryAgreement) ? item.memoryAgreement : "shared",
        interpretationFreedom: cleanText(item?.interpretationFreedom, 500)
      })),
      stateChange: cleanText(scene?.stateChange, 500)
    }))
  }));
  const rows = assertArray(value.rows ?? [], "rows").slice(0, 120);
  const clueKeys = new Set(clues.map((c) => c.key));
  for (const row of rows) {
    if (!roleKeys.has(row.roleKey)) throwErr("DEEPSEEK_OUTPUT_INVALID", `信息矩阵引用了未知角色：${row.roleKey}`);
    if (!chapterKeys.includes(row.actKey)) throwErr("DEEPSEEK_OUTPUT_INVALID", `信息矩阵引用了未知幕：${row.actKey}`);
    const requestedClueIds = assertArray(row.newClueIds ?? [], "newClueIds").slice(0, 12).map((id) => cleanText(id, 40));
    if (requestedClueIds.some((id) => !clueKeys.has(id))) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `信息矩阵 ${row.roleKey}/${row.actKey} 引用了线索网络中不存在的线索`);
    }
    row.newClueIds = requestedClueIds;
    row.misbeliefs = cleanText(row.misbeliefs, 800);
    row.suspicion = cleanText(row.suspicion, 400);
    row.forbidden = cleanText(row.forbidden, 800);
    row.notYetInferred = assertArray(row.notYetInferred ?? [], "notYetInferred").slice(0, 8).map((item) => cleanText(item, 400));
    row.forbiddenConclusions = assertArray(row.forbiddenConclusions ?? [], "forbiddenConclusions").slice(0, 8).map((item) => cleanText(item, 400));
    row.allowedSuspicionRange = cleanText(row.allowedSuspicionRange, 800);
    row.lies = assertArray(row.lies ?? [], "lies").slice(0, 4).map((l) => cleanText(l, 300));
    row.tasks = assertArray(row.tasks ?? [], "tasks").slice(0, 6).map((t) => cleanText(t, 300));
  }
  uniqueKeys(clues, "clues");
  uniqueKeys(decisions, "decisions");
  if (structureProfile.requiresPlayableDecision) {
    const expectedRows = roleKeys.size * chapterKeys.length;
    const coveredCells = new Set(rows.map((row) => `${row.roleKey}:${row.actKey}`));
    if (coveredCells.size !== expectedRows) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `可玩结构的信息矩阵必须覆盖每个角色×幕，需 ${expectedRows} 格，实际 ${coveredCells.size} 格`);
    }
    for (const actKey of chapterKeys) {
      const contract = actContracts.find((item) => item.actKey === actKey);
      const decision = decisions.find((item) => item.actKey === actKey);
      const physicalClues = clues.filter((clue) => clue.actKey === actKey && clue.physicalForm && clue.affordances.length >= 1);
      if (!contract || !contract.publicSituation || !contract.deadline || !contract.entryState || !contract.exitState || !contract.temporarySharedGoal || !contract.cooperationPayoff || contract.sceneSequence.length < 2) {
        throwErr("DEEPSEEK_OUTPUT_INVALID", `${actKey} 缺少公共幕合同：需公共局面、共同阶段目标、合作收益、期限、进出状态和至少两个连续场景`);
      }
      if (!decision || decision.options.length < 2 || !decision.question || !decision.deadline || !decision.defaultEffect) {
        throwErr("DEEPSEEK_OUTPUT_INVALID", `${actKey} 缺少可结算决定：需问题、期限、默认后果和至少两个选项`);
      }
      const effectiveDefaultChanges = decision.defaultAxisEffects
        .filter((effect) => effect.axisKey && effect.delta !== 0);
      if (!effectiveDefaultChanges.length) {
        throwErr("DEEPSEEK_OUTPUT_INVALID", `${actKey} 的无人行动后果没有改变任何结局轴，主持端将无法结算`);
      }
      if (endingAxisKeys.size && effectiveDefaultChanges.some((effect) => !endingAxisKeys.has(effect.axisKey))) {
        throwErr("DEEPSEEK_OUTPUT_INVALID", `${actKey} 的无人行动后果引用了真相层不存在的结局轴`);
      }
      const optionEffectSignatures = new Set();
      for (const option of decision.options) {
        const effectiveChanges = option.axisEffects
          .filter((effect) => effect.axisKey && effect.delta !== 0)
          .sort((left, right) => left.axisKey.localeCompare(right.axisKey));
        if (!option.label || !option.immediateEffect || !effectiveChanges.length) {
          throwErr("DEEPSEEK_OUTPUT_INVALID", `${actKey}/${option.key} 不是有效选项：需明确名称、即时后果并改变至少一个结局轴`);
        }
        if (endingAxisKeys.size && effectiveChanges.some((effect) => !endingAxisKeys.has(effect.axisKey))) {
          throwErr("DEEPSEEK_OUTPUT_INVALID", `${actKey}/${option.key} 引用了真相层不存在的结局轴`);
        }
        const signature = JSON.stringify(effectiveChanges);
        if (optionEffectSignatures.has(signature)) {
          throwErr("DEEPSEEK_OUTPUT_INVALID", `${actKey} 存在结算结果完全相同的伪选项`);
        }
        optionEffectSignatures.add(signature);
      }
      if (contract.mandatoryDecisionKey !== decision.key || !decisionKeys.has(contract.mandatoryDecisionKey)) {
        throwErr("DEEPSEEK_OUTPUT_INVALID", `${actKey} 的公共幕合同未绑定本幕决定`);
      }
      if (!physicalClues.length) {
        throwErr("DEEPSEEK_OUTPUT_INVALID", `${actKey} 至少需要一份可操作实体物料，不能只靠口头讨论`);
      }
      if (!contract.sceneSequence.some((scene) => ["exploration", "cooperation", "recovery"].includes(scene.mode))) {
        throwErr("DEEPSEEK_OUTPUT_INVALID", `${actKey} 只有对抗/谈判，没有探索、合作或关系缓冲场景`);
      }
      for (const scene of contract.sceneSequence) {
        if (!scene.location || !scene.timeWindow || !scene.entryAction || !scene.stateChange || scene.presentRoleKeys.length < 2) {
          throwErr("DEEPSEEK_OUTPUT_INVALID", `${actKey}/${scene.sceneKey} 不是可执行公共场景`);
        }
        if (["negotiation", "confrontation"].includes(scene.mode) && !scene.conflictObject) {
          throwErr("DEEPSEEK_OUTPUT_INVALID", `${actKey}/${scene.sceneKey} 是对抗场景但没有具体争夺对象`);
        }
        if (scene.mode === "exploration" && !scene.explorationChoices.some((choice) => choice.action && choice.possibleGain && choice.risk)) {
          throwErr("DEEPSEEK_OUTPUT_INVALID", `${actKey}/${scene.sceneKey} 是探索场景但没有可选择的探索动作、收益与风险`);
        }
        if (scene.mode === "cooperation" && !scene.cooperationRequirement) {
          throwErr("DEEPSEEK_OUTPUT_INVALID", `${actKey}/${scene.sceneKey} 是合作场景但没有实际协作条件`);
        }
        if (scene.presentRoleKeys.some((roleKey) => !roleKeys.has(roleKey))) {
          throwErr("DEEPSEEK_OUTPUT_INVALID", `${actKey}/${scene.sceneKey} 引用了未知角色`);
        }
      }
    }
    if (clueNetwork?.clues?.length) {
      const assigned = new Set(rows.flatMap((row) => row.newClueIds || []));
      for (const clue of clues) {
        if (clue.scope === "public_anchor") continue;
        for (const holderRoleKey of clue.holderRoleKeys || []) {
          const holderRow = rows.find((row) => row.roleKey === holderRoleKey && row.actKey === clue.actKey);
          if (!holderRow?.newClueIds?.includes(clue.key)) {
            throwErr("DEEPSEEK_OUTPUT_INVALID", `线索 ${clue.key} 未按线索网络发给初始持有人 ${holderRoleKey}`);
          }
        }
        if (clue.grantMode !== "explore" && !assigned.has(clue.key) && !(clue.holderRoleKeys || []).length) {
          throwErr("DEEPSEEK_OUTPUT_INVALID", `非探索线索 ${clue.key} 没有任何取得路径`);
        }
      }
    }
  }
  const actTitles = value.actTitles && typeof value.actTitles === "object" ? value.actTitles : {};
  const actSummaries = value.actSummaries && typeof value.actSummaries === "object" ? value.actSummaries : {};
  return {
    clues,
    rows,
    publicEnvironmentByAct,
    scenes,
    mechanicalTriggers,
    decisions,
    actContracts,
    actTitles: Object.fromEntries(chapterKeys.map((key) => [key, cleanText(actTitles[key], 120) || `第 ${chapterKeys.indexOf(key) + 1} 幕`])),
    actSummaries: Object.fromEntries(chapterKeys.map((key) => [key, cleanText(actSummaries[key], 600)])),
    suggestions: assertArray(value.suggestions ?? [], "suggestions").slice(0, 12).map((s) => cleanText(s, 500))
  };
}

/** New AI generations must prove asymmetric gain/loss and an executable counterplay window. */
export function scanDramaticTensionContracts(infoMatrix, setting = {}) {
  const structureProfile = playStructureProfile(setting.playStructure);
  if (!structureProfile.requiresPlayableDecision) {
    return { passed: true, skipped: true, violations: [] };
  }
  const roleKeys = new Set((infoMatrix?.rows || []).map((row) => row.roleKey).filter(Boolean));
  const violations = [];
  for (const decision of infoMatrix?.decisions || []) {
    let contentiousOptions = 0;
    for (const option of decision.options || []) {
      const benefits = (option.benefitingRoleKeys || []).filter((roleKey) => roleKeys.has(roleKey));
      const harms = (option.harmedRoleKeys || []).filter((roleKey) => roleKeys.has(roleKey));
      const counters = (option.counterplayRoleKeys || []).filter((roleKey) => roleKeys.has(roleKey));
      const distinctHarm = harms.some((roleKey) => !benefits.includes(roleKey));
      const harmedCanCounter = counters.some((roleKey) => harms.includes(roleKey));
      if (benefits.length && harms.length && distinctHarm && option.counterplay && harmedCanCounter) {
        contentiousOptions += 1;
      } else if (!option.tradeoff) {
        violations.push({
          actKey: decision.actKey,
          optionKey: option.key,
          type: "no_cost_or_counterplay",
          message: "选项既没有受益/受损与反制关系，也没有登记合作方案必须支付的具体代价。"
        });
      }
    }
    if (!contentiousOptions) {
      violations.push({
        actKey: decision.actKey,
        type: "decision_without_real_conflict",
        message: "本幕决定没有任何会制造明确受益者、受损者和反制窗口的选项。合作可以存在，但不能让全部选项都成为安全折中。"
      });
    }
  }
  return { passed: violations.length === 0, skipped: false, violations };
}

export function validateHostRunbooks(raw, config, setting = {}) {
  const value = raw && typeof raw === "object" ? raw : {};
  const structureProfile = playStructureProfile(setting.playStructure);
  const chapterKeys = config?.chapterKeys || [];
  const runbooks = assertArray(value.runbooks ?? [], "runbooks").slice(0, 12);
  for (const book of runbooks) {
    if (!chapterKeys.includes(book.actKey)) throwErr("DEEPSEEK_OUTPUT_INVALID", `主持手册引用了未知幕：${book.actKey}`);
    book.title = cleanText(book.title, 160);
    book.flow = cleanText(book.flow, 2000);
    book.hostTruth = cleanText(book.hostTruth, 2000);
    book.openingReadAloud = cleanText(book.openingReadAloud, 1200);
    book.roundGoal = cleanText(book.roundGoal, 800);
    book.decisionProcedure = cleanText(book.decisionProcedure, 1600);
    book.failureAdvance = cleanText(book.failureAdvance, 1000);
    book.endCondition = cleanText(book.endCondition, 800);
    book.materialSetup = assertArray(book.materialSetup ?? [], "materialSetup").slice(0, 16).map((item) => ({
      clueId: cleanText(item?.clueId, 40),
      placement: cleanText(item?.placement, 500),
      allowedActions: assertArray(item?.allowedActions ?? [], "materialSetup.allowedActions").slice(0, 8).map((action) => cleanText(action, 160))
    }));
    book.stateChanges = assertArray(book.stateChanges ?? [], "stateChanges").slice(0, 16).map((item) => cleanText(item, 400));
    book.clueGrants = assertArray(book.clueGrants ?? [], "clueGrants").slice(0, 16).map((g) => ({
      clueId: cleanText(g.clueId, 40),
      when: cleanText(g.when, 400)
    }));
    book.fallbacks = assertArray(book.fallbacks ?? [], "fallbacks").slice(0, 6).map((f) => cleanText(f, 400));
    if (structureProfile.requiresPlayableDecision && (
      !book.openingReadAloud || !book.roundGoal || !book.decisionProcedure || !book.failureAdvance || !book.endCondition || !book.materialSetup.length
    )) {
      throwErr("DEEPSEEK_OUTPUT_INVALID", `${book.actKey} 主持手册缺少可执行环节：需开场朗读、目标、物料摆放、决定程序、失败推进与结束条件`);
    }
  }
  return {
    runbooks,
    suggestions: assertArray(value.suggestions ?? [], "suggestions").slice(0, 12).map((s) => cleanText(s, 500))
  };
}

export function validateMatrixPlayerScript(raw, roleKey, actKey, minWords) {
  const value = raw && typeof raw === "object" ? raw : {};
  if (value.roleKey !== roleKey || value.actKey !== actKey) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "剧本 roleKey/actKey 与请求不一致");
  }
  const body = cleanText(value.body, 12000);
  if (body.length < minWords) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", `剧本正文仅 ${body.length} 字，未达到最低 ${minWords} 字`, { actualChars: body.length, minChars: minWords, roleKey, actKey });
  }
  return {
    roleKey,
    actKey,
    title: cleanText(value.title, 160) || `${actKey} · 私人本`,
    body,
    tasks: assertArray(value.tasks ?? [], "tasks").slice(0, 6).map((t) => cleanText(t, 300)),
    closingHook: cleanText(value.closingHook, 400),
    ...(value.structured && typeof value.structured === "object" ? { structured: value.structured } : {})
  };
}

export function characterArchivesToRolesMeta(characterArchives, infoMatrix, config) {
  const chapterKeys = config?.chapterKeys || [];
  const rowsByRole = new Map();
  for (const row of infoMatrix?.rows || []) {
    if (!rowsByRole.has(row.roleKey)) rowsByRole.set(row.roleKey, []);
    rowsByRole.get(row.roleKey).push(row);
  }
  return {
    roles: (characterArchives?.roles || []).map((role) => ({
      key: role.key,
      name: role.name,
      publicProfile: role.publicIdentity,
      publicGoal: role.immediateWant,
      hiddenGoal: role.privateInterest,
      coreSecret: role.hiddenIdentity,
      privateProfile: [role.hiddenIdentity, role.motive ? `动机：${role.motive}` : "", role.innerConflict ? `矛盾：${role.innerConflict}` : ""].filter(Boolean).join("\n"),
      chapterKnowledge: chapterKeys.map((actKey) => {
        const row = (rowsByRole.get(role.key) || []).find((r) => r.actKey === actKey);
        return {
          chapterKey: actKey,
          knows: row ? [row.newClueIds?.length ? `新线索：${row.newClueIds.join("、")}` : "", row.suspicion ? `怀疑：${row.suspicion}` : ""].filter(Boolean).join("；") : "（本幕尚未获知关键线索）",
          mustHide: row?.forbidden || role.lies?.slice(0, 2).join("；") || "（无额外隐瞒）",
          canDiscuss: row?.tasks?.join("；") || "按本幕任务推进"
        };
      })
    }))
  };
}

export function buildProposalFromMatrix({ setting, config, truthBible, infoMatrix, clueNetwork = null }) {
  const chapterKeys = config?.chapterKeys || [];
  const title = config?.title || setting?.theme || "剧本";
  const entitySchedule = serializeEntitySchedule(buildEntityUnlockSchedule(infoMatrix, config));

  const chapters = chapterKeys.map((key, index) => ({
    key,
    title: infoMatrix?.actTitles?.[key] || `第 ${index + 1} 幕`,
    summary: [infoMatrix?.publicEnvironmentByAct?.[key], infoMatrix?.actSummaries?.[key]].filter(Boolean).join("\n\n"),
    sequence: index + 1,
    metadata: {
      matrixActKey: key,
      actSequence: index + 1,
      publicEnvironment: infoMatrix?.publicEnvironmentByAct?.[key] || ""
    }
  }));

  const sceneRows =
    infoMatrix?.scenes?.length > 0
      ? infoMatrix.scenes
      : infoMatrix?.actContracts?.length > 0
        ? infoMatrix.actContracts.flatMap((contract) =>
            (contract.sceneSequence || []).map((scene, sceneIndex) => ({
              key: scene.sceneKey,
              name: `${contract.title || infoMatrix?.actTitles?.[contract.actKey] || contract.actKey} · ${scene.location}`,
              actKey: contract.actKey,
              clueIds: sceneIndex === 0
                ? (infoMatrix?.clues || []).filter((clue) => clue.actKey === contract.actKey).map((clue) => clue.key)
                : [],
              sharedContract: scene
            }))
          )
        : chapterKeys.map((key, index) => ({
          key: `scene-${index + 1}`,
          name: infoMatrix?.actTitles?.[key] || `场景 ${index + 1}`,
          actKey: key,
          clueIds: (infoMatrix?.clues || []).filter((c) => c.actKey === key).map((c) => c.key)
        }));

  const scenes = sceneRows.map((scene) => ({
    key: scene.key,
    chapterKey: scene.actKey,
    name: scene.name,
    publicText: infoMatrix?.publicEnvironmentByAct?.[scene.actKey] || infoMatrix?.actSummaries?.[scene.actKey] || "",
    hostText: cleanText(truthBible?.hostNotes, 800),
    metadata: {
      matrixActKey: scene.actKey,
      matrixSceneKey: scene.key,
      clueIds: scene.clueIds || [],
      publicEnvironment: infoMatrix?.publicEnvironmentByAct?.[scene.actKey] || "",
      sharedContract: scene.sharedContract || null
    }
  }));

  const canonicalClues = clueNetwork?.clues?.length ? clueNetwork.clues : (infoMatrix?.clues || []);
  const cluesSorted = [...canonicalClues].sort(
    (a, b) => chapterKeys.indexOf(a.actKey) - chapterKeys.indexOf(b.actKey)
  );

  const clues = cluesSorted.map((clue, index) => {
    const scene =
      sceneRows.find((s) => (s.clueIds || []).includes(clue.key)) ||
      sceneRows.find((s) => s.actKey === clue.actKey) ||
      sceneRows[0];
    const actSeq = Math.max(0, chapterKeys.indexOf(clue.actKey));
    return {
      key: clue.key || `clue-${index + 1}`,
      name: clue.name || `线索 ${index + 1}`,
      description: clue.description || "",
      publicText: clue.description || "",
      hostText: [clue.hostMeaning, clue.grantMode === "host_confirm" ? "主持确认后发放" : ""].filter(Boolean).join("\n"),
      sceneKey: scene?.key || `scene-${actSeq + 1}`,
      visibility: clue.scope === "public_anchor" ? "public" : "role",
      metadata: {
        grantMode: clue.grantMode || "auto",
        actKey: clue.actKey,
        actSequence: actSeq + 1,
        scope: clue.scope || "private",
        function: clue.function || "truth",
        involvedRoleKeys: clue.involvedRoleKeys || [],
        holderRoleKeys: clue.holderRoleKeys || [],
        interpreterRoleKeys: clue.interpreterRoleKeys || [],
        misreaderRoleKeys: clue.misreaderRoleKeys || [],
        truthNodeKeys: clue.truthNodeKeys || [],
        source: clue.source || "ClueCard",
        physicalForm: clue.physicalForm || "",
        affordances: clue.affordances || [],
        acquisition: clue.acquisition || {},
        misleadingRead: clue.misleadingRead || "",
        recontextualizedByClueKeys: clue.recontextualizedByClueKeys || [],
        publicImpact: clue.publicImpact || "",
        interference: clue.interference || {},
        missingEffect: clue.missingEffect || {},
        conflictingInterpretations: clue.conflictingInterpretations || [],
        settlementUse: clue.settlementUse || "",
        matrixSceneKey: scene?.key,
        unlockOrder: index + 1,
        triggerNote: `${clue.actKey} · ${clue.grantMode === "host_confirm" ? "主持确认" : "自动发放"}`,
        entitySchedule: entitySchedule.filter((e) => e.clueKeys?.includes(clue.key))
      }
    };
  });

  const investigationPoints = clues.map((clue, index) => ({
    key: `point-${index + 1}`,
    sceneKey: clue.sceneKey,
    name: `调查 · ${clue.name}`,
    clueKey: clue.key,
    description: clue.description,
    resultText: clue.publicText
  }));

  const edges = [];
  for (const scene of scenes) {
    for (const clue of clues.filter((c) => c.sceneKey === scene.key)) {
      edges.push({ fromType: "scene", fromKey: scene.key, toType: "clue", toKey: clue.key, relationType: "mainline" });
    }
  }
  const edgeRelation = (relationType) => {
    if (relationType === "contradicts") return "parallel";
    if (["recontextualizes", "unlocks", "echoes"].includes(relationType)) return "extension";
    return "mainline";
  };
  for (const link of clueNetwork?.links || []) {
    edges.push({
      fromType: "clue",
      fromKey: link.fromClueKey,
      toType: "clue",
      toKey: link.toClueKey,
      relationType: edgeRelation(link.relationType),
      label: link.reason || link.relationType
    });
  }

  return {
    title,
    logline: cleanText(truthBible?.summary, 600),
    chapters,
    scenes,
    investigationPoints,
    clues,
    edges,
    matrixSync: {
      matrixMode: setting?.matrixMode || "honkaku",
      publicEnvironmentByAct: infoMatrix?.publicEnvironmentByAct || {},
      entityUnlockSchedule: entitySchedule,
      mechanicalTriggers: infoMatrix?.mechanicalTriggers || [],
      decisions: infoMatrix?.decisions || [],
      actContracts: infoMatrix?.actContracts || [],
      clueNetwork: clueNetwork || null
    },
    suggestions: infoMatrix?.suggestions || []
  };
}

export function matrixScriptsToSections(scripts) {
  const sections = {};
  for (const [roleKey, acts] of Object.entries(scripts || {})) {
    sections[roleKey] = {};
    for (const [actKey, script] of Object.entries(acts || {})) {
      if (!script?.body) continue;
      sections[roleKey][actKey] = {
        title: script.title,
        body: script.body,
        tasks: script.tasks,
        closingHook: script.closingHook
      };
    }
  }
  return sections;
}
