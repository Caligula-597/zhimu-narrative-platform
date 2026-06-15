import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAlertPayload,
  getAlertWebhookConfig,
  resetAlertMonitorForTests
} from "../src/ops-alert-bridge.js";

test("getAlertWebhookConfig reflects env", () => {
  resetAlertMonitorForTests();
  const previous = process.env.ALERT_WEBHOOK_URL;
  delete process.env.ALERT_WEBHOOK_URL;
  assert.equal(getAlertWebhookConfig().configured, false);
  process.env.ALERT_WEBHOOK_URL = "https://hooks.example/alerts";
  assert.equal(getAlertWebhookConfig().configured, true);
  if (previous === undefined) delete process.env.ALERT_WEBHOOK_URL;
  else process.env.ALERT_WEBHOOK_URL = previous;
  resetAlertMonitorForTests();
});

test("buildAlertPayload includes readiness context", async () => {
  const payload = await buildAlertPayload({
    severity: "info",
    title: "test",
    body: "body",
    labels: { kind: "unit" }
  });
  assert.equal(payload.severity, "info");
  assert.ok(payload.context?.database);
  assert.ok(payload.labels?.ready);
});
