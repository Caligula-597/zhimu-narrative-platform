import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import {
  loadProjectStoryState,
  saveProjectStoryState,
} from "../project-story-state-service.js";
import { runRevisionMutation } from "../world-revision.js";
import { requireWorldRole, WORLD_CREATOR_READER_ROLES } from "./route-guards.js";
import {
  getProjectStoryStateSchema,
  putProjectStoryStateSchema,
} from "./schemas/project-story-state.js";

export async function registerProjectStoryStateRoutes(app) {
  app.get(
    "/api/worlds/:worldId/project-story-state",
    { schema: getProjectStoryStateSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
      return loadProjectStoryState(worldId);
    },
  );

  app.put(
    "/api/worlds/:worldId/project-story-state",
    { schema: putProjectStoryStateSchema },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      await requireWorldRole(actorId, worldId);
      const rawState = request.body?.state;
      if (!rawState || typeof rawState !== "object" || Array.isArray(rawState)) {
        return sendErr(reply, "PROJECT_STORY_STATE_REQUIRED", "state object is required");
      }
      try {
        return await runRevisionMutation(
          request,
          reply,
          worldId,
          (client) => saveProjectStoryState(client, worldId, rawState, actorId),
          { sendErr },
        );
      } catch (error) {
        if (error?.code === "WORLD_NOT_FOUND") {
          return sendErr(reply, "WORLD_NOT_FOUND", "World not found");
        }
        throw error;
      }
    },
  );
}
