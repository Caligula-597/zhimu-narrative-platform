import { query, transaction } from "../db.js";
import { sendErr } from "../api-errors.js";
import {
  parseIfMatch,
  setWorldRevisionHeaders,
  updateWorldContent
} from "../world-revision.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { assertWorldCreateQuota, assertStorageBytesQuota, assertSingleFileQuota } from "../quota-guards.js";
import { parseCreatorDocument } from "../document-parser.js";
import { deleteOwnedWorld } from "../world-delete.js";
import { listWorldHostAuditLog } from "../audit-log.js";
import { requireVerifiedEmail } from "../email-verification-policy.js";
import { assertCapability } from "../capabilities.js";
import {
  inviteWorldCollaborator,
  addRegisteredWorldCollaborator,
  resendWorldCollaboratorInvite,
  revokePendingWorldCollaboratorInvite,
  listPendingWorldInvites,
  normalizeCollaboratorEmail
} from "../world-collaboration.js";
import { acceptWorldMemberInviteToken } from "../world-invites.js";
import { submitCatalogReviewRequest } from "../catalog-review.js";
import { joinPublicCatalogWorld } from "../catalog-join-service.js";
import { enrichWorldMembership, enrichWorldMembershipList } from "../membership-labels.js";
import {
  updateWorldSchema,
  worldIdParams,
  createWorldSchema,
  deleteWorldSchema,
  addWorldMemberSchema,
  updateWorldMemberSchema,
  deleteWorldMemberSchema,
  updateWorldCatalogSchema,
  requestCatalogReviewSchema,
  joinWorldCatalogSchema
} from "./schemas.js";

export async function registerWorldRoutes(app) {
  app.get("/api/worlds", async (request) => {
    const actorId = requireActor(request);
    const includeArchived = String(request.query?.includeArchived ?? "") === "true";
    const result = await query(
      `SELECT DISTINCT ON (id) id, name, summary, status, catalog_public, catalog_review_status, catalog_review_submitted_at, catalog_review_note, membership_role, updated_at
       FROM (
         SELECT w.id, w.name, w.summary, w.status, w.catalog_public, w.catalog_review_status, w.catalog_review_submitted_at, w.catalog_review_note, wm.role::text AS membership_role, w.updated_at,
                CASE wm.role WHEN 'owner' THEN 4 WHEN 'editor' THEN 3 WHEN 'host' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END AS role_rank
         FROM worlds w
         JOIN world_members wm ON wm.world_id = w.id
         WHERE wm.user_id = $1
           AND ($2::boolean OR w.status <> 'archived')
         UNION ALL
         SELECT w.id, w.name, w.summary, w.status, w.catalog_public, w.catalog_review_status, w.catalog_review_submitted_at, w.catalog_review_note, 'player' AS membership_role, w.updated_at, 0 AS role_rank
         FROM worlds w
         JOIN rooms r ON r.world_id = w.id
         JOIN room_members rm ON rm.room_id = r.id
         WHERE rm.user_id = $1
           AND rm.status = 'active'
           AND ($2::boolean OR w.status <> 'archived')
       ) visible_worlds
       ORDER BY id, role_rank DESC, updated_at DESC`,
      [actorId, includeArchived]
    );
    return enrichWorldMembershipList(
      result.rows.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).map(({ updated_at, ...world }) => world)
    );
  });

  app.get("/api/worlds/catalog", async (request) => {
    requireActor(request);
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
      `SELECT w.id, w.name, w.summary, w.status, w.catalog_public, w.catalog_review_status, w.catalog_review_submitted_at, w.catalog_review_note, w.settings, w.created_at, w.updated_at, w.content_revision,
              wm.role AS membership_role
       FROM worlds w
       JOIN world_members wm ON wm.world_id = w.id AND wm.user_id = $2
       WHERE w.id = $1`,
      [worldId, actorId]
    );
    if (!result.rowCount) return sendErr(reply, "WORLD_NOT_FOUND");
    const world = enrichWorldMembership(result.rows[0]);
    if (world.content_revision != null) world.content_revision = Number(world.content_revision);
    setWorldRevisionHeaders(reply, world.content_revision);
    return world;
  });

  app.patch("/api/worlds/:worldId", { schema: updateWorldSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor"]);
    const { name, summary, settings } = request.body ?? {};
    const ifMatch = parseIfMatch(request);
    try {
      const row = await transaction(async (client) =>
        updateWorldContent(client, worldId, { name, summary, settings }, ifMatch)
      );
      setWorldRevisionHeaders(reply, row.content_revision);
      return { ...row, content_revision: Number(row.content_revision) };
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
  });

  app.post("/api/worlds", { schema: createWorldSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    await assertCapability(actorId, "world.create");
    const { name, summary = "", settings = {} } = request.body ?? {};
    await assertWorldCreateQuota(actorId);
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
    if (catalogPublic) return sendErr(reply, "CATALOG_SELF_PUBLISH_DISABLED");
    const result = await query(
      `UPDATE worlds SET catalog_public = false, catalog_review_status = 'none', updated_at = now()
       WHERE id = $1
       RETURNING id, name, summary, status, catalog_public, catalog_review_status, created_at, updated_at`,
      [worldId]
    );
    return result.rows[0];
  });

  app.post("/api/worlds/:worldId/catalog/request", { schema: requestCatalogReviewSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    const row = await submitCatalogReviewRequest(actorId, worldId, request.body ?? {});
    return reply.code(201).send(row);
  });

  app.post("/api/worlds/:worldId/catalog/join", { schema: joinWorldCatalogSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    await requireVerifiedEmail(actorId);
    const { worldId } = request.params;
    try {
      const payload = await joinPublicCatalogWorld(actorId, worldId);
      return reply.code(201).send(payload);
    } catch (error) {
      if (error.code && error.statusCode) {
        return sendErr(reply, error.code, error.message, error.details);
      }
      throw error;
    }
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
    const [members, pendingInvites] = await Promise.all([
      query(
        `SELECT wm.user_id, u.email, u.display_name, wm.role, wm.created_at
         FROM world_members wm JOIN users u ON u.id = wm.user_id
         WHERE wm.world_id = $1 ORDER BY wm.created_at`,
        [worldId]
      ),
      listPendingWorldInvites(worldId)
    ]);
    return { members: members.rows, pendingInvites };
  });

  app.post("/api/worlds/invites/accept", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["token"],
        properties: { token: { type: "string", minLength: 16, maxLength: 128 } }
      }
    }
  }, async (request, reply) => {
    const actorId = requireActor(request);
    await assertCapability(actorId, "world.collaborate");
    const result = await acceptWorldMemberInviteToken(actorId, request.body.token.trim());
    return reply.code(200).send({ ok: true, ...result });
  });

  app.post("/api/worlds/:worldId/members", { schema: addWorldMemberSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner"]);
    await assertCapability(actorId, "world.collaborate");
    const email = normalizeCollaboratorEmail(request.body?.email);
    const role = String(request.body?.role ?? "viewer");
    if (!["editor", "host", "viewer"].includes(role)) return sendErr(reply, "COLLABORATION_ROLE_INVALID");

    const direct = await addRegisteredWorldCollaborator({ worldId, email, role, invitedByUserId: actorId });
    if (direct) {
      return reply.code(201).send({ ...direct, pendingInvite: false, emailSent: false });
    }

    try {
      const invite = await inviteWorldCollaborator({ worldId, email, role, invitedByUserId: actorId });
      return reply.code(201).send(invite);
    } catch (error) {
      if (error.code && error.statusCode) {
        return sendErr(reply, error.code, error.message, error.details);
      }
      throw error;
    }
  });

  app.post("/api/worlds/:worldId/invites/:inviteId/resend", {
    schema: {
      params: {
        type: "object",
        required: ["worldId", "inviteId"],
        properties: {
          worldId: { type: "string", format: "uuid" },
          inviteId: { type: "string", format: "uuid" }
        }
      }
    }
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, inviteId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner"]);
    await assertCapability(actorId, "world.collaborate");
    try {
      const result = await resendWorldCollaboratorInvite({ worldId, inviteId, invitedByUserId: actorId });
      return reply.code(200).send(result);
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
  });

  app.delete("/api/worlds/:worldId/invites/:inviteId", {
    schema: {
      params: {
        type: "object",
        required: ["worldId", "inviteId"],
        properties: {
          worldId: { type: "string", format: "uuid" },
          inviteId: { type: "string", format: "uuid" }
        }
      }
    }
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, inviteId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner"]);
    await assertCapability(actorId, "world.collaborate");
    try {
      return await revokePendingWorldCollaboratorInvite({ worldId, inviteId });
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
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
