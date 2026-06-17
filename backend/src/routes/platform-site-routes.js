import { loadMarketingSitePayload } from "../platform-site.js";
import { listPublicCatalogPreview } from "../platform-catalog-preview.js";
import { listPublicRooms } from "../public-room-listing.js";
import { createPlazaPost, listPlazaPosts } from "../play-plaza-service.js";
import { requireActor } from "../request-actor.js";
import { sendErr } from "../api-errors.js";
import { createPlazaPostSchema, listPlazaPostsSchema } from "./schemas.js";

export async function registerPlatformSiteRoutes(app) {
  app.get(
    "/api/platform/site",
    {
      schema: {
        tags: ["platform"],
        response: {
          200: {
            type: "object",
            additionalProperties: true
          }
        }
      }
    },
    async () => loadMarketingSitePayload()
  );

  app.get(
    "/api/platform/catalog-preview",
    {
      schema: {
        tags: ["platform"],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 24 }
          }
        },
        response: {
          200: {
            type: "object",
            additionalProperties: true
          }
        }
      }
    },
    async (request) => listPublicCatalogPreview({ limit: request.query?.limit })
  );

  app.get(
    "/api/platform/public-rooms",
    {
      schema: {
        tags: ["platform"],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 48 }
          }
        },
        response: {
          200: {
            type: "object",
            additionalProperties: true
          }
        }
      }
    },
    async (request) => listPublicRooms({ limit: request.query?.limit })
  );

  app.get(
    "/api/platform/plaza/posts",
    { schema: { tags: ["platform"], ...listPlazaPostsSchema, response: { 200: { type: "object", additionalProperties: true } } } },
    async (request) => listPlazaPosts({ kind: request.query?.kind, limit: request.query?.limit })
  );

  app.post(
    "/api/platform/plaza/posts",
    { schema: { tags: ["platform"], ...createPlazaPostSchema, response: { 201: { type: "object", additionalProperties: true } } } },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { kind = "chat", body, inviteCode } = request.body ?? {};
      try {
        const post = await createPlazaPost({
          actorId,
          kind,
          body,
          inviteCode
        });
        return reply.code(201).send(post);
      } catch (error) {
        if (error.code === "PLAZA_POST_INVALID" || error.code === "RATE_LIMITED") {
          return sendErr(reply, error.code, error.message);
        }
        throw error;
      }
    }
  );
}
