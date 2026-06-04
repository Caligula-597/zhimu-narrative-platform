import { listAuditLogOps } from "../audit-log.js";
import { getReadinessStatus } from "../database-status.js";
import { getPoolStats } from "../db.js";
import { requireOpsToken } from "../ops-auth.js";
import { getRoomEventBusStatus, getSseConnectionMetrics } from "../room-event-bus.js";

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
          openapiUi: process.env.OPENAPI_UI === "true" || (process.env.NODE_ENV ?? "development") !== "production"
        }
      };
    }
  );
}
