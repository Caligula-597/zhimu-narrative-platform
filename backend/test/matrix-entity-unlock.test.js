import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEntityUnlockSchedule,
  substituteEarlyEntityAliases,
  scanDialogueEntities,
  isEntityTokenUnlocked
} from "../src/prompts/matrix-entity-unlock.js";
import { buildProposalFromMatrix } from "../src/pipeline-matrix-model.js";

const config = { chapterKeys: ["ch1", "ch2", "ch3"] };
const infoMatrix = {
  clues: [
    { key: "clue-1", name: "反锁的灯室门", actKey: "ch1", grantMode: "auto", source: "Environment" },
    { key: "clue-3", name: "多余钥匙胚", actKey: "ch2", grantMode: "auto", source: "Environment", description: "钥匙胚" },
    { key: "clue-5", name: "检修暗格", actKey: "ch3", grantMode: "auto", source: "Environment" }
  ],
  scenes: [
    { key: "scene-1", name: "灯室", actKey: "ch1", clueIds: ["clue-1"] },
    { key: "scene-2", name: "仓库", actKey: "ch2", clueIds: ["clue-3"] }
  ],
  publicEnvironmentByAct: { ch1: "暴雨夜大厅", ch2: "灯室调查" },
  actTitles: { ch1: "失联", ch2: "密室", ch3: "真相" }
};

test("buildEntityUnlockSchedule orders by act", () => {
  const schedule = buildEntityUnlockSchedule(infoMatrix, config);
  const keyBlank = schedule.find((e) => e.token === "钥匙胚");
  const hatch = schedule.find((e) => e.token.includes("暗格"));
  assert.ok(keyBlank);
  assert.equal(keyBlank.unlockActKey, "ch2");
  assert.ok(hatch);
  assert.equal(hatch.unlockActKey, "ch3");
});

test("buildEntityUnlockSchedule never injects registry tokens absent from current clues", () => {
  const schedule = buildEntityUnlockSchedule(
    { clues: [{ key: "clue-current", name: "闸门压力曲线", description: "压力曲线", actKey: "ch1" }] },
    config
  );
  assert.ok(schedule.some((entry) => entry.token.includes("闸门压力")));
  assert.ok(!schedule.some((entry) => entry.token === "钥匙胚"));
  assert.ok(!schedule.some((entry) => entry.token === "暗格"));
});

test("substituteEarlyEntityAliases replaces before unlock act", () => {
  const schedule = buildEntityUnlockSchedule(infoMatrix, config);
  const out = substituteEarlyEntityAliases("他说暗格有问题", "ch2", config, schedule);
  assert.ok(!out.includes("暗格"));
  assert.ok(out.includes("底板") || out.includes("检修"));
});

test("scanDialogueEntities respects unlock schedule", () => {
  const schedule = buildEntityUnlockSchedule(infoMatrix, config);
  assert.equal(isEntityTokenUnlocked("暗格", "ch3", config, schedule), true);
  const fail = scanDialogueEntities("提到暗格", [], { actKey: "ch2", config, schedule, channel: "dialogue" });
  assert.equal(fail.passed, false);
  const pass = scanDialogueEntities("提到暗格", [], { actKey: "ch3", config, schedule, channel: "dialogue" });
  assert.equal(pass.passed, true);
});

test("buildProposalFromMatrix links scenes clues and sequential edges", () => {
  const proposal = buildProposalFromMatrix({
    setting: { theme: "测试", matrixMode: "honkaku" },
    config,
    truthBible: { summary: "x".repeat(220), killer: "role-3", method: "m" },
    infoMatrix
  });
  assert.equal(proposal.scenes.length, 2);
  assert.ok(proposal.clues.every((c) => c.metadata.actKey));
  assert.ok(proposal.matrixSync.entityUnlockSchedule.length >= 2);
  assert.ok(proposal.edges.some((e) => e.fromType === "clue" && e.toType === "clue"));
});
