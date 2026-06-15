import "dotenv/config";
import { pool } from "./db.js";
import { runStartupValidation } from "./startup-validation.js";
import { createApp } from "./app.js";
import { startRoomEventBus, stopRoomEventBus } from "./room-event-bus.js";
import { startHostDelayWakeInterval } from "./host-delay-wake.js";
import { startOpsAlertMonitor } from "./ops-alert-bridge.js";

await runStartupValidation();

const app = await createApp();
await startRoomEventBus();
const hostDelayWakeTimer = startHostDelayWakeInterval();
const stopAlertMonitor = startOpsAlertMonitor({ log: app.log });
const port = Number(process.env.PORT ?? 4180);

async function shutdown(signal) {
  app.log.info({ signal }, "shutting down");
  clearInterval(hostDelayWakeTimer);
  stopAlertMonitor();
  await stopRoomEventBus();
  await app.close();
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
  await pool.end();
  process.exit(1);
}
