import { getOptionalServicesStatus } from "../optional-services-status.js";
import { getDatabaseStatus, getReadinessStatus } from "../database-status.js";
import { getPoolStats } from "../db.js";
import { renderPrometheusMetrics, setApiReadyGauge } from "../metrics.js";
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
      roomEventBus: bus,
      optionalServices: getOptionalServicesStatus()
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
      const ready = await getReadinessStatus();
      setApiReadyGauge(ready.ready);
      const body = renderPrometheusMetrics({
        poolStats: {
          totalCount: pool.total,
          idleCount: pool.idle,
          waitingCount: pool.waiting
        },
        sseStats: sse,
        uptimeSeconds: Math.floor((Date.now() - processStartedAt) / 1000),
        readyOk: ready.ready ? 1 : 0
      });
      return reply.type("text/plain; version=0.0.4; charset=utf-8").send(body);
    }
  );

  app.post("/api/csp-report", {
    schema: {
      hide: true,
      tags: ["system"],
      body: { type: "object", additionalProperties: true },
      response: { 204: { type: "null" } }
    }
  }, async (request, reply) => {
    const report = request.body ?? {};
    request.log.warn(
      {
        csp: {
          documentUri: report["document-uri"] ?? report.documentURI,
          violatedDirective: report["violated-directive"] ?? report.violatedDirective,
          blockedUri: report["blocked-uri"] ?? report.blockedURI,
          sourceFile: report["source-file"] ?? report.sourceFile
        }
      },
      "CSP violation report"
    );
    return reply.code(204).send();
  });
}