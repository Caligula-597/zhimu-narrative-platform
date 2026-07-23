import assert from "node:assert/strict";
import test from "node:test";
import {
  projectRoomContentBinding,
  roomContentBindingPresentation,
  ROOM_BINDING_COMPATIBILITY,
  ROOM_RUNTIME_SOURCE
} from "../shared/room-content-binding.js";

const storageValues = new Map();
globalThis.localStorage = {
  getItem(key) { return storageValues.get(key) ?? null; },
  setItem(key, value) { storageValues.set(key, String(value)); },
  removeItem(key) { storageValues.delete(key); }
};

const [{ renderLanding: renderHostLanding }, { state: hostState }, { renderJoin }, { state: playState }] = await Promise.all([
  import("../host/src/views/landing.js"),
  import("../host/src/state.js"),
  import("../play/src/views/join.js"),
  import("../play/src/state.js")
]);

const releaseRow = {
  release_id: "11111111-2222-4333-8444-555555550099",
  release_number: 3,
  release_label: "内测三版",
  release_source_revision: 18,
  release_created_at: "2026-07-23T00:00:00.000Z",
  current_content_revision: 20
};

test("legacy rooms remain explicit live-draft rooms", () => {
  const binding = projectRoomContentBinding({ current_content_revision: 12 });
  assert.equal(binding.mode, "live_draft");
  assert.equal(binding.runtimeSource, "live_draft");
  assert.equal(binding.isFrozen, false);
  assert.equal(binding.compatibilityStatus, ROOM_BINDING_COMPATIBILITY.LEGACY_LIVE_DRAFT);
  assert.match(roomContentBindingPresentation(binding).label, /实时草稿/);
});

test("a release reference does not pretend the runtime is frozen", () => {
  const binding = projectRoomContentBinding(releaseRow);
  assert.equal(binding.mode, "release");
  assert.equal(binding.runtimeSource, "live_draft");
  assert.equal(binding.isFrozen, false);
  assert.equal(binding.hasNewerDraft, true);
  assert.equal(binding.compatibilityStatus, ROOM_BINDING_COMPATIBILITY.AWAITING_RELEASE_READER);
  assert.match(roomContentBindingPresentation(binding).label, /版本预绑定/);
});

test("revision zero remains a valid release baseline", () => {
  const binding = projectRoomContentBinding({
    release_id: "release-zero",
    release_number: 1,
    release_source_revision: 0,
    current_content_revision: 1
  });

  assert.equal(binding.release.sourceRevision, 0);
  assert.equal(binding.currentDraftRevision, 1);
  assert.equal(binding.hasNewerDraft, true);
});

test("the same contract can represent the future frozen reader without UI rewrites", () => {
  const binding = projectRoomContentBinding(releaseRow, {
    runtimeSource: ROOM_RUNTIME_SOURCE.RELEASE_SNAPSHOT
  });
  assert.equal(binding.isFrozen, true);
  assert.equal(binding.compatibilityStatus, ROOM_BINDING_COMPATIBILITY.FROZEN_RELEASE);
  assert.match(roomContentBindingPresentation(binding).label, /冻结运行/);
});

test("Host room selection renders the backend binding contract", () => {
  const previous = {
    worlds: hostState.worlds,
    rooms: hostState.rooms,
    studio: hostState.studio,
    landingStep: hostState.landingStep
  };
  hostState.worlds = [{ id: "world-1", name: "测试世界" }];
  localStorage.setItem("zhimuHostWorldId", "world-1");
  hostState.studio = { world: { name: "测试世界" } };
  hostState.landingStep = "rooms";
  hostState.rooms = [{
    id: "room-1",
    name: "周末场",
    invite_code: "ROOM-TEST",
    status: "testing",
    contentBinding: projectRoomContentBinding(releaseRow)
  }];
  try {
    const html = renderHostLanding();
    assert.match(html, /版本预绑定/);
    assert.match(html, /当前兼容层仍读取实时草稿/);
  } finally {
    localStorage.removeItem("zhimuHostWorldId");
    Object.assign(hostState, previous);
  }
});

test("Player join confirmation renders the same binding warning", () => {
  const previous = {
    joinPreview: playState.joinPreview,
    selectedRoleId: playState.selectedRoleId,
    inviteCode: playState.inviteCode,
    joinStep: playState.joinStep
  };
  playState.inviteCode = "ROOM-TEST";
  playState.joinStep = 2;
  playState.selectedRoleId = "role-1";
  playState.joinPreview = {
    room: {
      id: "room-1",
      name: "周末场",
      status: "testing",
      contentBinding: projectRoomContentBinding(releaseRow)
    },
    world: { id: "world-1", name: "测试世界" },
    current_role_slot_id: null,
    roles: [{ id: "role-1", name: "侦探", public_profile: "公开身份" }]
  };
  try {
    const html = renderJoin();
    assert.match(html, /版本预绑定/);
    assert.match(html, /当前兼容层仍读取实时草稿/);
  } finally {
    Object.assign(playState, previous);
  }
});
