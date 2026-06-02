import { query, pool } from "../src/db.js";
import { getObjectStorage } from "../src/storage/index.js";

try {
  const result = await query(
    `SELECT a.id, a.object_key
     FROM deleted_assets d
     JOIN asset_files a ON a.id = d.asset_file_id
     WHERE d.purge_after <= now()`
  );
  for (const asset of result.rows) {
    await getObjectStorage().deleteObject({ key: asset.object_key });
    await query(`DELETE FROM asset_files WHERE id = $1`, [asset.id]);
    console.log(`Purged ${asset.id}`);
  }
} finally {
  await pool.end();
}
