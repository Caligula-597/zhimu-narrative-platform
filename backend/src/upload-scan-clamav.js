/**
 * ClamAV clamd INSTREAM scan (optional sidecar: clamav/clamav on TCP 3310).
 */
import net from "node:net";
import { throwErr } from "./api-errors.js";
import { resolveUpstreamTimeoutMs } from "./upstream-fetch.js";

const DEFAULT_CLAMAV_PORT = 3310;
const DEFAULT_CLAMAV_TIMEOUT_MS = 120_000;
const MAX_CLAMAV_RESPONSE_BYTES = 16 * 1024;

export function resolveClamAvConnectionOptions(env = process.env) {
  const parsedPort = Number(env.UPLOAD_SCAN_CLAMAV_PORT ?? DEFAULT_CLAMAV_PORT);
  return {
    host: String(env.UPLOAD_SCAN_CLAMAV_HOST ?? "").trim() || "127.0.0.1",
    port: Number.isSafeInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65_535
      ? parsedPort
      : DEFAULT_CLAMAV_PORT,
    timeoutMs: resolveUpstreamTimeoutMs(
      env.UPLOAD_SCAN_TIMEOUT_MS,
      DEFAULT_CLAMAV_TIMEOUT_MS
    )
  };
}

function writeWithBackpressure(socket, data) {
  if (socket.write(data)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onDrain = () => {
      socket.off("error", onError);
      resolve();
    };
    const onError = (error) => {
      socket.off("drain", onDrain);
      reject(error);
    };
    socket.once("drain", onDrain);
    socket.once("error", onError);
  });
}

function sendChunks(socket, chunks) {
  return new Promise((resolve, reject) => {
    const responseChunks = [];
    let responseBytes = 0;
    let settled = false;
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("end", onEnd);
      socket.off("error", onError);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const raw = Buffer.concat(responseChunks, responseBytes).toString("utf8");
      resolve(raw.split("\0", 1)[0].trim());
    };
    const onError = (error) => fail(error);
    const onEnd = () => finish();
    const onData = (data) => {
      const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
      responseBytes += chunk.length;
      if (responseBytes > MAX_CLAMAV_RESPONSE_BYTES) {
        fail(new Error("ClamAV response exceeded the safety limit"));
        return;
      }
      responseChunks.push(chunk);
      if (chunk.includes(0) || chunk.includes(10)) finish();
    };
    socket.on("data", onData);
    socket.once("end", onEnd);
    socket.once("error", onError);

    void (async () => {
      await writeWithBackpressure(socket, Buffer.from("zINSTREAM\0"));
      for (const chunk of chunks) {
        if (chunk.length > 0xffff_ffff) throw new Error("ClamAV chunk exceeds protocol limit");
        const len = Buffer.alloc(4);
        len.writeUInt32BE(chunk.length, 0);
        await writeWithBackpressure(socket, len);
        await writeWithBackpressure(socket, chunk);
      }
      await writeWithBackpressure(socket, Buffer.alloc(4));
    })().catch(fail);
  });
}

export function parseClamAvVerdict(response) {
  const normalized = String(response ?? "").replace(/\0+$/gu, "").trim();
  if (/FOUND$/iu.test(normalized)) {
    throwErr("UPLOAD_SCAN_INFECTED", normalized);
  }
  if (!/OK$/iu.test(normalized)) {
    throwErr("UPLOAD_SCAN_FAILED", normalized || "Unexpected ClamAV response");
  }
  return { clean: true, mode: "clamav", detail: normalized };
}

/**
 * @param {AsyncIterable<Buffer>|Buffer[]} chunks
 */
export async function scanWithClamAv(chunks) {
  const { host, port, timeoutMs } = resolveClamAvConnectionOptions();

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

  return parseClamAvVerdict(response);
}
