function normalizeEnvelope(message) {
  if (typeof message === "string") return { payload: message };
  return message && typeof message === "object" ? message : { payload: JSON.stringify(message) };
}

function numericId(envelope) {
  const id = Number(envelope?.id);
  return Number.isSafeInteger(id) && id >= 0 ? id : null;
}

/**
 * Subscribe before reading the journal, buffer concurrent live events, then replay
 * through a fixed high-water mark and de-duplicate the buffer before going live.
 */
export function createReplaySubscription({
  lastEventId,
  subscribe,
  getLatestId,
  fetchAfter,
  send,
  beforeLive = () => true,
  onReplayError = () => {},
  pageSize = 200
}) {
  let phase = "buffering";
  let buffered = [];
  let closed = false;
  let unsubscribed = false;
  const replayedIds = new Set();
  let unsubscribeLive = () => {};

  const deliver = (message) => {
    if (closed) return false;
    const envelope = normalizeEnvelope(message);
    const id = numericId(envelope);
    if (id != null && replayedIds.has(id)) return true;
    const ok = send(envelope);
    if (!ok) unsubscribe();
    return ok;
  };

  unsubscribeLive = subscribe((message) => {
    if (closed) return;
    if (phase !== "live") buffered.push(normalizeEnvelope(message));
    else deliver(message);
  });

  const unsubscribe = () => {
    if (unsubscribed) return;
    unsubscribed = true;
    closed = true;
    buffered = [];
    unsubscribeLive();
  };

  const ready = (async () => {
    try {
      const parsedCursor = Number(lastEventId);
      if (lastEventId != null && lastEventId !== "" && Number.isSafeInteger(parsedCursor) && parsedCursor >= 0) {
        const highWaterMark = Number(await getLatestId());
        let cursor = parsedCursor;
        while (!closed && cursor < highWaterMark) {
          const rows = await fetchAfter(cursor, { throughId: highWaterMark, limit: pageSize });
          if (!rows.length) break;
          for (const row of rows) {
            const id = Number(row.id);
            const envelope = { id, payload: JSON.stringify(row.payload) };
            if (!send(envelope)) {
              unsubscribe();
              break;
            }
            replayedIds.add(id);
            cursor = id;
          }
          if (rows.length < pageSize) break;
        }
      }
    } catch (error) {
      onReplayError(error);
    }

    phase = "flushing";
    while (!closed && buffered.length) {
      const batch = buffered;
      buffered = [];
      batch.sort((a, b) => (numericId(a) ?? Number.MAX_SAFE_INTEGER) - (numericId(b) ?? Number.MAX_SAFE_INTEGER));
      for (const message of batch) {
        if (!deliver(message)) break;
      }
    }
    if (!closed && beforeLive() === false) unsubscribe();
    replayedIds.clear();
    phase = "live";
    return !closed;
  })();

  return { ready, unsubscribe };
}
