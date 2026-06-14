import { requireActor, bearerToken } from "../request-actor.js";
import { sendErr } from "../api-errors.js";
import { buildAccountEntitlements } from "../account-entitlements.js";
import { PLAN_CATALOG } from "../plans.js";
import { deleteSession } from "../auth.js";
import {
  assertDeleteConfirmation,
  buildAccountDeletePreview,
  deleteUserAccount
} from "../account-delete.js";

export async function registerAccountRoutes(app) {
  app.get("/api/account/entitlements", async (request) => {
    const actorId = requireActor(request);
    return buildAccountEntitlements(actorId);
  });

  app.get("/api/account/plans", async () => ({
    plans: Object.entries(PLAN_CATALOG)
      .filter(([code]) => code !== "beta")
      .map(([code, meta]) => ({ code, ...meta }))
  }));

  app.get("/api/account/delete/preview", async (request) => {
    const actorId = requireActor(request);
    return buildAccountDeletePreview(actorId);
  });

  app.post("/api/account/delete", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["confirmation", "acknowledged"],
        properties: {
          confirmation: { type: "string", minLength: 1, maxLength: 40 },
          acknowledged: { type: "boolean" }
        }
      }
    }
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { confirmation, acknowledged } = request.body ?? {};
    if (!acknowledged) return sendErr(reply, "BAD_REQUEST", "You must acknowledge that deletion is permanent");

    const preview = await buildAccountDeletePreview(actorId);
    assertDeleteConfirmation(preview.confirmationLabel, confirmation);

    try {
      const result = await deleteUserAccount(actorId);
      await deleteSession(bearerToken(request));
      return reply.code(200).send(result);
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
  });
}
