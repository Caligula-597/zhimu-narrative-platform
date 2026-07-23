/**
 * Network trust policy shared by Fastify and the production-readiness endpoint.
 *
 * API throttles are currently process-local. They are reliable only when the
 * application sees the real client IP and either runs a single replica or has
 * an independently verified edge limiter in front of every replica.
 */
export function resolveTrustProxy(value) {
  if (value === false || value == null || value === "") return false;
  if (value === true) return true;
  const hops = Number(value);
  return Number.isInteger(hops) && hops >= 1 && hops <= 5 ? hops : false;
}

function resolveInstanceCount(value) {
  if (value == null || String(value).trim() === "") return null;
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 && count <= 1_000 ? count : null;
}

export function resolveRateLimitTopology(env = process.env) {
  const trustProxy = resolveTrustProxy(env.TRUST_PROXY_HOPS);
  const instanceCount = resolveInstanceCount(env.APP_INSTANCE_COUNT);
  const edgeVerified = env.EDGE_RATE_LIMIT_VERIFIED === "true";
  const proxyTrusted = trustProxy !== false;
  const multiInstanceSafe = edgeVerified || instanceCount === 1;

  return {
    backend: "in-process",
    trustProxyHops: trustProxy === true ? "all" : (trustProxy || null),
    proxyTrusted,
    edgeVerified,
    instanceCount,
    multiInstanceSafe,
    trusted: proxyTrusted && multiInstanceSafe
  };
}

export function explainRateLimitTopology(topology) {
  const problems = [];
  if (!topology?.proxyTrusted) problems.push("TRUST_PROXY_HOPS missing or invalid");
  if (!topology?.multiInstanceSafe) {
    problems.push("set APP_INSTANCE_COUNT=1 or verify the edge limiter with EDGE_RATE_LIMIT_VERIFIED=true");
  }
  return problems.length ? problems.join("; ") : "real client IP and deployment topology verified";
}
