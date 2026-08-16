import assert from "node:assert/strict";
import test from "node:test";
import { buildStoryOutlineMessages } from "../src/prompts/outline.js";
import { buildCharacterArchivesMessages } from "../src/prompts/character-archives.js";
import { buildInfoMatrixMessages } from "../src/prompts/info-matrix.js";
import { buildMatrixPlayerScriptMessages } from "../src/prompts/matrix-player-script.js";
import { buildRolesFromNarrativeMessages } from "../src/prompts/roles-from-narrative.js";
import { buildRoleSectionMessages } from "../src/prompts/section.js";
import { buildTruthBibleMessages } from "../src/prompts/truth-bible.js";

test("outline prompt allows author stance without encoding one correct ending", () => {
  const messages = buildStoryOutlineMessages(
    { title: "测试故事", premise: "六个人在停电夜重逢", generationContract: {} },
    { playerCount: 4, chapterCount: 3, chapterKeys: ["chapter-1", "chapter-2", "chapter-3"] }
  );
  const system = messages[0].content;
  assert.match(system, /生活先于命题/);
  assert.match(system, /作者可以有明确、锋利甚至偏激的答案/);
  assert.match(system, /不能写进 truthTimeline 当唯一裁决/);
  assert.match(system, /鲜明甚至偏激的作者立场/);
  assert.match(system, /禁止自动安排大团圆/);
  assert.match(system, /禁止把玩家一一设计成互补观点席位/);
});

test("matrix player prompt separates lived narrative from task list", () => {
  const messages = buildMatrixPlayerScriptMessages({
    setting: { theme: "测试", playerCount: 1, chapterCount: 1 },
    synopsis: { body: "停电夜里，一个人藏起了备用钥匙。" },
    config: { chapterKeys: ["ch1"] },
    truthBible: { spoilerGates: [], misdirections: [] },
    characterArchive: { key: "role-1", name: "周循", voiceHints: "说话短" },
    characterArchives: { roles: [{ key: "role-1", name: "周循", voiceHints: "说话短" }] },
    matrixRow: { roleKey: "role-1", actKey: "ch1", tasks: ["确认门锁是否换过"], newClueIds: [] },
    infoMatrix: { clues: [], rows: [], publicEnvironmentByAct: {} },
    actKey: "ch1",
    roleKey: "role-1",
    targetWords: 1000,
    pov: "first",
    existingScripts: {}
  });
  const system = messages[0].content;
  assert.match(system, /不得逐条包装或复述 tasks/);
  assert.match(system, /叙述人称合同/);
  assert.match(system, /角色给自己写人物分析/);
  assert.match(system, /角色档案里的“真实处境、欲望、底线/);
  assert.match(system, /专业感不是造词权/);
  assert.match(system, /publicIdentity 只说明角色是谁/);
  assert.match(system, /固定三四句/);
  assert.match(system, /禁止连接词堆叠不等于删除连接/);
  assert.doesNotMatch(system, /2 处对他人的误导性怀疑/);
});

test("playable pipeline prompts forbid murder schema drift and require runtime causality", () => {
  const setting = { theme: "清算", playStructure: "faction", matrixMode: "honkaku", playerCount: 2, chapterCount: 2 };
  const synopsis = { body: "六个人在清算窗口关闭前处理一组互相冲突的合同。" };
  const config = { playerCount: 2, chapterKeys: ["act1", "act2"] };
  const truthMessages = buildTruthBibleMessages({ setting, synopsis, config });
  assert.match(truthMessages[0].content, /禁止为了填 schema 强造凶手/);
  assert.match(truthMessages[0].content, /至少三个 endingRoutes/);
  assert.match(truthMessages[0].content, /不可撤销行动引爆/u);
  assert.match(truthMessages[0].content, /不得承诺利益平均/u);
  assert.match(truthMessages[0].content, /playerExperiencePromise/);
  assert.match(truthMessages[0].content, /retellableMoment/);
  assert.match(truthMessages[0].content, /worldSpecificActions/);
  assert.match(truthMessages[0].content, /换个行业就不能照搬/u);

  const truthBible = { endingAxes: [{ key: "mutual" }, { key: "control" }], endingRoutes: [{ key: "end" }] };
  const characterMessages = buildCharacterArchivesMessages({ setting, synopsis, config, truthBible });
  assert.match(characterMessages[0].content, /六张不同名称的否决票/);
  assert.match(characterMessages[0].content, /decisionPower 仅在人物既有身份与关系确实产生/u);

  const characterArchives = { roles: [{ key: "role-1" }, { key: "role-2" }] };
  const clueNetwork = { publicAnchorKeys: [], clues: [] };
  const matrixMessages = buildInfoMatrixMessages({ setting, synopsis, config, truthBible, characterArchives, clueNetwork });
  assert.match(matrixMessages[0].content, /每个选项都必须通过 axisEffects/);
  assert.match(matrixMessages[0].content, /禁止各自发明现场/);
  assert.match(matrixMessages[0].content, /受益者、受损者/u);
  assert.match(matrixMessages[0].content, /不得为了公平把资源、收益、损失、戏份和结局配平/u);
  assert.match(matrixMessages[1].content, /endingRoutes/);
});

test("legacy player-script prompts use the same scene-first prose policy", () => {
  const sectionMessages = buildRoleSectionMessages({
    brief: { style: "现实" },
    spec: {},
    proposal: { chapters: [{ key: "ch1" }] },
    roleMatrix: { roles: [{ key: "role-1", name: "许青" }] },
    roleKey: "role-1",
    chapterKey: "ch1"
  });
  const bulkMessages = buildRolesFromNarrativeMessages({
    brief: { title: "测试", style: "现实" },
    spec: {},
    roleMatrix: { roles: [{ key: "role-1", name: "许青" }] },
    chapters: [{ chapterKey: "ch1", title: "第一幕", narrativeBody: "许青把合同抽回来。" }],
    pov: "first"
  });
  for (const messages of [sectionMessages, bulkMessages]) {
    const system = messages[0].content;
    assert.match(system, /生活先于命题/);
    assert.match(system, /信息矩阵是事实边界/);
    assert.match(system, /短问答|短句阶梯/);
    assert.match(system, /全篇锁定/);
    assert.match(system, /旧链路没有提供 terminologyGroundingContract/);
  }
});
