import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProposalFromMatrix,
  characterArchivesToRolesMeta,
  matrixScriptsToSections,
  pipelineWordTargets,
  validateCharacterArchives,
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
