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
 *   cursorKey?: string,
 *   initialCursor?: string | number | null
 * }} [options]
 */
export async function consumeSseStream(response, { onEvent, cursorKey, storage = globalThis.localStorage, initialCursor } = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const readStoredCursor = () => {
    try {
      const value = cursorKey ? storage?.getItem?.(cursorKey) : null;
      const numeric = Number(value);
      return /^\d+$/.test(String(value ?? "")) && Number.isSafeInteger(numeric) ? numeric : null;
    } catch {
      return null;
    }
  };
  const parsedInitialCursor = Number(initialCursor);
  const resumeCursor = initialCursor !== undefined
    && /^\d+$/.test(String(initialCursor ?? ""))
    && Number.isSafeInteger(parsedInitialCursor)
    ? parsedInitialCursor
    : initialCursor !== undefined ? null : readStoredCursor();
  let lastHandledCursor = resumeCursor;
  const deliveredIds = new Set();

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
    const numericId = Number(eventId);
    const hasNumericId = Boolean(eventId) && /^\d+$/.test(eventId) && Number.isSafeInteger(numericId);
    if (hasNumericId && ((resumeCursor != null && numericId <= resumeCursor) || deliveredIds.has(numericId))) return;
    const persistCursor = () => {
      if (!hasNumericId) return;
      deliveredIds.add(numericId);
      while (deliveredIds.size > 2000) deliveredIds.delete(deliveredIds.values().next().value);
      lastHandledCursor = Math.max(lastHandledCursor ?? numericId, numericId);
      if (!cursorKey) return;
      try {
        const storedCursor = readStoredCursor();
        if (storedCursor == null || lastHandledCursor > storedCursor) storage?.setItem?.(cursorKey, String(lastHandledCursor));
      } catch {
        /* cursor persistence is best-effort; event delivery must continue */
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
