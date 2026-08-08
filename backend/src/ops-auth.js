import { timingSafeEqual } from "node:crypto";
import { throwErr } from "./api-errors.js";
import { bearerToken } from "./request-actor.js";

const MIN_OPS_TOKEN_LENGTH = 16;
const MIN_METRICS_TOKEN_LENGTH = 16;

function safeEqual(provided, configured) {
  if (typeof provided !== "string" || typeof configured !== "string") return false;
  const bufA = Buffer.from(provided);
  const bufB = Buffer.from(configured);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function validConfiguredToken(configured, provided, minimumLength, nodeEnv) {
  if (!configured || !provided) return false;
  if (nodeEnv === "production" && configured.length < minimumLength) return false;
  return safeEqual(String(provided), configured);
}

/** Allow detailed health diagnostics without making load-balancer probes private. */
export function hasDiagnosticToken(request, nodeEnv = process.env.NODE_ENV ?? "development") {
  const bearer = bearerToken(request);
  const opsToken = process.env.OPS_API_TOKEN?.trim() || "";
  const metricsToken = process.env.METRICS_TOKEN?.trim() || "";
  return validConfiguredToken(
    opsToken,
    request.headers["x-ops-token"] || bearer,
    MIN_OPS_TOKEN_LENGTH,
    nodeEnv
  ) || validConfiguredToken(
    metricsToken,
    request.headers["x-metrics-token"] || bearer,
    MIN_METRICS_TOKEN_LENGTH,
    nodeEnv
  );
}

export function requireOpsToken(request) {
  const configured = process.env.OPS_API_TOKEN?.trim();
  if (!configured) {
    throwErr("OPS_NOT_CONFIGURED");
  }
  if (process.env.NODE_ENV === "production" && configured.length < MIN_OPS_TOKEN_LENGTH) {
    throwErr("OPS_TOKEN_TOO_WEAK");
  }
  const provided = request.headers["x-ops-token"] || bearerToken(request);
  if (!safeEqual(provided, configured)) {
    request.log?.warn(
      { url: request.url, ip: request.ip },
      "Ops token authentication failed"
    );
    throwErr("OPS_TOKEN_REQUIRED");
  }
}

export function requireMetricsToken(request) {
  const configured = process.env.METRICS_TOKEN?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throwErr("METRICS_NOT_CONFIGURED");
    }
    return;
  }
  if (process.env.NODE_ENV === "production" && configured.length < MIN_METRICS_TOKEN_LENGTH) {
    throwErr("METRICS_NOT_CONFIGURED");
  }
  const provided = request.headers["x-metrics-token"] || bearerToken(request);
  if (!safeEqual(provided, configured)) {
    request.log?.warn(
      { url: request.url, ip: request.ip },
      "Metrics token authentication failed"
    );
    throwErr("METRICS_TOKEN_REQUIRED");
  }
}
