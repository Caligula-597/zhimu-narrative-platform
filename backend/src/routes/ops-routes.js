import { listAuditLogOps } from "../audit-log.js";
import { getReadinessStatus } from "../database-status.js";
import { getPoolStats } from "../db.js";
import { requireOpsToken } from "../ops-auth.js";
import { getRoomEventBusStatus, getSseConnectionMetrics } from "../room-event-bus.js";
import { getSseConnectionGuardStats, resolveSseConnectionLimits } from "../sse-connection-guard.js";
import { getEventOutboxStatus } from "../event-outbox-dispatcher.js";
import { getTelemetryStatus } from "../telemetry.js";
import { getEmailServiceStatus } from "../email.js";
import { getPublicOAuthDiagnostics } from "../oauth-diagnostics.js";
import { getStripeBillingStatus, isBillingLaunchEnabled } from "../stripe-billing.js";
import { isCreditsSystemEnabled } from "../credits.js";
import { isEmailVerificationRequired } from "../email-verification-policy.js";
import { getPricingPageMode, isCommercialUiVisible } from "../pricing-pages.js";
import { getUploadScanStatus } from "../upload-scan.js";
import { resolveCspMode } from "../security-headers.js";
import {
  buildAlertPayload,
  dispatchAlertWebhook,
  getAlertWebhookConfig
} from "../ops-alert-bridge.js";
import { assignUserPlanByEmail } from "../account-entitlements.js";
import { listPlanUpgradeRequests } from "../plan-upgrade-request.js";
import { PLAN_DEFAULTS } from "../plans.js";
import { getSentryStatus } from "../sentry.js";
import { sendErr } from "../api-errors.js";
import { resolveRoomAccessRateLimits } from "../room-access-abuse-protection.js";
import { resolveVoiceRateLimits } from "../voice-abuse-protection.js";
import { resolveCheckpointRateLimits } from "../checkpoint-abuse-protection.js";
import { resolveVoiceRuntimePolicy } from "../voice-service.js";
import { resolveLiveKitTokenTtlSeconds } from "../livekit.js";
import { registerOpsCatalogRoutes } from "./ops-catalog-routes.js";
import { registerOpsBetaRoutes } from "./ops-beta-routes.js";
import { registerOpsFeedbackRoutes } from "./ops-feedback-routes.js";
import { registerOpsPlazaRoutes } from "./ops-plaza-routes.js";
import { registerOpsUserRoutes } from "./ops-user-routes.js";
import { opsAuditLogQuerySchema } from "./schemas/ops.js";
import {
  explainRateLimitTopology,
  resolveRateLimitTopology
} from "../network-trust-policy.js";
import { inspectDatabaseTlsPolicy } from "../database-connection-options.js";
import { getSessionCookieSecurityStatus } from "../session-cookie.js";
import { getIdentityFoundationStatus } from "../identity-foundation-status.js";
import { canEncryptSecrets } from "../secret-crypto.js";
import { isPlatformLlmUserAccessEnabled } from "../user-llm.js";

export function allRateLimitsPositive(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const values = Object.values(value);
  return values.length > 0 && values.every(allRateLimitsPositive);
}

export function productionTrustGates({
  features,
  rateLimits,
  readiness = {},
  identityFoundation = { ready: false }
}) {
  const uploadScan = features.uploadScan ?? {};
  const uploadMode = uploadScan.mode;
  const hasExternalScanner = Boolean(uploadScan.webhookConfigured || uploadScan.clamAvConfigured);
  const cspMode = resolveCspMode(process.env.NODE_ENV ?? "development");
  const databaseTls = inspectDatabaseTlsPolicy();
  const sessionCookie = getSessionCookieSecurityStatus();
  const sessionRevocationReady = !readiness.missingTables?.includes("auth_sessions");
  const gates = [
    {
      key: "secure_sessions",
      label: "Session cookies + revocation",
      ok: sessionCookie.secure
        && sessionCookie.httpOnly
        && !sessionCookie.bearerResponseEnabled
        && sessionRevocationReady,
      detail:
        `secure=${sessionCookie.secure}; httpOnly=${sessionCookie.httpOnly}; `
        + `bearerResponse=${sessionCookie.bearerResponseEnabled}; `
        + `revocationTable=${sessionRevocationReady ? "ready" : "missing"}`
    },
    {
      key: "email_verification",
      label: "Verified registered identities",
      ok: isEmailVerificationRequired() && Boolean(features.email?.configured),
      detail: `required=${isEmailVerificationRequired()}; provider=${features.email?.provider || "none"}`
    },
    {
      key: "database_tls",
      label: "Verified database TLS",
      ok: databaseTls.trusted,
      detail:
        `enabled=${databaseTls.enabled}; verifyCertificate=${databaseTls.verifyCertificate}; `
        + `ca=${databaseTls.caSource}`
    },
    {
      key: "identity_foundation",
      label: "Account tiers + beta access",
      ok: Boolean(identityFoundation.ready),
      detail:
        `missingPlan=${identityFoundation.usersMissingPlan ?? "unknown"}; `
        + `missingQuota=${identityFoundation.usersMissingQuota ?? "unknown"}; `
        + `approvedBetaMismatch=${identityFoundation.approvedRegisteredUsersWithoutBeta ?? "unknown"}`
    },
    {
      key: "monetization_frozen",
      label: "Launch without charging",
      ok: !isBillingLaunchEnabled()
        && !isCreditsSystemEnabled()
        && getPricingPageMode() === "launch"
        && !isCommercialUiVisible(),
      detail:
        `billing=${isBillingLaunchEnabled()}; credits=${isCreditsSystemEnabled()}; `
        + `pricing=${getPricingPageMode()}; commercialUi=${isCommercialUiVisible()}`
    },
    {
      key: "user_ai_byok",
      label: "User AI is BYOK-only",
      ok: !isPlatformLlmUserAccessEnabled() && canEncryptSecrets(),
      detail:
        `platformPool=${isPlatformLlmUserAccessEnabled() ? "enabled" : "disabled"}; `
        + `credentialEncryption=${canEncryptSecrets() ? "ready" : "missing"}`
    },
    {
      key: "csp",
      label: "CSP enforcement",
      ok: cspMode === "enforce",
      detail: `CSP_MODE=${cspMode}`
    },
    {
      key: "upload_scan",
      label: "Upload malware scan",
      ok: uploadMode === "webhook" || uploadMode === "clamav" || (uploadMode === "strict" && hasExternalScanner),
      detail: `UPLOAD_SCAN_MODE=${uploadMode}; external=${hasExternalScanner ? "configured" : "missing"}`
    },
    {
      key: "telemetry",
      label: "OpenTelemetry export",
      ok: Boolean(features.telemetry?.enabled && features.telemetry?.initialized && !features.telemetry?.error),
      detail: features.telemetry?.error || features.telemetry?.exporter || "none"
    },
    {
      key: "alerts",
      label: "Alert webhook",
      ok: Boolean(features.alerts?.configured),
      detail: features.alerts?.configured ? "configured" : "ALERT_WEBHOOK_URL missing"
    },
    {
      key: "rate_limits",
      label: "API rate limits and network topology",
      ok: allRateLimitsPositive(rateLimits) && Boolean(features.rateLimitTopology?.trusted),
      detail: `${explainRateLimitTopology(features.rateLimitTopology)}; limits=${JSON.stringify(rateLimits)}`
    },
    {
      key: "ops_token",
      label: "OPS token gate",
      ok: Boolean(process.env.OPS_API_TOKEN?.trim())
        && (process.env.NODE_ENV !== "production" || process.env.OPS_API_TOKEN.trim().length >= 16),
      detail: !process.env.OPS_API_TOKEN
        ? "OPS_API_TOKEN missing"
        : process.env.OPS_API_TOKEN.trim().length < 16
          ? "OPS_API_TOKEN too weak (< 16 chars)"
          : "configured"
    }
  ];
  return {
    passed: gates.filter((gate) => gate.ok).length,
    total: gates.length,
    ready: gates.every((gate) => gate.ok),
    gates
  };
}

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
      const [ready, bus, identityFoundation] = await Promise.all([
        getReadinessStatus(),
        Promise.resolve(getRoomEventBusStatus()),
        getIdentityFoundationStatus()
      ]);
      const sse = getSseConnectionMetrics();
      const features = {
        uploadScan: getUploadScanStatus(),
        alerts: getAlertWebhookConfig(),
        roomEventsBus: bus.mode,
        eventOutbox: getEventOutboxStatus(),
        openapiUi: process.env.OPENAPI_UI === "true" || (process.env.NODE_ENV ?? "development") !== "production",
        telemetry: getTelemetryStatus(),
        sentry: getSentryStatus(),
        rateLimitTopology: resolveRateLimitTopology(),
        email: getEmailServiceStatus(),
        oauth: getPublicOAuthDiagnostics(),
        stripe: getStripeBillingStatus(),
        userLlm: {
          platformPoolEnabled: isPlatformLlmUserAccessEnabled(),
          credentialEncryptionReady: canEncryptSecrets()
        },
        voice: {
          tokenTtlSeconds: resolveLiveKitTokenTtlSeconds(),
          ...resolveVoiceRuntimePolicy()
        }
      };
      const rateLimits = {
        authPerMin: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 20),
        authRecoveryPer15Min: Number(process.env.RATE_LIMIT_AUTH_RECOVERY_MAX ?? 6),
        verificationResendPer15Min: Number(process.env.RATE_LIMIT_VERIFICATION_RESEND_MAX ?? 3),
        writePerMin: Number(process.env.RATE_LIMIT_WRITE_MAX ?? 120),
        readPerMin: Number(process.env.RATE_LIMIT_READ_MAX ?? 300),
        uploadPerMin: Number(process.env.RATE_LIMIT_UPLOAD_MAX ?? 30),
        documentPerMin: Number(process.env.RATE_LIMIT_DOCUMENT_MAX ?? 10),
        scriptBundlePerMin: Number(process.env.RATE_LIMIT_SCRIPT_BUNDLE_MAX ?? 4),
        aiPerMin: Number(process.env.RATE_LIMIT_AI_MAX ?? 40),
        network: {
          apiPerMin: Number(process.env.RATE_LIMIT_API_IP_MAX ?? 600),
          uploadPerMin: Number(process.env.RATE_LIMIT_UPLOAD_IP_MAX ?? 120),
          documentPerMin: Number(process.env.RATE_LIMIT_DOCUMENT_IP_MAX ?? 60),
          scriptBundlePerMin: Number(process.env.RATE_LIMIT_SCRIPT_BUNDLE_IP_MAX ?? 20),
          aiPerMin: Number(process.env.RATE_LIMIT_AI_IP_MAX ?? 160)
        },
        feedbackPerHour: Number(process.env.RATE_LIMIT_FEEDBACK_MAX ?? 10),
        roomAccess: resolveRoomAccessRateLimits(),
        voice: resolveVoiceRateLimits(),
        checkpoint: resolveCheckpointRateLimits()
      };
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
        identityFoundation,
        pool: getPoolStats(),
        sse: {
          connections: sse.connections,
          rooms: sse.rooms,
          admission: getSseConnectionGuardStats(),
          limits: resolveSseConnectionLimits()
        },
        roomEventBus: bus,
        features,
        rateLimits,
        productionTrust: productionTrustGates({
          features,
          rateLimits,
          readiness: ready,
          identityFoundation
        })
      };
    }
  );

  app.post(
    "/api/ops/alerts/test",
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
    async (_request, reply) => {
      const config = getAlertWebhookConfig();
      if (!config.configured) return sendErr(reply, "UNAVAILABLE", "ALERT_WEBHOOK_URL not configured");
      const payload = await buildAlertPayload({
        severity: "info",
        title: "织幕告警测试",
        body: "来自 POST /api/ops/alerts/test 的手动探测。",
        labels: { kind: "manual_test" }
      });
      const result = await dispatchAlertWebhook(payload);
      return reply.code(200).send({ ok: true, ...result, payload });
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

  app.get(
    "/api/ops/plan-upgrade/requests",
    {
      schema: {
        hide: true,
        tags: ["system"],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: { type: "string", enum: ["pending", "approved", "rejected"] },
            limit: { type: "integer", minimum: 1, maximum: 200 },
            offset: { type: "integer", minimum: 0, maximum: 100_000 }
          }
        }
      }
    },
    async (request) => {
      const { status, limit, offset } = request.query ?? {};
      return listPlanUpgradeRequests({ status, limit, offset });
    }
  );

  await registerOpsCatalogRoutes(app);
  await registerOpsBetaRoutes(app);
  await registerOpsFeedbackRoutes(app);
  await registerOpsPlazaRoutes(app);
  await registerOpsUserRoutes(app);
}
