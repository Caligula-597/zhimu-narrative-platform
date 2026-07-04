import assert from "node:assert/strict";
import test from "node:test";
import { injectKillerContradictions, buildInnocentAlibiBrief } from "../src/pipeline-matrix-killer-innocent.js";
import {
  applyScriptQualityGates,
  scanGuiltStatements,
  scanUnauthorizedDiscoveries,
  stripUnauthorizedDiscoveries
} from "../src/pipeline-matrix-script-gates.js";

const config = { chapterKeys: ["ch1", "ch2", "ch3"] };
const infoMatrix = {
  clues: [
    { key: "clue-1", name: "碎裂护目镜", actKey: "ch1", grantMode: "auto", description: "" },
    { key: "clue-2", name: "走私记录", actKey: "ch2", grantMode: "host_confirm", description: "" },
    { key: "clue-3", name: "检修暗格", actKey: "ch3", grantMode: "host_confirm", description: "" }
  ],
  rows: [
    { roleKey: "role-3", actKey: "ch1", newClueIds: ["clue-1"], lies: ["一直在电台室"], tasks: ["检修"] },
    { roleKey: "role-3", actKey: "ch2", newClueIds: [], lies: [], tasks: ["解释"] }
  ]
};
const matrixRow = infoMatrix.rows[1];

test("buildInnocentAlibiBrief marks innocent witness mode", () => {
  const brief = buildInnocentAlibiBrief({
    characterArchive: { publicIdentity: "电台检修工", lies: ["未离开电台室"] },
    matrixRow: infoMatrix.rows[0],
    actKey: "ch1",
    actIndex: 0
  });
  assert.equal(brief.mode, "innocent_witness");
  assert.ok(brief.hardRules.some((r) => r.includes("不是凶手")));
});

test("injectKillerContradictions hedges confident denial", () => {
  const body = "我整个晚上都在电台室，把电台修好了。";
  const { body: out, injections } = injectKillerContradictions(body, { matrixRow, actIndex: 0 });
  assert.ok(injections.length >= 1);
  assert.ok(out.includes("信号异常"));
  assert.ok(!out.includes("整个晚上都在电台室"));
});

test("scanGuiltStatements flags confession tone", () => {
  const r = scanGuiltStatements("你心里清楚自己在走私。必须隐瞒。是我干的。走私记录还没想好怎么圆。");
  assert.equal(r.passed, false);
  assert.ok(r.count > 2);
});

test("scanUnauthorizedDiscoveries flags host_confirm clue without grant", () => {
  const body = "你翻开笔记本，读到走私记录的每一页。";
  const r = scanUnauthorizedDiscoveries(body, infoMatrix, matrixRow, "ch2", config);
  assert.equal(r.passed, false);
  assert.equal(r.violations[0].clueName, "走私记录");
});

test("stripUnauthorizedDiscoveries replaces discovery sentence", () => {
  const body = "你翻开笔记本，读到走私记录的每一页。你合上它。";
  const violations = [{ type: "unauthorizedDiscovery", clueName: "走私记录", sentence: "你翻开笔记本，读到走私记录的每一页。" }];
  const out = stripUnauthorizedDiscoveries(body, violations);
  assert.ok(out.includes("光线太暗"));
  assert.ok(!out.includes("走私记录"));
});

test("applyScriptQualityGates passes innocent killer without guilt", () => {
  const body = "你推开电台室的门，检查设备。你听见楼上一声闷响，心里一紧。";
  const { passed, gates } = applyScriptQualityGates(body, {
    spoilerContract: { forbiddenFacts: ["走私动机"] },
    infoMatrix,
    matrixRow: infoMatrix.rows[0],
    actKey: "ch1",
    config,
    isKillerInnocentMode: true,
    actIndex: 0,
    isKiller: true,
    finalActIndex: 2
  });
  assert.equal(gates.guiltStatements.passed, true);
  assert.equal(passed, true);
});
