import assert from "node:assert/strict";
import test from "node:test";
import {
  fillFeelingPack,
  buildPublicActionBrief,
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
  applySceneContractGates,
  applyStructuredGates,
  validateSceneContract,
  validateActionLog
} from "../src/pipeline-matrix-structured-script.js";
import {
  buildActionLogMessages,
  buildDialogueLogMessages,
  buildSceneCompositionMessages,
  buildSceneContractMessages
} from "../src/prompts/matrix-structured-script.js";

const validSceneContract = {
  scenes: [
    {
      sceneKey: "s1",
      timeWindow: "交班前",
      location: "收费柜台",
      presentCharacters: ["唐远", "周敏"],
      entryAction: "周敏把协议推到唐远手边。",
      immediateConflict: {
        roleDemand: "唐远要求先拿维修发票",
        counterDemand: "周敏要求他先签协议",
        whyCannotBothWin: "签字会立即确认财产条款，发票又是报账凭证",
        deadline: "交班铃响前",
        failureCost: "协议被带回法务，发票也不能报账"
      },
      relationshipPressure: { oldAccount: "三个月前留下的协议", statusAsymmetry: "周敏掌握票据", unsaidFact: "唐远一直在拖" },
      beats: [
        { actor: "周敏", action: "把协议推过去", object: "协议", reaction: "唐远按住维修单", stateChange: "唐远不能继续假装没看见" },
        { actor: "唐远", action: "问发票在哪里", object: "发票", reaction: "周敏翻回协议正面", stateChange: "两件事被绑在一起" },
        { actor: "周敏", action: "收走柜台上的笔", object: "笔", reaction: "唐远拿起维修单", stateChange: "本次签字机会关闭" }
      ],
      exitChange: "唐远拿走维修单，协议被送回法务"
    },
    {
      sceneKey: "s2",
      timeWindow: "交班后",
      location: "后门台阶",
      presentCharacters: ["唐远", "周敏"],
      entryAction: "唐远挡住正要锁门的周敏。",
      immediateConflict: {
        roleDemand: "唐远要拿回协议",
        counterDemand: "周敏要求他当面说清修改哪一条",
        whyCannotBothWin: "带走协议可以继续拖延，当面修改则会留下决定",
        deadline: "门锁上之前",
        failureCost: "协议次日进入法务流程"
      },
      relationshipPressure: { oldAccount: "过去三次都没谈完", statusAsymmetry: "周敏有锁柜钥匙", unsaidFact: "唐远怕的不是条款" },
      beats: [
        { actor: "唐远", action: "伸手按住门", object: "后门", reaction: "周敏停下锁门", stateChange: "两人不得不继续谈" },
        { actor: "周敏", action: "问他要改哪一条", object: "协议", reaction: "唐远翻到第二页", stateChange: "拖延变成具体条款" },
        { actor: "唐远", action: "撕下便签写出数字", object: "便签", reaction: "周敏接过便签", stateChange: "双方第一次留下可执行报价" }
      ],
      exitChange: "周敏带走数字，唐远没有拿回协议"
    }
  ],
  continuityBridge: "第一次拒签关闭柜台机会，第二次逼出具体报价",
  withheldMeanings: ["唐远害怕公开自己的真实开销"],
  forbiddenNarratorClaims: ["你一直这样告诉自己"]
};

test("scene contract gate requires observable conflict and changed state", () => {
  const contract = validateSceneContract(validSceneContract);
  const result = applySceneContractGates(contract, {
    expectedSceneCount: 2,
    roleRoster: { roles: [{ name: "唐远" }, { name: "周敏" }] }
  });
  assert.equal(result.passed, true);
});

test("scene contract gate rejects abstract pseudo-scenes before prose is written", () => {
  const broken = structuredClone(validSceneContract);
  broken.scenes[0].entryAction = "你终于意识到婚姻的意义。";
  broken.scenes[0].beats[0].action = "理解了对方的立场";
  const result = applySceneContractGates(broken, {
    expectedSceneCount: 2,
    roleRoster: { roles: [{ name: "唐远" }, { name: "周敏" }] }
  });
  assert.equal(result.passed, false);
  assert.ok(result.violations.some((issue) => issue.type === "entryNotObservable"));
  assert.ok(result.violations.some((issue) => issue.type === "beatNotObservable"));
});

test("scene contract accepts a non-conflict turn when its observable change is complete", () => {
  const contract = structuredClone(validSceneContract);
  contract.scenes[0].changeMode = "missed_connection";
  contract.scenes[0].immediateConflict = {};
  contract.scenes[0].changeMechanism = {
    pressure: "两人都以为对方会先提三个月前的账",
    turn: "周敏把维修单压在协议下面，唐远只抽走了露在外面的收据",
    observableDifference: "协议仍留在柜台，但唐远带走了唯一能核对金额的收据",
    openQuestion: "他是真的没看见协议，还是故意不碰"
  };
  const result = applySceneContractGates(contract, {
    expectedSceneCount: 2,
    roleRoster: { roles: [{ name: "唐远" }, { name: "周敏" }] }
  });
  assert.equal(result.passed, true);
});

test("scene contract prompt prevents detail stacking from replacing dramatic action", () => {
  const messages = buildSceneContractMessages({
    publicActionBrief: { tasks: ["拿到对方的签字"] },
    roleKey: "role-1",
    actKey: "act-1",
    targetWords: 1800,
    expectedSceneCount: 3,
    spoilerContract: { forbiddenFacts: ["幕后真相"] },
    roleRoster: { roles: [{ key: "role-1", name: "唐远" }, { key: "role-2", name: "周敏" }] },
    entityUnlockContract: null
  });
  const prompt = messages.map((message) => message.content).join("\n");
  assert.match(prompt, /场景合同不是剧情摘要/u);
  assert.match(prompt, /专有名词和生活细节不能冒充场景/u);
  assert.match(prompt, /谁失去了什么退路/u);
  assert.match(prompt, /作者后台信息/u);
  assert.match(prompt, /你一直这样告诉自己/u);
  assert.match(prompt, /专业感不是造词权/u);
});

test("structured generation keeps matrix negative inference boundaries even without a separate act outline", () => {
  const publicActionBrief = buildPublicActionBrief({
    characterArchive: { name: "唐远" },
    matrixRow: {
      tasks: ["核对发票"],
      notYetInferred: ["发票与旧账属于同一笔钱"],
      forbiddenConclusions: ["周敏伪造了发票"],
      allowedSuspicionRange: "只能怀疑金额被改过"
    },
    actKey: "act-1",
    actIndex: 0
  });
  const prompt = buildActionLogMessages({
    publicActionBrief,
    sceneContract: validSceneContract,
    roleKey: "role-1",
    actKey: "act-1",
    targetWords: 1200,
    spoilerContract: { forbiddenFacts: [] },
    roleRoster: { roles: [{ key: "role-1", name: "唐远" }, { key: "role-2", name: "周敏" }] },
    entityUnlockContract: null
  }).map((message) => message.content).join("\n");
  assert.match(prompt, /发票与旧账属于同一笔钱/u);
  assert.match(prompt, /周敏伪造了发票/u);
  assert.match(prompt, /只能怀疑金额被改过/u);
});

test("scene materials and first composition receive the same accepted scene contract", () => {
  const common = {
    publicActionBrief: { tasks: ["拿到对方的签字"] },
    sceneContract: validSceneContract,
    roleKey: "role-1",
    actKey: "act-1",
    targetWords: 1200,
    spoilerContract: { forbiddenFacts: [] },
    roleRoster: { roles: [{ key: "role-1", name: "唐远" }, { key: "role-2", name: "周敏" }] },
    entityUnlockContract: null
  };
  const actionPrompt = buildActionLogMessages(common).map((message) => message.content).join("\n");
  const dialoguePrompt = buildDialogueLogMessages({
    ...common,
    actionLog: { narrative: "你把协议推回去。", entries: [] },
    feelingsPack: { puzzles: [], emotions: [] },
    truthConsistency: null,
    clueLedger: [],
    peerScriptDigest: []
  }).map((message) => message.content).join("\n");
  const compositionPrompt = buildSceneCompositionMessages({
    ...common,
    actionLog: { narrative: "你把协议推回去。", entries: [] },
    dialogueLog: { narrative: "周敏说：\"今天必须签。\"", dialogues: [], observations: [] },
    feelingsPack: { puzzles: [], emotions: [] }
  }).map((message) => message.content).join("\n");

  assert.match(actionPrompt, /sceneContract（唯一场面施工图）/u);
  assert.match(actionPrompt, /收费柜台/u);
  assert.match(dialoguePrompt, /对白必须在这些场景内发生/u);
  assert.match(dialoguePrompt, /禁止轮流完整陈述观点/u);
  assert.match(compositionPrompt, /不是把两份材料机械拼接/u);
  assert.match(compositionPrompt, /原有压力 → 具体转折 → 可见差别/u);
  assert.match(compositionPrompt, /心理只能依附当下注意、误判、改口和不肯做的动作/u);
});

test("structured prose stages keep a first-person contract instead of hardcoding second person", () => {
  const common = {
    publicActionBrief: { tasks: ["拿到对方的签字"] },
    sceneContract: validSceneContract,
    roleKey: "role-1",
    actKey: "act-1",
    targetWords: 1200,
    spoilerContract: { forbiddenFacts: [] },
    roleRoster: { roles: [{ key: "role-1", name: "唐远" }, { key: "role-2", name: "周敏" }] },
    entityUnlockContract: null,
    pov: "first"
  };
  const prompts = [
    buildActionLogMessages(common),
    buildDialogueLogMessages({
      ...common,
      actionLog: { narrative: "我把协议推回去。", entries: [] },
      feelingsPack: { puzzles: [], emotions: [] },
      truthConsistency: null,
      clueLedger: [],
      peerScriptDigest: []
    }),
    buildSceneCompositionMessages({
      ...common,
      actionLog: { narrative: "我把协议推回去。", entries: [] },
      dialogueLog: { narrative: "周敏说：\"今天必须签。\"", dialogues: [], observations: [] },
      feelingsPack: { puzzles: [], emotions: [] }
    })
  ].map((messages) => messages.map((message) => message.content).join("\n"));
  for (const prompt of prompts) {
    assert.match(prompt, /本角色全书正文锁定为第一人称「我」/u);
    assert.match(prompt, /角色给自己写人物分析/u);
    assert.match(prompt, /职业身份和人物声线不提供造词权|publicIdentity 只说明角色是谁/u);
  }
});

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
