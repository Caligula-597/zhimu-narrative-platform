import assert from "node:assert/strict";
import test from "node:test";
import { api } from "../src/api.js";
import {
  createHostVoiceActionHandler,
  resetHostVoiceOnLeave
} from "../src/runtime/host-voice-controller.js";
import { state } from "../src/state.js";

test("formal start requires a second deliberate click", async () => {
  const originalStart = api.startHostSession;
  let startCalls = 0;
  let renders = 0;
  const toasts = [];
  api.startHostSession = async () => {
    startCalls += 1;
    return { ok: true };
  };
  state.voiceSession = {
    voiceRoster: [
      { user_id: "host-1", member_type: "host", display_name: "主持人" },
      { user_id: "player-1", member_type: "player", display_name: "玩家" }
    ]
  };
  state.hostVoiceParticipants = [];
  state.hostVoiceStartConfirmUntil = 0;
  try {
    const handleAction = createHostVoiceActionHandler({
      render: () => { renders += 1; },
      showToast: (message) => toasts.push(message)
    });
    assert.equal(await handleAction("host-session-start"), true);
    assert.equal(startCalls, 0);
    assert.ok(state.hostVoiceStartConfirmUntil > Date.now());
    assert.match(toasts.at(-1), /再次点击确认/);
    assert.ok(renders > 0);
    assert.equal(await handleAction("host-session-start"), true);
    assert.equal(startCalls, 1);
    assert.equal(state.hostVoiceStartConfirmUntil, 0);
  } finally {
    api.startHostSession = originalStart;
    await resetHostVoiceOnLeave();
  }
});
