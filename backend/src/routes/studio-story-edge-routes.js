import { requireActor } from "../request-actor.js";
import { sendErr } from "../api-errors.js";
import { runRevisionMutation } from "../world-revision.js";
import { requireWorldRole } from "./route-guards.js";
import { assertStoryEdgeEndpoint } from "./studio-route-guards.js";
import { createStoryEdgeSchema } from "./schemas/creator-studio.js";

export async function registerStudioStoryEdgeRoutes(app) {
  app.post("/api/worlds/:worldId/story-edges", { schema: createStoryEdgeSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { fromType, fromId, toType, toId, relationType = "mainline", label = "" } = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      await assertStoryEdgeEndpoint(client, worldId, fromType, fromId);
      await assertStoryEdgeEndpoint(client, worldId, toType, toId);
      const result = await client.query(
        `INSERT INTO story_graph_edges (world_id, from_type, from_id, to_type, to_id, relation_type, label)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [worldId, fromType, fromId, toType, toId, relationType, label]
      );
      return result.rows[0];
    }, { sendErr, statusCode: 201 });
  });
}
