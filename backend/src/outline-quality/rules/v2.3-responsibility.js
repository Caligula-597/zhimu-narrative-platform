/** Responsibility and causal-timeline policies introduced by outline V2.3. */

import {
  AUTHORIZATION_STATUSES,
  CAUSAL_RESPONSIBILITY_TYPES,
  GENERIC_RESPONSIBILITY_ACTION,
  GENERIC_RESPONSIBILITY_EFFECT,
  RESPONSIBILITY_TYPES
} from "../constants.js";

import { hasScalarValue, requireKnownRefs, requireText, stateValueSignature } from "../primitives.js";

export function validateResponsibilityRoles({
  outline,
  isV24,
  playerKeys,
  timelineEventKeys,
  issues
}) {
  if (!outline.responsibilityRoles.length) issues.push("responsibilityRoles 必须拆分 cause/escalation/maintenance/resolution 责任类型");
  const causalResponsibilityKeys = new Set();
  for (const [index, responsibility] of outline.responsibilityRoles.entries()) {
    const label = `responsibilityRoles[${index}]`;
    if (!playerKeys.has(responsibility.roleKey)) issues.push(`${label}.roleKey 必须引用玩家角色`);
    if (!RESPONSIBILITY_TYPES.has(responsibility.responsibilityType)) {
      issues.push(`${label}.responsibilityType 必须为 cause/escalation/maintenance/resolution`);
    }
    requireText(responsibility.action, `${label}.action`, issues, 6);
    requireText(responsibility.causalEffect, `${label}.causalEffect`, issues, 6);
    if (isV24) {
      requireKnownRefs(responsibility.eventKeys, timelineEventKeys, `${label}.eventKeys`, issues, 1);
      for (const eventKey of responsibility.eventKeys) {
        const event = outline.causalTimeline.find((entry) => entry.key === eventKey);
        const mapped = event?.actorResponsibilities.some((entry) => (
          entry.actorKey === responsibility.roleKey
          && entry.responsibilityType === responsibility.responsibilityType
        ));
        if (event && !mapped) {
          issues.push(`${label} 的角色与责任类型未在事件 ${eventKey}.actorResponsibilities 中成对登记`);
        }
        const player = outline.players.find((entry) => entry.key === responsibility.roleKey);
        if (event && CAUSAL_RESPONSIBILITY_TYPES.has(responsibility.responsibilityType)
          && !event.factKeys.some((factKey) => player?.secretFactKeys.includes(factKey))) {
          issues.push(`${label} 的责任事件 ${eventKey} 没有与该玩家 coreSecret 的 secretFactKeys 相连`);
        }
      }
    }
    if (GENERIC_RESPONSIBILITY_ACTION.test(responsibility.action)) {
      issues.push(`${label}.action 只是泛化动作，必须写明动词、对象与具体操作`);
    }
    if (GENERIC_RESPONSIBILITY_EFFECT.test(responsibility.causalEffect)) {
      issues.push(`${label}.causalEffect 只是泛化后果，必须指出危机中被改变的具体事实`);
    }
    if (CAUSAL_RESPONSIBILITY_TYPES.has(responsibility.responsibilityType)) {
      causalResponsibilityKeys.add(responsibility.roleKey);
    }
  }
  if (!causalResponsibilityKeys.size) {
    issues.push("至少一名玩家必须承担 cause、escalation 或 maintenance；受害者、钥匙或最终裁决者不能只凭 resolution 被称为核心责任人");
  }
  const declaredCentral = new Set(outline.centralResponsibilityRoleKeys);
  if (declaredCentral.size !== causalResponsibilityKeys.size
    || [...causalResponsibilityKeys].some((key) => !declaredCentral.has(key))) {
    issues.push("centralResponsibilityRoleKeys 必须恰好等于 responsibilityRoles 中 cause/escalation/maintenance 的玩家集合");
  }
  if (!/责任链[：:]/u.test(outline.truthTimeline)) issues.push(`${isV24 ? "V2.4" : "V2.3"} truthTimeline 必须使用“责任链：”区分制造、升级、维持与解决责任`);
  if (isV24) {
    for (const event of outline.causalTimeline) {
      for (const mapping of event.actorResponsibilities) {
        const declared = outline.responsibilityRoles.some((entry) => (
          entry.roleKey === mapping.actorKey
          && entry.responsibilityType === mapping.responsibilityType
          && entry.eventKeys.includes(event.key)
        ));
        if (!declared) issues.push(`事件 ${event.key} 已把 ${mapping.actorKey} 标为 ${mapping.responsibilityType}，但 responsibilityRoles 未登记对应责任`);
      }
    }
  }
}

export function validateCausalTimeline({
  outline,
  isV24,
  chapterKeys,
  playerKeys,
  entityKeys,
  stateKeys,
  stableTargetKeys,
  factKeys,
  authorizationGrantKeys,
  issues
}) {
  if (outline.causalTimeline.length < 3) issues.push("causalTimeline 至少需要三个按先后顺序登记的因果事件");
  const timelineKeys = new Set();
  const timelineParameterValues = new Map();
  let previousOrder = Number.NEGATIVE_INFINITY;
  const timelineActorKeys = new Set([...playerKeys, ...entityKeys]);
  for (const [index, event] of outline.causalTimeline.entries()) {
    const label = `causalTimeline[${index}]`;
    if (!event.key || timelineKeys.has(event.key)) issues.push(`${label}.key 缺失或重复`);
    timelineKeys.add(event.key);
    if (!Number.isInteger(event.order) || event.order <= previousOrder) issues.push(`${label}.order 必须为严格递增整数`);
    previousOrder = event.order;
    requireText(event.event, `${label}.event`, issues, 12);
    requireKnownRefs(event.actorKeys, timelineActorKeys, `${label}.actorKeys`, issues, 1);
    requireKnownRefs(event.outcomeStateKeys, stateKeys, `${label}.outcomeStateKeys`, issues, 0);
    if (isV24) {
      requireText(event.actionType, `${label}.actionType`, issues, 2);
      if (!stableTargetKeys.has(event.targetKey)) issues.push(`${label}.targetKey 必须引用已登记玩家、实体、状态、资源或证据`);
      requireText(event.parameterKey, `${label}.parameterKey`, issues, 2);
      if (!hasScalarValue(event.beforeValue) || !hasScalarValue(event.afterValue)) issues.push(`${label} 必须同时声明 beforeValue 与 afterValue`);
      if (hasScalarValue(event.beforeValue) && hasScalarValue(event.afterValue)
        && stateValueSignature(event.beforeValue) === stateValueSignature(event.afterValue)) {
        issues.push(`${label} 的 beforeValue 与 afterValue 相同，没有形成真实因果变化`);
      }
      const parameterSignature = `${event.targetKey}|${event.parameterKey}`;
      const priorParameterValue = timelineParameterValues.get(parameterSignature);
      if (priorParameterValue !== undefined && stateValueSignature(priorParameterValue) !== stateValueSignature(event.beforeValue)) {
        issues.push(`${label} 对 ${event.targetKey}.${event.parameterKey} 的 beforeValue 与上一事件 afterValue 不连续`);
      }
      if (hasScalarValue(event.afterValue)) timelineParameterValues.set(parameterSignature, event.afterValue);
      requireKnownRefs(event.factKeys, factKeys, `${label}.factKeys`, issues, 1);
      const mappedActorKeys = new Set();
      const mappedResponsibilityTypes = new Set();
      for (const [mappingIndex, mapping] of event.actorResponsibilities.entries()) {
        const mappingLabel = `${label}.actorResponsibilities[${mappingIndex}]`;
        if (!playerKeys.has(mapping.actorKey)) issues.push(`${mappingLabel}.actorKey 必须引用玩家角色`);
        if (!event.actorKeys.includes(mapping.actorKey)) issues.push(`${mappingLabel}.actorKey 必须同时出现在事件 actorKeys`);
        if (!RESPONSIBILITY_TYPES.has(mapping.responsibilityType)) issues.push(`${mappingLabel}.responsibilityType 无效`);
        mappedActorKeys.add(mapping.actorKey);
        mappedResponsibilityTypes.add(mapping.responsibilityType);
      }
      for (const actorKey of event.actorKeys.filter((key) => playerKeys.has(key))) {
        if (!mappedActorKeys.has(actorKey)) issues.push(`${label} 的玩家行动者 ${actorKey} 缺少 actorResponsibilities 责任映射`);
      }
      for (const responsibilityType of event.responsibilityTypes) {
        if (!RESPONSIBILITY_TYPES.has(responsibilityType)) issues.push(`${label}.responsibilityTypes 包含无效类型：${responsibilityType}`);
        if (!mappedResponsibilityTypes.has(responsibilityType)) issues.push(`${label}.responsibilityTypes 的 ${responsibilityType} 没有对应到具体玩家`);
      }
      if (!AUTHORIZATION_STATUSES.has(event.authorizationStatus)) issues.push(`${label}.authorizationStatus 无效`);
      if (event.authorizationStatus === "authorized" && /(?:越权|擅自|未获授权|未经授权|绕过授权)/u.test(event.event)) {
        issues.push(`${label} 世界内叙述声称越权或未经授权，但 authorizationStatus 却为 authorized`);
      }
      if (event.authorizationStatus !== "not-required") {
        if (!authorizationGrantKeys.has(event.authorizationGrantKey)) issues.push(`${label}.authorizationGrantKey 必须引用授权记录`);
        const grant = outline.semanticConstitution.authorizationGrants.find((entry) => entry.key === event.authorizationGrantKey);
        if (grant && event.authorizationStatus === "authorized" && (!event.purposeKey || !grant.allowedPurposeKeys.includes(event.purposeKey) || grant.forbiddenPurposeKeys.includes(event.purposeKey))) {
          issues.push(`${label} 声称 authorized，但用途 ${event.purposeKey || "未填写"} 不在授权范围内`);
        }
        if (grant && ["exceeded", "forged"].includes(event.authorizationStatus) && event.purposeKey && grant.allowedPurposeKeys.includes(event.purposeKey) && !grant.forbiddenPurposeKeys.includes(event.purposeKey)) {
          issues.push(`${label} 声称 ${event.authorizationStatus}，但用途 ${event.purposeKey} 已被授权记录允许`);
        }
        for (const actorKey of event.actorKeys.filter((key) => playerKeys.has(key))) {
          const actor = outline.players.find((entry) => entry.key === actorKey);
          if (grant && !actor?.authorizationGrantKeys.includes(grant.key)) issues.push(`${label} 的行动者 ${actorKey} 未在 authorizationGrantKeys 登记所用授权 ${grant.key}`);
        }
      }
    }
    for (const preconditionKey of event.preconditionKeys) {
      if (!timelineKeys.has(preconditionKey)) issues.push(`${label}.preconditionKeys 必须引用此前已经登记的时间线事件：${preconditionKey}`);
    }
  }
}
