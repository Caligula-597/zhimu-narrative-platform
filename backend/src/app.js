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
import { captureException } from "./sentry.js";
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
import { applySecurityHeaders } from "./security-headers.js";
import { isDatabaseCapacityError } from "./db.js";
import { createRoomAccessAbuseProtection } from "./room-access-abuse-protection.js";
import { createVoiceAbuseProtection } from "./voice-abuse-protection.js";
import { createCheckpointAbuseProtection } from "./checkpoint-abuse-protection.js";
import { createRecapAbuseProtection } from "./recap-abuse-protection.js";
import { createHostCommunicationAbuseProtection } from "./host-communication-abuse-protection.js";
import { createHostPlayerManagementAbuseProtection } from "./host-player-management-abuse-protection.js";

const guestAuthRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_GUEST_AUTH_MAX ?? 8),
  routeKey: "auth-guest"
});
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
const feedbackRateLimit = createRateLimiter({
  windowMs: 3_600_000,
  max: Number(process.env.RATE_LIMIT_FEEDBACK_MAX ?? 10),
  routeKey: "feedback"
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
const documentRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_DOCUMENT_MAX ?? 10),
  routeKey: "api-document"
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

function isDocumentRoute(url, method) {
  return method === "POST" && /^\/api\/worlds\/[^/]+\/documents\/(?:parse|import|import-pages)$/.test(url);
}

export function resolveTrustProxy(value = process.env.TRUST_PROXY_HOPS) {
  if (value === false || value == null || value === "") return false;
  if (value === true) return true;
  const hops = Number(value);
  return Number.isInteger(hops) && hops >= 1 && hops <= 5 ? hops : false;
}

export function resolveHttpRequestTimeoutMs(value = process.env.HTTP_REQUEST_TIMEOUT_MS) {
  const timeout = Number(value ?? 120_000);
  return Number.isInteger(timeout) && timeout >= 10_000 && timeout <= 10 * 60_000
    ? timeout
    : 120_000;
}

export function safeCorrelationId(value) {
  const candidate = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9._:-]{1,128}$/.test(candidate) ? candidate : null;
}

function resolveTraceId(request) {
  const traceparent = request.headers.traceparent;
  if (typeof traceparent === "string") {
    const parts = traceparent.split("-");
    if (parts.length >= 2 && /^[a-f0-9]{32}$/i.test(parts[1] || "")) return parts[1];
  }
  const legacy = safeCorrelationId(request.headers["x-trace-id"]);
  if (legacy) return legacy;
  return request.id;
}

export async function createApp(options = {}) {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const app = Fastify({
    trustProxy: resolveTrustProxy(options.trustProxy ?? process.env.TRUST_PROXY_HOPS),
    requestTimeout: resolveHttpRequestTimeoutMs(options.requestTimeout ?? process.env.HTTP_REQUEST_TIMEOUT_MS),
    logger: buildFastifyLoggerOptions({
      nodeEnv,
      loggerOption: options.logger ?? true
    }),
    genReqId: (request) => safeCorrelationId(request.headers["x-request-id"]) || randomUUID()
  });
  app.addContentTypeParser(
    ["application/csp-report", "application/reports+json"],
    { parseAs: "string" },
    (_request, body, done) => {
      try {
        done(null, body ? JSON.parse(body) : {});
      } catch (error) {
        error.statusCode = 400;
        done(error);
      }
    }
  );
  const allowDemoUserHeader = nodeEnv === "production"
    ? false
    : (options.allowDemoUserHeader ?? process.env.ALLOW_DEMO_USER_HEADER === "true");
  const rateLimitEnabled = options.rateLimit
    ?? (nodeEnv === "production" || process.env.RATE_LIMIT_ENABLED === "true");
  const roomAccessAbuseProtection = createRoomAccessAbuseProtection();
  const voiceAbuseProtection = createVoiceAbuseProtection();
  const checkpointAbuseProtection = createCheckpointAbuseProtection();
  const recapAbuseProtection = createRecapAbuseProtection();
  const hostCommunicationAbuseProtection = createHostCommunicationAbuseProtection();
  const hostPlayerManagementAbuseProtection = createHostPlayerManagementAbuseProtection();

  await app.register(cors, {
    origin: resolveCorsOrigin(options, nodeEnv),
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });
  await registerOpenApi(app, { nodeEnv });

  app.addHook("onRequest", async (request, reply) => {
    request.traceId = resolveTraceId(request);
    reply.header("X-Request-Id", request.id);
    reply.header("X-Trace-Id", request.traceId);
    request._metricsStart = process.hrtime.bigint();
    if (!rateLimitEnabled) return;
    const url = request.url.split("?")[0];
    if (!shouldSkipRateLimit(url)) {
      await roomAccessAbuseProtection.protectNetwork(request, reply, url);
      await voiceAbuseProtection.protectNetwork(request, reply, url);
      await checkpointAbuseProtection.protectNetwork(request, reply, url);
      await recapAbuseProtection.protectNetwork(request, reply, url);
      await hostCommunicationAbuseProtection.protectNetwork(request, reply, url);
      await hostPlayerManagementAbuseProtection.protectNetwork(request, reply, url);
    }
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
    applySecurityHeaders(reply, { nodeEnv });
    return payload;
  });
  app.addHook("preHandler", async (request) => {
    await resolveRequestActor(request, { resolveSession: resolveSessionContext, allowDemoUserHeader });
  });
  app.addHook("preHandler", async (request, reply) => {
    if (!rateLimitEnabled) return;

    const url = request.url.split("?")[0];
    if (shouldSkipRateLimit(url)) return;
    if (await roomAccessAbuseProtection.protectActor(request, reply, url)) return;
    if (await voiceAbuseProtection.protectActor(request, reply, url)) return;
    if (await checkpointAbuseProtection.protectActor(request, reply, url)) return;
    if (await recapAbuseProtection.protectActor(request, reply, url)) return;
    if (await hostCommunicationAbuseProtection.protectActor(request, reply, url)) return;
    if (await hostPlayerManagementAbuseProtection.protectActor(request, reply, url)) return;
    if (url.startsWith("/api/auth/login") || url.startsWith("/api/auth/register")
      || url.startsWith("/api/auth/forgot-password") || url.startsWith("/api/auth/reset-password")) {
      await authRateLimit(request, reply);
      return;
    }
    if (url.startsWith("/api/auth/guest")) {
      await guestAuthRateLimit(request, reply);
      return;
    }
    if (url.startsWith("/api/platform/beta/apply")) {
      await betaApplyRateLimit(request, reply);
      return;
    }
    if (url === "/api/feedback" && request.method === "POST") {
      await feedbackRateLimit(request, reply);
      return;
    }
    if (!url.startsWith("/api/")) return;

    const method = request.method;
    if (isDocumentRoute(url, method)) {
      await documentRateLimit(request, reply);
      return;
    }
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
    const databaseBusy = isDatabaseCapacityError(error);
    const statusCode = databaseBusy ? 503 : (error.statusCode ?? (error.validation ? 400 : 500));
    if (statusCode >= 500) {
      request.log.error({ err: error, traceId: request.traceId }, error.message);
      captureException(error, {
        tags: { statusCode },
        extra: { traceId: request.traceId, url: request.url.split("?")[0] }
      });
    } else {
      request.log.info({ err: error, code: error.code, traceId: request.traceId }, error.message);
    }
    if (databaseBusy) {
      reply.header("Retry-After", "1");
      const publicError = Object.assign(new Error("数据库连接繁忙，请稍后重试。"), { code: "DATABASE_BUSY" });
      reply.code(statusCode).send(formatErrorBody(publicError, statusCode));
      return;
    }
    reply.code(statusCode).send(formatErrorBody(error, statusCode));
  });
  if (process.env.SERVE_STATIC !== "true" && process.env.SERVE_STATIC !== "1") {
    app.setNotFoundHandler((request, reply) => {
      reply.code(404).send({ error: "Route not found", code: "NOT_FOUND" });
    });
  }
  return app;
}
