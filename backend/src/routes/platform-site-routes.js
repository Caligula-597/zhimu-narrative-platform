import { loadMarketingSitePayload } from "../platform-site.js";
import { listPublicCatalogPreview } from "../platform-catalog-preview.js";
import { listPublicRooms } from "../public-room-listing.js";
import { serveWorldCoverRedirect } from "../world-cover.js";

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
    "/api/platform/worlds/:worldId/cover",
    {
      schema: {
        tags: ["platform"],
        params: {
          type: "object",
          required: ["worldId"],
          properties: {
            worldId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { downloadUrl, contentType } = await serveWorldCoverRedirect(request.params.worldId);
      reply.header("cache-control", "public, max-age=120");
      if (contentType) reply.header("content-type", contentType);
      return reply.redirect(downloadUrl);
    }
  );
}
