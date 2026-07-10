/**
 * Ops alert bridge — readiness transitions + optional webhook (PagerDuty/Slack/Discord).
 * ALERT_WEBHOOK_URL: POST JSON { severity, title, body, labels, ts }
 */
import { getReadinessStatus } from "./database-status.js";
import { getPoolStats } from "./db.js";
import { getSseConnectionMetrics } from "./room-event-bus.js";
import { startNonOverlappingInterval } from "./non-overlapping-interval.js";

let lastReady = null;
let stopMonitor = null;

export function getAlertWebhookConfig() {
  const url = process.env.ALERT_WEBHOOK_URL?.trim();
  return {
    configured: Boolean(url),
    url: url || null,
    intervalMs: Number(process.env.ALERT_CHECK_INTERVAL_MS || 60_000)
  };
}

export async function buildAlertPayload({ severity, title, body, labels = {} }) {
  const [ready, pool, sse] = await Promise.all([
    getReadinessStatus(),
    Promise.resolve(getPoolStats()),
    Promise.resolve(getSseConnectionMetrics())
  ]);
  return {
    severity,
    title,
    body,
    ts: new Date().toISOString(),
    service: process.env.OTEL_SERVICE_NAME || "zhimu-api",
    labels: {
      nodeEnv: process.env.NODE_ENV || "development",
      ready: String(ready.ready),
      ...labels
    },
    context: {
      database: { latencyMs: ready.latencyMs, missingTables: ready.missingTables?.length ?? 0 },
      pool: { waiting: pool.waiting, idle: pool.idle, total: pool.total },
      sse: { connections: sse.connections, rooms: sse.rooms }
    }
  };
}

export async function dispatchAlertWebhook(payload) {
  const url = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!url) return { sent: false, reason: "not_configured" };
  const secret = process.env.ALERT_WEBHOOK_SECRET?.trim();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {})
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(Number(process.env.ALERT_WEBHOOK_TIMEOUT_MS || 15_000))
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Alert webhook HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  return { sent: true, status: response.status };
}

export async function fireReadinessTransitionAlert(ready) {
  const severity = ready ? "info" : "critical";
  const title = ready ? "织幕 API 恢复就绪" : "织幕 API readiness 失败";
  const body = ready
    ? "GET /api/health/ready 已恢复 200。"
    : "GET /api/health/ready 返回非就绪状态，请检查数据库与 roomEventBus。";
  const payload = await buildAlertPayload({ severity, title, body, labels: { kind: "readiness_transition" } });
  return dispatchAlertWebhook(payload);
}

async function pollReadiness(log) {
  try {
    const ready = await getReadinessStatus();
    if (lastReady !== null && ready.ready !== lastReady) {
      log?.info?.({ ready: ready.ready }, "readiness state changed — dispatching alert");
      await fireReadinessTransitionAlert(ready.ready);
    }
    lastReady = ready.ready;
  } catch (error) {
    log?.error?.({ err: error }, "readiness alert poll failed");
  }
}

export function startOpsAlertMonitor({ log, intervalMs } = {}) {
  stopMonitor?.();
  stopMonitor = null;
  const config = getAlertWebhookConfig();
  if (!config.configured) {
    return () => {};
  }
  const ms = intervalMs ?? config.intervalMs;
  const monitor = startNonOverlappingInterval(
    () => pollReadiness(log),
    ms,
    { immediate: true }
  );
  stopMonitor = monitor.stop;
  log?.info?.({ intervalMs: ms }, "Ops alert monitor started");
  return () => {
    stopMonitor?.();
    stopMonitor = null;
  };
}

export function resetAlertMonitorForTests() {
  lastReady = null;
  stopMonitor?.();
  stopMonitor = null;
}
