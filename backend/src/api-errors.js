/** Unified API error shape: { error, code, details? } */

import { API_ERRORS, errorMeta } from "./error-codes.js";

const STATUS_DEFAULT_CODES = {
  400: "BAD_REQUEST",
  401: "AUTH_REQUIRED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "UNPROCESSABLE",
  429: "RATE_LIMITED",
  500: "INTERNAL_ERROR",
  502: "UPSTREAM_ERROR",
  503: "UNAVAILABLE",
  504: "GATEWAY_TIMEOUT"
};

export { API_ERRORS };

export function httpError(statusCode, message, code, details) {
  const err = Object.assign(new Error(message), {
    statusCode,
    code: code ?? STATUS_DEFAULT_CODES[statusCode] ?? "INTERNAL_ERROR"
  });
  if (details !== undefined) err.details = details;
  return err;
}

/** Throw using a registered API error code (optional message override). */
export function throwErr(code, message, details) {
  const meta = errorMeta(code);
  if (!meta) throw new Error(`Unknown API error code: ${code}`);
  const err = Object.assign(new Error(message ?? meta.message), {
    statusCode: meta.status,
    code
  });
  if (details !== undefined) err.details = details;
  throw err;
}

/** Reply using a registered API error code (optional message override). */
export function sendErr(reply, code, message, details) {
  const meta = errorMeta(code);
  if (!meta) {
    return sendApiError(reply, 500, message ?? "Internal error", "INTERNAL_ERROR", details);
  }
  return sendApiError(reply, meta.status, message ?? meta.message, code, details);
}

export function resolveErrorCode(error, statusCode) {
  if (error.code && typeof error.code === "string" && errorMeta(error.code)) return error.code;
  if (error.validation) return "VALIDATION_ERROR";
  return STATUS_DEFAULT_CODES[statusCode] ?? "INTERNAL_ERROR";
}

export function formatErrorBody(error, statusCode) {
  const code = resolveErrorCode(error, statusCode);
  const meta = errorMeta(code);
  const exposeDetails = statusCode < 500;
  const body = {
    error: statusCode >= 500
      ? (meta?.message || "Internal server error")
      : (error.message || meta?.message || "Request failed"),
    code
  };
  if (exposeDetails && error.details !== undefined) body.details = error.details;
  if (error.validation) {
    body.details = { validation: error.validation };
  }
  return body;
}

export function sendApiError(reply, statusCode, message, code, details) {
  const body = { error: message, code: code ?? STATUS_DEFAULT_CODES[statusCode] ?? "INTERNAL_ERROR" };
  if (details !== undefined) body.details = details;
  return reply.code(statusCode).send(body);
}
