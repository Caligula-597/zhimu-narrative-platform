import { throwErr } from "./api-errors.js";

function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function createDocumentProcessingGuard({
  maxConcurrent = 2,
  maxQueued = 4,
  queueTimeoutMs = 30_000
} = {}) {
  const concurrency = positiveInteger(maxConcurrent, 2, 16);
  const queueLimit = positiveInteger(maxQueued, 4, 100);
  const timeoutMs = positiveInteger(queueTimeoutMs, 30_000, 120_000);
  const queue = [];
  let active = 0;

  function rejectBusy(reject) {
    try {
      throwErr("DOCUMENT_PROCESSING_BUSY");
    } catch (error) {
      reject(error);
    }
  }

  function start(job) {
    if (job.timer) clearTimeout(job.timer);
    active += 1;
    const finish = (settle, value) => {
      active -= 1;
      while (active < concurrency && queue.length) start(queue.shift());
      settle(value);
    };
    Promise.resolve()
      .then(job.task)
      .then(
        (value) => finish(job.resolve, value),
        (error) => finish(job.reject, error)
      );
  }

  function run(task) {
    if (typeof task !== "function") throw new TypeError("document processing task must be a function");
    return new Promise((resolve, reject) => {
      const job = { task, resolve, reject, timer: null };
      if (active < concurrency) {
        start(job);
        return;
      }
      if (queue.length >= queueLimit) {
        rejectBusy(reject);
        return;
      }
      job.timer = setTimeout(() => {
        const index = queue.indexOf(job);
        if (index < 0) return;
        queue.splice(index, 1);
        rejectBusy(reject);
      }, timeoutMs);
      job.timer.unref?.();
      queue.push(job);
    });
  }

  return {
    run,
    stats: () => ({ active, queued: queue.length, maxConcurrent: concurrency, maxQueued: queueLimit })
  };
}

const defaultGuard = createDocumentProcessingGuard({
  maxConcurrent: process.env.DOCUMENT_PROCESSING_MAX_CONCURRENT ?? 2,
  maxQueued: process.env.DOCUMENT_PROCESSING_MAX_QUEUED ?? 4,
  queueTimeoutMs: process.env.DOCUMENT_PROCESSING_QUEUE_TIMEOUT_MS ?? 30_000
});

export function runDocumentProcessing(task) {
  return defaultGuard.run(task);
}

export function getDocumentProcessingStats() {
  return defaultGuard.stats();
}
