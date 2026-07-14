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
await startRoomEventBus();
await startPlatformEventBus();
const stopEventOutbox = startEventOutboxDispatcher({ log: app.log });
const stopHostDelayWake = startHostDelayWakeInterval();
const stopAlertMonitor = startOpsAlertMonitor({ log: app.log });
const port = Number(process.env.PORT ?? 4180);

async function shutdown(signal) {
  app.log.info({ signal }, "shutting down");
  stopHostDelayWake();
  stopAlertMonitor();
  stopEventOutbox();
  await stopRoomEventBus();
  await stopPlatformEventBus();
  await app.close();
  await shutdownSentry();
  await shutdownTelemetry();
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
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
  await shutdownSentry();
  await shutdownTelemetry();
  await pool.end();
  process.exit(1);
}
