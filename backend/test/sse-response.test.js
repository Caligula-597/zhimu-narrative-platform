import assert from "node:assert/strict";
import test from "node:test";
import { resolveSseMaxBufferedBytes, writeSseEvent } from "../src/sse-response.js";

function fakeResponse(initialLength = 0) {
  return {
    destroyed: false,
    writableEnded: false,
    writableLength: initialLength,
    frames: [],
    write(frame) {
      this.frames.push(frame);
      this.writableLength += Buffer.byteLength(frame, "utf8");
      return true;
    }
  };
}

test("SSE buffer configuration is bounded", () => {
  assert.equal(resolveSseMaxBufferedBytes(undefined), 1024 * 1024);
  assert.equal(resolveSseMaxBufferedBytes("65536"), 65536);
  assert.equal(resolveSseMaxBufferedBytes("0"), 1024 * 1024);
});

test("writeSseEvent formats one frame and rejects slow consumers before buffering", () => {
  const healthy = fakeResponse();
  assert.equal(writeSseEvent(healthy, { id: 7, payload: '{"type":"room.test"}' }, 1024), true);
  assert.equal(healthy.frames[0], 'id: 7\ndata: {"type":"room.test"}\n\n');

  const slow = fakeResponse(1000);
  assert.equal(writeSseEvent(slow, { id: 8, payload: "x".repeat(100) }, 1024), false);
  assert.equal(slow.frames.length, 0);
});
