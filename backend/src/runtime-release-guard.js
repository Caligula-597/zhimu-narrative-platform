import { throwErr } from "./api-errors.js";

const RELEASE_FIELDS = new Set([
  "chapters",
  "roles",
  "sections",
  "scenes",
  "clues",
  "investigationPoints",
  "items",
  "edges",
  "rules",
  "segments",
  "playerTasks"
]);

export async function assertRuntimeObjectDeletionAllowed(client, {
  worldId,
  field,
  objectId
}) {
  if (!RELEASE_FIELDS.has(field)) throw new TypeError(`Unsupported release field: ${field}`);
  const result = await client.query(
    `SELECT room.id AS room_id, room.name AS room_name,
            release.id AS release_id, release.release_number
     FROM rooms room
     JOIN world_releases release ON release.id = room.release_id
     WHERE room.world_id = $1
       AND release.snapshot->$2 @> jsonb_build_array(jsonb_build_object('id', $3::text))
     ORDER BY room.created_at DESC
     LIMIT 1`,
    [worldId, field, objectId]
  );
  if (result.rowCount) {
    const reference = result.rows[0];
    throwErr("RELEASE_BOUND_CONTENT_IN_USE", undefined, {
      field,
      objectId,
      roomId: reference.room_id,
      roomName: reference.room_name,
      releaseId: reference.release_id,
      releaseNumber: Number(reference.release_number)
    });
  }
}

export async function assertNoFrozenRuntimeRooms(client, worldId) {
  const result = await client.query(
    `SELECT room.id AS room_id, room.name AS room_name,
            release.id AS release_id, release.release_number
     FROM rooms room
     JOIN world_releases release ON release.id = room.release_id
     WHERE room.world_id = $1
     ORDER BY room.created_at DESC
     LIMIT 1`,
    [worldId]
  );
  if (result.rowCount) {
    const reference = result.rows[0];
    throwErr("RELEASE_BOUND_CONTENT_IN_USE", undefined, {
      roomId: reference.room_id,
      roomName: reference.room_name,
      releaseId: reference.release_id,
      releaseNumber: Number(reference.release_number)
    });
  }
}
