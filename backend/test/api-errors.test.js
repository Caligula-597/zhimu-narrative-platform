import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { formatErrorBody, httpError, sendErr, throwErr } from "../src/api-errors.js";

function captureReply() {
  const response = { statusCode: null, body: null };
  return {
    response,
    reply: {
      code(statusCode) {
        response.statusCode = statusCode;
        return this;
      },
      send(body) {
        response.body = body;
        return body;
      }
    }
  };
}

test("formatErrorBody includes code and validation details", () => {
  const validationError = Object.assign(new Error("body/title must be string"), {
    validation: [{ instancePath: "/title", message: "must be string" }]
  });
  const body = formatErrorBody(validationError, 400);
  assert.equal(body.code, "VALIDATION_ERROR");
  assert.ok(body.details?.validation);
});

test("formatErrorBody does not expose unexpected 5xx messages or details", () => {
  const internal = Object.assign(new Error('relation "private_table" does not exist'), {
    code: "42P01",
    details: { sql: "SELECT secret FROM private_table" }
  });
  assert.deepEqual(formatErrorBody(internal, 500), {
    error: "Internal error",
    code: "INTERNAL_ERROR"
  });
});

test("formatErrorBody uses registered safe messages for known 5xx codes", () => {
  const upstream = Object.assign(new Error("provider leaked diagnostics"), {
    code: "UPSTREAM_ERROR",
    details: { providerResponse: "secret" }
  });
  assert.deepEqual(formatErrorBody(upstream, 502), {
    error: "Upstream service error",
    code: "UPSTREAM_ERROR"
  });
});

test("formatErrorBody preserves registered idempotency conflict codes", () => {
  const conflict = Object.assign(new Error("Idempotency-Key was already used with a different request body"), {
    code: "IDEMPOTENCY_PAYLOAD_MISMATCH",
    statusCode: 409
  });
  assert.deepEqual(formatErrorBody(conflict, 409), {
    error: "Idempotency-Key was already used with a different request body",
    code: "IDEMPOTENCY_PAYLOAD_MISMATCH"
  });
});

test("sendErr redacts unknown server errors and their details", () => {
  const { reply, response } = captureReply();
  sendErr(
    reply,
    "23505",
    "duplicate key value violates unique constraint users_email_key",
    { sql: "INSERT INTO users" }
  );
  assert.deepEqual(response, {
    statusCode: 500,
    body: { error: "Internal error", code: "INTERNAL_ERROR" }
  });
});

test("sendErr uses registered safe text for known 5xx errors", () => {
  const { reply, response } = captureReply();
  sendErr(reply, "UPSTREAM_ERROR", "provider leaked diagnostics", { secret: true });
  assert.deepEqual(response, {
    statusCode: 502,
    body: { error: "Upstream service error", code: "UPSTREAM_ERROR" }
  });
});

test("sendErr preserves useful client error messages and details", () => {
  const { reply, response } = captureReply();
  sendErr(reply, "BAD_REQUEST", "Archive manifest is malformed", { field: "manifest" });
  assert.deepEqual(response, {
    statusCode: 400,
    body: {
      error: "Archive manifest is malformed",
      code: "BAD_REQUEST",
      details: { field: "manifest" }
    }
  });
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
  if (!process.env.DATABASE_URL) {
    context.skip("DATABASE_URL is required for the integration assertion");
    return;
  }
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
