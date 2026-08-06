import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeHostMechanismRuntime,
  mechanismValueLabel
} from "../src/runtime/host-mechanism-model.js";
import { submitHostMechanismAction } from "../src/runtime/host-mechanism-service.js";
import { state } from "../src/state.js";
import { renderHostMechanismWorkspace } from "../src/views/host-mechanism-workspace.js";

function payload() {
  return {
    initialized: true,
    stale: false,
    state: {
      revision: 4,
      status: "running",
      currentRoundKey: "round-2",
      currentRoundSequence: 2,
      currentVariantKey: "full-review",
      currentRound: { title: "复核授权" },
      states: { "state-auth": "contested" },
      resources: { "review-seat": 1 },
      evidence: { "evidence-log": "available" },
      availableDecisions: [{
        key: "decision-auth",
        question: "是否认可授权范围？",
        options: [{ key: "reject", choiceText: "拒绝认可" }]
      }],
      availableInvestigations: [{
        key: "investigate-log",
        action: "调取联盟日志",
        operation: "校验硬件签名",
        success: { artifactProduced: "签名报告" }
      }],
      reachability: {
        truncated: false,
        endingProspects: [{
          key: "ending-replay",
          title: "真人重赛",
          reachable: true,
          unmetRequirements: [{
            targetKey: "state-auth",
            operator: "equals",
            current: "contested",
            expected: "accepted"
          }]
        }]
      }
    },
    history: []
  };
}

test("mechanism workspace model keeps runtime decisions separate from display labels", () => {
  const model = normalizeHostMechanismRuntime(payload());
  assert.equal(model.revision, 4);
  assert.equal(model.roundTitle, "复核授权");
  assert.equal(model.canAdvance, false);
  assert.equal(model.states[0].label, "auth");
  assert.equal(mechanismValueLabel(["a", "b"]), "a、b");
});

test("mechanism action service submits the visible revision and ignores stale room responses", async () => {
  const stateRef = { cloudHostMechanismRuntime: payload(), hostMechanismError: "" };
  let roomId = "room-1";
  let sent = null;
  const response = { ...payload(), state: { ...payload().state, revision: 5, availableDecisions: [] } };
  const apiRef = {
    async executeHostMechanismAction(body) {
      sent = body;
      return response;
    }
  };
  const result = await submitHostMechanismAction({
    type: "decision",
    decisionKey: "decision-auth",
    optionKey: "reject"
  }, { apiRef, stateRef, getRoom: () => roomId });
  assert.equal(sent.expectedRevision, 4);
  assert.equal(result.state.revision, 5);
  assert.equal(stateRef.cloudHostMechanismRuntime.state.revision, 5);

  stateRef.cloudHostMechanismRuntime = payload();
  apiRef.executeHostMechanismAction = async () => {
    roomId = "room-2";
    return response;
  };
  assert.equal(await submitHostMechanismAction({ type: "advance" }, {
    apiRef,
    stateRef,
    getRoom: () => roomId
  }), null);
  assert.equal(stateRef.cloudHostMechanismRuntime.state.revision, 4);
});

test("mechanism workspace renders world-language actions and keeps internal effects behind the buttons", () => {
  const previous = state.cloudHostMechanismRuntime;
  const previousBusy = state.hostMechanismBusy;
  const previousError = state.hostMechanismError;
  state.cloudHostMechanismRuntime = payload();
  state.hostMechanismBusy = "";
  state.hostMechanismError = "";
  try {
    const html = renderHostMechanismWorkspace();
    assert.match(html, /是否认可授权范围/);
    assert.match(html, /拒绝认可/);
    assert.match(html, /调取联盟日志/);
    assert.match(html, /真人重赛/);
    assert.match(html, /仍可达/);
    assert.doesNotMatch(html, /setsValue|stateWrites/);
  } finally {
    state.cloudHostMechanismRuntime = previous;
    state.hostMechanismBusy = previousBusy;
    state.hostMechanismError = previousError;
  }
});
