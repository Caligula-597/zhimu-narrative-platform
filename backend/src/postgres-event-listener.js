import { pool } from "./db.js";

// PostgreSQL can LISTEN to multiple channels on one session. All event buses
// share this broker so realtime fan-out consumes one pool connection, not one
// connection per domain.
const registrations = new Map();
const subscribedChannels = new Set();
let client = null;
let connectPromise = null;
let reconnectTimer = null;
let reconnectAttempt = 0;

function assertChannel(channel) {
  if (!/^[a-z][a-z0-9_]{0,62}$/i.test(channel)) throw new Error(`Invalid PostgreSQL channel: ${channel}`);
}

function activeRegistrations() {
  return [...registrations.values()].flatMap((items) => [...items]).filter((item) => item.active);
}

function reportError(error) {
  for (const registration of activeRegistrations()) registration.onError(error);
}

function handleNotification(message) {
  for (const registration of registrations.get(message.channel) ?? []) {
    if (registration.active) registration.onNotification(message);
  }
}

function discardClient(activeClient, error = null) {
  if (client !== activeClient) return;
  client = null;
  subscribedChannels.clear();
  activeClient.removeListener("notification", handleNotification);
  activeClient.removeListener("error", handleClientError);
  try {
    activeClient.release(error || undefined);
  } catch {
    /* pool may already have removed a failed client */
  }
}

function handleClientError(error) {
  const failedClient = client;
  reportError(error);
  if (failedClient) discardClient(failedClient, error);
  scheduleReconnect();
}

async function listenChannel(channel) {
  if (!client || subscribedChannels.has(channel)) return;
  await client.query(`LISTEN ${channel}`);
  subscribedChannels.add(channel);
}

async function connect() {
  if (client) return client;
  if (connectPromise) return connectPromise;
  connectPromise = (async () => {
    const nextClient = await pool.connect();
    client = nextClient;
    nextClient.on("notification", handleNotification);
    nextClient.once("error", handleClientError);
    try {
      for (const channel of registrations.keys()) {
        if ((registrations.get(channel)?.size ?? 0) > 0) await listenChannel(channel);
      }
      reconnectAttempt = 0;
      return nextClient;
    } catch (error) {
      discardClient(nextClient, error);
      throw error;
    }
  })().finally(() => {
    connectPromise = null;
  });
  return connectPromise;
}

function scheduleReconnect() {
  if (!activeRegistrations().length || reconnectTimer) return;
  const delay = Math.min(30000, 1000 * (2 ** reconnectAttempt));
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect().catch((error) => {
      reportError(error);
      scheduleReconnect();
    });
  }, delay);
  reconnectTimer.unref?.();
}

async function releaseIfIdle() {
  if (activeRegistrations().length || !client) return;
  const activeClient = client;
  try {
    await activeClient.query("UNLISTEN *");
  } catch {
    /* ignore shutdown races */
  }
  discardClient(activeClient);
}

/** Resilient, reference-counted channel registration on the shared LISTEN session. */
export function createPostgresEventListener({ channel, onNotification, onError = () => {} }) {
  assertChannel(channel);
  const registration = { channel, onNotification, onError, active: false };

  async function start() {
    if (registration.active) return;
    registration.active = true;
    if (!registrations.has(channel)) registrations.set(channel, new Set());
    registrations.get(channel).add(registration);
    try {
      await connect();
      await listenChannel(channel);
    } catch (error) {
      registration.active = false;
      registrations.get(channel)?.delete(registration);
      if (registrations.get(channel)?.size === 0) registrations.delete(channel);
      throw error;
    }
  }

  async function stop() {
    if (!registration.active) return;
    registration.active = false;
    const channelRegistrations = registrations.get(channel);
    channelRegistrations?.delete(registration);
    if (channelRegistrations?.size === 0) {
      registrations.delete(channel);
      if (client && subscribedChannels.has(channel)) {
        try {
          await client.query(`UNLISTEN ${channel}`);
        } catch {
          /* connection failure recovery owns cleanup */
        }
        subscribedChannels.delete(channel);
      }
    }
    if (!activeRegistrations().length && reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    await releaseIfIdle();
  }

  return {
    start,
    stop,
    isListening: () => registration.active && Boolean(client) && subscribedChannels.has(channel)
  };
}

export function getPostgresEventListenerStatus() {
  return {
    connected: Boolean(client),
    connectionCount: client ? 1 : 0,
    channels: [...subscribedChannels].sort()
  };
}
