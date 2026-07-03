/**
 * Sentry integration with optional DSN.
 *
 * When SENTRY_DSN is not set, all functions are no-ops.
 * Initialized once in server.js before createApp(); captureException is
 * called from the Fastify error handler for 5xx errors.
 */
import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return { enabled: false };

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    sendDefaultPii: false,
    shutdownTimeout: Number(process.env.SENTRY_SHUTDOWN_TIMEOUT ?? 5000)
  });
  initialized = true;
  return { enabled: true };
}

export function captureException(error, context) {
  if (!initialized) return;
  try {
    Sentry.captureException(error, context);
  } catch {
    /* never let Sentry itself crash the request */
  }
}

export async function shutdownSentry() {
  if (!initialized) return;
  try {
    await Sentry.close();
  } catch {
    /* ignore shutdown races */
  }
  initialized = false;
}

export function getSentryStatus() {
  const dsn = process.env.SENTRY_DSN?.trim();
  return {
    configured: Boolean(dsn),
    enabled: initialized,
    environment: process.env.NODE_ENV ?? "development"
  };
}
