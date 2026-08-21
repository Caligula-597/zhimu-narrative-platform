import { sendErr, throwErr } from "./api-errors.js";
import {
  configureStudioItemTransaction,
  createStudioItem,
  deleteStudioItem,
  lockActiveWorldAsset,
  lockStudioItem,
  lockStudioItemEditor,
  readStudioItemReferenceCounts,
  updateStudioItem
} from "./repositories/studio-item-repository.js";
import { runRevisionMutation } from "./world-revision.js";
import { assertRuntimeObjectDeletionAllowed } from "./runtime-release-guard.js";

async function assertEditor(client, { worldId, actorId }) {
  const role = await lockStudioItemEditor(client, { worldId, actorId });
  if (!role) throwErr("WORLD_ACCESS_DENIED");
  if (!["owner", "editor"].includes(role)) throwErr("WORLD_EDITOR_REQUIRED");
}

async function assertAsset(client, { worldId, assetId }) {
  if (!assetId) return;
  if (!await lockActiveWorldAsset(client, { worldId, assetId })) throwErr("ASSET_NOT_FOUND");
}

function itemMetadata(body, current = {}) {
  return {
    ...current,
    ...(body.metadata ?? {}),
    ...(body.unique !== undefined ? { unique: Boolean(body.unique) } : {}),
    ...(body.consumable !== undefined ? { consumable: Boolean(body.consumable) } : {}),
    ...(body.assetId !== undefined ? { assetId: body.assetId || null } : {}),
    ...(body.itemActions !== undefined ? { itemActions: normalizeItemActions(body.itemActions) } : {})
  };
}

export function normalizeItemActions(value) {
  if (!Array.isArray(value) || value.length > 8) throwErr("ITEM_ACTION_CONTRACT_INVALID");
  const keys = new Set();
  return value.map((source) => {
    const key = String(source?.key || "").trim();
    const label = String(source?.label || "").trim();
    const kind = String(source?.kind || "");
    const targetType = String(source?.targetType || "none");
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(key) || keys.has(key) || !label || label.length > 120) {
      throwErr("ITEM_ACTION_CONTRACT_INVALID");
    }
    if (!["use", "consume", "combine"].includes(kind) || !["none", "role"].includes(targetType)) {
      throwErr("ITEM_ACTION_CONTRACT_INVALID");
    }
    keys.add(key);
    const combineWithItemIds = [...new Set((source.combineWithItemIds || []).map(String))];
    const resultText = String(source.resultText || "").trim();
    const consumeQuantity = Number(source.consumeQuantity || 0);
    const combineConsumeQuantity = Number(source.combineConsumeQuantity || 0);
    if (![consumeQuantity, combineConsumeQuantity].every((quantity) => Number.isSafeInteger(quantity) && quantity >= 0 && quantity <= 99)) {
      throwErr("ITEM_ACTION_CONTRACT_INVALID");
    }
    if (combineWithItemIds.length > 50 || resultText.length > 2000
        || (kind === "combine" && combineWithItemIds.length === 0)) {
      throwErr("ITEM_ACTION_CONTRACT_INVALID");
    }
    return {
      key,
      label,
      kind,
      targetType,
      requiresHostConfirmation: Boolean(source.requiresHostConfirmation),
      consumeQuantity,
      combineConsumeQuantity,
      combineWithItemIds,
      resultText,
    };
  });
}

export function addStudioItem({ request, reply, actorId, worldId, body }) {
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertEditor(client, { worldId, actorId });
    await assertAsset(client, { worldId, assetId: body.assetId });
    return createStudioItem(client, {
      worldId,
      name: body.name.trim(),
      publicText: body.publicText ?? "",
      hostText: body.hostText ?? "",
      metadata: itemMetadata(body)
    });
  }, {
    sendErr,
    statusCode: 201,
    configureClient: configureStudioItemTransaction
  });
}

export function reviseStudioItem({ request, reply, actorId, worldId, itemId, body }) {
  if (body.name !== undefined && !String(body.name).trim()) throwErr("NAME_EMPTY");
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertEditor(client, { worldId, actorId });
    const current = await lockStudioItem(client, { worldId, itemId });
    if (!current) throwErr("ITEM_NOT_FOUND");
    if (body.assetId !== undefined) await assertAsset(client, { worldId, assetId: body.assetId });
    return updateStudioItem(client, {
      worldId,
      itemId,
      name: body.name?.trim() ?? current.name,
      publicText: body.publicText ?? current.public_text,
      hostText: body.hostText ?? current.host_text,
      metadata: itemMetadata(body, current.metadata ?? {})
    });
  }, { sendErr, configureClient: configureStudioItemTransaction });
}

export function removeStudioItem({ request, reply, actorId, worldId, itemId }) {
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertEditor(client, { worldId, actorId });
    if (!await lockStudioItem(client, { worldId, itemId })) throwErr("ITEM_NOT_FOUND");
    await assertRuntimeObjectDeletionAllowed(client, {
      worldId,
      field: "items",
      objectId: itemId
    });
    const references = await readStudioItemReferenceCounts(client, { worldId, itemId });
    const total = Object.values(references).reduce((sum, value) => sum + Number(value ?? 0), 0);
    if (total > 0) throwErr("ITEM_REFERENCED", undefined, { references });
    await deleteStudioItem(client, { worldId, itemId });
    return { ok: true };
  }, { sendErr, configureClient: configureStudioItemTransaction });
}
