import { query, pool } from "../src/db.js";
import { getObjectStorage } from "../src/storage/index.js";

try {
  const result = await query(
    `SELECT us.id AS upload_session_id, a.id AS asset_id, a.object_key
     FROM upload_sessions us
     JOIN asset_files a ON a.id = us.asset_file_id
     WHERE us.status = 'created' AND us.expires_at <= now()`
  );
  for (const upload of result.rows) {
    await getObjectStorage().deleteObject({ key: upload.object_key });
    await query(`DELETE FROM asset_files WHERE id = $1`, [upload.asset_id]);
    console.log(`Removed expired upload ${upload.upload_session_id}`);
  }
} finally {
  await pool.end();
}
