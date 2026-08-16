import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProposalFromMatrix,
  validateClueNetwork
} from "../src/pipeline-matrix-model.js";
import { buildClueLedger } from "../src/prompts/matrix-prompt-engine.js";

const config = { playerCount: 4, chapterKeys: ["ch1", "ch2"], title: "线索测试" };
const characters = { roles: ["role-1", "role-2", "role-3", "role-4"].map((key) => ({ key, name: key })) };
const truthBible = {
  truthNodes: [
    { key: "truth-main", statement: "仓门在警报前已被内部打开", scope: "mainline", importance: "critical" },
    { key: "truth-pair", statement: "两名角色曾私下交换钥匙", scope: "relationship", importance: "local" }
  ]
};

function clue(key, overrides = {}) {
  return {
    key,
    name: key,
    description: `${key} 上只有可观察的折痕与编号`,
    hostMeaning: `${key} 在幕后因果中的真实含义`,
    actKey: "ch1",
    scope: "private",
    function: "truth",
    involvedRoleKeys: ["role-1"],
    holderRoleKeys: ["role-1"],
    interpreterRoleKeys: ["role-1"],
    misreaderRoleKeys: [],
    truthNodeKeys: ["truth-main"],
    grantMode: "auto",
    source: "ClueCard",
    physicalForm: "纸卡",
    affordances: ["折叠"],
    acquisition: { method: "打开自己的工具盒取得", location: "仓库", condition: "开场后" },
    misleadingRead: "编号像是当天新写的",
    recontextualizedByClueKeys: [],
    publicImpact: "",
    interference: { canHide: false, canDestroy: false, canSwap: false, cost: "", traceClueKey: "" },
    missingEffect: { type: "harder_inference", description: "主线仍可走另一条路径，但需要公开一次私人证词" },
    settlementUse: "",
    conflictingInterpretations: ["旧编号", "新编号"],
    ...overrides
  };
}

function networkFixture() {
  return {
    version: "1.0",
    clues: [
      clue("clue-private"),
      clue("clue-pair", {
        actKey: "ch2", scope: "pair", involvedRoleKeys: ["role-2", "role-3"], holderRoleKeys: ["role-2"],
        interpreterRoleKeys: ["role-3"], source: "Personal_Memory"
      }),
      clue("clue-relationship", {
        actKey: "ch2", scope: "pair", function: "relationship", involvedRoleKeys: ["role-1", "role-2"],
        holderRoleKeys: ["role-2"], truthNodeKeys: ["truth-pair"]
      }),
      clue("clue-public", {
        scope: "public_anchor", involvedRoleKeys: ["role-1", "role-2", "role-3", "role-4"], holderRoleKeys: [],
        interpreterRoleKeys: [], truthNodeKeys: [], grantMode: "host_confirm",
        publicImpact: "警报亮起并锁住出口，全桌都失去离场条件"
      })
    ],
    truthCoverage: [
      {
        truthNodeKey: "truth-main",
        paths: [
          { key: "path-paper", channel: "physical", clueKeys: ["clue-private"] },
          { key: "path-memory", channel: "testimony", clueKeys: ["clue-pair"] }
        ],
        fallback: "任一路径缺失时，玩家可公开另一人的私人关系，换取检查仓门记录的机会"
      },
      {
        truthNodeKey: "truth-pair",
        paths: [{ key: "path-relation", channel: "relationship", clueKeys: ["clue-relationship"] }],
        fallback: "该支线可能关闭，但不阻断主线"
      }
    ],
    links: [{ fromClueKey: "clue-relationship", toClueKey: "clue-pair", relationType: "recontextualizes", reason: "交换钥匙改变证词含义" }],
    publicAnchorKeys: ["clue-public"],
    suggestions: []
  };
}

test("validates sparse local clues and two independent paths for critical truth", () => {
  const network = validateClueNetwork(networkFixture(), config, characters, truthBible, {});
  assert.equal(network.clues.length, 4);
  assert.equal(network.truthCoverage[0].paths.length, 2);
  assert.deepEqual(network.publicAnchorKeys, ["clue-public"]);
});

test("rejects a non-public clue that force-links every role", () => {
  const value = networkFixture();
  value.clues[3].scope = "mainline";
  value.clues[3].publicImpact = "";
  value.publicAnchorKeys = [];
  assert.throws(
    () => validateClueNetwork(value, config, characters, truthBible, {}),
    /强行关联全员/
  );
});

test("rejects clue destruction without a cost", () => {
  const value = networkFixture();
  value.clues[0].interference.canDestroy = true;
  assert.throws(
    () => validateClueNetwork(value, config, characters, truthBible, {}),
    /必须登记真实代价/
  );
});

test("allows high-cost destruction without a trace but rejects cheap no-trace interference", () => {
  const value = networkFixture();
  value.clues[0].interference = {
    canDestroy: true,
    cost: "烧掉线索会同时失去角色自己的唯一收据",
    costSeverity: "high",
    traceMode: "none_high_cost",
    traceClueKey: ""
  };
  assert.doesNotThrow(() => validateClueNetwork(value, config, characters, truthBible, {}));
  value.clues[0].interference.costSeverity = "low";
  assert.throws(
    () => validateClueNetwork(value, config, characters, truthBible, {}),
    /必须支付 high 级别代价/
  );
});

test("role clue ledger excludes another role's auto clue and includes public anchors", () => {
  const network = validateClueNetwork(networkFixture(), config, characters, truthBible, {});
  const infoMatrix = {
    clues: network.clues,
    rows: [
      { roleKey: "role-1", actKey: "ch1", newClueIds: ["clue-private"] },
      { roleKey: "role-2", actKey: "ch2", newClueIds: ["clue-pair", "clue-relationship"] }
    ]
  };
  const ledger = buildClueLedger(infoMatrix, "ch2", { roleKey: "role-1", config });
  assert.ok(ledger.some((item) => item.key === "clue-private"));
  assert.ok(ledger.some((item) => item.key === "clue-public"));
  assert.ok(!ledger.some((item) => item.key === "clue-pair"));
  assert.ok(ledger.every((item) => !("hostMeaning" in item)));
});

test("proposal uses only declared clue links and only public anchors become public", () => {
  const network = validateClueNetwork(networkFixture(), config, characters, truthBible, {});
  const proposal = buildProposalFromMatrix({
    setting: {}, config, truthBible: { summary: "x".repeat(240) }, clueNetwork: network,
    infoMatrix: { clues: network.clues, rows: [], actTitles: { ch1: "一", ch2: "二" }, scenes: [] }
  });
  const clueEdges = proposal.edges.filter((edge) => edge.fromType === "clue" && edge.toType === "clue");
  assert.equal(clueEdges.length, 1);
  assert.equal(proposal.clues.find((item) => item.key === "clue-private").visibility, "role");
  assert.equal(proposal.clues.find((item) => item.key === "clue-public").visibility, "public");
});
