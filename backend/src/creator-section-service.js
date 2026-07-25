import { sendErr, throwErr } from "./api-errors.js";
import {
  configureCreatorSectionTransaction,
  createCreatorSection as insertCreatorSection,
  deleteCreatorSection,
  ensureCharacterScript,
  lockCreatorSection,
  lockCreatorSectionChapter,
  lockCreatorSectionEditor,
  lockCreatorSectionRole,
  sectionSequenceExists,
  updateCreatorSection
} from "./repositories/creator-section-repository.js";
import { runRevisionMutation } from "./world-revision.js";
import { assertRuntimeObjectDeletionAllowed } from "./runtime-release-guard.js";

async function assertEditor(client, { worldId, actorId }) {
  const role = await lockCreatorSectionEditor(client, { worldId, actorId });
  if (!role) throwErr("WORLD_ACCESS_DENIED");
  if (!["owner", "editor"].includes(role)) throwErr("WORLD_EDITOR_REQUIRED");
}

async function assertChapter(client, { worldId, chapterId }) {
  if (!chapterId) return;
  if (!await lockCreatorSectionChapter(client, { worldId, chapterId })) {
    throwErr("CHAPTER_NOT_FOUND");
  }
}

export function addCreatorSection({ request, reply, actorId, worldId, roleSlotId, body }) {
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertEditor(client, { worldId, actorId });
    if (!await lockCreatorSectionRole(client, { worldId, roleSlotId })) {
      throwErr("ROLE_SLOT_WORLD_MISMATCH");
    }
    await assertChapter(client, { worldId, chapterId: body.chapterId });
    const characterScriptId = await ensureCharacterScript(client, roleSlotId);
    if (await sectionSequenceExists(client, { characterScriptId, sequence: body.sequence })) {
      throwErr("SECTION_SEQUENCE_CONFLICT");
    }
    return insertCreatorSection(client, {
      characterScriptId,
      roleSlotId,
      chapterId: body.chapterId ?? null,
      title: body.title.trim(),
      body: body.body,
      sequence: body.sequence,
      publicationStatus: body.publicationStatus ?? "draft"
    });
  }, {
    sendErr,
    statusCode: 201,
    configureClient: configureCreatorSectionTransaction
  });
}

export function reviseCreatorSection({
  request,
  reply,
  actorId,
  worldId,
  roleSlotId,
  sectionId,
  body
}) {
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertEditor(client, { worldId, actorId });
    const current = await lockCreatorSection(client, { worldId, roleSlotId, sectionId });
    if (!current) throwErr("SECTION_NOT_FOUND");
    const chapterId = body.chapterId === undefined ? current.chapter_id : body.chapterId;
    await assertChapter(client, { worldId, chapterId });
    return updateCreatorSection(client, {
      sectionId,
      title: body.title.trim(),
      body: body.body,
      chapterId,
      publicationStatus: body.publicationStatus ?? current.publication_status
    });
  }, { sendErr, configureClient: configureCreatorSectionTransaction });
}

export function removeCreatorSection({
  request,
  reply,
  actorId,
  worldId,
  roleSlotId,
  sectionId
}) {
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertEditor(client, { worldId, actorId });
    const current = await lockCreatorSection(client, { worldId, roleSlotId, sectionId });
    if (!current) throwErr("SCRIPT_SECTION_NOT_FOUND");
    await assertRuntimeObjectDeletionAllowed(client, {
      worldId,
      field: "sections",
      objectId: sectionId
    });
    await deleteCreatorSection(client, sectionId);
    return { ok: true };
  }, { sendErr, configureClient: configureCreatorSectionTransaction });
}
