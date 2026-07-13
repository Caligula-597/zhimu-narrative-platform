import { query } from "../db.js";
import { sendErr, throwErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { normalizeSegmentOperations } from "../segment-contract.js";
import { syncWorldSegmentsFromChapters } from "../world-segments-seed.js";
import { runRevisionMutation } from "../world-revision.js";
import { requireWorldReader, requireWorldRole } from "./route-guards.js";
import {
  createSegmentSchema, updateSegmentSchema, worldIdParams
} from "./schemas.js";

async function replaceSegmentRefs(client, segmentId, refs = []) {
  await client.query(`DELETE FROM world_segment_refs WHERE segment_id = $1`, [segmentId]);
  if (!refs.length) return;
  const values = [];
  const placeholders = refs.map((ref, index) => {
    const offset = index * 5;
    values.push(segmentId, ref.refType, ref.refId, ref.roleSlotId ?? null, JSON.stringify(ref.metadata ?? {}));
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}::jsonb)`;
  });
  await client.query(
    `INSERT INTO world_segment_refs (segment_id, ref_type, ref_id, role_slot_id, metadata)
     VALUES ${placeholders.join(", ")}`,
    values
  );
}

async function fetchSegmentRefs(client, segmentId) {
  const result = await client.query(
    `SELECT ref_type, ref_id, role_slot_id, metadata
     FROM world_segment_refs WHERE segment_id = $1 ORDER BY created_at`,
    [segmentId]
  );
  return result.rows.map((row) => ({
    refType: row.ref_type, refId: row.ref_id,
    roleSlotId: row.role_slot_id, metadata: row.metadata ?? {}
  }));
}

export function toSegmentDto(row) {
  return {
    id: row.id, worldId: row.world_id, segmentKey: row.segment_key,
    title: row.title, sequence: row.sequence, chapterId: row.chapter_id,
    story: row.story ?? {}, mechanics: row.mechanics ?? {},
    operations: normalizeSegmentOperations(row.operations ?? {}),
    quality: row.quality ?? {}, metadata: row.metadata ?? {}, refs: row.refs ?? []
  };
}

export async function registerContentPlatformSegmentRoutes(app) {
  app.get("/api/worlds/:worldId/segments", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldReader(actorId, worldId);
    const result = await query(
      `SELECT ws.*,
              COALESCE(json_agg(jsonb_build_object(
                'refType', wsr.ref_type, 'refId', wsr.ref_id,
                'roleSlotId', wsr.role_slot_id, 'metadata', wsr.metadata
              ) ORDER BY wsr.created_at) FILTER (WHERE wsr.id IS NOT NULL), '[]'::json) AS refs
       FROM world_segments ws
       LEFT JOIN world_segment_refs wsr ON wsr.segment_id = ws.id
       WHERE ws.world_id = $1
       GROUP BY ws.id
       ORDER BY ws.sequence, ws.created_at`,
      [worldId]
    );
    return { segments: result.rows.map(toSegmentDto) };
  });

  app.post("/api/worlds/:worldId/segments/sync-from-graph", { schema: { params: worldIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(request, reply, worldId, async (client) => ({
      segmentsSynced: await syncWorldSegmentsFromChapters(client, worldId)
    }), { sendErr });
  });

  app.post("/api/worlds/:worldId/segments", { schema: createSegmentSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(
        `INSERT INTO world_segments
          (world_id, segment_key, title, sequence, chapter_id, story, mechanics, operations, quality, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb)
         RETURNING *`,
        [worldId, body.segmentKey, body.title, body.sequence ?? 1, body.chapterId ?? null,
          JSON.stringify(body.story ?? {}), JSON.stringify(body.mechanics ?? {}),
          JSON.stringify(normalizeSegmentOperations(body.operations ?? {})),
          JSON.stringify(body.quality ?? {}), JSON.stringify(body.metadata ?? {})]
      );
      await replaceSegmentRefs(client, result.rows[0].id, body.refs ?? []);
      return { segment: toSegmentDto({ ...result.rows[0], refs: body.refs ?? [] }) };
    }, { sendErr, statusCode: 201 });
  });

  app.patch("/api/worlds/:worldId/segments/:segmentId", { schema: updateSegmentSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, segmentId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const existing = await client.query(`SELECT * FROM world_segments WHERE id = $1 AND world_id = $2`, [segmentId, worldId]);
      if (!existing.rowCount) throwErr("NOT_FOUND", "Segment not found");
      const next = existing.rows[0];
      const result = await client.query(
        `UPDATE world_segments SET segment_key = $3, title = $4, sequence = $5,
           chapter_id = $6, story = $7::jsonb, mechanics = $8::jsonb,
           operations = $9::jsonb, quality = $10::jsonb, metadata = $11::jsonb,
           updated_at = now()
         WHERE id = $1 AND world_id = $2 RETURNING *`,
        [segmentId, worldId, body.segmentKey ?? next.segment_key, body.title ?? next.title,
          body.sequence ?? next.sequence, body.chapterId === undefined ? next.chapter_id : body.chapterId,
          JSON.stringify(body.story ?? next.story ?? {}), JSON.stringify(body.mechanics ?? next.mechanics ?? {}),
          JSON.stringify(normalizeSegmentOperations(body.operations ?? next.operations ?? {})),
          JSON.stringify(body.quality ?? next.quality ?? {}), JSON.stringify(body.metadata ?? next.metadata ?? {})]
      );
      if (body.refs) await replaceSegmentRefs(client, segmentId, body.refs);
      const refs = body.refs ?? await fetchSegmentRefs(client, segmentId);
      return { segment: toSegmentDto({ ...result.rows[0], refs }) };
    }, { sendErr });
  });
}
