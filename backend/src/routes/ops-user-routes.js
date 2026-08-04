import { sendErr } from "../api-errors.js";
import { resendEmailVerification } from "../auth-recovery-service.js";
import {
  buildOpsUserDeletePreview,
  deleteOpsUser,
  getOpsUser,
  listOpsUsers,
  recordOpsUserAction
} from "../ops-user-management.js";

const userIdParams = {
  type: "object",
  additionalProperties: false,
  required: ["userId"],
  properties: {
    userId: { type: "string", format: "uuid" }
  }
};

async function recordAuditSafely(request, payload) {
  try {
    await recordOpsUserAction(payload);
    return true;
  } catch (error) {
    request.log.error({ err: error, action: payload.action }, "ops user audit write failed");
    return false;
  }
}

export async function registerOpsUserRoutes(app) {
  app.get("/api/ops/users", {
    schema: {
      hide: true,
      tags: ["system"],
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          search: { type: "string", minLength: 2, maxLength: 320 },
          verification: { type: "string", enum: ["all", "pending", "verified"] },
          limit: { type: "integer", minimum: 1, maximum: 100 },
          offset: { type: "integer", minimum: 0, maximum: 100_000 }
        }
      }
    }
  }, async (request) => {
    const { search, verification, limit, offset } = request.query ?? {};
    return listOpsUsers({ search, verification, limit, offset });
  });

  app.get("/api/ops/users/:userId/delete-preview", {
    schema: {
      hide: true,
      tags: ["system"],
      params: userIdParams
    }
  }, async (request, reply) => {
    try {
      return await buildOpsUserDeletePreview(request.params.userId);
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
  });

  app.post("/api/ops/users/:userId/resend-verification", {
    schema: {
      hide: true,
      tags: ["system"],
      params: userIdParams
    }
  }, async (request, reply) => {
    try {
      const target = await getOpsUser(request.params.userId);
      if (target.protectedOperationsAccount) {
        return sendErr(reply, "ACCOUNT_DELETE_BLOCKED", "Protected operations mailboxes cannot be modified from OPS");
      }
      const result = await resendEmailVerification({
        userId: target.id,
        logger: request.log
      });
      const auditRecorded = await recordAuditSafely(request, {
        action: "user.verification_resent",
        targetUserId: target.id,
        targetEmail: target.email,
        metadata: { alreadyVerified: Boolean(result.alreadyVerified) }
      });
      return reply.code(200).send({ ok: true, ...result, auditRecorded });
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
  });

  app.post("/api/ops/users/:userId/delete", {
    schema: {
      hide: true,
      tags: ["system"],
      params: userIdParams,
      body: {
        type: "object",
        additionalProperties: false,
        required: ["confirmationEmail", "acknowledged", "mode"],
        properties: {
          confirmationEmail: { type: "string", minLength: 3, maxLength: 320 },
          acknowledged: { type: "boolean" },
          mode: { type: "string", enum: ["pending_reset", "account_delete"] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const result = await deleteOpsUser({
        userId: request.params.userId,
        ...request.body
      });
      const auditRecorded = await recordAuditSafely(request, {
        action: result.mode === "pending_reset"
          ? "user.pending_registration_reset"
          : "user.account_deleted",
        targetUserId: result.target.id,
        targetEmail: result.target.email,
        metadata: {
          storagePending: result.storagePending,
          emailVerified: result.target.emailVerified,
          ownedWorlds: result.target.ownedWorlds,
          assetCount: result.target.assetCount
        }
      });
      return reply.code(200).send({
        ok: true,
        deletedAt: result.deletedAt,
        storagePending: result.storagePending,
        auditRecorded,
        mode: result.mode
      });
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
  });
}
