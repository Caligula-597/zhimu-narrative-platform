import { randomUUID } from "node:crypto";
import { throwErr } from "./api-errors.js";
import { transactionWithEvents } from "./transaction-events.js";
import {
  ROOM_EXPERIENCE_STATE_KINDS,
  normalizeRoomExperienceIdentity,
  normalizeRoomExperiencePayload,
} from "./room-experience-state.js";
import {
  findRoomExperienceState,
  insertRoomExperienceState,
  listRoomExperienceStates,
  updateRoomExperienceState,
} from "./repositories/room-experience-state-repository.js";
import {
  configureItemActionTransaction,
  consumeInventoryItem,
  itemActionTargetExists,
  lockInventoryItem,
} from "./repositories/item-action-repository.js";

const STATE_KIND = ROOM_EXPERIENCE_STATE_KINDS.ITEM_ACTION;
const SCOPE_KEY = "inventory_action";

function identity(actionId, visibility = "role") {
  return normalizeRoomExperienceIdentity({
    stateKind: STATE_KIND,
    scopeKey: SCOPE_KEY,
    subjectKey: actionId,
    visibility,
  });
}

export function projectItemAction(state, { audience = "player" } = {}) {
  const payload = state?.payload || state || {};
  const result = {
    actionId: payload.actionId,
    itemId: payload.itemId,
    actionKey: payload.actionKey,
    actionKind: payload.actionKind,
    label: payload.label,
    roleSlotId: payload.roleSlotId,
    targetType: payload.targetType,
    targetId: payload.targetId,
    combineItemId: payload.combineItemId,
    status: payload.status,
    resultText: payload.resultText || "",
    submittedAt: payload.submittedAt,
    resolvedAt: payload.resolvedAt,
    revision: state?.revision || 0,
  };
  if (audience === "host") {
    result.consumeQuantity = payload.consumeQuantity;
    result.combineConsumeQuantity = payload.combineConsumeQuantity;
    result.requiresHostConfirmation = payload.requiresHostConfirmation;
    result.failureCode = payload.failureCode || null;
  }
  return result;
}

function authoredAction(item, actionKey) {
  return (item?.metadata?.itemActions || []).find((action) => action.key === actionKey) || null;
}

async function assertActionInputs(client, { roomId, roleSlotId, itemId, actionKey, targetType, targetId, combineItemId }) {
  const item = await lockInventoryItem(client, { roomId, roleSlotId, itemId });
  if (!item) throwErr("ITEM_NOT_OWNED");
  const action = authoredAction(item, actionKey);
  if (!action) throwErr("ITEM_ACTION_NOT_ALLOWED");
  if (action.targetType !== targetType) throwErr("ITEM_ACTION_TARGET_INVALID");
  if (!await itemActionTargetExists(client, { roomId, targetType, targetId })) throwErr("ITEM_ACTION_TARGET_INVALID");
  let combineItem = null;
  if (action.kind === "combine") {
    if (!combineItemId || !(action.combineWithItemIds || []).includes(combineItemId) || combineItemId === itemId) {
      throwErr("ITEM_ACTION_COMBINATION_INVALID");
    }
    combineItem = await lockInventoryItem(client, { roomId, roleSlotId, itemId: combineItemId });
    if (!combineItem) throwErr("ITEM_ACTION_COMBINATION_INVALID");
  }
  if (Number(item.quantity) < Number(action.consumeQuantity || 0)
      || (combineItem && Number(combineItem.quantity) < Number(action.combineConsumeQuantity || 0))) {
    throwErr("ITEM_QUANTITY_INSUFFICIENT");
  }
  return { item, action, combineItem };
}

async function consumeForAction(client, payload) {
  const primary = await consumeInventoryItem(client, {
    roomId: payload.roomId,
    roleSlotId: payload.roleSlotId,
    itemId: payload.itemId,
    quantity: payload.consumeQuantity,
  });
  if (!primary) return false;
  if (payload.combineItemId) {
    return consumeInventoryItem(client, {
      roomId: payload.roomId,
      roleSlotId: payload.roleSlotId,
      itemId: payload.combineItemId,
      quantity: payload.combineConsumeQuantity,
    });
  }
  return true;
}

function eventPayload(state) {
  const itemAction = projectItemAction(state);
  return {
    actionId: itemAction.actionId,
    roleSlotId: itemAction.roleSlotId,
    status: itemAction.status,
    revision: itemAction.revision,
  };
}

export async function submitItemAction({ roomId, roleSlotId, actorId, itemId, actionKey, targetType = "none", targetId = null, combineItemId = null }) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configureItemActionTransaction(client);
    const { action } = await assertActionInputs(client, {
      roomId, roleSlotId, itemId, actionKey, targetType, targetId, combineItemId,
    });
    const actionId = randomUUID();
    const submittedAt = new Date().toISOString();
    const payload = normalizeRoomExperiencePayload(STATE_KIND, {
      actionId,
      itemId,
      actionKey,
      actionKind: action.kind,
      label: action.label,
      roleSlotId,
      targetType,
      targetId,
      combineItemId,
      consumeQuantity: Number(action.consumeQuantity || 0),
      combineConsumeQuantity: Number(action.combineConsumeQuantity || 0),
      requiresHostConfirmation: Boolean(action.requiresHostConfirmation),
      status: action.requiresHostConfirmation ? "pending" : "approved",
      resultText: action.resultText || "",
      failureCode: null,
      submittedAt,
      resolvedAt: action.requiresHostConfirmation ? null : submittedAt,
    });
    if (!action.requiresHostConfirmation && !await consumeForAction(client, { ...payload, roomId })) {
      throwErr("ITEM_QUANTITY_INSUFFICIENT");
    }
    const state = await insertRoomExperienceState(client, {
      roomId,
      ...identity(actionId, "role"),
      payload,
      actorId,
    });
    if (!state) throwErr("ITEM_ACTION_VERSION_CONFLICT");
    queueEvent(roomId, "room.item_action_updated", eventPayload(state));
    return { itemAction: projectItemAction(state) };
  });
}

export async function listPlayerItemActions({ roomId, roleSlotId }) {
  const states = await listRoomExperienceStates(roomId, { stateKind: STATE_KIND, limit: 100 });
  return { itemActions: states.filter((state) => state.payload?.roleSlotId === roleSlotId).map(projectItemAction) };
}

export async function listHostItemActions(roomId) {
  const states = await listRoomExperienceStates(roomId, { stateKind: STATE_KIND, limit: 200 });
  return { itemActions: states.map((state) => projectItemAction(state, { audience: "host" })) };
}

export async function resolveItemAction({ roomId, actionId, actorId, expectedRevision, decision }) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configureItemActionTransaction(client);
    const current = await findRoomExperienceState(roomId, {
      stateKind: STATE_KIND,
      scopeKey: SCOPE_KEY,
      subjectKey: actionId,
      client,
      forUpdate: true,
    });
    if (!current) throwErr("ITEM_ACTION_NOT_FOUND");
    if (current.revision !== expectedRevision) throwErr("ITEM_ACTION_VERSION_CONFLICT");
    if (current.payload?.status !== "pending") return { itemAction: projectItemAction(current, { audience: "host" }) };
    let status = decision === "approve" ? "approved" : "rejected";
    let failureCode = null;
    if (status === "approved") {
      const owned = await lockInventoryItem(client, {
        roomId,
        roleSlotId: current.payload.roleSlotId,
        itemId: current.payload.itemId,
      });
      const combineOwned = !current.payload.combineItemId || await lockInventoryItem(client, {
        roomId,
        roleSlotId: current.payload.roleSlotId,
        itemId: current.payload.combineItemId,
      });
      const enough = owned
        && Number(owned.quantity) >= Number(current.payload.consumeQuantity || 0)
        && combineOwned
        && (!current.payload.combineItemId
          || Number(combineOwned.quantity) >= Number(current.payload.combineConsumeQuantity || 0));
      if (!enough) {
        status = "failed";
        failureCode = "ITEM_QUANTITY_INSUFFICIENT";
      } else if (!await consumeForAction(client, { ...current.payload, roomId })) {
        throwErr("ITEM_ACTION_VERSION_CONFLICT");
      }
    }
    const payload = normalizeRoomExperiencePayload(STATE_KIND, {
      ...current.payload,
      status,
      failureCode,
      resolvedAt: new Date().toISOString(),
    });
    const saved = await updateRoomExperienceState(client, {
      roomId,
      ...identity(actionId, "role"),
      expectedRevision,
      payload,
      actorId,
    });
    if (!saved) throwErr("ITEM_ACTION_VERSION_CONFLICT");
    queueEvent(roomId, "room.item_action_updated", eventPayload(saved));
    return { itemAction: projectItemAction(saved, { audience: "host" }) };
  });
}
