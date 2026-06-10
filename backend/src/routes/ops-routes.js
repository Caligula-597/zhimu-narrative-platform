import { listAuditLogOps } from "../audit-log.js";
import { getReadinessStatus } from "../database-status.js";
import { getPoolStats } from "../db.js";
import { requireOpsToken } from "../ops-auth.js";
import { getRoomEventBusStatus, getSseConnectionMetrics } from "../room-event-bus.js";
import { getTelemetryStatus } from "../telemetry.js";
import { getEmailServiceStatus } from "../email.js";
import { getPublicOAuthDiagnostics } from "../oauth-diagnostics.js";
import { getStripeBillingStatus } from "../stripe-billing.js";
import { assignUserPlanByEmail } from "../account-entitlements.js";
import { PLAN_DEFAULTS } from "../plans.js";
import { sendErr } from "../api-errors.js";

const opsAuditLogQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    roomId: { type: "string", format: "uuid" },
    action: { type: "string", minLength: 1, maxLength: 80 },
    limit: { type: "integer", minimum: 1, maximum: 200 },
    offset: { type: "integer", minimum: 0, maximum: 100_000 }
  }
};

export async function registerOpsRoutes(app) {
  app.addHook("preHandler", async (request) => {
    const url = request.url.split("?")[0];
    if (!url.startsWith("/api/ops/")) return;
    requireOpsToken(request);
  });

  app.get(
    "/api/ops/audit-log",
    {
      schema: {
        hide: true,
        tags: ["system"],
        querystring: opsAuditLogQuerySchema,
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            properties: {
              items: { type: "array", items: { type: "object", additionalProperties: true } },
              limit: { type: "integer" },
              offset: { type: "integer" },
              total: { type: "integer" }
            }
          }
        }
      }
    },
    async (request) => {
      const { roomId, action, limit, offset } = request.query;
      return listAuditLogOps({
        roomId,
        action,
        limit: limit != null ? Number(limit) : 50,
        offset: offset != null ? Number(offset) : 0
      });
    }
  );

  app.get(
    "/api/ops/status",
    {
      schema: {
        hide: true,
        tags: ["system"],
        response: {
          200: {
            type: "object",
            additionalProperties: true
          }
        }
      }
    },
    async () => {
      const [ready, bus] = await Promise.all([
        getReadinessStatus(),
        Promise.resolve(getRoomEventBusStatus())
      ]);
      const sse = getSseConnectionMetrics();
      return {
        ok: ready.ready,
        ready: ready.ready,
        nodeEnv: process.env.NODE_ENV ?? "development",
        uptimeSeconds: Math.floor(process.uptime()),
        checks: ready.checks,
        database: {
          latencyMs: ready.latencyMs,
          missingTables: ready.missingTables,
          migrationsApplied: ready.migrationsApplied
        },
        pool: getPoolStats(),
        sse: { connections: sse.connections, rooms: sse.rooms },
        roomEventBus: bus,
        features: {
          uploadScan: (process.env.UPLOAD_SCAN_MODE || "none").toLowerCase(),
          roomEventsBus: bus.mode,
          openapiUi: process.env.OPENAPI_UI === "true" || (process.env.NODE_ENV ?? "development") !== "production",
          telemetry: getTelemetryStatus(),
          email: getEmailServiceStatus(),
          oauth: getPublicOAuthDiagnostics(),
          stripe: getStripeBillingStatus()
        },
        rateLimits: {
          authPerMin: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 20),
          writePerMin: Number(process.env.RATE_LIMIT_WRITE_MAX ?? 120),
          readPerMin: Number(process.env.RATE_LIMIT_READ_MAX ?? 300),
          uploadPerMin: Number(process.env.RATE_LIMIT_UPLOAD_MAX ?? 30),
          aiPerMin: Number(process.env.RATE_LIMIT_AI_MAX ?? 40)
        }
      };
    }
  );

  app.post(
    "/api/ops/users/plan",
    {
      schema: {
        hide: true,
        tags: ["system"],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["email", "planCode"],
          properties: {
            email: { type: "string", minLength: 3, maxLength: 320 },
            planCode: { type: "string", enum: ["free", "creator", "studio", "beta"] }
          }
        }
      }
    },
    async (request, reply) => {
      const { email, planCode } = request.body;
      if (!PLAN_DEFAULTS[planCode]) return sendErr(reply, "BAD_REQUEST", "Unknown plan code");
      try {
        const result = await assignUserPlanByEmail(email, planCode);
        return reply.code(200).send({ ok: true, ...result });
      } catch (error) {
        if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
        throw error;
      }
    }
  );
}
