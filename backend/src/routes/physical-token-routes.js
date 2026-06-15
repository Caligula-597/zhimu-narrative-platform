import { query, transaction } from "../db.js";
import { transactionWithEvents } from "../transaction-events.js";
import { evaluateRoomRules } from "../rule-engine.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole, requireRoomRole } from "./route-guards.js";
import { sendErr } from "../api-errors.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import {
  createPhysicalTokens,
  listPhysicalTokens,
  getPhysicalTokenByCode,
  revokePhysicalToken,
  activatePhysicalToken,
  PHYSICAL_TOKEN_CONTENT_TYPES
} from "../physical-token-service.js";
import {
  worldIdParams,
  physicalTokenIdParams,
  createPhysicalTokensSchema,
  listPhysicalTokensSchema,
  revokePhysicalTokenSchema,
  physicalTokenPreviewSchema,
  activatePhysicalTokenSchema
} from "./schemas.js";

export async function registerPhysicalTokenRoutes(app) {
  app.get("/api/worlds/:worldId/physical-tokens", { schema: listPhysicalTokensSchema }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { status, contentType, limit, offset } = request.query ?? {};
    const tokens = await listPhysicalTokens(worldId, { status, contentType, limit, offset });
    return { tokens, total: tokens.length };
  });

  app.post("/api/worlds/:worldId/physical-tokens", { schema: createPhysicalTokensSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    const body = request.body ?? {};
    await requireWorldRole(actorId, worldId);

    if (!PHYSICAL_TOKEN_CONTENT_TYPES.includes(body.contentType)) {
      return sendErr(reply, "PHYSICAL_TOKEN_CONTENT_TYPE_INVALID");
    }

    const tokens = await transaction(async (client) =>
      createPhysicalTokens(client, {
        worldId,
        actorId,
        contentType: body.contentType,
        contentId: body.contentId,
        count: body.count ?? 1,
        label: body.label ?? "",
        tokenCode: body.tokenCode ?? null,
        activationRule: body.activationRule ?? {},
        metadata: body.metadata ?? {},
        expiresAt: body.expiresAt ?? null
      })
    );

    return reply.code(201).send({ tokens, created: tokens.length });
  });

  app.post("/api/worlds/:worldId/physical-tokens/:tokenId/revoke", { schema: revokePhysicalTokenSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, tokenId } = request.params;
    await requireWorldRole(actorId, worldId);
    const token = await transaction(async (client) => revokePhysicalToken(client, worldId, tokenId));
    return { ok: true, token };
  });

  app.get("/api/physical-tokens/:tokenCode/preview", { schema: physicalTokenPreviewSchema }, async (request, reply) => {
    requireActor(request);
    let token;
    try {
      token = await getPhysicalTokenByCode(request.params.tokenCode);
    } catch {
      return sendErr(reply, "PHYSICAL_TOKEN_NOT_FOUND");
    }
    return {
      tokenCode: token.tokenCode,
      status: token.status,
      label: token.label,
      worldId: token.worldId,
      worldName: token.worldName,
      contentType: token.contentType,
      contentTitle: token.contentTitle,
      expiresAt: token.expiresAt,
      integration: token.metadata?.integration ?? null,
      requiresTumpProof: Boolean(
        token.activationRule?.externalGate?.required
        || (token.metadata?.integration?.provider === "tump" && token.activationRule?.externalGate?.required)
      )
    };
  });

  app.post("/api/rooms/:roomId/physical-tokens/activate", { schema: activatePhysicalTokenSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { tokenCode, externalProof = null } = request.body ?? {};
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) {
      return sendErr(reply, "PHYSICAL_TOKEN_PLAYER_ROLE_REQUIRED");
    }

    const room = await query(`SELECT world_id FROM rooms WHERE id = $1`, [roomId]);
    if (!room.rowCount) return sendErr(reply, "ROOM_NOT_FOUND");

    return withRoomIdempotency(roomId, request, "player.activate_physical_token", async () => {
      const result = await transactionWithEvents(async (client, queueEvent) =>
        activatePhysicalToken(client, {
          roomId,
          worldId: room.rows[0].world_id,
          roleSlotId: membership.role_slot_id,
          userId: actorId,
          tokenCode,
          externalProof
        }, queueEvent)
      );
      const executedRules = await evaluateRoomRules(roomId);
      return { ...result, executedRules };
    });
  });
}
