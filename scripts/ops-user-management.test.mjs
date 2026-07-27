import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const opsView = fs.readFileSync(new URL("../src/views/ops.js", import.meta.url), "utf8");
const opsActions = fs.readFileSync(new URL("../src/runtime/actions-ops.js", import.meta.url), "utf8");
const opsApi = fs.readFileSync(new URL("../src/api/ops.js", import.meta.url), "utf8");
const opsRoutes = fs.readFileSync(
  new URL("../backend/src/routes/ops-user-routes.js", import.meta.url),
  "utf8"
);
const migration = fs.readFileSync(
  new URL("../backend/migrations/103_ops_user_management.sql", import.meta.url),
  "utf8"
);

test("OPS user management exposes search, resend and destructive confirmation controls", () => {
  assert.match(opsView, /用户管理/);
  assert.match(opsView, /data-action="ops-user-search"/);
  assert.match(opsView, /data-action="ops-user-resend"/);
  assert.match(opsView, /data-action="ops-user-delete"/);
  assert.match(opsActions, /confirmationEmail/);
  assert.match(opsActions, /我已确认目标账号/);
  assert.match(opsActions, /pending_reset/);
});

test("frontend API and backend routes cover the complete user-management flow", () => {
  assert.match(opsApi, /export function getOpsUsers/);
  assert.match(opsApi, /export function previewOpsUserDelete/);
  assert.match(opsApi, /export function resendOpsUserVerification/);
  assert.match(opsApi, /export function deleteOpsUserAccount/);
  assert.match(opsRoutes, /\/api\/ops\/users/);
  assert.match(opsRoutes, /delete-preview/);
  assert.match(opsRoutes, /resend-verification/);
  assert.match(opsRoutes, /confirmationEmail/);
});

test("OPS user actions have a dedicated RLS-protected audit trail", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ops_user_audit_log/i);
  assert.match(migration, /ALTER TABLE ops_user_audit_log ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /target_email/i);
});
