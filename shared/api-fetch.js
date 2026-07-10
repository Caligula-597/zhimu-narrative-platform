/**
 * Shared fetch wrapper — timeout, JSON body, transport errors.
 * Used by main / play / host API clients via createApiFetch().
 */
import { traceRequestHeaders } from "./trace-context.js";

/**
 * @param {Response} response
 * @returns {Promise<Record<string, unknown>>}
 */
export async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
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
    onHttpError
  } = config;

  /**
   * @param {string} path
   * @param {{ method?: string, body?: unknown, timeoutMs?: number, headers?: Record<string, string>, idempotent?: boolean, idempotencyKey?: string }} [options]
   * @param {number} [attempt=0]
   */
  async function request(path, options = {}, attempt = 0) {
    const method = options.method || "GET";
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    const headers = {
      ...traceRequestHeaders(),
      ...getHeaders({ method, path, body: options.body, options }),
      ...(options.headers || {})
    };
    if (options.body !== undefined) headers["content-type"] = "application/json";
    if (options.idempotent && method !== "GET" && method !== "HEAD") {
      headers["idempotency-key"] = options.idempotencyKey || createIdempotencyKey();
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
      const payload = await parseJsonResponse(response);
      if (!response.ok) {
        const err =
          mapHttpError?.(response, payload, { method, path }) ??
          defaultHttpError(response, payload, method, path);
        const retry = await onHttpError?.(path, options, err, attempt);
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
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
