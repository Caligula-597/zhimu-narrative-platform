import { requireActor, bearerToken } from "../request-actor.js";
import { sendErr } from "../api-errors.js";
import { buildAccountEntitlements } from "../account-entitlements.js";
import { buildPublicPlanCards, submitPlanUpgradeRequest } from "../plan-upgrade-request.js";
import { deleteSession } from "../auth.js";
import { clearSessionCookie } from "../session-cookie.js";
import {
  assertDeleteConfirmation,
  buildAccountDeletePreview,
  deleteUserAccount
} from "../account-delete.js";
import { buildAccountExport } from "../account-export.js";

export async function registerAccountRoutes(app) {
  app.get("/api/account/entitlements", async (request) => {
    const actorId = requireActor(request);
    return buildAccountEntitlements(actorId);
  });

  app.get("/api/account/plans", async () => ({
    plans: buildPublicPlanCards()
  }));

  app.post("/api/account/plan-upgrade-request", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["desiredPlanCode", "reason"],
        properties: {
          desiredPlanCode: { type: "string", enum: ["creator", "studio"] },
          reason: { type: "string", minLength: 8, maxLength: 4000 },
          contact: { type: "string", maxLength: 200 }
        }
      }
    }
  }, async (request, reply) => {
    const actorId = requireActor(request);
    try {
      return await submitPlanUpgradeRequest(actorId, request.body ?? {});
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
  });

  app.get("/api/account/export", async (request, reply) => {
    const actorId = requireActor(request);
    try {
      return await buildAccountExport(actorId);
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
  });

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
      clearSessionCookie(reply);
      return reply.code(200).send(result);
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
  });
}
