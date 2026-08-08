#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
let passed = 0;

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function check(label, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${label}`);
    return;
  }
  failures.push({ label, detail });
  console.error(`FAIL  ${label}${detail ? `: ${detail}` : ""}`);
}

const app = source("backend/src/app.js");
const startup = source("backend/src/startup-validation.js");
const database = source("backend/src/db.js");
const databaseSafety = source("backend/src/database-operation-safety.js");
const cookie = source("backend/src/session-cookie.js");
const requestActor = source("backend/src/request-actor.js");
const cookieOrigin = source("backend/src/cookie-request-origin.js");
const authRouteShared = source("backend/src/routes/auth-route-shared.js");
const headers = source("backend/src/security-headers.js");
const healthPolicy = source("backend/src/health-response-policy.js");
const healthCache = source("backend/src/health-status-cache.js");
const systemRoutes = source("backend/src/routes/system-routes.js");
const opsAuth = source("backend/src/ops-auth.js");
const upstreamFetch = source("backend/src/upstream-fetch.js");
const cspReports = source("backend/src/csp-reports.js");
const metrics = source("backend/src/metrics.js");
const oauthRequestPolicy = source("backend/src/oauth-request-policy.js");
const authOauthRoutes = source("backend/src/routes/auth-oauth-routes.js");
const emailService = source("backend/src/email/index.js");
const authRegistrationRoutes = source("backend/src/routes/auth-registration-routes.js");
const authSessionService = source("backend/src/auth-session-service.js");
const accountRoutes = source("backend/src/routes/account-routes.js");
const accountDeleteAuthorization = source("backend/src/account-delete-authorization.js");
const assetRoutes = source("backend/src/routes/asset-routes.js");
const assetService = source("backend/src/asset-service.js");
const portalProfileService = source("backend/src/portal-profile-service.js");
const uploadPromotion = source("backend/src/upload-object-promotion.js");
const objectStorage = source("backend/src/storage/object-storage.js");
const secretCrypto = source("backend/src/secret-crypto.js");
const llmProbe = source("backend/src/llm-probe.js");
const secretAudit = source("scripts/audit-secret-exposure.mjs");
const packageJson = source("package.json");
const pureSecurityRunner = source("backend/scripts/run-pure-security-tests.mjs");
const backendPackageJson = source("backend/package.json");
const fullChain = source("scripts/full-chain.mjs");
const periodicAudit = source("scripts/periodic-audit.mjs");
const secureRandom = source("shared/secure-random.js");
const sharedApiFetch = source("shared/api-fetch.js");
const sharedApiClient = source("shared/api-client.js");
const hostWriteIds = [
  "host/src/runtime/host-event-workspace-model.js",
  "host/src/runtime/host-archive-model.js",
  "host/src/runtime/host-rule-workspace-model.js",
  "host/src/runtime/host-room-create-model.js",
  "host/src/runtime/host-vote-workspace-model.js"
].map(source).join("\n");
const uploadPolicy = source("backend/src/asset-policy.js");
const uploadHelpers = source("backend/src/asset-upload-helpers.js");
const invites = source("backend/src/world-invites.js");
const roomEvents = source("backend/src/routes/room-events-routes.js");
const platformEvents = source("backend/src/routes/platform-social-routes.js");
const outbound = source("backend/src/pinned-outbound-fetch.js");
const deepseekClient = source("backend/src/deepseek-client.js");
const logger = source("backend/src/logger-config.js");
const railwayEnvSync = source("scripts/sync-railway-env.mjs");
const productionEnvTemplate = source("backend/.env.production.example");

check(
  "credentialed production CORS rejects wildcard origins",
  /wildcard CORS is forbidden in production/u.test(startup)
    && /resolveAllowedCorsOrigins\(\{\}, nodeEnv\) === true/u.test(startup)
);
check(
  "session cookies remain HttpOnly, SameSite and production Secure",
  /"HttpOnly"/u.test(cookie)
    && /"SameSite=Lax"/u.test(cookie)
    && /nodeEnv === "production"/u.test(cookie)
    && /parts\.push\("Secure"\)/u.test(cookie)
);
check(
  "responses enforce clickjacking, MIME, HSTS and Trusted Types controls",
  /X-Content-Type-Options/u.test(headers)
    && /X-Frame-Options/u.test(headers)
    && /Strict-Transport-Security/u.test(headers)
    && /require-trusted-types-for 'script'/u.test(headers)
    && /applySecurityHeaders/u.test(app)
);
check(
  "authenticated and session-setting API responses are explicitly non-cacheable",
  /applySensitiveResponseHeaders/u.test(app)
    && /private, no-store, no-transform, max-age=0/u.test(headers)
    && /Surrogate-Control/u.test(headers)
    && /Authorization", "Cookie/u.test(headers)
);
check(
  "public production health probes do not expose infrastructure topology",
  /nodeEnv !== "production" \|\| hasDiagnosticToken\(request, nodeEnv\)/u.test(healthPolicy)
    && /return \{ ok: ready, ready \}/u.test(healthPolicy)
    && /healthResponseBody\(request, body/u.test(systemRoutes)
    && /hasDiagnosticToken/u.test(opsAuth)
    && /\|health\)/u.test(headers)
);
check(
  "concurrent production health probes cannot amplify database reads",
  /pending = Promise\.resolve/u.test(healthCache)
    && /nodeEnv === "production" \? 1000 : 0/u.test(healthCache)
    && /<= 10_000/u.test(healthCache)
    && /createHealthStatusLoader\(getReadinessStatus/u.test(systemRoutes)
    && /HEALTH_STATUS_CACHE_MS/u.test(railwayEnvSync)
    && /HEALTH_STATUS_CACHE_MS=1000/u.test(productionEnvTemplate)
);
check(
  "repository secret fingerprints are scanned by the standard security command",
  /KNOWN_SECRET_PATTERNS/u.test(secretAudit)
    && /database-url-with-password/u.test(secretAudit)
    && /check:secret-exposure/u.test(packageJson)
    && /check:security-baseline[^\n]+check:secret-exposure/u.test(packageJson)
);
check(
  "pure security regression cannot inherit a managed database URL",
  /127\.0\.0\.1:65432\/zhimu_security_pure/u.test(pureSecurityRunner)
    && /DATABASE_URL:/u.test(pureSecurityRunner)
    && /test:security:pure/u.test(backendPackageJson)
    && /test:security:pure/u.test(packageJson)
    && /pure security regression/u.test(fullChain)
    && /pure-security-regression/u.test(periodicAudit)
);
check(
  "browser write and idempotency identifiers use cryptographic randomness",
  /getRandomValues/u.test(secureRandom)
    && /randomUUID/u.test(secureRandom)
    && /Secure random number generator is unavailable/u.test(secureRandom)
    && /secureRandomId\(prefix\)/u.test(sharedApiFetch)
    && /secureRandomId/u.test(hostWriteIds)
    && !/Math\.random/u.test(sharedApiFetch)
    && !/Math\.random/u.test(hostWriteIds)
);
check(
  "body-heavy routes have network admission before parsing",
  /app\.addHook\("onRequest"/u.test(app)
    && /scriptBundleNetworkRateLimit/u.test(app)
    && /documentNetworkRateLimit/u.test(app)
    && /uploadNetworkRateLimit/u.test(app)
    && /aiNetworkRateLimit/u.test(app)
);
check(
  "all API traffic has IP admission before session database resolution",
  /apiNetworkRateLimit/u.test(app)
    && /shouldSkipApiNetworkRateLimit/u.test(app)
    && /url === "\/api\/health\/live"/u.test(app)
    && /app\.addHook\("onRequest"/u.test(app)
    && app.indexOf("apiNetworkRateLimit(request, reply)") < app.indexOf("resolveRequestActor(request")
);
check(
  "raw test runners cannot silently connect to production-looking databases",
  /NODE_TEST_CONTEXT/u.test(database)
    && /assertSafeDatabaseUrlForTestWrites/u.test(database)
    && /database module test runner/u.test(database)
    && /refusing production-looking database/u.test(databaseSafety)
);
check(
  "malformed session credentials are bounded before lookup",
  /\[A-Za-z0-9_-\]\{16,128\}/u.test(cookie)
    && /decodeURIComponent/u.test(cookie)
    && /catch/u.test(cookie)
    && /\[A-Za-z0-9_-\]\{16,128\}/u.test(requestActor)
);
check(
  "stale bearer credentials fall back to the authoritative cookie session",
  /candidates/u.test(requestActor)
    && /transport: "bearer"/u.test(requestActor)
    && /transport: "cookie"/u.test(requestActor)
    && /for \(const candidate of candidates\)/u.test(requestActor)
);
check(
  "cookie-authenticated mutations reject cross-site browser origins",
  /assertCookieRequestOrigin/u.test(app)
    && /authTransport !== "cookie"/u.test(cookieOrigin)
    && /sec-fetch-site/u.test(cookieOrigin)
    && /CSRF_ORIGIN_FORBIDDEN/u.test(cookieOrigin)
);
check(
  "production auth responses keep bearer tokens out of browser JSON by default",
  /SESSION_BEARER_RESPONSE_ENABLED/u.test(cookie)
    && /return nodeEnv !== "production"/u.test(cookie)
    && /sessionResponsePayload/u.test(authRouteShared)
    && /SESSION_BEARER_RESPONSE_ENABLED = "false"/u.test(railwayEnvSync)
    && /SESSION_BEARER_RESPONSE_ENABLED=false/u.test(productionEnvTemplate)
);
check(
  "unverified registered identities cannot obtain or reuse full sessions",
  /pendingEmailVerification\s*\?\s*null/u.test(authSessionService)
    && /revokeAllIdentitySessions/u.test(authSessionService)
    && /identity\.email_verified_at IS NOT NULL/u.test(source("backend/src/auth.js"))
    && /identity\.user_kind = 'guest'/u.test(source("backend/src/auth.js"))
    && /tokenStore && !payload\?\.pendingEmailVerification/u.test(sharedApiClient)
);
check(
  "account deletion requires password or a recent active passwordless session",
  /authorizeAccountDeletion/u.test(accountRoutes)
    && /password: \{ type: "string", minLength: 8, maxLength: 128 \}/u.test(accountRoutes)
    && /ACCOUNT_DELETE_RECENT_SESSION_MS = 10 \* 60 \* 1000/u.test(accountDeleteAuthorization)
    && /verifyPassword/u.test(accountDeleteAuthorization)
    && /assertAccountDeleteAuthorizationProof/u.test(source("backend/src/account-delete.js"))
    && /"\/api\/account\/delete"/u.test(app)
);
check(
  "active uploads reject markup/executables and receive server-side scanning",
  /"\.svg"/u.test(uploadPolicy)
    && /"\.html"/u.test(uploadPolicy)
    && /"\.js"/u.test(uploadPolicy)
    && /scanUploadedObject/u.test(uploadHelpers)
    && /UPLOAD_SIZE_MISMATCH/u.test(uploadHelpers)
);

const mismatchCheck = invites.indexOf("WORLD_INVITE_EMAIL_MISMATCH");
const consumeInvite = invites.indexOf("UPDATE world_member_invites", mismatchCheck);
check(
  "collaborator invite acceptance is locked and mismatch-safe",
  /transactionRunner = transaction/u.test(invites)
    && /FOR UPDATE/u.test(invites)
    && mismatchCheck >= 0
    && consumeInvite > mismatchCheck,
  "email mismatch must be checked before the invite is consumed"
);

for (const [label, streamSource] of [
  ["room SSE", roomEvents],
  ["platform SSE", platformEvents]
]) {
  check(
    `${label} reserves and releases bounded connection capacity`,
    /acquireSseConnection\(request, reply\)/u.test(streamSource)
      && /releaseConnection\(\)/u.test(streamSource)
      && /if \(closed\) \{\s*unsubscribe\(\);\s*return;/u.test(streamSource)
      && /\}\)\) cleanup\(true\);/u.test(streamSource)
  );
}

check(
  "user-configurable LLM traffic uses DNS-pinned outbound fetch",
  /resolveSafeOutboundHttpsTarget/u.test(outbound)
    && /redirect: "manual"/u.test(outbound)
    && /withPinnedOutboundResponse|fetchPinnedOutboundJson/u.test(deepseekClient)
);
check(
  "credentialed upstream integrations cannot follow redirects",
  /redirect: "manual"/u.test(upstreamFetch)
    && /Never follow redirects/u.test(upstreamFetch)
);
check(
  "public telemetry cannot create unbounded metric labels or values",
  /normalizeDisposition/u.test(cspReports)
    && /return raw === "enforce" \|\| raw === "report" \? raw : "other"/u.test(cspReports)
    && /webVitalMaximums/u.test(metrics)
    && /webVitalApps/u.test(metrics)
    && /value > webVitalMaximums\[name\]/u.test(metrics)
);
check(
  "OAuth callback inputs are bounded and provider errors are not reflected",
  /code: \{ type: "string", minLength: 1, maxLength: 4096 \}/u.test(oauthRequestPolicy)
    && /state: \{ type: "string", minLength: 16, maxLength: 128/u.test(oauthRequestPolicy)
    && /returnOrigin: \{ type: "string", minLength: 8, maxLength: 200 \}/u.test(oauthRequestPolicy)
    && /return String\(value \|\| ""\)\.trim\(\) \? "OAUTH_EXCHANGE_FAILED" : ""/u.test(oauthRequestPolicy)
    && /oauthProviderErrorCode\(oauthError\)/u.test(authOauthRoutes)
);
check(
  "anonymous auth configuration does not expose operations email topology",
  /return \{ configured: isEmailConfigured\(\) \}/u.test(emailService)
    && /getPublicEmailServiceStatus\(\)/u.test(authRegistrationRoutes)
    && !/getEmailServiceStatus\(\)/u.test(authRegistrationRoutes)
);
check(
  "asset download identifiers are schema-validated before database access",
  /download-url", \{ schema: \{ params: assetIdParams \} \}/u.test(assetRoutes)
);
check(
  "client uploads are scanned then conditionally promoted to server-only object keys",
  /copyObjectIfUnchanged/u.test(objectStorage)
    && /sourceEtag/u.test(uploadPromotion)
    && /UPLOAD_SCAN_SPOOFED/u.test(uploadPromotion)
    && /assets\/published/u.test(assetService)
    && /profiles\/\$\{portal\}\/published/u.test(portalProfileService)
    && /finalObjectKey/u.test(assetRoutes)
);
check(
  "production BYOK uses an independent encryption secret and hides provider errors",
  /NODE_ENV === "production"/u.test(secretCrypto)
    && /PRODUCTION_SECRET_MIN_LENGTH = 32/u.test(secretCrypto)
    && !/payload\.error\?\.message/u.test(llmProbe)
    && /llmProbeFailureMessage/u.test(llmProbe)
    && /LLM_CREDENTIALS_SECRET/u.test(productionEnvTemplate)
);
check(
  "production request logs strip query strings that can carry secrets",
  /split\("\?"\)\[0\]/u.test(logger)
    && /reset tokens and invite codes/u.test(logger)
);
check(
  "deployment templates preserve API and SSE abuse limits",
  /RATE_LIMIT_API_IP_MAX/u.test(railwayEnvSync)
    && /SSE_MAX_CONNECTIONS_PER_ACTOR/u.test(railwayEnvSync)
    && /SSE_MAX_CONNECTIONS_PER_IP/u.test(railwayEnvSync)
    && /SSE_MAX_CONNECTIONS_TOTAL/u.test(railwayEnvSync)
    && /RATE_LIMIT_API_IP_MAX=600/u.test(productionEnvTemplate)
    && /SSE_MAX_CONNECTIONS_TOTAL=2000/u.test(productionEnvTemplate)
    && /SESSION_BEARER_RESPONSE_ENABLED=false/u.test(productionEnvTemplate)
);

if (failures.length) {
  console.error(`\nsecurity baseline failed: ${failures.length} invariant(s) missing`);
  process.exit(1);
}

console.log(`\nsecurity baseline passed: ${passed} invariants`);
