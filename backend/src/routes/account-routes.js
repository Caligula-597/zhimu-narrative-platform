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
import {
  authorizeAccountDeletion,
  buildAccountDeleteReauthentication
} from "../account-delete-authorization.js";
import { buildAccountExport } from "../account-export.js";
import { registerAccountLlmRoutes } from "./account-llm-routes.js";
import { registerAccountProfileRoutes } from "./account-profile-routes.js";

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

  app.get(
    "/api/account/delete/preview",
    // codeql-reviewed[js/missing-rate-limiting]: global network and actor limiters protect this authenticated preview.
    async (request) => {
      const actorId = requireActor(request);
      const [preview, reauthentication] = await Promise.all([
        buildAccountDeletePreview(actorId),
        buildAccountDeleteReauthentication(actorId, request.sessionId ?? null)
      ]);
      return { ...preview, reauthentication };
    }
  );

  app.post("/api/account/delete", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["confirmation", "acknowledged"],
        properties: {
          confirmation: { type: "string", minLength: 1, maxLength: 40 },
          acknowledged: { type: "boolean" },
          password: { type: "string", minLength: 8, maxLength: 128 }
        }
      }
    }
  },
  // codeql-reviewed[js/missing-rate-limiting]: the global hook applies the dedicated auth-recovery limit to deletion.
  async (request, reply) => {
    const actorId = requireActor(request);
    const { confirmation, acknowledged, password } = request.body ?? {};
    if (!acknowledged) return sendErr(reply, "BAD_REQUEST", "You must acknowledge that deletion is permanent");

    const preview = await buildAccountDeletePreview(actorId);
    assertDeleteConfirmation(preview.confirmationLabel, confirmation);

    try {
      const authorizationProof = await authorizeAccountDeletion({
        userId: actorId,
        sessionId: request.sessionId ?? null,
        password
      });
      const result = await deleteUserAccount(actorId, { authorizationProof });
      await deleteSession(bearerToken(request));
      clearSessionCookie(reply);
      return reply.code(200).send(result);
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
  });

  await registerAccountLlmRoutes(app);
  await registerAccountProfileRoutes(app);
}
