import { query } from "./db.js";
import { throwErr } from "./api-errors.js";

export async function loadImportSource(worldId) {
  const result = await query(
    `SELECT w.settings->'importSource' AS import_source,
            m.body AS manuscript_body,
            m.last_sync_direction AS manuscript_sync,
            m.updated_at AS manuscript_updated_at
     FROM worlds w
     LEFT JOIN story_manuscripts m ON m.world_id = w.id
     WHERE w.id = $1`,
    [worldId]
  );
  if (!result.rowCount) throwErr("WORLD_NOT_FOUND");
  const row = result.rows[0];
  const importSource = row.import_source && typeof row.import_source === "object" ? row.import_source : null;
  return {
    importSource,
    manuscript: {
      body: row.manuscript_body || "",
      lastSyncDirection: row.manuscript_sync || null,
      updatedAt: row.manuscript_updated_at || null
    },
    hasSnapshot: Boolean(importSource?.body)
  };
}
