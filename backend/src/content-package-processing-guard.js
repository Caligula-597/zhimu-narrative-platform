import { createDocumentProcessingGuard } from "./document-processing-guard.js";

const guard = createDocumentProcessingGuard({
  maxConcurrent: process.env.CONTENT_PACKAGE_PROCESSING_MAX_CONCURRENT ?? 1,
  maxQueued: process.env.CONTENT_PACKAGE_PROCESSING_MAX_QUEUED ?? 2,
  queueTimeoutMs: process.env.CONTENT_PACKAGE_PROCESSING_QUEUE_TIMEOUT_MS ?? 30_000,
  busyErrorCode: "CONTENT_PACKAGE_PROCESSING_BUSY"
});

export function runContentPackageProcessing(task) {
  return guard.run(task);
}

export function getContentPackageProcessingStats() {
  return guard.stats();
}
