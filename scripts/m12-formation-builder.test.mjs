/**
 * F2 — M12 Formation Blueprint + Builder V1 tests（Authority Hardening 后）。
 *
 * PASS Gate 对照：
 *  1  pack 只有 formationBlueprint，不含 Gold 节点/角色/剧情
 *  2  Builder 输出合法 F1 Artifact（与 normalize(Gold) deepEqual）
 *  3  八字段仍只引用 nodes
 *  4  Builder 不得把缺失内容 normalize 成成立（负例：mode/type/proof 缺失拒绝）
 *  5  Builder 不得制造预写成交（负例：事件字段/非 OPEN resolution 拒绝）
 *  6  INFERENCE 仍不污染 Canon（负例：无 subject/无 requires 拒绝）
 *  7  Golden fixture 可构建
 *  8  第二种不同 Formation topology 也可构建（且结构确与 Gold 不同）
 *  9  source block revision 正确绑定（= state 内 block.revision，调用方无伪造入口）
 * 10  输出最多 READY_FOR_VALIDATION
 * 11  不产生 FORMATION_READY
 * 12  不碰 F3/F4/Writer/P6/M07/M08（由实现范围保证：仅 pack additive + 新文件）
 *
 * Authority Hardening（PARTIAL_PASS blocker 收口）：
 *  A1  STATE_BLOCK_NOT_FOUND：sourceBlockId 不在 state.mechanismBlocks → fail
 *  A2  revision authority：artifact.sourceBlockRevision 只能来自 state 内 block
 *  A3  role authority：artifact.participants 只能来自 state 内 block.roleBindings
 *  A4  project authority：artifact.projectId 只能来自 state.projectId
 *  （调用方传入的 projectId/block/revision/participants 一律被忽略）
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildM12CompleteTemplates } from "../shared/story-mechanism-m12-pack.js";
import { buildM12FormationArtifact } from "../shared/m12-formation-builder.js";
import { createProjectStoryState } from "../shared/story-mechanism-contracts.js";
import {
  normalizeM12FormationArtifact,
  FORMATION_FIELD_KEYS,
  M12_FORMATIONATION_FORBIDDEN_ARTIFACT_STATUSES,
} from "../shared/m12-formation-contracts.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GOLD_PATH = path.join(root, "fixtures/m12-formation/closed-after-hours-gold.json");
const ALT_PATH = path.join(root, "fixtures/m12-formation/sealed-room-alt-topology.json");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** 权威 state：projectId + accepted M12-1 block（roleBindings 从 fixture participants 绑定） */
function stateFor(fixture, blockOverrides = {}) {
  return createProjectStoryState({
    projectId: fixture.projectId,
    mechanismBlocks: [
      {
        id: fixture.sourceBlockId,
        templateId: "M12-1",
        revision: fixture.sourceBlockRevision,
        status: "USER_ACCEPTED",
        roleBindings: {
          bargainA: fixture.participants.seekerId,
          bargainB: fixture.participants.holderId,
        },
        ...blockOverrides,
      },
    ],
  });
}

function buildFixture(fixture, opts = {}) {
  return buildM12FormationArtifact({
    state: opts.state || stateFor(fixture, opts.blockOverrides),
    sourceBlockId: opts.sourceBlockId ?? fixture.sourceBlockId,
    artifactId: opts.artifactId ?? fixture.id,
    authoredFormation: {
      stake: fixture.stake,
      nodes: fixture.nodes,
      formation: fixture.formation,
      proof: fixture.proof,
    },
  });
}

/** 基于第二 fixture 做破坏性变异后再构建（负例专用） */
function buildMutatedAlt(mutate) {
  const fixture = loadJson(ALT_PATH);
  mutate(fixture);
  return buildFixture(fixture);
}

function expectError(result, code) {
  assert.equal(result.ok, false, `expected failure, got: ${JSON.stringify(result).slice(0, 300)}`);
  assert.equal(result.artifact, undefined, "失败时不得产出 Artifact");
  assert.ok(
    result.errors.some((e) => e.code === code),
    `expected ${code}, got: ${JSON.stringify(result.errors)}`,
  );
}

function nodeById(artifact, id) {
  return artifact.nodes.find((n) => n.id === id);
}

// ── Gate 1：Blueprint 是能力约束，不是剧情模板 ─────────────────────

test("F2 pack formationBlueprint is capability-only (no story content)", () => {
  const tpl = buildM12CompleteTemplates().find((t) => t.id === "M12-1");
  assert.ok(tpl, "M12-1 template missing");
  const bp = tpl.formationBlueprint;
  assert.ok(bp, "formationBlueprint missing");

  assert.deepEqual(bp.requiredCapabilities, [
    "VALUE_SOURCE",
    "EXISTENCE_SOURCE",
    "KNOWLEDGE_PATH",
    "LOCATOR_PATH",
    "COUNTERPART_LEVERAGE",
    "LEVERAGE_PROVENANCE",
    "COUNTERPART_NEED",
    "NEED_RECOGNITION",
    "WORLD_TRIGGER",
  ]);
  assert.deepEqual(bp.forbiddenSemantics, [
    "UNSOURCED_ANSWER",
    "UNSOURCED_LEVERAGE",
    "PREWRITTEN_DEAL",
  ]);
  assert.deepEqual(Object.keys(bp).sort(), ["forbiddenSemantics", "requiredCapabilities"]);

  // 零剧情内容：无中文、无节点 id、无角色/标的词汇
  const json = JSON.stringify(bp);
  assert.ok(!/[\u4e00-\u9fff]/.test(json), "blueprint 不得含中文剧情内容");
  assert.ok(!/\b[NK]\d/.test(json), "blueprint 不得引用具体节点 id");
});

// ── Gate 7 / 2 / 3：Golden fixture 可构建，且等于 F1 Gold Artifact ──

test("F2 golden fixture builds into exactly the F1 gold artifact", () => {
  const gold = loadJson(GOLD_PATH);
  const result = buildFixture(gold);
  assert.equal(result.ok, true, JSON.stringify(result.errors || result).slice(0, 400));
  assert.deepEqual(result.artifact, normalizeM12FormationArtifact(gold));
});

test("F2 builder output: eight formation fields still only reference existing nodes", () => {
  const result = buildFixture(loadJson(GOLD_PATH));
  assert.equal(result.ok, true);
  const a = result.artifact;
  const ids = new Set(a.nodes.map((n) => n.id));
  for (const key of FORMATION_FIELD_KEYS) {
    assert.equal(Object.keys(a.formation[key]).join(","), "nodeIds", `${key} must only carry nodeIds`);
    assert.ok(a.formation[key].nodeIds.length, `${key} empty`);
    for (const id of a.formation[key].nodeIds) {
      assert.ok(ids.has(id), `${key} → missing ${id}`);
    }
  }
});

// ── Gate 8：不同 topology 也可构建 ────────────────────────────────

test("F2 different-topology fixture builds (holder public, unknown is the need)", () => {
  const alt = loadJson(ALT_PATH);
  const result = buildFixture(alt);
  assert.equal(result.ok, true, JSON.stringify(result.errors || result).slice(0, 400));
  assert.deepEqual(result.artifact, normalizeM12FormationArtifact(alt));
});

test("F2 gold and alt differ structurally (blueprint is not a plot template)", () => {
  const gold = buildFixture(loadJson(GOLD_PATH)).artifact;
  const alt = buildFixture(loadJson(ALT_PATH)).artifact;

  // 定位路径：Gold 5 节点收窄（N5–N9） vs Alt 1 节点公开已知（K1）
  assert.equal(gold.formation.locatorPath.nodeIds.length, 5);
  assert.equal(alt.formation.locatorPath.nodeIds.length, 1);

  // 存在来源：Gold=推断（N3 INFERENCE） vs Alt=有来源的开场已知（K0b MEMORY）
  assert.equal(nodeById(gold, gold.formation.existenceSource.nodeIds[0]).kind, "INFERENCE");
  assert.equal(nodeById(alt, alt.formation.existenceSource.nodeIds[0]).kind, "MEMORY");
  assert.equal(nodeById(alt, alt.formation.existenceSource.nodeIds[0]).acquisition.mode, "OPENING_OWNED");

  // 需求识别：Gold=直接目击（N11b OBSERVABLE） vs Alt=推断式识别（K6 INFERENCE）
  assert.equal(
    nodeById(gold, gold.proof.bilateralLeverage.seekerRecognitionNodeIds[0]).kind,
    "OBSERVABLE",
  );
  assert.equal(
    nodeById(alt, alt.proof.bilateralLeverage.seekerRecognitionNodeIds[0]).kind,
    "INFERENCE",
  );

  // holder 公开性：Alt 的 knowledgePath 节点对全员可见
  const altK1 = nodeById(alt, alt.formation.knowledgePath.nodeIds[0]);
  assert.deepEqual(altK1.visibleToIds, ["P1", "P2", "P3"]);

  // 两个 fixture 的节点集零交集（不同剧情实体，非同一骨架换皮）
  const goldIds = new Set(gold.nodes.map((n) => n.id));
  const overlap = alt.nodes.map((n) => n.id).filter((id) => goldIds.has(id));
  assert.deepEqual(overlap, []);
});

// ── Authority Hardening：项目事实唯一权威 = ProjectStoryState ─────

test("F2 authority: sourceBlockId not in state.mechanismBlocks is rejected", () => {
  const alt = loadJson(ALT_PATH);
  expectError(buildFixture(alt, { sourceBlockId: "smb-does-not-exist" }), "STATE_BLOCK_NOT_FOUND");
});

test("F2 authority: sourceBlockRevision comes from state block; caller cannot fake it", () => {
  const alt = loadJson(ALT_PATH);
  const state = stateFor(alt, { revision: 7 });
  const result = buildM12FormationArtifact({
    state,
    sourceBlockId: alt.sourceBlockId,
    artifactId: alt.id,
    authoredFormation: {
      stake: alt.stake,
      nodes: alt.nodes,
      formation: alt.formation,
      proof: alt.proof,
    },
    // 调用方伪造入口（必须被完全忽略）：
    revision: 6,
    sourceBlockRevision: 6,
    block: { id: alt.sourceBlockId, templateId: "M12-1", revision: 6, status: "USER_ACCEPTED" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.artifact.sourceBlockRevision, 7);
  assert.notEqual(result.artifact.sourceBlockRevision, alt.sourceBlockRevision);
});

test("F2 authority: participants come from state block roleBindings; caller cannot fake them", () => {
  const alt = loadJson(ALT_PATH);
  const state = stateFor(alt, {
    roleBindings: { bargainA: "P3", bargainB: "P2" },
  });
  const result = buildM12FormationArtifact({
    state,
    sourceBlockId: alt.sourceBlockId,
    artifactId: alt.id,
    authoredFormation: {
      stake: alt.stake,
      nodes: alt.nodes,
      formation: alt.formation,
      proof: alt.proof,
    },
    // 调用方伪造 participants（必须被完全忽略）：
    participants: { seekerId: "P9", holderId: "P8" },
    seekerId: "P9",
    holderId: "P8",
  });
  assert.equal(result.ok, true);
  assert.equal(result.artifact.participants.seekerId, "P3");
  assert.equal(result.artifact.participants.holderId, "P2");
  assert.notEqual(result.artifact.participants.seekerId, alt.participants.seekerId);
});

test("F2 authority: projectId comes from state; caller cannot fake it", () => {
  const alt = loadJson(ALT_PATH);
  const state = stateFor(alt);
  const result = buildM12FormationArtifact({
    state,
    sourceBlockId: alt.sourceBlockId,
    artifactId: alt.id,
    authoredFormation: {
      stake: alt.stake,
      nodes: alt.nodes,
      formation: alt.formation,
      proof: alt.proof,
    },
    // 调用方伪造 projectId（必须被完全忽略）：
    projectId: "fake-project",
  });
  assert.equal(result.ok, true);
  assert.equal(result.artifact.projectId, alt.projectId);
  assert.notEqual(result.artifact.projectId, "fake-project");
});

test("F2 authority: missing state is rejected", () => {
  const alt = loadJson(ALT_PATH);
  const result = buildM12FormationArtifact({
    sourceBlockId: alt.sourceBlockId,
    authoredFormation: {
      stake: alt.stake,
      nodes: alt.nodes,
      formation: alt.formation,
      proof: alt.proof,
    },
  });
  expectError(result, "STATE_MISSING");
});

// ── Gate 9：source block revision 正确绑定（state → artifact）─────

test("F2 builder binds sourceBlockId/revision from the state block", () => {
  const alt = loadJson(ALT_PATH);
  const result = buildFixture(alt, { blockOverrides: { revision: 7 } });
  assert.equal(result.ok, true);
  assert.equal(result.artifact.sourceBlockId, alt.sourceBlockId);
  assert.equal(result.artifact.sourceBlockRevision, 7);
  assert.notEqual(result.artifact.sourceBlockRevision, alt.sourceBlockRevision);
});

// ── Gate 10 / 11：输出最多 READY_FOR_VALIDATION ───────────────────

test("F2 output caps at READY_FOR_VALIDATION and never FORMATION_READY", () => {
  for (const p of [GOLD_PATH, ALT_PATH]) {
    const result = buildFixture(loadJson(p));
    assert.equal(result.ok, true);
    assert.equal(result.artifact.status, "READY_FOR_VALIDATION");
    assert.ok(!M12_FORMATIONATION_FORBIDDEN_ARTIFACT_STATUSES.includes(result.artifact.status));
    assert.equal(result.artifact.revision, 1);
  }
});

// ── 负例：block / 绑定（block 住在 state 里，伪造入口已封死）──────

test("F2 negative: non-accepted block is rejected", () => {
  const alt = loadJson(ALT_PATH);
  expectError(buildFixture(alt, { blockOverrides: { status: "DRAFT" } }), "BLOCK_NOT_ACCEPTED");
});

test("F2 negative: non-M12-1 block is rejected", () => {
  const alt = loadJson(ALT_PATH);
  expectError(buildFixture(alt, { blockOverrides: { templateId: "M11-1" } }), "BLOCK_NOT_M12_1");
});

test("F2 negative: missing or identical role bindings are rejected", () => {
  const alt = loadJson(ALT_PATH);
  expectError(
    buildFixture(alt, { blockOverrides: { roleBindings: { bargainA: "P1" } } }),
    "ROLE_BINDING_MISSING",
  );
  expectError(
    buildFixture(alt, {
      blockOverrides: { roleBindings: { bargainA: "P1", bargainB: "P1" } },
    }),
    "ROLE_BINDING_IDENTICAL",
  );
});

// ── Gate 4 负例：缺失不被 normalize 成成立 ────────────────────────

test("F2 negative: missing acquisition.mode is rejected, never defaulted to GUARANTEED", () => {
  expectError(
    buildMutatedAlt((f) => {
      delete f.nodes.find((n) => n.id === "K1").acquisition;
    }),
    "NODE_ACQUISITION_UNRESOLVED",
  );
  expectError(
    buildMutatedAlt((f) => {
      f.nodes.find((n) => n.id === "K1").acquisition = { mode: "WRONG_MODE" };
    }),
    "NODE_ACQUISITION_UNRESOLVED",
  );
});

test("F2 negative: missing/invalid provenance.type is rejected, never defaulted to LOCKED_FACT", () => {
  expectError(
    buildMutatedAlt((f) => {
      delete f.nodes.find((n) => n.id === "K5").provenance;
    }),
    "NODE_PROVENANCE_UNRESOLVED",
  );
  expectError(
    buildMutatedAlt((f) => {
      f.nodes.find((n) => n.id === "K5").provenance = { type: "GUESS" };
    }),
    "NODE_PROVENANCE_UNRESOLVED",
  );
});

test("F2 negative: missing proof booleans are rejected, never defaulted to true", () => {
  expectError(
    buildMutatedAlt((f) => {
      delete f.proof.noPreWrittenDeal;
      delete f.proof.noUnsourcedAnswer;
    }),
    "PROOF_FLAG_UNRESOLVED",
  );
});

test("F2 negative: invalid node kind is rejected (no EXCHANGE_EVENT-style nodes)", () => {
  expectError(
    buildMutatedAlt((f) => {
      f.nodes.find((n) => n.id === "K5").kind = "EXCHANGE_EVENT";
    }),
    "NODE_KIND_INVALID",
  );
});

// ── Gate 5 负例：不制造预写成交 ───────────────────────────────────

test("F2 negative: LEVERAGE_EDGE with event fields or non-OPEN resolution is rejected", () => {
  expectError(
    buildMutatedAlt((f) => {
      f.nodes.find((n) => n.id === "K9").tradeCompleted = true;
    }),
    "LEVERAGE_EDGE_INPUT_PREWRITTEN",
  );
  expectError(
    buildMutatedAlt((f) => {
      f.nodes.find((n) => n.id === "K9").gave = "K3";
    }),
    "LEVERAGE_EDGE_INPUT_PREWRITTEN",
  );
  expectError(
    buildMutatedAlt((f) => {
      f.nodes.find((n) => n.id === "K9").resolution = "COMPLETED";
    }),
    "LEVERAGE_EDGE_INPUT_PREWRITTEN",
  );
});

// ── Gate 6 负例：INFERENCE 不污染 Canon ───────────────────────────

test("F2 negative: INFERENCE without subject is rejected (no canon pollution)", () => {
  expectError(
    buildMutatedAlt((f) => {
      const k6 = f.nodes.find((n) => n.id === "K6");
      delete k6.subjectCharacterId;
      k6.holderIds = [];
      k6.visibleToIds = [];
    }),
    "INFERENCE_MISSING_SUBJECT",
  );
});

test("F2 negative: INFERENCE without requires is rejected (unsourced answer)", () => {
  expectError(
    buildMutatedAlt((f) => {
      f.nodes.find((n) => n.id === "K6").requiresNodeIds = [];
    }),
    "INFERENCE_UNSOURCED",
  );
});

// ── 负例：八字段 / Blueprint 能力覆盖 ─────────────────────────────

test("F2 negative: dangling formation field ref is rejected", () => {
  expectError(
    buildMutatedAlt((f) => {
      f.formation.valueSource = { nodeIds: ["K999"] };
    }),
    "FORMATION_FIELD_DANGLING_REF",
  );
});

test("F2 negative: empty formation field is rejected", () => {
  expectError(
    buildMutatedAlt((f) => {
      delete f.formation.trigger;
    }),
    "FORMATION_FIELD_EMPTY",
  );
});

test("F2 negative: uncovered blueprint capability is rejected (NEED_RECOGNITION)", () => {
  expectError(
    buildMutatedAlt((f) => {
      f.proof.bilateralLeverage.seekerRecognitionNodeIds = [];
    }),
    "BLUEPRINT_CAPABILITY_UNCOVERED",
  );
});
