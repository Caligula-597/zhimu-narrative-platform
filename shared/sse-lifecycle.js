import { createAdaptivePoller } from "./adaptive-poller.js";

export const PORTAL_POLL_INTERVAL_MS = Object.freeze({
  room: 15000,
  platform: 20000
});

/**
 * Thin adapter for the common portal stream contract. It keeps transport
 * handshake handling, pull reconciliation and connection state wiring out of
 * individual Creator, Host and Player controllers.
 */
export function createPortalEventLifecycle({
  connect,
  onEvent,
  refresh,
  shouldPoll = () => true,
  onConnectionChange = () => {},
  onConnected = () => {},
  onDisconnected = () => {},
  ...lifecycleOptions
}) {
  if (typeof connect !== "function") throw new TypeError("portal event lifecycle requires connect");
  if (typeof refresh !== "function") throw new TypeError("portal event lifecycle requires refresh");
  return createSseLifecycle({
    ...lifecycleOptions,
    open: ({ signal, onConnected: markConnected }) => connect({
      signal,
      onEvent: async (type, payload) => {
        if (type === "__connected__") return markConnected(payload);
        await onEvent?.(type, payload);
      }
    }),
    poll: (reason) => shouldPoll() ? refresh(reason) : undefined,
    reconcile: (reason, payload) => refresh(reason, payload),
    onConnected: async (payload) => {
      onConnectionChange(true);
      await onConnected(payload);
    },
    onDisconnected: async () => {
      onConnectionChange(false);
      await onDisconnected();
    }
  });
}

/** Shared reconnect, authentication and adaptive polling lifecycle for long-lived SSE streams. */
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
  pollMaxMs = Math.max(pollMs, pollMs * 8),
  connectedReconcileMs = 30000,
  connectedReconcileMaxMs = Math.max(connectedReconcileMs, connectedReconcileMs * 4),
  reconnectBaseMs = 1000,
  reconnectMaxMs = 30000,
  eventTarget = globalThis,
  random = Math.random
}) {
  let active = false;
  let connected = false;
  let abortController = null;
  let reconnectTimer = null;
  let pollPromise = null;
  let reconcilePromise = null;
  let reconnectAttempt = 0;
  let generation = 0;

  function setStatus(status) {
    onStatus(status);
  }

  function clearReconnectTimer() {
    if (!reconnectTimer) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  async function performPoll(reason = "poll") {
    if (!active || connected || typeof poll !== "function") return;
    const task = Promise.resolve(poll(reason));
    pollPromise = task;
    try {
      await task;
    } finally {
      if (pollPromise === task) pollPromise = null;
    }
  }

  const fallbackPoller = createAdaptivePoller({
    run: performPoll,
    intervalMs: pollMs,
    maxIntervalMs: pollMaxMs,
    eventTarget,
    random,
    onError: (error, meta) => onError(error, { phase: "poll", ...meta })
  });

  function startPolling() {
    if (!active || connected || typeof poll !== "function") return;
    setStatus("polling");
    if (!fallbackPoller.isActive()) fallbackPoller.start({ immediate: false });
  }

  function stopPolling() {
    fallbackPoller.stop();
  }

  function runReconcile(reason = "connected", payload) {
    if (!active || !connected || typeof reconcile !== "function") return Promise.resolve();
    if (reconcilePromise) return reconcilePromise;
    const task = Promise.resolve(reconcile(reason, payload)).finally(() => {
      if (reconcilePromise === task) reconcilePromise = null;
    });
    reconcilePromise = task;
    return task;
  }

  const connectedPoller = createAdaptivePoller({
    run: () => runReconcile("connected-periodic"),
    intervalMs: connectedReconcileMs,
    maxIntervalMs: connectedReconcileMaxMs,
    eventTarget,
    random,
    onError: (error, meta) => onError(error, {
      phase: "reconcile",
      reason: "connected-periodic",
      ...meta
    })
  });

  function startConnectedReconciliation() {
    connectedPoller.stop();
    const intervalMs = Number(connectedReconcileMs);
    if (!active || !connected || typeof reconcile !== "function"
      || !Number.isFinite(intervalMs) || intervalMs <= 0) return;
    connectedPoller.start({ immediate: false });
  }

  function stopConnectedReconciliation() {
    connectedPoller.stop();
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
    clearReconnectTimer();
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
        await runReconcile("connected", payload).catch((error) => {
          onError(error, { phase: "reconcile", reason: "connected" });
        });
        startConnectedReconciliation();
        await onConnected(payload);
      }
    })).catch(async (error) => {
      if (signal.aborted || currentGeneration !== generation) return;
      onError(error, { phase: "stream" });
      if (error?.status === 401 && !error?.staleCredential) {
        active = false;
        await onAuthLost(error);
      }
    }).finally(async () => {
      if (signal.aborted || currentGeneration !== generation) return;
      connected = false;
      stopConnectedReconciliation();
      abortController = null;
      try {
        await onDisconnected();
      } catch (error) {
        onError(error, { phase: "disconnect" });
      }
      if (!active) {
        stopPolling();
        setStatus("idle");
        return;
      }
      startPolling();
      void fallbackPoller.runNow("disconnected");
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
    clearReconnectTimer();
    stopPolling();
    stopConnectedReconciliation();
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
