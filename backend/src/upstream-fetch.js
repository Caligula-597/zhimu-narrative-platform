const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 15 * 60_000;

/** Keep third-party outages from holding an API request or worker forever. */
export function resolveUpstreamTimeoutMs(value, fallback = DEFAULT_TIMEOUT_MS) {
  const resolvedFallback = Number.isInteger(Number(fallback)) && Number(fallback) > 0
    ? Number(fallback)
    : DEFAULT_TIMEOUT_MS;
  const parsed = Number(value ?? resolvedFallback);
  if (!Number.isInteger(parsed) || parsed < 100 || parsed > MAX_TIMEOUT_MS) return resolvedFallback;
  return parsed;
}

export function createUpstreamSignal(timeoutMs, externalSignal) {
  const timeoutSignal = AbortSignal.timeout(resolveUpstreamTimeoutMs(timeoutMs));
  if (!externalSignal) return timeoutSignal;
  if (externalSignal.aborted) return externalSignal;
  return AbortSignal.any([externalSignal, timeoutSignal]);
}

export async function fetchUpstream(url, init = {}, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const externalSignal = init.signal;
  const signal = createUpstreamSignal(timeoutMs, externalSignal);
  try {
    return await fetch(url, { ...init, signal });
  } catch (error) {
    if (externalSignal?.aborted) throw error;
    if (signal.aborted || error?.name === "TimeoutError") {
      throw Object.assign(new Error(`Upstream request timed out after ${resolveUpstreamTimeoutMs(timeoutMs)}ms`, {
        cause: error
      }), {
        code: "GATEWAY_TIMEOUT",
        statusCode: 504
      });
    }
    throw error;
  }
}
