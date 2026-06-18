import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { assertRegistrationAllowed } from "../src/play-social-guard.js";

test("assertRegistrationAllowed is no-op when REGISTER_IP_DAY_MAX is 0", async () => {
  const prev = process.env.REGISTER_IP_DAY_MAX;
  process.env.REGISTER_IP_DAY_MAX = "0";
  try {
    await assertRegistrationAllowed({ ip: "127.0.0.1" });
  } finally {
    if (prev === undefined) delete process.env.REGISTER_IP_DAY_MAX;
    else process.env.REGISTER_IP_DAY_MAX = prev;
  }
});

test("register respects REGISTER_IP_DAY_MAX when enabled", async (context) => {
  const prev = process.env.REGISTER_IP_DAY_MAX;
  process.env.REGISTER_IP_DAY_MAX = "1";
  const isolatedIp = `10.88.${Date.now() % 250}.${(Date.now() >> 8) % 250}`;
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(async () => {
    await app.close();
    if (prev === undefined) delete process.env.REGISTER_IP_DAY_MAX;
    else process.env.REGISTER_IP_DAY_MAX = prev;
  });

  const first = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    remoteAddress: isolatedIp,
    payload: {
      email: `ip-cap-a-${Date.now()}@example.invalid`,
      displayName: "Cap A",
      password: "pass-word-12345"
    }
  });
  assert.equal(first.statusCode, 201);

  const second = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    remoteAddress: isolatedIp,
    payload: {
      email: `ip-cap-b-${Date.now()}@example.invalid`,
      displayName: "Cap B",
      password: "pass-word-12345"
    }
  });
  assert.equal(second.statusCode, 429);
  assert.equal(second.json().code, "REGISTER_IP_RATE_LIMITED");
});
