import { joinPublicCatalogWorld } from "../catalog-join-service.js";
import {
  getOfficialExampleWorldId,
  loadOfficialExampleSnapshot
} from "../official-example.js";
import { requireActor } from "../request-actor.js";
import { requireVerifiedEmail } from "../email-verification-policy.js";
import { sendErr } from "../api-errors.js";

export async function registerOfficialExampleRoutes(app) {
  app.get(
    "/api/platform/official-example",
    {
      schema: {
        tags: ["worlds"],
        response: {
          200: {
            type: "object",
            additionalProperties: true
          }
        }
      }
    },
    async () => loadOfficialExampleSnapshot()
  );

  app.post(
    "/api/platform/official-example/join",
    {
      schema: {
        tags: ["worlds"],
        response: {
          201: {
            type: "object",
            additionalProperties: true
          }
        }
      }
    },
    async (request, reply) => {
      const actorId = requireActor(request);
      await requireVerifiedEmail(actorId);
      const worldId = getOfficialExampleWorldId();
      if (!worldId) {
        return sendErr(reply, "UNAVAILABLE", "未配置官方示例剧本（OFFICIAL_EXAMPLE_WORLD_ID）");
      }
      try {
        const payload = await joinPublicCatalogWorld(actorId, worldId);
        return reply.code(201).send(payload);
      } catch (error) {
        if (error.code && error.statusCode) {
          return sendErr(reply, error.code, error.message, error.details);
        }
        throw error;
      }
    }
  );
}
