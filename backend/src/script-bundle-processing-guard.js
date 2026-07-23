import { createDocumentProcessingGuard } from "./document-processing-guard.js";

const guard = createDocumentProcessingGuard({
  maxConcurrent: process.env.SCRIPT_BUNDLE_PROCESSING_MAX_CONCURRENT ?? 1,
  maxQueued: process.env.SCRIPT_BUNDLE_PROCESSING_MAX_QUEUED ?? 2,
  queueTimeoutMs: process.env.SCRIPT_BUNDLE_PROCESSING_QUEUE_TIMEOUT_MS ?? 30_000,
  busyErrorCode: "SCRIPT_BUNDLE_PROCESSING_BUSY"
});

export function runScriptBundleProcessing(task) {
  return guard.run(task);
}

export function getScriptBundleProcessingStats() {
  return guard.stats();
}
