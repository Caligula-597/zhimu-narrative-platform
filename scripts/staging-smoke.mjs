/**
 * Staging smoke — hit nginx + API after `npm run staging:up`.
 * Env: STAGING_BASE_URL (default http://localhost:8080)
 */
const BASE = (process.env.STAGING_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const API = `${BASE}/api`;

const checks = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    checks.push({ name, ok: true, detail });
    console.log(`PASS  ${name}: ${detail}`);
  } catch (error) {
    checks.push({ name, ok: false, detail: error.message });
    console.error(`FAIL  ${name}: ${error.message}`);
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { response, json, text };
}

await check("js bootstrap", async () => {
  const { response, text } = await fetchJson(`${BASE}/`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  // Single-bundle build must not preload split chunks before dom.js (regression guard).
  if (/modulepreload.*\/assets\/views-/i.test(text)) {
    throw new Error("index.html preloads views chunk — init order bug");
  }
  return "shell ok";
});

await check("health live", async () => {
  const { response, json } = await fetchJson(`${API}/health/live`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (json?.ok !== true) throw new Error(JSON.stringify(json));
  return "ok";
});

await check("health ready", async () => {
  const { response, json } = await fetchJson(`${API}/health/ready`);
  if (!response.ok) throw new Error(`HTTP ${response.status} — DB not ready?`);
  if (json?.ok !== true || json?.ready !== true) throw new Error(JSON.stringify(json));
  return `migrations=${json?.database?.migrationsApplied ?? "?"}`;
});

await check("auth register+login", async () => {
  const email = `staging-smoke-${Date.now()}@example.test`;
  const password = "staging-smoke-pass-8";
  const register = await fetchJson(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "Staging Smoke" })
  });
  if (register.response.status !== 201) {
    throw new Error(`register ${register.response.status}: ${register.text}`);
  }
  const token = register.json?.token;
  if (!token) throw new Error("no token from register");
  const me = await fetchJson(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!me.response.ok) throw new Error(`me ${me.response.status}`);
  return me.json?.email || "session ok";
});

await check("demo header rejected", async () => {
  const { response } = await fetchJson(`${API}/worlds`, {
    headers: { "x-user-id": "154aa8a9-9cd2-4098-90f4-c75e56c0cc53" }
  });
  if (response.status !== 401) {
    throw new Error(`expected 401 without Bearer, got ${response.status}`);
  }
  return "demo x-user-id blocked";
});

await check("world catalog (雾港)", async () => {
  const email = `staging-catalog-${Date.now()}@example.test`;
  const password = "staging-catalog-pass-8";
  const register = await fetchJson(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "Catalog Probe" })
  });
  if (register.response.status !== 201) {
    throw new Error(`register ${register.response.status}: ${register.text}`);
  }
  const token = register.json?.token;
  const catalog = await fetchJson(`${API}/worlds/catalog`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!catalog.response.ok) throw new Error(`catalog ${catalog.response.status}`);
  const fog = (catalog.json || []).find((w) => /雾港|fog/i.test(w.name || ""));
  if (!fog) throw new Error(`catalog empty or missing 雾港: ${JSON.stringify(catalog.json?.slice?.(0, 2))}`);
  return fog.name;
});

await check("forgot-password ack", async () => {
  const forgot = await fetchJson(`${API}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `nobody-${Date.now()}@example.test` })
  });
  if (forgot.response.status === 503) {
    throw new Error("EMAIL_NOT_CONFIGURED — set RESEND_* in .env.staging");
  }
  if (forgot.response.status !== 200 || forgot.json?.ok !== true) {
    throw new Error(`forgot ${forgot.response.status}: ${forgot.text}`);
  }
  return "ok (no email enumeration)";
});

await check("create world + list", async () => {
  const email = `staging-world-${Date.now()}@example.test`;
  const password = "staging-world-pass-8";
  const register = await fetchJson(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "World Probe" })
  });
  const token = register.json?.token;
  const created = await fetchJson(`${API}/worlds`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: `预发验收 ${Date.now()}`, summary: "staging e2e" })
  });
  if (created.response.status !== 201) {
    throw new Error(`create world ${created.response.status}: ${created.text}`);
  }
  const list = await fetchJson(`${API}/worlds`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!list.response.ok) throw new Error(`list ${list.response.status}`);
  const found = (list.json || []).some((w) => w.id === created.json?.id);
  if (!found) throw new Error("created world missing from list");
  return created.json?.name || "world ok";
});

const failed = checks.filter((c) => !c.ok);
console.log(`\nStaging smoke: ${checks.length - failed.length}/${checks.length} passed`);
process.exit(failed.length ? 1 : 0);
