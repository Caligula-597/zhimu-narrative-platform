import "dotenv/config";
import { pool } from "./db.js";
import { runStartupValidation } from "./startup-validation.js";
import { createApp } from "./app.js";
import { startRoomEventBus, stopRoomEventBus } from "./room-event-bus.js";
import { startPlatformEventBus, stopPlatformEventBus } from "./platform-event-bus.js";
import { startHostDelayWakeInterval } from "./host-delay-wake.js";
import { startOpsAlertMonitor } from "./ops-alert-bridge.js";
import { initTelemetry, shutdownTelemetry } from "./telemetry.js";
import { initSentry, shutdownSentry } from "./sentry.js";
import { startEventOutboxDispatcher } from "./event-outbox-dispatcher.js";

await runStartupValidation();
await initTelemetry();
initSentry();

const app = await createApp();
const port = Number(process.env.PORT ?? 4180);

let stopEventOutbox = () => {};
let stopHostDelayWake = () => {};
let stopAlertMonitor = () => {};
let shutdownPromise = null;

function shutdown(signal, exitCode = 0) {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    app.log.info({ signal }, "shutting down");
    const background = await Promise.allSettled([
      stopHostDelayWake(),
      stopAlertMonitor(),
      stopEventOutbox()
    ]);
    for (const result of background) {
      if (result.status === "rejected") app.log.error({ err: result.reason }, "background drain failed");
    }
    const services = await Promise.allSettled([
      stopRoomEventBus(),
      stopPlatformEventBus(),
      app.close(),
      shutdownSentry(),
      shutdownTelemetry()
    ]);
    for (const result of services) {
      if (result.status === "rejected") app.log.error({ err: result.reason }, "service shutdown failed");
    }
    await pool.end().catch((error) => app.log.error({ err: error }, "database pool shutdown failed"));
    process.exitCode = exitCode;
  })();
  return shutdownPromise;
}

process.once("SIGINT", () => { void shutdown("SIGINT"); });
process.once("SIGTERM", () => { void shutdown("SIGTERM"); });

try {
  // Bind health endpoints before optional buses so Railway healthcheck can pass
  // even when LISTEN/NOTIFY or outbox wake-up is slow under cold start.
  await app.listen({ host: "0.0.0.0", port });
  app.log.info(`Backend ready at http://127.0.0.1:${port}/api/health`);
} catch (error) {
  if (error.code === "EADDRINUSE") {
    console.error(`FATAL: Port ${port} is already in use.`);
    console.error("Run: cd backend && npm run dev:restart");
    console.error("Or: netstat -ano | findstr :4180  then  taskkill /PID <pid> /F");
  } else {
    app.log.error(error);
  }
  await shutdown("startup_failure", 1);
}

const busStarts = await Promise.allSettled([
  startRoomEventBus(),
  startPlatformEventBus()
]);
for (const result of busStarts) {
  if (result.status === "rejected") {
    app.log.error({ err: result.reason }, "background event bus startup failed; reconnect scheduled");
  }
}

try {
  stopEventOutbox = startEventOutboxDispatcher({ log: app.log });
} catch (error) {
  app.log.error({ err: error }, "event outbox dispatcher startup failed");
}
try {
  stopHostDelayWake = startHostDelayWakeInterval(30_000, (error) => {
    app.log.error({ err: error }, "host delay wake tick failed");
  });
} catch (error) {
  app.log.error({ err: error }, "host delay wake startup failed");
}
try {
  stopAlertMonitor = startOpsAlertMonitor({ log: app.log });
} catch (error) {
  app.log.error({ err: error }, "ops alert monitor startup failed");
}
