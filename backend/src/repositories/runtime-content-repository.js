import { query } from "../db.js";

export async function loadRuntimeContentRecord(roomId, runQuery = query) {
  const result = await runQuery(
    `SELECT room.id AS room_id,
            room.world_id,
            room.name AS room_name,
            room.status AS room_status,
            room.settings AS room_settings,
            room.release_id,
            world.name AS world_name,
            world.summary AS world_summary,
            world.settings AS world_settings,
            world.content_revision AS current_content_revision,
            release.release_number,
            release.label AS release_label,
            release.source_content_revision AS release_source_revision,
            release.snapshot_schema_version,
            release.snapshot AS release_snapshot,
            release.created_at AS release_created_at
     FROM rooms room
     JOIN worlds world ON world.id = room.world_id
     LEFT JOIN world_releases release ON release.id = room.release_id
     WHERE room.id = $1`,
    [roomId]
  );
  return result.rows[0] ?? null;
}
