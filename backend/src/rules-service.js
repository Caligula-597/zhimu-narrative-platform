import { sendErr, throwErr } from "./api-errors.js";
import {
  RULE_MAX_CONDITION_DEPTH,
  RULE_MAX_CONDITION_NODES,
  validateRuleBody
} from "./rule-structure-validator.js";
import { creatorChecks } from "./world-publish-readiness.js";
import { buildWorldSnapshot } from "./world-snapshot-service.js";
import { runRevisionMutation } from "./world-revision.js";
import {
  configureRulesTransaction,
  deleteRule,
  insertRule,
  listWorldRules,
  lockRuleReferences,
  lockRuleRoom,
  lockRulesEditor,
  replaceRule
} from "./repositories/rules-repository.js";

function newReferenceSets() {
  return {
    roleSlotIds: new Set(),
    scriptSectionIds: new Set(),
    sceneIds: new Set(),
    clueIds: new Set(),
    investigationPointIds: new Set(),
    itemIds: new Set()
  };
}

function addNodeReferences(node, refs) {
  if (!node || typeof node !== "object") return;
  if (node.roleSlotId) refs.roleSlotIds.add(node.roleSlotId);
  if (node.scriptSectionId) refs.scriptSectionIds.add(node.scriptSectionId);
  if (node.sceneId) refs.sceneIds.add(node.sceneId);
  if (node.clueId) refs.clueIds.add(node.clueId);
  if (node.investigationPointId) refs.investigationPointIds.add(node.investigationPointId);
  if (node.itemId) refs.itemIds.add(node.itemId);
}

function throwRuleComplexity(message) {
  throwErr("RULE_BODY_INVALID", undefined, { errors: [{ path: "conditions", message }] });
}

function collectConditionReferences(root, refs) {
  const stack = [{ node: root, depth: 1 }];
  let visited = 0;
  while (stack.length) {
    const { node, depth } = stack.pop();
    visited += 1;
    if (visited > RULE_MAX_CONDITION_NODES) {
      throwRuleComplexity(`单条规则最多包含 ${RULE_MAX_CONDITION_NODES} 个条件节点，请拆分规则。`);
    }
    if (depth > RULE_MAX_CONDITION_DEPTH) {
      throwRuleComplexity(`条件嵌套不能超过 ${RULE_MAX_CONDITION_DEPTH} 层，请拆分规则。`);
    }
    addNodeReferences(node, refs);
    if (!node || typeof node !== "object") continue;
    const all = Array.isArray(node.all) ? node.all : [];
    const any = Array.isArray(node.any) ? node.any : [];
    const childCount = all.length + any.length + (node.not == null ? 0 : 1);
    if (visited + stack.length + childCount > RULE_MAX_CONDITION_NODES) {
      throwRuleComplexity(`单条规则最多包含 ${RULE_MAX_CONDITION_NODES} 个条件节点，请拆分规则。`);
    }
    for (const child of all) stack.push({ node: child, depth: depth + 1 });
    for (const child of any) stack.push({ node: child, depth: depth + 1 });
    if (node.not != null) stack.push({ node: node.not, depth: depth + 1 });
  }
}

function collectRuleReferences(conditions, actions) {
  const refs = newReferenceSets();
  collectConditionReferences(conditions, refs);
  for (const action of actions ?? []) addNodeReferences(action, refs);
  return Object.fromEntries(
    Object.entries(refs).map(([key, value]) => [key, [...value]])
  );
}

async function assertEditor(client, { worldId, actorId }) {
  const role = await lockRulesEditor(client, { worldId, actorId });
  if (!role) throwErr("WORLD_ACCESS_DENIED");
  if (!["owner", "editor"].includes(role)) throwErr("WORLD_EDITOR_REQUIRED");
}

async function validateRuleForWrite(client, worldId, { conditions, actions }) {
  await lockRuleReferences(client, { worldId, ...collectRuleReferences(conditions, actions) });
  const snapshot = await buildWorldSnapshot(worldId, client);
  const validation = validateRuleBody(snapshot, { conditions, actions });
  if (!validation.ok) {
    throwErr("RULE_BODY_INVALID", undefined, { errors: validation.errors });
  }
}

function normalizeRulePayload(payload) {
  const name = String(payload.name ?? "").trim();
  if (!name) throwErr("NAME_EMPTY");
  return {
    roomId: payload.roomId ?? null,
    name,
    mode: payload.mode ?? "automatic",
    priority: payload.priority ?? 100,
    enabled: payload.enabled ?? true,
    conditions: payload.conditions,
    actions: payload.actions,
    metadata: payload.metadata ?? {}
  };
}

export async function addRule({ request, reply, actorId, worldId, payload }) {
  const rule = normalizeRulePayload(payload);
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertEditor(client, { worldId, actorId });
    if (!await lockRuleRoom(client, { worldId, roomId: rule.roomId })) {
      throwErr("RULE_ROOM_WORLD_MISMATCH");
    }
    await validateRuleForWrite(client, worldId, rule);
    return insertRule(client, { worldId, ...rule });
  }, { sendErr, statusCode: 201, configureClient: configureRulesTransaction });
}

export async function reviseRule({ request, reply, actorId, worldId, ruleId, payload }) {
  const rule = normalizeRulePayload(payload);
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertEditor(client, { worldId, actorId });
    if (!await lockRuleRoom(client, { worldId, roomId: rule.roomId })) {
      throwErr("RULE_ROOM_WORLD_MISMATCH");
    }
    await validateRuleForWrite(client, worldId, rule);
    const updated = await replaceRule(client, { worldId, ruleId, ...rule });
    if (!updated) throwErr("RULE_NOT_FOUND");
    return updated;
  }, { sendErr, configureClient: configureRulesTransaction });
}

export async function removeRule({ request, reply, actorId, worldId, ruleId }) {
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertEditor(client, { worldId, actorId });
    const deleted = await deleteRule(client, { worldId, ruleId });
    if (!deleted) throwErr("RULE_NOT_FOUND");
    return { ok: true };
  }, { sendErr, configureClient: configureRulesTransaction });
}

export async function getWorldRules(worldId) {
  return listWorldRules(worldId);
}

export async function validateWorldRules(worldId) {
  const snapshot = await buildWorldSnapshot(worldId);
  return { checks: creatorChecks(snapshot), totalRules: snapshot.rules.length };
}

export async function validateWorldRuleBody(worldId, { conditions, actions }) {
  const snapshot = await buildWorldSnapshot(worldId);
  return validateRuleBody(snapshot, { conditions, actions });
}
