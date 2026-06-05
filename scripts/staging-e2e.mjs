/**
 * Staging end-to-end API flow: register → join 雾港 catalog → create parallel room.
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
const fog = (catalog.json || []).find((w) => /雾港/.test(w.name || ""));
assertOk("雾港 in catalog", Boolean(fog), JSON.stringify(catalog.json?.map((w) => w.name)));

const join = await fetchJson(`${API}/worlds/${fog.id}/catalog/join`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: "{}"
});
assertOk("catalog join", join.response.ok, join.text);
const worldId = join.json?.worldId;
const roomId = join.json?.room?.id;
assertOk("join payload", Boolean(worldId && roomId), join.text);

const studio = await fetchJson(`${API}/worlds/${worldId}/studio`, {
  headers: { Authorization: `Bearer ${token}` }
});
assertOk("studio load", studio.response.ok);
const roles = studio.json?.roles?.length ?? 0;
const sections = studio.json?.sections?.length ?? 0;
assertOk("雾港正文", roles > 0 && sections > 0, `roles=${roles} sections=${sections}`);

const room = await fetchJson(`${API}/worlds/${worldId}/rooms`, {
  headers: { Authorization: `Bearer ${token}` }
});
assertOk("world rooms", room.response.ok);
assertOk("personal room listed", (room.json || []).some((r) => r.id === roomId));

const resetReq = await fetchJson(`${API}/auth/forgot-password`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email })
});
assertOk("forgot-password", resetReq.response.status === 200 && resetReq.json?.ok === true, resetReq.text);

const shell = await fetch(`${BASE}/`);
assertOk("frontend shell", shell.ok);
const html = await shell.text();
assertOk("requireAuth build", /VITE_REQUIRE_AUTH.*true|requireAuth:\s*true/i.test(html) || html.includes("auth-banner"), "staging dist");

console.log("\nStaging E2E: all steps passed");
console.log(`  user: ${email}`);
console.log(`  world: ${fog.name} (${worldId})`);
console.log(`  room: ${join.json?.room?.invite_code || roomId}`);
console.log(`  content: ${roles} roles, ${sections} sections`);
console.log(`  open: ${BASE}`);
