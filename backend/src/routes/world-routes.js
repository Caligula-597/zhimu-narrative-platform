import { query, transaction } from "../db.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { sendErr } from "../api-errors.js";
import { storageUsage } from "./world-helpers.js";
import { parseCreatorDocument } from "../document-parser.js";
import { deleteOwnedWorld } from "../world-delete.js";
import { listWorldHostAuditLog } from "../audit-log.js";
import {
  updateWorldSchema,
  worldIdParams,
  createWorldSchema,
  deleteWorldSchema,
  addWorldMemberSchema,
  updateWorldMemberSchema,
  deleteWorldMemberSchema,
  updateWorldCatalogSchema,
  joinWorldCatalogSchema
} from "./schemas.js";

const ROLE_RANK = { viewer: 0, host: 1, editor: 2, owner: 3 };

function catalogInviteCode() {
  return `PLAY-${Date.now().toString(36).toUpperCase().slice(-8)}`;
}

export async function registerWorldRoutes(app) {
  app.get("/api/worlds", async (request) => {
    const actorId = requireActor(request);
    const includeArchived = String(request.query?.includeArchived ?? "") === "true";
    const result = await query(
      `SELECT w.id, w.name, w.summary, w.status, w.catalog_public, wm.role AS membership_role
       FROM worlds w
       JOIN world_members wm ON wm.world_id = w.id
       WHERE wm.user_id = $1
         AND ($2::boolean OR w.status <> 'archived')
       ORDER BY w.updated_at DESC`,
      [actorId, includeArchived]
    );
    return result.rows;
  });

  const PLATFORM_CATALOG_WORLD_ID = "08646748-e4ae-446a-a5e7-ce59ca23ffc3";

  app.get("/api/worlds/catalog", async (request) => {
    requireActor(request);
    await query(
      `UPDATE worlds SET catalog_public = true, updated_at = now()
       WHERE id = $1 AND status <> 'archived'`,
      [PLATFORM_CATALOG_WORLD_ID]
    );
    const result = await query(
      `SELECT w.id, w.name, w.summary, w.status, w.catalog_public, w.updated_at,
              u.display_name AS owner_display_name,
              (SELECT COUNT(*)::int FROM role_slots rs WHERE rs.world_id = w.id) AS role_count
       FROM worlds w
       JOIN users u ON u.id = w.owner_user_id
       WHERE w.catalog_public = true
         AND w.status <> 'archived'
         AND EXISTS (SELECT 1 FROM role_slots rs WHERE rs.world_id = w.id)
       ORDER BY w.updated_at DESC`
    );
    return result.rows;
  });

  app.get("/api/worlds/:worldId", { schema: { params: worldIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "host", "viewer"]);
    const result = await query(
      `SELECT w.id, w.name, w.summary, w.status, w.catalog_public, w.settings, w.created_at, w.updated_at,
              wm.role AS membership_role
       FROM worlds w
       JOIN world_members wm ON wm.world_id = w.id AND wm.user_id = $2
       WHERE w.id = $1`,
      [worldId, actorId]
    );
    if (!result.rowCount) return sendErr(reply, "WORLD_NOT_FOUND");
    return result.rows[0];
  });

  app.patch("/api/worlds/:worldId", { schema: updateWorldSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor"]);
    const { name, summary, settings } = request.body ?? {};
    const result = await query(
      `UPDATE worlds
       SET name = COALESCE($2, name),
           summary = COALESCE($3, summary),
           settings = CASE WHEN $4::jsonb IS NULL THEN settings ELSE COALESCE(settings, '{}'::jsonb) || $4::jsonb END,
           updated_at = now()
       WHERE id = $1
       RETURNING id, name, summary, status, settings, created_at, updated_at`,
      [worldId, name ?? null, summary ?? null, settings ? JSON.stringify(settings) : null]
    );
    if (!result.rowCount) return sendErr(reply, "WORLD_NOT_FOUND");
    return result.rows[0];
  });

  app.post("/api/worlds", { schema: createWorldSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { name, summary = "", settings = {} } = request.body ?? {};
    const quota = await storageUsage(actorId);
    const worldCount = await query(`SELECT COUNT(*)::int AS count FROM worlds WHERE owner_user_id = $1 AND status <> 'archived'`, [actorId]);
    if (worldCount.rows[0].count >= quota.max_worlds) {
      return sendErr(reply, "WORLD_QUOTA_EXCEEDED");
    }
    const world = await transaction(async (client) => {
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
    return reply.code(201).send(world);
  });

  app.patch("/api/worlds/:worldId/catalog", { schema: updateWorldCatalogSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    const owner = await query(`SELECT owner_user_id FROM worlds WHERE id = $1`, [worldId]);
    if (!owner.rowCount) return sendErr(reply, "WORLD_NOT_FOUND");
    if (owner.rows[0].owner_user_id !== actorId) return sendErr(reply, "WORLD_OWNER_REQUIRED");
    const catalogPublic = Boolean(request.body?.catalogPublic);
    const result = await query(
      `UPDATE worlds SET catalog_public = $2, updated_at = now()
       WHERE id = $1
       RETURNING id, name, summary, status, catalog_public, created_at, updated_at`,
      [worldId, catalogPublic]
    );
    return result.rows[0];
  });

  app.post("/api/worlds/:worldId/catalog/join", { schema: joinWorldCatalogSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    const world = await query(
      `SELECT id, name, catalog_public, status FROM worlds WHERE id = $1`,
      [worldId]
    );
    if (!world.rowCount) return sendErr(reply, "WORLD_NOT_FOUND");
    if (!world.rows[0].catalog_public || world.rows[0].status === "archived") {
      return sendErr(reply, "CATALOG_NOT_PUBLIC");
    }
    const user = await query(`SELECT display_name FROM users WHERE id = $1`, [actorId]);
    const displayName = user.rows[0]?.display_name || "玩家";
    const session = await transaction(async (client) => {
      const membership = await client.query(
        `SELECT role FROM world_members WHERE world_id = $1 AND user_id = $2`,
        [worldId, actorId]
      );
      let membershipRole = membership.rows[0]?.role;
      if (!membershipRole) {
        await client.query(
          `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'host')`,
          [worldId, actorId]
        );
        membershipRole = "host";
      } else if (ROLE_RANK[membershipRole] < ROLE_RANK.host) {
        await client.query(
          `UPDATE world_members SET role = 'host' WHERE world_id = $1 AND user_id = $2`,
          [worldId, actorId]
        );
        membershipRole = "host";
      }
      const existingRoom = await client.query(
        `SELECT id, name, invite_code FROM rooms
         WHERE world_id = $1 AND host_user_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [worldId, actorId]
      );
      let room;
      if (existingRoom.rowCount) {
        room = existingRoom.rows[0];
        await client.query(`UPDATE rooms SET updated_at = now() WHERE id = $1`, [room.id]);
      } else {
        const roomName = `我的运行房 · ${displayName}`.slice(0, 120);
        const roomResult = await client.query(
          `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
           VALUES ($1, $2, $3, $4, 'testing') RETURNING id, name, invite_code`,
          [worldId, actorId, roomName, catalogInviteCode()]
        );
        room = roomResult.rows[0];
      }
      await client.query(
        `INSERT INTO room_members (room_id, user_id, member_type) VALUES ($1, $2, 'host')
         ON CONFLICT DO NOTHING`,
        [room.id, actorId]
      );
      await client.query(
        `INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id)
         VALUES ($1, '公共讨论房', 'public', $2)`,
        [room.id, actorId]
      );
      return { membershipRole, room };
    });
    return reply.code(201).send({
      worldId,
      worldName: world.rows[0].name,
      membershipRole: session.membershipRole,
      room: session.room
    });
  });

  app.delete("/api/worlds/:worldId", { schema: deleteWorldSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner"]);
    try {
      const deleted = await transaction((client) => deleteOwnedWorld(client, worldId, actorId));
      if (!deleted) return sendErr(reply, "WORLD_NOT_FOUND");
      return { ok: true };
    } catch (error) {
      if (error.code === "23503" || error.code === "WORLD_DELETE_BLOCKED") {
        return sendErr(
          reply,
          "WORLD_DELETE_BLOCKED",
          "无法删除剧本：仍有平行房或运行数据未清理。若使用 Docker，请执行 npm run staging:rebuild-api 重建后端后重试。"
        );
      }
      throw error;
    }
  });

  app.get("/api/worlds/:worldId/members", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "host"]);
    const result = await query(
      `SELECT wm.user_id, u.email, u.display_name, wm.role, wm.created_at
       FROM world_members wm JOIN users u ON u.id = wm.user_id
       WHERE wm.world_id = $1 ORDER BY wm.created_at`,
      [worldId]
    );
    return result.rows;
  });

  app.post("/api/worlds/:worldId/members", { schema: addWorldMemberSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner"]);
    const email = String(request.body?.email ?? "").trim().toLowerCase();
    const role = String(request.body?.role ?? "viewer");
    if (!["editor", "host", "viewer"].includes(role)) return sendErr(reply, "COLLABORATION_ROLE_INVALID");
    const user = await query(`SELECT id, email, display_name FROM users WHERE email = $1`, [email]);
    if (!user.rowCount) return sendErr(reply, "COLLABORATOR_NOT_REGISTERED");
    await query(
      `INSERT INTO world_members (world_id, user_id, role) VALUES ($1,$2,$3)
       ON CONFLICT (world_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [worldId, user.rows[0].id, role]
    );
    return reply.code(201).send({ ...user.rows[0], role });
  });

  app.put("/api/worlds/:worldId/members/:userId", { schema: updateWorldMemberSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, userId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner"]);
    const role = String(request.body?.role ?? "");
    if (!["editor", "host", "viewer"].includes(role)) return sendErr(reply, "COLLABORATION_ROLE_INVALID");
    const result = await query(`UPDATE world_members SET role = $1 WHERE world_id = $2 AND user_id = $3 AND role <> 'owner' RETURNING user_id, role`, [role, worldId, userId]);
    if (!result.rowCount) return sendErr(reply, "COLLABORATION_MEMBER_NOT_FOUND");
    return result.rows[0];
  });

  app.delete("/api/worlds/:worldId/members/:userId", { schema: deleteWorldMemberSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, userId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner"]);
    const result = await query(`DELETE FROM world_members WHERE world_id = $1 AND user_id = $2 AND role <> 'owner' RETURNING user_id`, [worldId, userId]);
    if (!result.rowCount) return sendErr(reply, "COLLABORATION_MEMBER_NOT_FOUND", "Collaboration member not found or owner cannot be removed");
    return { ok: true };
  });

  app.get("/api/worlds/:worldId/logs", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "host"]);
    const roomId = String(request.query?.roomId ?? "");
    const eventType = String(request.query?.eventType ?? "");
    const keyword = String(request.query?.keyword ?? "").slice(0, 120);
    const limit = Math.max(1, Math.min(200, Number(request.query?.limit) || 80));
    const result = await query(
      `SELECT tl.id, tl.room_id, r.name AS room_name, tl.event_type, tl.message, tl.visibility,
              tl.metadata, tl.created_at, u.display_name AS actor_name
       FROM timeline_logs tl JOIN rooms r ON r.id = tl.room_id
       LEFT JOIN users u ON u.id = tl.actor_user_id
       WHERE r.world_id = $1 AND ($2::uuid IS NULL OR tl.room_id = $2::uuid)
         AND ($3 = '' OR tl.event_type = $3) AND ($4 = '' OR tl.message ILIKE '%' || $4 || '%')
       ORDER BY tl.created_at DESC LIMIT $5`,
      [worldId, roomId || null, eventType, keyword, limit]
    );
    return result.rows;
  });

  app.get("/api/worlds/:worldId/host-audit-log", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "host"]);
    const limit = Math.min(Math.max(Number(request.query?.limit) || 50, 1), 200);
    const entries = await listWorldHostAuditLog(worldId, { limit });
    return { entries };
  });

}
