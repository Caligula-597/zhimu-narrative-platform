#!/usr/bin/env node
/**
 * L2-04 Clue audit acceptance — API detects missing text, unlinked clues, duplicates.
 *
 * Usage:
 *   node scripts/clue-audit-acceptance.mjs
 *   node scripts/clue-audit-acceptance.mjs --url http://localhost:8080
 */
const args = process.argv.slice(2);
const baseUrl = (
  args.includes("--url") ? args[args.indexOf("--url") + 1] : process.env.STAGING_BASE_URL || "http://localhost:8080"
).replace(/\/$/, "");
const api = `${baseUrl}/api`;

const steps = [];

function pass(label, detail = "") {
  steps.push({ ok: true, label, detail });
  console.log(`✔ ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail = "") {
  steps.push({ ok: false, label, detail });
  console.error(`✘ ${label}${detail ? ` — ${detail}` : ""}`);
  process.exitCode = 1;
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not json */
  }
  return { res, text, json };
}

console.log(`织幕 L2-04 线索审稿验收 → ${baseUrl}\n`);

const loginEmail = process.env.CLUE_AUDIT_EMAIL || (args.includes("--login-email") ? args[args.indexOf("--login-email") + 1] : "");
const loginPassword = process.env.CLUE_AUDIT_PASSWORD || (args.includes("--login-password") ? args[args.indexOf("--login-password") + 1] : "");

try {
  let token;
  if (loginEmail && loginPassword) {
    const login = await fetchJson(`${api}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword })
    });
    if (!login.res.ok || !login.json?.token) {
      fail("login", `${login.res.status} ${login.text.slice(0, 120)}`);
      process.exit(1);
    }
    token = login.json.token;
    pass("login", loginEmail);
  } else {
  const email = `clue-audit-${Date.now()}@example.test`;
  const password = "clue-audit-pass-8";
  const register = await fetchJson(`${api}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "Clue Audit QA" })
  });
  if (register.res.status === 429 && register.json?.code === "REGISTER_IP_RATE_LIMITED") {
    fail("register", "REGISTER_IP_RATE_LIMITED — 使用 --login-email/--login-password 或次日再跑");
    process.exit(1);
  }
  if (register.res.status !== 201 || !register.json?.token) {
    fail("register", `${register.res.status} ${register.text.slice(0, 120)}`);
    process.exit(1);
  }
  token = register.json.token;
  pass("register + token", email);
  }

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const world = await fetchJson(`${api}/worlds`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: `线索审稿验收 ${Date.now()}`, summary: "L2-04" })
  });
  if (world.res.status !== 201 || !world.json?.id) {
    fail("create world", `${world.res.status} ${world.text.slice(0, 120)}`);
    process.exit(1);
  }
  const worldId = world.json.id;
  pass("create world", worldId.slice(0, 8) + "…");

  await fetchJson(`${api}/worlds/${worldId}/clues`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "完整线索", publicText: "玩家可见正文", metadata: { importance: "key" } })
  });
  await fetchJson(`${api}/worlds/${worldId}/clues`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "缺正文线索" })
  });
  await fetchJson(`${api}/worlds/${worldId}/clues`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "重复名", publicText: "A" })
  });
  await fetchJson(`${api}/worlds/${worldId}/clues`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "重复名", publicText: "B" })
  });
  pass("seed clues", "4 clues (missing text + duplicate names)");

  const audit = await fetchJson(`${api}/worlds/${worldId}/clue-audit`, { headers: { Authorization: `Bearer ${token}` } });
  if (audit.res.status !== 200) {
    fail("GET clue-audit", `${audit.res.status} ${audit.text.slice(0, 160)}`);
    process.exit(1);
  }

  const body = audit.json;
  if (body.worldId !== worldId) fail("audit worldId", "mismatch");
  else pass("GET clue-audit", `score=${body.score}% issues=${body.issues?.length ?? 0}`);

  const issueIds = new Set((body.issues || []).map((item) => item.id));
  for (const expected of ["clues.missing_public_text", "clues.unlinked_investigation", "clues.duplicate_names"]) {
    if (issueIds.has(expected)) pass(`detect ${expected}`, "present");
    else fail(`detect ${expected}`, "missing from issues");
  }

  if (Array.isArray(body.cards) && body.cards.length >= 4) {
    pass("audit cards", `${body.cards.length} cards`);
  } else {
    fail("audit cards", `expected >=4, got ${body.cards?.length ?? 0}`);
  }

  if (body.ok === false && body.score < 100) {
    pass("audit not ok for flawed library", `score=${body.score}`);
  } else {
    fail("audit not ok for flawed library", `ok=${body.ok} score=${body.score}`);
  }

  const forbidden = await fetchJson(`${api}/worlds/${worldId}/clue-audit`);
  if (forbidden.res.status === 401) {
    pass("clue-audit requires auth", "401 without token");
  } else {
    fail("clue-audit requires auth", `expected 401, got ${forbidden.res.status}`);
  }

  console.log(
    "\n" +
      JSON.stringify(
        {
          passed: steps.every((s) => s.ok),
          baseUrl,
          worldId,
          score: body.score,
          issueIds: [...issueIds],
          steps
        },
        null,
        2
      )
  );
} catch (error) {
  fail("acceptance aborted", error.message);
  process.exit(1);
}
