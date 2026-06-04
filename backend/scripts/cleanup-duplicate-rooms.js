/**
 * Remove duplicate per-user experience rooms (catalog join spam).
 * Keeps one room per (world_id, host_user_id): prefers FOG-HARBOR-DEMO if owned,
 * else the room with the most active members, else the oldest created_at.
 *
 * Usage: node scripts/cleanup-duplicate-rooms.js
 * Dry-run: DRY_RUN=true node scripts/cleanup-duplicate-rooms.js
 */
import { pool } from "../src/db.js";

const PROTECTED_INVITES = new Set(["FOG-HARBOR-DEMO", "FOG-E2E-AUTO"]);
const dryRun = process.env.DRY_RUN === "true";

const client = await pool.connect();
try {
  const groups = await client.query(
    `SELECT world_id, host_user_id, COUNT(*)::int AS n
     FROM rooms
     GROUP BY world_id, host_user_id
     HAVING COUNT(*) > 1`
  );

  if (!groups.rowCount) {
    console.log("[cleanup-rooms] 未发现重复运行房，无需清理。");
    process.exit(0);
  }

  let deleted = 0;
  for (const g of groups.rows) {
    const rooms = await client.query(
      `SELECT r.id, r.name, r.invite_code, r.created_at,
              COUNT(rm.user_id) FILTER (WHERE rm.status = 'active')::int AS active_members
       FROM rooms r
       LEFT JOIN room_members rm ON rm.room_id = r.id
       WHERE r.world_id = $1 AND r.host_user_id = $2
       GROUP BY r.id
       ORDER BY
         CASE WHEN r.invite_code = ANY($3::text[]) THEN 0 ELSE 1 END,
         active_members DESC,
         r.created_at ASC`,
      [g.world_id, g.host_user_id, [...PROTECTED_INVITES]]
    );

    const keep = rooms.rows[0];
    const drop = rooms.rows.slice(1);
    console.log(
      `[cleanup-rooms] world=${g.world_id} host=${g.host_user_id}: 保留「${keep.name}」(${keep.invite_code}), 删除 ${drop.length} 个重复`
    );
    for (const room of drop) {
      if (PROTECTED_INVITES.has(room.invite_code)) {
        console.warn(`  跳过受保护邀请码: ${room.invite_code}`);
        continue;
      }
      if (!dryRun) {
        await client.query(`DELETE FROM rooms WHERE id = $1`, [room.id]);
      }
      console.log(`  ${dryRun ? "[dry-run] 将删除" : "已删除"}: ${room.name} (${room.invite_code})`);
      deleted += 1;
    }
  }

  const orphans = await client.query(
    `SELECT r.id, r.name, r.invite_code
     FROM rooms r
     WHERE (r.name LIKE '体验 · %' OR r.name LIKE '我的运行房 · %')
       AND NOT EXISTS (
         SELECT 1 FROM room_members rm
         WHERE rm.room_id = r.id AND rm.status = 'active'
       )
       AND r.invite_code <> ALL($1::text[])`,
    [[...PROTECTED_INVITES]]
  );
  for (const room of orphans.rows) {
    if (!dryRun) await client.query(`DELETE FROM rooms WHERE id = $1`, [room.id]);
    console.log(`  ${dryRun ? "[dry-run] 将删除空房" : "已删除空房"}: ${room.name} (${room.invite_code})`);
    deleted += 1;
  }

  console.log(
    dryRun
      ? `[cleanup-rooms] dry-run 完成，将删除 ${deleted} 个房间。去掉 DRY_RUN 后正式执行。`
      : `[cleanup-rooms] 完成，共删除 ${deleted} 个重复/空运行房。`
  );
} finally {
  client.release();
  await pool.end();
}
