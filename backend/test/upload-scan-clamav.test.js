import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import {
  parseClamAvVerdict,
  resolveClamAvConnectionOptions,
  scanWithClamAv
} from "../src/upload-scan-clamav.js";

test("ClamAV connection options bound invalid environment values", () => {
  assert.deepEqual(resolveClamAvConnectionOptions({
    UPLOAD_SCAN_CLAMAV_HOST: " ",
    UPLOAD_SCAN_CLAMAV_PORT: "70000",
    UPLOAD_SCAN_TIMEOUT_MS: "-1"
  }), {
    host: "127.0.0.1",
    port: 3310,
    timeoutMs: 120_000
  });
});

test("ClamAV verdict parser accepts null-terminated replies and rejects unknown verdicts", () => {
  assert.deepEqual(parseClamAvVerdict("stream: OK\0"), {
    clean: true,
    mode: "clamav",
    detail: "stream: OK"
  });
  assert.throws(
    () => parseClamAvVerdict("stream: Eicar-Test-Signature FOUND\0"),
    (error) => error.code === "UPLOAD_SCAN_INFECTED"
  );
  assert.throws(
    () => parseClamAvVerdict("stream: UNKNOWN\0"),
    (error) => error.code === "UPLOAD_SCAN_FAILED"
  );
});

test("ClamAV scan waits for a split protocol response", async () => {
  const server = net.createServer((socket) => {
    let replied = false;
    socket.on("data", () => {
      if (replied) return;
      replied = true;
      socket.write("stream: O");
      setTimeout(() => socket.write("K\0"), 5);
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const previous = {
    host: process.env.UPLOAD_SCAN_CLAMAV_HOST,
    port: process.env.UPLOAD_SCAN_CLAMAV_PORT,
    timeout: process.env.UPLOAD_SCAN_TIMEOUT_MS
  };
  process.env.UPLOAD_SCAN_CLAMAV_HOST = "127.0.0.1";
  process.env.UPLOAD_SCAN_CLAMAV_PORT = String(address.port);
  process.env.UPLOAD_SCAN_TIMEOUT_MS = "1000";
  try {
    const verdict = await scanWithClamAv([Buffer.from("sample")]);
    assert.equal(verdict.clean, true);
    assert.equal(verdict.detail, "stream: OK");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (previous.host === undefined) delete process.env.UPLOAD_SCAN_CLAMAV_HOST;
    else process.env.UPLOAD_SCAN_CLAMAV_HOST = previous.host;
    if (previous.port === undefined) delete process.env.UPLOAD_SCAN_CLAMAV_PORT;
    else process.env.UPLOAD_SCAN_CLAMAV_PORT = previous.port;
    if (previous.timeout === undefined) delete process.env.UPLOAD_SCAN_TIMEOUT_MS;
    else process.env.UPLOAD_SCAN_TIMEOUT_MS = previous.timeout;
  }
});
