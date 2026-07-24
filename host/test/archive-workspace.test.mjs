import assert from "node:assert/strict";
import test from "node:test";
import { state } from "../src/state.js";
import {
  HOST_ARCHIVE_LIMITS,
  createHostArchiveWorkspace,
  parseHostArchiveDraft,
  updateHostArchiveField
} from "../src/runtime/host-archive-model.js";
import { createHostArchiveService } from "../src/runtime/host-archive-service.js";
import { renderHostArchiveWorkspace } from "../src/views/host-archive-workspace.js";

function room() {
  return { id: "room-1", name: "第一夜<script>" };
}

function createdCheckpoint(overrides = {}) {
  return {
    id: "checkpoint-1",
    label: "第一夜收工",
    description: "推进到大厅",
    created_at: "2026-07-24T10:00:00.000Z",
    summary: {
      joinedPlayers: 4,
      totalRoles: 5,
      clueCount: 6,
      unlockedSceneCount: 2,
      pendingEventCount: 1
    },
    ...overrides
  };
}

test("archive drafts mirror backend limits and preserve separate checkpoint and recap work", () => {
  const workspace = createHostArchiveWorkspace({ room: room() });
  updateHostArchiveField(workspace, "title", "第一夜收工");
  updateHostArchiveField(workspace, "description", "继续调查大厅");
  assert.equal(workspace.dirty.checkpoint, true);
  assert.equal(parseHostArchiveDraft(workspace).ok, true);

  workspace.kind = "recap";
  updateHostArchiveField(workspace, "title", "完整复盘");
  assert.equal(workspace.drafts.checkpoint.title, "第一夜收工");
  assert.equal(workspace.drafts.recap.title, "完整复盘");

  workspace.drafts.recap.title = "x".repeat(HOST_ARCHIVE_LIMITS.TITLE + 1);
  workspace.drafts.recap.description = "y".repeat(HOST_ARCHIVE_LIMITS.DESCRIPTION + 1);
  const invalid = parseHostArchiveDraft(workspace);
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.map((item) => item.message).join("\n"), /最多 120/);
  assert.match(invalid.errors.map((item) => item.message).join("\n"), /最多 2000/);
});

test("archive fingerprints normalize whitespace to prevent semantically duplicate writes", () => {
  const workspace = createHostArchiveWorkspace({ room: room() });
  updateHostArchiveField(workspace, "title", "  第一夜收工  ");
  updateHostArchiveField(workspace, "description", "  推进到大厅  ");
  const spaced = parseHostArchiveDraft(workspace);
  workspace.drafts.checkpoint = { title: "第一夜收工", description: "推进到大厅" };
  const normalized = parseHostArchiveDraft(workspace);
  assert.equal(spaced.fingerprint, normalized.fingerprint);
  assert.deepEqual(spaced.payload, normalized.payload);
});

test("archive workspace renders escaped room history in the page instead of a modal", () => {
  const previousStorage = globalThis.localStorage;
  const previous = {
    hostArchiveWorkspace: state.hostArchiveWorkspace,
    cloudHostPlayers: state.cloudHostPlayers,
    cloudHostEvents: state.cloudHostEvents,
    cloudWorldLogs: state.cloudWorldLogs,
    studio: state.studio
  };
  globalThis.localStorage = {
    getItem(key) {
      if (key === "zhimuHostWorldId") return "world-1";
      if (key === "zhimuHostRoomId:world-1") return "room-1";
      return "";
    },
    setItem() {},
    removeItem() {}
  };
  state.cloudHostPlayers = [{ joined: true }];
  state.cloudHostEvents = [{ status: "pending" }];
  state.cloudWorldLogs = [{}];
  state.studio = { clues: [{ id: "clue-1" }] };
  state.hostArchiveWorkspace = createHostArchiveWorkspace({ room: room() });
  state.hostArchiveWorkspace.checkpoints = [
    createdCheckpoint({ label: "存档<img>", description: "</textarea><script>" })
  ];
  state.hostArchiveWorkspace.recaps = [{
    id: "recap-invalid-date",
    label: "异常时间复盘",
    created_at: "not-a-date",
    summary: {}
  }];
  state.hostArchiveWorkspace.historyStatus = "ready";
  try {
    const html = renderHostArchiveWorkspace();
    assert.match(html, /data-host-archive-workspace/);
    assert.match(html, /data-action="host-archive-submit"/);
    assert.match(html, /第一夜&lt;script&gt;/);
    assert.match(html, /存档&lt;img&gt;/);
    assert.doesNotMatch(html, /<script>|<img>|<\/textarea><script>|modal-backdrop|class="modal"/);
    state.hostArchiveWorkspace.kind = "recap";
    assert.match(renderHostArchiveWorkspace(), /时间未知/);
  } finally {
    Object.assign(state, previous);
    globalThis.localStorage = previousStorage;
  }
});

test("checkpoint creation locks duplicate submits and binds the original room and idempotency key", async () => {
  const previous = state.hostArchiveWorkspace;
  state.hostArchiveWorkspace = createHostArchiveWorkspace({ room: room() });
  updateHostArchiveField(state.hostArchiveWorkspace, "title", "第一夜收工");
  let createCount = 0;
  let resolveCreate;
  const pending = new Promise((resolve) => { resolveCreate = resolve; });
  const calls = [];
  const service = createHostArchiveService({
    render() {},
    showToast() {},
    getRoom: () => "room-1",
    apiRef: {
      createCheckpoint: async (payload, roomId, key) => {
        createCount += 1;
        calls.push({ payload, roomId, key });
        return pending;
      },
      getRoomCheckpoints: async () => [],
      getRoomRecaps: async () => []
    }
  });
  try {
    const first = service.submit();
    const duplicate = await service.submit();
    assert.equal(duplicate, null);
    assert.equal(createCount, 1);
    resolveCreate(createdCheckpoint());
    await first;
    assert.equal(calls[0].roomId, "room-1");
    assert.match(calls[0].key, /^host-checkpoint-/);
    assert.equal(state.hostArchiveWorkspace.status, "success");
    assert.equal(state.hostArchiveWorkspace.dirty.checkpoint, false);
  } finally {
    state.hostArchiveWorkspace = previous;
  }
});

test("an uncertain recap stays frozen while its idempotent request is processing", async () => {
  const previous = state.hostArchiveWorkspace;
  state.hostArchiveWorkspace = createHostArchiveWorkspace({ room: room(), kind: "recap" });
  updateHostArchiveField(state.hostArchiveWorkspace, "title", "第一夜完整复盘");
  const keys = [];
  let attempts = 0;
  const service = createHostArchiveService({
    render() {},
    showToast() {},
    getRoom: () => "room-1",
    apiRef: {
      createRecap: async (_payload, _roomId, key) => {
        keys.push(key);
        attempts += 1;
        if (attempts === 1) throw Object.assign(new Error("offline"), { code: "NETWORK_ERROR" });
        if (attempts === 2) {
          throw Object.assign(new Error("still processing"), { code: "IDEMPOTENCY_IN_PROGRESS" });
        }
        return {
          id: "recap-1",
          label: "第一夜完整复盘",
          description: "",
          summary: {}
        };
      },
      getRoomCheckpoints: async () => [],
      getRoomRecaps: async () => []
    }
  });
  try {
    await service.submit();
    assert.equal(state.hostArchiveWorkspace.status, "uncertain");
    assert.match(state.hostArchiveWorkspace.message, /草稿已冻结/);
    await service.submit();
    assert.equal(attempts, 1);
    await service.reconcile();
    assert.equal(attempts, 2);
    assert.equal(keys[1], keys[0]);
    assert.equal(state.hostArchiveWorkspace.status, "uncertain");
    assert.match(state.hostArchiveWorkspace.message, /服务器仍在处理原提交/);
    await service.submit();
    assert.equal(attempts, 2);
    await service.reconcile();
    assert.equal(attempts, 3);
    assert.equal(keys[2], keys[0]);
    assert.equal(state.hostArchiveWorkspace.status, "success");
    assert.equal(state.hostArchiveWorkspace.recaps[0].id, "recap-1");
  } finally {
    state.hostArchiveWorkspace = previous;
  }
});

test("archive history tolerates a partial read failure without blocking creation", async () => {
  const previous = state.hostArchiveWorkspace;
  state.hostArchiveWorkspace = createHostArchiveWorkspace({ room: room() });
  const service = createHostArchiveService({
    render() {},
    showToast() {},
    getRoom: () => "room-1",
    apiRef: {
      getRoomCheckpoints: async () => [createdCheckpoint()],
      getRoomRecaps: async () => {
        throw Object.assign(new Error("offline"), { code: "NETWORK_ERROR" });
      }
    }
  });
  try {
    const result = await service.loadHistory();
    assert.equal(result.checkpoints.length, 1);
    assert.equal(state.hostArchiveWorkspace.historyStatus, "partial");
    assert.match(state.hostArchiveWorkspace.historyError, /网络/);
  } finally {
    state.hostArchiveWorkspace = previous;
  }
});

test("a late archive response cannot overwrite a newly selected room", async () => {
  const previous = state.hostArchiveWorkspace;
  state.hostArchiveWorkspace = createHostArchiveWorkspace({ room: room() });
  updateHostArchiveField(state.hostArchiveWorkspace, "title", "旧房间存档");
  let currentRoom = "room-1";
  let resolveCreate;
  const pending = new Promise((resolve) => { resolveCreate = resolve; });
  const toasts = [];
  const service = createHostArchiveService({
    render() {},
    showToast(message) { toasts.push(message); },
    getRoom: () => currentRoom,
    apiRef: {
      createCheckpoint: async () => pending,
      getRoomCheckpoints: async () => [],
      getRoomRecaps: async () => []
    }
  });
  try {
    const oldSubmit = service.submit();
    currentRoom = "room-2";
    state.hostArchiveWorkspace = createHostArchiveWorkspace({
      room: { id: "room-2", name: "新房间" }
    });
    resolveCreate(createdCheckpoint());
    await oldSubmit;
    assert.equal(state.hostArchiveWorkspace.roomId, "room-2");
    assert.equal(state.hostArchiveWorkspace.checkpoints.length, 0);
    assert.match(toasts.join("\n"), /上一运行房/);
  } finally {
    state.hostArchiveWorkspace = previous;
  }
});
