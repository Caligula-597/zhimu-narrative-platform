import assert from "node:assert/strict";
import test from "node:test";

import {
  applySyncStatus,
  createSyncDiagnostics,
  describeSyncDiagnostics,
  markInputRefreshDeferred,
  markSyncError,
  markSyncReconciled,
  readSseCursor,
} from "../shared/sync-diagnostics.js";

test("sync diagnostics explain reconnect, retry timing, cursor and catch-up completion", () => {
  let state = applySyncStatus(createSyncDiagnostics(), "reconnecting", {
    reason: "stream_closed",
    retryAt: "2026-08-11T10:00:05.000Z",
  });
  assert.match(describeSyncDiagnostics(state), /实时通道已关闭/);
  state = applySyncStatus(state, "connected", { reason: "stream_connected", catchUpPending: true });
  assert.match(describeSyncDiagnostics(state), /正在追平/);
  state = markSyncReconciled(state, {
    cursor: 42,
    at: "2026-08-11T10:00:06.000Z",
  });
  assert.match(describeSyncDiagnostics(state), /状态已追平/);
  assert.match(describeSyncDiagnostics(state), /游标 #42/);
});

test("sync diagnostics announce protected input and normalize transport failures", () => {
  let state = markSyncReconciled(createSyncDiagnostics(), { cursor: 7 });
  state = markInputRefreshDeferred(state, true);
  assert.match(describeSyncDiagnostics(state), /保护你输入中的内容/);
  state = markSyncError(state, { code: "SSE_HANDSHAKE_TIMEOUT" });
  assert.equal(state.reason, "handshake_timeout");
});

test("cursor reads are safe and reject injected or unavailable storage values", () => {
  assert.equal(readSseCursor({ getItem: () => "41" }, "cursor"), 41);
  assert.equal(readSseCursor({ getItem: () => "41\r\nInjected" }, "cursor"), null);
  assert.equal(readSseCursor({ getItem: () => { throw new Error("denied"); } }, "cursor"), null);
});
