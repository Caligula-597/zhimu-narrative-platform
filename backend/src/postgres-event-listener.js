import { pool } from "./db.js";

/** Resilient LISTEN connection shared by event buses. */
export function createPostgresEventListener({ channel, onNotification, onError = () => {} }) {
  let client = null;
  let listening = false;
  let stopped = true;
  let reconnectTimer = null;
  let reconnectAttempt = 0;
  let clientErrorHandler = null;

  function scheduleReconnect() {
    if (stopped || reconnectTimer) return;
    const delay = Math.min(30000, 1000 * (2 ** reconnectAttempt));
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect().catch((error) => {
        onError(error);
        scheduleReconnect();
      });
    }, delay);
    reconnectTimer.unref?.();
  }

  function discard(activeClient, error) {
    if (client !== activeClient) return;
    listening = false;
    client = null;
    activeClient.removeListener("notification", onNotification);
    if (clientErrorHandler) activeClient.removeListener("error", clientErrorHandler);
    clientErrorHandler = null;
    try {
      activeClient.release(error || true);
    } catch {
      /* pool may already have removed a failed client */
    }
  }

  async function connect() {
    if (stopped || client) return;
    const nextClient = await pool.connect();
    client = nextClient;
    const handleError = (error) => {
      onError(error);
      discard(nextClient, error);
      scheduleReconnect();
    };
    clientErrorHandler = handleError;
    nextClient.once("error", handleError);
    nextClient.on("notification", onNotification);
    try {
      await nextClient.query(`LISTEN ${channel}`);
      listening = true;
      reconnectAttempt = 0;
    } catch (error) {
      nextClient.removeListener("error", handleError);
      discard(nextClient, error);
      throw error;
    }
  }

  async function start() {
    stopped = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    await connect();
  }

  async function stop() {
    stopped = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    const activeClient = client;
    if (!activeClient) return;
    try {
      await activeClient.query(`UNLISTEN ${channel}`);
    } catch {
      /* ignore shutdown races */
    }
    discard(activeClient);
  }

  return { start, stop, isListening: () => listening };
}
