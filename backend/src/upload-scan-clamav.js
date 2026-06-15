/**
 * ClamAV clamd INSTREAM scan (optional sidecar: clamav/clamav on TCP 3310).
 */
import net from "node:net";
import { throwErr } from "./api-errors.js";

function sendChunks(socket, chunks) {
  return new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.write(Buffer.from("zINSTREAM\0"));
    for (const chunk of chunks) {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(chunk.length, 0);
      socket.write(len);
      socket.write(chunk);
    }
    socket.write(Buffer.alloc(4));
    socket.once("data", (data) => resolve(data.toString("utf8").trim()));
  });
}

/**
 * @param {AsyncIterable<Buffer>|Buffer[]} chunks
 */
export async function scanWithClamAv(chunks) {
  const host = process.env.UPLOAD_SCAN_CLAMAV_HOST || "127.0.0.1";
  const port = Number(process.env.UPLOAD_SCAN_CLAMAV_PORT || 3310);
  const timeoutMs = Number(process.env.UPLOAD_SCAN_TIMEOUT_MS || 120_000);

  const parts = [];
  if (Buffer.isBuffer(chunks)) {
    parts.push(chunks);
  } else if (Symbol.asyncIterator in Object(chunks)) {
    for await (const chunk of chunks) {
      parts.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  } else if (Array.isArray(chunks)) {
    for (const chunk of chunks) parts.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const response = await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, async () => {
      try {
        const text = await sendChunks(socket, parts);
        socket.end();
        resolve(text);
      } catch (error) {
        socket.destroy();
        reject(error);
      }
    });
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      reject(new Error("ClamAV scan timed out"));
    });
    socket.once("error", reject);
  });

  if (/FOUND$/i.test(response)) {
    throwErr("UPLOAD_SCAN_INFECTED", response);
  }
  if (!/OK$/i.test(response)) {
    throwErr("UPLOAD_SCAN_FAILED", response || "Unexpected ClamAV response");
  }
  return { clean: true, mode: "clamav", detail: response };
}
