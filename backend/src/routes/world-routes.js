import { sendErr } from "../api-errors.js";
import {
  parseIfMatch,
  setWorldRevisionHeaders
} from "../world-revision.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { assertWorldCreateQuota, assertStorageBytesQuota, assertSingleFileQuota } from "../quota-guards.js";
import { parseCreatorDocument } from "../document-parser.js";
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
import { attachTagsToWorldRows, buildCatalogTagFilterSql, parseCatalogTagFilters } from "../world-tags.js";
import { enrichWorldMembership, enrichWorldMembershipList } from "../membership-labels.js";
import { projectWorldForMembership } from "../world-settings-visibility.js";
import {
  findWorldForMember,
  findWorldOwnerId,
  listPublicCatalogWorlds,
  listVisibleWorlds,
  listWorldMembers,
  listWorldTimelineLogs,
  removeWorldMember,
  unpublishWorldCatalog,
  updateWorldMemberRole
} from "../repositories/world-repository.js";
import { createOwnedWorld, deleteWorldOwnedBy, updateWorld } from "../world-service.js";
import { createWorldSchema } from "./schemas/creator-assets.js";
import {
  updateWorldSchema,
  worldIdParams,
  deleteWorldSchema,
  addWorldMemberSchema,
  updateWorldMemberSchema,
  deleteWorldMemberSchema,
  listWorldLogsSchema,
  updateWorldCatalogSchema,
  requestCatalogReviewSchema,
  joinWorldCatalogSchema
} from "./schemas/world.js";

export async function registerWorldRoutes(app) {
  app.get("/api/worlds", async (request) => {
    const actorId = requireActor(request);
    const includeArchived = String(request.query?.includeArchived ?? "") === "true";
    const rows = await listVisibleWorlds(actorId, includeArchived);
    return enrichWorldMembershipList(
      rows.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).map(({ updated_at, ...world }) => world)
    );
  });

  app.get("/api/worlds/catalog", async (request) => {
    requireActor(request);
    const tagFilters = parseCatalogTagFilters(request.query || {});
    const { sql: tagSql, params: tagParams } = buildCatalogTagFilterSql(tagFilters, 1);
    const rows = await listPublicCatalogWorlds({ tagSql, tagParams });
    return attachTagsToWorldRows(rows);
  });

  app.get("/api/worlds/:worldId", { schema: { params: worldIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "reviewer", "host", "viewer"]);
    const row = await findWorldForMember(worldId, actorId);
    if (!row) return sendErr(reply, "WORLD_NOT_FOUND");
    const world = enrichWorldMembership(projectWorldForMembership(row));
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
      const row = await updateWorld(worldId, { name, summary, settings }, ifMatch);
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
    const world = await createOwnedWorld(actorId, { name, summary, settings });
    return reply.code(201).send(world);
  });

  app.patch("/api/worlds/:worldId/catalog", { schema: updateWorldCatalogSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    const ownerId = await findWorldOwnerId(worldId);
    if (!ownerId) return sendErr(reply, "WORLD_NOT_FOUND");
    if (ownerId !== actorId) return sendErr(reply, "WORLD_OWNER_REQUIRED");
    const catalogPublic = Boolean(request.body?.catalogPublic);
    if (catalogPublic) return sendErr(reply, "CATALOG_SELF_PUBLISH_DISABLED");
    return unpublishWorldCatalog(worldId);
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
      const deleted = await deleteWorldOwnedBy(worldId, actorId);
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
    await requireWorldRole(actorId, worldId, ["owner", "editor"]);
    const [members, pendingInvites] = await Promise.all([
      listWorldMembers(worldId),
      listPendingWorldInvites(worldId)
    ]);
    return { members, pendingInvites };
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
    if (!["editor", "reviewer", "host", "viewer"].includes(role)) return sendErr(reply, "COLLABORATION_ROLE_INVALID");

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
    await assertCapability(actorId, "world.collaborate");
    const role = String(request.body?.role ?? "");
    if (!["editor", "reviewer", "host", "viewer"].includes(role)) return sendErr(reply, "COLLABORATION_ROLE_INVALID");
    const member = await updateWorldMemberRole(worldId, userId, role);
    if (!member) return sendErr(reply, "COLLABORATION_MEMBER_NOT_FOUND");
    return member;
  });

  app.delete("/api/worlds/:worldId/members/:userId", { schema: deleteWorldMemberSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, userId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner"]);
    await assertCapability(actorId, "world.collaborate");
    const member = await removeWorldMember(worldId, userId);
    if (!member) return sendErr(reply, "COLLABORATION_MEMBER_NOT_FOUND", "Collaboration member not found or owner cannot be removed");
    return { ok: true };
  });

  app.get("/api/worlds/:worldId/logs", { schema: listWorldLogsSchema }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "host"]);
    const roomId = String(request.query?.roomId ?? "");
    const eventType = String(request.query?.eventType ?? "");
    const keyword = String(request.query?.keyword ?? "").slice(0, 120);
    const limit = Math.max(1, Math.min(200, Number(request.query?.limit) || 80));
    return listWorldTimelineLogs(worldId, { roomId: roomId || null, eventType, keyword, limit });
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
