import { readIdempotencyKey, loadIdempotentResponse, storeIdempotentResponse } from "./idempotency.js";

export async function withRoomIdempotency(roomId, request, routeKey, handler) {
  const idempotencyKey = readIdempotencyKey(request);
  if (idempotencyKey) {
    const cached = await loadIdempotentResponse(roomId, idempotencyKey);
    if (cached) return cached;
  }
  const response = await handler();
  await storeIdempotentResponse(roomId, idempotencyKey, routeKey, response);
  return response;
}
