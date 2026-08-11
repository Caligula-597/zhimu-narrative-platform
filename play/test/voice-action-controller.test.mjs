import assert from "node:assert/strict";
import test from "node:test";
import { handlePlayVoiceAction } from "../src/runtime/voice-action-controller.js";

function dependencies(overrides = {}) {
  const calls = [];
  const record = (name) => async (...args) => calls.push([name, ...args]);
  return {
    calls,
    options: {
      action: "unknown",
      button: { dataset: {} },
      render() {},
      setBusy() {},
      setToast: record("toast"),
      formatApiError: (_error, fallback) => fallback,
      privateVoiceRoomsEnabled: () => true,
      openVoiceRoomPicker: record("picker"),
      openCreateVoiceRoomModal: record("create-modal"),
      openInviteVoiceRoomModal: record("invite-modal"),
      joinVoiceRoom: record("join"),
      connectVoiceLive: record("connect"),
      disconnectVoiceLive: record("disconnect"),
      toggleVoiceMicLive: record("mic"),
      unlockVoicePlayback: record("playback"),
      refreshVoiceMessages: record("refresh"),
      sendVoiceChatMessage: record("send"),
      submitCreateVoiceRoom: record("create"),
      submitVoiceInvite: record("invite"),
      ...overrides
    }
  };
}

test("voice join forwards room identity", async () => {
  const { calls, options } = dependencies({
    action: "voice-join",
    button: { dataset: { voiceId: "voice-1", voiceName: "密谈" } }
  });
  assert.equal(await handlePlayVoiceAction(options), true);
  assert.equal(calls[0][0], "join");
  assert.equal(calls[0][1], "voice-1");
  assert.equal(calls[0][2], "密谈");
});

test("voice refresh converts failures to a user toast", async () => {
  const { calls, options } = dependencies({
    action: "voice-chat-refresh",
    refreshVoiceMessages: async () => { throw new Error("network"); }
  });
  assert.equal(await handlePlayVoiceAction(options), true);
  assert.deepEqual(calls[0].slice(0, 2), ["toast", "刷新失败"]);
});

test("voice room creation stays blocked before the host starts the session", async () => {
  const { calls, options } = dependencies({
    action: "voice-room-create",
    privateVoiceRoomsEnabled: () => false
  });
  assert.equal(await handlePlayVoiceAction(options), true);
  assert.equal(calls[0][0], "toast");
  assert.match(calls[0][1], /正式开场/);
  assert.equal(calls.some(([name]) => name === "create-modal"), false);
});

test("unknown voice action is left for the next dispatcher", async () => {
  const { calls, options } = dependencies();
  assert.equal(await handlePlayVoiceAction(options), false);
  assert.deepEqual(calls, []);
});
