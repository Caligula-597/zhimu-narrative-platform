/** Run an async maintenance task on an interval without overlapping slow ticks. */
export function startNonOverlappingInterval(task, intervalMs, { immediate = false, onError } = {}) {
  let running = false;
  let stopped = false;

  const runNow = async () => {
    if (stopped || running) return false;
    running = true;
    try {
      await task();
      return true;
    } catch (error) {
      onError?.(error);
      return false;
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => { void runNow(); }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  if (immediate) void runNow();

  return {
    runNow,
    stop() {
      stopped = true;
      clearInterval(timer);
    }
  };
}
