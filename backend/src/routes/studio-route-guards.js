import { throwErr } from "../api-errors.js";

const STUDIO_NODE_TABLES = {
  chapter: "chapters",
  scene: "scenes",
  clue: "clues",
  investigation_point: "investigation_points"
};

export async function assertWorldEntity(client, table, id, worldId, code) {
  if (!id) return;
  const result = await client.query(`SELECT 1 FROM ${table} WHERE id = $1 AND world_id = $2`, [id, worldId]);
  if (!result.rowCount) throwErr(code);
}

export async function assertStoryEdgeEndpoint(client, worldId, type, id) {
  const table = STUDIO_NODE_TABLES[type];
  if (!table) throwErr("NODE_TYPE_UNSUPPORTED");
  await assertWorldEntity(client, table, id, worldId, "STUDIO_NODE_NOT_FOUND");
}
