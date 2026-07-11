const TRACE_STORAGE_KEY = "zhimuTraceId";

/** @returns {string} */
export function getOrCreateTraceId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `trace-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Persist correlation id for the browser session so API + SSE share one Trace-Id.
 * @returns {string}
 */
export function currentTraceId() {
  if (typeof sessionStorage === "undefined") return getOrCreateTraceId();
  let traceId = sessionStorage.getItem(TRACE_STORAGE_KEY);
  if (!traceId) {
    traceId = getOrCreateTraceId();
    sessionStorage.setItem(TRACE_STORAGE_KEY, traceId);
  }
  return traceId;
}

/**
 * Headers for outbound API/SSE calls.
 * - X-Trace-Id: stable session correlation id (maps to request.traceId)
 * - X-Request-Id: unique per request (maps to Fastify request.id)
 * @returns {Record<string, string>}
 */
export function traceRequestHeaders() {
  return {
    "X-Trace-Id": currentTraceId(),
    "X-Request-Id": getOrCreateTraceId()
  };
}
