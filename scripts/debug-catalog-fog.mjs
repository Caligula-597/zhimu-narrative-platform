/**
 * Diagnose 雾港来信 catalog + studio for a fresh user.
 * Usage: STAGING_BASE_URL=http://localhost:8080 node scripts/debug-catalog-fog.mjs
 */
const base = (process.env.STAGING_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const FOG_ID = "08646748-e4ae-446a-a5e7-ce59ca23ffc3";

async function json(path, { method = "GET", token, body } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

const health = await json("/api/health");
console.log("health", health.status, health.data?.latestMigration, health.data?.features);

const email = `fog-debug-${Date.now()}@example.invalid`;
const reg = await json("/api/auth/register", {
  method: "POST",
  body: { displayName: "雾港诊断", email, password: "test-pass-123" }
});
console.log("register", reg.status);
if (reg.status !== 201) {
  console.error(reg.data);
  process.exit(1);
}
const token = reg.data.token;

const catalog = await json("/api/worlds/catalog", { token });
console.log("catalog", catalog.status, catalog.data?.length ?? catalog.data);
const fog = Array.isArray(catalog.data) ? catalog.data.find((w) => w.id === FOG_ID || w.name === "雾港来信") : null;
if (!fog) {
  console.error("雾港来信 not in catalog — run: npm run staging:catalog");
  process.exit(1);
}
console.log("fog catalog row", fog);

const join = await json(`/api/worlds/${fog.id}/catalog/join`, { method: "POST", token, body: {} });
console.log("join", join.status, join.data);

const studio = await json(`/api/worlds/${fog.id}/studio`, { token });
console.log("studio", studio.status, studio.data?.code || "");
if (studio.status === 200) {
  console.log({
    roles: studio.data.roles?.length,
    sections: studio.data.sections?.length,
    chapters: studio.data.chapters?.length,
    scenes: studio.data.scenes?.length
  });
  if (!studio.data.roles?.length) {
    console.error("FAIL: studio empty — run npm run staging:catalog");
    process.exit(1);
  }
  console.log("OK: 雾港 content visible to catalog host");
} else {
  console.error("FAIL studio", studio.data);
  process.exit(1);
}
