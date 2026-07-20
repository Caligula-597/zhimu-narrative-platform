import {
  addWorldTruthClaim,
  getWorldTruthClaims,
  removeWorldTruthClaim,
  reviseWorldTruthClaim
} from "../content-platform-truth-service.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole, WORLD_CREATOR_READER_ROLES } from "./route-guards.js";
import {
  createTruthClaimSchema,
  deleteTruthClaimSchema,
  listTruthClaimsSchema,
  patchTruthClaimSchema
} from "./schemas/content-platform-truth.js";

export async function registerContentPlatformTruthRoutes(app) {
  app.get("/api/worlds/:worldId/truth-claims", { schema: listTruthClaimsSchema }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
    return getWorldTruthClaims(worldId);
  });

  app.post("/api/worlds/:worldId/truth-claims", { schema: createTruthClaimSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return addWorldTruthClaim({
      request,
      reply,
      actorId,
      worldId,
      body: request.body ?? {}
    });
  });

  app.patch("/api/worlds/:worldId/truth-claims/:claimId", { schema: patchTruthClaimSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, claimId } = request.params;
    await requireWorldRole(actorId, worldId);
    return reviseWorldTruthClaim({
      request,
      reply,
      actorId,
      worldId,
      claimId,
      body: request.body ?? {}
    });
  });

  app.delete("/api/worlds/:worldId/truth-claims/:claimId", { schema: deleteTruthClaimSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, claimId } = request.params;
    await requireWorldRole(actorId, worldId);
    return removeWorldTruthClaim({ request, reply, actorId, worldId, claimId });
  });
}
