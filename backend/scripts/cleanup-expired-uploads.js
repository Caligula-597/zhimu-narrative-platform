import { pool } from "../src/db.js";
import { cleanupExpiredUploads } from "../src/expired-upload-cleanup.js";

try {
  const summary = await cleanupExpiredUploads();
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed) process.exitCode = 1;
} finally {
  await pool.end();
}
