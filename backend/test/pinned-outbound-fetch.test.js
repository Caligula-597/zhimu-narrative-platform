import assert from "node:assert/strict";
import test from "node:test";
import {
  createPinnedLookup,
  readBoundedJson,
  responseByteLimit
} from "../src/pinned-outbound-fetch.js";

test("pinned lookup rejects an empty validated address set", () => {
  assert.throws(() => createPinnedLookup([]), /validated outbound address/);
});

test("pinned lookup returns only prevalidated addresses", async () => {
  const lookup = createPinnedLookup([
    { address: "93.184.216.34", family: 4 },
    { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 }
  ]);
  const resolve = (options) => new Promise((resolvePromise, reject) => {
    lookup("ignored.example", options, (error, address, family) => {
      if (error) reject(error);
      else resolvePromise({ address, family });
    });
  });
  assert.deepEqual(await resolve({}), { address: "93.184.216.34", family: 4 });
  assert.deepEqual(await resolve({}), {
    address: "2606:2800:220:1:248:1893:25c8:1946",
    family: 6
  });
});

test("bounded JSON reader rejects declared and streamed oversized responses", async () => {
  await assert.rejects(
    readBoundedJson(new Response("{}", { headers: { "content-length": "70000" } }), 65536),
    (error) => error?.code === "LLM_RESPONSE_TOO_LARGE"
  );

  const largeBody = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(40000));
      controller.enqueue(new Uint8Array(40000));
      controller.close();
    }
  });
  await assert.rejects(
    readBoundedJson(new Response(largeBody), 65536),
    (error) => error?.code === "LLM_RESPONSE_TOO_LARGE"
  );
});

test("bounded JSON reader returns parsed JSON and safely ignores malformed bodies", async () => {
  assert.deepEqual(await readBoundedJson(new Response('{"ok":true}'), 65536), { ok: true });
  assert.deepEqual(await readBoundedJson(new Response("not-json"), 65536), {});
});

test("response limit rejects unsafe overrides and keeps a bounded range", () => {
  assert.equal(responseByteLimit("65536"), 65536);
  assert.equal(responseByteLimit("1"), 2 * 1024 * 1024);
  assert.equal(responseByteLimit(String(16 * 1024 * 1024)), 2 * 1024 * 1024);
});
