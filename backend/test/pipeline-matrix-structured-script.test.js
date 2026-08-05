import assert from "node:assert/strict";
import test from "node:test";
import {
  fillFeelingPack,
  sanitizeMatrixRowForStructured,
  sanitizeFeelingsPack,
  scanActionCrimeTokens,
  stripCrimeTokensFromAction,
  stitchStructuredScript,
  stripPsychologyFromAction,
  stripSpoilerLeakFromNarrative,
  scanSpoilerLeakInNarrative,
  scanInnocentFalseConfession,
  scanPersonaBleed,
  applyStructuredGates,
  validateActionLog
} from "../src/pipeline-matrix-structured-script.js";

test("fillFeelingPack uses matrix row fields for innocent role", () => {
  const pack = fillFeelingPack({
    matrixRow: { suspicion: "时间线对不上", misbeliefs: "以为是意外" },
    characterArchive: { innerConflict: "怕被怀疑", actTasks: [] },
    actKey: "ch1",
    isKiller: false,
    actIndex: 0,
    finalActIndex: 2
  });
  assert.ok(pack.puzzles.some((p) => p.includes("时间线对不上")));
  assert.ok(pack.emotions.some((p) => p.includes("怕被怀疑")));
});

test("fillFeelingPack killer ch1/ch2 self-aware uses conceal emotion", () => {
  const pack = fillFeelingPack({
    matrixRow: { suspicion: "谁改了表", misbeliefs: "可能是意外" },
    characterArchive: {
      innerConflict: "复仇后的空虚与恐惧，但表面保持冷静",
      actTasks: [{ actKey: "ch2", tips: "【提示】注意销毁证据" }]
    },
    actKey: "ch2",
    isKiller: true,
    actIndex: 1,
    finalActIndex: 2,
    killerAwareness: "self-aware"
  });
  assert.ok(!pack.emotions.some((e) => /复仇|销毁|恐惧/.test(e)));
  assert.ok(pack.emotions.some((e) => e.includes("凶手")));
});

test("fillFeelingPack killer self-unaware uses innocent emotions", () => {
  const pack = fillFeelingPack({
    matrixRow: { suspicion: "谁改了表", misbeliefs: "可能是意外" },
    characterArchive: { innerConflict: "怕被怀疑", actTasks: [{ actKey: "ch1", tips: "【提示】观察众人" }] },
    actKey: "ch1",
    isKiller: true,
    actIndex: 0,
    finalActIndex: 2,
    killerAwareness: "self-unaware"
  });
  assert.ok(pack.emotions.some((e) => e.includes("怕被怀疑")));
  assert.ok(!pack.emotions.some((e) => e.includes("隐瞒身份")));
});

test("sanitizeMatrixRowForStructured rewrites killer task with 我的细线", () => {
  const row = sanitizeMatrixRowForStructured({
    matrixRow: {
      tasks: ["检查门闩附近的细线残留是否与我的细线匹配"],
      lies: []
    },
    isKiller: true,
    actIndex: 1,
    finalActIndex: 2
  });
  assert.ok(!row.tasks[0].includes("我的细线"));
});

test("scanActionCrimeTokens flags killer ch2 细线+门闩", () => {
  const r = scanActionCrimeTokens("20:15 你走向门闩，比对细线残留。", {
    isKiller: true,
    actIndex: 1,
    finalActIndex: 2
  });
  assert.equal(r.passed, false);
});

test("stripCrimeTokensFromAction removes entity names", () => {
  const out = stripCrimeTokensFromAction("你取出细线，走向门闩。");
  assert.ok(!out.includes("细线"));
  assert.ok(!out.includes("门闩"));
});

test("stripSpoilerLeakFromNarrative removes confession only", () => {
  const out = stripSpoilerLeakFromNarrative("你感到不安。凶手就是我，是我杀了他。你随后离开。");
  assert.ok(out.includes("感到不安"));
  assert.ok(!out.includes("是我杀"));
  assert.ok(out.includes("离开"));
});

test("stripSpoilerLeakFromNarrative keeps psychology", () => {
  const out = stripSpoilerLeakFromNarrative("20:05 你进入通讯室。你心里清楚他在撒谎。20:10 你离开。");
  assert.ok(out.includes("心里清楚"));
});

test("scanSpoilerLeakInNarrative exempts killer self-aware private script", () => {
  const r = scanSpoilerLeakInNarrative("我是凶手，必须瞒住，是我杀了他。", {
    isKiller: true,
    killerAwareness: "self-aware",
    actIndex: 0,
    finalActIndex: 2
  });
  assert.equal(r.passed, true);
  assert.equal(r.exempt, "killer_self_aware_private");
});
test("scanSpoilerLeakInNarrative flags confession on innocent script", () => {
  const r = scanSpoilerLeakInNarrative("你担心杀人败露，是我杀了他。", { isKiller: false });
  assert.equal(r.passed, false);
});

test("scanSpoilerLeakInNarrative allows normal psychology", () => {
  const r = scanSpoilerLeakInNarrative("你愤怒地砸门，心里一阵紧张。");
  assert.equal(r.passed, true);
});

test("scanInnocentFalseConfession flags full murder chain on innocent final act", () => {
  const bad = scanInnocentFalseConfession("我跪下承认：用安眠药迷昏他，再通过窗栅机关注入氰化物。密室是我所设。", {
    isKiller: false,
    actIndex: 2,
    finalActIndex: 2
  });
  assert.equal(bad.passed, false);
  const ok = scanInnocentFalseConfession("我承认牛奶里放了安眠药，但他自己要助眠。我真没杀人。", {
    isKiller: false,
    actIndex: 2,
    finalActIndex: 2
  });
  assert.equal(ok.passed, true);
});

test("scanPersonaBleed allows cross-role mentions in public dialogue", () => {
  const archives = {
    roles: [
      { key: "role-1", name: "林海 · 补给员" },
      { key: "role-2", name: "苏晴 · 气象记录员" }
    ]
  };
  const r = scanPersonaBleed("下午四点送补给，林师傅你好。", "role-2", archives);
  assert.equal(r.passed, true);
});

test("scanPersonaBleed flags self observation", () => {
  const archives = { roles: [{ key: "role-2", name: "苏晴 · 气象记录员" }] };
  const r = scanPersonaBleed("看见苏晴站在门口。", "role-2", archives);
  assert.equal(r.passed, false);
  assert.equal(r.violations[0].type, "selfObservation");
});

test("applyStructuredGates keeps dialogue psychology", () => {
  const r = applyStructuredGates({
    actionLog: validateActionLog({ narrative: "你进入通讯室。随后你离开。" }),
    feelingsPack: { puzzles: [], emotions: [] },
    dialogueLog: { narrative: "苏晴说：「日志少了一页。」你心里有些不安，怀疑她在隐瞒。" },
    roleKey: "role-3",
    characterArchives: { roles: [{ key: "role-3", name: "陈默 · 电台检修工" }] },
    infoMatrix: { clues: [], rows: [{ roleKey: "role-3", actKey: "ch1", newClueIds: [] }] },
    matrixRow: { roleKey: "role-3", actKey: "ch1", newClueIds: [] },
    actKey: "ch1",
    config: { chapterKeys: ["ch1", "ch2", "ch3"] },
    isKiller: false
  });
  assert.equal(r.passed, true);
  assert.ok(r.dialogueLog.narrative.includes("心里"));
});

test("applyStructuredGates killer feelings leak fails gate", () => {
  const r = applyStructuredGates({
    actionLog: validateActionLog({ narrative: "20:05 你进入走廊。20:10 你离开。" }),
    feelingsPack: sanitizeFeelingsPack(
      { puzzles: [], emotions: ["[规定情绪] 复仇后的空虚与恐惧"] },
      { isKiller: true, actIndex: 0, finalActIndex: 2 }
    ),
    dialogueLog: { narrative: "林海说：「你来了。」" },
    roleKey: "role-3",
    characterArchives: { roles: [{ key: "role-3", name: "程远 · 检修工" }] },
    infoMatrix: { clues: [], rows: [{ roleKey: "role-3", actKey: "ch1", newClueIds: [] }] },
    matrixRow: { roleKey: "role-3", actKey: "ch1", newClueIds: [] },
    actKey: "ch1",
    config: { chapterKeys: ["ch1", "ch2", "ch3"] },
    isKiller: true,
    actIndex: 0,
    finalActIndex: 2
  });
  assert.ok(r.feelingsPack.emotions.every((e) => !/复仇/.test(e)));
});

test("stitchStructuredScript keeps internal feelings metadata out of player text", () => {
  const body = stitchStructuredScript({
    actionLog: { narrative: "20:05 你进入走廊。" },
    feelingsPack: { puzzles: ["[规定疑惑] 谁撕了日志？"], emotions: [] },
    dialogueLog: { narrative: "林海说：「你来了。」" }
  });
  assert.ok(body.includes("进入走廊"));
  assert.ok(!body.includes("[规定疑惑]"));
  assert.ok(body.includes("林海说"));
});

test("stitchStructuredScript uses structured dialogue instead of a repeated second narrative", () => {
  const repeated = "你核对签名，又看了一遍时间戳。";
  const body = stitchStructuredScript({
    actionLog: { narrative: repeated },
    feelingsPack: { puzzles: [], emotions: [] },
    roleName: "岑见潮 · 紧急法务官",
    dialogueLog: {
      dialogues: [{ speaker: "岑见潮", line: "授权范围不对。" }],
      observations: [{ target: "岑见潮", note: "他把条款推到你面前。" }],
      narrative: repeated
    }
  });
  assert.equal(body.split(repeated).length - 1, 1);
  assert.ok(body.includes("你说"));
  assert.ok(!body.includes("岑见潮说"));
  assert.ok(body.includes("授权范围不对"));
});
