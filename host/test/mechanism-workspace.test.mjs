import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeHostMechanismRuntime,
  mechanismValueLabel,
} from "../src/runtime/host-mechanism-model.js";
import { submitHostMechanismAction } from "../src/runtime/host-mechanism-service.js";
import { state } from "../src/state.js";
import {
  mechanismDeadlineStatus,
  renderHostMechanismWorkspace,
} from "../src/views/host-mechanism-workspace.js";

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
      availableDecisions: [
        {
          key: "decision-auth",
          question: "是否认可授权范围？",
          interaction: {
            kind: "resource_tradeoff",
            resourceKey: "review-seat",
            hostInstruction: "核对复核席位后再确认方案。",
          },
          options: [
            {
              key: "reject",
              choiceText: "拒绝认可",
              presentation: {
                costLabel: "消耗最后一个席位",
                riskLabel: "冠军资格暂缓",
              },
            },
          ],
        },
      ],
      availableInvestigations: [
        {
          key: "investigate-log",
          action: "调取联盟日志",
          operation: "校验硬件签名",
          success: { artifactProduced: "签名报告" },
        },
      ],
      reachability: {
        truncated: false,
        endingProspects: [
          {
            key: "ending-replay",
            title: "真人重赛",
            reachable: true,
            unmetRequirements: [
              {
                targetKey: "state-auth",
                operator: "equals",
                current: "contested",
                expected: "accepted",
              },
            ],
          },
        ],
      },
    },
    submissionSummary: [
      {
        decisionKey: "decision-auth",
        total: 2,
        options: [{ optionKey: "reject", count: 2 }],
        roles: [
          { roleSlotId: "role-1", roleName: "小满", optionKey: "reject" },
          { roleSlotId: "role-2", roleName: "Nox", optionKey: "reject" },
        ],
      },
    ],
    contentGrants: [{
      clueId: "clue-order-id",
      clueName: "密令残页",
      roleSlotId: "role-1",
      roleName: "小满",
      status: "granted",
    }],
    changes: [{
      targetType: "clue",
      targetKey: "internal-clue-effect-key",
      before: null,
      after: "granted",
    }],
    history: [],
  };
}

test("mechanism workspace model keeps runtime decisions separate from display labels", () => {
  const model = normalizeHostMechanismRuntime(payload());
  assert.equal(model.revision, 4);
  assert.equal(model.roundTitle, "复核授权");
  assert.equal(model.canAdvance, false);
  assert.equal(model.states[0].label, "auth");
  assert.equal(model.contentGrants[0].clueName, "密令残页");
  assert.equal(mechanismValueLabel(["a", "b"]), "a、b");
});

test("mechanism action service submits the visible revision and ignores stale room responses", async () => {
  const stateRef = {
    cloudHostMechanismRuntime: payload(),
    hostMechanismError: "",
  };
  let roomId = "room-1";
  let sent = null;
  const response = {
    ...payload(),
    state: { ...payload().state, revision: 5, availableDecisions: [] },
  };
  const apiRef = {
    async executeHostMechanismAction(body) {
      sent = body;
      return response;
    },
  };
  const result = await submitHostMechanismAction(
    {
      type: "decision",
      decisionKey: "decision-auth",
      optionKey: "reject",
    },
    { apiRef, stateRef, getRoom: () => roomId },
  );
  assert.equal(sent.expectedRevision, 4);
  assert.equal(result.state.revision, 5);
  assert.equal(stateRef.cloudHostMechanismRuntime.state.revision, 5);

  stateRef.cloudHostMechanismRuntime = payload();
  apiRef.executeHostMechanismAction = async () => {
    roomId = "room-2";
    return response;
  };
  assert.equal(
    await submitHostMechanismAction(
      { type: "advance" },
      {
        apiRef,
        stateRef,
        getRoom: () => roomId,
      },
    ),
    null,
  );
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
    assert.match(html, /资源取舍/);
    assert.match(html, /核对复核席位后再确认方案/);
    assert.match(html, /消耗最后一个席位/);
    assert.match(html, /复核席位/);
    assert.match(html, /玩家倾向 2/);
    assert.match(html, /小满、Nox/);
    assert.match(html, /倾向仅供参考/);
    assert.match(html, /调取联盟日志/);
    assert.match(html, /真人重赛/);
    assert.match(html, /仍可达/);
    assert.match(html, /线索发放/);
    assert.match(html, /密令残页/);
    assert.match(html, /小满 · 已发放/);
    assert.doesNotMatch(html, /internal clue effect key/);
    assert.doesNotMatch(html, /setsValue|stateWrites/);
  } finally {
    state.cloudHostMechanismRuntime = previous;
    state.hostMechanismBusy = previousBusy;
    state.hostMechanismError = previousError;
  }
});

test("completed mechanism workspace displays the authoritative ending title", () => {
  const runtimePayload = payload();
  runtimePayload.state.status = "completed";
  runtimePayload.state.availableDecisions = [];
  runtimePayload.state.availableInvestigations = [];
  runtimePayload.state.ending = {
    resolvedRouteKey: "appeal-route",
    matchedRouteKeys: ["appeal-route"],
    title: "联盟申诉裁定",
    summary: "授权越权已被确认。",
  };
  const previous = state.cloudHostMechanismRuntime;
  state.cloudHostMechanismRuntime = runtimePayload;
  try {
    const html = renderHostMechanismWorkspace();
    assert.match(html, /联盟申诉裁定/);
    assert.doesNotMatch(html, /<strong>appeal route<\/strong>/);
  } finally {
    state.cloudHostMechanismRuntime = previous;
  }
});

test("host deadline uses the persisted round clock and only exposes the authored default after expiry", () => {
  assert.equal(mechanismDeadlineStatus(null, 60), null);
  const before = mechanismDeadlineStatus(
    "2026-08-06T09:59:00.000Z",
    60,
    new Date("2026-08-06T09:59:30.000Z").getTime(),
  );
  assert.equal(before.expired, false);
  assert.equal(before.remainingSeconds, 30);

  const runtimePayload = payload();
  runtimePayload.state.roundStartedAt = "2000-01-01T00:00:00.000Z";
  runtimePayload.state.availableDecisions[0].interaction = {
    kind: "timed_crisis",
    deadlineSeconds: 60,
    defaultOptionKey: "reject",
    hostInstruction: "在服务器截止时间后按预设后果结算。",
  };
  const previous = state.cloudHostMechanismRuntime;
  state.cloudHostMechanismRuntime = runtimePayload;
  try {
    const html = renderHostMechanismWorkspace();
    assert.match(html, /已到期/);
    assert.match(html, /超时默认：拒绝认可/);
    assert.match(html, /host-mechanism-deadline-default/);
    assert.match(html, /data-action="host-mechanism-decision"[^>]+disabled/);
  } finally {
    state.cloudHostMechanismRuntime = previous;
  }
});

test("host sees private role commitments without presenting them as public table preference", () => {
  const runtimePayload = payload();
  runtimePayload.state.availableDecisions[0].interaction = {
    kind: "role_commitment",
    hostInstruction: "逐人核对承诺，不向其他玩家公开。",
  };
  const previous = state.cloudHostMechanismRuntime;
  state.cloudHostMechanismRuntime = runtimePayload;
  try {
    const html = renderHostMechanismWorkspace();
    assert.match(html, /2 份秘密承诺/);
    assert.match(html, /仅主持人可见承诺人与内容/);
    assert.doesNotMatch(html, /倾向仅供参考/);
  } finally {
    state.cloudHostMechanismRuntime = previous;
  }
});

test("host renders private aggregates and only enables a unique majority settlement", () => {
  const runtimePayload = payload();
  runtimePayload.state.availableDecisions[0].interaction = {
    kind: "free_ranking",
    hostInstruction: "按全桌排序积分核对。",
  };
  runtimePayload.state.availableDecisions[0].options.push({
    key: "accept",
    choiceText: "认可授权",
    presentation: {},
  });
  runtimePayload.submissionSummary = [
    {
      decisionKey: "decision-auth",
      inputMode: "ranking",
      total: 2,
      options: [
        { optionKey: "reject", score: 4, firstPlaceCount: 2 },
        { optionKey: "accept", score: 2, firstPlaceCount: 0 },
      ],
      roles: [
        {
          roleName: "小满",
          optionKey: "reject",
          answer: { type: "ranking", optionKeys: ["reject", "accept"] },
        },
      ],
      majority: {
        status: "ready",
        optionKey: "reject",
        metric: "score",
        value: 4,
      },
    },
  ];
  const previous = state.cloudHostMechanismRuntime;
  state.cloudHostMechanismRuntime = runtimePayload;
  try {
    const html = renderHostMechanismWorkspace();
    assert.match(html, /排序积分 4/);
    assert.match(html, /小满/);
    assert.match(html, /拒绝认可 ＞ 认可授权/);
    assert.match(html, /当前唯一领先：拒绝认可/);
    assert.match(html, /data-action="host-mechanism-majority"/);
    assert.doesNotMatch(
      html,
      /data-action="host-mechanism-majority"[^>]+disabled/,
    );

    runtimePayload.submissionSummary[0].majority = {
      status: "tie",
      optionKey: "",
      metric: "score",
      value: 3,
    };
    const tiedHtml = renderHostMechanismWorkspace();
    assert.match(tiedHtml, /当前聚合结果平票/);
    assert.match(
      tiedHtml,
      /data-action="host-mechanism-majority"[^>]+disabled/,
    );
  } finally {
    state.cloudHostMechanismRuntime = previous;
  }
});
