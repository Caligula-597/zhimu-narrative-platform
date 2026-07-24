import assert from "node:assert/strict";
import test from "node:test";
import { state } from "../src/state.js";
import {
  createHostEventWorkspace,
  parseHostEventCommand,
  updateHostEventDelay
} from "../src/runtime/host-event-workspace-model.js";
import { createHostEventWorkspaceService } from "../src/runtime/host-event-workspace-service.js";
import { renderHostEventWorkspace } from "../src/views/host-event-workspace.js";

function event(overrides = {}) {
  return {
    id: "event-1",
    title: "打开暗门<script>",
    description: "玩家完成大厅调查",
    status: "pending",
    created_at: "2026-07-24T10:00:00.000Z",
    source_label: "自动化规则",
    rule_name: "大厅调查完成",
    rule_mode: "host_confirm",
    rule_conditions: { type: "</pre><img>" },
    actions: [{ type: "unlock_scene", sceneId: "scene-1" }],
    action_summaries: ["开放场景：暗门"],
    trigger_players: ["role-1"],
    ...overrides
  };
}

function preserveState() {
  return {
    hostEventWorkspace: state.hostEventWorkspace,
    hostEventSelection: state.hostEventSelection,
    cloudHostEvents: state.cloudHostEvents,
    cloudHostPlayers: state.cloudHostPlayers
  };
}

test("event delay input mirrors the backend 1-1440 minute schema", () => {
  const workspace = createHostEventWorkspace({ roomId: "room-1", event: event(), intent: "delay" });
  updateHostEventDelay(workspace, "0");
  assert.equal(parseHostEventCommand(workspace, "delay").ok, false);
  updateHostEventDelay(workspace, "1441");
  assert.equal(parseHostEventCommand(workspace, "delay").ok, false);
  updateHostEventDelay(workspace, "120");
  assert.deepEqual(parseHostEventCommand(workspace, "delay").payload, { delayMinutes: 120 });
});

test("event workspace renders escaped context inline without a modal", () => {
  const previousStorage = globalThis.localStorage;
  const previous = preserveState();
  globalThis.localStorage = {
    getItem(key) {
      if (key === "zhimuHostWorldId") return "world-1";
      if (key === "zhimuHostRoomId:world-1") return "room-1";
      return "";
    }
  };
  state.cloudHostEvents = [event()];
  state.cloudHostPlayers = [{
    role_slot_id: "role-1",
    player_display_name: "玩家<img>",
    role_name: "侦探"
  }];
  state.hostEventWorkspace = createHostEventWorkspace({
    roomId: "room-1",
    event: event(),
    intent: "execute"
  });
  try {
    const html = renderHostEventWorkspace();
    assert.match(html, /data-host-event-workspace/);
    assert.match(html, /data-action="host-event-workspace-submit"/);
    assert.match(html, /打开暗门&lt;script&gt;/);
    assert.match(html, /玩家&lt;img&gt;/);
    assert.match(html, /&lt;\/pre&gt;&lt;img&gt;/);
    assert.doesNotMatch(html, /modal-backdrop|class="modal"|<script>|<img>/);
  } finally {
    Object.assign(state, previous);
    globalThis.localStorage = previousStorage;
  }
});

test("event execute locks duplicate submits and binds room plus idempotency key", async () => {
  const previous = preserveState();
  state.cloudHostEvents = [event()];
  state.hostEventSelection = ["event-1"];
  state.hostEventWorkspace = createHostEventWorkspace({
    roomId: "room-1",
    event: event(),
    intent: "execute"
  });
  let resolveWrite;
  const pending = new Promise((resolve) => { resolveWrite = resolve; });
  const calls = [];
  const service = createHostEventWorkspaceService({
    render() {},
    showToast() {},
    getRoom: () => "room-1",
    refreshRoom: async () => true,
    apiRef: {
      executeHostEvent: async (eventId, roomId, key) => {
        calls.push({ eventId, roomId, key });
        return pending;
      }
    }
  });
  try {
    const first = service.submit("execute");
    assert.equal(await service.submit("execute"), null);
    assert.equal(calls.length, 1);
    resolveWrite({ ok: true });
    await first;
    assert.equal(calls[0].roomId, "room-1");
    assert.match(calls[0].key, /^host-event-execute-/);
    assert.equal(state.hostEventWorkspace.status, "success");
    assert.equal(state.cloudHostEvents.length, 0);
    assert.equal(state.hostEventSelection.length, 0);
  } finally {
    Object.assign(state, previous);
  }
});

test("uncertain event writes stay frozen and reuse their key through processing", async () => {
  const previous = preserveState();
  state.cloudHostEvents = [event()];
  state.hostEventWorkspace = createHostEventWorkspace({
    roomId: "room-1",
    event: event(),
    intent: "dismiss"
  });
  const keys = [];
  let attempt = 0;
  const service = createHostEventWorkspaceService({
    render() {},
    showToast() {},
    getRoom: () => "room-1",
    refreshRoom: async () => true,
    apiRef: {
      dismissHostEvent: async (_eventId, _roomId, key) => {
        keys.push(key);
        attempt += 1;
        if (attempt === 1) throw Object.assign(new Error("offline"), { code: "NETWORK_ERROR" });
        if (attempt === 2) {
          throw Object.assign(new Error("processing"), { code: "IDEMPOTENCY_IN_PROGRESS" });
        }
        return { ok: true };
      }
    }
  });
  try {
    await service.submit("dismiss");
    assert.equal(state.hostEventWorkspace.status, "uncertain");
    await service.submit("execute");
    assert.equal(attempt, 1);
    await service.reconcile();
    assert.equal(state.hostEventWorkspace.status, "uncertain");
    await service.reconcile();
    assert.equal(state.hostEventWorkspace.status, "success");
    assert.deepEqual(keys, [keys[0], keys[0], keys[0]]);
  } finally {
    Object.assign(state, previous);
  }
});

test("a stale event is blocked before any write reaches the API", async () => {
  const previous = preserveState();
  state.cloudHostEvents = [];
  state.hostEventWorkspace = createHostEventWorkspace({
    roomId: "room-1",
    event: event(),
    intent: "execute"
  });
  let calls = 0;
  const service = createHostEventWorkspaceService({
    render() {},
    showToast() {},
    getRoom: () => "room-1",
    apiRef: {
      executeHostEvent: async () => { calls += 1; }
    }
  });
  try {
    await service.submit("execute");
    assert.equal(calls, 0);
    assert.equal(state.hostEventWorkspace.status, "stale");
  } finally {
    Object.assign(state, previous);
  }
});

test("a committed delay remains successful when room refresh fails", async () => {
  const previous = preserveState();
  state.cloudHostEvents = [event()];
  state.hostEventWorkspace = createHostEventWorkspace({
    roomId: "room-1",
    event: event(),
    intent: "delay"
  });
  updateHostEventDelay(state.hostEventWorkspace, "30");
  const service = createHostEventWorkspaceService({
    render() {},
    showToast() {},
    getRoom: () => "room-1",
    refreshRoom: async () => false,
    apiRef: {
      delayHostEvent: async () => ({ ok: true, delayMinutes: 30 })
    }
  });
  try {
    await service.submit("delay");
    assert.equal(state.hostEventWorkspace.status, "success");
    assert.match(state.hostEventWorkspace.message, /服务器已确认写入/);
    assert.equal(state.cloudHostEvents[0].status, "delayed");
  } finally {
    Object.assign(state, previous);
  }
});
