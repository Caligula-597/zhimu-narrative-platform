/**
 * Visibility-aware, non-overlapping scheduler for frontend status refreshes.
 *
 * The scheduled task is never run concurrently. Failed runs back off, while
 * returning to the foreground or regaining network connectivity triggers one
 * immediate recovery run. In-flight work is allowed to finish after stop(),
 * but stale completions can no longer schedule more work.
 */
export function createAdaptivePoller({
  run,
  intervalMs = 15000,
  maxIntervalMs = Math.max(intervalMs, intervalMs * 8),
  backoffFactor = 2,
  jitterRatio = 0.15,
  eventTarget = globalThis,
  random = Math.random,
  onError = () => {},
  onStatus = () => {}
}) {
  if (typeof run !== "function") throw new TypeError("adaptive poller requires a run function");

  const baseDelay = normalizeDelay(intervalMs, 15000);
  const maximumDelay = Math.max(baseDelay, normalizeDelay(maxIntervalMs, baseDelay));
  const safeBackoffFactor = Math.max(1, Number(backoffFactor) || 1);
  const safeJitterRatio = Math.min(1, Math.max(0, Number(jitterRatio) || 0));
  let active = false;
  let timer = null;
  let inFlight = null;
  let failures = 0;
  let generation = 0;
  let status = "stopped";

  function isVisible() {
    return eventTarget?.document?.visibilityState !== "hidden";
  }

  function setStatus(nextStatus, extra = {}) {
    status = nextStatus;
    try {
      onStatus({
        status,
        active,
        failures,
        inFlight: Boolean(inFlight),
        ...extra
      });
    } catch {
      // Observer failures must not stop future refreshes.
    }
  }

  function clearTimer() {
    if (timer == null) return;
    clearTimeout(timer);
    timer = null;
  }

  function nextDelay() {
    if (!failures) return baseDelay;
    const exponential = Math.min(maximumDelay, baseDelay * (safeBackoffFactor ** failures));
    const jitter = 1 + ((random() * 2 - 1) * safeJitterRatio);
    return Math.max(baseDelay, Math.round(exponential * jitter));
  }

  function schedule(delay = nextDelay()) {
    clearTimer();
    if (!active) return;
    if (!isVisible()) {
      setStatus("paused");
      return;
    }
    const safeDelay = Math.max(0, normalizeDelay(delay, baseDelay));
    setStatus(failures ? "backoff" : "scheduled", { nextRunInMs: safeDelay });
    const scheduledGeneration = generation;
    timer = setTimeout(() => {
      timer = null;
      if (!active || scheduledGeneration !== generation) return;
      void execute("scheduled");
    }, safeDelay);
  }

  function execute(reason = "manual") {
    if (!active) return Promise.resolve(undefined);
    if (!isVisible()) {
      clearTimer();
      setStatus("paused");
      return Promise.resolve(undefined);
    }
    if (inFlight) return inFlight;

    clearTimer();
    const runGeneration = generation;
    setStatus("running", { reason });
    const task = Promise.resolve()
      .then(() => run(reason))
      .then((result) => {
        if (active && runGeneration === generation) failures = 0;
        return result;
      })
      .catch((error) => {
        if (active && runGeneration === generation) {
          failures += 1;
          try {
            onError(error, { reason, failures, nextRunInMs: nextDelay() });
          } catch {
            // Error reporting is observational; the scheduler remains authoritative.
          }
        }
        return undefined;
      })
      .finally(() => {
        if (inFlight === task) inFlight = null;
        if (active && runGeneration === generation) schedule();
      });
    inFlight = task;
    return task;
  }

  function handleVisibilityChange() {
    if (!active) return;
    if (!isVisible()) {
      clearTimer();
      setStatus("paused");
      return;
    }
    failures = 0;
    void execute("visible");
  }

  function handleOnline() {
    if (!active || !isVisible()) return;
    failures = 0;
    void execute("online");
  }

  function start({ immediate = true } = {}) {
    stop();
    active = true;
    generation += 1;
    eventTarget?.addEventListener?.("online", handleOnline);
    eventTarget?.document?.addEventListener?.("visibilitychange", handleVisibilityChange);
    if (!isVisible()) {
      setStatus("paused");
    } else if (immediate) {
      void execute("start");
    } else {
      schedule(baseDelay);
    }
  }

  function stop() {
    active = false;
    failures = 0;
    generation += 1;
    clearTimer();
    eventTarget?.removeEventListener?.("online", handleOnline);
    eventTarget?.document?.removeEventListener?.("visibilitychange", handleVisibilityChange);
    setStatus("stopped");
  }

  return {
    start,
    stop,
    runNow: execute,
    isActive: () => active,
    isRunning: () => Boolean(inFlight),
    getSnapshot: () => ({ status, active, failures, inFlight: Boolean(inFlight) })
  };
}

function normalizeDelay(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : fallback;
}
