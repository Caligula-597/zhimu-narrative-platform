/** V2.4 semantic constitution policy. No candidate normalization belongs here. */

import { FACT_TRUTH_VALUES } from "../constants.js";

import { hasScalarValue, requireKnownRefs, requireText, stateValueSignature } from "../primitives.js";

export function validateV24SemanticConstitution({
  outline,
  chapterKeys,
  stableTargetKeys,
  factKeys,
  authorizationGrantKeys,
  worldRuleKeys,
  branchEventKeys,
  timelineEventKeys,
  evidenceKeys,
  runtimeEventKeys,
  playerKeys,
  entityKeys,
  stateKeys,
  resourceKeys,
  validateStructuredEffect,
  issues
}) {
  if (outline.semanticConstitution.facts.length < 3) issues.push("V2.4 semanticConstitution.facts 至少需要三条锁定事实");
  if (!outline.semanticConstitution.worldRules.length) issues.push("V2.4 semanticConstitution.worldRules 至少需要一条可执行世界规则");
  if (factKeys.size !== outline.semanticConstitution.facts.length) issues.push("semanticConstitution.facts key 缺失或重复");
  if (authorizationGrantKeys.size !== outline.semanticConstitution.authorizationGrants.length) issues.push("semanticConstitution.authorizationGrants key 缺失或重复");
  if (worldRuleKeys.size !== outline.semanticConstitution.worldRules.length) issues.push("semanticConstitution.worldRules key 缺失或重复");
  if (branchEventKeys.size !== outline.semanticConstitution.branchEvents.length) issues.push("semanticConstitution.branchEvents key 缺失或重复");
  for (const [index, branchEvent] of outline.semanticConstitution.branchEvents.entries()) {
    const label = `semanticConstitution.branchEvents[${index}]`;
    requireText(branchEvent.key, `${label}.key`, issues);
    if (timelineEventKeys.has(branchEvent.key)) issues.push(`${label}.key 不能与 causalTimeline 的既成事件重复`);
    if (!chapterKeys.includes(branchEvent.chapterKey)) issues.push(`${label}.chapterKey 必须引用真实章节`);
    requireText(branchEvent.description, `${label}.description`, issues, 8);
  }

  const factTruthBySignature = new Map();
  for (const [index, fact] of outline.semanticConstitution.facts.entries()) {
    const label = `semanticConstitution.facts[${index}]`;
    requireText(fact.key, `${label}.key`, issues);
    if (!stableTargetKeys.has(fact.subjectKey)) issues.push(`${label}.subjectKey 必须引用玩家、实体、状态、资源或证据`);
    requireText(fact.predicate, `${label}.predicate`, issues, 2);
    const hasObjectKey = Boolean(fact.objectKey);
    const hasObjectValue = hasScalarValue(fact.objectValue);
    if (hasObjectKey === hasObjectValue) issues.push(`${label} 必须且只能填写 objectKey 或 objectValue 之一`);
    if (hasObjectKey && !stableTargetKeys.has(fact.objectKey)) issues.push(`${label}.objectKey 引用未知对象：${fact.objectKey}`);
    if (!FACT_TRUTH_VALUES.has(fact.truthValue)) issues.push(`${label}.truthValue 必须是 true 或 false`);
    requireKnownRefs(fact.evidenceKeys, evidenceKeys, `${label}.evidenceKeys`, issues, 0);
    if (fact.validFromEventKey && !timelineEventKeys.has(fact.validFromEventKey)) issues.push(`${label}.validFromEventKey 引用未知事件`);
    if (fact.validToEventKey && !timelineEventKeys.has(fact.validToEventKey)) issues.push(`${label}.validToEventKey 引用未知事件`);
    const signature = [fact.subjectKey, fact.predicate, fact.objectKey || JSON.stringify(fact.objectValue), fact.scopeKey, fact.validFromEventKey, fact.validToEventKey].join("|");
    const priorTruth = factTruthBySignature.get(signature);
    if (priorTruth !== undefined && priorTruth !== fact.truthValue) {
      issues.push(`${label} 与另一条事实对同一主体、谓词、对象、范围和时段给出相反真值`);
    }
    factTruthBySignature.set(signature, fact.truthValue);
  }

  for (const [index, grant] of outline.semanticConstitution.authorizationGrants.entries()) {
    const label = `semanticConstitution.authorizationGrants[${index}]`;
    requireText(grant.key, `${label}.key`, issues);
    for (const [field, key] of [["grantorKey", grant.grantorKey], ["granteeKey", grant.granteeKey], ["assetKey", grant.assetKey]]) {
      if (!stableTargetKeys.has(key)) issues.push(`${label}.${field} 必须引用已登记玩家或实体`);
    }
    if (!grant.allowedPurposeKeys.length) issues.push(`${label}.allowedPurposeKeys 至少需要一项明确用途`);
    const overlap = grant.allowedPurposeKeys.filter((purpose) => grant.forbiddenPurposeKeys.includes(purpose));
    if (overlap.length) issues.push(`${label} 同时允许并禁止用途：${overlap.join("、")}`);
    requireKnownRefs(grant.evidenceKeys, evidenceKeys, `${label}.evidenceKeys`, issues, 1);
    if (grant.validFromEventKey && !timelineEventKeys.has(grant.validFromEventKey)) issues.push(`${label}.validFromEventKey 引用未知事件`);
    if (grant.validToEventKey && !timelineEventKeys.has(grant.validToEventKey)) issues.push(`${label}.validToEventKey 引用未知事件`);
  }

  for (const [index, rule] of outline.semanticConstitution.worldRules.entries()) {
    const label = `semanticConstitution.worldRules[${index}]`;
    requireText(rule.key, `${label}.key`, issues);
    requireText(rule.statement, `${label}.statement`, issues, 20);
    if (!chapterKeys.includes(rule.evaluationChapterKey)) issues.push(`${label}.evaluationChapterKey 必须引用真实章节`);
    requireKnownRefs(rule.triggerEventKeys, runtimeEventKeys, `${label}.triggerEventKeys`, issues, 0);
    requireKnownRefs(rule.authorizedActorKeys, new Set([...playerKeys, ...entityKeys]), `${label}.authorizedActorKeys`, issues, 0);
    requireKnownRefs(rule.auditEvidenceKeys, evidenceKeys, `${label}.auditEvidenceKeys`, issues, 1);
    requireText(rule.failureMode, `${label}.failureMode`, issues, 12);
    for (const [preconditionIndex, precondition] of rule.preconditions.entries()) {
      const preLabel = `${label}.preconditions[${preconditionIndex}]`;
      if (precondition.targetType === "fact") {
        if (!factKeys.has(precondition.targetKey)) issues.push(`${preLabel}.targetKey 引用未知 fact`);
      } else {
        const known = precondition.targetType === "state" ? stateKeys : precondition.targetType === "resource" ? resourceKeys : precondition.targetType === "evidence" ? evidenceKeys : null;
        if (!known) issues.push(`${preLabel}.targetType 必须为 fact/state/resource/evidence`);
        else if (!known.has(precondition.targetKey)) issues.push(`${preLabel}.targetKey 引用未知 ${precondition.targetType}`);
      }
    }
    for (const [effectIndex, effect] of rule.effects.entries()) {
      const effectLabel = `${label}.effects[${effectIndex}]`;
      validateStructuredEffect(effect, effectLabel);
      if (effect.targetType === "event" && !branchEventKeys.has(effect.targetKey)) issues.push(`${label}.effects[${effectIndex}] 只能触发 branchEvents，不能重新触发既成 causalTimeline 事件`);
      if (effect.targetType === "evidence"
        && /(?:授权|赛果|条款|责任).{0,10}(?:被确认|认定为|已裁定|正式有效)/u.test(effect.consequence)) {
        issues.push(`${effectLabel} 效果语义冲突：解锁证据只能改变材料可用性，不能直接宣告授权、赛果、条款或责任已被裁定`);
      }
      if (effect.targetType === "state") {
        const targetState = outline.endingLogic.stateVariables.find((state) => state.key === effect.targetKey);
        if (targetState && targetState.controlMode !== "derived") {
          issues.push(`${effectLabel} 只能写 controlMode=derived 的状态；${effect.targetKey} 是 ${targetState.controlMode} 状态`);
        }
        const evaluationIndex = chapterKeys.indexOf(rule.evaluationChapterKey);
        const setIndex = chapterKeys.indexOf(targetState?.setInChapterKey);
        if (targetState && evaluationIndex >= 0 && setIndex >= 0 && evaluationIndex < setIndex) {
          issues.push(`${effectLabel} 在 ${rule.evaluationChapterKey} 提前写入状态 ${effect.targetKey}；该状态最早只能在 ${targetState.setInChapterKey} 写入`);
        }
      }
    }
  }
}
