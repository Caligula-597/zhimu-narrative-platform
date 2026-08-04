import { cleanText } from "../../../prompts/shared.js";
import {
  INTERNAL_NARRATIVE_LANGUAGE,
  OPTION_EFFECT_OPERATIONS,
  OPTION_EFFECT_TARGET_TYPES,
  RESOURCE_OWNER_TYPES,
  RESOURCE_VALUE_TYPES,
  isSourceTypeCompatible
} from "../../../story-outline-contract/vocabulary.js";

export function validateBlueprintSemanticEvidence(context) {
  const {
    brief,
    contract,
    entities,
    expectedRevision,
    isV23,
    isV23Plus,
    isV24,
    issues,
    normalizedName,
    players,
    routes,
    spec,
    states,
    value
  } = context;
  const { playerKeys, playerNames, resourceKeys, stateKeys } = context.registries;

  const entityKeys = new Set(entities.map((entity) => cleanText(entity?.key, 80)).filter(Boolean));
  const evidence = Array.isArray(value.evidenceGraph?.evidence) ? value.evidenceGraph.evidence : [];
  const conclusions = Array.isArray(value.evidenceGraph?.conclusions) ? value.evidenceGraph.conclusions : [];
  const evidenceKeys = new Set(evidence.map((entry) => cleanText(entry?.key, 80)).filter(Boolean));
  const stateKeySet = new Set(stateKeys.filter(Boolean));
  const resourceKeySet = new Set(resourceKeys.filter(Boolean));
  const supportKeys = new Set([...evidenceKeys, ...stateKeySet, ...resourceKeySet, ...entityKeys]);
  if (isV24) {
    const constitution = value.semanticConstitution && typeof value.semanticConstitution === "object" ? value.semanticConstitution : {};
    const stateDefinitionByKey = new Map(states.map((state) => [cleanText(state?.key, 80), state]));
    const facts = Array.isArray(constitution.facts) ? constitution.facts : [];
    const grants = Array.isArray(constitution.authorizationGrants) ? constitution.authorizationGrants : [];
    const branchEvents = Array.isArray(constitution.branchEvents) ? constitution.branchEvents : [];
    const rules = Array.isArray(constitution.worldRules) ? constitution.worldRules : [];
    const timelineKeys = new Set((Array.isArray(value.causalTimeline) ? value.causalTimeline : []).map((event) => cleanText(event?.key, 80)).filter(Boolean));
    const factKeys = new Set(facts.map((fact) => cleanText(fact?.key, 80)).filter(Boolean));
    const grantKeys = new Set(grants.map((grant) => cleanText(grant?.key, 80)).filter(Boolean));
    const ruleKeys = new Set(rules.map((rule) => cleanText(rule?.key, 80)).filter(Boolean));
    if (facts.length < 3) issues.push("蓝图 V2.4 semanticConstitution.facts 至少需要三条锁定事实");
    if (!rules.length) issues.push("蓝图 V2.4 semanticConstitution.worldRules 至少需要一条世界规则");
    if (factKeys.size !== facts.length) issues.push("蓝图 semanticConstitution.facts key 缺失或重复");
    if (grantKeys.size !== grants.length) issues.push("蓝图 semanticConstitution.authorizationGrants key 缺失或重复");
    if (ruleKeys.size !== rules.length) issues.push("蓝图 semanticConstitution.worldRules key 缺失或重复");
    for (const [index, fact] of facts.entries()) {
      if (cleanText(fact?.key, 80).length < 2 || cleanText(fact?.subjectKey, 80).length < 2 || cleanText(fact?.predicate, 120).length < 2) issues.push(`蓝图 facts[${index}] 缺少 key/subjectKey/predicate`);
      if (!supportKeys.has(cleanText(fact?.subjectKey, 80)) && !playerKeys.has(cleanText(fact?.subjectKey, 80))) issues.push(`蓝图 facts[${index}].subjectKey 引用未知对象`);
      if (typeof fact?.truthValue !== "boolean") issues.push(`蓝图 facts[${index}].truthValue 必须为布尔值`);
      const hasObjectKey = cleanText(fact?.objectKey, 80).length > 0;
      const hasObjectValue = fact?.objectValue !== undefined && fact?.objectValue !== null && fact?.objectValue !== "";
      if (hasObjectKey === hasObjectValue) issues.push(`蓝图 facts[${index}] 必须且只能填写 objectKey 或 objectValue 之一`);
      if (hasObjectKey && !supportKeys.has(cleanText(fact?.objectKey, 80)) && !playerKeys.has(cleanText(fact?.objectKey, 80))) issues.push(`蓝图 facts[${index}].objectKey 引用未知对象`);
      if ((Array.isArray(fact?.evidenceKeys) ? fact.evidenceKeys : []).some((key) => !evidenceKeys.has(cleanText(key, 80)))) issues.push(`蓝图 facts[${index}].evidenceKeys 引用未知证据`);
      if (fact?.validFromEventKey && !timelineKeys.has(cleanText(fact.validFromEventKey, 80))) issues.push(`蓝图 facts[${index}].validFromEventKey 引用未知事件`);
      if (fact?.validToEventKey && !timelineKeys.has(cleanText(fact.validToEventKey, 80))) issues.push(`蓝图 facts[${index}].validToEventKey 引用未知事件`);
    }
    for (const [index, grant] of grants.entries()) {
      const allowed = Array.isArray(grant?.allowedPurposeKeys) ? grant.allowedPurposeKeys : [];
      const forbidden = Array.isArray(grant?.forbiddenPurposeKeys) ? grant.forbiddenPurposeKeys : [];
      if (!allowed.length) issues.push(`蓝图 authorizationGrants[${index}].allowedPurposeKeys 至少一项`);
      if (allowed.some((purpose) => forbidden.includes(purpose))) issues.push(`蓝图 authorizationGrants[${index}] 同时允许并禁止同一用途`);
      for (const field of ["grantorKey", "granteeKey", "assetKey"]) {
        const targetKey = cleanText(grant?.[field], 80);
        if (!playerKeys.has(targetKey) && !entityKeys.has(targetKey)) issues.push(`蓝图 authorizationGrants[${index}].${field} 必须引用已登记玩家或实体`);
      }
      const grantEvidenceKeys = Array.isArray(grant?.evidenceKeys) ? grant.evidenceKeys.map((key) => cleanText(key, 80)).filter(Boolean) : [];
      if (!grantEvidenceKeys.length) issues.push(`蓝图 authorizationGrants[${index}].evidenceKeys 至少需要 1 项`);
      if (grantEvidenceKeys.some((key) => !evidenceKeys.has(key))) issues.push(`蓝图 authorizationGrants[${index}].evidenceKeys 引用未知证据`);
      if (grant?.validFromEventKey && !timelineKeys.has(cleanText(grant.validFromEventKey, 80))) issues.push(`蓝图 authorizationGrants[${index}].validFromEventKey 引用未知事件`);
      if (grant?.validToEventKey && !timelineKeys.has(cleanText(grant.validToEventKey, 80))) issues.push(`蓝图 authorizationGrants[${index}].validToEventKey 引用未知事件`);
    }
    const branchEventKeys = new Set();
    for (const [index, branchEvent] of branchEvents.entries()) {
      const key = cleanText(branchEvent?.key, 80);
      if (key.length < 2 || branchEventKeys.has(key) || timelineKeys.has(key)) issues.push(`蓝图 branchEvents[${index}].key 缺失、重复或与既成事件冲突`);
      branchEventKeys.add(key);
      if (!spec.chapterKeys.includes(cleanText(branchEvent?.chapterKey, 80))) issues.push(`蓝图 branchEvents[${index}].chapterKey 必须引用真实章节`);
      if (cleanText(branchEvent?.description, 1000).length < 8) issues.push(`蓝图 branchEvents[${index}].description 缺失或过短`);
    }
    for (const [index, rule] of rules.entries()) {
      if (cleanText(rule?.key, 80).length < 2 || cleanText(rule?.statement, 1400).length < 20) issues.push(`蓝图 worldRules[${index}] 缺少稳定 key 或完整规则`);
      if (!spec.chapterKeys.includes(cleanText(rule?.evaluationChapterKey, 80))) issues.push(`蓝图 worldRules[${index}].evaluationChapterKey 必须引用真实章节`);
      if (!Array.isArray(rule?.auditEvidenceKeys) || !rule.auditEvidenceKeys.length) issues.push(`蓝图 worldRules[${index}].auditEvidenceKeys 至少需要一项`);
      if ((Array.isArray(rule?.auditEvidenceKeys) ? rule.auditEvidenceKeys : []).some((key) => !evidenceKeys.has(cleanText(key, 80)))) issues.push(`蓝图 worldRules[${index}].auditEvidenceKeys 引用未知证据`);
      if ((Array.isArray(rule?.triggerEventKeys) ? rule.triggerEventKeys : []).some((key) => !timelineKeys.has(cleanText(key, 80)) && !branchEventKeys.has(cleanText(key, 80)))) issues.push(`蓝图 worldRules[${index}].triggerEventKeys 引用未知事件`);
      if ((Array.isArray(rule?.authorizedActorKeys) ? rule.authorizedActorKeys : []).some((key) => !playerKeys.has(cleanText(key, 80)) && !entityKeys.has(cleanText(key, 80)))) issues.push(`蓝图 worldRules[${index}].authorizedActorKeys 引用未知行动者`);
      if (cleanText(rule?.failureMode, 1000).length < 12) issues.push(`蓝图 worldRules[${index}].failureMode 缺失或过短`);
      for (const [preconditionIndex, precondition] of (Array.isArray(rule?.preconditions) ? rule.preconditions : []).entries()) {
        const targetType = cleanText(precondition?.targetType, 20);
        const targetKey = cleanText(precondition?.targetKey, 80);
        const knownTargets = targetType === "fact" ? factKeys : targetType === "state" ? stateKeySet : targetType === "resource" ? resourceKeySet : targetType === "evidence" ? evidenceKeys : null;
        if (!knownTargets) issues.push(`蓝图 worldRules[${index}].preconditions[${preconditionIndex}].targetType 必须为 fact/state/resource/evidence`);
        else if (!knownTargets.has(targetKey)) issues.push(`蓝图 worldRules[${index}].preconditions[${preconditionIndex}].targetKey 引用未知 ${targetType}`);
      }
      for (const [effectIndex, effect] of (Array.isArray(rule?.effects) ? rule.effects : []).entries()) {
        const targetType = cleanText(effect?.targetType, 20);
        const targetKey = cleanText(effect?.targetKey, 80);
        const operation = cleanText(effect?.operation, 20);
        const knownTargets = targetType === "state"
          ? stateKeySet
          : targetType === "resource"
            ? resourceKeySet
            : targetType === "evidence"
              ? evidenceKeys
              : targetType === "event"
                ? branchEventKeys
                : null;
        if (!knownTargets) issues.push(`蓝图 worldRules[${index}].effects[${effectIndex}].targetType 必须为 state/resource/evidence/event`);
        else if (!knownTargets.has(targetKey)) issues.push(`蓝图 worldRules[${index}].effects[${effectIndex}].targetKey 引用未知 ${targetType}：${targetKey}`);
        if (targetType === "state" && stateDefinitionByKey.has(targetKey)) {
          const targetState = stateDefinitionByKey.get(targetKey);
          const evaluationIndex = spec.chapterKeys.indexOf(cleanText(rule?.evaluationChapterKey, 80));
          const setIndex = spec.chapterKeys.indexOf(cleanText(targetState?.setInChapterKey, 80));
          if (evaluationIndex >= 0 && setIndex >= 0 && evaluationIndex < setIndex) {
            issues.push(`蓝图 worldRules[${index}] 在 ${rule.evaluationChapterKey} 提前写入状态 ${targetKey}；该状态最早只能在 ${targetState.setInChapterKey} 写入`);
          }
          if (targetState?.controlMode !== "derived") {
            issues.push(`蓝图 worldRules[${index}].effects[${effectIndex}] 只能写 controlMode=derived 的状态；${targetKey} 是 ${targetState?.controlMode || "未声明"} 状态`);
          }
        }
        const allowedOperations = OPTION_EFFECT_TARGET_TYPES.has(targetType)
          ? OPTION_EFFECT_OPERATIONS[targetType]
          : null;
        if (allowedOperations && !allowedOperations.has(operation)) issues.push(`蓝图 worldRules[${index}].effects[${effectIndex}].operation 与 ${targetType} 不相容`);
        if (targetType === "evidence"
          && /(?:授权|赛果|条款|责任).{0,10}(?:被确认|认定为|已裁定|正式有效)/u.test(cleanText(effect?.consequence, 1000))) {
          issues.push(`蓝图 worldRules[${index}].effects[${effectIndex}] 效果语义冲突：解锁证据只能改变材料可用性，不能直接宣告授权、赛果、条款或责任已被裁定`);
        }
        if (cleanText(effect?.consequence, 1000).length < 8) issues.push(`蓝图 worldRules[${index}].effects[${effectIndex}].consequence 缺失或过短`);
      }
    }
    for (const [index, player] of players.entries()) {
      const secretFactKeys = Array.isArray(player?.secretFactKeys) ? player.secretFactKeys.map((key) => cleanText(key, 80)).filter(Boolean) : [];
      const authorizationGrantKeys = Array.isArray(player?.authorizationGrantKeys) ? player.authorizationGrantKeys.map((key) => cleanText(key, 80)).filter(Boolean) : [];
      if (!secretFactKeys.length || secretFactKeys.some((key) => !factKeys.has(key))) issues.push(`蓝图 players[${index}].secretFactKeys 必须引用至少一条已登记事实`);
      if (authorizationGrantKeys.some((key) => !grantKeys.has(key))) issues.push(`蓝图 players[${index}].authorizationGrantKeys 引用未知授权`);
    }
  }
  for (const [index, entity] of entities.entries()) {
    const candidates = [entity?.name, ...(Array.isArray(entity?.aliases) ? entity.aliases : [])]
      .map(normalizedName)
      .filter(Boolean);
    if (candidates.some((name) => playerNames.has(name))) {
      issues.push(`蓝图 entities[${index}] 与玩家同名；玩家不得再次登记为 NPC 或其他实体`);
    }
  }
  for (const [index, resource] of (Array.isArray(value.resources) ? value.resources : []).entries()) {
    if (!RESOURCE_VALUE_TYPES.has(resource?.valueType)) {
      issues.push(`蓝图 resources[${index}].valueType 必须为 integer 或 number`);
    }
    if (typeof resource?.initialValue !== "number"
      || typeof resource?.minimum !== "number"
      || typeof resource?.maximum !== "number") {
      issues.push(`蓝图 resources[${index}] 的 initialValue/minimum/maximum 必须是 JSON 数字`);
    }
    if (!RESOURCE_OWNER_TYPES.has(resource?.ownerType)) {
      issues.push(`蓝图 resources[${index}].ownerType 必须为 group/player/entity`);
    }
    if (resource?.minimum > resource?.maximum
      || resource?.initialValue < resource?.minimum
      || resource?.initialValue > resource?.maximum) {
      issues.push(`蓝图 resources[${index}] 的 initialValue 必须位于 minimum 与 maximum 之间`);
    }
    if (cleanText(resource?.meaning, 800).length < 8) issues.push(`蓝图 resources[${index}].meaning 缺失或过短`);
  }
  for (const [index, player] of players.entries()) {
    const type = cleanText(player?.contribution?.anchorType, 40);
    const allowedKeys = type === "evidence"
      ? evidenceKeys
      : type === "resource"
        ? resourceKeySet
        : type === "task"
          ? supportKeys
          : stateKeySet;
    const anchorKeys = Array.isArray(player?.contribution?.anchorKeys)
      ? player.contribution.anchorKeys.map((key) => cleanText(key, 80)).filter(Boolean)
      : [];
    if (!anchorKeys.length || anchorKeys.some((key) => !allowedKeys.has(key))) {
      issues.push(`蓝图 players[${index}].contribution.anchorKeys 未引用与 ${type || "未知"} 贡献类型匹配的已登记 key`);
    }
    if (!supportKeys.has(cleanText(player?.exclusiveAnchorKey, 80))) {
      issues.push(`蓝图 players[${index}].exclusiveAnchorKey 必须引用已登记的独占证据、状态、资源或实体 key`);
    }
  }
  const evidenceByKey = new Map(evidence.map((entry) => [cleanText(entry?.key, 80), entry]));
  if (contract.genreMode === "mystery") {
    if (evidence.length < 4) issues.push("蓝图 mystery 至少需要四条可操作证据；不要求给六名玩家机械地各分一条");
    if (conclusions.length !== 1) issues.push("蓝图 mystery 必须只保留一个聚合核心 conclusion");
    for (const [index, sourceType] of (contract.evidenceSourceTypes || []).entries()) {
      const evidenceEntry = evidenceByKey.get(`evidence-${index + 1}`);
      if (sourceType && cleanText(evidenceEntry?.sourceType, 80) !== sourceType) {
        issues.push(`蓝图 evidence-${index + 1}.sourceType 必须为 ${sourceType}`);
      }
      if (Array.isArray(evidenceEntry?.derivedFromEvidenceKeys) && evidenceEntry.derivedFromEvidenceKeys.length) {
        issues.push(`蓝图 evidence-${index + 1}.derivedFromEvidenceKeys 必须为空，确保它是独立原始来源`);
      }
    }
    for (const [index, provenanceGroup] of (contract.evidenceProvenanceGroups || []).entries()) {
      if (!entityKeys.has(provenanceGroup)) {
        issues.push(`蓝图必须在 entities 登记独立来源 ${provenanceGroup}`);
      }
      const evidenceEntry = evidenceByKey.get(`evidence-${index + 1}`);
      if (cleanText(evidenceEntry?.provenanceGroup, 80) !== provenanceGroup) {
        issues.push(`蓝图 evidence-${index + 1}.provenanceGroup 必须为 ${provenanceGroup}`);
      }
      const sourceType = contract.evidenceSourceTypes?.[index];
      if (sourceType && cleanText(evidenceEntry?.sourceType, 80) !== sourceType) {
        issues.push(`蓝图 evidence-${index + 1}.sourceType 必须为 ${sourceType}`);
      }
      if (Array.isArray(evidenceEntry?.derivedFromEvidenceKeys) && evidenceEntry.derivedFromEvidenceKeys.length) {
        issues.push(`蓝图 evidence-${index + 1}.derivedFromEvidenceKeys 必须为空，确保独立来源`);
      }
      const originActorKey = cleanText(evidenceEntry?.originActorKey, 80);
      if (originActorKey && originActorKey !== provenanceGroup) {
        issues.push(`蓝图 evidence-${index + 1}.originActorKey 应留空或使用独立来源 ${provenanceGroup}`);
      }
    }
  }
  const evidenceRoots = (key, visiting = new Set()) => {
    const normalizedKey = cleanText(key, 80);
    if (!normalizedKey || visiting.has(normalizedKey)) return new Set();
    const entry = evidenceByKey.get(normalizedKey);
    if (!entry) return new Set();
    const nextVisiting = new Set(visiting).add(normalizedKey);
    const derivedKeys = Array.isArray(entry?.derivedFromEvidenceKeys)
      ? entry.derivedFromEvidenceKeys.map((candidate) => cleanText(candidate, 80)).filter(Boolean)
      : [];
    if (!derivedKeys.length) {
      const roots = isV24 && Array.isArray(entry?.originRootKeys)
        ? entry.originRootKeys.map((key) => cleanText(key, 80)).filter(Boolean)
        : [cleanText(entry?.provenanceGroup, 80)].filter(Boolean);
      return new Set(roots);
    }
    return new Set(derivedKeys.flatMap((derivedKey) => [...evidenceRoots(derivedKey, nextVisiting)]));
  };
  for (const [index, conclusion] of conclusions.entries()) {
    const keys = Array.isArray(conclusion?.evidenceKeys) ? conclusion.evidenceKeys : [];
    if (keys.some((key) => !evidenceKeys.has(cleanText(key, 80)))) {
      issues.push(`蓝图 conclusions[${index}].evidenceKeys 引用了未登记证据`);
    }
    const provenance = new Set(keys.flatMap((key) => [...evidenceRoots(key)]));
    if (keys.length && (keys.length < 2 || provenance.size < 2)) {
      issues.push(`蓝图 conclusions[${index}] 必须由两个独立 provenanceGroup 的证据支持`);
    }
    const missingRequiredEvidence = (contract.requiredConclusionEvidenceKeys || [])
      .filter((key) => !keys.includes(key));
    if (missingRequiredEvidence.length) {
      issues.push(`蓝图 conclusions[${index}] 缺少生成前合同指定的关键证据：${missingRequiredEvidence.join("、")}`);
    }
  }
  const hookPromises = Array.isArray(value.hookPromises) ? value.hookPromises : [];
  if (contract.genreMode === "mystery" && hookPromises.length !== 2) {
    issues.push("蓝图 mystery 必须恰好设计两个可被独立双源兑现的 hookPromises");
  }
  for (const [index, hook] of hookPromises.entries()) {
    const keys = Array.isArray(hook?.supportKeys) ? hook.supportKeys.map((key) => cleanText(key, 80)) : [];
    if (cleanText(hook?.promise, 1200).length < 12 || cleanText(hook?.payoff, 1200).length < 12) {
      issues.push(`蓝图 hookPromises[${index}] 必须同时写明承诺与兑现`);
    }
    if (INTERNAL_NARRATIVE_LANGUAGE.test(cleanText(hook?.promise, 1200))
      || INTERNAL_NARRATIVE_LANGUAGE.test(cleanText(hook?.payoff, 2400))) {
      issues.push(`蓝图 hookPromises[${index}] 的叙事文本不得暴露 state/resource/chapter/role 等内部 key`);
    }
    const hookContract = (contract.hookEvidenceRequirements || []).find((entry) => entry.hookIndex === index);
    const missingHookEvidence = (hookContract?.evidenceKeys || []).filter((key) => !keys.includes(key));
    if (missingHookEvidence.length) {
      issues.push(`蓝图 hookPromises[${index}] 缺少生成前合同指定的独立证据：${missingHookEvidence.join("、")}`);
    }
    if (keys.some((key) => !supportKeys.has(key))) {
      issues.push(`蓝图 hookPromises[${index}].supportKeys 引用了未登记 key`);
    }
    if (contract.genreMode === "mystery") {
      const supportedEvidence = keys.map((key) => evidenceByKey.get(key)).filter(Boolean);
      const provenance = new Set(supportedEvidence.map((entry) => cleanText(entry?.provenanceGroup, 80)).filter(Boolean));
      if (supportedEvidence.length < 2 || provenance.size < 2) {
        issues.push(`蓝图 hookPromises[${index}] 必须由两个独立 provenanceGroup 的证据兑现`);
      }
    }
  }
  for (const [index, entry] of (Array.isArray(value.sourceFidelity?.premiseElements)
    ? value.sourceFidelity.premiseElements
    : []).entries()) {
    const premiseElement = cleanText(entry?.element, 160);
    if (!premiseElement || (brief?.premise && !cleanText(brief.premise, 4000).includes(premiseElement))) {
      issues.push(`蓝图 sourceFidelity.premiseElements[${index}].element 必须原样取自 brief.premise`);
    }
    if (cleanText(entry?.implementation, 1200).length < 20) {
      issues.push(`蓝图 sourceFidelity.premiseElements[${index}].implementation 缺失或过短`);
    }
  }
  if (cleanText(value.sourceFidelity?.briefTitle, 160) !== cleanText(brief?.title, 160)) {
    issues.push("蓝图 sourceFidelity.briefTitle 必须逐字保持原题");
  }
  if (!Array.isArray(value.sourceFidelity?.premiseElements) || value.sourceFidelity.premiseElements.length < 2) {
    issues.push("蓝图 sourceFidelity.premiseElements 至少需要两个原始创意锚点");
  }
  for (const [index, entry] of evidence.entries()) {
    const provenanceGroup = cleanText(entry?.provenanceGroup, 80);
    if (!entityKeys.has(provenanceGroup)) {
      issues.push(`蓝图 evidence[${index}].provenanceGroup 必须引用 entities 中登记的稳定来源实体`);
    }
    if (isV23Plus) {
      const provenanceEntity = entities.find((entity) => cleanText(entity?.key, 80) === provenanceGroup);
      if (provenanceEntity && !isSourceTypeCompatible(cleanText(entry?.sourceType, 80), cleanText(provenanceEntity?.type, 40))) {
        issues.push(`蓝图 evidence[${index}].sourceType=${entry?.sourceType} 与来源实体 ${provenanceEntity?.name} 的 type=${provenanceEntity?.type} 不相容`);
      }
    }
    if (isV24) {
      const originRootKeys = Array.isArray(entry?.originRootKeys) ? entry.originRootKeys.map((key) => cleanText(key, 80)).filter(Boolean) : [];
      if (!originRootKeys.length || originRootKeys.some((key) => !entityKeys.has(key))) issues.push(`蓝图 evidence[${index}].originRootKeys 必须引用至少一个真实实体根`);
      for (const field of ["independenceDomain", "methodDomain", "methodOperation", "artifactProduced"]) {
        if (cleanText(entry?.[field], 600).length < 3) issues.push(`蓝图 evidence[${index}].${field} 缺失`);
      }
      if (/(?:服务器|镜像|日志|数据库|文件|数字)/u.test(`${entry?.label || ""} ${entry?.collectionMethod || ""}`)
        && /磁粉/u.test(`${entry?.label || ""} ${entry?.collectionMethod || ""} ${entry?.methodOperation || ""}`)) {
        issues.push(`蓝图 evidence[${index}] 对数字材料错误使用磁粉检测`);
      }
    }
    const conclusionKeys = new Set(conclusions.map((conclusion) => cleanText(conclusion?.key, 80)).filter(Boolean));
    const supportConclusionKeys = Array.isArray(entry?.supportsConclusionKeys) ? entry.supportsConclusionKeys : [];
    if (supportConclusionKeys.some((key) => !conclusionKeys.has(cleanText(key, 80)))) {
      issues.push(`蓝图 evidence[${index}].supportsConclusionKeys 引用了不存在的 conclusion key`);
    }
    if (cleanText(entry?.collectionMethod, 1200).length < 4) {
      issues.push(`蓝图 evidence[${index}].collectionMethod 缺失或过短`);
    }
    if (cleanText(entry?.obtainedBy, 1200).length < 4) {
      issues.push(`蓝图 evidence[${index}].obtainedBy 缺失或过短`);
    }
  }
  for (const [index, state] of states.entries()) {
    if (cleanText(state?.meaning, 1200).length < 8) {
      issues.push(`蓝图 stateVariables[${index}].meaning 缺失或过短`);
    }
  }
  const styleText = JSON.stringify(value.styleContract?.signatureDevices || []);
  for (const seed of contract.styleDeviceSeeds || []) {
    if (!styleText.includes(seed)) issues.push(`蓝图 styleContract 必须逐字落实文风种子“${seed}”`);
  }

  context.registries.resourceKeySet = resourceKeySet;
}
