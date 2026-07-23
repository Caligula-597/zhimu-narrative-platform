import assert from "node:assert/strict";
import test from "node:test";
import { createDocumentProcessingGuard } from "../src/document-processing-guard.js";

test("document processing guard bounds active and queued work", async () => {
  const guard = createDocumentProcessingGuard({ maxConcurrent: 1, maxQueued: 1, queueTimeoutMs: 5_000 });
  let releaseFirst;
  const first = guard.run(() => new Promise((resolve) => { releaseFirst = resolve; }));
  const second = guard.run(() => "second");
  await assert.rejects(
    guard.run(() => "third"),
    (error) => error.code === "DOCUMENT_PROCESSING_BUSY" && error.statusCode === 503
  );
  assert.deepEqual(guard.stats(), { active: 1, queued: 1, maxConcurrent: 1, maxQueued: 1 });
  releaseFirst("first");
  assert.equal(await first, "first");
  assert.equal(await second, "second");
  assert.equal(guard.stats().active, 0);
});

test("processing guard can expose a domain-specific busy error", async () => {
  const guard = createDocumentProcessingGuard({
    maxConcurrent: 1,
    maxQueued: 1,
    queueTimeoutMs: 5_000,
    busyErrorCode: "SCRIPT_BUNDLE_PROCESSING_BUSY"
  });
  let releaseFirst;
  const first = guard.run(() => new Promise((resolve) => { releaseFirst = resolve; }));
  const second = guard.run(() => "second");
  await assert.rejects(
    guard.run(() => "third"),
    (error) => error.code === "SCRIPT_BUNDLE_PROCESSING_BUSY" && error.statusCode === 503
  );
  releaseFirst("first");
  await Promise.all([first, second]);
});
