import { sendErr } from "./api-errors.js";
import { insertStoryEdge } from "./repositories/studio-story-edge-repository.js";
import { assertStoryEdgeEndpoint } from "./routes/studio-route-guards.js";
import { runRevisionMutation } from "./world-revision.js";

export function createWorldStoryEdge({ request, reply, worldId, body }) {
  const {
    fromType,
    fromId,
    toType,
    toId,
    relationType = "mainline",
    label = ""
  } = body;
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertStoryEdgeEndpoint(client, worldId, fromType, fromId);
    await assertStoryEdgeEndpoint(client, worldId, toType, toId);
    return insertStoryEdge(client, {
      worldId,
      fromType,
      fromId,
      toType,
      toId,
      relationType,
      label
    });
  }, { sendErr, statusCode: 201 });
}
