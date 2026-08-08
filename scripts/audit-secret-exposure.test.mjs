import assert from "node:assert/strict";
import test from "node:test";
import { scanTextForSecrets } from "./audit-secret-exposure.mjs";

test("detects common provider keys, private keys and credentialed database URLs", () => {
  const providerKey = ["sk", "proj", "A".repeat(36)].join("-");
  const privateKey = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
  const text = [
    `const provider = "${providerKey}";`,
    privateKey,
    "postgres://admin:real-password@db.prod.example.com:5432/app"
  ].join("\n");
  const detectors = scanTextForSecrets(text).map((item) => item.detector);
  assert.ok(detectors.includes("openai-compatible-key"));
  assert.ok(detectors.includes("private-key"));
  assert.ok(detectors.includes("database-url-with-password"));
});

test("detects literal production secrets but allows documented placeholders", () => {
  const exposed = scanTextForSecrets('const OPS_API_TOKEN = "a-real-looking-secret-value-123";');
  assert.equal(exposed.length, 1);
  assert.equal(exposed[0].detector, "literal-ops_api_token");
  assert.deepEqual(scanTextForSecrets('const OPS_API_TOKEN = "replace-me-in-production";'), []);
  assert.deepEqual(scanTextForSecrets('const API_KEY = "${PROVIDER_API_KEY}";'), []);
});

test("generic literal checks can be disabled for fixtures while provider fingerprints remain active", () => {
  const providerKey = ["sk", "B".repeat(40)].join("-");
  const text = `const TEST_SECRET = "fixture-secret-value";\nconst leaked = "${providerKey}";`;
  const detectors = scanTextForSecrets(text, { includeGeneric: false }).map((item) => item.detector);
  assert.deepEqual(detectors, ["openai-compatible-key"]);
});
