import { transaction } from "./db.js";
import { deleteOwnedWorld } from "./world-delete.js";
import { updateWorldContent } from "./world-revision.js";

export function updateWorld(worldId, patch, ifMatch) {
  return transaction((client) => updateWorldContent(client, worldId, patch, ifMatch));
}

export function createOwnedWorld(actorId, { name, summary = "", settings = {} }) {
  return transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO worlds (owner_user_id, name, summary, settings) VALUES ($1, $2, $3, $4::jsonb) RETURNING *`,
      [actorId, name, summary, JSON.stringify(settings)]
    );
    await client.query(
      `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [result.rows[0].id, actorId]
    );
    return result.rows[0];
  });
}

export function deleteWorldOwnedBy(worldId, actorId) {
  return transaction((client) => deleteOwnedWorld(client, worldId, actorId));
}
