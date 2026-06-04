import { getDatabaseStatus, getReadinessStatus } from "../database-status.js";
import { getPoolStats } from "../db.js";
import { renderPrometheusMetrics } from "../metrics.js";
import { requireMetricsToken } from "../ops-auth.js";
import { getRoomEventBusStatus, getSseConnectionMetrics } from "../room-event-bus.js";

const processStartedAt = Date.now();

export async function registerSystemRoutes(app) {  app.get("/api/health", async () => {
    return getDatabaseStatus();
  });

  app.get("/api/health/live", async () => ({ ok: true }));

  app.get("/api/health/ready", async (_request, reply) => {
    const [ready, bus] = await Promise.all([
      getReadinessStatus(),
      Promise.resolve(getRoomEventBusStatus())
    ]);
    const body = {
      ok: ready.ready,
      ready: ready.ready,
      checks: {
        ...ready.checks,
        roomEventBus: bus.mode === "postgres" ? bus.listening : true
      },
      database: {
        latencyMs: ready.latencyMs,
        missingTables: ready.missingTables,
        migrationsApplied: ready.migrationsApplied
      },
      pool: ready.pool,
      roomEventBus: bus
    };
    if (!body.ready) {
      return reply.code(503).send(body);
    }
    return body;
  });

  app.get(
    "/metrics",
    {
      schema: {
        hide: true,
        tags: ["system"],
        response: { 200: { type: "string" } }
      }
    },
    async (request, reply) => {
      requireMetricsToken(request);
      const pool = getPoolStats();
      const sse = getSseConnectionMetrics();
      const body = renderPrometheusMetrics({
        poolStats: {
          totalCount: pool.total,
          idleCount: pool.idle,
          waitingCount: pool.waiting
        },
        sseStats: sse,
        uptimeSeconds: Math.floor((Date.now() - processStartedAt) / 1000)
      });
      return reply.type("text/plain; version=0.0.4; charset=utf-8").send(body);
    }
  );
}