import { query } from "./db.js";

const DEFAULT_VERSION = 1;

export async function loadMainlineHierarchyDraft(worldId) {
  const result = await query(
    `SELECT version, draft, updated_at
     FROM mainline_hierarchy_drafts
     WHERE world_id = $1`,
    [worldId]
  );
  const row = result.rows[0];
  return {
    version: row?.version || DEFAULT_VERSION,
    draft: row?.draft && typeof row.draft === "object" ? row.draft : {},
    updatedAt: row?.updated_at || null
  };
}

export async function saveMainlineHierarchyDraft(client, worldId, draft, actorId) {
  const result = await client.query(
    `INSERT INTO mainline_hierarchy_drafts
       (world_id, version, draft, updated_by_user_id)
     VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (world_id) DO UPDATE
     SET version = EXCLUDED.version,
         draft = EXCLUDED.draft,
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         updated_at = now()
     RETURNING version, draft, updated_at`,
    [worldId, DEFAULT_VERSION, JSON.stringify(draft), actorId]
  );
  const row = result.rows[0];
  return {
    version: row.version,
    draft: row.draft,
    updatedAt: row.updated_at
  };
}
