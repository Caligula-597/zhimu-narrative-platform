import { httpError, sendErr, throwErr } from "./api-errors.js";
import {
  bulkUpdateStudioCluePaths,
  configureStudioSceneClueTransaction,
  createStudioClue,
  createStudioScene,
  findStudioCluePathReferences,
  lockSceneChapterReference,
  lockStudioSceneClueEditor,
  updateStudioClue,
  updateStudioScene
} from "./repositories/studio-scene-clue-repository.js";
import { runRevisionMutation } from "./world-revision.js";

export function normalizeStudioSceneClueError(error) {
  if (["40P01", "55P03"].includes(error?.code)) {
    return httpError(409, "Studio content is busy; retry shortly", "STUDIO_WRITE_BUSY");
  }
  if (error?.code === "57014") {
    return httpError(503, "Studio content write exceeded its safe execution window", "STUDIO_WRITE_TIMEOUT");
  }
  return error;
}

async function assertEditor(client, { worldId, actorId }) {
  const role = await lockStudioSceneClueEditor(client, { worldId, actorId });
  if (!role) throwErr("WORLD_ACCESS_DENIED");
  if (!["owner", "editor"].includes(role)) throwErr("WORLD_EDITOR_REQUIRED");
}

async function assertChapter(client, { worldId, chapterId }) {
  if (!chapterId) return;
  if (!await lockSceneChapterReference(client, { worldId, chapterId })) {
    throwErr("CHAPTER_NOT_FOUND");
  }
}

function normalizedName(value) {
  const name = String(value ?? "").trim();
  if (!name) throwErr("NAME_EMPTY");
  return name;
}

function optionalPathKey(value, field, maxLength) {
  if (value == null || value === "") return null;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > maxLength) {
    throwErr("CLUE_PATH_INVALID", `${field} is invalid`);
  }
  return normalized;
}

export function normalizeCluePathBinding(body = {}) {
  const clueIds = [...new Set((body.clueIds || []).map(String).filter(Boolean))];
  if (!clueIds.length || clueIds.length > 200) {
    throwErr("CLUE_PATH_INVALID", "clueIds must contain between 1 and 200 clues");
  }
  const locationId = optionalPathKey(body.locationId, "locationId", 160);
  const segmentKey = optionalPathKey(body.segmentKey, "segmentKey", 120);
  const allowUnbound = body.allowUnbound === true;
  if (allowUnbound && (locationId || segmentKey)) {
    throwErr("CLUE_PATH_INVALID", "allowUnbound cannot be combined with a bound path");
  }
  if (!allowUnbound && !locationId && !segmentKey) {
    throwErr("CLUE_PATH_INVALID", "a location, segment or explicit allowUnbound decision is required");
  }
  return { clueIds, locationId, segmentKey, allowUnbound };
}

function mapLocationExists(settings, locationId) {
  if (!locationId) return true;
  const locations = settings?.tabletopMapDesign?.locations;
  return Array.isArray(locations) && locations.some((location) => location?.id === locationId);
}

export async function addStudioScene({ request, reply, actorId, worldId, body }) {
  const name = normalizedName(body.name);
  try {
    return await runRevisionMutation(request, reply, worldId, async (client) => {
      await assertEditor(client, { worldId, actorId });
      await assertChapter(client, { worldId, chapterId: body.chapterId });
      return createStudioScene(client, {
        worldId,
        chapterId: body.chapterId ?? null,
        name,
        publicText: body.publicText ?? "",
        hostText: body.hostText ?? "",
        metadata: body.metadata ?? {}
      });
    }, {
      sendErr,
      statusCode: 201,
      configureClient: configureStudioSceneClueTransaction
    });
  } catch (error) {
    throw normalizeStudioSceneClueError(error);
  }
}

export async function addStudioClue({ request, reply, actorId, worldId, body }) {
  const name = normalizedName(body.name);
  try {
    return await runRevisionMutation(request, reply, worldId, async (client) => {
      await assertEditor(client, { worldId, actorId });
      return createStudioClue(client, {
        worldId,
        name,
        publicText: body.publicText ?? "",
        hostText: body.hostText ?? "",
        visibility: body.visibility ?? "role",
        clueKind: body.clueKind ?? "general",
        metadata: body.metadata ?? {}
      });
    }, {
      sendErr,
      statusCode: 201,
      configureClient: configureStudioSceneClueTransaction
    });
  } catch (error) {
    throw normalizeStudioSceneClueError(error);
  }
}

export async function reviseStudioScene({ request, reply, actorId, worldId, sceneId, body }) {
  const name = body.name === undefined ? undefined : normalizedName(body.name);
  try {
    return await runRevisionMutation(request, reply, worldId, async (client) => {
      await assertEditor(client, { worldId, actorId });
      await assertChapter(client, { worldId, chapterId: body.chapterId });
      const updated = await updateStudioScene(client, {
        worldId,
        sceneId,
        name,
        publicText: body.publicText,
        hostText: body.hostText,
        chapterId: body.chapterId,
        metadata: body.metadata ?? {}
      });
      if (!updated) throwErr("SCENE_NOT_FOUND");
      return updated;
    }, { sendErr, configureClient: configureStudioSceneClueTransaction });
  } catch (error) {
    throw normalizeStudioSceneClueError(error);
  }
}

export async function reviseStudioClue({ request, reply, actorId, worldId, clueId, body }) {
  const name = body.name === undefined ? undefined : normalizedName(body.name);
  try {
    return await runRevisionMutation(request, reply, worldId, async (client) => {
      await assertEditor(client, { worldId, actorId });
      const updated = await updateStudioClue(client, {
        worldId,
        clueId,
        name,
        publicText: body.publicText,
        hostText: body.hostText,
        visibility: body.visibility,
        clueKind: body.clueKind,
        metadata: body.metadata ?? {}
      });
      if (!updated) throwErr("CLUE_NOT_FOUND");
      return updated;
    }, { sendErr, configureClient: configureStudioSceneClueTransaction });
  } catch (error) {
    throw normalizeStudioSceneClueError(error);
  }
}

export async function bindStudioCluePaths({ request, reply, actorId, worldId, body }) {
  const binding = normalizeCluePathBinding(body);
  try {
    return await runRevisionMutation(request, reply, worldId, async (client) => {
      await assertEditor(client, { worldId, actorId });
      const references = await findStudioCluePathReferences(client, {
        worldId,
        segmentKey: binding.segmentKey
      });
      if (!references?.segment_exists) throwErr("CLUE_SEGMENT_NOT_FOUND");
      if (!mapLocationExists(references?.settings, binding.locationId)) {
        throwErr("CLUE_LOCATION_NOT_FOUND");
      }
      const updated = await bulkUpdateStudioCluePaths(client, { worldId, ...binding });
      if (updated.length !== binding.clueIds.length) throwErr("CLUE_NOT_FOUND");
      return { clues: updated };
    }, { sendErr, configureClient: configureStudioSceneClueTransaction });
  } catch (error) {
    throw normalizeStudioSceneClueError(error);
  }
}
