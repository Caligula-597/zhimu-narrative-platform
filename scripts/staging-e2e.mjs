/**
 * Staging end-to-end API flow: register → create world → load studio → list rooms.
 * Requires `npm run staging:up` healthy at STAGING_BASE_URL.
 */
const BASE = (process.env.STAGING_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const API = `${BASE}/api`;

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }
  return { response, json, text };
}

function assertOk(label, condition, detail = "") {
  if (!condition) throw new Error(`${label}${detail ? `: ${detail}` : ""}`);
  console.log(`PASS  ${label}`);
}

const email = `staging-e2e-${Date.now()}@example.test`;
const password = "staging-e2e-pass-8";

const register = await fetchJson(`${API}/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, displayName: "预发 E2E" })
});
assertOk("register", register.response.status === 201, register.text);
const token = register.json.token;

const catalog = await fetchJson(`${API}/worlds/catalog`, {
  headers: { Authorization: `Bearer ${token}` }
});
assertOk("catalog list", catalog.response.ok);
assertOk("catalog array", Array.isArray(catalog.json));

const created = await fetchJson(`${API}/worlds`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ name: `预发验收 ${Date.now()}`, summary: "staging e2e world" })
});
assertOk("create world", created.response.status === 201, created.text);
const worldId = created.json?.id;
assertOk("world id", Boolean(worldId));

const studio = await fetchJson(`${API}/worlds/${worldId}/studio`, {
  headers: { Authorization: `Bearer ${token}` }
});
assertOk("studio load", studio.response.ok);
assertOk("studio world name", studio.json?.world?.name === created.json?.name);

const room = await fetchJson(`${API}/worlds/${worldId}/rooms`, {
  headers: { Authorization: `Bearer ${token}` }
});
assertOk("world rooms", room.response.ok);
assertOk("rooms array", Array.isArray(room.json));

const resetReq = await fetchJson(`${API}/auth/forgot-password`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email })
});
assertOk("forgot-password", resetReq.response.status === 200 && resetReq.json?.ok === true, resetReq.text);

console.log("\nStaging E2E: all checks passed");
