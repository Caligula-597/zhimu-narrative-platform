import assert from "node:assert/strict";
import test from "node:test";
import { state } from "../src/state.js";
import {
  HOST_VOTE_LIMITS,
  createHostVoteWorkspace,
  parseHostVoteDraft,
  updateHostVoteDraft
} from "../src/runtime/host-vote-workspace-model.js";
import { createHostVoteWorkspaceService } from "../src/runtime/host-vote-workspace-service.js";
import { renderHostVoteWorkspace } from "../src/views/host-vote-workspace.js";

function preserveState() {
  return {
    hostVoteWorkspace: state.hostVoteWorkspace,
    cloudHostVotes: state.cloudHostVotes,
    cloudHostPlayers: state.cloudHostPlayers,
    room: state.room
  };
}

test("vote draft mirrors Fastify title, prompt, type and visibility boundaries", () => {
  const workspace = createHostVoteWorkspace("room-1");
  updateHostVoteDraft(workspace, "title", "");
  assert.equal(parseHostVoteDraft(workspace).ok, false);
  updateHostVoteDraft(workspace, "title", "a".repeat(HOST_VOTE_LIMITS.TITLE_MAX + 1));
  assert.equal(parseHostVoteDraft(workspace).ok, false);
  updateHostVoteDraft(workspace, "title", "第二幕指认");
  updateHostVoteDraft(workspace, "prompt", "b".repeat(HOST_VOTE_LIMITS.PROMPT_MAX + 1));
  assert.equal(parseHostVoteDraft(workspace).ok, false);
  updateHostVoteDraft(workspace, "prompt", "请选择一名角色");
  updateHostVoteDraft(workspace, "voteType", "invalid");
  assert.equal(parseHostVoteDraft(workspace).ok, false);
  updateHostVoteDraft(workspace, "voteType", "accusation");
  updateHostVoteDraft(workspace, "visibility", "secret_until_published");
  const parsed = parseHostVoteDraft(workspace);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.payload.settings.hostRequestId, workspace.requestId);

  updateHostVoteDraft(workspace, "voteType", "choice");
  assert.equal(parseHostVoteDraft(workspace).ok, false);
  updateHostVoteDraft(workspace, "optionsText", "继续调查\n公开线索");
  assert.deepEqual(parseHostVoteDraft(workspace).payload.options, [
    { label: "继续调查", sequence: 1 },
    { label: "公开线索", sequence: 2 }
  ]);
  updateHostVoteDraft(workspace, "optionsText", "继续调查\n继续调查");
  assert.match(parseHostVoteDraft(workspace).errors[0].message, /不能重名/);

  updateHostVoteDraft(workspace, "voteType", "rating");
  updateHostVoteDraft(workspace, "optionsText", "");
  assert.equal(parseHostVoteDraft(workspace).payload.options.length, 5);
});

test("vote workspace renders escaped inline fields without a modal or prompt", () => {
  const previousStorage = globalThis.localStorage;
  const previous = preserveState();
  globalThis.localStorage = {
    getItem(key) {
      if (key === "zhimuHostWorldId") return "world-1";
      if (key === "zhimuHostRoomId:world-1") return "room-1";
      return "";
    },
    setItem() {},
    removeItem() {}
  };
  state.room = { name: "现场房<script>" };
  state.cloudHostPlayers = [{ role_slot_id: "role-1" }];
  state.hostVoteWorkspace = createHostVoteWorkspace("room-1");
  state.hostVoteWorkspace.title = '指认<img src=x onerror="1">';
  state.hostVoteWorkspace.prompt = "</textarea><script>alert(1)</script>";
  try {
    const html = renderHostVoteWorkspace();
    assert.match(html, /data-host-vote-workspace/);
    assert.match(html, /data-action="host-vote-workspace-submit"/);
    assert.match(html, /现场房&lt;script&gt;/);
    assert.match(html, /指认&lt;img/);
    assert.doesNotMatch(html, /modal-backdrop|class="modal"|window\.prompt|<script>|<img/);
  } finally {
    Object.assign(state, previous);
    globalThis.localStorage = previousStorage;
  }
});

test("vote create locks duplicates and binds room plus an explicit idempotency key", async () => {
  const previous = preserveState();
  state.cloudHostVotes = [];
  state.hostVoteWorkspace = createHostVoteWorkspace("room-1");
  state.hostVoteWorkspace.title = "第二幕指认";
  let resolveWrite;
  const pending = new Promise((resolve) => { resolveWrite = resolve; });
  const calls = [];
  const service = createHostVoteWorkspaceService({
    render() {},
    showToast() {},
    getRoom: () => "room-1",
    refreshRoom: async () => true,
    apiRef: {
      hostCreateVote: async (payload, roomId, key) => {
        calls.push({ payload, roomId, key });
        return pending;
      }
    }
  });
  try {
    const first = service.submit();
    assert.equal(await service.submit(), null);
    assert.equal(calls.length, 1);
    resolveWrite({ vote: { id: "vote-1", title: "第二幕指认" } });
    await first;
    assert.equal(calls[0].roomId, "room-1");
    assert.match(calls[0].key, /^host-vote-create-/);
    assert.equal(state.hostVoteWorkspace.status, "success");
    assert.equal(state.cloudHostVotes[0].id, "vote-1");
  } finally {
    Object.assign(state, previous);
  }
});

test("an uncertain vote create reuses its original key and keeps a committed write successful", async () => {
  const previous = preserveState();
  state.cloudHostVotes = [];
  state.hostVoteWorkspace = createHostVoteWorkspace("room-1");
  state.hostVoteWorkspace.title = "失联测试";
  const keys = [];
  let attempt = 0;
  const service = createHostVoteWorkspaceService({
    render() {},
    showToast() {},
    getRoom: () => "room-1",
    refreshRoom: async () => false,
    apiRef: {
      hostCreateVote: async (_payload, _roomId, key) => {
        keys.push(key);
        attempt += 1;
        if (attempt === 1) throw Object.assign(new Error("offline"), { code: "NETWORK_ERROR" });
        return { vote: { id: "vote-2", title: "失联测试" } };
      }
    }
  });
  try {
    await service.submit();
    assert.equal(state.hostVoteWorkspace.status, "uncertain");
    await service.reconcile();
    assert.equal(state.hostVoteWorkspace.status, "success");
    assert.deepEqual(keys, [keys[0], keys[0]]);
    assert.match(state.hostVoteWorkspace.message, /服务端已确认创建/);
  } finally {
    Object.assign(state, previous);
  }
});
