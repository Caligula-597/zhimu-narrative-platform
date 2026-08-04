import { cleanText } from "../../../prompts/shared.js";
import { getOutlineBlueprintSlotPath } from "../../../story-outline-contract/structure.js";
import {
  AUTHORIZATION_STATUSES,
  CAUSAL_RESPONSIBILITY_TYPES,
  ENTITY_TYPES,
  GENERIC_RESPONSIBILITY_ACTION,
  GENERIC_RESPONSIBILITY_EFFECT,
  RESPONSIBILITY_TYPES,
  SOURCE_SHELL_ENTITY,
  inferEntityTypesFromName
} from "../../../story-outline-contract/vocabulary.js";
import {
  UNRESOLVED_BLUEPRINT_LOGIC
} from "../policy.js";

export function validateBlueprintCoreIdentity(context) {
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

  if (Number(value.outlineVersion) !== 2 || cleanText(value.outlineRevision, 20) !== expectedRevision) {
    issues.push(`蓝图必须使用 outlineVersion=2、outlineRevision=${expectedRevision}`);
  }
  if (cleanText(value.logline, 800).length < 20) issues.push("蓝图 logline 缺失或过短");
  const truthTimeline = cleanText(value.truthTimeline, 6000);
  if (truthTimeline.length < 80) issues.push("蓝图 truthTimeline 缺失或过短");
  if (isV23Plus ? !/责任链[：:]/u.test(truthTimeline) : !/核心责任玩家[：:]/u.test(truthTimeline)) {
    issues.push(`蓝图 truthTimeline 缺少“${isV23Plus ? "责任链" : "核心责任玩家"}：”`);
  }
  if (!/NPC边界[：:]/u.test(truthTimeline)) issues.push("蓝图 truthTimeline 缺少“NPC边界：”");
  if (UNRESOLVED_BLUEPRINT_LOGIC.test(truthTimeline)) {
    issues.push("蓝图 truthTimeline 含“或/待定/尚未确定”等未决真相表述");
  }
  if (UNRESOLVED_BLUEPRINT_LOGIC.test(JSON.stringify(value))) {
    issues.push("蓝图任一字段都不得含“真凶或幕后黑手/待定/尚未确定”等未决真相表述");
  }

  if (players.length !== spec.playerCount) issues.push(`蓝图 players 必须恰好为 ${spec.playerCount} 人`);
  if (isV24) {
    const spotlightKeys = players.map((player) => cleanText(player?.spotlightChapterKey, 80)).filter(Boolean);
    const minimumSpotlightChapters = Math.min(4, spec.chapterKeys.length);
    if (new Set(spotlightKeys).size < minimumSpotlightChapters) {
      issues.push(`蓝图聚光章至少覆盖 ${minimumSpotlightChapters} 个不同章节`);
    }
    const spotlightCounts = new Map();
    for (const chapterKey of spotlightKeys) spotlightCounts.set(chapterKey, (spotlightCounts.get(chapterKey) || 0) + 1);
    for (const [chapterKey, count] of spotlightCounts.entries()) {
      if (count > 3) issues.push(`蓝图 ${chapterKey} 聚光玩家达到 ${count} 人，超过三人上限`);
    }
  }
  const expectedNames = Array.isArray(contract.playerNames) ? contract.playerNames : [];
  const expectedIdentities = Array.isArray(contract.playerIdentityRequirements)
    ? contract.playerIdentityRequirements
    : [];
  if (expectedIdentities.length && expectedIdentities.length !== spec.playerCount) {
    issues.push(`蓝图玩家身份合同必须恰好覆盖 ${spec.playerCount} 个席位`);
  }
  const playerKeys = new Set();
  const playerNames = new Set();
  for (const [index, player] of players.entries()) {
    const key = cleanText(player?.key, 80);
    const name = cleanText(player?.name, 80);
    if (!key || playerKeys.has(key)) issues.push(`蓝图 players[${index}].key 缺失或重复`);
    playerKeys.add(key);
    if (!name || playerNames.has(normalizedName(name))) issues.push(`蓝图 players[${index}].name 缺失或重复`);
    playerNames.add(normalizedName(name));
    if (expectedNames[index] && name !== expectedNames[index]) {
      issues.push(`蓝图 players[${index}].name 必须为 ${expectedNames[index]}`);
    }
    if (expectedIdentities[index]
      && !cleanText(player?.identity, 800).includes(expectedIdentities[index])) {
      issues.push(`蓝图 players[${index}].identity 必须落实同席位身份“${expectedIdentities[index]}”`);
    }
    const expectedContribution = contract.contributionTypes?.[index];
    if (expectedContribution && player?.contribution?.anchorType !== expectedContribution) {
      issues.push(`蓝图 players[${index}].contribution.anchorType 必须为 ${expectedContribution}`);
    }
    if (!Array.isArray(player?.chapterActions) || player.chapterActions.length !== 0) {
      issues.push(`蓝图 ${getOutlineBlueprintSlotPath("playerActions", index)} 必须为空数组`);
    }
    if (contract.spotlightChapterKeys?.[index]
      && player?.spotlightChapterKey !== contract.spotlightChapterKeys[index]) {
      issues.push(`蓝图 players[${index}].spotlightChapterKey 必须为 ${contract.spotlightChapterKeys[index]}`);
    }
    const influence = contract.roleEndingInfluences?.[index];
    const requiredTurnChapters = [...new Set([
      influence?.chapterKey,
      contract.spotlightChapterKeys?.[index]
    ].filter(Boolean))];
    if (requiredTurnChapters.some((chapterKey) => !player?.contribution?.turnChapterKeys?.includes(chapterKey))) {
      issues.push(`蓝图 players[${index}].contribution.turnChapterKeys 必须包含 ${requiredTurnChapters.join("、")}`);
    }
  }
  for (const [index, entity] of entities.entries()) {
    if (!cleanText(entity?.key, 80)) issues.push(`蓝图 entities[${index}].key 缺失`);
    if (!ENTITY_TYPES.has(cleanText(entity?.type, 40))) {
      issues.push(`蓝图 entities[${index}].type 必须是 ${[...ENTITY_TYPES].join(" / ")} 之一`);
    }
    if (cleanText(entity?.name, 160).length < 2) issues.push(`蓝图 entities[${index}].name 缺失或过短`);
    if (cleanText(entity?.meaning, 800).length < 4) issues.push(`蓝图 entities[${index}].meaning 缺失或过短`);
    if (isV23Plus && SOURCE_SHELL_ENTITY.test(`${entity?.key || ""} ${entity?.name || ""} ${entity?.meaning || ""}`)) {
      issues.push(`蓝图 entities[${index}] 是为通过来源门禁临时制造的“来源壳”`);
    }
    if (isV23Plus) {
      const expectedTypes = inferEntityTypesFromName(cleanText(entity?.name, 160));
      if (expectedTypes && !expectedTypes.has(cleanText(entity?.type, 40))) {
        issues.push(`蓝图 entities[${index}] 的名称/意义与 type=${entity?.type} 语义冲突，应为 ${[...expectedTypes].join(" 或 ")}`);
      }
    }
    for (const candidate of [entity?.name, ...(Array.isArray(entity?.aliases) ? entity.aliases : [])]) {
      if (candidate && playerNames.has(normalizedName(candidate))) {
        issues.push(`蓝图 entities[${index}] 与玩家同名：${candidate}`);
      }
    }
  }
  const entityKeysInOrder = entities.map((entity) => cleanText(entity?.key, 80)).filter(Boolean);
  if (new Set(entityKeysInOrder).size !== entityKeysInOrder.length) issues.push("蓝图 entities.key 缺失或重复");
  const entityNameOwners = new Map();
  for (const entity of entities) {
    for (const candidate of [entity?.name, ...(Array.isArray(entity?.aliases) ? entity.aliases : [])]) {
      const normalized = normalizedName(candidate);
      if (!normalized) continue;
      const existingOwner = entityNameOwners.get(normalized);
      if (existingOwner && existingOwner !== entity?.key) {
        issues.push(`蓝图实体名称或别名“${candidate}”同时指向 ${existingOwner} 与 ${entity?.key}`);
      }
      entityNameOwners.set(normalized, entity?.key);
    }
  }
  const centralKeys = Array.isArray(value.centralResponsibilityRoleKeys)
    ? value.centralResponsibilityRoleKeys
    : [];
  if (!centralKeys.length) issues.push("蓝图至少需要一名核心责任玩家");
  for (const key of centralKeys) if (!playerKeys.has(key)) issues.push(`蓝图核心责任引用未知玩家：${key}`);
  if (isV23Plus) {
    const responsibilityRoles = Array.isArray(value.responsibilityRoles) ? value.responsibilityRoles : [];
    const causalKeys = new Set();
    for (const [index, entry] of responsibilityRoles.entries()) {
      const type = cleanText(entry?.responsibilityType, 40);
      const roleKey = cleanText(entry?.roleKey, 80);
      if (!playerKeys.has(roleKey)) issues.push(`蓝图 responsibilityRoles[${index}].roleKey 必须引用玩家`);
      if (!RESPONSIBILITY_TYPES.has(type)) issues.push(`蓝图 responsibilityRoles[${index}].responsibilityType 无效`);
      if (CAUSAL_RESPONSIBILITY_TYPES.has(type)) causalKeys.add(roleKey);
      const responsibilityAction = cleanText(entry?.action, 1000);
      const responsibilityEffect = cleanText(entry?.causalEffect, 1000);
      if (responsibilityAction.length < 6 || responsibilityEffect.length < 6) {
        issues.push(`蓝图 responsibilityRoles[${index}] 必须写明世界内行动与因果后果`);
      }
      if (GENERIC_RESPONSIBILITY_ACTION.test(responsibilityAction)) {
        issues.push(`蓝图 responsibilityRoles[${index}].action 只是泛化动作，必须写明动词、对象与具体操作`);
      }
      if (GENERIC_RESPONSIBILITY_EFFECT.test(responsibilityEffect)) {
        issues.push(`蓝图 responsibilityRoles[${index}].causalEffect 只是泛化后果，必须指出危机中被改变的具体事实`);
      }
    }
    if (!causalKeys.size) issues.push("蓝图至少一名玩家必须承担 cause/escalation/maintenance，不能全是受害者、钥匙或解决者");
    if (causalKeys.size !== new Set(centralKeys).size || [...causalKeys].some((key) => !centralKeys.includes(key))) {
      issues.push("蓝图 centralResponsibilityRoleKeys 必须恰好等于 cause/escalation/maintenance 玩家集合");
    }
    if (isV24) {
      const timeline = Array.isArray(value.causalTimeline) ? value.causalTimeline : [];
      const eventByKey = new Map(timeline.map((event) => [cleanText(event?.key, 80), event]));
      const authorizationGrants = Array.isArray(value.semanticConstitution?.authorizationGrants)
        ? value.semanticConstitution.authorizationGrants
        : [];
      const authorizationGrantByKey = new Map(
        authorizationGrants.map((grant) => [cleanText(grant?.key, 80), grant])
      );
      for (const [eventIndex, event] of timeline.entries()) {
        if (cleanText(event?.event, 1200).length < 8) issues.push(`蓝图 causalTimeline[${eventIndex}].event 缺失或过短`);
        if (event?.beforeValue !== undefined && event?.afterValue !== undefined
          && JSON.stringify(event.beforeValue) === JSON.stringify(event.afterValue)) {
          issues.push(`蓝图 causalTimeline[${eventIndex}] 的 beforeValue 与 afterValue 相同，没有形成真实因果变化`);
        }
        const actorKeys = Array.isArray(event?.actorKeys) ? event.actorKeys.map((key) => cleanText(key, 80)).filter(Boolean) : [];
        const mappings = Array.isArray(event?.actorResponsibilities) ? event.actorResponsibilities : [];
        const mappedPlayerKeys = new Set();
        for (const [mappingIndex, mapping] of mappings.entries()) {
          const actorKey = cleanText(mapping?.actorKey, 80);
          const responsibilityType = cleanText(mapping?.responsibilityType, 40);
          if (!playerKeys.has(actorKey)) issues.push(`蓝图 causalTimeline[${eventIndex}].actorResponsibilities[${mappingIndex}].actorKey 必须引用玩家`);
          if (!actorKeys.includes(actorKey)) issues.push(`蓝图 causalTimeline[${eventIndex}].actorResponsibilities[${mappingIndex}].actorKey 必须同时出现在 actorKeys`);
          if (!RESPONSIBILITY_TYPES.has(responsibilityType)) issues.push(`蓝图 causalTimeline[${eventIndex}].actorResponsibilities[${mappingIndex}].responsibilityType 无效`);
          mappedPlayerKeys.add(actorKey);
        }
        for (const actorKey of actorKeys.filter((key) => playerKeys.has(key))) {
          if (!mappedPlayerKeys.has(actorKey)) issues.push(`蓝图 causalTimeline[${eventIndex}] 的玩家行动者 ${actorKey} 缺少逐人责任映射`);
        }
        const authorizationStatus = cleanText(event?.authorizationStatus, 40);
        const authorizationGrantKey = cleanText(event?.authorizationGrantKey, 80);
        const purposeKey = cleanText(event?.purposeKey, 80);
        if (authorizationStatus === "authorized"
          && /(?:越权|擅自|未获授权|未经授权|绕过授权)/u.test(cleanText(event?.event, 1200))) {
          issues.push(`蓝图 causalTimeline[${eventIndex}] 世界内叙述声称越权或未经授权，但 authorizationStatus 却为 authorized`);
        }
        if (!AUTHORIZATION_STATUSES.has(authorizationStatus)) {
          issues.push(`蓝图 causalTimeline[${eventIndex}].authorizationStatus 无效`);
        } else if (authorizationStatus !== "not-required") {
          const grant = authorizationGrantByKey.get(authorizationGrantKey);
          if (!grant) {
            issues.push(`蓝图 causalTimeline[${eventIndex}].authorizationGrantKey 必须引用授权记录`);
          } else if (authorizationStatus === "authorized"
            && (!purposeKey || !grant.allowedPurposeKeys?.includes(purposeKey) || grant.forbiddenPurposeKeys?.includes(purposeKey))) {
            issues.push(`蓝图 causalTimeline[${eventIndex}] 声称 authorized，但用途 ${purposeKey || "未填写"} 不在授权范围内`);
          } else if (["exceeded", "forged"].includes(authorizationStatus)
            && purposeKey && grant.allowedPurposeKeys?.includes(purposeKey)
            && !grant.forbiddenPurposeKeys?.includes(purposeKey)) {
            issues.push(`蓝图 causalTimeline[${eventIndex}] 声称 ${authorizationStatus}，但用途 ${purposeKey} 已被授权记录允许`);
          }
          for (const actorKey of actorKeys.filter((key) => playerKeys.has(key))) {
            const actor = players.find((player) => cleanText(player?.key, 80) === actorKey);
            if (grant && !actor?.authorizationGrantKeys?.includes(grant.key)) {
              issues.push(`蓝图 causalTimeline[${eventIndex}] 的行动者 ${actorKey} 未登记所用授权 ${grant.key}`);
            }
          }
        }
      }
      for (const [index, responsibility] of responsibilityRoles.entries()) {
        for (const eventKey of Array.isArray(responsibility?.eventKeys) ? responsibility.eventKeys : []) {
          const event = eventByKey.get(cleanText(eventKey, 80));
          const paired = Array.isArray(event?.actorResponsibilities) && event.actorResponsibilities.some((mapping) => (
            cleanText(mapping?.actorKey, 80) === cleanText(responsibility?.roleKey, 80)
            && cleanText(mapping?.responsibilityType, 40) === cleanText(responsibility?.responsibilityType, 40)
          ));
          if (!paired) issues.push(`蓝图 responsibilityRoles[${index}] 未被事件 ${eventKey} 的逐人责任映射支持`);
        }
      }
    }
  }

  context.registries.playerKeys = playerKeys;
  context.registries.playerNames = playerNames;
}
