/** Public outline-quality facade; internal policy modules stay replaceable. */

import {
  OUTLINE_VERSION,
  OUTLINE_REVISION,
  OUTLINE_REVISIONS,
  PLACEHOLDER_NAME,
  UNRESOLVED_LOGIC,
  GENERIC_FINGERPRINT,
  GENERIC_ACTION_ONLY,
  GENERIC_EFFECT_ONLY,
  GENERIC_CAUSAL_SEQUENCE,
  GENERIC_ENDING_TITLE,
  GENERIC_TRUST_STATE,
  MECHANIC_USE_SECTIONS,
  GENRE_MODES,
  PROGRESS_MODES,
  GENRE_PROGRESS,
  STATE_OPERATIONS,
  RESOURCE_OPERATIONS,
  ENTITY_TYPES,
  RESPONSIBILITY_TYPES,
  ACTION_COMMITMENT_MODES,
  AUTHORIZATION_STATUSES,
  FACT_TRUTH_VALUES,
  OPTION_EFFECT_TARGET_TYPES,
  OPTION_EFFECT_OPERATIONS,
  RESOURCE_VALUE_TYPES,
  RESOURCE_OWNER_TYPES,
  CONTRIBUTION_ANCHOR_TYPES,
  INTERNAL_CHOICE_LANGUAGE,
  INTERNAL_NARRATIVE_LANGUAGE,
  SOURCE_SHELL_ENTITY,
  GENERIC_DECISION_CAPACITY,
  GENERIC_RESPONSIBILITY_ACTION,
  GENERIC_RESPONSIBILITY_EFFECT,
  GENRE_ANCHOR_TYPES,
  REQUIREMENT_TARGET_TYPES,
  ENTRY_CONDITION_MODES,
  MISDIRECTION_KINDS,
  BATCH_FINGERPRINT_FIELDS
} from "./outline-quality/constants.js";

import {
  list,
  object,
  text,
  unique,
  uniqueScalars,
  duplicateValues,
  requireText,
  number,
  scalarValue,
  hasScalarValue,
  stateValueSignature,
  chapterIndex,
  normalizedAction,
  isGenericAction,
  isGenericEffect,
  requireKnownRefs
} from "./outline-quality/primitives.js";

import {
  normalizeOption,
  normalizeOptionEffect,
  normalizeStateWrite,
  normalizeStateRead,
  normalizeResourceDelta,
  normalizeEntity,
  expectedEntityTypes,
  sourceTypeCompatible,
  normalizeResource,
  normalizeResponsibilityRole,
  normalizeTimelineEvent,
  normalizeChapterAction,
  normalizePlayer,
  normalizeEvidence,
  normalizeConclusion,
  normalizeMisdirection,
  normalizeReadPass,
  normalizeReadFail,
  normalizeBeat,
  normalizeRequirement,
  normalizeEndingRoute,
  requirementSatisfied,
  applyRuntimeEffect,
  enumerateBranchSnapshots,
  normalizeFact,
  normalizeAuthorizationGrant,
  normalizeBranchEvent,
  normalizeWorldRule
} from "./outline-quality/normalizers.js";

import { invalid } from "./outline-quality/validation-error.js";

import { fingerprintSimilarity, normalizedFingerprint } from "./outline-quality/batch-diversity.js";
import { validateV24SemanticConstitution } from "./outline-quality/rules/v2.4-semantic-constitution.js";
import { validateCausalTimeline, validateResponsibilityRoles } from "./outline-quality/rules/v2.3-responsibility.js";

/**
 * Normalize and hard-validate the player-driven outline protocol.
 * This is intentionally stricter than the legacy outline reader: passing it
 * means the result can enter role-matrix and manuscript expansion.
 */
export function validateStoryOutlineV2(raw, spec, { brief = null } = {}) {
  const value = object(raw);
  const chapterKeys = list(spec?.chapterKeys).map((key) => text(key, 80));
  const evidenceGraph = object(value.evidenceGraph);
  const endingLogic = object(value.endingLogic);
  const genreMechanic = object(value.genreMechanic);
  const genreProfile = object(value.genreProfile);
  const batchFingerprint = object(value.batchFingerprint);
  const sourceFidelity = object(value.sourceFidelity);
  const styleContract = object(value.styleContract);
  const semanticConstitution = object(value.semanticConstitution);

  const outline = {
    outlineVersion: Number(value.outlineVersion),
    outlineRevision: text(value.outlineRevision, 20),
    logline: text(value.logline, 800),
    truthTimeline: text(value.truthTimeline, 6000),
    sourceFidelity: {
      briefTitle: text(sourceFidelity.briefTitle, 120),
      premiseElements: list(sourceFidelity.premiseElements).slice(0, 12).map((rawElement) => {
        const element = object(rawElement);
        return {
          element: text(element.element, 160),
          implementation: text(element.implementation, 1200),
          chapterKeys: unique(list(element.chapterKeys).map((item) => text(item, 80))),
          supportKeys: unique(list(element.supportKeys).map((item) => text(item, 80)))
        };
      })
    },
    hookPromises: list(value.hookPromises).slice(0, 12).map((rawPromise) => {
      const promise = object(rawPromise);
      return {
        key: text(promise.key, 80),
        promise: text(promise.promise, 800),
        payoff: text(promise.payoff, 1600),
        supportKeys: unique(list(promise.supportKeys).map((item) => text(item, 80)))
      };
    }),
    genreMechanic: {
      name: text(genreMechanic.name, 160),
      playerFacingRule: text(genreMechanic.playerFacingRule, 1200),
      playerOperation: text(genreMechanic.playerOperation, 1200),
      trigger: text(genreMechanic.trigger, 1000),
      resolutionProcedure: text(genreMechanic.resolutionProcedure, 1200),
      successEffect: text(genreMechanic.successEffect, 1000),
      failureEffect: text(genreMechanic.failureEffect, 1000),
      limits: text(genreMechanic.limits, 1200),
      chapterKeys: unique(list(genreMechanic.chapterKeys).map((item) => text(item, 80))),
      payoff: text(genreMechanic.payoff, 1200)
    },
    styleContract: {
      signatureDevices: unique(list(styleContract.signatureDevices).map((item) => text(item, 240))),
      forbiddenDrift: text(styleContract.forbiddenDrift, 1000),
      chapterExpressions: list(styleContract.chapterExpressions).slice(0, 12).map((rawExpression) => {
        const expression = object(rawExpression);
        return {
          chapterKey: text(expression.chapterKey, 80),
          device: text(expression.device, 240),
          sceneOrDialogue: text(expression.sceneOrDialogue, 1200)
        };
      })
    },
    genreProfile: {
      mode: text(genreProfile.mode, 40),
      chapterProgressRule: text(genreProfile.chapterProgressRule, 800),
      decisionCadence: text(genreProfile.decisionCadence, 800)
    },
    entities: list(value.entities).slice(0, 80).map(normalizeEntity),
    resources: list(value.resources).slice(0, 30).map(normalizeResource),
    players: list(value.players).slice(0, 8).map(normalizePlayer),
    centralResponsibilityRoleKeys: unique(list(value.centralResponsibilityRoleKeys).map((item) => text(item, 80))),
    responsibilityRoles: list(value.responsibilityRoles).slice(0, 24).map(normalizeResponsibilityRole),
    causalTimeline: list(value.causalTimeline).slice(0, 40).map(normalizeTimelineEvent),
    semanticConstitution: {
      facts: list(semanticConstitution.facts).slice(0, 80).map(normalizeFact),
      authorizationGrants: list(semanticConstitution.authorizationGrants).slice(0, 40).map(normalizeAuthorizationGrant),
      branchEvents: list(semanticConstitution.branchEvents).slice(0, 40).map(normalizeBranchEvent),
      worldRules: list(semanticConstitution.worldRules).slice(0, 40).map(normalizeWorldRule)
    },
    evidenceGraph: {
      evidence: list(evidenceGraph.evidence).slice(0, 80).map(normalizeEvidence),
      conclusions: list(evidenceGraph.conclusions).slice(0, 30).map(normalizeConclusion)
    },
    misdirections: list(value.misdirections).slice(0, 12).map(normalizeMisdirection),
    chapterBeats: list(value.chapterBeats).slice(0, 12).map((beat, index) => normalizeBeat(beat, chapterKeys[index] || `chapter-${index + 1}`, index)),
    endingLogic: {
      stateVariables: list(endingLogic.stateVariables).slice(0, 20).map((rawState) => {
        const state = object(rawState);
        return {
          key: text(state.key, 80),
          valueType: ["enum", "number", "boolean", "set"].includes(state.valueType) ? state.valueType : text(state.valueType, 20),
          initialValue: scalarValue(state.initialValue, 160),
          allowedValues: list(state.allowedValues)
            .map((item) => scalarValue(item, 160))
            .filter(hasScalarValue)
            .filter((item, index, rows) => rows.findIndex((candidate) => stateValueSignature(candidate) === stateValueSignature(item)) === index),
          setInChapterKey: text(state.setInChapterKey, 80),
          meaning: text(state.meaning, 800),
          subjectKey: text(state.subjectKey, 80),
          dimension: text(state.dimension, 120),
          controlMode: text(state.controlMode, 40),
          derivedFromFactKeys: unique(list(state.derivedFromFactKeys).map((item) => text(item, 80))),
          derivedByRuleKey: text(state.derivedByRuleKey, 80),
          valueSemantics: list(state.valueSemantics).slice(0, 20).map((rawSemantic) => {
            const semantic = object(rawSemantic);
            return {
              value: scalarValue(semantic.value, 160),
              worldMeaning: text(semantic.worldMeaning, 1000),
              incompatibleClaims: unique(list(semantic.incompatibleClaims).map((item) => text(item, 240)))
            };
          })
        };
      }),
      defaultRouteKey: text(endingLogic.defaultRouteKey, 80),
      conflictResolution: text(endingLogic.conflictResolution, 80),
      routes: list(endingLogic.routes).slice(0, 12).map(normalizeEndingRoute)
    },
    batchFingerprint: Object.fromEntries(
      BATCH_FINGERPRINT_FIELDS.map((field) => [field, text(batchFingerprint[field], field === "themeExpression" ? 240 : 180)])
    ),
    suggestions: list(value.suggestions).slice(0, 12).map((item) => text(item, 600)).filter(Boolean)
  };

  const issues = [];
  const generationContract = object(brief?.generationContract);
  const expectedRevision = text(generationContract.outlineRevision, 20) || outline.outlineRevision || OUTLINE_REVISION;
  const isV23 = outline.outlineRevision === "2.3";
  const isV24 = outline.outlineRevision === "2.4";
  const isV23Plus = isV23 || isV24;
  if (outline.outlineVersion !== OUTLINE_VERSION) issues.push(`outlineVersion 必须为 ${OUTLINE_VERSION}`);
  if (!OUTLINE_REVISIONS.has(outline.outlineRevision)) issues.push(`outlineRevision 必须为 ${[...OUTLINE_REVISIONS].join(" 或 ")}`);
  if (outline.outlineRevision !== expectedRevision) issues.push(`outlineRevision 必须遵守生成合同：${expectedRevision}`);
  requireText(outline.logline, "logline", issues, 20);
  requireText(outline.truthTimeline, "truthTimeline", issues, 80);

  const playerKeys = new Set(outline.players.map((player) => player.key).filter(Boolean));
  const playerNames = outline.players.map((player) => player.name).filter(Boolean);
  const entityKeys = new Set(outline.entities.map((entity) => entity.key).filter(Boolean));
  const resourceKeys = new Set(outline.resources.map((resource) => resource.key).filter(Boolean));
  const stateKeys = new Set(outline.endingLogic.stateVariables.map((state) => state.key).filter(Boolean));
  if (outline.players.length !== spec.playerCount) issues.push(`players 必须恰好包含 ${spec.playerCount} 名玩家角色`);
  if (playerKeys.size !== outline.players.length) issues.push("玩家角色 key 缺失或重复");
  const repeatedNames = duplicateValues(playerNames);
  if (repeatedNames.length) issues.push(`玩家姓名重复：${repeatedNames.join("、")}`);
  const contractedPlayerNames = list(generationContract.playerNames).map((name) => text(name, 80)).filter(Boolean);
  if (contractedPlayerNames.length) {
    if (contractedPlayerNames.length !== outline.players.length) {
      issues.push(`生成合同分配了 ${contractedPlayerNames.length} 个姓名，但输出包含 ${outline.players.length} 名玩家`);
    } else {
      for (const [index, expectedName] of contractedPlayerNames.entries()) {
        if (outline.players[index]?.name !== expectedName) {
          issues.push(`players[${index}].name 必须使用并发前分配的独占姓名“${expectedName}”`);
        }
      }
    }
  }

  const evidenceKeys = new Set(outline.evidenceGraph.evidence.map((entry) => entry.key).filter(Boolean));
  const conclusionKeys = new Set(outline.evidenceGraph.conclusions.map((entry) => entry.key).filter(Boolean));
  if (evidenceKeys.size !== outline.evidenceGraph.evidence.length) issues.push("证据 key 缺失或重复");
  if (conclusionKeys.size !== outline.evidenceGraph.conclusions.length) issues.push("核心结论 key 缺失或重复");
  if (outline.genreProfile.mode === "mystery" && !outline.evidenceGraph.conclusions.length) issues.push("mystery 题材至少需要一个可公平推理的核心结论");
  if (entityKeys.size !== outline.entities.length) issues.push("entities key 缺失或重复");
  if (resourceKeys.size !== outline.resources.length) issues.push("resources key 缺失或重复");
  if (stateKeys.size !== outline.endingLogic.stateVariables.length) issues.push("endingLogic.stateVariables key 缺失或重复");
  const contractedStateKeys = list(generationContract.stateKeys).map((key) => text(key, 80)).filter(Boolean);
  if (contractedStateKeys.length) {
    const missing = contractedStateKeys.filter((key) => !stateKeys.has(key));
    const unexpected = [...stateKeys].filter((key) => !contractedStateKeys.includes(key));
    if (missing.length) issues.push(`缺少生成前合同指定的核心状态：${missing.join("、")}`);
    if (!isV24 && unexpected.length) issues.push(`出现生成前合同未登记的万能状态：${unexpected.join("、")}`);
  }
  const contractedResourceKeys = list(generationContract.resourceKeys).map((key) => text(key, 80)).filter(Boolean);
  if (Array.isArray(generationContract.resourceKeys)) {
    const missing = contractedResourceKeys.filter((key) => !resourceKeys.has(key));
    const unexpected = [...resourceKeys].filter((key) => !contractedResourceKeys.includes(key));
    if (missing.length) issues.push(`缺少生成前合同指定的题材资源：${missing.join("、")}`);
    if (unexpected.length) issues.push(`出现生成前合同未登记的装饰性资源：${unexpected.join("、")}`);
  }
  const forbiddenStateKeys = new Set(
    list(generationContract.forbiddenStateKeys).map((key) => normalizedFingerprint(key)).filter(Boolean)
  );
  for (const stateKey of stateKeys) {
    if (GENERIC_TRUST_STATE.test(stateKey) || forbiddenStateKeys.has(normalizedFingerprint(stateKey))) {
      issues.push(`禁止使用批量模板状态 ${stateKey}；应改用题材专属的权限、承诺、风险或程序状态`);
    }
  }
  const stateConceptKeys = new Map(
    [...stateKeys].map((key) => [normalizedFingerprint(key.replace(/^state[-_]/iu, "")), key])
  );
  for (const resourceKey of resourceKeys) {
    const concept = normalizedFingerprint(resourceKey.replace(/^resource[-_]/iu, ""));
    if (concept && stateConceptKeys.has(concept)) {
      issues.push(`同一概念同时登记为状态 ${stateConceptKeys.get(concept)} 和资源 ${resourceKey}，会造成重复扣减`);
    }
  }
  const stableTargetKeys = new Set([...playerKeys, ...entityKeys, ...resourceKeys, ...evidenceKeys, ...stateKeys]);
  const supportKeys = new Set([...evidenceKeys, ...stateKeys, ...resourceKeys, ...entityKeys]);
  const timelineEventKeys = new Set(outline.causalTimeline.map((event) => event.key).filter(Boolean));
  const branchEventKeys = new Set(outline.semanticConstitution.branchEvents.map((event) => event.key).filter(Boolean));
  const runtimeEventKeys = new Set([...timelineEventKeys, ...branchEventKeys]);
  const factKeys = new Set(outline.semanticConstitution.facts.map((fact) => fact.key).filter(Boolean));
  const authorizationGrantKeys = new Set(outline.semanticConstitution.authorizationGrants.map((grant) => grant.key).filter(Boolean));
  const worldRuleKeys = new Set(outline.semanticConstitution.worldRules.map((rule) => rule.key).filter(Boolean));

  const validateStructuredEffect = (effect, label) => {
    if (!OPTION_EFFECT_TARGET_TYPES.has(effect.targetType)) {
      issues.push(`${label}.targetType 必须为 state/resource/evidence/event`);
      return;
    }
    const knownTargets = effect.targetType === "state"
      ? stateKeys
      : effect.targetType === "resource"
        ? resourceKeys
        : effect.targetType === "evidence"
          ? evidenceKeys
          : runtimeEventKeys;
    if (!knownTargets.has(effect.targetKey)) issues.push(`${label}.targetKey 引用未知 ${effect.targetType}：${effect.targetKey}`);
    if (!OPTION_EFFECT_OPERATIONS[effect.targetType]?.has(effect.operation)) {
      issues.push(`${label}.operation 与 targetType=${effect.targetType} 不相容`);
    }
    if (effect.targetType === "state" && !hasScalarValue(effect.value)) issues.push(`${label}.value 缺失`);
    if (effect.targetType === "resource" && (effect.amount === null || effect.amount < 0)) issues.push(`${label}.amount 必须是非负 JSON 数字`);
    requireText(effect.consequence, `${label}.consequence`, issues, 8);
  };

  const canonicalEntityNames = new Map();
  const canonicalPlayerNames = new Set(playerNames.map(normalizedFingerprint).filter(Boolean));
  for (const [index, entity] of outline.entities.entries()) {
    const label = `entities[${index}]`;
    requireText(entity.key, `${label}.key`, issues);
    if (!ENTITY_TYPES.has(entity.type)) issues.push(`${label}.type 必须是 ${[...ENTITY_TYPES].join(" / ")} 之一`);
    requireText(entity.name, `${label}.name`, issues);
    requireText(entity.meaning, `${label}.meaning`, issues, 4);
    if (isV23Plus && SOURCE_SHELL_ENTITY.test(`${entity.key} ${entity.name} ${entity.meaning}`)) {
      issues.push(`${label} 是为通过来源门禁临时制造的“来源壳”，必须改为故事世界中的真实人物、机构、系统、设备或物件`);
    }
    if (isV23Plus) {
      const expectedTypes = expectedEntityTypes(entity);
      if (expectedTypes && !expectedTypes.has(entity.type)) {
        issues.push(`${label} 的名称/意义与 type=${entity.type} 语义冲突，应为 ${[...expectedTypes].join(" 或 ")}`);
      }
    }
    for (const candidate of [entity.name, ...entity.aliases].filter(Boolean)) {
      const normalized = normalizedFingerprint(candidate);
      if (canonicalPlayerNames.has(normalized)) {
        issues.push(`实体名称或别名“${candidate}”与玩家同名；玩家不得再次登记为 NPC、机构或设备`);
      }
      const existing = canonicalEntityNames.get(normalized);
      if (existing && existing !== entity.key) issues.push(`实体名称或别名“${candidate}”同时指向 ${existing} 与 ${entity.key}`);
      canonicalEntityNames.set(normalized, entity.key);
    }
  }

  for (const [index, resource] of outline.resources.entries()) {
    const label = `resources[${index}]`;
    requireText(resource.key, `${label}.key`, issues);
    if (!RESOURCE_VALUE_TYPES.has(resource.valueType)) issues.push(`${label}.valueType 必须为 integer 或 number`);
    if (resource.initialValue === null || resource.minimum === null || resource.maximum === null) {
      issues.push(`${label} 必须声明数值型 initialValue、minimum 与 maximum`);
    } else {
      if (resource.minimum > resource.maximum) issues.push(`${label}.minimum 不能大于 maximum`);
      if (resource.initialValue < resource.minimum || resource.initialValue > resource.maximum) issues.push(`${label}.initialValue 超出允许范围`);
      if (resource.valueType === "integer" && ![resource.initialValue, resource.minimum, resource.maximum].every(Number.isInteger)) {
        issues.push(`${label} 声明为 integer 时 initialValue/minimum/maximum 必须都是整数`);
      }
    }
    if (!RESOURCE_OWNER_TYPES.has(resource.ownerType)) issues.push(`${label}.ownerType 必须为 group/player/entity`);
    if (resource.ownerType === "group" && resource.ownerKey) issues.push(`${label}.ownerType=group 时 ownerKey 应为空`);
    if (resource.ownerType === "player" && !playerKeys.has(resource.ownerKey)) issues.push(`${label}.ownerKey 引用未知玩家`);
    if (resource.ownerType === "entity" && !entityKeys.has(resource.ownerKey)) issues.push(`${label}.ownerKey 引用未知实体`);
    requireText(resource.meaning, `${label}.meaning`, issues, 8);
    if (isV23Plus && GENERIC_DECISION_CAPACITY.test(`${resource.key} ${resource.meaning}`)) {
      issues.push(`${label} 仍使用通用“决策容量”，必须替换为题材世界内可计量、可消耗的真实资源`);
    }
    const contractedResource = list(generationContract.resourceContracts).find((entry) => text(entry?.key, 80) === resource.key);
    if (isV23Plus && contractedResource) {
      for (const field of ["name", "initialValue", "minimum", "maximum", "ownerType", "ownerKey", "recoverable", "meaning"]) {
        if (resource[field] !== contractedResource[field]) issues.push(`${label}.${field} 必须遵守题材资源合同`);
      }
    }
  }

  if (isV24) {
    validateV24SemanticConstitution({
      outline, chapterKeys, stableTargetKeys, factKeys, authorizationGrantKeys, worldRuleKeys,
      branchEventKeys, timelineEventKeys, evidenceKeys, runtimeEventKeys, playerKeys, entityKeys,
      stateKeys, resourceKeys, validateStructuredEffect, issues
    });
  }

  requireText(outline.sourceFidelity.briefTitle, "sourceFidelity.briefTitle", issues, 2);
  if (brief?.title && outline.sourceFidelity.briefTitle !== text(brief.title, 120)) {
    issues.push(`sourceFidelity.briefTitle 必须保持原题“${text(brief.title, 120)}”`);
  }
  if (outline.sourceFidelity.premiseElements.length < 2) issues.push("sourceFidelity.premiseElements 至少需要两个原始创意锚点");
  const sourcePremise = text(brief?.premise, 4000);
  for (const [index, element] of outline.sourceFidelity.premiseElements.entries()) {
    const label = `sourceFidelity.premiseElements[${index}]`;
    requireText(element.element, `${label}.element`, issues, 2);
    requireText(element.implementation, `${label}.implementation`, issues, 20);
    if (sourcePremise && !sourcePremise.includes(element.element)) issues.push(`${label}.element 必须原样取自 brief.premise：${element.element}`);
    requireKnownRefs(element.chapterKeys, new Set(chapterKeys), `${label}.chapterKeys`, issues, 1);
    requireKnownRefs(element.supportKeys, supportKeys, `${label}.supportKeys`, issues, 1);
  }

  for (const [index, player] of outline.players.entries()) {
    const label = `players[${index}]`;
    requireText(player.key, `${label}.key`, issues);
    requireText(player.name, `${label}.name`, issues);
    if (PLACEHOLDER_NAME.test(player.name)) issues.push(`${label}.name 不能使用“${player.name}”这类占位名`);
    for (const field of ["identity", "publicGoal", "hiddenGoal", "coreSecret", "activePlan", "arc"]) {
      requireText(player[field], `${label}.${field}`, issues, 4);
    }
    if (isV24) {
      requireKnownRefs(player.secretFactKeys, factKeys, `${label}.secretFactKeys`, issues, 1);
      requireKnownRefs(player.authorizationGrantKeys, authorizationGrantKeys, `${label}.authorizationGrantKeys`, issues, 0);
    }
    if (isGenericAction(player.activePlan)) issues.push(`${label}.activePlan 是泛化行动，必须写明具体对象、方法与代价`);
    if (!CONTRIBUTION_ANCHOR_TYPES.has(player.contribution.anchorType)) {
      issues.push(`${label}.contribution.anchorType 必须是 ${[...CONTRIBUTION_ANCHOR_TYPES].join(" / ")} 之一`);
    }
    const contractedContributionType = list(generationContract.contributionTypes)[index];
    if (contractedContributionType && player.contribution.anchorType !== contractedContributionType) {
      issues.push(`${label}.contribution.anchorType 必须遵守生成前合同：${contractedContributionType}`);
    }
    const allowedAnchorTypes = GENRE_ANCHOR_TYPES[outline.genreProfile.mode];
    if (allowedAnchorTypes && !allowedAnchorTypes.has(player.contribution.anchorType)) {
      issues.push(`${label}.contribution.anchorType=${player.contribution.anchorType} 与 genreProfile.mode=${outline.genreProfile.mode} 不匹配`);
    }
    const contributionAnchorKeys = player.contribution.anchorType === "evidence"
      ? evidenceKeys
      : player.contribution.anchorType === "resource"
        ? resourceKeys
        : player.contribution.anchorType === "task"
          ? supportKeys
          : stateKeys;
    requireKnownRefs(player.contribution.anchorKeys, contributionAnchorKeys, `${label}.contribution.anchorKeys`, issues, 1);
    if (!supportKeys.has(player.exclusiveAnchorKey)) {
      issues.push(`${label}.exclusiveAnchorKey 必须引用已登记的独占证据、状态、资源或实体 key`);
    }
    if (!chapterKeys.includes(player.spotlightChapterKey)) issues.push(`${label}.spotlightChapterKey 必须引用真实章节`);
    const actionChapters = new Set(player.chapterActions.map((action) => action.chapterKey));
    const contractedActionChapters = list(generationContract.roleActionChapterKeys)
      .find((entry) => entry?.roleKey === player.key)?.chapterKeys;
    if (Array.isArray(contractedActionChapters)) {
      const expected = [...new Set(contractedActionChapters)].sort();
      const actual = [...actionChapters].sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        issues.push(`${player.name || label}.chapterActions 必须逐章遵守生成前分配：${expected.join("、")}`);
      }
    }
    const minimumActionChapters = Math.min(chapterKeys.length, Math.max(1, Math.ceil(chapterKeys.length * 0.6)));
    if (actionChapters.size < minimumActionChapters) {
      issues.push(`${player.name || label} 至少需要在 ${minimumActionChapters} 个关键章节执行实质行动，不能只在边缘章节出现`);
    }
    if (player.spotlightChapterKey && !actionChapters.has(player.spotlightChapterKey)) {
      issues.push(`${label}.spotlightChapterKey 必须同时出现在 chapterActions`);
    }
    for (const action of player.chapterActions) {
      if (!chapterKeys.includes(action.chapterKey)) issues.push(`${player.name || label} 的行动引用未知章节：${action.chapterKey}`);
      requireText(action.action, `${player.name || label}.${action.chapterKey}.action`, issues, 4);
      requireText(action.actionTarget, `${player.name || label}.${action.chapterKey}.actionTarget`, issues, 2);
      if (!stableTargetKeys.has(action.actionTargetKey)) issues.push(`${player.name || label}.${action.chapterKey}.actionTargetKey 必须引用已登记实体、玩家、资源或证据`);
      requireText(action.method, `${player.name || label}.${action.chapterKey}.method`, issues, 4);
      requireText(action.consequence, `${player.name || label}.${action.chapterKey}.consequence`, issues, 4);
      if (isV24) {
        if (!ACTION_COMMITMENT_MODES.has(action.commitmentMode)) issues.push(`${player.name || label}.${action.chapterKey}.commitmentMode 无效`);
        requireKnownRefs(action.eventKeys, runtimeEventKeys, `${player.name || label}.${action.chapterKey}.eventKeys`, issues, 0);
        if (action.commitmentMode === "conditional" && (!action.decisionKey || !action.optionKeys.length)) {
          issues.push(`${player.name || label}.${action.chapterKey} 的 conditional 行动必须声明 decisionKey 与 optionKeys`);
        }
        if (action.commitmentMode === "proposal" && (action.stateWriteKeys.length || action.resourceKeys.length || action.evidenceEffectKeys.length)) {
          issues.push(`${player.name || label}.${action.chapterKey} 只是 proposal，不能提前声明已发生的状态、资源或证据效果`);
        }
      }
      if (isGenericAction(action.action)) issues.push(`${player.name || label}.${action.chapterKey}.action 是泛化行动，必须说明操作对象与方法`);
      if (isGenericEffect(action.consequence)) issues.push(`${player.name || label}.${action.chapterKey}.consequence 是泛化后果，必须说明谁失去或获得什么`);
      requireKnownRefs(action.evidenceKeys, evidenceKeys, `${player.name || label}.${action.chapterKey}.evidenceKeys`, issues, 0);
      requireKnownRefs(action.resourceKeys, resourceKeys, `${player.name || label}.${action.chapterKey}.resourceKeys`, issues, 0);
      requireKnownRefs(action.evidenceEffectKeys, evidenceKeys, `${player.name || label}.${action.chapterKey}.evidenceEffectKeys`, issues, 0);
      requireKnownRefs(action.affectsRoleKeys, playerKeys, `${player.name || label}.${action.chapterKey}.affectsRoleKeys`, issues, 0);
    }
    requireKnownRefs(player.contribution.turnChapterKeys, new Set(chapterKeys), `${label}.contribution.turnChapterKeys`, issues, 1);
    requireKnownRefs(player.contribution.affectsRoleKeys, playerKeys, `${label}.contribution.affectsRoleKeys`, issues, 1);
    if (!player.contribution.affectsRoleKeys.some((roleKey) => roleKey !== player.key)) {
      issues.push(`${label}.contribution.affectsRoleKeys 必须包含至少一名其他玩家`);
    }
    if (!player.contribution.turnChapterKeys.includes(player.spotlightChapterKey)) {
      issues.push(`${label}.spotlightChapterKey 必须同时出现在 contribution.turnChapterKeys`);
    }
  }

  outline.centralResponsibilityRoleKeys = requireKnownRefs(
    outline.centralResponsibilityRoleKeys,
    playerKeys,
    "centralResponsibilityRoleKeys",
    issues,
    1
  );
  if (isV23Plus) {
    validateResponsibilityRoles({ outline, isV24, playerKeys, timelineEventKeys, issues });
  }
  const contributionTypeCounts = new Map();
  for (const player of outline.players) {
    const type = player.contribution.anchorType;
    contributionTypeCounts.set(type, (contributionTypeCounts.get(type) || 0) + 1);
  }
  if ((contributionTypeCounts.get("evidence") || 0) > Math.ceil(outline.players.length / 2)) {
    issues.push("evidence 贡献角色超过玩家总数的一半，题材贡献重新退化为全员提供证据");
  }
  if (outline.players.length >= 6 && contributionTypeCounts.size < 3) {
    issues.push(`六人贡献类型至少需要 3 种，当前只有 ${contributionTypeCounts.size} 种`);
  }
  for (const roleKey of outline.centralResponsibilityRoleKeys) {
    const player = outline.players.find((entry) => entry.key === roleKey);
    if (player?.name && !outline.truthTimeline.includes(player.name)) {
      issues.push(`核心责任玩家“${player.name}”没有出现在 truthTimeline 的危机因果中`);
    }
  }
  if (outline.centralResponsibilityRoleKeys.length) {
    if (!isV23Plus && !/核心责任玩家[：:]/u.test(outline.truthTimeline)) {
      issues.push("truthTimeline 必须使用“核心责任玩家：”明确写出玩家对危机不可转移的责任");
    }
    if (!/NPC边界[：:]/u.test(outline.truthTimeline)) {
      issues.push("truthTimeline 必须使用“NPC边界：”说明 NPC 不能包办核心危机与最终解释");
    }
  }
  if (isV23Plus) {
    validateCausalTimeline({
      outline, isV24, chapterKeys, playerKeys, entityKeys, stateKeys, stableTargetKeys,
      factKeys, authorizationGrantKeys, issues
    });
  }

  for (const [index, entry] of outline.evidenceGraph.evidence.entries()) {
    const label = `evidence[${index}]`;
    requireText(entry.key, `${label}.key`, issues);
    requireText(entry.label, `${label}.label`, issues);
    requireText(entry.sourceType, `${label}.sourceType`, issues);
    if (!entityKeys.has(entry.provenanceGroup)) issues.push(`${label}.provenanceGroup 必须引用 entities 中登记的稳定来源实体`);
    if (isV23Plus) {
      const provenanceEntity = outline.entities.find((entity) => entity.key === entry.provenanceGroup);
      if (provenanceEntity && !sourceTypeCompatible(entry.sourceType, provenanceEntity.type)) {
        issues.push(`${label}.sourceType=${entry.sourceType} 与来源实体 ${provenanceEntity.name} 的 type=${provenanceEntity.type} 不相容`);
      }
    }
    if (isV24) {
      requireKnownRefs(entry.originRootKeys, entityKeys, `${label}.originRootKeys`, issues, 1);
      if (entry.storageEntityKey && !entityKeys.has(entry.storageEntityKey)) issues.push(`${label}.storageEntityKey 引用未知实体`);
      const knownCommonCauses = new Set([...entityKeys, ...runtimeEventKeys, ...worldRuleKeys]);
      requireKnownRefs(entry.commonCauseKeys, knownCommonCauses, `${label}.commonCauseKeys`, issues, 0);
      requireText(entry.independenceDomain, `${label}.independenceDomain`, issues, 4);
      requireText(entry.methodDomain, `${label}.methodDomain`, issues, 3);
      requireText(entry.methodOperation, `${label}.methodOperation`, issues, 4);
      requireText(entry.artifactProduced, `${label}.artifactProduced`, issues, 4);
      const provenanceEntity = outline.entities.find((entity) => entity.key === entry.provenanceGroup);
      const digitalTarget = ["system", "device"].includes(provenanceEntity?.type)
        || /(?:服务器|镜像|日志|数据库|文件|数字|哈希|签名)/u.test(`${entry.label} ${entry.collectionMethod} ${entry.methodDomain}`);
      if (digitalTarget && /磁粉/u.test(`${entry.label} ${entry.collectionMethod} ${entry.methodOperation} ${entry.artifactProduced}`)) {
        issues.push(`${label} 对数字系统或服务器镜像错误使用“磁粉检测”；应改用哈希、签名、快照、日志或区块级取证`);
      }
    }
    const contractedProvenance = list(generationContract.evidenceProvenanceGroups)[index];
    if (contractedProvenance && entry.key === `evidence-${index + 1}` && entry.provenanceGroup !== contractedProvenance) {
      issues.push(`${label}.provenanceGroup 必须遵守生成前合同：${contractedProvenance}`);
    }
    if (isV24) {
      const sourceContract = list(generationContract.evidenceSourceContracts).find((contract) => text(contract?.evidenceKey, 80) === entry.key);
      if (sourceContract) {
        if (entry.provenanceGroup !== text(sourceContract.provenanceGroup, 80)) issues.push(`${label}.provenanceGroup 必须遵守V2.4来源合同`);
        if (entry.sourceType !== text(sourceContract.sourceType, 80)) issues.push(`${label}.sourceType 必须遵守V2.4来源合同`);
        const expectedRoots = list(sourceContract.originRootKeys).map((key) => text(key, 80)).filter(Boolean).sort();
        if (expectedRoots.length && JSON.stringify([...entry.originRootKeys].sort()) !== JSON.stringify(expectedRoots)) issues.push(`${label}.originRootKeys 必须逐项遵守V2.4来源合同`);
        if (sourceContract.independenceDomain && entry.independenceDomain !== text(sourceContract.independenceDomain, 160)) issues.push(`${label}.independenceDomain 必须遵守V2.4来源合同`);
        if (sourceContract.methodDomain && entry.methodDomain !== text(sourceContract.methodDomain, 80)) issues.push(`${label}.methodDomain 必须遵守V2.4来源合同`);
      }
    }
    requireText(entry.collectionMethod, `${label}.collectionMethod`, issues, 4);
    requireText(entry.obtainedBy, `${label}.obtainedBy`, issues, 4);
    if (entry.sourceOwnerRoleKey && !playerKeys.has(entry.sourceOwnerRoleKey)) issues.push(`${label}.sourceOwnerRoleKey 引用未知玩家`);
    if (entry.originActorKey && !playerKeys.has(entry.originActorKey) && !entityKeys.has(entry.originActorKey)) {
      issues.push(`${label}.originActorKey 必须引用已登记玩家或实体；客观物理痕迹可以留空`);
    }
    if (!chapterKeys.includes(entry.availableChapterKey)) issues.push(`${label}.availableChapterKey 引用未知章节`);
    requireKnownRefs(entry.supportsConclusionKeys, conclusionKeys, `${label}.supportsConclusionKeys`, issues, 0);
    requireKnownRefs(entry.derivedFromEvidenceKeys, evidenceKeys, `${label}.derivedFromEvidenceKeys`, issues, 0);
    if (entry.derivedFromEvidenceKeys.includes(entry.key)) issues.push(`${label}.derivedFromEvidenceKeys 不能引用自身`);
  }

  const evidenceByKey = new Map(outline.evidenceGraph.evidence.map((entry) => [entry.key, entry]));
  const evidenceRootMemo = new Map();
  function evidenceRoots(key, stack = new Set()) {
    if (evidenceRootMemo.has(key)) return evidenceRootMemo.get(key);
    if (stack.has(key)) {
      issues.push(`证据派生循环：${[...stack, key].join(" → ")}`);
      return new Set();
    }
    const entry = evidenceByKey.get(key);
    if (!entry) return new Set();
    if (!entry.derivedFromEvidenceKeys.length) {
      const roots = new Set(isV24 ? entry.originRootKeys : (entry.provenanceGroup ? [entry.provenanceGroup] : []));
      evidenceRootMemo.set(key, roots);
      return roots;
    }
    const nextStack = new Set(stack);
    nextStack.add(key);
    const roots = new Set();
    for (const parentKey of entry.derivedFromEvidenceKeys) {
      for (const root of evidenceRoots(parentKey, nextStack)) roots.add(root);
    }
    evidenceRootMemo.set(key, roots);
    return roots;
  }
  for (const entry of outline.evidenceGraph.evidence) evidenceRoots(entry.key);

  for (const [index, conclusion] of outline.evidenceGraph.conclusions.entries()) {
    const label = `conclusions[${index}]`;
    requireText(conclusion.key, `${label}.key`, issues);
    requireText(conclusion.statement, `${label}.statement`, issues, 8);
    const refs = requireKnownRefs(conclusion.evidenceKeys, evidenceKeys, `${label}.evidenceKeys`, issues, 2);
    const sourceTypes = new Set(refs.map((key) => outline.evidenceGraph.evidence.find((item) => item.key === key)?.sourceType).filter(Boolean));
    if (sourceTypes.size < 2) issues.push(`${label} 未获得两类真正独立的证据来源`);
    const provenanceGroups = new Set(refs.flatMap((key) => [...evidenceRoots(key)]).filter(Boolean));
    if (provenanceGroups.size < 2) issues.push(`${label} 的证据来自同一 provenanceGroup 或同一派生根，属于伪双源`);
    if (isV24) {
      let hasIndependentPair = false;
      for (let left = 0; left < refs.length; left += 1) {
        for (let right = left + 1; right < refs.length; right += 1) {
          const leftEvidence = evidenceByKey.get(refs[left]);
          const rightEvidence = evidenceByKey.get(refs[right]);
          const leftRoots = evidenceRoots(refs[left]);
          const rightRoots = evidenceRoots(refs[right]);
          const sharesRoot = [...leftRoots].some((root) => rightRoots.has(root));
          const sharesCommonCause = leftEvidence.commonCauseKeys.some((key) => rightEvidence.commonCauseKeys.includes(key));
          const sameDomain = leftEvidence.independenceDomain && leftEvidence.independenceDomain === rightEvidence.independenceDomain;
          if (!sharesRoot && !sharesCommonCause && !sameDomain && leftEvidence.sourceType !== rightEvidence.sourceType) hasIndependentPair = true;
        }
      }
      if (!hasIndependentPair) issues.push(`${label} 没有一对同时满足不同根、不同共同故障域、不同独立域和不同媒介的证据`);
    }
    const originActors = refs
      .map((key) => evidenceByKey.get(key)?.originActorKey)
      .filter(Boolean);
    if (originActors.length === refs.length && new Set(originActors).size < 2) {
      issues.push(`${label} 的全部证据都来自同一 originActorKey，口供与日记不能冒充独立来源`);
    }
  }

  if (!outline.hookPromises.length) issues.push("hookPromises 必须逐项列出梗概中的异常承诺");
  for (const [index, promise] of outline.hookPromises.entries()) {
    const label = `hookPromises[${index}]`;
    requireText(promise.key, `${label}.key`, issues);
    requireText(promise.promise, `${label}.promise`, issues, 8);
    requireText(promise.payoff, `${label}.payoff`, issues, 30);
    if (INTERNAL_NARRATIVE_LANGUAGE.test(promise.promise) || INTERNAL_NARRATIVE_LANGUAGE.test(promise.payoff)) {
      issues.push(`${label} 的承诺与兑现必须使用世界内语言，不能暴露 state/resource/chapter/role 等内部 key`);
    }
    const refs = requireKnownRefs(promise.supportKeys, supportKeys, `${label}.supportKeys`, issues, 2);
    if (outline.genreProfile.mode === "mystery") {
      const evidenceRefs = refs.filter((key) => evidenceKeys.has(key));
      if (evidenceRefs.length < 2) issues.push(`${label} 在 mystery 题材中至少需要两条证据支持`);
      const roots = new Set(evidenceRefs.flatMap((key) => [...evidenceRoots(key)]));
      if (roots.size < 2) issues.push(`${label} 在 mystery 题材中的支持证据并非独立来源`);
    }
  }

  requireText(outline.genreMechanic.name, "genreMechanic.name", issues, 2);
  requireText(outline.genreMechanic.playerFacingRule, "genreMechanic.playerFacingRule", issues, 12);
  requireText(outline.genreMechanic.playerOperation, "genreMechanic.playerOperation", issues, 12);
  requireText(outline.genreMechanic.trigger, "genreMechanic.trigger", issues, 12);
  requireText(outline.genreMechanic.resolutionProcedure, "genreMechanic.resolutionProcedure", issues, 20);
  requireText(outline.genreMechanic.successEffect, "genreMechanic.successEffect", issues, 12);
  requireText(outline.genreMechanic.failureEffect, "genreMechanic.failureEffect", issues, 12);
  requireText(outline.genreMechanic.limits, "genreMechanic.limits", issues, 12);
  requireText(outline.genreMechanic.payoff, "genreMechanic.payoff", issues, 12);
  const mechanicChapters = requireKnownRefs(outline.genreMechanic.chapterKeys, new Set(chapterKeys), "genreMechanic.chapterKeys", issues, Math.min(2, chapterKeys.length));
  if (outline.styleContract.signatureDevices.length < 3) {
    issues.push("styleContract.signatureDevices 至少需要 3 个可落地的文风装置");
  }
  requireText(outline.styleContract.forbiddenDrift, "styleContract.forbiddenDrift", issues, 12);
  const contractedStyleSeeds = list(generationContract.styleDeviceSeeds)
    .map((seed) => text(seed, 200))
    .filter(Boolean);
  for (const seed of contractedStyleSeeds) {
    if (!outline.styleContract.signatureDevices.some((device) => device.includes(seed))) {
      issues.push(`styleContract.signatureDevices 必须落实生成前分配的文风装置“${seed}”`);
    }
  }
  const styleChapterKeys = outline.styleContract.chapterExpressions.map((entry) => entry.chapterKey);
  if (outline.styleContract.chapterExpressions.length !== chapterKeys.length) {
    issues.push(`styleContract.chapterExpressions 必须逐章覆盖 ${chapterKeys.length} 章`);
  }
  if (duplicateValues(styleChapterKeys).length) issues.push("styleContract.chapterExpressions 章节重复");
  for (const [index, expression] of outline.styleContract.chapterExpressions.entries()) {
    const label = `styleContract.chapterExpressions[${index}]`;
    if (!chapterKeys.includes(expression.chapterKey)) issues.push(`${label}.chapterKey 引用未知章节`);
    requireText(expression.device, `${label}.device`, issues, 4);
    requireText(expression.sceneOrDialogue, `${label}.sceneOrDialogue`, issues, 20);
    if (
      expression.device
      && !outline.styleContract.signatureDevices.some((device) => (
        device.includes(expression.device) || expression.device.includes(device)
      ))
    ) {
      issues.push(`${label}.device 未引用 signatureDevices 中的文风装置`);
    }
  }
  if (!GENRE_MODES.has(outline.genreProfile.mode)) {
    issues.push(`genreProfile.mode 必须是 ${[...GENRE_MODES].join(" / ")} 之一`);
  }
  if (generationContract.genreMode && outline.genreProfile.mode !== generationContract.genreMode) {
    issues.push(`genreProfile.mode 必须遵守生成前合同：${generationContract.genreMode}`);
  }
  requireText(outline.genreProfile.chapterProgressRule, "genreProfile.chapterProgressRule", issues, 12);
  requireText(outline.genreProfile.decisionCadence, "genreProfile.decisionCadence", issues, 12);

  const minimumMisdirections = outline.genreProfile.mode === "mystery" ? 2 : 1;
  if (outline.misdirections.length < minimumMisdirections) {
    issues.push(`genreProfile.mode=${outline.genreProfile.mode} 至少需要 ${minimumMisdirections} 条题材适配的 misdirections`);
  }
  const allowedMisdirectionKinds = MISDIRECTION_KINDS[outline.genreProfile.mode] || MISDIRECTION_KINDS.hybrid;
  for (const [index, misdirection] of outline.misdirections.entries()) {
    const label = `misdirections[${index}]`;
    requireText(misdirection.key, `${label}.key`, issues);
    if (!allowedMisdirectionKinds.has(misdirection.kind)) {
      issues.push(`${label}.kind=${misdirection.kind} 与 genreProfile.mode=${outline.genreProfile.mode} 不匹配`);
    }
    for (const field of ["apparentInterpretation", "trueCause", "mainlineImpact", "lastingConsequence"]) {
      requireText(misdirection[field], `${label}.${field}`, issues, 8);
    }
    const supporting = requireKnownRefs(misdirection.supportKeys, supportKeys, `${label}.supportKeys`, issues, 1);
    const disproving = requireKnownRefs(misdirection.disproofKeys, supportKeys, `${label}.disproofKeys`, issues, 1);
    if (outline.genreProfile.mode === "mystery") {
      if (!supporting.some((key) => evidenceKeys.has(key)) || !disproving.some((key) => evidenceKeys.has(key))) {
        issues.push(`${label} 在 mystery 题材中必须由具体证据建立并排除`);
      }
    }
  }

  if (outline.chapterBeats.length !== chapterKeys.length) issues.push(`chapterBeats 必须恰好覆盖 ${chapterKeys.length} 章`);
  const beatKeys = outline.chapterBeats.map((beat) => beat.chapterKey);
  if (duplicateValues(beatKeys).length) issues.push("chapterBeats 章节 key 重复");
  const decisionStateKeys = new Set();
  const stateWritesByKey = new Map();
  const stateReadsByKey = new Map();
  const resourceDeltasByKey = new Map();
  const evidenceEffectsByKey = new Map();
  const eventEffectsByKey = new Map();
  const decisionByKey = new Map();
  const actionCorpus = [];
  let decisionChapterCount = 0;
  for (const chapterKey of chapterKeys) if (!beatKeys.includes(chapterKey)) issues.push(`chapterBeats 缺少 ${chapterKey}`);
  for (const [index, beat] of outline.chapterBeats.entries()) {
    const label = `chapterBeats[${index}]`;
    if (!chapterKeys.includes(beat.chapterKey)) issues.push(`${label}.chapterKey 未出现在 spec 中`);
    for (const field of ["goal", "turn", "playerAction", "irreversibleConsequence", "nextState"]) {
      requireText(beat[field], `${label}.${field}`, issues, 8);
    }
    requireText(beat.actionObject, `${label}.actionObject`, issues, 2);
    if (isGenericAction(beat.playerAction)) issues.push(`${label}.playerAction 是泛化行动，必须说明对哪个对象执行什么操作`);
    if (isGenericEffect(beat.irreversibleConsequence)) issues.push(`${label}.irreversibleConsequence 是泛化后果，必须说明不可恢复的损失`);
    if (isGenericEffect(beat.nextState)) issues.push(`${label}.nextState 是泛化描述，必须与结构化状态读写一致`);
    if (!stableTargetKeys.has(beat.actionTargetKey)) issues.push(`${label}.actionTargetKey 必须引用已登记实体、玩家、资源或证据`);
    actionCorpus.push(beat.playerAction);
    requireKnownRefs(beat.triggerRoleKeys, playerKeys, `${label}.triggerRoleKeys`, issues, 1);
    const minimumEvidence = outline.genreProfile.mode === "mystery" ? 1 : 0;
    requireKnownRefs(beat.evidenceKeys, evidenceKeys, `${label}.evidenceKeys`, issues, minimumEvidence);
    requireKnownRefs(beat.unlocksEvidenceKeys, evidenceKeys, `${label}.unlocksEvidenceKeys`, issues, 0);
    requireKnownRefs(beat.locksEvidenceKeys, evidenceKeys, `${label}.locksEvidenceKeys`, issues, 0);
    const lockOverlap = beat.unlocksEvidenceKeys.filter((key) => beat.locksEvidenceKeys.includes(key));
    if (lockOverlap.length) issues.push(`${label} 同时解锁并锁定同一证据：${lockOverlap.join("、")}`);
    for (const key of beat.unlocksEvidenceKeys) {
      const rows = evidenceEffectsByKey.get(key) || [];
      rows.push({ chapterKey: beat.chapterKey, value: "available", source: "chapterBeat" });
      evidenceEffectsByKey.set(key, rows);
    }
    for (const key of beat.locksEvidenceKeys) {
      const rows = evidenceEffectsByKey.get(key) || [];
      rows.push({ chapterKey: beat.chapterKey, value: "locked", source: "chapterBeat" });
      evidenceEffectsByKey.set(key, rows);
    }

    if (!PROGRESS_MODES.has(beat.progressMode)) issues.push(`${label}.progressMode 不是受支持的局面变化类型`);
    const allowedProgress = GENRE_PROGRESS[outline.genreProfile.mode];
    if (allowedProgress && !allowedProgress.has(beat.progressMode)) {
      issues.push(`${label}.progressMode=${beat.progressMode} 与 genreProfile.mode=${outline.genreProfile.mode} 不匹配`);
    }

    const hasStateReads = beat.stateReads.length > 0;
    if (hasStateReads) {
      if (!["all", "any"].includes(beat.entryConditionMode)) issues.push(`${label}.entryConditionMode 必须为 all 或 any`);
      requireText(beat.onReadPass.variantKey, `${label}.onReadPass.variantKey`, issues);
      requireText(beat.onReadPass.effectSummary, `${label}.onReadPass.effectSummary`, issues, 8);
      requireText(beat.onReadFail.variantKey, `${label}.onReadFail.variantKey`, issues);
      requireText(beat.onReadFail.fallbackAction, `${label}.onReadFail.fallbackAction`, issues, 12);
      if (beat.onReadPass.variantKey && beat.onReadPass.variantKey === beat.onReadFail.variantKey) {
        issues.push(`${label} 的通过与失败分支不能使用同一个 variantKey`);
      }
      if (
        !beat.onReadFail.additionalCosts.length
        && !beat.onReadFail.stateWrites.length
        && !beat.onReadFail.locksEvidenceKeys.length
        && !beat.onReadFail.unlocksEvidenceKeys.length
      ) {
        issues.push(`${label}.onReadFail 必须声明资源代价、状态变化或证据得失，不能只写自然语言备用动作`);
      }
    } else if (beat.entryConditionMode !== "none") {
      issues.push(`${label} 没有 stateReads 时 entryConditionMode 必须为 none`);
    }

    for (const [readIndex, read] of beat.stateReads.entries()) {
      const readLabel = `${label}.stateReads[${readIndex}]`;
      if (!stateKeys.has(read.stateKey)) issues.push(`${readLabel} 引用未知状态：${read.stateKey}`);
      if (!hasScalarValue(read.value)) issues.push(`${readLabel}.value 缺失`);
      const rows = stateReadsByKey.get(read.stateKey) || [];
      rows.push({ chapterKey: beat.chapterKey, ...read });
      stateReadsByKey.set(read.stateKey, rows);
    }
    for (const [writeIndex, write] of beat.onReadFail.stateWrites.entries()) {
      const writeLabel = `${label}.onReadFail.stateWrites[${writeIndex}]`;
      if (!stateKeys.has(write.stateKey)) issues.push(`${writeLabel} 引用未知状态：${write.stateKey}`);
      if (!STATE_OPERATIONS.has(write.operation)) issues.push(`${writeLabel}.operation 必须为 set/increment/decrement/add/remove`);
      if (!hasScalarValue(write.value)) issues.push(`${writeLabel}.value 缺失`);
      const rows = stateWritesByKey.get(write.stateKey) || [];
      rows.push({ chapterKey: beat.chapterKey, ...write, source: "onReadFail" });
      stateWritesByKey.set(write.stateKey, rows);
    }
    requireKnownRefs(beat.onReadFail.locksEvidenceKeys, evidenceKeys, `${label}.onReadFail.locksEvidenceKeys`, issues, 0);
    requireKnownRefs(beat.onReadFail.unlocksEvidenceKeys, evidenceKeys, `${label}.onReadFail.unlocksEvidenceKeys`, issues, 0);
    for (const key of beat.onReadFail.locksEvidenceKeys) {
      const rows = evidenceEffectsByKey.get(key) || [];
      rows.push({ chapterKey: beat.chapterKey, value: "locked", source: "onReadFail" });
      evidenceEffectsByKey.set(key, rows);
    }
    for (const key of beat.onReadFail.unlocksEvidenceKeys) {
      const rows = evidenceEffectsByKey.get(key) || [];
      rows.push({ chapterKey: beat.chapterKey, value: "available", source: "onReadFail" });
      evidenceEffectsByKey.set(key, rows);
    }
    for (const [writeIndex, write] of beat.stateWrites.entries()) {
      const writeLabel = `${label}.stateWrites[${writeIndex}]`;
      if (!stateKeys.has(write.stateKey)) issues.push(`${writeLabel} 引用未知状态：${write.stateKey}`);
      if (!STATE_OPERATIONS.has(write.operation)) issues.push(`${writeLabel}.operation 必须为 set/increment/decrement/add/remove`);
      if (!hasScalarValue(write.value)) issues.push(`${writeLabel}.value 缺失`);
      const rows = stateWritesByKey.get(write.stateKey) || [];
      rows.push({ chapterKey: beat.chapterKey, ...write, source: "chapterBeat" });
      stateWritesByKey.set(write.stateKey, rows);
    }
    for (const [deltaIndex, delta] of beat.resourceDeltas.entries()) {
      const deltaLabel = `${label}.resourceDeltas[${deltaIndex}]`;
      if (!resourceKeys.has(delta.resourceKey)) issues.push(`${deltaLabel}.resourceKey 引用未登记资源：${delta.resourceKey}`);
      if (!RESOURCE_OPERATIONS.has(delta.operation)) issues.push(`${deltaLabel}.operation 必须为 gain/lose/set/transfer`);
      if (delta.amount === null || delta.amount < 0 || (delta.operation !== "set" && delta.amount === 0)) {
        issues.push(`${deltaLabel}.amount 必须为有效数字；gain/lose/transfer 必须大于 0，且不能使用字符串`);
      }
      requireText(delta.consequence, `${deltaLabel}.consequence`, issues, 8);
      requireKnownRefs(delta.affectsRoleKeys, playerKeys, `${deltaLabel}.affectsRoleKeys`, issues, 1);
      const rows = resourceDeltasByKey.get(delta.resourceKey) || [];
      rows.push({ chapterKey: beat.chapterKey, ...delta, source: "chapterBeat" });
      resourceDeltasByKey.set(delta.resourceKey, rows);
    }
    for (const [costIndex, delta] of beat.onReadFail.additionalCosts.entries()) {
      const deltaLabel = `${label}.onReadFail.additionalCosts[${costIndex}]`;
      if (!resourceKeys.has(delta.resourceKey)) issues.push(`${deltaLabel}.resourceKey 引用未登记资源：${delta.resourceKey}`);
      if (!["lose", "transfer"].includes(delta.operation)) issues.push(`${deltaLabel}.operation 必须为 lose 或 transfer`);
      if (delta.amount === null || delta.amount <= 0) issues.push(`${deltaLabel}.amount 必须为大于 0 的数字`);
      requireText(delta.consequence, `${deltaLabel}.consequence`, issues, 8);
      requireKnownRefs(delta.affectsRoleKeys, playerKeys, `${deltaLabel}.affectsRoleKeys`, issues, 1);
      const rows = resourceDeltasByKey.get(delta.resourceKey) || [];
      rows.push({ chapterKey: beat.chapterKey, ...delta, source: "onReadFail" });
      resourceDeltasByKey.set(delta.resourceKey, rows);
    }

    const hasDecision = Boolean(beat.decision.stateKey || beat.decision.question || beat.decision.options.length);
    if (hasDecision) {
      decisionChapterCount += 1;
      if (isV24) {
        requireText(beat.decision.key, `${label}.decision.key`, issues);
        if (beat.decision.key && decisionByKey.has(beat.decision.key)) issues.push(`${label}.decision.key 重复：${beat.decision.key}`);
        if (beat.decision.key) decisionByKey.set(beat.decision.key, { beat, chapterKey: beat.chapterKey });
      }
      const hasStateEffect = beat.decision.options.some((option) => option.effects.some((effect) => effect.targetType === "state"));
      if (!isV24 || hasStateEffect) requireText(beat.decision.stateKey, `${label}.decision.stateKey`, issues);
      if (isV24 && !hasStateEffect && beat.decision.stateKey) {
        issues.push(`${label}.decision.stateKey 必须为空；本章选项没有裁决任何状态`);
      }
      if (isV24 && hasStateEffect) {
        const effectStateKeys = unique(beat.decision.options.flatMap((option) => option.effects
          .filter((effect) => effect.targetType === "state")
          .map((effect) => effect.targetKey)));
        if (effectStateKeys.length !== 1 || effectStateKeys[0] !== beat.decision.stateKey) {
          issues.push(`${label}.decision 只能裁决一个状态，且所有 state effects 必须与 decision.stateKey 一致`);
        }
      }
      requireText(beat.decision.question, `${label}.decision.question`, issues, 8);
      if (beat.decision.stateKey) {
        decisionStateKeys.add(beat.decision.stateKey);
        if (!stateKeys.has(beat.decision.stateKey)) issues.push(`${label}.decision.stateKey 引用未知状态`);
      }
      if (beat.decision.options.length < 2) issues.push(`${label}.decision.options 至少需要两个会改变局面的选项`);
      for (const [optionIndex, option] of beat.decision.options.entries()) {
        requireText(option.key, `${label}.decision.options[${optionIndex}].key`, issues);
        requireText(option.choiceText, `${label}.decision.options[${optionIndex}].choiceText`, issues, 4);
        if (isV23Plus && (INTERNAL_CHOICE_LANGUAGE.test(option.choiceText) || INTERNAL_CHOICE_LANGUAGE.test(option.immediateConsequence))) {
          issues.push(`${label}.decision.options[${optionIndex}] 的玩家可见文本暴露内部状态 key、章节号、枚举值或路线控制语言`);
        }
        if (isV23 && option.sets.stateKey !== beat.decision.stateKey) {
          issues.push(`${label}.decision.options[${optionIndex}].sets.stateKey 必须等于 decision.stateKey`);
        }
        if (!isV24 && !hasScalarValue(option.setsValue)) issues.push(`${label}.decision.options[${optionIndex}].setsValue 缺失`);
        if (isV24 && option.effects.length === 0) issues.push(`${label}.decision.options[${optionIndex}].effects 至少需要一项真实状态、资源、证据或事件效果`);
        requireText(option.immediateConsequence, `${label}.decision.options[${optionIndex}].immediateConsequence`, issues, 8);
        if (!isV24 && beat.decision.stateKey && option.setsValue) {
          const rows = stateWritesByKey.get(beat.decision.stateKey) || [];
          rows.push({
            chapterKey: beat.chapterKey,
            stateKey: beat.decision.stateKey,
            operation: "set",
            value: option.setsValue,
            source: `decision:${option.key || optionIndex}`
          });
          stateWritesByKey.set(beat.decision.stateKey, rows);
        }
        for (const [effectIndex, effect] of option.effects.entries()) {
          const effectLabel = `${label}.decision.options[${optionIndex}].effects[${effectIndex}]`;
          validateStructuredEffect(effect, effectLabel);
          if (effect.targetType === "state") {
            const state = outline.endingLogic.stateVariables.find((entry) => entry.key === effect.targetKey);
            if (["observed", "derived"].includes(state?.controlMode)) issues.push(`${effectLabel} 不能由玩家选项直接改写 ${state.controlMode} 状态 ${state.key}`);
            const normalizedValue = String(effect.value || "").toLowerCase();
            const playerFacingChoice = `${option.choiceText} ${option.immediateConsequence}`;
            if (/(?:pending|unknown|undecided|待定|未决|搁置)/u.test(normalizedValue)
              && /(?:接受当前|承认赛果|拒绝赛果|确认有效|确认无效|正式裁定|作出裁决|否决赛果)/u.test(playerFacingChoice)) {
              issues.push(`${effectLabel} 的待定状态与玩家可见选项“${option.choiceText}”语义冲突`);
            }
            if (/(?:recognized|accepted|valid|承认|接受|有效)/u.test(normalizedValue)
              && /(?:拒绝赛果|不承认|判定无效|否决赛果)/u.test(playerFacingChoice)) {
              issues.push(`${effectLabel} 的认可状态与玩家可见选项“${option.choiceText}”语义冲突`);
            }
            if (/(?:rejected|invalid|拒绝|无效)/u.test(normalizedValue)
              && /(?:接受当前|承认赛果|确认有效)/u.test(playerFacingChoice)) {
              issues.push(`${effectLabel} 的拒绝状态与玩家可见选项“${option.choiceText}”语义冲突`);
            }
            const rows = stateWritesByKey.get(effect.targetKey) || [];
            rows.push({ chapterKey: beat.chapterKey, stateKey: effect.targetKey, operation: effect.operation, value: effect.value, source: `decision:${option.key || optionIndex}` });
            stateWritesByKey.set(effect.targetKey, rows);
          }
          if (effect.targetType === "resource") {
            const rows = resourceDeltasByKey.get(effect.targetKey) || [];
            rows.push({ chapterKey: beat.chapterKey, resourceKey: effect.targetKey, operation: effect.operation, amount: effect.amount, consequence: effect.consequence, source: `decision:${option.key || optionIndex}` });
            resourceDeltasByKey.set(effect.targetKey, rows);
          }
          if (effect.targetType === "evidence") {
            const rows = evidenceEffectsByKey.get(effect.targetKey) || [];
            rows.push({ chapterKey: beat.chapterKey, value: effect.operation === "unlock" ? "available" : "locked", source: `decision:${option.key || optionIndex}` });
            evidenceEffectsByKey.set(effect.targetKey, rows);
          }
          if (effect.targetType === "event") {
            if (!branchEventKeys.has(effect.targetKey)) issues.push(`${effectLabel} 只能触发 branchEvents，不能重新触发既成 causalTimeline 事件`);
            if (/(?:未触发|没有触发|不触发|未启动|不启动|不发起|放弃启动)/u.test(effect.consequence)) {
              issues.push(`${effectLabel} 声称触发事件，却在 consequence 中否认触发结果`);
            }
            const rows = eventEffectsByKey.get(effect.targetKey) || [];
            rows.push({
              chapterKey: beat.chapterKey,
              optionKey: option.key || String(optionIndex),
              choiceText: option.choiceText,
              consequence: effect.consequence,
              spendsResource: option.effects.some((candidate) => candidate.targetType === "resource" && candidate.operation === "lose"),
              source: `decision:${option.key || optionIndex}`
            });
            eventEffectsByKey.set(effect.targetKey, rows);
          }
        }
      }
    }
    if (
      !hasDecision
      && !beat.stateWrites.length
      && !beat.resourceDeltas.length
      && !beat.unlocksEvidenceKeys.length
      && !beat.locksEvidenceKeys.length
      && !beat.onReadFail.stateWrites.length
      && !beat.onReadFail.additionalCosts.length
      && !beat.onReadFail.unlocksEvidenceKeys.length
      && !beat.onReadFail.locksEvidenceKeys.length
    ) {
      issues.push(`${label} 没有任何结构化局面变化；自然语言 nextState 不能代替真实状态传递`);
    }
  }
  if (isV24) {
    for (const branchEvent of outline.semanticConstitution.branchEvents) {
      const writes = eventEffectsByKey.get(branchEvent.key) || [];
      if (!writes.length) issues.push(`分支事件 ${branchEvent.key} 没有由任何玩家选项触发`);
      if (writes.length > 1) issues.push(`分支事件 ${branchEvent.key} 必须恰好由一个玩家选项触发，当前由 ${writes.length} 个选项重复触发`);
      if (branchEvent.description.includes("公开") && writes.some((write) => !write.choiceText.includes("公开"))) {
        issues.push(`分支事件 ${branchEvent.key} 的登记行为要求“公开”，但实际触发选项没有执行公开行为`);
      }
      if (branchEvent.description.includes("复核席位") && writes.some((write) => !write.spendsResource)) {
        issues.push(`分支事件 ${branchEvent.key} 的登记行为要求动用复核席位，但实际触发选项没有消费题材资源`);
      }
      if (writes.some((write) => write.chapterKey !== branchEvent.chapterKey)) {
        issues.push(`分支事件 ${branchEvent.key} 只能在登记章节 ${branchEvent.chapterKey} 触发`);
      }
    }
    for (const rule of outline.semanticConstitution.worldRules) {
      for (const effect of rule.effects) {
        const source = `world-rule:${rule.key}`;
        if (effect.targetType === "state") {
          const rows = stateWritesByKey.get(effect.targetKey) || [];
          rows.push({ chapterKey: rule.evaluationChapterKey, stateKey: effect.targetKey, operation: effect.operation, value: effect.value, source });
          stateWritesByKey.set(effect.targetKey, rows);
        }
        if (effect.targetType === "resource") {
          const rows = resourceDeltasByKey.get(effect.targetKey) || [];
          rows.push({ chapterKey: rule.evaluationChapterKey, resourceKey: effect.targetKey, operation: effect.operation, amount: effect.amount, consequence: effect.consequence, source });
          resourceDeltasByKey.set(effect.targetKey, rows);
        }
        if (effect.targetType === "evidence") {
          const rows = evidenceEffectsByKey.get(effect.targetKey) || [];
          rows.push({ chapterKey: rule.evaluationChapterKey, value: effect.operation === "unlock" ? "available" : "locked", source });
          evidenceEffectsByKey.set(effect.targetKey, rows);
        }
        if (effect.targetType === "event") {
          const rows = eventEffectsByKey.get(effect.targetKey) || [];
          rows.push({ chapterKey: rule.evaluationChapterKey, source });
          eventEffectsByKey.set(effect.targetKey, rows);
        }
      }
    }
    for (const player of outline.players) {
      for (const action of player.chapterActions) {
        if (action.decisionKey) {
          const decisionEntry = decisionByKey.get(action.decisionKey);
          if (!decisionEntry) {
            issues.push(`${player.name}.${action.chapterKey}.decisionKey 引用未知决策：${action.decisionKey}`);
          } else {
            if (chapterIndex(chapterKeys, decisionEntry.chapterKey) > chapterIndex(chapterKeys, action.chapterKey)) {
              issues.push(`${player.name}.${action.chapterKey} 不能依赖未来章节决策 ${action.decisionKey}`);
            }
            const validOptionKeys = new Set(decisionEntry.beat.decision.options.map((option) => option.key));
            for (const optionKey of action.optionKeys) if (!validOptionKeys.has(optionKey)) issues.push(`${player.name}.${action.chapterKey}.optionKeys 引用未知选项：${optionKey}`);
          }
        } else if (action.optionKeys.length) {
          issues.push(`${player.name}.${action.chapterKey} 填写 optionKeys 时必须同时声明 decisionKey`);
        }
        const precommitsUnresolvedDecision = /(?:最终决定|决定动用|决定发起|进入.{0,12}(?:结局|路线)|结局走向)/u.test(`${action.action} ${action.consequence}`);
        if (precommitsUnresolvedDecision && !action.decisionKey) {
          issues.push(`${player.name}.${action.chapterKey} 在未引用既有决策的情况下提前写死结局或执行结果`);
        }
      }
    }
  }
  const decisionRatioRequired = ["mystery", "political", "survival"].includes(outline.genreProfile.mode) ? 1 : 0.6;
  const minimumDecisionChapters = Math.ceil(chapterKeys.length * decisionRatioRequired);
  if (decisionChapterCount < minimumDecisionChapters) {
    issues.push(`genreProfile.mode=${outline.genreProfile.mode} 至少需要 ${minimumDecisionChapters} 章出现实质决策，当前为 ${decisionChapterCount} 章`);
  }
  for (const chapterKey of mechanicChapters) {
    const beat = outline.chapterBeats.find((item) => item.chapterKey === chapterKey);
    if (!beat?.genreMechanicUse || beat.genreMechanicUse.length < 8) issues.push(`${chapterKey} 未实际使用题材机制`);
    for (const sectionPattern of MECHANIC_USE_SECTIONS) {
      if (!sectionPattern.test(beat?.genreMechanicUse || "")) {
        issues.push(`${chapterKey}.genreMechanicUse 必须同时写明触发、判定、成功与失败`);
        break;
      }
    }
  const hasMechanicEffect = Boolean(
    beat?.decision?.stateKey
    ||
    beat?.stateWrites?.length
      || beat?.resourceDeltas?.length
      || beat?.unlocksEvidenceKeys?.length
      || beat?.locksEvidenceKeys?.length
      || beat?.onReadFail?.stateWrites?.length
      || beat?.onReadFail?.additionalCosts?.length
      || beat?.onReadFail?.unlocksEvidenceKeys?.length
      || beat?.onReadFail?.locksEvidenceKeys?.length
    );
    if (!hasMechanicEffect) issues.push(`${chapterKey} 使用题材机制却没有写入任何状态、资源或证据结果`);
  }

  if (!outline.endingLogic.stateVariables.length) issues.push("endingLogic.stateVariables 至少需要一个可跨章读取的状态");
  if (outline.endingLogic.stateVariables.length + outline.resources.length < Math.min(2, chapterKeys.length)) {
    issues.push("结局至少应累计两个已登记状态或资源，不能只依赖最后一章临时选择");
  }
  const finalChapterKey = chapterKeys.at(-1);
  const reachableStateValues = new Map();
  const stateDimensionOwners = new Map();
  for (const [index, state] of outline.endingLogic.stateVariables.entries()) {
    requireText(state.key, `stateVariables[${index}].key`, issues);
    if (!["enum", "number", "boolean", "set"].includes(state.valueType)) {
      issues.push(`stateVariables[${index}].valueType 必须为 enum/number/boolean/set`);
    }
    const stateContractIndex = contractedStateKeys.indexOf(state.key);
    const contractedStateType = list(generationContract.stateTypes)[stateContractIndex];
    if (stateContractIndex >= 0 && contractedStateType && state.valueType !== contractedStateType) {
      issues.push(`状态变量 ${state.key}.valueType 必须遵守生成前合同：${contractedStateType}`);
    }
    const contractedSetChapter = list(generationContract.stateSetChapterKeys)[stateContractIndex];
    if (stateContractIndex >= 0 && contractedSetChapter && state.setInChapterKey !== contractedSetChapter) {
      issues.push(`状态变量 ${state.key}.setInChapterKey 必须遵守生成前合同：${contractedSetChapter}`);
    }
    requireText(state.meaning, `stateVariables[${index}].meaning`, issues, 8);
    if (isV24) {
      if (!stableTargetKeys.has(state.subjectKey)) issues.push(`stateVariables[${index}].subjectKey 必须引用已登记玩家、实体、状态、资源或证据`);
      requireText(state.dimension, `stateVariables[${index}].dimension`, issues, 3);
      if (!["observed", "adjudicated", "player-decision", "derived"].includes(state.controlMode)) {
        issues.push(`stateVariables[${index}].controlMode 必须为 observed/adjudicated/player-decision/derived`);
      }
      requireKnownRefs(state.derivedFromFactKeys, factKeys, `stateVariables[${index}].derivedFromFactKeys`, issues, 0);
      if (state.derivedByRuleKey && !worldRuleKeys.has(state.derivedByRuleKey)) issues.push(`stateVariables[${index}].derivedByRuleKey 引用未知世界规则`);
      if (state.controlMode === "derived" && !state.derivedByRuleKey) issues.push(`派生状态 ${state.key} 必须声明 derivedByRuleKey`);
      const dimensionSignature = `${state.subjectKey}|${normalizedFingerprint(state.dimension)}`;
      const previousState = stateDimensionOwners.get(dimensionSignature);
      if (previousState) issues.push(`状态 ${state.key} 与 ${previousState} 重复描述同一主体的同一判断维度`);
      stateDimensionOwners.set(dimensionSignature, state.key);
    }
    if (!chapterKeys.includes(state.setInChapterKey)) issues.push(`stateVariables[${index}] 引用未知章节`);
    if (state.valueType === "enum" && state.allowedValues.length < 2) issues.push(`stateVariables[${index}].allowedValues 至少需要两个枚举值`);
    if (isV23Plus && state.valueType === "enum") {
      const semanticValues = state.valueSemantics.map((semantic) => semantic.value);
      if (semanticValues.length !== state.allowedValues.length
        || state.allowedValues.some((value) => !semanticValues.includes(value))) {
        issues.push(`状态变量 ${state.key}.valueSemantics 必须逐一解释全部 allowedValues`);
      }
      for (const [semanticIndex, semantic] of state.valueSemantics.entries()) {
        requireText(semantic.worldMeaning, `状态变量 ${state.key}.valueSemantics[${semanticIndex}].worldMeaning`, issues, 8);
        if (!semantic.incompatibleClaims.length) {
          issues.push(`状态变量 ${state.key}.valueSemantics[${semanticIndex}].incompatibleClaims 至少声明一条与该值冲突的世界内说法`);
        }
      }
    }
    const writes = stateWritesByKey.get(state.key) || [];
    if (!writes.length) issues.push(`状态变量 ${state.key} 没有由章节决策或 stateWrites 写入`);
    if (isV24 && state.controlMode === "derived" && writes.some((write) => !String(write.source || "").startsWith("world-rule:"))) {
      issues.push(`派生状态 ${state.key} 只能由其世界规则效果写入，不能由玩家选项、公共 stateWrites 或失败分支直接赋值`);
    }
    if (isV24 && state.controlMode === "derived" && writes.some((write) => write.source !== `world-rule:${state.derivedByRuleKey}`)) {
      issues.push(`派生状态 ${state.key} 的写入必须来自 derivedByRuleKey=${state.derivedByRuleKey}`);
    }
    if (state.valueType === "enum") {
      if (typeof state.initialValue !== "string") issues.push(`枚举状态 ${state.key}.initialValue 必须是字符串`);
      if (hasScalarValue(state.initialValue) && !state.allowedValues.includes(state.initialValue)) issues.push(`状态变量 ${state.key}.initialValue 不在 allowedValues 中`);
      for (const write of writes) {
        if (write.operation !== "set") issues.push(`枚举状态 ${state.key} 只能使用 set，不能使用 ${write.operation}`);
        if (typeof write.value !== "string") issues.push(`枚举状态 ${state.key} 的写入值必须是字符串`);
        if (write.operation === "set" && write.value && !state.allowedValues.includes(write.value)) {
          issues.push(`状态变量 ${state.key} 写入了 allowedValues 之外的值：${write.value}`);
        }
      }
    }
    if (state.valueType === "number") {
      if (typeof state.initialValue !== "number") issues.push(`数值状态 ${state.key}.initialValue 必须是 JSON 数字`);
      for (const write of writes) {
        if (!["set", "increment", "decrement"].includes(write.operation)) {
          issues.push(`数值状态 ${state.key} 只能使用 set/increment/decrement，不能使用 ${write.operation}`);
        }
        if (typeof write.value !== "number") issues.push(`数值状态 ${state.key} 的写入值必须是 JSON 数字`);
      }
    }
    if (state.valueType === "boolean") {
      if (typeof state.initialValue !== "boolean") issues.push(`布尔状态 ${state.key}.initialValue 必须是 true/false`);
      for (const write of writes) {
        if (write.operation !== "set") issues.push(`布尔状态 ${state.key} 只能使用 set`);
        if (typeof write.value !== "boolean") issues.push(`布尔状态 ${state.key} 的写入值必须是 true/false`);
      }
    }
    for (const read of stateReadsByKey.get(state.key) || []) {
      if (state.valueType === "number" && typeof read.value !== "number") {
        issues.push(`${read.chapterKey} 对数值状态 ${state.key} 的读取值必须是 JSON 数字`);
      }
      if (state.valueType !== "number" && ["gte", "lte"].includes(read.operator)) {
        issues.push(`${read.chapterKey} 对 ${state.valueType} 状态 ${state.key} 不能使用 ${read.operator}`);
      }
      if (state.valueType === "boolean" && typeof read.value !== "boolean") {
        issues.push(`${read.chapterKey} 对布尔状态 ${state.key} 的读取值必须是 true/false`);
      }
      if (state.valueType === "enum" && !state.allowedValues.includes(read.value)) {
        issues.push(`${read.chapterKey} 读取了枚举状态 ${state.key} 未声明的值：${String(read.value)}`);
      }
    }
    const firstWrite = [...writes].sort((left, right) => chapterIndex(chapterKeys, left.chapterKey) - chapterIndex(chapterKeys, right.chapterKey))[0];
    if (firstWrite && state.setInChapterKey !== firstWrite.chapterKey) {
      issues.push(`状态变量 ${state.key}.setInChapterKey 必须等于首次真实写入章节 ${firstWrite.chapterKey}`);
    }
    const values = new Set([state.initialValue, ...writes.map((write) => write.value)].filter(hasScalarValue));
    reachableStateValues.set(state.key, values);
  }

  const reachableResourceValues = new Map();
  for (const [index, resource] of outline.resources.entries()) {
    const values = new Set();
    if (resource.initialValue !== null) values.add(resource.initialValue);
    let candidates = new Set(values);
    const deltas = [...(resourceDeltasByKey.get(resource.key) || [])]
      .sort((left, right) => chapterIndex(chapterKeys, left.chapterKey) - chapterIndex(chapterKeys, right.chapterKey));
    for (const delta of deltas) {
      if (resource.valueType === "integer" && delta.amount !== null && !Number.isInteger(delta.amount)) {
        issues.push(`资源 ${resource.key} 声明为 integer，但章节写入了非整数 amount：${delta.amount}`);
      }
      const nextCandidates = delta.source === "chapterBeat" ? new Set() : new Set(candidates);
      for (const current of candidates) {
        let next = current;
        if (delta.operation === "gain") next = current + delta.amount;
        if (delta.operation === "lose") next = current - delta.amount;
        if (delta.operation === "set") next = delta.amount;
        if (delta.operation === "transfer") next = current;
        if (Number.isFinite(next)) {
          nextCandidates.add(next);
          if (resource.minimum !== null && next < resource.minimum) {
            issues.push(`资源 ${resource.key} 在 ${delta.chapterKey} 可能低于 minimum=${resource.minimum}`);
          }
          if (resource.maximum !== null && next > resource.maximum) {
            issues.push(`资源 ${resource.key} 在 ${delta.chapterKey} 可能高于 maximum=${resource.maximum}`);
          }
        }
      }
      candidates = new Set([...nextCandidates].slice(0, 64));
    }
    reachableResourceValues.set(resource.key, candidates);
  }

  const reachableEvidenceValues = new Map();
  for (const evidence of outline.evidenceGraph.evidence) {
    const values = new Set(["available"]);
    for (const effect of evidenceEffectsByKey.get(evidence.key) || []) values.add(effect.value);
    reachableEvidenceValues.set(evidence.key, values);
  }

  for (const [stateKey, reads] of stateReadsByKey.entries()) {
    const state = outline.endingLogic.stateVariables.find((item) => item.key === stateKey);
    const writes = stateWritesByKey.get(stateKey) || [];
    for (const read of reads) {
      const readAt = chapterIndex(chapterKeys, read.chapterKey);
      const hasPriorWrite = writes.some((write) => chapterIndex(chapterKeys, write.chapterKey) < readAt);
      if (!hasPriorWrite && !hasScalarValue(state?.initialValue)) {
        issues.push(`${read.chapterKey} 读取状态 ${stateKey}，但此前没有写入且没有 initialValue`);
      }
    }
  }

  const routeKeys = outline.endingLogic.routes.map((route) => route.key).filter(Boolean);
  if (duplicateValues(routeKeys).length) issues.push("endingLogic.routes key 重复");
  const priorities = outline.endingLogic.routes.map((route) => route.priority);
  if (new Set(priorities).size !== priorities.length) issues.push("endingLogic.routes priority 必须唯一，避免多路线同时命中时无法裁决");
  if (outline.endingLogic.conflictResolution !== "highest-priority") {
    issues.push("endingLogic.conflictResolution 必须明确为 highest-priority");
  }
  const defaultRoutes = outline.endingLogic.routes.filter((route) => route.isDefault);
  if (defaultRoutes.length !== 1) issues.push("endingLogic.routes 必须恰好有一条 isDefault=true 的默认路线");
  if (defaultRoutes[0] && outline.endingLogic.defaultRouteKey !== defaultRoutes[0].key) {
    issues.push("endingLogic.defaultRouteKey 必须指向 isDefault=true 的路线");
  }
  if (outline.endingLogic.routes.length < 2) issues.push("endingLogic.routes 至少需要两个由累计状态导出的结局");
  const routeSignatures = new Set();
  const endingTargetKeys = {
    state: new Set(),
    resource: new Set(),
    evidence: new Set()
  };
  const knownEndingTargets = {
    state: stateKeys,
    resource: resourceKeys,
    evidence: evidenceKeys
  };
  const reachableEndingValues = {
    state: reachableStateValues,
    resource: reachableResourceValues,
    evidence: reachableEvidenceValues
  };
  const contractedEndingTitleTokens = list(generationContract.endingTitleTokens)
    .map((token) => text(token, 120))
    .filter(Boolean);
  const branchSnapshots = isV24 ? enumerateBranchSnapshots(outline, chapterKeys) : [];
  for (const [index, route] of outline.endingLogic.routes.entries()) {
    requireText(route.key, `routes[${index}].key`, issues);
    requireText(route.title, `routes[${index}].title`, issues);
    requireText(route.consequence, `routes[${index}].consequence`, issues, 12);
    if (INTERNAL_NARRATIVE_LANGUAGE.test(route.title) || INTERNAL_NARRATIVE_LANGUAGE.test(route.consequence)) {
      issues.push(`routes[${index}] 的标题与结局内容必须使用世界内语言，不能暴露内部 key`);
    }
    if (GENERIC_ENDING_TITLE.test(route.title)) {
      issues.push(`routes[${index}].title“${route.title}”是批量模板结局名`);
    }
    const requiredTitleToken = contractedEndingTitleTokens[index];
    if (requiredTitleToken && !route.title.includes(requiredTitleToken)) {
      issues.push(`routes[${index}].title 必须包含生成前分配的独占词“${requiredTitleToken}”`);
    }
    if (route.priority < 0) issues.push(`routes[${index}].priority 不能为负数`);
    if (route.isDefault) {
      if (route.requirements.length) issues.push(`routes[${index}] 是默认路线，不应再设置 requirements`);
      continue;
    }
    if (isV24) {
      requireKnownRefs(route.preconditionFactKeys, factKeys, `routes[${index}].preconditionFactKeys`, issues, 0);
      requireKnownRefs(route.preconditionRuleKeys, worldRuleKeys, `routes[${index}].preconditionRuleKeys`, issues, 0);
      if (!route.preconditionFactKeys.length && !route.preconditionRuleKeys.length) {
        issues.push(`routes[${index}] 必须引用至少一条事实或世界规则作为结局资格依据`);
      }
      for (const factKey of route.preconditionFactKeys) {
        const fact = outline.semanticConstitution.facts.find((entry) => entry.key === factKey);
        if (fact && fact.truthValue !== true) issues.push(`routes[${index}] 把 truthValue=false 的事实 ${factKey} 当作已成立前置条件`);
      }
      for (const ruleKey of route.preconditionRuleKeys) {
        const rule = outline.semanticConstitution.worldRules.find((entry) => entry.key === ruleKey);
        for (const precondition of rule?.preconditions || []) {
          if (precondition.targetType === "fact") {
            if (!route.preconditionFactKeys.includes(precondition.targetKey)) issues.push(`routes[${index}] 引用规则 ${ruleKey}，但未携带其事实前置条件 ${precondition.targetKey}`);
            continue;
          }
          const covered = route.requirements.some((requirement) => (
            requirement.targetType === precondition.targetType
            && requirement.targetKey === precondition.targetKey
            && requirement.operator === precondition.operator
            && stateValueSignature(requirement.value) === stateValueSignature(precondition.value)
          ));
          if (!covered) issues.push(`routes[${index}] 引用规则 ${ruleKey}，但遗漏前置条件 ${precondition.targetType}:${precondition.targetKey} ${precondition.operator} ${String(precondition.value)}`);
        }
      }
    }
    if (route.requirementMode !== "all") issues.push(`routes[${index}].requirementMode 必须为 all，明确条件使用 AND`);
    const minimumRequirements = chapterKeys.length >= 3 ? 2 : 1;
    if (route.requirements.length < minimumRequirements) {
      issues.push(`routes[${index}] 至少需要 ${minimumRequirements} 个来自不同章节的累计状态、资源或证据条件`);
    }
    const requirementChapters = new Set();
    const requirementsByTarget = new Map();
    for (const requirement of route.requirements) {
      if (!REQUIREMENT_TARGET_TYPES.has(requirement.targetType)) {
        issues.push(`routes[${index}] 的 targetType 必须为 state/resource/evidence`);
      }
      const knownTargets = knownEndingTargets[requirement.targetType] || new Set();
      if (!knownTargets.has(requirement.targetKey)) {
        issues.push(`routes[${index}] 引用未知 ${requirement.targetType}：${requirement.targetKey}`);
      }
      if (requirement.targetType === "state") {
        const state = outline.endingLogic.stateVariables.find((item) => item.key === requirement.targetKey);
        if (state?.setInChapterKey) requirementChapters.add(state.setInChapterKey);
        if (state?.valueType === "number" && typeof requirement.value !== "number") {
          issues.push(`routes[${index}] 对数值状态 ${state.key} 的条件值必须是 JSON 数字`);
        }
        if (state?.valueType !== "number" && ["gte", "lte"].includes(requirement.operator)) {
          issues.push(`routes[${index}] 对 ${state?.valueType || "未知"} 状态 ${requirement.targetKey} 不能使用 ${requirement.operator}`);
        }
        if (state?.valueType === "boolean" && typeof requirement.value !== "boolean") {
          issues.push(`routes[${index}] 对布尔状态 ${state.key} 的条件值必须是 true/false`);
        }
        if (state?.valueType === "enum" && !state.allowedValues.includes(requirement.value)) {
          issues.push(`routes[${index}] 使用了枚举状态 ${state.key} 未声明的值：${String(requirement.value)}`);
        }
        if (isV23Plus && state?.valueType === "enum" && requirement.operator === "equals") {
          const semantic = state.valueSemantics.find((entry) => entry.value === requirement.value);
          for (const incompatibleClaim of semantic?.incompatibleClaims || []) {
            if (incompatibleClaim && route.consequence.includes(incompatibleClaim)) {
              issues.push(`routes[${index}] 的条件 ${state.key}=${String(requirement.value)} 与结局内容“${incompatibleClaim}”语义冲突`);
            }
          }
          const positivePropulsionValue = /(?:unlocked|released|available|开放|释放|可用|解锁)/iu.test(String(requirement.value));
          if (positivePropulsionValue
            && /(?:propulsion|fuel|return|推进|燃料|返航)/iu.test(`${state.key} ${state.meaning}`)
            && /(?:燃料被摧毁|无法返航|推进剂.{0,12}(?:摧毁|不可用)|fuel.{0,12}destroyed)/iu.test(route.consequence)) {
            issues.push(`routes[${index}] 宣告推进/燃料可用，却在结局内容中写成燃料毁坏或无法返航`);
          }
        }
      }
      if (requirement.targetType === "resource") {
        if (typeof requirement.value !== "number") {
          issues.push(`routes[${index}] 对资源 ${requirement.targetKey} 的条件值必须是 JSON 数字`);
        }
        for (const delta of resourceDeltasByKey.get(requirement.targetKey) || []) requirementChapters.add(delta.chapterKey);
      }
      if (requirement.targetType === "evidence") {
        const evidence = evidenceByKey.get(requirement.targetKey);
        if (evidence?.availableChapterKey) requirementChapters.add(evidence.availableChapterKey);
        for (const effect of evidenceEffectsByKey.get(requirement.targetKey) || []) requirementChapters.add(effect.chapterKey);
      }
      if (endingTargetKeys[requirement.targetType] && requirement.targetKey) {
        endingTargetKeys[requirement.targetType].add(requirement.targetKey);
      }
      if (!hasScalarValue(requirement.value)) issues.push(`routes[${index}].requirements.value 缺失`);
      const values = reachableEndingValues[requirement.targetType]?.get(requirement.targetKey) || new Set();
      const comparableValues = new Set([...values].map((value) => String(value)));
      let reachable = true;
      if (requirement.operator === "equals") reachable = comparableValues.has(String(requirement.value));
      if (requirement.operator === "not_equals") reachable = [...comparableValues].some((value) => value !== String(requirement.value));
      if (requirement.operator === "includes") reachable = [...comparableValues].some((value) => value.includes(requirement.value));
      if (["gte", "lte"].includes(requirement.operator)) {
        const target = Number(requirement.value);
        reachable = Number.isFinite(target) && [...values].some((value) => {
          const candidate = Number(value);
          return Number.isFinite(candidate) && (requirement.operator === "gte" ? candidate >= target : candidate <= target);
        });
      }
      if (!reachable) issues.push(`routes[${index}] 存在不可达条件：${requirement.targetType}:${requirement.targetKey} ${requirement.operator} ${requirement.value}`);
      const targetId = `${requirement.targetType}:${requirement.targetKey}`;
      const grouped = requirementsByTarget.get(targetId) || [];
      grouped.push(requirement);
      requirementsByTarget.set(targetId, grouped);
    }
    for (const [targetId, requirements] of requirementsByTarget.entries()) {
      const equalsValues = uniqueScalars(requirements.filter((item) => item.operator === "equals").map((item) => item.value));
      const excludedValues = new Set(requirements.filter((item) => item.operator === "not_equals").map((item) => item.value));
      const lowerBounds = requirements.filter((item) => item.operator === "gte").map((item) => Number(item.value)).filter(Number.isFinite);
      const upperBounds = requirements.filter((item) => item.operator === "lte").map((item) => Number(item.value)).filter(Number.isFinite);
      if (equalsValues.length > 1 || (equalsValues.length === 1 && excludedValues.has(equalsValues[0]))) {
        issues.push(`routes[${index}] 对 ${targetId} 设置了互相冲突的 AND 条件，路线不可达`);
      }
      if (lowerBounds.length && upperBounds.length && Math.max(...lowerBounds) > Math.min(...upperBounds)) {
        issues.push(`routes[${index}] 对 ${targetId} 的数值区间互相冲突，路线不可达`);
      }
    }
    if (isV24) {
      const routeReachableOnSinglePath = branchSnapshots.some((snapshot) => (
        route.requirements.every((requirement) => {
          const collection = requirement.targetType === "state"
            ? snapshot.states
            : requirement.targetType === "resource"
              ? snapshot.resources
              : snapshot.evidence;
          return requirementSatisfied(collection?.[requirement.targetKey], requirement.operator, requirement.value);
        })
        && route.preconditionRuleKeys.every((ruleKey) => snapshot.events[`world-rule:${ruleKey}`] === true)
      ));
      if (!routeReachableOnSinglePath) issues.push(`routes[${index}] 的条件虽然可能分别出现，但不存在同一条分支路径同时满足全部条件`);
    }
    if (requirementChapters.size < Math.min(minimumRequirements, route.requirements.length)) {
      issues.push(`routes[${index}] 的累计条件没有跨越足够多的章节`);
    }
    if (chapterKeys.length >= 4) {
      const finalIndex = chapterKeys.length - 1;
      const split = Math.floor(finalIndex / 2);
      const indexes = [...requirementChapters].map((key) => chapterIndex(chapterKeys, key));
      if (!indexes.some((value) => value >= 0 && value < split)) issues.push(`routes[${index}] 缺少前半段累计条件`);
      if (!indexes.some((value) => value >= split && value < finalIndex)) issues.push(`routes[${index}] 缺少后半段且最终章之前的累计条件`);
    }
    const signature = route.requirements
      .map((requirement) => `${requirement.targetType}:${requirement.targetKey}:${requirement.operator}:${requirement.value}`)
      .sort()
      .join("|");
    if (routeSignatures.has(signature)) issues.push(`routes[${index}] 与另一条路线条件完全相同，属于重复或同时命中路线`);
    routeSignatures.add(signature);
  }

  for (const resource of outline.resources) {
    const useChapters = new Set((resourceDeltasByKey.get(resource.key) || []).map((delta) => delta.chapterKey));
    const resourcePolicy = list(generationContract.resourcePolicies).find((policy) => text(policy?.resourceKey, 80) === resource.key);
    const minimumUseChapters = isV24
      ? Math.max(1, Number(resourcePolicy?.minimumOptionalUses) || 1)
      : (chapterKeys.length >= 5 ? 3 : Math.min(2, chapterKeys.length));
    if (useChapters.size < minimumUseChapters) {
      issues.push(`资源 ${resource.key} 只在 ${useChapters.size} 个章节产生实际变化；若不能影响至少 ${minimumUseChapters} 次关键抉择，应删除或并入状态`);
    }
    if (!endingTargetKeys.resource.has(resource.key)) {
      issues.push(`资源 ${resource.key} 未被任何结局条件读取，属于装饰性数值`);
    }
    if (isV24 && resourcePolicy) {
      if (text(resourcePolicy.placement, 120) !== "chapterBeats.decision.options.effects") {
        issues.push(`资源 ${resource.key} 的 resourcePolicies.placement 必须为 chapterBeats.decision.options.effects`);
      }
      const publicUseCount = outline.chapterBeats.reduce((sum, beat) => sum + beat.resourceDeltas.filter((delta) => delta.resourceKey === resource.key).length, 0);
      const maximumMandatoryUses = Math.max(0, Number(resourcePolicy.maximumMandatoryUses) || 0);
      if (publicUseCount > maximumMandatoryUses) issues.push(`资源 ${resource.key} 只允许 ${maximumMandatoryUses} 次公共必然变化，实际为 ${publicUseCount} 次；应挂在具体玩家选项 effects 下`);
      const optionUseChapters = new Set();
      for (const beat of outline.chapterBeats) {
        const optionCosts = beat.decision.options.map((option) => option.effects.some((effect) => effect.targetType === "resource" && effect.targetKey === resource.key));
        if (optionCosts.some(Boolean)) {
          optionUseChapters.add(beat.chapterKey);
          if (optionCosts.every(Boolean)) issues.push(`${beat.chapterKey} 的所有选项都强制改变资源 ${resource.key}，玩家没有真正的保留路径`);
        }
      }
      if (optionUseChapters.size < minimumUseChapters) issues.push(`资源 ${resource.key} 至少需要在 ${minimumUseChapters} 个不同章节作为可选效果出现`);
      const prescribedUseChapters = list(resourcePolicy.optionalUseChapterKeys).map((chapterKey) => text(chapterKey, 80)).filter(Boolean);
      for (const chapterKey of prescribedUseChapters) {
        if (!optionUseChapters.has(chapterKey)) issues.push(`资源 ${resource.key} 必须在合同指定的 ${chapterKey} 作为可选效果出现`);
      }
    }
  }

  if (isV24 && list(generationContract.resourceUsagePlans).length) {
    issues.push("V2.4 禁止继续使用 resourceUsagePlans 公共必扣合同；请改用 resourcePolicies 与 decision.options[].effects");
  }
  for (const [planIndex, rawPlan] of (isV24 ? [] : list(generationContract.resourceUsagePlans)).entries()) {
    const plan = object(rawPlan);
    const resourceKey = text(plan.resourceKey, 80);
    const expectedChapterKeys = list(plan.chapterKeys).map((chapterKey) => text(chapterKey, 80)).filter(Boolean);
    const expectedOperation = text(plan.operation, 20);
    const expectedAmount = typeof plan.amount === "number" ? plan.amount : Number(plan.amount);
    const publicDeltas = outline.chapterBeats.flatMap((beat) => beat.resourceDeltas
      .filter((delta) => delta.resourceKey === resourceKey)
      .map((delta) => ({ ...delta, chapterKey: beat.chapterKey })));
    const failDeltas = outline.chapterBeats.flatMap((beat) => beat.onReadFail.additionalCosts
      .filter((delta) => delta.resourceKey === resourceKey)
      .map((delta) => ({ ...delta, chapterKey: beat.chapterKey })));
    const actualChapterKeys = publicDeltas.map((delta) => delta.chapterKey);
    if (JSON.stringify(actualChapterKeys) !== JSON.stringify(expectedChapterKeys)) {
      issues.push(`resourceUsagePlans[${planIndex}] 要求 ${resourceKey} 只在 ${expectedChapterKeys.join("、")} 的公共效果变化，实际为 ${actualChapterKeys.join("、") || "无"}`);
    }
    if (publicDeltas.some((delta) => delta.operation !== expectedOperation || delta.amount !== expectedAmount)) {
      issues.push(`resourceUsagePlans[${planIndex}] 要求 ${resourceKey} 每次 ${expectedOperation} ${expectedAmount}`);
    }
    if (failDeltas.length) {
      issues.push(`resourceUsagePlans[${planIndex}] 已把 ${resourceKey} 安排在公共效果，失败分支不得再次扣减`);
    }
  }

  if (chapterKeys.length >= 4) {
    const multiWriteState = [...stateWritesByKey.values()].some((writes) => new Set(writes.map((write) => write.chapterKey)).size >= 2);
    const multiWriteResource = [...resourceDeltasByKey.values()].some((deltas) => new Set(deltas.map((delta) => delta.chapterKey)).size >= 2);
    if (!multiWriteState && !multiWriteResource) issues.push("至少一个资源、关系或权限状态必须在不同章节被多次更新，而不是只赋值一次");
  }
  const consumedDecisionKeys = [...decisionStateKeys].filter((key) => endingTargetKeys.state.has(key) || (stateReadsByKey.get(key) || []).length);
  if (decisionStateKeys.size && consumedDecisionKeys.length / decisionStateKeys.size < 0.6) {
    issues.push("超过 40% 的章节决策状态从未被后续章节或结局读取，属于假累计");
  }

  for (const [index, beat] of outline.chapterBeats.entries()) {
    if (index >= outline.chapterBeats.length - 1) continue;
    const writeKeys = unique([
      ...beat.stateWrites.map((write) => write.stateKey),
      ...beat.onReadFail.stateWrites.map((write) => write.stateKey),
      beat.decision.stateKey
    ]);
    const downstreamStateEffect = writeKeys.some((key) => (
      endingTargetKeys.state.has(key)
      || (stateReadsByKey.get(key) || []).some((read) => chapterIndex(chapterKeys, read.chapterKey) > index)
    ));
    const futureEvidenceEffect = [
      ...beat.unlocksEvidenceKeys,
      ...beat.locksEvidenceKeys,
      ...beat.onReadFail.unlocksEvidenceKeys,
      ...beat.onReadFail.locksEvidenceKeys
    ].some((key) => {
      const evidence = evidenceByKey.get(key);
      return evidence && chapterIndex(chapterKeys, evidence.availableChapterKey) > index;
    });
    const downstreamResourceEffect = [...beat.resourceDeltas, ...beat.onReadFail.additionalCosts].some((delta) => (
      endingTargetKeys.resource.has(delta.resourceKey)
      || (resourceDeltasByKey.get(delta.resourceKey) || []).some((row) => chapterIndex(chapterKeys, row.chapterKey) > index)
    ));
    if (!downstreamStateEffect && !futureEvidenceEffect && !downstreamResourceEffect) {
      issues.push(`chapterBeats[${index}] 的结构化后果没有任何下游读取、证据开关或资源变化`);
    }
  }

  const spotlightByChapter = new Map();
  for (const player of outline.players) {
    const rows = spotlightByChapter.get(player.spotlightChapterKey) || [];
    rows.push(player.key);
    spotlightByChapter.set(player.spotlightChapterKey, rows);
  }
  const minimumSpotlightChapters = Math.min(
    chapterKeys.length,
    chapterKeys.length >= 5 ? 4 : Math.max(1, Math.ceil(outline.players.length / 2))
  );
  if (spotlightByChapter.size < minimumSpotlightChapters) {
    issues.push(`聚光章至少应分布在 ${minimumSpotlightChapters} 个不同章节，当前只有 ${spotlightByChapter.size} 个`);
  }
  for (const [chapterKey, roleKeys] of spotlightByChapter.entries()) {
    const beat = outline.chapterBeats.find((entry) => entry.chapterKey === chapterKey);
    if (roleKeys.length > 3) issues.push(`${chapterKey} 同时安排 ${roleKeys.length} 名核心聚光玩家，章节转折过载`);
    if (roleKeys.length > 2) {
      requireText(beat?.sharedSpotlightConflict, `${chapterKey}.sharedSpotlightConflict`, issues, 16);
    }
  }

  const criticalSupportKeys = new Set([
    ...outline.hookPromises.flatMap((promise) => promise.supportKeys),
    ...outline.evidenceGraph.conclusions.flatMap((conclusion) => conclusion.evidenceKeys),
    ...endingTargetKeys.state,
    ...endingTargetKeys.resource,
    ...endingTargetKeys.evidence
  ]);

  for (const player of outline.players) {
    const label = player.name || player.key;
    const contractedInfluence = list(generationContract.roleEndingInfluences)
      .find((entry) => entry?.roleKey === player.key);
    if (contractedInfluence) {
      const influenceAction = player.chapterActions.find((action) => action.chapterKey === contractedInfluence.chapterKey);
      if (!influenceAction) {
        issues.push(`${label} 必须在 ${contractedInfluence.chapterKey} 执行影响 ${contractedInfluence.stateKey} 的行动`);
      } else if (contractedInfluence.influenceMode === "direct"
        && !influenceAction.stateWriteKeys.includes(contractedInfluence.stateKey)) {
        issues.push(`${label} 的直接影响合同要求在 ${contractedInfluence.chapterKey} 写入 ${contractedInfluence.stateKey}`);
      } else if (contractedInfluence.influenceMode !== "direct") {
        const causalAnchorKey = text(contractedInfluence.causalAnchorKey, 80);
        const hasDeclaredAnchor = causalAnchorKey
          ? influenceAction.stateWriteKeys.includes(causalAnchorKey)
            || influenceAction.resourceKeys.includes(causalAnchorKey)
            || influenceAction.evidenceEffectKeys.includes(causalAnchorKey)
            || influenceAction.eventKeys.includes(causalAnchorKey)
            || influenceAction.evidenceKeys.includes(causalAnchorKey)
          : false;
        const hasCausalAnchor = hasDeclaredAnchor || (!causalAnchorKey && (
          influenceAction.stateWriteKeys.includes(contractedInfluence.stateKey)
          || influenceAction.resourceKeys.length > 0
          || influenceAction.evidenceEffectKeys.length > 0
          || influenceAction.eventKeys.some((eventKey) => branchEventKeys.has(eventKey))
          || influenceAction.evidenceKeys.some((evidenceKey) => criticalSupportKeys.has(evidenceKey))
        ));
        if (!hasCausalAnchor) {
          issues.push(`${label} 在 ${contractedInfluence.chapterKey} 的行动没有使用因果锚点 ${causalAnchorKey || contractedInfluence.stateKey}`);
        }
      }
    }
    if (!player.contribution.anchorKeys.some((key) => criticalSupportKeys.has(key))) {
      issues.push(`${label} 的贡献锚点未进入高概念兑现、核心结论或累计结局`);
    }
    for (const chapterKey of player.contribution.turnChapterKeys) {
      const beat = outline.chapterBeats.find((entry) => entry.chapterKey === chapterKey);
      if (!beat?.triggerRoleKeys.includes(player.key)) issues.push(`${label} 声称触发 ${chapterKey}，但未出现在该章 triggerRoleKeys`);
    }
    let changesStructure = false;
    let changesOtherRole = false;
    let reachesEnding = false;
    for (const action of player.chapterActions) {
      actionCorpus.push(action.action);
      for (const stateKey of action.stateWriteKeys) {
        if (!stateKeys.has(stateKey)) issues.push(`${label}.${action.chapterKey}.stateWriteKeys 引用未知状态：${stateKey}`);
        const writtenInChapter = (stateWritesByKey.get(stateKey) || []).some((write) => write.chapterKey === action.chapterKey);
        if (!writtenInChapter) issues.push(`${label}.${action.chapterKey} 声称写入 ${stateKey}，但该章公共因果没有对应写入`);
        if (writtenInChapter) {
          changesStructure = true;
          if (endingTargetKeys.state.has(stateKey)) reachesEnding = true;
        }
      }
      for (const resourceKey of action.resourceKeys) {
        const changedInChapter = (resourceDeltasByKey.get(resourceKey) || []).some((delta) => delta.chapterKey === action.chapterKey);
        if (!changedInChapter) issues.push(`${label}.${action.chapterKey} 声称改变资源 ${resourceKey}，但该章没有对应 resourceDeltas`);
        if (changedInChapter) {
          changesStructure = true;
          if (endingTargetKeys.resource.has(resourceKey)) reachesEnding = true;
        }
      }
      for (const evidenceKey of action.evidenceEffectKeys) {
        const changedInChapter = (evidenceEffectsByKey.get(evidenceKey) || []).some((effect) => effect.chapterKey === action.chapterKey);
        if (!changedInChapter) issues.push(`${label}.${action.chapterKey} 声称控制证据 ${evidenceKey}，但该章没有对应锁定或解锁`);
        if (changedInChapter) {
          changesStructure = true;
          if (endingTargetKeys.evidence.has(evidenceKey)) reachesEnding = true;
        }
      }
      for (const eventKey of action.eventKeys) {
        const changedInChapter = (eventEffectsByKey.get(eventKey) || []).some((effect) => effect.chapterKey === action.chapterKey);
        if (changedInChapter) changesStructure = true;
      }
      if (action.evidenceKeys.some((evidenceKey) => criticalSupportKeys.has(evidenceKey))) {
        changesStructure = true;
        reachesEnding = true;
      }
      if (action.affectsRoleKeys.some((roleKey) => roleKey !== player.key)) changesOtherRole = true;
    }
    if (!changesStructure) issues.push(`${label} 虽有行动，但从未改变任何登记状态、资源或证据开关`);
    if (!changesOtherRole) issues.push(`${label} 的行动从未改变其他玩家的资源或选择`);
    if (!reachesEnding) {
      issues.push(`${label} 的行动结果没有形成通往结局条件的因果路径；不要求独占结局变量，但必须影响被结局读取的状态、资源或证据`);
    }
  }

  const ownedCoreEvidenceCounts = new Map();
  for (const entry of outline.evidenceGraph.evidence) {
    if (!entry.sourceOwnerRoleKey || !entry.supportsConclusionKeys.length) continue;
    ownedCoreEvidenceCounts.set(entry.sourceOwnerRoleKey, (ownedCoreEvidenceCounts.get(entry.sourceOwnerRoleKey) || 0) + 1);
  }
  const totalOwnedCoreEvidence = [...ownedCoreEvidenceCounts.values()].reduce((sum, value) => sum + value, 0);
  if (totalOwnedCoreEvidence >= outline.players.length && outline.players.length >= 4) {
    const dominant = [...ownedCoreEvidenceCounts.entries()].find(([, count]) => count / totalOwnedCoreEvidence > 0.5);
    if (dominant) issues.push(`角色贡献失衡：${dominant[0]} 掌握超过一半由玩家持有的核心证据`);
  }

  const actionSignatures = new Map();
  for (const action of actionCorpus) {
    const signature = normalizedAction(action);
    if (!signature) continue;
    actionSignatures.set(signature, (actionSignatures.get(signature) || 0) + 1);
  }
  const repeatedAction = [...actionSignatures.entries()].find(([, count]) => count >= Math.max(3, Math.ceil(actionCorpus.length * 0.25)));
  if (repeatedAction) issues.push(`存在批量填充式泛化行动：同类行动在本篇出现 ${repeatedAction[1]} 次`);
  let nearDuplicateActionPairs = 0;
  for (let left = 0; left < actionCorpus.length; left += 1) {
    for (let right = left + 1; right < actionCorpus.length; right += 1) {
      if (fingerprintSimilarity(actionCorpus[left], actionCorpus[right]) >= 0.86) nearDuplicateActionPairs += 1;
    }
  }
  if (actionCorpus.length >= 6 && nearDuplicateActionPairs >= Math.ceil(actionCorpus.length * 0.35)) {
    issues.push(`存在语义模板化行动：${nearDuplicateActionPairs} 组行动仅更换对象或角色名`);
  }

  for (const field of BATCH_FINGERPRINT_FIELDS) {
    requireText(outline.batchFingerprint[field], `batchFingerprint.${field}`, issues, 6);
    if (GENERIC_FINGERPRINT.test(outline.batchFingerprint[field])) issues.push(`batchFingerprint.${field} 仍是批量生成泛化模板：${outline.batchFingerprint[field]}`);
  }
  for (const field of BATCH_FINGERPRINT_FIELDS) {
    const maximumLength = field === "themeExpression" ? 240 : 180;
    const expected = text(generationContract[field], maximumLength);
    if (expected && outline.batchFingerprint[field] !== expected) {
      issues.push(`batchFingerprint.${field} 必须逐字使用生成前批次合同，避免并发生成后再做语义去重`);
    }
  }
  if (GENERIC_CAUSAL_SEQUENCE.test(outline.batchFingerprint.chapterCausalPattern)) {
    issues.push("batchFingerprint.chapterCausalPattern 仍是“发现—质疑—承认—锁定—投票”的通用五段式");
  }

  const unresolvedText = JSON.stringify(outline);
  if (isV23Plus) {
    for (const invariant of list(generationContract.semanticInvariants)) {
      const invariantKey = text(invariant?.key, 80) || "unnamed-invariant";
      for (const patternText of list(invariant?.requiredPatterns)) {
        try {
          if (!new RegExp(patternText, "iu").test(unresolvedText)) {
            issues.push(`语义不变量 ${invariantKey} 缺少必须出现的世界内事实：/${patternText}/`);
          }
        } catch {
          issues.push(`语义不变量 ${invariantKey} 的 requiredPatterns 不是有效正则：${patternText}`);
        }
      }
      for (const patternText of list(invariant?.forbiddenPatterns)) {
        try {
          if (new RegExp(patternText, "iu").test(unresolvedText)) {
            issues.push(`语义不变量 ${invariantKey} 命中禁止矛盾：/${patternText}/`);
          }
        } catch {
          issues.push(`语义不变量 ${invariantKey} 的 forbiddenPatterns 不是有效正则：${patternText}`);
        }
      }
    }
  }
  if (UNRESOLVED_LOGIC.test(unresolvedText)) issues.push("存在未决或互相矛盾的真相表述");

  const finalEvidence = outline.evidenceGraph.evidence.filter((entry) => entry.availableChapterKey === finalChapterKey);
  for (const entry of finalEvidence) {
    if (conclusionKeys.size > 1 && new Set(entry.supportsConclusionKeys).size >= conclusionKeys.size) {
      issues.push(`最终章证据“${entry.label || entry.key}”一次性解释全部核心结论，前序推理会失效`);
    }
  }

  if (issues.length) invalid(issues, outline.outlineRevision);

  const deliveredOutline = structuredClone(outline);
  if (isV23Plus) {
    for (const beat of deliveredOutline.chapterBeats) {
      beat.decision.options = beat.decision.options.map((option) => ({
        key: option.key,
        choiceText: option.choiceText,
        sets: option.sets,
        effects: option.effects,
        immediateConsequence: option.immediateConsequence
      }));
    }
  }
  return {
    ...deliveredOutline,
    readiness: {
      strictValidated: true,
      structuralValidationPassed: true,
      contractFidelityPassed: true,
      antiGamingValidationPassed: isV23Plus,
      factConsistencyPassed: isV24,
      branchConsistencyPassed: isV24,
      provenanceIndependencePassed: isV24,
      responsibilityCompletenessPassed: isV24,
      domainPlausibilityPassed: isV24,
      worldRuleCompletenessPassed: isV24,
      readyForExpansion: true,
      protocol: `player-driven-outline-v${outline.outlineRevision}`,
      checks: {
        hookPayoff: true,
        completePlayerMatrix: true,
        playerCausedChapters: true,
        independentEvidence: true,
        cumulativeEndings: true,
        genreMechanic: true,
        logicConflict: true,
        concreteActions: true,
        roleContributionBalance: true,
        evidenceProvenance: true,
        stateCausality: true,
        endingReachability: true,
        genreAdaptiveCadence: true,
        semanticTemplateResistance: true,
        entityRegistry: true,
        resourceRegistry: true,
        chapterFallbackVariants: true,
        endingInfluencePaths: true,
        spotlightDistribution: true,
        playerEntityIdentitySeparation: true,
        typedStateOperations: true,
        nonDecorativeResources: true,
        operationalMechanicUse: true,
        perChapterStyleContract: true,
        batchContractFidelity: true,
        worldFacingChoiceLanguage: true,
        responsibilityTypeSeparation: isV23Plus,
        entitySemanticTyping: isV23Plus,
        semanticInvariants: isV23Plus,
        semanticConstitution: isV24,
        atomicStateDimensions: isV24,
        optionScopedEffects: isV24,
        branchJointReachability: isV24,
        provenanceFailureDomains: isV24,
        responsibilityEventDerivation: isV24,
        worldRulePreconditions: isV24,
        methodTargetCompatibility: isV24
      }
    }
  };
}

export { OUTLINE_REVISION, OUTLINE_VERSION } from "./outline-quality/constants.js";

export { fingerprintSimilarity, scoreOutlineFingerprintPair, validateOutlineBatchDiversity } from "./outline-quality/batch-diversity.js";
