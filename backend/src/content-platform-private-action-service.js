import { throwErr } from "./api-errors.js";
import {
  assertContentPlatformHost,
  assertContentPlatformPlayer
} from "./content-platform-access-service.js";
import {
  configureContentPlatformTransaction
} from "./repositories/content-platform-access-repository.js";
import {
  appendPrivateActionTimeline,
  createPrivateAction,
  listPrivateActionsForHost,
  listPrivateActionsForRole,
  lockPrivateAction,
  lockPrivateActionReferences,
  updatePrivateAction
} from "./repositories/content-platform-private-action-repository.js";
import { transactionWithEvents } from "./transaction-events.js";

const PRIVATE_ACTION_TRANSITIONS = {
  draft: new Set(["seen", "accepted", "rejected", "resolved", "cancelled"]),
  submitted: new Set(["seen", "accepted", "rejected", "resolved", "cancelled"]),
  seen: new Set(["accepted", "rejected", "resolved", "cancelled"]),
  accepted: new Set(["resolved", "cancelled"]),
  rejected: new Set(),
  resolved: new Set(),
  cancelled: new Set()
};

export function getPrivateActionsForRole(roomId, roleSlotId, options) {
  return listPrivateActionsForRole(roomId, roleSlotId, options);
}

export function getPrivateActionsForHost(roomId, options) {
  return listPrivateActionsForHost(roomId, options);
}

export async function submitPrivateAction({ actorId, roomId, body }) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configureContentPlatformTransaction(client);
    const membership = await assertContentPlatformPlayer(client, { roomId, actorId });
    const references = await lockPrivateActionReferences(client, {
      roomId,
      segmentId: body.segmentId,
      targetRoleSlotId: body.targetRoleSlotId
    });
    if (body.segmentId && !references.segment_id) {
      throwErr("SEGMENT_WORLD_MISMATCH");
    }
    if (body.targetRoleSlotId && !references.target_role_slot_id) {
      throwErr("ROLE_SLOT_WORLD_MISMATCH");
    }
    if (body.visibility === "actor_target_host" && !body.targetRoleSlotId) {
      throwErr("PRIVATE_ACTION_TARGET_REQUIRED");
    }

    const action = await createPrivateAction(client, {
      roomId,
      actorId,
      actorRoleSlotId: membership.role_slot_id,
      body
    });
    await appendPrivateActionTimeline(client, {
      roomId,
      actorId,
      eventType: "private_action_submitted",
      message: `玩家提交了秘密行动：「${body.title}」`,
      metadata: {
        actionId: action.id,
        actionType: body.actionType,
        roleSlotId: membership.role_slot_id
      }
    });
    queueEvent(roomId, "room.private_action_submitted", {
      actionId: action.id,
      actionType: body.actionType,
      roleSlotIds: [membership.role_slot_id, action.target_role_slot_id].filter(Boolean)
    });
    return action;
  });
}

function assertPrivateActionTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return;
  if (!PRIVATE_ACTION_TRANSITIONS[currentStatus]?.has(nextStatus)) {
    throwErr("PRIVATE_ACTION_TRANSITION_INVALID", undefined, {
      currentStatus,
      requestedStatus: nextStatus
    });
  }
}

export async function reviewPrivateAction({ actorId, roomId, actionId, body }) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configureContentPlatformTransaction(client);
    await assertContentPlatformHost(client, { roomId, actorId });
    const current = await lockPrivateAction(client, { roomId, actionId });
    if (!current) throwErr("NOT_FOUND", "Private action not found");
    assertPrivateActionTransition(current.status, body.status);

    const responseChanged = body.hostResponse !== undefined
      && body.hostResponse !== current.host_response;
    if (current.status === body.status && !responseChanged) return current;

    const updated = await updatePrivateAction(client, {
      roomId,
      actionId,
      actorId,
      status: body.status,
      hostResponse: body.hostResponse
    });
    await appendPrivateActionTimeline(client, {
      roomId,
      actorId,
      eventType: "private_action_status_updated",
      message: `秘密行动状态更新为 ${body.status}`,
      metadata: { actionId, status: body.status }
    });
    queueEvent(roomId, "room.private_action_updated", {
      actionId,
      status: body.status,
      roleSlotIds: [updated.actor_role_slot_id, updated.target_role_slot_id].filter(Boolean)
    });
    return updated;
  });
}
