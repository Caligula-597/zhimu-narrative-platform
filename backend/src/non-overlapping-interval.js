/** Run an async maintenance task on an interval without overlapping slow ticks. */
export function startNonOverlappingInterval(task, intervalMs, { immediate = false, onError } = {}) {
  const resolvedIntervalMs = Number(intervalMs);
  if (!Number.isInteger(resolvedIntervalMs) || resolvedIntervalMs < 100) {
    throw new RangeError(`intervalMs must be an integer >= 100; received ${intervalMs}`);
  }
  let running = false;
  let stopped = false;
  let runningPromise = null;

  const runNow = () => {
    if (stopped || running) return Promise.resolve(false);
    running = true;
    runningPromise = (async () => {
      try {
        await task();
        return true;
      } catch (error) {
        onError?.(error);
        return false;
      } finally {
        running = false;
        runningPromise = null;
      }
    })();
    return runningPromise;
  };

  const timer = setInterval(() => { void runNow(); }, resolvedIntervalMs);
  if (typeof timer.unref === "function") timer.unref();
  if (immediate) void runNow();

  return {
    runNow,
    async stop() {
      stopped = true;
      clearInterval(timer);
      await runningPromise;
    }
  };
}
