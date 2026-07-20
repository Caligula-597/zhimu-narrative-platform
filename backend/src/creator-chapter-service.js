import { throwErr } from "./api-errors.js";
import {
  assertCreatorStructureEditor,
  runCreatorStructureMutation
} from "./creator-structure-service.js";
import {
  insertCreatorChapter,
  lockCreatorChapter,
  updateCreatorChapter
} from "./repositories/creator-chapter-repository.js";

export function addCreatorChapter({ request, reply, actorId, worldId, body }) {
  const title = String(body?.title ?? "").trim();
  if (!title) throwErr("TITLE_EMPTY");
  return runCreatorStructureMutation({
    request,
    reply,
    worldId,
    statusCode: 201,
    write: async (client) => {
      await assertCreatorStructureEditor(client, { worldId, actorId });
      return insertCreatorChapter(client, {
        worldId,
        title,
        summary: body.summary ?? "",
        sequence: body.sequence
      });
    }
  });
}

export function reviseCreatorChapter({ request, reply, actorId, worldId, chapterId, body }) {
  const title = String(body?.title ?? "").trim();
  if (!title) throwErr("TITLE_EMPTY");
  return runCreatorStructureMutation({
    request,
    reply,
    worldId,
    write: async (client) => {
      await assertCreatorStructureEditor(client, { worldId, actorId });
      const current = await lockCreatorChapter(client, { worldId, chapterId });
      if (!current) throwErr("CHAPTER_NOT_FOUND");
      return updateCreatorChapter(client, {
        chapterId,
        title,
        summary: body.summary ?? current.summary,
        publicationStatus: body.publicationStatus ?? current.publication_status,
        unlockRules: body.unlockRules ?? current.unlock_rules,
        metadata: body.metadata === undefined
          ? current.metadata
          : { ...(current.metadata ?? {}), ...body.metadata }
      });
    }
  });
}
