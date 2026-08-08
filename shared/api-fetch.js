/**
 * Shared fetch wrapper — timeout, JSON body, transport errors.
 * Used by main / play / host API clients via createApiFetch().
 */
import { traceRequestHeaders } from "./trace-context.js";
import { isKnownApiErrorCode } from "./contracts/error-codes.js";
import { secureRandomId } from "./secure-random.js";

/**
 * @param {Response} response
 * @param {{ allowInvalid?: boolean }} [options]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function parseJsonResponse(response, { allowInvalid = false } = {}) {
  if (response.status === 204 || response.status === 205) return {};
  try {
    return await response.json();
  } catch (cause) {
    if (allowInvalid) return {};
    const contentType = response.headers?.get?.("content-type") || "unknown content type";
    const error = new Error(`服务器响应格式异常，请稍后重试（${contentType}）`);
    error.code = "INVALID_API_RESPONSE";
    error.status = response.status;
    error.cause = cause;
    throw error;
  }
}

/**
 * @param {number} timeoutMs
 */
export function createAbortTimer(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timer);
    }
  };
}

/**
 * @typedef {Object} ApiFetchConfig
 * @property {string} baseUrl
 * @property {number} [defaultTimeoutMs=20000]
 * @property {RequestCredentials} [credentials='include']
 * @property {(ctx: { method: string, path: string, body?: unknown, options: object }) => Record<string, string>} [getHeaders]
 * @property {(response: Response, payload: Record<string, unknown>, ctx: { method: string, path: string }) => Error | null | undefined} [mapHttpError]
 * @property {(error: Error, ctx: { timeoutMs: number, method: string, path: string }) => Error} [mapTransportError]
 * @property {(path: string, payload: Record<string, unknown>, response: Response) => void} [afterSuccess]
 * @property {(path: string, options: object, error: Error, attempt: number) => Promise<unknown>|null|undefined} [onHttpError]
 * @property {() => unknown} [getRequestState] Snapshot client state for stale-response protection.
 */

/**
 * @param {ApiFetchConfig} config
 */
export function createApiFetch(config) {
  const {
    baseUrl,
    defaultTimeoutMs = 20000,
    credentials = "include",
    getHeaders = () => ({}),
    mapHttpError,
    mapTransportError = defaultTransportError,
    afterSuccess,
    onHttpError,
    getRequestState = () => undefined
  } = config;

  /**
   * @param {string} path
   * @param {{ method?: string, body?: unknown, timeoutMs?: number, headers?: Record<string, string>, idempotent?: boolean, idempotencyKey?: string }} [options]
   * @param {number} [attempt=0]
   */
  async function request(path, options = {}, attempt = 0) {
    const requestState = getRequestState();
    const method = options.method || "GET";
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    const headers = {
      ...traceRequestHeaders(),
      ...getHeaders({ method, path, body: options.body, options }),
      ...(options.headers || {})
    };
    if (options.body !== undefined) headers["content-type"] = "application/json";
    if (options.idempotent && method !== "GET" && method !== "HEAD") {
      headers["idempotency-key"] = options.idempotencyKey || resolveStickyIdempotencyKey(method, path, options.body);
    }

    const timer = createAbortTimer(timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: timer.signal,
        credentials
      });
      // Error responses may legitimately have an empty body, but every
      // successful API response is a JSON contract. Reject HTML SPA fallbacks
      // and proxy error pages before they can corrupt application state.
      const payload = await parseJsonResponse(response, { allowInvalid: !response.ok });
      if (!response.ok) {
        const err =
          mapHttpError?.(response, payload, { method, path, headers, options, attempt, requestState }) ??
          defaultHttpError(response, payload, method, path);
        const retry = await onHttpError?.(path, options, err, attempt, {
          method,
          headers,
          requestState
        });
        if (retry !== undefined && retry !== null) return retry;
        throw err;
      }
      afterSuccess?.(path, payload, response);
      return payload;
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError" && error.status != null) {
        throw error;
      }
      throw mapTransportError(error instanceof Error ? error : new Error(String(error)), {
        timeoutMs,
        method,
        path
      });
    } finally {
      timer.clear();
    }
  }

  return { request };
}

/** @param {string} [prefix='idem'] */
export function createIdempotencyKey(prefix = "idem") {
  return secureRandomId(prefix);
}

/** Sticky keys so double-click / short retries reuse the same claim window. */
const stickyIdempotencyKeys = new Map();
const STICKY_IDEMPOTENCY_MS = 30_000;

function resolveStickyIdempotencyKey(method, path, body) {
  const fingerprint = `${method}:${path}:${stableBodyFingerprint(body)}`;
  const now = Date.now();
  const existing = stickyIdempotencyKeys.get(fingerprint);
  if (existing && now - existing.at < STICKY_IDEMPOTENCY_MS) return existing.key;
  const key = createIdempotencyKey();
  stickyIdempotencyKeys.set(fingerprint, { key, at: now });
  if (stickyIdempotencyKeys.size > 200) {
    for (const [k, v] of stickyIdempotencyKeys) {
      if (now - v.at >= STICKY_IDEMPOTENCY_MS) stickyIdempotencyKeys.delete(k);
    }
  }
  return key;
}

function stableBodyFingerprint(body) {
  if (body == null) return "";
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

/**
 * @param {Response} response
 * @param {Record<string, unknown>} payload
 * @param {string} method
 * @param {string} path
 */
export function defaultHttpError(response, payload, method, path) {
  const err = new Error(
    String(payload.error || payload.message || `${method} ${path} failed (${response.status})`)
  );
  err.code = payload.code;
  err.status = response.status;
  err.details = payload.details;
  err.known = isKnownApiErrorCode(payload.code);
  return err;
}

/** @param {Error} error @param {{ timeoutMs: number }} ctx */
export function defaultTransportError(error, ctx) {
  if (error.name === "AbortError") {
    const err = new Error("请求超时");
    err.code = "REQUEST_TIMEOUT";
    return err;
  }
  if (error instanceof TypeError) {
    const err = new Error("网络错误");
    err.code = "NETWORK_ERROR";
    return err;
  }
  return error;
}

/** Auth paths that may return a session token in the JSON body. */
export const AUTH_TOKEN_PATH_RE =
  /^\/auth\/(login|register|guest|upgrade|verify-email|oauth\/complete)/;

/**
 * @param {string} path
 * @param {Record<string, unknown>} payload
 * @returns {string|undefined}
 */
export function extractAuthToken(path, payload) {
  if (!AUTH_TOKEN_PATH_RE.test(path)) return undefined;
  return typeof payload.token === "string" ? payload.token : undefined;
}
