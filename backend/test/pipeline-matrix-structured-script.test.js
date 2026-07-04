import assert from "node:assert/strict";
import test from "node:test";
import {
  fillFeelingPack,
  stitchStructuredScript,
  stripPsychologyFromAction,
  scanActionLogPsychology,
  scanPersonaBleed,
  applyStructuredGates,
  validateActionLog
} from "../src/pipeline-matrix-structured-script.js";

test("fillFeelingPack uses matrix row fields", () => {
  const pack = fillFeelingPack({
    matrixRow: { suspicion: "时间线对不上", misbeliefs: "以为是意外" },
    characterArchive: { innerConflict: "怕被怀疑", actTasks: [] },
    actKey: "ch1"
  });
  assert.ok(pack.puzzles.some((p) => p.includes("时间线对不上")));
  assert.ok(pack.emotions.some((p) => p.includes("怕被怀疑")));
});

test("stripPsychologyFromAction removes inner monologue", () => {
  const out = stripPsychologyFromAction("20:05 你进入通讯室。你心里清楚，碰过旋转开关。20:10 你离开。");
  assert.ok(!out.includes("心里清楚"));
  assert.ok(out.includes("进入通讯室"));
});

test("scanPersonaBleed flags 补给员 markers in 气象员 body", () => {
  const archives = {
    roles: [
      { key: "role-1", name: "林海 · 补给员" },
      { key: "role-2", name: "苏晴 · 气象记录员" }
    ]
  };
  const r = scanPersonaBleed("下午四点送补给，林师傅你好。", "role-2", archives);
  assert.equal(r.passed, false);
});

test("stitchStructuredScript joins three channels", () => {
  const body = stitchStructuredScript({
    actionLog: { narrative: "20:05 你进入走廊。" },
    feelingsPack: { puzzles: ["[规定疑惑] 谁撕了日志？"], emotions: [] },
    dialogueLog: { narrative: "林海说：「你来了。」" }
  });
  assert.ok(body.includes("进入走廊"));
  assert.ok(body.includes("[规定疑惑]"));
  assert.ok(body.includes("林海说"));
});

test("applyStructuredGates passes clean action log", () => {
  const r = applyStructuredGates({
    actionLog: validateActionLog({ narrative: "20:05 你进入通讯室。20:10 你离开。" }),
    feelingsPack: { puzzles: [], emotions: [] },
    dialogueLog: { narrative: "苏晴说：「日志少了一页。」" },
    roleKey: "role-3",
    characterArchives: { roles: [{ key: "role-3", name: "陈默 · 电台检修工" }] },
    infoMatrix: { clues: [], rows: [{ roleKey: "role-3", actKey: "ch1", newClueIds: [] }] },
    matrixRow: { roleKey: "role-3", actKey: "ch1", newClueIds: [] },
    actKey: "ch1",
    config: { chapterKeys: ["ch1", "ch2", "ch3"] }
  });
  assert.equal(r.passed, true);
});
