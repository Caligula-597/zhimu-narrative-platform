import assert from "node:assert/strict";
import test from "node:test";
import { buildIdentityFoundationStatus } from "../src/identity-foundation-status.js";

test("identity foundation is ready only when plans, quotas, and approved beta access agree", () => {
  assert.deepEqual(buildIdentityFoundationStatus({
    users_missing_plan: 0,
    users_missing_quota: 0,
    approved_registered_users_without_beta: 0,
    approved_applications_awaiting_registration: 2
  }), {
    ready: true,
    usersMissingPlan: 0,
    usersMissingQuota: 0,
    approvedRegisteredUsersWithoutBeta: 0,
    approvedApplicationsAwaitingRegistration: 2
  });

  assert.equal(buildIdentityFoundationStatus({
    users_missing_plan: 1,
    users_missing_quota: 0,
    approved_registered_users_without_beta: 0
  }).ready, false);
  assert.equal(buildIdentityFoundationStatus({
    users_missing_plan: 0,
    users_missing_quota: 1,
    approved_registered_users_without_beta: 0
  }).ready, false);
  assert.equal(buildIdentityFoundationStatus({
    users_missing_plan: 0,
    users_missing_quota: 0,
    approved_registered_users_without_beta: 1
  }).ready, false);
});
