import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProposalFromMatrix,
  characterArchivesToRolesMeta,
  matrixScriptsToSections,
  pipelineWordTargets,
  scanEndingComposition,
  validateCharacterArchives,
  validateHostRunbooks,
  validateInfoMatrix,
  validateTruthBible
} from "../src/pipeline-matrix-model.js";

const config = {
  playerCount: 2,
  chapterKeys: ["act1", "act2"],
  title: "测试剧本"
};

test("pipelineWordTargets returns tier min words", () => {
  assert.equal(pipelineWordTargets({ volumeTier: "demo" }).minScript, 400);
  assert.equal(pipelineWordTargets({ volumeTier: "epic" }).minScript, 2000);
  assert.equal(pipelineWordTargets({ volumeTier: "unknown" }).tier, "standard");
});

test("validateTruthBible requires summary killer method", () => {
  const bible = validateTruthBible(
    {
      summary: "x".repeat(220),
      killer: "甲",
      method: "毒杀",
      timeline: [{ id: "t1", time: "夜", event: "案发", participants: ["甲"] }],
      misdirections: [{ layer: 1, surface: "乙可疑", misleading: "乙在场", resolution: "乙有不在场" }],
      spoilerGates: [{ actKey: "act1", forbiddenFacts: ["真凶"] }]
    },
    config
  );
  assert.equal(bible.killer, "甲");
  assert.equal(bible.timeline.length, 1);
});

test("playable truth uses decisions and ending routes instead of inventing a killer", () => {
  const bible = validateTruthBible(
    {
      playStructure: "faction",
      summary: "六个人必须在旧厂清算截止前分配仍有效的保障名额；他们掌握的合同、工龄与欠款互相冲突，每一次签字都会改变谁承担风险以及这套制度还能不能延续。".repeat(3),
      sharedObjective: "先在停电前把浸水账本转移并复原页码，否则谁都无法证明自己的主张。",
      centralQuestion: "今晚由谁承担清算风险，谁拿走剩余保障？",
      publicCrisis: "清算窗口关闭后，未登记权益全部失效。",
      irreversibleDeadline: "零点前必须完成两轮签署。",
      endingAxes: [
        { key: "mutual", label: "互保余额", lowMeaning: "各自脱身", highMeaning: "共同承担", changedBy: ["decision-1"] },
        { key: "control", label: "控制集中度", lowMeaning: "权力分散", highMeaning: "一人控制", changedBy: ["decision-2"] }
      ],
      endingRoutes: [
        { key: "ending-mutual", title: "互保成立", consequence: "共同账户继续运行。", priority: 100, requirements: [{ axisKey: "mutual", operator: "gte", value: 2 }] },
        { key: "ending-control", title: "控制收拢", consequence: "清算权集中到一人手中。", priority: 90, requirements: [{ axisKey: "control", operator: "gte", value: 2 }] },
        { key: "ending-default", title: "各自结清", consequence: "所有人按最低标准离场。", priority: 0, isDefault: true, requirements: [] }
      ]
    },
    config,
    { playStructure: "faction" }
  );
  assert.equal(bible.killer, "");
  assert.equal(bible.endingRoutes.length, 3);
});

test("ending composition keeps main routes small and requires personal epilogues for every role", () => {
  const truthBible = {
    playStructure: "faction",
    endingRoutes: [{ key: "main-a" }, { key: "main-b" }, { key: "main-default" }],
    roleEpilogues: [
      { roleKey: "role-1", variants: [{ key: "r1-a" }, { key: "r1-default" }] },
      { roleKey: "role-2", variants: [{ key: "r2-a" }, { key: "r2-default" }] }
    ]
  };
  const result = scanEndingComposition(truthBible, config, { playStructure: "faction" });
  assert.equal(result.passed, true);
  assert.equal(result.mainEndingCount, 3);
  assert.equal(result.roleEpilogueCount, 4);
  truthBible.roleEpilogues.pop();
  assert.equal(scanEndingComposition(truthBible, config, { playStructure: "faction" }).passed, false);
});

test("playable truth caps narrative ending axes before state combinations explode", () => {
  assert.throws(() => validateTruthBible({
    playStructure: "faction",
    summary: "角色通过连续行动改变彼此处境，细粒度金额留在运行时状态，主叙事只保留少量真正改变结局含义的维度。".repeat(5),
    sharedObjective: "共同打开被卡住的闸门",
    centralQuestion: "闸门之后的资源由谁处置",
    publicCrisis: "闸门即将永久锁死",
    irreversibleDeadline: "本轮结束前",
    endingAxes: Array.from({ length: 7 }, (_, index) => ({ key: `axis-${index + 1}` })),
    endingRoutes: []
  }, config, { playStructure: "faction" }), /叙事结局轴不得超过 6 个/);
});

test("validateCharacterArchives assigns missing keys", () => {
  const archives = validateCharacterArchives(
    {
      roles: [
        { name: "甲", publicIdentity: "医生", hiddenIdentity: "凶手", motive: "复仇", relationships: "乙", timelineActions: "夜", innerConflict: " guilt", voiceHints: "冷", lies: ["否认"], actTasks: [{ actKey: "act1", tasks: ["调查"], tips: "别剧透" }] },
        { key: "role-2", name: "乙", publicIdentity: "律师", hiddenIdentity: "知情", motive: "自保", relationships: "甲", timelineActions: "夜", innerConflict: " fear", voiceHints: "急", lies: [], actTasks: [{ actKey: "act1", tasks: ["辩护"], tips: "" }] }
      ]
    },
    config
  );
  assert.equal(archives.roles.length, 2);
  assert.equal(archives.roles[0].key, "role-1");
  assert.equal(archives.roles[0].pronouns, "TA");
});

test("playable characters need agency but do not each need a fabricated exclusive permission", () => {
  const archives = validateCharacterArchives(
    {
      roles: [
        {
          key: "role-1", name: "甲", immediateWant: "抢到最后一位客人", nonNegotiable: "不让乙替自己上钟",
          failureCost: "当晚业绩归零", playableMoves: ["截走客人", "公开乙的私下交易"],
          relationshipDebts: [{ roleKey: "role-2", debt: "乙曾替甲顶过投诉", leverage: "知道甲的违规记录", fractureCondition: "甲再次抢客" }]
        },
        {
          key: "role-2", name: "乙", immediateWant: "保住当晚排班", nonNegotiable: "不交出师父留下的工牌",
          failureCost: "被赶出店门", playableMoves: ["替换排钟表", "把工牌交给真正的亲属"],
          relationshipDebts: [{ roleKey: "role-1", debt: "替甲承担过投诉", leverage: "能推翻甲的不在场说法", fractureCondition: "甲否认旧债" }]
        }
      ]
    },
    config,
    { playStructure: "faction" }
  );
  assert.equal(archives.roles.length, 2);
  assert.equal(archives.roles[0].decisionPower, "");
  assert.equal(archives.roles[1].decisionPower, "");
});

test("validateInfoMatrix links rows to roles and clues", () => {
  const characterArchives = {
    roles: [{ key: "role-1", name: "甲" }, { key: "role-2", name: "乙" }]
  };
  const matrix = validateInfoMatrix(
    {
      clues: [{ name: "血迹", description: "门把手", actKey: "act1", grantMode: "auto" }],
      rows: [
        { roleKey: "role-1", actKey: "act1", newClueIds: ["clue-1"], tasks: ["搜查"], forbidden: "别说出身" },
        { roleKey: "role-2", actKey: "act2", newClueIds: [], tasks: ["观察"], forbidden: "" }
      ],
      actTitles: { act1: "第一幕", act2: "第二幕" }
    },
    config,
    characterArchives
  );
  assert.equal(matrix.clues[0].key, "clue-1");
  assert.equal(matrix.actTitles.act1, "第一幕");
  assert.equal(matrix.rows.length, 2);
});

test("matrix normalizes negative inference boundaries and shared observable beats", () => {
  const characterArchives = { roles: [{ key: "role-1", name: "甲" }, { key: "role-2", name: "乙" }] };
  const matrix = validateInfoMatrix({
    clues: [{ key: "clue-1", name: "钥匙", description: "有新磨痕", actKey: "act1" }],
    rows: [{
      roleKey: "role-1", actKey: "act1", newClueIds: ["clue-1"], tasks: ["核对钥匙"],
      notYetInferred: ["磨痕来自乙"], forbiddenConclusions: ["乙换了锁"], allowedSuspicionRange: "只能怀疑钥匙被重新配过"
    }],
    actContracts: [{
      actKey: "act1",
      sceneSequence: [{
        sceneKey: "act1-s1", location: "门厅", timeWindow: "开门前", presentRoleKeys: ["role-1", "role-2"],
        changeMode: "misunderstanding", entryAction: "甲把钥匙放在门边", stateChange: "乙先拿走钥匙",
        observableBeats: [{ key: "beat-1", actorRoleKey: "role-1", actionOrLine: "把钥匙放下", object: "钥匙", sequence: 1, memoryAgreement: "shared", interpretationFreedom: "可理解为交还或试探" }]
      }]
    }]
  }, config, characterArchives);
  assert.deepEqual(matrix.rows[0].forbiddenConclusions, ["乙换了锁"]);
  assert.equal(matrix.actContracts[0].sceneSequence[0].changeMode, "misunderstanding");
  assert.equal(matrix.actContracts[0].sceneSequence[0].observableBeats[0].memoryAgreement, "shared");
});

function playableCharacters() {
  return {
    roles: [
      {
        key: "role-1", name: "甲", immediateWant: "拿到签字权", privateInterest: "保住房契", nonNegotiable: "不承担旧债",
        decisionPower: "可否决一次资产转让", failureCost: "失去住处", playableMoves: ["提交合同", "转让票据"],
        relationshipDebts: [{ roleKey: "role-2", debt: "欠一次担保", leverage: "可要求共同签字", fractureCondition: "公开旧账" }]
      },
      {
        key: "role-2", name: "乙", immediateWant: "保住保障名额", privateInterest: "退出旧厂", nonNegotiable: "不交出全部现金",
        decisionPower: "可决定一份名额归属", failureCost: "承担护理费", playableMoves: ["质押存单", "公开工龄"],
        relationshipDebts: [{ roleKey: "role-1", debt: "替甲垫过费用", leverage: "可追索现金", fractureCondition: "甲拒绝承认" }]
      }
    ]
  };
}

function playableMatrix() {
  const rows = ["act1", "act2"].flatMap((actKey) => ["role-1", "role-2"].map((roleKey) => ({
    roleKey, actKey, newClueIds: [`clue-${actKey}`], tasks: ["使用物料完成本幕决定"]
  })));
  const decisions = ["act1", "act2"].map((actKey, index) => ({
    key: `decision-${index + 1}`,
    actKey,
    question: `${actKey} 的名额交给谁？`,
    deadline: "本幕结束前",
    defaultEffect: "无人签字，名额作废。",
    defaultAxisEffects: [{ axisKey: "mutual", delta: -1 }],
    options: [
      { key: `${actKey}-a`, label: "共同持有", immediateEffect: "互保增加。", axisEffects: [{ axisKey: "mutual", delta: 1 }] },
      { key: `${actKey}-b`, label: "集中持有", immediateEffect: "控制增加。", axisEffects: [{ axisKey: "control", delta: 1 }] }
    ]
  }));
  const actContracts = ["act1", "act2"].map((actKey, index) => ({
    actKey,
    title: `第${index + 1}轮签署`,
    publicSituation: "所有人围绕一份真实合同重新分配权益。",
    deadline: "本幕结束前",
    mandatoryDecisionKey: `decision-${index + 1}`,
    entryState: "合同尚未签署。",
    exitState: "合同归属已写入。",
    temporarySharedGoal: "先核对合同的缺页并拼出可执行版本。",
    cooperationPayoff: "完成后所有人获得继续签署和质疑条款的资格。",
    branchOpenings: ["是否保留缺页上的私人批注会改变下一幕的相认支线"],
    sceneSequence: [
      { sceneKey: `${actKey}-scene-1`, mode: "exploration", location: "清算室", timeWindow: "开场十分钟", presentRoleKeys: ["role-1", "role-2"], entryAction: "主持人把合同缺页放到两个抽屉", conflictObject: "先查哪个抽屉", explorationChoices: [{ action: "两人交换钥匙同时开柜", gain: "拿到完整页码", risk: "必须公开一条私人批注" }], stateChange: "合同首次被拼回可读版本" },
      { sceneKey: `${actKey}-scene-2`, mode: "confrontation", location: "清算室", timeWindow: "本幕末十分钟", presentRoleKeys: ["role-1", "role-2"], entryAction: "持有人必须递交最终版本", conflictObject: "名额归属", stateChange: "本幕决定完成结算" }
    ]
  }));
  return {
    clues: ["act1", "act2"].map((actKey) => ({
      key: `clue-${actKey}`, name: `${actKey}合同`, description: "有空白签字栏的纸质合同", actKey,
      physicalForm: "A4 双联纸", affordances: ["签字", "转让"], settlementUse: "签名决定归属"
    })),
    rows,
    decisions,
    actContracts,
    actTitles: { act1: "第一幕", act2: "第二幕" }
  };
}

const playableTruth = {
  endingAxes: [{ key: "mutual" }, { key: "control" }],
};

test("playable matrix requires a complete role-act grid, public scenes, materials and decisions", () => {
  const matrix = validateInfoMatrix(playableMatrix(), config, playableCharacters(), { playStructure: "faction" }, playableTruth);
  assert.equal(matrix.rows.length, 4);
  assert.equal(matrix.actContracts[0].sceneSequence.length, 2);
  const proposal = buildProposalFromMatrix({ setting: { playStructure: "faction" }, config, truthBible: {}, infoMatrix: matrix });
  assert.equal(proposal.scenes.length, 4);
  assert.equal(proposal.matrixSync.decisions.length, 2);
});

test("playable matrix rejects a prose-only timeout consequence", () => {
  const value = playableMatrix();
  value.decisions[0].defaultAxisEffects = [];
  assert.throws(
    () => validateInfoMatrix(value, config, playableCharacters(), { playStructure: "faction" }, playableTruth),
    /无人行动后果没有改变任何结局轴/,
  );
});

test("playable matrix rejects default and option writes to unknown ending axes", () => {
  const badDefault = playableMatrix();
  badDefault.decisions[0].defaultAxisEffects[0].axisKey = "mutal_typo";
  assert.throws(
    () => validateInfoMatrix(badDefault, config, playableCharacters(), { playStructure: "faction" }, playableTruth),
    /无人行动后果引用了真相层不存在的结局轴/,
  );

  const badOption = playableMatrix();
  badOption.decisions[0].options[0].axisEffects[0].axisKey = "mutal_typo";
  assert.throws(
    () => validateInfoMatrix(badOption, config, playableCharacters(), { playStructure: "faction" }, playableTruth),
    /引用了真相层不存在的结局轴/,
  );
});

test("playable host runbook must be executable instead of a loose narration", () => {
  const result = validateHostRunbooks({ runbooks: [{
    actKey: "act1",
    openingReadAloud: "清算窗口已经打开。",
    roundGoal: "完成第一份合同归属。",
    decisionProcedure: "收齐合同，核对签名，再由全桌确认选项。",
    failureAdvance: "无人签字则合同作废并进入下一幕。",
    endCondition: "合同上出现有效签名。",
    materialSetup: [{ clueId: "clue-act1", placement: "桌面中央", allowedActions: ["签字", "转让"] }]
  }] }, config, { playStructure: "faction" });
  assert.equal(result.runbooks[0].materialSetup[0].allowedActions[0], "签字");
});

test("buildProposalFromMatrix produces scenes clues and edges", () => {
  const truthBible = { summary: "x".repeat(220), killer: "甲", method: "毒", hostNotes: "控场" };
  const infoMatrix = {
    actTitles: { act1: "开幕", act2: "对峙" },
    actSummaries: { act1: "集合", act2: "投票" },
    clues: [{ key: "clue-1", name: "信件", description: "威胁", actKey: "act1", grantMode: "host_confirm" }],
    rows: []
  };
  const proposal = buildProposalFromMatrix({ setting: { theme: "测试" }, config, truthBible, infoMatrix });
  assert.equal(proposal.title, "测试剧本");
  assert.equal(proposal.chapters.length, 2);
  assert.equal(proposal.scenes.length, 2);
  assert.equal(proposal.clues.length, 1);
  assert.equal(proposal.edges.length, 1);
  assert.equal(proposal.clues[0].metadata.grantMode, "host_confirm");
});

test("characterArchivesToRolesMeta maps matrix rows to chapter knowledge", () => {
  const characterArchives = { roles: [{ key: "role-1", name: "甲", publicIdentity: "医生", hiddenIdentity: "凶手", motive: "复仇", innerConflict: " guilt", lies: ["否认"] }] };
  const infoMatrix = {
    rows: [{ roleKey: "role-1", actKey: "act1", newClueIds: ["clue-1"], suspicion: "怀疑乙", forbidden: "别说", tasks: ["搜查"] }]
  };
  const meta = characterArchivesToRolesMeta(characterArchives, infoMatrix, { chapterKeys: ["act1"] });
  assert.equal(meta.roles[0].chapterKnowledge[0].chapterKey, "act1");
  assert.match(meta.roles[0].chapterKnowledge[0].knows, /clue-1/);
});

test("matrixScriptsToSections copies script bodies", () => {
  const sections = matrixScriptsToSections({
    "role-1": { act1: { title: "T", body: "正文", tasks: ["a"], closingHook: "?" } }
  });
  assert.equal(sections["role-1"].act1.body, "正文");
});
