import assert from "node:assert/strict";
import test from "node:test";
import { currentTraceId, traceRequestHeaders } from "../shared/trace-context.js";

test("traceRequestHeaders includes stable session trace id", () => {
  const storage = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  };
  try {
    const first = traceRequestHeaders();
    const second = traceRequestHeaders();
    assert.equal(first["X-Trace-Id"], second["X-Trace-Id"]);
    assert.equal(first["X-Request-Id"], first["X-Trace-Id"]);
    assert.ok(first["X-Trace-Id"].length > 8);
  } finally {
    delete globalThis.sessionStorage;
  }
});

test("currentTraceId creates id when storage missing", () => {
  const original = globalThis.sessionStorage;
  delete globalThis.sessionStorage;
  try {
    assert.ok(currentTraceId().length > 8);
  } finally {
    globalThis.sessionStorage = original;
  }
});
