import { hasDiagnosticToken } from "./ops-auth.js";

export function healthDetailsVisible(request, nodeEnv = process.env.NODE_ENV ?? "development") {
  return nodeEnv !== "production" || hasDiagnosticToken(request, nodeEnv);
}

export function healthResponseBody(request, detailedBody, {
  nodeEnv = process.env.NODE_ENV ?? "development",
  readiness = false
} = {}) {
  if (healthDetailsVisible(request, nodeEnv)) return detailedBody;
  if (readiness) {
    const ready = Boolean(detailedBody?.ready);
    return { ok: ready, ready };
  }
  return { ok: Boolean(detailedBody?.ok) };
}
