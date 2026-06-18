import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import { resolveSessionContext } from "./auth.js";
import { resolveRequestActor } from "./request-actor.js";
import { formatErrorBody } from "./api-errors.js";
import { createRateLimiter } from "./rate-limit.js";
import { buildFastifyLoggerOptions } from "./logger-config.js";
import { recordHttpRequest, resolveMetricRoute } from "./metrics.js";
import { registerOpenApi } from "./openapi.js";
import { registerAuthRoutes } from "./routes/auth-routes.js";
import { registerSystemRoutes } from "./routes/system-routes.js";
import { registerOfficialExampleRoutes } from "./routes/official-example-routes.js";
import { registerPlatformBetaRoutes } from "./routes/platform-beta-routes.js";
import { registerPlatformSiteRoutes } from "./routes/platform-site-routes.js";
import { registerPlatformSocialRoutes } from "./routes/platform-social-routes.js";
import { registerOpsRoutes } from "./routes/ops-routes.js";
import { registerBillingRoutes } from "./routes/billing-routes.js";
import { registerRoutes } from "./routes.js";
import { registerStaticFrontend } from "./static-frontend.js";
import { resolveAllowedCorsOrigins } from "./cors-origins.js";

const authRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 20),
  routeKey: "auth"
});
const betaApplyRateLimit = createRateLimiter({
  windowMs: 3_600_000,
  max: Number(process.env.RATE_LIMIT_BETA_APPLY_MAX ?? 5),
  routeKey: "beta-apply"
});
const apiWriteRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_WRITE_MAX ?? 120),
  routeKey: "api-write"
});
const apiReadRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_READ_MAX ?? 300),
  routeKey: "api-read"
});
const uploadRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_UPLOAD_MAX ?? 30),
  routeKey: "api-upload"
});
const aiRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_AI_MAX ?? 40),
  routeKey: "api-ai"
});

function isUploadRoute(url, method) {
  if (method !== "POST") return false;
  return url === "/api/assets/upload-url" || /^\/api\/assets\/[^/]+\/confirm$/.test(url);
}

function isAiRoute(url, method) {
  if (method !== "POST") return false;
  return url.includes("/story-assistant/") || url.includes("/deepseek/");
}

function shouldSkipReadRateLimit(url) {
  return url.includes("/events/stream");
}

function shouldSkipRateLimit(url) {
  return (
    url === "/metrics" ||
    url === "/api/openapi.json" ||
    url.startsWith("/api/docs") ||
    url === "/api/billing/stripe/webhook" ||
    url === "/api/platform/site" ||
    url === "/api/platform/beta" ||
    url === "/api/platform/catalog-preview" ||
    url === "/api/platform/official-example" ||
    url === "/api/platform/import-guide" ||
    url === "/api/platform/world-templates" ||
    url === "/api/health/live"
  );
}

function isPlatformReadRoute(url, method) {
  return (
    (method === "GET" || method === "HEAD") &&
    url.startsWith("/api/platform/") &&
    !url.startsWith("/api/platform/beta/apply")
  );
}

function resolveCorsOrigin(options, nodeEnv) {
  return resolveAllowedCorsOrigins(options, nodeEnv);
}

function resolveTraceId(request) {
  const traceparent = request.headers.traceparent;
  if (typeof traceparent === "string") {
    const parts = traceparent.split("-");
    if (parts.length >= 2 && parts[1]) return parts[1];
  }
  const legacy = request.headers["x-trace-id"];
  if (typeof legacy === "string" && legacy.trim()) return legacy.trim();
  return request.id;
}

export async function createApp(options = {}) {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const app = Fastify({
    logger: buildFastifyLoggerOptions({
      nodeEnv,
      loggerOption: options.logger ?? true
    }),
    genReqId: (request) => request.headers["x-request-id"] || randomUUID()
  });
  const allowDemoUserHeader = nodeEnv === "production"
    ? false
    : (options.allowDemoUserHeader ?? process.env.ALLOW_DEMO_USER_HEADER === "true");
  const rateLimitEnabled = options.rateLimit ?? nodeEnv === "production";

  await app.register(cors, {
    origin: resolveCorsOrigin(options, nodeEnv),
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });
  await registerOpenApi(app, { nodeEnv });

  app.addHook("onRequest", async (request, reply) => {
    request.traceId = resolveTraceId(request);
    reply.header("X-Request-Id", request.id);
    reply.header("X-Trace-Id", request.traceId);
    request._metricsStart = process.hrtime.bigint();
  });
  app.addHook("onResponse", async (request, reply) => {
    const started = request._metricsStart;
    if (started == null) return;
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    recordHttpRequest({
      method: request.method,
      route: resolveMetricRoute(request),
      statusCode: reply.statusCode,
      durationMs
    });
  });
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
    if (nodeEnv === "production") {
      reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    return payload;
  });
  app.addHook("preHandler", async (request) => {
    await resolveRequestActor(request, { resolveSession: resolveSessionContext, allowDemoUserHeader });
  });
  app.addHook("preHandler", async (request, reply) => {
    if (!rateLimitEnabled) return;

    const url = request.url.split("?")[0];
    if (shouldSkipRateLimit(url)) return;
    if (url.startsWith("/api/auth/login") || url.startsWith("/api/auth/register")
      || url.startsWith("/api/auth/forgot-password") || url.startsWith("/api/auth/reset-password")) {
      await authRateLimit(request, reply);
      return;
    }
    if (url.startsWith("/api/platform/beta/apply")) {
      await betaApplyRateLimit(request, reply);
      return;
    }
    if (!url.startsWith("/api/")) return;

    const method = request.method;
    if (isUploadRoute(url, method)) {
      await uploadRateLimit(request, reply);
      return;
    }
    if (isAiRoute(url, method)) {
      await aiRateLimit(request, reply);
      return;
    }
    if (method === "GET" || method === "HEAD") {
      if (!shouldSkipReadRateLimit(url) && !isPlatformReadRoute(url, method)) {
        await apiReadRateLimit(request, reply);
      }
      return;
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      await apiWriteRateLimit(request, reply);
    }
  });
  await registerSystemRoutes(app);
  await registerOfficialExampleRoutes(app);
  await registerPlatformSiteRoutes(app);
  await registerPlatformSocialRoutes(app);
  await registerPlatformBetaRoutes(app);
  await registerOpsRoutes(app);
  await registerBillingRoutes(app);
  await registerAuthRoutes(app);
  await registerRoutes(app);
  await registerStaticFrontend(app);
  app.log.info({
    demoUserHeader: allowDemoUserHeader,
    nodeEnv,
    rateLimitEnabled
  }, "Auth configuration loaded");
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode ?? (error.validation ? 400 : 500);
    if (statusCode >= 500) request.log.error({ err: error, traceId: request.traceId }, error.message);
    else request.log.info({ err: error, code: error.code, traceId: request.traceId }, error.message);
    reply.code(statusCode).send(formatErrorBody(error, statusCode));
  });
  if (process.env.SERVE_STATIC !== "true" && process.env.SERVE_STATIC !== "1") {
    app.setNotFoundHandler((request, reply) => {
      reply.code(404).send({ error: "Route not found", code: "NOT_FOUND" });
    });
  }
  return app;
}
