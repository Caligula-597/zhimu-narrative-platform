import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENCY_RESOURCE_KEY,
  compileMechanismPackage,
  ensureCurrencyResource,
} from "../src/mechanism-package.js";
import {
  executeMechanismInvestigation,
  initializeMechanismRuntime,
  projectMechanismRuntime,
} from "../src/mechanism-runtime.js";
import {
  MINI_GAME_PLUGIN_KEYS,
  normalizeMiniGameTemplate,
} from "../../shared/mini-game-protocol.js";

function searchPackage() {
  return compileMechanismPackage({
    semanticConstitution: {
      facts: [],
      authorizationGrants: [],
      branchEvents: [],
      worldRules: [],
    },
    causalTimeline: [],
    entities: [{ key: "room-a", type: "location", name: "厅堂" }],
    resources: [
      {
        key: "search-token",
        name: "搜证次数",
        valueType: "integer",
        initialValue: 2,
        minimum: 0,
        maximum: 2,
      },
    ],
    players: [],
    evidenceGraph: {
      evidence: [
        {
          key: "evidence-log",
          label: "日志残页",
          availableChapterKey: "round-1",
          obtainedBy: "搜查",
          methodOperation: "翻找",
          artifactProduced: "残页",
          originRootKeys: ["room-a"],
          storageEntityKey: "room-a",
          maxUses: 2,
          costResourceKey: "search-token",
          costAmount: 1,
        },
      ],
      conclusions: [],
    },
    chapterBeats: [
      {
        chapterKey: "round-1",
        title: "搜查",
        stateReads: [],
        stateWrites: [],
        resourceDeltas: [],
        evidenceKeys: ["evidence-log"],
        unlocksEvidenceKeys: [],
        locksEvidenceKeys: [],
      },
    ],
    endingLogic: {
      stateVariables: [],
      routes: [
        {
          key: "ending-default",
          title: "结束",
          priority: 0,
          isDefault: true,
          requirements: [],
        },
      ],
      roleEpilogues: [],
      defaultRouteKey: "ending-default",
      conflictResolution: "",
    },
    misdirections: [],
  });
}

test("currency resource stub is ensured", () => {
  const resources = ensureCurrencyResource([]);
  assert.equal(resources.some((row) => row.key === CURRENCY_RESOURCE_KEY), true);
  const compiled = searchPackage();
  assert.equal(
    compiled.resourceRegistry.some((row) => row.key === CURRENCY_RESOURCE_KEY),
    true,
  );
});

test("investigation cost and maxUses deplete search budget", () => {
  const packageValue = searchPackage();
  const action = packageValue.investigationActions.find(
    (row) => row.evidenceKey === "evidence-log",
  );
  assert.ok(action);
  assert.equal(action.maxUses, 2);
  assert.equal(action.cost?.resourceKey, "search-token");
  assert.equal(action.cost?.amount, 1);

  const { runtime } = initializeMechanismRuntime(packageValue);
  assert.equal(runtime.resources["search-token"], 2);

  const first = executeMechanismInvestigation(runtime, packageValue, {
    investigationKey: action.key,
    outcome: "success",
  });
  assert.equal(first.runtime.resources["search-token"], 1);
  assert.equal(first.runtime.investigationUseCounts[action.key], 1);
  assert.equal(first.runtime.executedInvestigations[action.key], undefined);

  const projected = projectMechanismRuntime(first.runtime, packageValue);
  assert.equal(
    projected.availableInvestigations.some((row) => row.key === action.key),
    true,
  );

  const second = executeMechanismInvestigation(first.runtime, packageValue, {
    investigationKey: action.key,
    outcome: "success",
  });
  assert.equal(second.runtime.resources["search-token"], 0);
  assert.equal(second.runtime.investigationUseCounts[action.key], 2);
  assert.equal(second.runtime.executedInvestigations[action.key], "success");

  assert.throws(
    () =>
      executeMechanismInvestigation(second.runtime, packageValue, {
        investigationKey: action.key,
        outcome: "success",
      }),
    (error) => error.code === "MECHANISM_INVESTIGATION_ALREADY_RESOLVED",
  );
});

test("mini-game protocol accepts sequence plugin", () => {
  assert.equal(MINI_GAME_PLUGIN_KEYS.includes("zhimu_sequence"), true);
  const template = normalizeMiniGameTemplate({
    pluginKey: "zhimu_sequence",
    title: "歌单还原",
    answer: "春,夏,秋,冬",
  });
  assert.equal(template.pluginKey, "zhimu_sequence");
  assert.equal(template.answer, "春,夏,秋,冬");
  assert.equal(template.length, 4);
});
