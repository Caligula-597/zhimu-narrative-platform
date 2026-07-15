import { requireActor } from "../request-actor.js";
import { sendErr } from "../api-errors.js";
import {
  subscribePlatformBroadcast,
  subscribePlatformUserEvents
} from "../platform-event-bus.js";
import { fetchPlatformEventsAfter, getLatestPlatformEventId } from "../platform-event-journal.js";
import { createReplaySubscription } from "../sse-replay-subscription.js";
import { writeSseEvent } from "../sse-response.js";
import {
  createPlazaPost,
  createPlazaReply,
  deletePlazaPost,
  deletePlazaReply,
  getPlazaPost,
  listPlazaPosts,
  listPlazaReplies,
  reportPlazaTarget
} from "../play-plaza-service.js";
import {
  listDmConversations,
  listDmMessages,
  listFriendships,
  openDmConversation,
  respondFriendRequest,
  searchPlayers,
  sendDmMessage,
  sendFriendRequest
} from "../play-social-service.js";
import {
  createPlazaPostSchema,
  createPlazaReplySchema,
  createPlazaReportSchema,
  listPlazaPostsSchema,
  listPlazaRepliesSchema,
  openDmSchema,
  playerSearchSchema,
  respondFriendSchema,
  sendDmMessageSchema,
  sendFriendRequestSchema,
  uuidParams
} from "./schemas.js";

function handleServiceError(reply, error, codes = []) {
  if (error.code && codes.includes(error.code)) {
    return sendErr(reply, error.code, error.message);
  }
  if (error.code === "RATE_LIMITED" || error.code === "AUTH_REQUIRED" || error.code === "FORBIDDEN") {
    return sendErr(reply, error.code, error.message);
  }
  throw error;
}

export async function registerPlatformSocialRoutes(app) {
  app.get(
    "/api/platform/plaza/posts",
    { schema: { tags: ["platform"], ...listPlazaPostsSchema, response: { 200: { type: "object", additionalProperties: true } } } },
    async (request) =>
      listPlazaPosts({
        kind: request.query?.kind,
        limit: request.query?.limit,
        actorId: request.actorId || null
      })
  );

  app.get(
    "/api/platform/plaza/posts/:postId",
    { schema: { tags: ["platform"], params: uuidParams("postId"), response: { 200: { type: "object", additionalProperties: true } } } },
    async (request, reply) => {
      try {
        return await getPlazaPost(request.params.postId, request.actorId || null);
      } catch (error) {
        return handleServiceError(reply, error, ["PLAZA_POST_NOT_FOUND"]);
      }
    }
  );

  app.get(
    "/api/platform/plaza/posts/:postId/replies",
    { schema: { tags: ["platform"], ...listPlazaRepliesSchema, response: { 200: { type: "object", additionalProperties: true } } } },
    async (request, reply) => {
      try {
        return await listPlazaReplies(request.params.postId, {
          limit: request.query?.limit,
          actorId: request.actorId || null
        });
      } catch (error) {
        return handleServiceError(reply, error, ["PLAZA_POST_NOT_FOUND"]);
      }
    }
  );

  app.post(
    "/api/platform/plaza/posts",
    { schema: { tags: ["platform"], ...createPlazaPostSchema, response: { 201: { type: "object", additionalProperties: true } } } },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { kind = "chat", body, inviteCode } = request.body ?? {};
      try {
        const post = await createPlazaPost({ actorId, kind, body, inviteCode });
        if (post.reviewPending) return reply.code(202).send(post);
        return reply.code(201).send(post);
      } catch (error) {
        return handleServiceError(reply, error, [
          "PLAZA_POST_INVALID",
          "PLAZA_POST_REJECTED",
          "PLAY_CONTENT_AD",
          "GUEST_ACCOUNT_RESTRICTED",
          "EMAIL_NOT_VERIFIED",
          "PLAY_SOCIAL_ACCOUNT_TOO_NEW"
        ]);
      }
    }
  );

  app.post(
    "/api/platform/plaza/posts/:postId/replies",
    { schema: { tags: ["platform"], ...createPlazaReplySchema, response: { 201: { type: "object", additionalProperties: true } } } },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { body, parentReplyId } = request.body ?? {};
      try {
        const replyRow = await createPlazaReply({
          actorId,
          postId: request.params.postId,
          body,
          parentReplyId
        });
        return reply.code(201).send(replyRow);
      } catch (error) {
        return handleServiceError(reply, error, [
          "PLAZA_POST_NOT_FOUND",
          "PLAZA_REPLY_INVALID",
          "PLAZA_REPLY_NOT_FOUND",
          "PLAY_CONTENT_AD",
          "GUEST_ACCOUNT_RESTRICTED",
          "EMAIL_NOT_VERIFIED",
          "PLAY_SOCIAL_ACCOUNT_TOO_NEW"
        ]);
      }
    }
  );

  app.delete(
    "/api/platform/plaza/posts/:postId",
    { schema: { tags: ["platform"], params: uuidParams("postId"), response: { 200: { type: "object", additionalProperties: true } } } },
    async (request, reply) => {
      const actorId = requireActor(request);
      try {
        return await deletePlazaPost(actorId, request.params.postId);
      } catch (error) {
        return handleServiceError(reply, error, ["PLAZA_POST_NOT_FOUND"]);
      }
    }
  );

  app.delete(
    "/api/platform/plaza/replies/:replyId",
    { schema: { tags: ["platform"], params: uuidParams("replyId"), response: { 200: { type: "object", additionalProperties: true } } } },
    async (request, reply) => {
      const actorId = requireActor(request);
      try {
        return await deletePlazaReply(actorId, request.params.replyId);
      } catch (error) {
        return handleServiceError(reply, error, ["PLAZA_REPLY_NOT_FOUND", "FORBIDDEN"]);
      }
    }
  );

  app.post(
    "/api/platform/plaza/reports",
    { schema: { tags: ["platform"], ...createPlazaReportSchema, response: { 201: { type: "object", additionalProperties: true } } } },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { targetType, targetId, reason } = request.body ?? {};
      try {
        const result = await reportPlazaTarget({ actorId, targetType, targetId, reason });
        return reply.code(201).send(result);
      } catch (error) {
        return handleServiceError(reply, error, [
          "PLAZA_POST_NOT_FOUND",
          "PLAZA_REPLY_NOT_FOUND",
          "PLAZA_REPORT_INVALID",
          "PLAZA_REPORT_SELF"
        ]);
      }
    }
  );

  app.get(
    "/api/platform/social/players/search",
    { schema: { tags: ["platform"], ...playerSearchSchema, response: { 200: { type: "object", additionalProperties: true } } } },
    async (request) => {
      const actorId = requireActor(request);
      return searchPlayers({ actorId, queryText: request.query?.q, limit: request.query?.limit });
    }
  );

  app.get(
    "/api/platform/social/friends",
    { schema: { tags: ["platform"], response: { 200: { type: "object", additionalProperties: true } } } },
    async (request) => {
      const actorId = requireActor(request);
      return listFriendships(actorId);
    }
  );

  app.post(
    "/api/platform/social/friends/request",
    { schema: { tags: ["platform"], ...sendFriendRequestSchema, response: { 201: { type: "object", additionalProperties: true } } } },
    async (request, reply) => {
      const actorId = requireActor(request);
      try {
        const result = await sendFriendRequest(actorId, request.body?.targetUserId);
        return reply.code(201).send(result);
      } catch (error) {
        return handleServiceError(reply, error, [
          "FRIEND_SELF",
          "USER_NOT_FOUND",
          "FRIEND_ALREADY",
          "FRIEND_REQUEST_EXISTS",
          "GUEST_ACCOUNT_RESTRICTED",
          "EMAIL_NOT_VERIFIED",
          "PLAY_SOCIAL_ACCOUNT_TOO_NEW"
        ]);
      }
    }
  );

  app.post(
    "/api/platform/social/friends/respond",
    { schema: { tags: ["platform"], ...respondFriendSchema, response: { 200: { type: "object", additionalProperties: true } } } },
    async (request, reply) => {
      const actorId = requireActor(request);
      try {
        return await respondFriendRequest(actorId, request.body?.targetUserId, Boolean(request.body?.accept));
      } catch (error) {
        return handleServiceError(reply, error, ["FRIEND_REQUEST_NOT_FOUND"]);
      }
    }
  );

  app.get(
    "/api/platform/social/dm/conversations",
    { schema: { tags: ["platform"], response: { 200: { type: "object", additionalProperties: true } } } },
    async (request) => {
      const actorId = requireActor(request);
      return listDmConversations(actorId);
    }
  );

  app.post(
    "/api/platform/social/dm/conversations",
    { schema: { tags: ["platform"], ...openDmSchema, response: { 201: { type: "object", additionalProperties: true } } } },
    async (request, reply) => {
      const actorId = requireActor(request);
      try {
        const result = await openDmConversation(actorId, request.body?.peerUserId);
        return reply.code(201).send(result);
      } catch (error) {
        return handleServiceError(reply, error, ["DM_FRIEND_REQUIRED", "USER_NOT_FOUND"]);
      }
    }
  );

  app.get(
    "/api/platform/social/dm/conversations/:conversationId/messages",
    { schema: { tags: ["platform"], params: uuidParams("conversationId"), response: { 200: { type: "object", additionalProperties: true } } } },
    async (request, reply) => {
      const actorId = requireActor(request);
      try {
        return await listDmMessages(actorId, request.params.conversationId);
      } catch (error) {
        return handleServiceError(reply, error, ["DM_NOT_FOUND", "FORBIDDEN"]);
      }
    }
  );

  app.post(
    "/api/platform/social/dm/conversations/:conversationId/messages",
    { schema: { tags: ["platform"], ...sendDmMessageSchema, response: { 201: { type: "object", additionalProperties: true } } } },
    async (request, reply) => {
      const actorId = requireActor(request);
      try {
        const message = await sendDmMessage(actorId, request.params.conversationId, request.body?.body);
        return reply.code(201).send(message);
      } catch (error) {
        return handleServiceError(reply, error, [
          "DM_NOT_FOUND",
          "FORBIDDEN",
          "DM_MESSAGE_INVALID",
          "DM_FRIEND_REQUIRED",
          "PLAY_CONTENT_AD",
          "GUEST_ACCOUNT_RESTRICTED",
          "EMAIL_NOT_VERIFIED",
          "PLAY_SOCIAL_ACCOUNT_TOO_NEW"
        ]);
      }
    }
  );

  app.get("/api/platform/events/stream", async (request, reply) => {
    const actorId = requireActor(request);
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    let closed = false;
    let unsubscribe = () => {};
    let heartbeat = null;
    const cleanup = (endResponse = false) => {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
      if (endResponse && !reply.raw.destroyed && !reply.raw.writableEnded) reply.raw.end();
    };

    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);

    const subscription = createReplaySubscription({
      lastEventId: request.headers["last-event-id"],
      subscribe(send) {
        const unsubUser = subscribePlatformUserEvents(actorId, send);
        const unsubBroadcast = subscribePlatformBroadcast(send);
        return () => {
          unsubUser();
          unsubBroadcast();
        };
      },
      getLatestId: () => getLatestPlatformEventId(actorId),
      fetchAfter: (afterId, options) => fetchPlatformEventsAfter(actorId, afterId, options),
      send: (envelope) => writeSseEvent(reply.raw, envelope),
      beforeLive: () => writeSseEvent(reply.raw, {
        payload: JSON.stringify({ type: "connected", userId: actorId, at: new Date().toISOString() })
      }),
      onClose: () => cleanup(true),
      onReplayError: (error) => request.log.warn({ err: error, actorId }, "platform SSE replay failed")
    });
    unsubscribe = subscription.unsubscribe;
    const streamReady = await subscription.ready;
    if (!streamReady || closed) return;

    heartbeat = setInterval(() => {
      if (!writeSseEvent(reply.raw, {
        payload: JSON.stringify({ type: "heartbeat", at: new Date().toISOString() })
      })) cleanup();
    }, 25000);
    heartbeat.unref?.();
  });
}
