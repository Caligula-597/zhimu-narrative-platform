import assert from "node:assert/strict";
import test from "node:test";

import {
  compilePipelineMechanismPackage,
  ConfirmedMechanismDesignError,
} from "../src/pipeline-mechanism-package.js";
import { compileAndStorePipelineMechanismPackage } from "../src/world-mechanism-package-service.js";
import {
  executeMechanismDecision,
  initializeMechanismRuntime,
  projectMechanismRuntime,
  projectPlayerMechanismRuntime,
} from "../../shared/mechanism-runtime.js";

function completeDesign(overrides = {}) {
  return {
    version: 1,
    interactionKind: "resource_tradeoff",
    title: "潮窗分洪许可",
    summary: "玩家每轮分配闸门许可，在救援、供电与证据保全之间取舍。",
    recurringAction: "每轮选择一个区域并投入一份闸门许可",
    conflictReason: "救人、供电与保全证据不能同时完成",
    limitedResource: "三份开封许可",
    immediateFeedback: "未保护区域立即失去设施或证据",
    failureAdvance: "未达成共识时执行默认分洪并进入下一轮",
    genreSpecificity: "只适用于潮汐城的闸门代理制度",
    endingCausality: "前几轮保住的区域共同决定最终合闸路线",
    authorNotes: "主持人只结算玩家已确认的方案。",
    status: "confirmed",
    updatedAt: "2026-08-08T10:00:00.000Z",
    ...overrides,
  };
}

function pipelineFixture() {
  return {
    proposal: {
      chapters: [
        { key: "ch1", sequence: 1, title: "第一次潮窗", summary: "决定先保哪一区域。" },
        { key: "ch2", sequence: 2, title: "第二次潮窗", summary: "上一轮损失开始扩散。" },
        { key: "ch3", sequence: 3, title: "最终合闸", summary: "用剩余许可决定合闸路线。" },
      ],
    },
  };
}

test("draft mechanism design stays out of the canonical mechanism package", () => {
  const result = compilePipelineMechanismPackage(
    pipelineFixture(),
    completeDesign({ status: "draft" }),
  );
  assert.equal(result.reason, "design_draft");
  assert.equal(result.packageValue, null);
  assert.equal(result.design.status, "draft");
});

test("incomplete confirmed mechanism design fails with actionable fields", () => {
  assert.throws(
    () =>
      compilePipelineMechanismPackage(pipelineFixture(), {
        title: "只有名称",
        status: "confirmed",
      }),
    (error) => {
      assert.ok(error instanceof ConfirmedMechanismDesignError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.ok(error.details.fields.includes("summary"));
      assert.ok(error.details.fields.includes("recurringAction"));
      return true;
    },
  );
});

test("confirmed design deterministically creates host-executable and player-readable rounds", () => {
  const { packageValue, reason } = compilePipelineMechanismPackage(
    pipelineFixture(),
    completeDesign(),
  );
  assert.equal(reason, "confirmed_design");
  assert.equal(packageValue.source, "confirmed_mechanism_design");
  assert.equal(packageValue.authoring.designStatus, "confirmed");
  assert.equal(packageValue.rounds.length, 3);
  assert.equal(packageValue.decisionNodes.length, 3);
  assert.equal(
    packageValue.decisionNodes[0].interaction.resourceKey,
    "author-limited-resource",
  );
  assert.match(packageValue.rounds[0].hostNotes, /默认分洪/);
  assert.match(packageValue.rounds[0].playerAction, /投入一份闸门许可/);

  const initialized = initializeMechanismRuntime(packageValue).runtime;
  const host = projectMechanismRuntime(initialized, packageValue);
  const player = projectPlayerMechanismRuntime(initialized, packageValue, {
    revision: 1,
  });
  assert.equal(host.availableDecisions.length, 1);
  assert.match(host.availableDecisions[0].interaction.hostInstruction, /核对剩余资源/);
  assert.equal(player.decisions.length, 1);
  assert.match(player.decisions[0].question, /每轮选择一个区域/);
  assert.match(player.decisions[0].options[0].presentation.publicPreview, /失去设施或证据/);

  const resolved = executeMechanismDecision(initialized, packageValue, {
    decisionKey: host.availableDecisions[0].key,
    optionKey: host.availableDecisions[0].options[0].key,
  });
  assert.equal(resolved.runtime.states["author-mechanism-momentum"], 1);
  assert.equal(resolved.runtime.resources["author-limited-resource"], 2);
});

test("timed confirmed design carries a runnable deadline and default option", () => {
  const { packageValue } = compilePipelineMechanismPackage(
    pipelineFixture(),
    completeDesign({ interactionKind: "timed_crisis" }),
  );
  const decision = packageValue.decisionNodes[0];
  assert.equal(decision.interaction.deadlineSeconds, 300);
  assert.equal(decision.interaction.defaultOptionKey, decision.options[1].key);
});

test("Matrix automatic role clues compile into every settlement option", () => {
  const pipeline = {
    ...pipelineFixture(),
    characterArchives: {
      roles: [{ key: "role-captain", name: "队长" }],
    },
    infoMatrix: {
      clues: [
        { key: "clue-order", name: "密令残页", grantMode: "auto" },
        { key: "clue-manual", name: "封存口供", grantMode: "host_confirm" },
      ],
      rows: [{
        actKey: "ch1",
        roleKey: "role-captain",
        newClueIds: ["clue-order", "clue-manual", "clue-order"],
      }],
    },
  };
  const { packageValue } = compilePipelineMechanismPackage(
    pipeline,
    completeDesign(),
  );
  assert.equal(packageValue.roleDisclosureStates[0].roleKey, "role-captain");
  const decision = packageValue.decisionNodes.find(
    (entry) => entry.roundKey === "ch1",
  );
  assert.ok(decision);
  for (const option of decision.options) {
    const clueEffects = option.effects.filter(
      (effect) => effect.targetType === "clue",
    );
    assert.deepEqual(clueEffects, [{
      targetType: "clue",
      targetKey: "clue-order",
      operation: "grant",
      roleKey: "role-captain",
      consequence: "发放角色可见线索《密令残页》",
    }]);
  }
});

test("storing a draft removes an older canonical package", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (/SELECT settings FROM worlds/.test(sql)) {
        return { rows: [{ settings: { mechanismDesign: completeDesign({ status: "draft" }) } }] };
      }
      return { rows: [], rowCount: 0 };
    },
  };
  const result = await compileAndStorePipelineMechanismPackage(
    client,
    "world-1",
    pipelineFixture(),
  );
  assert.equal(result.reason, "design_draft");
  assert.equal(result.packageValue, null);
  assert.ok(calls.some((call) => /DELETE FROM world_mechanism_packages/.test(call.sql)));
});
