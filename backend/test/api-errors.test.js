import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { formatErrorBody, httpError, throwErr } from "../src/api-errors.js";

test("formatErrorBody includes code and validation details", () => {
  const validationError = Object.assign(new Error("body/title must be string"), {
    validation: [{ instancePath: "/title", message: "must be string" }]
  });
  const body = formatErrorBody(validationError, 400);
  assert.equal(body.code, "VALIDATION_ERROR");
  assert.ok(body.details?.validation);
});

test("httpError carries custom code", () => {
  const err = httpError(409, "Conflict", "ROLE_TAKEN", { roleSlotId: "x" });
  assert.equal(err.code, "ROLE_TAKEN");
  assert.equal(err.details.roleSlotId, "x");
});

test("throwErr uses registered code and status", () => {
  const err = (() => {
    try {
      throwErr("ROOM_NOT_FOUND");
    } catch (e) {
      return e;
    }
  })();
  assert.equal(err.code, "ROOM_NOT_FOUND");
  assert.equal(err.statusCode, 404);
});

test("API returns unified error shape for unauthenticated requests", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/api/worlds" });
  assert.equal(response.statusCode, 401);
  const body = response.json();
  assert.equal(body.error, "Authentication required");
  assert.equal(body.code, "AUTH_REQUIRED");
});

test("join unknown invite returns ROOM_NOT_FOUND", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/api/rooms/join",
    headers: { "x-user-id": "154aa8a9-9cd2-4098-90f4-c75e56c0cc53" },
    payload: {
      inviteCode: "NO-SUCH-INVITE-CODE",
      roleSlotId: "00000000-0000-4000-8000-000000000001"
    }
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, "ROOM_NOT_FOUND");
});

test("unknown route returns NOT_FOUND code", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/api/no-such-route" });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, "NOT_FOUND");
});
