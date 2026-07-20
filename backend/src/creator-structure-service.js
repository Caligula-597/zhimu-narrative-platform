import { sendErr, throwErr } from "./api-errors.js";
import { normalizeCreatorStructureError } from "./creator-structure-errors.js";
import {
  configureCreatorStructureTransaction,
  lockCreatorStructureEditor
} from "./repositories/creator-structure-access-repository.js";
import { runRevisionMutation } from "./world-revision.js";

export async function assertCreatorStructureEditor(client, { worldId, actorId }) {
  const role = await lockCreatorStructureEditor(client, { worldId, actorId });
  if (!role) throwErr("WORLD_ACCESS_DENIED");
  if (!["owner", "editor"].includes(role)) throwErr("WORLD_EDITOR_REQUIRED");
}

export async function runCreatorStructureMutation({
  request,
  reply,
  worldId,
  statusCode,
  write
}) {
  try {
    return await runRevisionMutation(request, reply, worldId, write, {
      sendErr,
      statusCode,
      configureClient: configureCreatorStructureTransaction
    });
  } catch (error) {
    throw normalizeCreatorStructureError(error);
  }
}
