import {
  awaitIdempotentReplay,
  claimIdempotencySlot,
  completeIdempotencySlot,
  failIdempotencySlot,
  hashIdempotencyRequest,
  readIdempotencyKey
} from "./idempotency.js";

/**
 * Room-scoped idempotent write wrapper.
 * Concurrent duplicate keys: first claim executes; others wait/replay or 409.
 */
export async function withRoomIdempotency(roomId, request, routeKey, handler) {
  const idempotencyKey = readIdempotencyKey(request);
  if (!idempotencyKey) return handler();

  const requestHash = hashIdempotencyRequest(request);
  const claim = await claimIdempotencySlot(roomId, idempotencyKey, routeKey, requestHash);

  // Dev fail-open when table missing — execute once without recording.
  if (claim == null) return handler();

  if (claim === "replay") {
    return awaitIdempotentReplay(roomId, idempotencyKey, routeKey, requestHash);
  }

  try {
    const response = await handler();
    try {
      await completeIdempotencySlot(roomId, idempotencyKey, response);
    } catch (completeError) {
      // Domain write already succeeded — do not flip the client to failure / force a re-execute.
      console.error(
        "[idempotency] complete after success failed:",
        completeError?.message || completeError
      );
    }
    return response;
  } catch (error) {
    await failIdempotencySlot(roomId, idempotencyKey, {
      error: error.message || String(error),
      code: error.code || "INTERNAL_ERROR",
      statusCode: error.statusCode || error.status || 500,
      details: error.details
    }).catch(() => {});
    throw error;
  }
}
