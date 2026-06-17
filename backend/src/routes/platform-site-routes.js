import { loadMarketingSitePayload } from "../platform-site.js";
import { listPublicCatalogPreview } from "../platform-catalog-preview.js";

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
}
