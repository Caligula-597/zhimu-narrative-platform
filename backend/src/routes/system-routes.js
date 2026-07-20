import { getOptionalServicesStatus } from "../optional-services-status.js";
import { getDatabaseStatus, getReadinessStatus } from "../database-status.js";
import { getPoolStats } from "../db.js";
import { renderPrometheusMetrics, setApiReadyGauge, recordCspViolation, recordWebVital } from "../metrics.js";
import { requireMetricsToken } from "../ops-auth.js";
import { getRoomEventBusStatus, getSseConnectionMetrics } from "../room-event-bus.js";
import { getPlatformEventBusStatus } from "../platform-event-bus.js";
import { getEventOutboxStatus } from "../event-outbox-dispatcher.js";
import {
  allowCspReportFromClient,
  normalizeCspReport,
  noteCspViolationForAlert
} from "../csp-reports.js";

const processStartedAt = Date.now();

export async function registerSystemRoutes(app) {  app.get("/api/health", async () => {
    return getDatabaseStatus();
  });

  app.get("/api/health/live", async () => ({ ok: true }));

  app.get("/api/health/ready", async (_request, reply) => {
    const [ready, bus, platformBus] = await Promise.all([
      getReadinessStatus(),
      Promise.resolve(getRoomEventBusStatus()),
      Promise.resolve(getPlatformEventBusStatus())
    ]);
    const production = process.env.NODE_ENV === "production";
    const roomEventBusReady = bus.mode === "postgres" ? bus.listening : !production;
    const platformEventBusReady = platformBus.mode === "postgres" ? platformBus.listening : !production;
    const outbox = getEventOutboxStatus();
    const outboxReady = production ? outbox.started : true;
    const allReady = ready.ready && roomEventBusReady && platformEventBusReady && outboxReady;
    const body = {
      ok: allReady,
      ready: allReady,
      checks: {
        ...ready.checks,
        roomEventBus: roomEventBusReady,
        platformEventBus: platformEventBusReady,
        eventOutbox: outboxReady
      },
      database: {
        latencyMs: ready.latencyMs,
        missingTables: ready.missingTables,
        missingMigrations: ready.missingMigrations,
        latestMigration: ready.latestMigration,
        migrationsApplied: ready.migrationsApplied
      },
      pool: ready.pool,
      roomEventBus: bus,
      platformEventBus: platformBus,
      eventOutbox: outbox,
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
      const roomBus = getRoomEventBusStatus();
      const platformBus = getPlatformEventBusStatus();
      const eventOutbox = getEventOutboxStatus();
      const ready = await getReadinessStatus();
      const production = process.env.NODE_ENV === "production";
      const eventBusesReady = production
        ? roomBus.mode === "postgres" && roomBus.listening
          && platformBus.mode === "postgres" && platformBus.listening
        : true;
      const outboxReady = production ? eventOutbox.started : true;
      const allReady = ready.ready && eventBusesReady && outboxReady;
      setApiReadyGauge(allReady);
      const body = renderPrometheusMetrics({
        poolStats: {
          totalCount: pool.total,
          idleCount: pool.idle,
          waitingCount: pool.waiting
        },
        sseStats: sse,
        platformSseStats: { connections: platformBus.broadcastConnections },
        eventOutboxStats: eventOutbox,
        uptimeSeconds: Math.floor((Date.now() - processStartedAt) / 1000),
        readyOk: allReady ? 1 : 0
      });
      return reply.type("text/plain; version=0.0.4; charset=utf-8").send(body);
    }
  );

  app.post("/api/csp-report", {
    bodyLimit: 16 * 1024,
    schema: {
      hide: true,
      tags: ["system"],
      body: {
        anyOf: [
          { type: "object", additionalProperties: true },
          { type: "array", minItems: 1, maxItems: 20, items: { type: "object", additionalProperties: true } }
        ]
      },
      response: { 204: { type: "null" } }
    }
  }, async (request, reply) => {
    const clientKey = String(request.ip || request.headers["x-forwarded-for"] || "unknown");
    if (!allowCspReportFromClient(clientKey)) {
      return reply.code(204).send();
    }
    const report = normalizeCspReport(request.body ?? {});
    recordCspViolation({ directive: report.violatedDirective, disposition: report.disposition });
    const alertState = noteCspViolationForAlert(report);
    const log = alertState.alert ? request.log.error.bind(request.log) : request.log.warn.bind(request.log);
    log(
      {
        csp: report,
        alert: alertState.alert,
        violationsInMinute: alertState.count,
        threshold: alertState.threshold
      },
      alertState.alert ? "CSP violation threshold reached" : "CSP violation report"
    );
    return reply.code(204).send();
  });

  app.post("/api/metrics/web-vitals", {
    schema: {
      hide: true,
      tags: ["system"],
      body: {
        type: "object",
        additionalProperties: false,
        required: ["name", "value", "id"],
        properties: {
          name: { type: "string", enum: ["LCP", "CLS", "INP", "FCP", "TTFB"] },
          value: { type: "number" },
          rating: { type: "string", enum: ["good", "needs-improvement", "poor", "unknown"], maxLength: 20 },
          id: { type: "string", maxLength: 120 },
          path: { type: "string", maxLength: 500 },
          app: { type: "string", maxLength: 40 }
        }
      },
      response: { 204: { type: "null" } }
    }
  }, async (request, reply) => {
    const body = request.body ?? {};
    recordWebVital({
      name: body.name,
      app: body.app,
      rating: body.rating || "unknown",
      value: body.value
    });
    return reply.code(204).send();
  });
}
