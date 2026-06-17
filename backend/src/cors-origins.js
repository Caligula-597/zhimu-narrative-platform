/**
 * Allowed browser origins for @fastify/cors (app + marketing site).
 */

function parseOriginList(raw) {
  if (!raw) return [];
  if (raw === "*") return ["*"];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function resolveAllowedCorsOrigins(options, nodeEnv) {
  if (options.corsOrigin !== undefined) return options.corsOrigin;

  const collected = [];
  for (const envKey of ["CORS_ORIGIN", "MARKETING_SITE_ORIGIN", "PLAY_SITE_ORIGIN"]) {
    collected.push(...parseOriginList(process.env[envKey]?.trim()));
  }

  if (collected.includes("*")) return true;

  const unique = [...new Set(collected)];
  if (!unique.length) return nodeEnv === "production" ? false : true;
  if (unique.length === 1) return unique[0];
  return unique;
}
