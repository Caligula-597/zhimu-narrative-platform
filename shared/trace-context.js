const TRACE_STORAGE_KEY = "zhimuTraceId";

/** @returns {string} */
export function getOrCreateTraceId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `trace-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Persist trace id for the browser session so API + SSE share one correlation id.
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

/** @returns {Record<string, string>} */
export function traceRequestHeaders() {
  const traceId = currentTraceId();
  return {
    "X-Trace-Id": traceId,
    "X-Request-Id": traceId
  };
}
