/** Shared reconnect, authentication and polling lifecycle for long-lived SSE streams. */
export function createSseLifecycle({
  open,
  poll,
  reconcile = poll,
  onStatus = () => {},
  onConnected = () => {},
  onDisconnected = () => {},
  onAuthLost = () => {},
  onError = () => {},
  pollMs = 15000,
  reconnectBaseMs = 1000,
  reconnectMaxMs = 30000,
  eventTarget = globalThis,
  random = Math.random
}) {
  let active = false;
  let connected = false;
  let abortController = null;
  let reconnectTimer = null;
  let pollTimer = null;
  let pollInFlight = false;
  let pollPromise = null;
  let reconnectAttempt = 0;
  let generation = 0;

  function setStatus(status) {
    onStatus(status);
  }

  function clearTimer(name) {
    if (name === "reconnect" && reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (name === "poll" && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function runPoll(reason = "poll") {
    if (!active || connected || pollInFlight || typeof poll !== "function") return;
    pollInFlight = true;
    try {
      pollPromise = Promise.resolve(poll(reason));
      await pollPromise;
    } catch (error) {
      onError(error, { phase: "poll" });
    } finally {
      pollInFlight = false;
      pollPromise = null;
    }
  }

  function startPolling() {
    if (!active || connected || typeof poll !== "function") return;
    setStatus("polling");
    if (!pollTimer) pollTimer = setInterval(() => void runPoll(), pollMs);
  }

  function stopPolling() {
    clearTimer("poll");
  }

  function scheduleReconnect(connect) {
    if (!active || reconnectTimer) return;
    setStatus("reconnecting");
    const exponential = Math.min(reconnectMaxMs, reconnectBaseMs * (2 ** reconnectAttempt));
    const delay = Math.max(250, Math.round(exponential * (0.75 + random() * 0.5)));
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function connect() {
    if (!active) return;
    clearTimer("reconnect");
    abortController?.abort();
    abortController = new AbortController();
    const signal = abortController.signal;
    const currentGeneration = generation;
    setStatus("reconnecting");

    Promise.resolve().then(() => open({
      signal,
      onConnected: async (payload) => {
        if (!active || signal.aborted || currentGeneration !== generation) return;
        connected = true;
        reconnectAttempt = 0;
        stopPolling();
        setStatus("connected");
        if (pollPromise) await pollPromise.catch(() => {});
        try {
          await reconcile?.("connected", payload);
        } catch (error) {
          onError(error, { phase: "reconcile" });
        }
        await onConnected(payload);
      }
    })).catch(async (error) => {
      if (signal.aborted || currentGeneration !== generation) return;
      onError(error, { phase: "stream" });
      if (error?.status === 401) {
        active = false;
        await onAuthLost(error);
      }
    }).finally(async () => {
      if (signal.aborted || currentGeneration !== generation) return;
      connected = false;
      abortController = null;
      await onDisconnected();
      if (!active) {
        stopPolling();
        setStatus("idle");
        return;
      }
      startPolling();
      void runPoll("disconnected");
      scheduleReconnect(connect);
    });
  }

  function handleRecoverySignal() {
    if (!active || connected) return;
    if (eventTarget?.document?.visibilityState === "hidden") return;
    reconnectAttempt = 0;
    connect();
  }

  function start() {
    stop();
    active = true;
    generation += 1;
    eventTarget?.addEventListener?.("online", handleRecoverySignal);
    eventTarget?.document?.addEventListener?.("visibilitychange", handleRecoverySignal);
    startPolling();
    connect();
  }

  function stop() {
    active = false;
    connected = false;
    generation += 1;
    clearTimer("reconnect");
    stopPolling();
    abortController?.abort();
    abortController = null;
    eventTarget?.removeEventListener?.("online", handleRecoverySignal);
    eventTarget?.document?.removeEventListener?.("visibilitychange", handleRecoverySignal);
    setStatus("idle");
  }

  return {
    start,
    stop,
    reconnect: handleRecoverySignal,
    isConnected: () => connected,
    isActive: () => active
  };
}
