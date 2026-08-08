import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { sendAuthSession } from "../src/routes/auth-route-shared.js";

async function authResponse(nodeEnv) {
  const app = Fastify({ logger: false });
  app.decorate("zhimuNodeEnv", nodeEnv);
  app.post("/login", async (_request, reply) => sendAuthSession(reply, {
    token: "session-token-1234567890",
    sessionId: "session-id",
    expiresAt: "2026-08-08T00:00:00.000Z"
  }, {
    user: { id: "user-id" }
  }, 201));
  const response = await app.inject({ method: "POST", url: "/login" });
  await app.close();
  return response;
}

test("production auth response keeps the token in HttpOnly cookie only", async () => {
  const response = await authResponse("production");
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().token, undefined);
  assert.equal(response.json().sessionId, "session-id");
  assert.match(String(response.headers["set-cookie"]), /HttpOnly/u);
  assert.match(String(response.headers["set-cookie"]), /Secure/u);
});

test("development auth response retains the temporary bearer compatibility payload", async () => {
  const response = await authResponse("development");
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().token, "session-token-1234567890");
  assert.doesNotMatch(String(response.headers["set-cookie"]), /; Secure/u);
});
