import { throwErr } from "./api-errors.js";
import { bearerToken } from "./request-actor.js";

export function requireOpsToken(request) {
  const configured = process.env.OPS_API_TOKEN?.trim();
  if (!configured) {
    throwErr("OPS_NOT_CONFIGURED");
  }
  const provided = request.headers["x-ops-token"] || bearerToken(request);
  if (provided !== configured) {
    throwErr("OPS_TOKEN_REQUIRED");
  }
}

export function requireMetricsToken(request) {
  const configured = process.env.METRICS_TOKEN?.trim();
  if (!configured) {
    return;
  }
  const provided = request.headers["x-metrics-token"] || bearerToken(request);
  if (provided !== configured) {
    throwErr("METRICS_TOKEN_REQUIRED");
  }
}
