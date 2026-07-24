import assert from "node:assert/strict";
import test from "node:test";
import {
  getHostConsoleNavigationBlockReason,
  handleHostConsoleAction,
  handleHostConsoleField,
  renderHostConsoleBoundary
} from "../src/runtime/host-console-loader.js";
import { createHostArchiveWorkspace, updateHostArchiveField } from "../src/runtime/host-archive-model.js";
import { hostConsoleNavigationBlockReason } from "../src/runtime/host-console-runtime.js";

test("the unloaded Host console renders a stable fallback without swallowing actions", async () => {
  const html = renderHostConsoleBoundary();
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /正在载入主持监控台/);
  assert.equal(await handleHostConsoleAction("create-checkpoint", null), false);
  assert.doesNotThrow(() => handleHostConsoleField(null));
  assert.equal(getHostConsoleNavigationBlockReason(), "");
});

test("Host console navigation blocks unresolved writes and dirty archive drafts", () => {
  const stateRef = {
    hostOperation: { status: "submitting" },
    hostArchiveWorkspace: null,
    hostRuleWorkspace: null
  };
  assert.match(hostConsoleNavigationBlockReason(stateRef), /现场命令仍在提交/);

  stateRef.hostOperation = null;
  stateRef.hostArchiveWorkspace = createHostArchiveWorkspace({
    room: { id: "room-1", name: "第一房" }
  });
  updateHostArchiveField(stateRef.hostArchiveWorkspace, "title", "第一夜");
  assert.match(hostConsoleNavigationBlockReason(stateRef), /归档存在未提交/);

  stateRef.hostArchiveWorkspace = null;
  stateRef.hostRuleWorkspace = { status: "uncertain", dirty: false };
  assert.match(hostConsoleNavigationBlockReason(stateRef), /规则存在未保存或待核对/);
});
