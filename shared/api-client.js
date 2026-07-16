/**
 * Shared portal API client factory — unifies play / host / main app fetch wiring.
 */
import { createApiFetch, extractAuthToken } from "./api-fetch.js";
import { openSseStream } from "./sse-client.js";
import { validatePlatformEvent } from "./contracts/platform-events.js";
import { shouldInvalidateSessionForUnauthorized } from "./auth-state.js";

/**
 * Resolve `/api` base for Vite portals (play.* / host.* → app.* in prod).
 * @param {{ viteAppOrigin?: string, viteApiOrigin?: string, dev?: boolean, fallbackAppOrigin?: string }} [options]
 */
export function resolveVitePortalApiBase({
  viteAppOrigin = "",
  viteApiOrigin = "",
  dev = false,
  fallbackAppOrigin = "https://app.getzhimu.com"
} = {}) {
  const appOrigin = (viteAppOrigin || fallbackAppOrigin).replace(/\/$/, "");
  const apiOriginRaw = viteApiOrigin?.replace(/\/$/, "") || "";
  const apiOrigin = apiOriginRaw || (dev ? "" : appOrigin);
  return apiOrigin ? `${apiOrigin}/api` : "/api";
}

/**
 * @param {Storage|null|undefined} storage
 * @param {{ demoModeKey?: string, demoUserIdKey?: string, requireDemoFlag?: boolean }} [options]
 * @returns {string|null}
 */
export function resolveDemoUserId(
  storage = globalThis.localStorage,
  { demoModeKey = "zhimuDemoMode", demoUserIdKey = "zhimuDemoUserId", requireDemoFlag = false } = {}
) {
  if (!storage?.getItem) return null;
  if (requireDemoFlag && storage.getItem(demoModeKey) !== "true") return null;
  return storage.getItem(demoUserIdKey) || null;
}

/**
 * @param {{ bearerHeaders: () => Record<string, string> }} tokenStore
 * @param {{ demoUserId?: string|null }} [options]
 */
export function buildBearerAuthHeaders(tokenStore, { demoUserId = null } = {}) {
  const headers = { ...tokenStore.bearerHeaders() };
  if (demoUserId) headers["x-user-id"] = demoUserId;
  return headers;
}

/**
 * @param {Response} response
 * @param {Record<string, unknown>} payload
 * @param {string} [fallbackPrefix]
 */
export function createPortalJsonError(response, payload, fallbackPrefix = "请求失败") {
  const err = new Error(String(payload.error || payload.message || `${fallbackPrefix} (${response.status})`));
  err.code = payload.code;
  err.status = response.status;
  err.details = payload.details;
  return err;
}

/**
 * @typedef {Object} PortalApiClient
 * @property {(path: string, options?: object) => Promise<unknown>} request
 * @property {(ctx: { roomId: string, onEvent: Function, signal?: AbortSignal, cursorKey?: string, connectedOnOpen?: boolean, headers?: Record<string, string> }) => Promise<unknown>} streamRoomEvents
 * @property {(ctx: { onEvent: Function, signal?: AbortSignal, cursorKey?: string, headers?: Record<string, string> }) => Promise<unknown>} streamPlatformEvents
 */

/**
 * @param {Object} config
 * @param {string} config.baseUrl
 * @param {{ bearerHeaders: () => Record<string, string>, set: (token: string, source?: string) => void, clear?: (source?: string) => void }} [config.tokenStore]
 * @param {() => string|null|undefined} [config.getDemoUserId]
 * @param {(ctx: { options: object }) => Record<string, string>} [config.getHeaders]
 * @param {import("./api-fetch.js").ApiFetchConfig["mapHttpError"]} [config.mapHttpError]
 * @param {import("./api-fetch.js").ApiFetchConfig["mapTransportError"]} [config.mapTransportError]
 * @param {import("./api-fetch.js").ApiFetchConfig["onHttpError"]} [config.onHttpError]
 * @param {(path: string, payload: Record<string, unknown>, response: Response) => void} [config.afterSuccess]
 * @param {RequestCredentials} [config.credentials]
 * @param {number} [config.defaultTimeoutMs]
 * @param {boolean} [config.clearTokenOn401]
 * @param {() => unknown} [config.getRequestState]
 * @returns {PortalApiClient}
 */
export function createPortalApiClient(config) {
  const {
    baseUrl,
    tokenStore = null,
    getDemoUserId = () => resolveDemoUserId(),
    getHeaders: customGetHeaders,
    mapHttpError = createPortalJsonError,
    mapTransportError,
    onHttpError,
    afterSuccess,
    credentials = "include",
    defaultTimeoutMs,
    clearTokenOn401 = false,
    getRequestState
  } = config;

  function invalidateRejectedToken(rejectedAuthorization, path) {
    if (!clearTokenOn401 || !shouldInvalidateSessionForUnauthorized(path)) {
      return { invalidated: false, stale: false };
    }
    const currentAuthorization = tokenStore?.bearerHeaders?.().authorization || "";
    if (String(rejectedAuthorization || "") !== currentAuthorization) {
      return { invalidated: false, stale: true };
    }
    tokenStore?.clear?.("rejected");
    return { invalidated: true, stale: false };
  }

  function resolveHeaders(options = {}) {
    const extra = options.headers || {};
    if (typeof customGetHeaders === "function") {
      return { ...customGetHeaders({ options }), ...extra };
    }
    if (tokenStore) {
      return { ...buildBearerAuthHeaders(tokenStore, { demoUserId: getDemoUserId() }), ...extra };
    }
    return extra;
  }

  const client = createApiFetch({
    baseUrl,
    credentials,
    defaultTimeoutMs,
    getHeaders({ options }) {
      return resolveHeaders(options);
    },
    mapHttpError(response, payload, ctx) {
      const rejection = response.status === 401
        ? invalidateRejectedToken(ctx.headers?.authorization, ctx.path)
        : { stale: false };
      const error = mapHttpError(response, payload, ctx);
      if (rejection.stale && error) error.staleCredential = true;
      if (rejection.invalidated && error) error.sessionRejected = true;
      return error;
    },
    mapTransportError,
    getRequestState,
    onHttpError,
    afterSuccess(path, payload, response) {
      if (tokenStore) {
        const token = extractAuthToken(path, payload);
        if (token) {
          tokenStore.set(token);
        }
      }
      afterSuccess?.(path, payload, response);
    }
  });

  function mapStreamHttpError(response, payload, ctx = {}) {
    const rejection = response.status === 401
      ? invalidateRejectedToken(ctx.headers?.authorization, response.url)
      : { stale: false };
    const error = mapHttpError(response, payload, { path: response.url, options: { method: "GET" } });
    if (rejection.stale && error) error.staleCredential = true;
    if (rejection.invalidated && error) error.sessionRejected = true;
    return error;
  }

  return {
    request: client.request,
    streamRoomEvents({ roomId, onEvent, signal, cursorKey, connectedOnOpen = false, headers = {} }) {
      return openSseStream({
        url: `${baseUrl}/rooms/${roomId}/events/stream`,
        headers: { ...resolveHeaders({ headers: {} }), ...headers },
        signal,
        cursorKey,
        connectedOnOpen,
        onEvent,
        mapHttpError: mapStreamHttpError
      });
    },
    streamPlatformEvents({ onEvent, signal, cursorKey, headers = {} }) {
      return openSseStream({
        url: `${baseUrl}/platform/events/stream`,
        headers: { ...resolveHeaders({ headers: {} }), ...headers },
        signal,
        cursorKey,
        onEvent,
        eventTypeValidator: (type, payload) => validatePlatformEvent(type, payload).ok,
        mapHttpError: mapStreamHttpError
      });
    }
  };
}
