import { query } from "./db.js";

/** Best-effort notification: authoritative writes must never fail because fan-out is unavailable. */
export async function safePostgresNotify({ channel, payload, onError = () => {}, queryFn = query }) {
  try {
    await queryFn(`SELECT pg_notify($1, $2)`, [channel, payload]);
    return true;
  } catch (error) {
    onError(error);
    return false;
  }
}
