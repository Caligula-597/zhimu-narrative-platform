const DEFAULT_MAX_BUFFERED_BYTES = 1024 * 1024;

export function resolveSseMaxBufferedBytes(raw = process.env.SSE_MAX_BUFFERED_BYTES) {
  const value = Number(raw ?? DEFAULT_MAX_BUFFERED_BYTES);
  return Number.isInteger(value) && value >= 64 * 1024 && value <= 16 * 1024 * 1024
    ? value
    : DEFAULT_MAX_BUFFERED_BYTES;
}

/** Disconnect slow consumers before Node's socket buffer grows without bound. */
export function writeSseEvent(raw, { id, payload }, maxBufferedBytes = resolveSseMaxBufferedBytes()) {
  try {
    if (raw.destroyed || raw.writableEnded) return false;
    const frame = `${id !== undefined && id !== null ? `id: ${id}\n` : ""}data: ${payload}\n\n`;
    if (Number(raw.writableLength || 0) + Buffer.byteLength(frame, "utf8") > maxBufferedBytes) return false;
    raw.write(frame);
    return Number(raw.writableLength || 0) <= maxBufferedBytes;
  } catch {
    return false;
  }
}
