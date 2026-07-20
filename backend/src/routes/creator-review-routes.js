import {
  compareCreatorVersions,
  createCreatorReview,
  getCreatorReviews,
  patchCreatorReview,
  replyToCreatorReview
} from "../creator-review-service.js";
import { requireActor } from "../request-actor.js";
import {
  creatorReviewCreateSchema,
  creatorReviewListSchema,
  creatorReviewPatchSchema,
  creatorReviewReplySchema,
  creatorVersionCompareSchema
} from "./schemas/creator-review.js";

export async function registerCreatorReviewRoutes(app) {
  app.get("/api/worlds/:worldId/reviews", { schema: creatorReviewListSchema }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    return getCreatorReviews({ worldId, actorId, ...request.query });
  });

  app.post("/api/worlds/:worldId/reviews", { schema: creatorReviewCreateSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    const result = await createCreatorReview({ worldId, actorId, payload: request.body });
    return reply.code(201).send(result);
  });

  app.patch("/api/worlds/:worldId/reviews/:reviewId", { schema: creatorReviewPatchSchema }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, reviewId } = request.params;
    return patchCreatorReview({ worldId, reviewId, actorId, payload: request.body });
  });

  app.post("/api/worlds/:worldId/reviews/:reviewId/replies", { schema: creatorReviewReplySchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, reviewId } = request.params;
    const result = await replyToCreatorReview({ worldId, reviewId, actorId, body: request.body.body });
    return reply.code(201).send(result);
  });

  app.get("/api/worlds/:worldId/content-versions/compare", { schema: creatorVersionCompareSchema }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    return compareCreatorVersions({ worldId, actorId, ...request.query });
  });
}
