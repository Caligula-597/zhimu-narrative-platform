import { query } from "../db.js";
import { requireActor } from "../request-actor.js";
import { throwErr } from "../api-errors.js";
import { requireHostMembership } from "./content-platform-room-access.js";
import { listRoomVotes } from "./content-platform-vote-helpers.js";
import { roomIdParams } from "./schemas.js";

async function requireRoomWorldId(roomId) {
  const result = await query(`SELECT world_id FROM rooms WHERE id = $1`, [roomId]);
  if (!result.rowCount) throwErr("ROOM_NOT_FOUND");
  return result.rows[0].world_id;
}

export async function registerContentPlatformRunReportRoutes(app) {
  app.get("/api/rooms/:roomId/run-report", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const worldId = await requireRoomWorldId(roomId);
    const [reading, clues, votes] = await Promise.all([
      query(
        `SELECT ss.id, ss.title, count(rp.*)::int AS started_count,
                count(rp.completed_at)::int AS completed_count
         FROM script_sections ss
         JOIN role_slots rs ON rs.id = ss.role_slot_id
         LEFT JOIN reading_progress rp ON rp.script_section_id = ss.id AND rp.room_id = $1
         WHERE rs.world_id = $2
         GROUP BY ss.id, ss.title
         ORDER BY completed_count ASC, started_count DESC`,
        [roomId, worldId]
      ),
      query(
        `SELECT c.id, c.name, count(co.*)::int AS acquired_count,
                count(co.read_at)::int AS read_count
         FROM clues c
         LEFT JOIN clue_ownership co ON co.clue_id = c.id AND co.room_id = $1
         WHERE c.world_id = $2
         GROUP BY c.id, c.name
         ORDER BY acquired_count ASC, read_count ASC`,
        [roomId, worldId]
      ),
      listRoomVotes(query, roomId, { host: true })
    ]);
    const suggestions = clues.rows
      .filter((clue) => clue.acquired_count === 0)
      .map((clue) => ({
        type: "clue_missing",
        title: `线索「${clue.name}」本场未被获取`,
        detail: "复盘时建议检查发放条件，或在下一版前移提示。"
      }));
    return { reading: reading.rows, clues: clues.rows, votes, suggestions };
  });
}
