import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function update(relative, transform) {
  const target = path.join(root, relative);
  const source = fs.readFileSync(target, "utf8");
  fs.writeFileSync(target, transform(source).replace(/\r\n/g, "\n"));
}

update("src/api/room.js", (source) => {
  if (source.includes('from "../../shared/sse-client.js"')) return source;
  const start = source.indexOf("export function streamRoomEvents");
  if (start < 0) throw new Error("Main room SSE marker missing");
  const prefix = source.slice(0, start)
    .replace('import { consumeSseStream } from "../../shared/sse.js";', 'import { openSseStream } from "../../shared/sse-client.js";');
  return `${prefix}export function streamRoomEvents(roomId, onEvent, signal, userId = demoContext.hostUserId) {
  const cursorKey = sseCursorKey(roomId);
  return openSseStream({
    url: \`${"${API_BASE}"}/rooms/${"${roomId}"}/events/stream\`,
    headers: authHeaders(userId),
    signal,
    cursorKey,
    onEvent,
    mapHttpError: (response, payload) => {
      const error = new Error(friendlyApiError(payload, \`SSE ${"${response.status}"}\`));
      error.status = response.status;
      return error;
    }
  });
}
`;
});

update("host/src/api.js", (source) => {
  if (source.includes('from "../../shared/sse-client.js"')) return source;
  const start = source.indexOf("  streamRoomEvents(roomId, onEvent, signal) {");
  const end = source.indexOf("\n  }\n};", start);
  if (start < 0 || end < 0) throw new Error("Host SSE marker missing");
  const method = `  streamRoomEvents(roomId, onEvent, signal) {
    const headers = { ...defaultSessionTokenStore.bearerHeaders() };
    if (import.meta.env.DEV && localStorage.getItem("zhimuDemoMode") === "true") {
      const demoUserId = localStorage.getItem("zhimuDemoUserId");
      if (demoUserId) headers["x-user-id"] = demoUserId;
    }
    return openSseStream({
      url: \`${"${API_BASE}"}/rooms/${"${roomId}"}/events/stream\`,
      headers,
      signal,
      cursorKey: sseCursorKey(roomId),
      connectedOnOpen: true,
      onEvent
    });
  }`;
  return `${source.slice(0, start).replace('import { consumeSseStream } from "../../shared/sse.js";', 'import { openSseStream } from "../../shared/sse-client.js";')}${method}${source.slice(end + 5)}`;
});

update("play/src/api.js", (source) => {
  if (source.includes('from "../../shared/sse-client.js"')) return source;
  const start = source.indexOf("  /** SSE room stream");
  const end = source.lastIndexOf("\n};");
  if (start < 0 || end < 0) throw new Error("Play SSE marker missing");
  const methods = `  /** SSE room stream shared with the main and host clients. */
  streamRoomEvents(roomId, onEvent, signal) {
    const headers = { ...sessionToken.bearerHeaders() };
    const demoUserId = localStorage.getItem("zhimuDemoUserId");
    if (demoUserId) headers["x-user-id"] = demoUserId;
    return openSseStream({
      url: \`${"${API_BASE}"}/rooms/${"${roomId}"}/events/stream\`,
      headers,
      signal,
      cursorKey: sseCursorKey(roomId),
      onEvent
    });
  },

  streamPlatformEvents(onEvent, signal) {
    const headers = { ...sessionToken.bearerHeaders() };
    const demoUserId = localStorage.getItem("zhimuDemoUserId");
    if (demoUserId) headers["x-user-id"] = demoUserId;
    return openSseStream({
      url: \`${"${API_BASE}"}/platform/events/stream\`,
      headers,
      signal,
      cursorKey: PLATFORM_SSE_CURSOR,
      onEvent
    });
  }
`;
  return `${source.slice(0, start).replace('import { consumeSseStream } from "../../shared/sse.js";', 'import { openSseStream } from "../../shared/sse-client.js";')}${methods}${source.slice(end)}`;
});

console.log("Shared SSE transport migration complete");
