/**
 * Shared SSE stream parser — reads a fetch Response body as Server-Sent Events,
 * splits blocks on blank lines, parses event/data/id lines, persists Last-Event-ID cursor.
 *
 * Caller responsibilities:
 * - fetch() with proper headers (Accept, Last-Event-ID, auth)
 * - response.ok check and error formatting (this only parses the body)
 * - business logic in onEvent (connected/heartbeat filtering, type extraction)
 *
 * Line parsing tolerates both "field:value" and "field: value" (space optional per SSE spec),
 * and concatenates multiple data: lines (host style).
 *
 * @param {Response} response
 * @param {{
 *   onEvent: (eventType: string, data: any) => void,
 *   cursorKey?: string
 * }} [options]
 */
export async function consumeSseStream(response, { onEvent, cursorKey, storage = globalThis.localStorage } = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function fieldValue(line, field) {
    let value = line.slice(field.length + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    return value;
  }

  async function dispatchBlock(block) {
    let eventType = "message";
    const dataLines = [];
    let eventId = "";
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue;
      if (line.startsWith("event:")) eventType = fieldValue(line, "event");
      else if (line.startsWith("data:")) dataLines.push(fieldValue(line, "data"));
      else if (line.startsWith("id:")) eventId = fieldValue(line, "id").trim();
    }
    const persistCursor = () => {
      const numericId = Number(eventId);
      if (eventId && cursorKey && /^\d+$/.test(eventId) && Number.isSafeInteger(numericId)) {
        storage?.setItem?.(cursorKey, eventId);
      }
    };
    if (!dataLines.length) {
      persistCursor();
      return;
    }
    const data = dataLines.join("\n");
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      /* ignore malformed SSE */
      persistCursor();
      return;
    }
    await onEvent?.(eventType, parsed);
    persistCursor();
  }

  async function drainBuffer({ final = false } = {}) {
    buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    let idx;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      await dispatchBlock(block);
    }
    if (final && buffer.trim()) {
      await dispatchBlock(buffer);
      buffer = "";
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      await drainBuffer({ final: true });
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    await drainBuffer();
  }
}
