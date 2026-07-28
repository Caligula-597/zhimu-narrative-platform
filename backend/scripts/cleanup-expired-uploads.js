import { query, pool } from "../src/db.js";
import { getObjectStorage } from "../src/storage/index.js";

try {
  const assetUploads = await query(
    `SELECT us.id AS upload_session_id, a.id AS asset_id, a.object_key
     FROM upload_sessions us
     JOIN asset_files a ON a.id = us.asset_file_id
     WHERE us.status = 'created' AND us.expires_at <= now()`
  );
  for (const upload of assetUploads.rows) {
    await getObjectStorage().deleteObject({ key: upload.object_key });
    await query(`DELETE FROM asset_files WHERE id = $1`, [upload.asset_id]);
    console.log(`Removed expired upload ${upload.upload_session_id}`);
  }

  const profileUploads = await query(
    `SELECT id, object_key
     FROM portal_profile_avatar_uploads
     WHERE status = 'created' AND expires_at <= now()`
  );
  for (const upload of profileUploads.rows) {
    await getObjectStorage().deleteObject({ key: upload.object_key }).catch(() => {});
    await query(
      `UPDATE portal_profile_avatar_uploads
       SET status = 'cancelled'
       WHERE id = $1 AND status = 'created'`,
      [upload.id]
    );
    console.log(`Removed expired portal profile avatar upload ${upload.id}`);
  }
} finally {
  await pool.end();
}
