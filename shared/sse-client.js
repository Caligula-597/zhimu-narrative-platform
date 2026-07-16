import { consumeSseStream } from "./sse.js";
import { traceRequestHeaders } from "./trace-context.js";
import { validateRoomEvent } from "./contracts/room-events.js";

/** Keep resume cursors isolated across accounts, rooms and stream classes. */
export function scopedSseCursorKey(prefix, ...scopes) {
  const normalizedPrefix = String(prefix || "zhimuSseCursor");
  return [normalizedPrefix, ...scopes.map((scope) => encodeURIComponent(String(scope || "anonymous")))].join(":");
}

/** Shared authenticated SSE transport for app, host and play clients. */
export async function openSseStream({
  url,
  headers = {},
  signal,
  cursorKey,
  storage = globalThis.localStorage,
  onEvent,
  connectedOnOpen = false,
  stripFields = ["at", "roomId"],
  mapHttpError,
  eventTypeValidator,
  /** When true, skip unknown room.* event types (still deliver non-room lifecycle). */
  validateRoomEvents = true
}) {
  const requestHeaders = { Accept: "text/event-stream", ...traceRequestHeaders(), ...headers };
  let cursor = null;
  try {
    cursor = cursorKey ? storage?.getItem?.(cursorKey) : null;
  } catch {
    cursor = null;
  }
  const numericCursor = Number(cursor);
  if (/^\d+$/.test(String(cursor ?? "")) && Number.isSafeInteger(numericCursor)) {
    requestHeaders["Last-Event-ID"] = String(cursor);
  }

  const response = await fetch(url, {
    headers: requestHeaders,
    signal,
    credentials: "include"
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = mapHttpError?.(response, payload, { headers: requestHeaders })
      || Object.assign(new Error(payload.error || payload.message || `SSE ${response.status}`), {
        code: payload.code,
        status: response.status
      });
    throw error;
  }

  if (connectedOnOpen) await onEvent?.("__connected__", {});
  return consumeSseStream(response, {
    cursorKey,
    storage,
    initialCursor: requestHeaders["Last-Event-ID"] ?? null,
    onEvent: async (_eventType, message) => {
      if (message?.type === "heartbeat") return;
      if (message?.type === "connected") {
        if (!connectedOnOpen) await onEvent?.("__connected__", message);
        return;
      }
      const payload = { ...message };
      const type = payload.type;
      delete payload.type;
      for (const field of stripFields) delete payload[field];
      if (!type) return;
      if (validateRoomEvents && type.startsWith("room.") && !validateRoomEvent(type, payload).ok) {
        return;
      }
      if (eventTypeValidator && !eventTypeValidator(type, payload)) return;
      await onEvent?.(type, payload);
    }
  });
}
