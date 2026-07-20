import { query } from "./db.js";
import { updateClueOwnershipHostNote } from "./repositories/host-monitor-repository.js";
import { fetchHostClueMatrix } from "./routes/clue-helpers.js";
import { fetchHostPlayerDetail, fetchHostPlayers } from "./routes/host-helpers.js";
import { assertRoleInRoomWorld } from "./routes/host-route-guards.js";

export function getHostPlayers(roomId) {
  return fetchHostPlayers(query, roomId);
}

export function getHostClueMatrix(roomId) {
  return fetchHostClueMatrix(query, roomId);
}

export async function setHostClueNote({ roomId, roleSlotId, clueId, hostNote }) {
  await assertRoleInRoomWorld(query, roomId, roleSlotId);
  return updateClueOwnershipHostNote(query, { roomId, roleSlotId, clueId, hostNote });
}

export function getHostPlayerDetail(roomId, roleSlotId) {
  return fetchHostPlayerDetail(query, roomId, roleSlotId);
}

export async function getHostProgress(roomId) {
  const players = await getHostPlayers(roomId);
  return players.map((player) => ({
    role_slot_id: player.role_slot_id,
    name: player.role_name,
    total_sections: player.total_sections,
    completed_sections: player.completed_sections,
    current_scene_id: player.current_scene_id,
    updated_at: player.last_activity_at
  }));
}
