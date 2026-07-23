import assert from "node:assert/strict";
import test from "node:test";
import { state } from "../src/state.js";
import {
  HOST_RULE_LIMITS,
  createHostRuleWorkspace,
  parseHostRuleDraft,
  updateHostRuleWorkspaceField
} from "../src/runtime/host-rule-workspace-model.js";
import { resolveHostWorldAccess } from "../src/runtime/host-rule-permissions.js";
import { createHostRuleListService } from "../src/runtime/host-rule-list-service.js";
import { createHostRuleWorkspaceService } from "../src/runtime/host-rule-workspace-service.js";
import { renderHostRuleWorkspace } from "../src/views/host-rule-workspace.js";
import { hostRuleManagerHeaderActions, hostRulesManager } from "../src/runtime/host-rules-controller.js";

function validRuleResult(workspace, overrides = {}) {
  const parsed = parseHostRuleDraft(workspace, { roomIds: [] });
  assert.equal(parsed.ok, true);
  return {
    id: "rule-1",
    world_id: "world-1",
    room_id: null,
    ...parsed.payload,
    roomId: undefined,
    metadata: parsed.payload.metadata,
    ...overrides
  };
}

test("rule draft parser enforces the Fastify schema boundary before network access", () => {
  const workspace = createHostRuleWorkspace({ worldId: "world-1" });
  workspace.draft.name = "";
  workspace.draft.priority = "100.5";
  workspace.draft.conditionsText = "[]";
  workspace.draft.actionsText = JSON.stringify(Array.from(
    { length: HOST_RULE_LIMITS.ACTIONS + 1 },
    () => ({ type: "timeline_log" })
  ));
  const result = parseHostRuleDraft(workspace, { roomIds: [] });
  assert.equal(result.ok, false);
  assert.match(result.errors.map((item) => item.message).join("\n"), /规则名称/);
  assert.match(result.errors.map((item) => item.message).join("\n"), /整数/);
  assert.match(result.errors.map((item) => item.message).join("\n"), /JSON 对象/);
  assert.match(result.errors.map((item) => item.message).join("\n"), /最多 50 个动作/);
});

test("rule draft keeps dirty state across rerenders and freezes an uncertain write", () => {
  const workspace = createHostRuleWorkspace({ worldId: "world-1" });
  updateHostRuleWorkspaceField(workspace, "name", "现场补救规则", false);
  assert.equal(workspace.dirty, true);
  const name = workspace.draft.name;
  workspace.status = "uncertain";
  updateHostRuleWorkspaceField(workspace, "name", "不应覆盖", false);
  assert.equal(workspace.draft.name, name);
});

test("rule workspace renders an escaped inline editor with reference assistance", () => {
  const previousStorage = globalThis.localStorage;
  const previous = {
    hostRuleWorkspace: state.hostRuleWorkspace,
    rooms: state.rooms,
    studio: state.studio
  };
  globalThis.localStorage = {
    getItem(key) { return key === "zhimuHostWorldId" ? "world-1" : ""; },
    setItem() {},
    removeItem() {}
  };
  state.rooms = [{ id: "room-1", name: "测试房<script>" }];
  state.studio = {
    roles: [{ id: "role-1", name: "侦探<img>" }],
    sections: [],
    scenes: [],
    clues: [],
    items: []
  };
  state.hostRuleWorkspace = createHostRuleWorkspace({ worldId: "world-1" });
  state.hostRuleWorkspace.draft.name = "规则<svg>";
  state.hostRuleWorkspace.draft.actionsText = `[{ "type": "timeline_log", "message": "</textarea><script>" }]`;
  try {
    const html = renderHostRuleWorkspace();
    assert.match(html, /data-host-rule-workspace/);
    assert.match(html, /data-action="host-rule-save"/);
    assert.match(html, /data-action="host-rule-copy-reference"/);
    assert.match(html, /测试房&lt;script&gt;/);
    assert.match(html, /侦探&lt;img&gt;/);
    assert.doesNotMatch(html, /<script>|<svg>|<img>|modal-backdrop|class="modal"/);
  } finally {
    Object.assign(state, previous);
    globalThis.localStorage = previousStorage;
  }
});

test("rule save blocks duplicate submits and reports a committed refresh failure", async () => {
  const previous = {
    hostRuleWorkspace: state.hostRuleWorkspace,
    hostRuleListBusy: state.hostRuleListBusy,
    rules: state.rules,
    rooms: state.rooms
  };
  state.rooms = [];
  state.rules = [];
  state.hostRuleWorkspace = createHostRuleWorkspace({ worldId: "world-1" });
  state.hostRuleWorkspace.draft.name = "现场规则";
  let validationCount = 0;
  let createCount = 0;
  let resolveValidation;
  const validation = new Promise((resolve) => { resolveValidation = resolve; });
  const service = createHostRuleWorkspaceService({
    render() {},
    showToast() {},
    getWorld: () => "world-1",
    canEdit: () => true,
    apiRef: {
      validateRuleBody: async () => {
        validationCount += 1;
        return validation;
      },
      createRule: async () => {
        createCount += 1;
        return validRuleResult(state.hostRuleWorkspace);
      },
      getRules: async () => {
        throw Object.assign(new Error("offline"), { code: "NETWORK_ERROR" });
      }
    }
  });
  try {
    const first = service.validateCurrent({ saveAfter: true });
    const duplicate = await service.validateCurrent({ saveAfter: true });
    assert.equal(duplicate, null);
    assert.equal(validationCount, 1);
    resolveValidation({ ok: true, errors: [] });
    await first;
    assert.equal(createCount, 1);
    assert.equal(state.hostRuleWorkspace.status, "success");
    assert.equal(state.hostRuleWorkspace.dirty, false);
    assert.match(state.hostRuleWorkspace.message, /写入已提交，但列表刷新失败/);
  } finally {
    Object.assign(state, previous);
  }
});

test("a lost create response reconciles by the workspace request id", async () => {
  const previous = {
    hostRuleWorkspace: state.hostRuleWorkspace,
    rules: state.rules,
    rooms: state.rooms
  };
  state.rooms = [];
  state.rules = [];
  state.hostRuleWorkspace = createHostRuleWorkspace({ worldId: "world-1" });
  state.hostRuleWorkspace.draft.name = "响应丢失规则";
  const saved = validRuleResult(state.hostRuleWorkspace);
  const service = createHostRuleWorkspaceService({
    render() {},
    showToast() {},
    getWorld: () => "world-1",
    canEdit: () => true,
    apiRef: {
      validateRuleBody: async () => ({ ok: true, errors: [] }),
      createRule: async () => {
        throw Object.assign(new Error("timeout"), { code: "REQUEST_TIMEOUT" });
      },
      getRules: async () => [saved]
    }
  });
  try {
    await service.validateCurrent({ saveAfter: true });
    assert.equal(state.hostRuleWorkspace.ruleId, "rule-1");
    assert.equal(state.hostRuleWorkspace.status, "success");
    assert.match(state.hostRuleWorkspace.message, /服务器列表确认/);
  } finally {
    Object.assign(state, previous);
  }
});

test("an unconfirmed create stays frozen until an explicit server reconciliation", async () => {
  const previous = {
    hostRuleWorkspace: state.hostRuleWorkspace,
    rules: state.rules,
    rooms: state.rooms
  };
  state.rooms = [];
  state.rules = [];
  state.hostRuleWorkspace = createHostRuleWorkspace({ worldId: "world-1" });
  state.hostRuleWorkspace.draft.name = "等待核对的规则";
  let createCount = 0;
  const service = createHostRuleWorkspaceService({
    render() {},
    showToast() {},
    getWorld: () => "world-1",
    canEdit: () => true,
    reconcileDelays: [0],
    apiRef: {
      validateRuleBody: async () => ({ ok: true, errors: [] }),
      createRule: async () => {
        createCount += 1;
        throw Object.assign(new Error("timeout"), { code: "REQUEST_TIMEOUT" });
      },
      getRules: async () => []
    }
  });
  try {
    await service.validateCurrent({ saveAfter: true });
    assert.equal(createCount, 1);
    assert.equal(state.hostRuleWorkspace.status, "uncertain");
    assert.match(state.hostRuleWorkspace.message, /请勿立即重试/);
    await service.validateCurrent({ saveAfter: true });
    assert.equal(createCount, 1);
    await service.reconcileCurrent();
    assert.equal(state.hostRuleWorkspace.status, "error");
    assert.match(state.hostRuleWorkspace.message, /可以重新保存/);
  } finally {
    Object.assign(state, previous);
  }
});

test("rule management becomes read-only for host and reviewer memberships", () => {
  const previousStorage = globalThis.localStorage;
  const previous = {
    worlds: state.worlds,
    studio: state.studio,
    rules: state.rules,
    room: state.room,
    hostRuleWorkspace: state.hostRuleWorkspace,
    hostRuleListBusy: state.hostRuleListBusy,
    hostRuleListMessage: state.hostRuleListMessage,
    hostRuleAudit: state.hostRuleAudit
  };
  globalThis.localStorage = {
    getItem(key) { return key === "zhimuHostWorldId" ? "world-1" : ""; },
    setItem() {},
    removeItem() {}
  };
  state.worlds = [{
    id: "world-1",
    membership_role: "host",
    membership_label: "主持人",
    can_edit_content: false
  }];
  state.studio = { world: { id: "world-1", membership_role: "host" } };
  state.rules = [{
    id: "rule-1",
    name: "只读规则",
    mode: "manual",
    enabled: true,
    priority: 100,
    conditions: {},
    actions: []
  }];
  state.room = { id: "room-1" };
  state.hostRuleWorkspace = null;
  state.hostRuleListBusy = "";
  state.hostRuleListMessage = "";
  state.hostRuleAudit = null;
  try {
    assert.deepEqual(resolveHostWorldAccess(), {
      role: "host",
      label: "主持人",
      canEditRules: false
    });
    assert.doesNotMatch(hostRuleManagerHeaderActions(), /host-rule-new|host-rule-validate/);
    const html = hostRulesManager();
    assert.match(html, /主持人 · 只读/);
    assert.doesNotMatch(html, /host-rule-edit|host-rule-toggle|host-rule-delete-request/);
  } finally {
    Object.assign(state, previous);
    globalThis.localStorage = previousStorage;
  }
});

test("rule list write guard prevents hidden or forged host actions from reaching the API", async () => {
  const previous = {
    rules: state.rules,
    hostRuleListBusy: state.hostRuleListBusy,
    hostRuleListMessage: state.hostRuleListMessage
  };
  state.rules = [{
    id: "rule-1",
    name: "不可修改",
    mode: "manual",
    enabled: true,
    priority: 100,
    conditions: {},
    actions: []
  }];
  state.hostRuleListBusy = "";
  state.hostRuleListMessage = "";
  let updateCount = 0;
  const service = createHostRuleListService({
    render() {},
    showToast() {},
    getWorld: () => "world-1",
    canEdit: () => false,
    apiRef: {
      updateRule: async () => { updateCount += 1; }
    }
  });
  try {
    const result = await service.toggleRule("rule-1");
    assert.equal(result, null);
    assert.equal(updateCount, 0);
    assert.match(state.hostRuleListMessage, /只能查看和运行规则/);
  } finally {
    Object.assign(state, previous);
  }
});

test("rule list commands reconcile lost toggle and delete responses", async () => {
  const previous = {
    rules: state.rules,
    hostRuleListBusy: state.hostRuleListBusy,
    hostRuleListMessage: state.hostRuleListMessage,
    hostRuleDeleteConfirmId: state.hostRuleDeleteConfirmId
  };
  const baseRule = {
    id: "rule-1",
    room_id: null,
    name: "可核对规则",
    mode: "manual",
    enabled: true,
    priority: 100,
    conditions: {},
    actions: [],
    metadata: {}
  };
  state.rules = [baseRule];
  state.hostRuleListBusy = "";
  state.hostRuleListMessage = "";
  state.hostRuleDeleteConfirmId = "rule-1";
  let readCount = 0;
  const service = createHostRuleListService({
    render() {},
    showToast() {},
    getWorld: () => "world-1",
    canEdit: () => true,
    apiRef: {
      updateRule: async () => {
        throw Object.assign(new Error("timeout"), { code: "REQUEST_TIMEOUT" });
      },
      deleteRule: async () => {
        throw Object.assign(new Error("timeout"), { code: "REQUEST_TIMEOUT" });
      },
      getRules: async () => {
        readCount += 1;
        return readCount === 1 ? [{ ...baseRule, enabled: false }] : [];
      }
    }
  });
  try {
    const toggled = await service.toggleRule("rule-1");
    assert.equal(toggled?.enabled, false);
    assert.match(state.hostRuleListMessage, /服务器列表确认/);
    state.rules = [baseRule];
    const deleted = await service.deleteRule("rule-1");
    assert.equal(deleted, true);
    assert.equal(state.hostRuleDeleteConfirmId, "");
    assert.match(state.hostRuleListMessage, /删除已由服务器列表确认/);
  } finally {
    Object.assign(state, previous);
  }
});
