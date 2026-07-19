import { sendErr, throwErr } from "./api-errors.js";
import { runRevisionMutation } from "./world-revision.js";
import {
  configureStudioInvestigationTransaction,
  createInvestigationPoint,
  lockInvestigationReferences,
  lockStudioInvestigationEditor,
  updateInvestigationPoint
} from "./repositories/studio-investigation-repository.js";

async function assertEditor(client, { worldId, actorId }) {
  const role = await lockStudioInvestigationEditor(client, { worldId, actorId });
  if (!role) throwErr("WORLD_ACCESS_DENIED");
  if (!["owner", "editor"].includes(role)) throwErr("WORLD_EDITOR_REQUIRED");
}

async function assertReferences(client, {
  worldId,
  sceneId,
  clueId,
  requiredItemId,
  requiredRoleSlotId,
  sceneErrorCode
}) {
  const refs = await lockInvestigationReferences(client, {
    worldId,
    sceneId,
    clueId,
    requiredItemId,
    requiredRoleSlotId
  });
  if (sceneId && !refs.scene_id) throwErr(sceneErrorCode);
  if (clueId && !refs.clue_id) throwErr("CLUE_WORLD_MISMATCH");
  if (requiredItemId && !refs.required_item_id) throwErr("ITEM_NOT_FOUND");
  if (requiredRoleSlotId && !refs.required_role_slot_id) throwErr("ROLE_SLOT_WORLD_MISMATCH");
}

export async function reviseInvestigationPoint({ request, reply, actorId, worldId, pointId, payload }) {
  const name = payload.name === undefined ? undefined : String(payload.name).trim();
  if (name === "") throwErr("NAME_EMPTY");

  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertEditor(client, { worldId, actorId });
    await assertReferences(client, {
      worldId,
      sceneId: payload.sceneId,
      clueId: payload.clueId,
      requiredItemId: payload.requiredItemId,
      requiredRoleSlotId: payload.requiredRoleSlotId,
      sceneErrorCode: "SCENE_WORLD_MISMATCH"
    });
    const updated = await updateInvestigationPoint(client, {
      worldId,
      pointId,
      ...payload,
      name
    });
    if (!updated) throwErr("INVESTIGATION_POINT_NOT_FOUND");
    return updated;
  }, { sendErr, configureClient: configureStudioInvestigationTransaction });
}

export async function addInvestigationPoint({ request, reply, actorId, worldId, sceneId, payload }) {
  const name = String(payload.name ?? "").trim();
  if (!name) throwErr("NAME_EMPTY");

  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertEditor(client, { worldId, actorId });
    await assertReferences(client, {
      worldId,
      sceneId,
      clueId: payload.clueId,
      requiredItemId: payload.requiredItemId,
      requiredRoleSlotId: payload.requiredRoleSlotId,
      sceneErrorCode: "SCENE_NOT_FOUND"
    });
    return createInvestigationPoint(client, {
      worldId,
      sceneId,
      name,
      description: payload.description ?? "",
      interactionText: payload.interactionText ?? "",
      resultText: payload.resultText ?? "",
      clueId: payload.clueId ?? null,
      requiredItemId: payload.requiredItemId ?? null,
      requiredRoleSlotId: payload.requiredRoleSlotId ?? null,
      sequence: payload.sequence ?? 0,
      metadata: payload.metadata ?? {}
    });
  }, {
    sendErr,
    statusCode: 201,
    configureClient: configureStudioInvestigationTransaction
  });
}
