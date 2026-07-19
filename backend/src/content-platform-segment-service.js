import { sendErr, throwErr } from "./api-errors.js";
import { assertContentPlatformEditor } from "./content-platform-access-service.js";
import { normalizeSegmentOperations } from "./segment-contract.js";
import {
  configureContentPlatformTransaction
} from "./repositories/content-platform-access-repository.js";
import {
  createWorldSegment,
  listSegmentRefs,
  lockWorldSegment,
  replaceSegmentRefs,
  segmentKeyExists,
  updateWorldSegment,
  validateSegmentReferences
} from "./repositories/content-platform-segment-repository.js";
import { loadWorldSegments, toSegmentDto } from "./world-segment-read-service.js";
import { syncWorldSegmentsFromChapters } from "./world-segments-seed.js";
import { runRevisionMutation } from "./world-revision.js";

function assertUniqueRefs(refs = []) {
  const seen = new Set();
  for (const ref of refs) {
    const key = `${ref.refType}:${ref.refId}:${ref.roleSlotId ?? ""}`;
    if (seen.has(key)) {
      throwErr("SEGMENT_REFERENCES_INVALID", "Segment references must be unique", {
        duplicate: {
          refType: ref.refType,
          refId: ref.refId,
          roleSlotId: ref.roleSlotId ?? null
        }
      });
    }
    seen.add(key);
  }
}

async function assertReferencesInWorld(client, { worldId, chapterId, refs }) {
  assertUniqueRefs(refs);
  const validation = await validateSegmentReferences(client, { worldId, chapterId, refs });
  if (!validation.chapter_valid) throwErr("CHAPTER_NOT_FOUND");
  if (validation.invalid_refs.length) {
    throwErr("SEGMENT_REFERENCE_WORLD_MISMATCH", undefined, {
      invalidRefs: validation.invalid_refs
    });
  }
}

export function getWorldSegments(worldId) {
  return loadWorldSegments(worldId);
}

export function syncSegmentsFromGraph({ request, reply, actorId, worldId }) {
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertContentPlatformEditor(client, { worldId, actorId });
    return { segmentsSynced: await syncWorldSegmentsFromChapters(client, worldId) };
  }, { sendErr, configureClient: configureContentPlatformTransaction });
}

export function addWorldSegment({ request, reply, actorId, worldId, body }) {
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertContentPlatformEditor(client, { worldId, actorId });
    await assertReferencesInWorld(client, {
      worldId,
      chapterId: body.chapterId,
      refs: body.refs ?? []
    });
    if (await segmentKeyExists(client, { worldId, segmentKey: body.segmentKey })) {
      throwErr("CONFLICT", "Segment key already exists");
    }
    const segment = await createWorldSegment(client, {
      worldId,
      body,
      operations: normalizeSegmentOperations(body.operations ?? {})
    });
    await replaceSegmentRefs(client, segment.id, body.refs ?? []);
    return { segment: toSegmentDto({ ...segment, refs: body.refs ?? [] }) };
  }, {
    sendErr,
    statusCode: 201,
    configureClient: configureContentPlatformTransaction
  });
}

export function reviseWorldSegment({
  request,
  reply,
  actorId,
  worldId,
  segmentId,
  body
}) {
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertContentPlatformEditor(client, { worldId, actorId });
    const existing = await lockWorldSegment(client, { worldId, segmentId });
    if (!existing) throwErr("NOT_FOUND", "Segment not found");
    const values = {
      segmentKey: body.segmentKey ?? existing.segment_key,
      title: body.title ?? existing.title,
      sequence: body.sequence ?? existing.sequence,
      chapterId: body.chapterId === undefined ? existing.chapter_id : body.chapterId,
      story: body.story ?? existing.story ?? {},
      mechanics: body.mechanics ?? existing.mechanics ?? {},
      quality: body.quality ?? existing.quality ?? {},
      metadata: body.metadata ?? existing.metadata ?? {}
    };
    if (body.chapterId !== undefined || body.refs !== undefined) {
      await assertReferencesInWorld(client, {
        worldId,
        chapterId: body.chapterId === undefined ? null : body.chapterId,
        refs: body.refs ?? []
      });
    }
    if (values.segmentKey !== existing.segment_key && await segmentKeyExists(client, {
      worldId,
      segmentKey: values.segmentKey,
      excludeSegmentId: segmentId
    })) {
      throwErr("CONFLICT", "Segment key already exists");
    }
    const segment = await updateWorldSegment(client, {
      worldId,
      segmentId,
      values,
      operations: normalizeSegmentOperations(body.operations ?? existing.operations ?? {})
    });
    if (body.refs !== undefined) await replaceSegmentRefs(client, segmentId, body.refs);
    const refs = body.refs ?? await listSegmentRefs(client, segmentId);
    return { segment: toSegmentDto({ ...segment, refs }) };
  }, { sendErr, configureClient: configureContentPlatformTransaction });
}
