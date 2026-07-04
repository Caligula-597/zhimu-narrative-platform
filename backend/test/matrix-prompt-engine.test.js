import assert from "node:assert/strict";
import test from "node:test";
import {
  actIndex,
  buildFairnessContract,
  buildMatrixScriptPromptBundle,
  buildPeerScriptDigest,
  buildSpoilerContract,
  resolveKillerRoleKey
} from "../src/prompts/matrix-prompt-engine.js";

const config = { chapterKeys: ["ch1", "ch2", "ch3"] };
const characterArchives = {
  roles: [
    { key: "role-1", name: "甲 · 补给", publicIdentity: "补给员" },
    { key: "role-3", name: "丙 · 律师", publicIdentity: "律师" }
  ]
};
const truthBible = {
  killer: "role-3",
  spoilerGates: [
    { actKey: "ch1", forbiddenFacts: ["暗格存在", "真凶身份"] },
    { actKey: "ch2", forbiddenFacts: ["真凶身份"] }
  ],
  misdirections: [{ layer: 1, surface: "护目镜", misleading: "搏斗", resolution: "道具" }]
};
const infoMatrix = {
  clues: [
    { key: "clue-1", name: "护目镜", actKey: "ch1", grantMode: "auto", description: "碎裂" },
    { key: "clue-2", name: "暗格", actKey: "ch2", grantMode: "host_confirm", description: "机关" }
  ],
  rows: [
    {
      roleKey: "role-1",
      actKey: "ch1",
      newClueIds: ["clue-1"],
      forbidden: "不知暗格",
      tasks: ["隐瞒钥匙", "观察众人"]
    }
  ]
};

test("resolveKillerRoleKey parses role key", () => {
  assert.equal(resolveKillerRoleKey({ killer: "role-3" }, characterArchives), "role-3");
  assert.equal(resolveKillerRoleKey({ killer: "丙 · 律师" }, characterArchives), "role-3");
});

test("buildSpoilerContract adds act-specific rules and killer guard", () => {
  const c = buildSpoilerContract({
    truthBible,
    config,
    actKey: "ch1",
    roleKey: "role-3",
    characterArchives,
    matrixRow: infoMatrix.rows[0]
  });
  assert.ok(c.forbiddenFacts.includes("暗格存在"));
  assert.ok(c.narrativeRules.some((r) => r.includes("第一幕")));
  assert.ok(c.narrativeRules.some((r) => r.includes("真凶位")));
});

test("buildFairnessContract references row clue ids", () => {
  const f = buildFairnessContract({
    infoMatrix,
    actKey: "ch1",
    matrixRow: infoMatrix.rows[0],
    config
  });
  assert.deepEqual(f.thisRowClueIds, ["clue-1"]);
  assert.ok(f.fairnessRules.some((r) => r.includes("newClueIds")));
});

test("buildPeerScriptDigest excludes current cell", () => {
  const digest = buildPeerScriptDigest(
    {
      "role-1": { ch1: { title: "T", body: "x".repeat(300), tasks: ["a"] } },
      "role-2": { ch1: { title: "T2", body: "y".repeat(300) } }
    },
    "ch1",
    "role-1",
    config
  );
  assert.equal(digest.length, 1);
  assert.equal(digest[0].roleKey, "role-2");
});

test("buildMatrixScriptPromptBundle merges contracts", () => {
  const bundle = buildMatrixScriptPromptBundle({
    truthBible,
    infoMatrix,
    characterArchives,
    config,
    actKey: "ch2",
    roleKey: "role-1",
    matrixRow: infoMatrix.rows[0],
    existingScripts: {
      "role-1": { ch1: { title: "A", body: "x".repeat(500), closingHook: "hook", tasks: ["t"] } }
    },
    setting: { volumeTier: "demo" }
  });
  assert.ok(bundle.roleContinuity.hasPrevious);
  assert.equal(bundle.roleContinuity.previousActs.length, 1);
  assert.equal(actIndex(config, "ch2"), 1);
});
