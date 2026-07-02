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
export async function consumeSseStream(response, { onEvent, cursorKey } = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let eventType = "message";
      let data = "";
      let eventId = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) eventType = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
        else if (line.startsWith("id:")) eventId = line.slice(3).trim();
      }
      if (eventId && cursorKey) localStorage.setItem(cursorKey, eventId);
      if (data) {
        try {
          onEvent?.(eventType, JSON.parse(data));
        } catch {
          /* ignore malformed SSE */
        }
      }
    }
  }
}
