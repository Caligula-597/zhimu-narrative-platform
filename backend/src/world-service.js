import { transaction } from "./db.js";
import { deleteOwnedWorld } from "./world-delete.js";
import { updateWorldContent } from "./world-revision.js";
import {
  normalizeNarrativeSettings,
  normalizeNarrativeSettingsPatch
} from "../../shared/narrative-profile.js";

export function updateWorld(worldId, patch, ifMatch) {
  const normalizedPatch = patch?.settings
    ? { ...patch, settings: normalizeNarrativeSettingsPatch(patch.settings) }
    : patch;
  return transaction((client) => updateWorldContent(client, worldId, normalizedPatch, ifMatch));
}

export function createOwnedWorld(actorId, { name, summary = "", settings = {} }) {
  const normalizedSettings = normalizeNarrativeSettings(settings);
  return transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO worlds (owner_user_id, name, summary, settings) VALUES ($1, $2, $3, $4::jsonb) RETURNING *`,
      [actorId, name, summary, JSON.stringify(normalizedSettings)]
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
