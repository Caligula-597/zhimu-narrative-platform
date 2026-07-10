import { consumeSseStream } from "./sse.js";
import { traceRequestHeaders } from "./trace-context.js";

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
  mapHttpError
}) {
  const requestHeaders = { Accept: "text/event-stream", ...traceRequestHeaders(), ...headers };
  const cursor = cursorKey ? storage?.getItem?.(cursorKey) : null;
  if (cursor) requestHeaders["Last-Event-ID"] = cursor;

  const response = await fetch(url, {
    headers: requestHeaders,
    signal,
    credentials: "include"
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = mapHttpError?.(response, payload)
      || Object.assign(new Error(payload.error || payload.message || `SSE ${response.status}`), {
        code: payload.code,
        status: response.status
      });
    throw error;
  }

  if (connectedOnOpen) await onEvent?.("__connected__", {});
  return consumeSseStream(response, {
    cursorKey,
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
      if (type) await onEvent?.(type, payload);
    }
  });
}
