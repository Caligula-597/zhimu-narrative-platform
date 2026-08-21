import assert from "node:assert/strict";
import test from "node:test";

globalThis.localStorage = {
  getItem: () => null,
  setItem() {},
  removeItem() {}
};
const { renderModal } = await import("../src/components/modal.js");
const { state } = await import("../src/state.js");

test("private voice modal cannot create a room without another player", () => {
  const previous = {
    modal: state.modal,
    modalDraft: state.modalDraft,
    user: state.user,
    home: state.home,
    voiceInviteUserIds: state.voiceInviteUserIds,
    busy: state.busy
  };
  state.modal = { kind: "voice-create", title: "创建临时密谈" };
  state.modalDraft = "档案室密谈";
  state.user = { id: "current-user" };
  state.home = {
    role: { id: "current-role" },
    voiceRoster: [
      { user_id: "current-user", member_type: "player", role_slot_id: "current-role", role_name: "小满" },
      { user_id: "other-user", member_type: "player", role_slot_id: "other-role", role_name: "闻溪" }
    ]
  };
  state.voiceInviteUserIds = [];
  state.busy = false;
  try {
    const emptyHtml = renderModal();
    assert.match(emptyHtml, /不能创建只有自己的密谈/);
    assert.match(emptyHtml, /data-action="modal-create-voice" disabled/);

    state.voiceInviteUserIds = ["other-user"];
    const selectedHtml = renderModal();
    assert.match(selectedHtml, /已选择 1 名同伴/);
    assert.doesNotMatch(selectedHtml, /data-action="modal-create-voice" disabled/);
  } finally {
    Object.assign(state, previous);
  }
});
