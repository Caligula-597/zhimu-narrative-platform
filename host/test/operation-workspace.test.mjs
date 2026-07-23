import assert from "node:assert/strict";
import test from "node:test";
import { state } from "../src/state.js";
import {
  HOST_OPERATION_KINDS,
  HOST_OPERATION_LIMITS,
  createHostOperation,
  hostOperationContextIsCurrent,
  resolveInitialUnlockRoleId,
  sectionOptionsForRole,
  updateHostOperationField
} from "../src/runtime/host-operation-model.js";
import { createHostOperationCommandService } from "../src/runtime/host-operation-command-service.js";
import { renderHostOperationWorkspace } from "../src/views/host-operation-workspace.js";

function fixtureState() {
  return {
    cloudHostPlayers: [
      {
        role_slot_id: "role-1",
        role_key: "detective",
        role_name: "侦探<script>",
        player_display_name: "玩家<img>",
        joined: true
      },
      {
        role_slot_id: "role-2",
        role_key: "witness",
        role_name: "证人",
        player_display_name: "玩家乙",
        joined: true
      }
    ],
    studio: {
      clues: [{ id: "clue-1", name: "血迹<svg>", metadata: { grantMode: "host_confirm" } }],
      items: [{ id: "item-1", name: "钥匙" }],
      scenes: [{ id: "scene-1", name: "大厅" }],
      sections: [
        { id: "section-1", role_slot_id: "role-1", sequence: 1, title: "序章" },
        { id: "section-2", role_slot_id: "role-2", sequence: 2, title: "第二幕", metadata: { matrixActKey: "act-2" } }
      ]
    },
    cloudHostClueMatrix: null
  };
}

test("host operation defaults stay bound to the room and preserve multi-player clue targets", () => {
  const fixture = fixtureState();
  const operation = createHostOperation({
    kind: HOST_OPERATION_KINDS.GRANT_CLUE,
    roomId: "room-1",
    stateRef: fixture,
    options: { clueId: "clue-1" }
  });
  assert.equal(operation.roomId, "room-1");
  assert.equal(operation.draft.clueId, "clue-1");
  assert.deepEqual(operation.draft.roleSlotIds, ["role-1", "role-2"]);
  assert.equal(hostOperationContextIsCurrent(operation, "room-1"), true);
  assert.equal(hostOperationContextIsCurrent(operation, "room-2"), false);

  updateHostOperationField(operation, "roleSlotIds", "role-2", false);
  assert.deepEqual(operation.draft.roleSlotIds, ["role-1"]);
  updateHostOperationField(operation, "roleSlotIds", "role-2", true);
  assert.deepEqual(operation.draft.roleSlotIds, ["role-1", "role-2"]);
});

test("bulk Host operations stay within the backend schema limits", () => {
  const fixture = fixtureState();
  fixture.cloudHostPlayers = Array.from({ length: 40 }, (_, index) => ({
    role_slot_id: `role-${index + 1}`,
    role_name: `角色 ${index + 1}`,
    player_display_name: `玩家 ${index + 1}`,
    joined: true
  }));
  const clueOperation = createHostOperation({
    kind: HOST_OPERATION_KINDS.GRANT_CLUE,
    roomId: "room-1",
    stateRef: fixture
  });
  const nudgeOperation = createHostOperation({
    kind: HOST_OPERATION_KINDS.NUDGE,
    roomId: "room-1",
    stateRef: fixture
  });
  assert.equal(clueOperation.draft.roleSlotIds.length, HOST_OPERATION_LIMITS.CLUE_TARGETS);
  assert.equal(nudgeOperation.draft.roleSlotIds.length, HOST_OPERATION_LIMITS.NUDGE_TARGETS);
});

test("section choices follow the selected player and prioritize the current act", () => {
  const fixture = fixtureState();
  assert.equal(
    resolveInitialUnlockRoleId(fixture.cloudHostPlayers, fixture.studio.sections, { roleSlotId: "role-2" }),
    "role-2"
  );
  assert.deepEqual(
    sectionOptionsForRole(fixture.studio.sections, "role-2", "act-2"),
    [{ id: "section-2", name: "本幕 · 2. 第二幕" }]
  );
});

test("host operation workspace is an inline escaped surface, not a global modal", () => {
  const previous = {
    room: state.room,
    hostOperation: state.hostOperation,
    cloudHostPlayers: state.cloudHostPlayers,
    studio: state.studio,
    roomEventsConnected: state.roomEventsConnected
  };
  const fixture = fixtureState();
  state.room = { id: "room-1" };
  state.cloudHostPlayers = fixture.cloudHostPlayers;
  state.studio = fixture.studio;
  state.roomEventsConnected = true;
  state.hostOperation = createHostOperation({
    kind: HOST_OPERATION_KINDS.GRANT_CLUE,
    roomId: "room-1",
    stateRef: state,
    options: { clueId: "clue-1" }
  });
  try {
    const html = renderHostOperationWorkspace();
    assert.match(html, /data-host-operation-workspace/);
    assert.match(html, /data-action="host-operation-submit"/);
    assert.match(html, /SSE 已连接/);
    assert.match(html, /侦探&lt;script&gt;/);
    assert.match(html, /血迹&lt;svg&gt;/);
    assert.doesNotMatch(html, /<script>|<svg>|<img>|modal-backdrop|class="modal"/);
  } finally {
    Object.assign(state, previous);
  }
});

test("player detail loading can be closed while committed writes remain locked", () => {
  const previous = {
    room: state.room,
    hostOperation: state.hostOperation
  };
  state.room = { id: "room-1" };
  state.hostOperation = createHostOperation({
    kind: HOST_OPERATION_KINDS.PLAYER,
    roomId: "room-1",
    stateRef: state,
    options: { roleSlotId: "role-1" }
  });
  try {
    const loadingHtml = renderHostOperationWorkspace();
    assert.match(loadingHtml, /data-action="host-operation-close">返回监控台/);

    state.hostOperation.status = "submitting";
    const submittingHtml = renderHostOperationWorkspace();
    assert.match(submittingHtml, /data-action="host-operation-close" disabled>返回监控台/);
    assert.match(submittingHtml, /data-action="host-operation-switch"[^>]* disabled/);
  } finally {
    Object.assign(state, previous);
  }
});

test("Host text fields mirror backend schema length limits", () => {
  const previous = {
    room: state.room,
    hostOperation: state.hostOperation
  };
  state.room = { id: "room-1" };
  try {
    state.hostOperation = createHostOperation({
      kind: HOST_OPERATION_KINDS.LOG,
      roomId: "room-1",
      stateRef: state
    });
    assert.match(
      renderHostOperationWorkspace(),
      new RegExp(`maxlength="${HOST_OPERATION_LIMITS.HOST_LOG_LENGTH}"`)
    );

    state.hostOperation = createHostOperation({
      kind: HOST_OPERATION_KINDS.PLAYER,
      roomId: "room-1",
      stateRef: state,
      options: { roleSlotId: "role-1" }
    });
    state.hostOperation.status = "ready";
    state.hostOperation.detail = { role: {}, sections: [], clues: [] };
    assert.match(
      renderHostOperationWorkspace(),
      new RegExp(`maxlength="${HOST_OPERATION_LIMITS.PLAYER_NOTES_LENGTH}"`)
    );
  } finally {
    Object.assign(state, previous);
  }
});

test("Host command service blocks duplicate submits and distinguishes committed writes from refresh failure", async () => {
  const previous = {
    hostOperation: state.hostOperation,
    roomEventsConnected: state.roomEventsConnected
  };
  const fixture = fixtureState();
  state.roomEventsConnected = false;
  state.hostOperation = createHostOperation({
    kind: HOST_OPERATION_KINDS.LOG,
    roomId: "room-1",
    stateRef: fixture
  });
  state.hostOperation.draft.message = "记录一次现场调整";
  let requestCount = 0;
  let resolveRequest;
  const request = new Promise((resolve) => { resolveRequest = resolve; });
  const service = createHostOperationCommandService({
    render() {},
    showToast() {},
    reloadPlayer: async () => {},
    getRoom: () => "room-1",
    apiRef: {
      hostAddLog: async () => {
        requestCount += 1;
        return request;
      }
    },
    refreshRoom: async () => false,
    refreshMatrix: async () => true
  });
  try {
    service.submitCurrent();
    service.submitCurrent();
    assert.equal(requestCount, 1);
    assert.equal(state.hostOperation.status, "submitting");
    resolveRequest({ ok: true });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state.hostOperation.status, "success");
    assert.match(state.hostOperation.message, /写入已提交，但状态刷新失败/);
    assert.match(state.hostOperation.message, /请勿重复操作/);
  } finally {
    Object.assign(state, previous);
  }
});
