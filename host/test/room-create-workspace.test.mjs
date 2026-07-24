import assert from "node:assert/strict";
import test from "node:test";
import { state } from "../src/state.js";
import {
  HOST_ROOM_NAME_MAX,
  createHostRoomCreateWorkspace,
  hostRoomCreateNavigationBlockReason,
  parseHostRoomDraft,
  updateHostRoomDraft
} from "../src/runtime/host-room-create-model.js";
import { createHostRoomCreateService } from "../src/runtime/host-room-create-service.js";
import { renderHostRoomCreateWorkspace } from "../src/views/host-room-create-workspace.js";

function preserveState() {
  return {
    hostRoomCreateWorkspace: state.hostRoomCreateWorkspace,
    rooms: state.rooms,
    studio: state.studio
  };
}

test("room draft mirrors the Fastify 1-80 character name contract", () => {
  const workspace = createHostRoomCreateWorkspace("world-1", new Date("2026-07-24T00:00:00Z"));
  assert.equal(workspace.name, "运行房 · 2026-07-24");
  updateHostRoomDraft(workspace, "name", "");
  assert.equal(parseHostRoomDraft(workspace).ok, false);
  updateHostRoomDraft(workspace, "name", "a".repeat(HOST_ROOM_NAME_MAX + 1));
  assert.equal(parseHostRoomDraft(workspace).ok, false);
  updateHostRoomDraft(workspace, "name", "首发测试房");
  updateHostRoomDraft(workspace, "publicListing", true);
  assert.deepEqual(parseHostRoomDraft(workspace).payload, {
    name: "首发测试房",
    publicListing: true
  });
  assert.match(hostRoomCreateNavigationBlockReason(workspace), /草稿尚未创建/);
  workspace.status = "uncertain";
  assert.match(hostRoomCreateNavigationBlockReason(workspace), /等待核对/);
});

test("room creation renders as an escaped inline workspace without prompt", () => {
  const previousStorage = globalThis.localStorage;
  const previous = preserveState();
  globalThis.localStorage = {
    getItem(key) { return key === "zhimuHostWorldId" ? "world-1" : ""; },
    setItem() {},
    removeItem() {}
  };
  state.studio = { world: { name: "剧本<script>" } };
  state.hostRoomCreateWorkspace = createHostRoomCreateWorkspace("world-1");
  state.hostRoomCreateWorkspace.name = '房间<img src=x onerror="1">';
  try {
    const html = renderHostRoomCreateWorkspace();
    assert.match(html, /data-host-room-create-workspace/);
    assert.match(html, /data-action="host-room-create-submit"/);
    assert.match(html, /剧本&lt;script&gt;/);
    assert.match(html, /房间&lt;img/);
    assert.doesNotMatch(html, /modal-backdrop|class="modal"|window\.prompt|<script>|<img/);
  } finally {
    Object.assign(state, previous);
    globalThis.localStorage = previousStorage;
  }
});

test("room create locks duplicates and binds its immutable world plus request key", async () => {
  const previous = preserveState();
  state.rooms = [];
  state.hostRoomCreateWorkspace = createHostRoomCreateWorkspace("world-1");
  state.hostRoomCreateWorkspace.name = "并发测试房";
  let resolveWrite;
  const pending = new Promise((resolve) => { resolveWrite = resolve; });
  const calls = [];
  const service = createHostRoomCreateService({
    render() {},
    showToast() {},
    getWorld: () => "world-1",
    apiRef: {
      createRoom: async (payload, worldId, key) => {
        calls.push({ payload, worldId, key });
        return pending;
      },
      getWorldRooms: async () => []
    }
  });
  try {
    const first = service.submit();
    assert.equal(await service.submit(), null);
    assert.equal(calls.length, 1);
    resolveWrite({ id: "room-1", name: "并发测试房", invite_code: "ROOM-1234" });
    await first;
    assert.equal(calls[0].worldId, "world-1");
    assert.match(calls[0].key, /^host-room-create-/);
    assert.equal(state.hostRoomCreateWorkspace.status, "success");
    assert.equal(state.rooms[0].id, "room-1");
  } finally {
    Object.assign(state, previous);
  }
});

test("room creation replays the original key after network uncertainty and never reports refresh failure as create failure", async () => {
  const previous = preserveState();
  state.rooms = [];
  state.hostRoomCreateWorkspace = createHostRoomCreateWorkspace("world-1");
  state.hostRoomCreateWorkspace.name = "断线测试房";
  const keys = [];
  let attempt = 0;
  const service = createHostRoomCreateService({
    render() {},
    showToast() {},
    getWorld: () => "world-1",
    apiRef: {
      createRoom: async (_payload, _worldId, key) => {
        keys.push(key);
        attempt += 1;
        if (attempt === 1) throw Object.assign(new Error("offline"), { code: "NETWORK_ERROR" });
        return { id: "room-2", name: "断线测试房", invite_code: "ROOM-5678" };
      },
      getWorldRooms: async () => {
        throw Object.assign(new Error("refresh failed"), { code: "NETWORK_ERROR" });
      }
    }
  });
  try {
    await service.submit();
    assert.equal(state.hostRoomCreateWorkspace.status, "uncertain");
    await service.reconcile();
    assert.equal(state.hostRoomCreateWorkspace.status, "success");
    assert.deepEqual(keys, [keys[0], keys[0]]);
    assert.match(state.hostRoomCreateWorkspace.message, /服务端已确认创建，但列表刷新失败/);
    assert.equal(state.rooms[0].id, "room-2");
  } finally {
    Object.assign(state, previous);
  }
});
