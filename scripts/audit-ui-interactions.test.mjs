import assert from "node:assert/strict";
import test from "node:test";
import { auditUiInteractions } from "./audit-ui-interactions.mjs";

test("every rendered action is reachable through a portal dispatcher", () => {
  const audit = auditUiInteractions();
  assert.deepEqual(audit.unhandledActions, []);
  assert.deepEqual(audit.missingViewMethods, []);
  assert.deepEqual(audit.unknownNavigationTargets, []);
  assert.deepEqual(audit.unresolvedViews, []);
  for (const api of audit.apiAudits) assert.deepEqual(api.unusedMethods, []);
});
