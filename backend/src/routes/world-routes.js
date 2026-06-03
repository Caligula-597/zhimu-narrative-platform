import { query, transaction } from "../db.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { storageUsage } from "./world-helpers.js";
import { parseCreatorDocument } from "../document-parser.js";

export async function registerWorldRoutes(app) {
  app.get("/api/worlds", async (request) => {
    const actorId = requireActor(request);
    const includeArchived = String(request.query?.includeArchived ?? "") === "true";
    const result = await query(
      `SELECT w.id, w.name, w.summary, w.status, wm.role AS membership_role
       FROM worlds w
       JOIN world_members wm ON wm.world_id = w.id
       WHERE wm.user_id = $1
         AND ($2::boolean OR w.status <> 'archived')
       ORDER BY w.updated_at DESC`,
      [actorId, includeArchived]
    );
    return result.rows;
  });

  app.post("/api/worlds", async (request, reply) => {
    const actorId = requireActor(request);
    const { name, summary = "", settings = {} } = request.body ?? {};
    if (!name) return reply.code(400).send({ error: "name is required" });
    const quota = await storageUsage(actorId);
    const worldCount = await query(`SELECT COUNT(*)::int AS count FROM worlds WHERE owner_user_id = $1 AND status <> 'archived'`, [actorId]);
    if (worldCount.rows[0].count >= quota.max_worlds) {
      return reply.code(403).send({ error: "World quota exceeded" });
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

  app.delete("/api/worlds/:worldId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner"]);
    const result = await query(`DELETE FROM worlds WHERE id = $1 AND owner_user_id = $2 RETURNING id`, [worldId, actorId]);
    if (!result.rowCount) return reply.code(404).send({ error: "World not found" });
    return { ok: true };
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

  app.post("/api/worlds/:worldId/members", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner"]);
    const email = String(request.body?.email ?? "").trim().toLowerCase();
    const role = String(request.body?.role ?? "viewer");
    if (!["editor", "host", "viewer"].includes(role)) return reply.code(400).send({ error: "Unsupported collaboration role" });
    const user = await query(`SELECT id, email, display_name FROM users WHERE email = $1`, [email]);
    if (!user.rowCount) return reply.code(404).send({ error: "该邮箱尚未注册，请先让协作者完成注册。" });
    await query(
      `INSERT INTO world_members (world_id, user_id, role) VALUES ($1,$2,$3)
       ON CONFLICT (world_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [worldId, user.rows[0].id, role]
    );
    return reply.code(201).send({ ...user.rows[0], role });
  });

  app.put("/api/worlds/:worldId/members/:userId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, userId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner"]);
    const role = String(request.body?.role ?? "");
    if (!["editor", "host", "viewer"].includes(role)) return reply.code(400).send({ error: "Unsupported collaboration role" });
    const result = await query(`UPDATE world_members SET role = $1 WHERE world_id = $2 AND user_id = $3 AND role <> 'owner' RETURNING user_id, role`, [role, worldId, userId]);
    if (!result.rowCount) return reply.code(404).send({ error: "Collaboration member not found or owner cannot be changed" });
    return result.rows[0];
  });

  app.delete("/api/worlds/:worldId/members/:userId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, userId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner"]);
    const result = await query(`DELETE FROM world_members WHERE world_id = $1 AND user_id = $2 AND role <> 'owner' RETURNING user_id`, [worldId, userId]);
    if (!result.rowCount) return reply.code(404).send({ error: "Collaboration member not found or owner cannot be removed" });
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

}
