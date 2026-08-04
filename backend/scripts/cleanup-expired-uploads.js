import { pool, query } from "../src/db.js";
import { cleanupExpiredUploads } from "../src/expired-upload-cleanup.js";
import { getObjectStorage } from "../src/storage/index.js";

try {
  const summary = await cleanupExpiredUploads();
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

  console.log(JSON.stringify({
    ...summary,
    cancelledProfileAvatarUploads: profileUploads.rowCount
  }, null, 2));
  if (summary.failed) process.exitCode = 1;
} finally {
  await pool.end();
}
