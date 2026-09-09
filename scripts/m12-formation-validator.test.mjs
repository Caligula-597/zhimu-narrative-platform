/**
 * F3 — M12 Formation Validator / Gate V1 tests.
 *
 * PASS Gate 对照（15 条）：
 *  1  Validator 只读，不修改 Artifact / State
 *  2  只从 ProjectStoryState + artifactId 读取权威数据（caller 递入 artifact 被忽略）
 *  3  Artifact STALE 必须 BLOCK
 *  4  Artifact status 不被改成 FORMATION_READY
 *  5  Gold → FORMATION_READY / issues=[]
 *  6  Alt → FORMATION_READY / issues=[]
 *  7  Direct Bargain Table 能过 F2，但 F3 必须 REVIEW_REQUIRED
 *  8  11 个 Formation issue 都至少有确定性负例（Gold/Alt mutation）
 *  9  Guaranteed spine 不允许依赖 CONFIDENCE_BOOST
 * 10  seeker leverage 必须真实可拥有/可达
 * 11  holder need 与 seeker recognition 分开验证
 * 12  trigger 必须对 seeker 可感知
 * 13  meta prompt 只做窄 deterministic lint（Gold/Alt 世界内 acquisition 文本零误报）
 * 14  不跑 LLM（纯 deterministic 实现）
 * 15  不碰 Integrator / PMD / Writer / M07 / M08（仅新增文件）
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateM12Formation } from "../shared/m12-formation-validator.js";
import { buildM12FormationArtifact } from "../shared/m12-formation-builder.js";
import { createProjectStoryState } from "../shared/story-mechanism-contracts.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GOLD_PATH = path.join(root, "fixtures/m12-formation/closed-after-hours-gold.json");
const ALT_PATH = path.join(root, "fixtures/m12-formation/sealed-room-alt-topology.json");
const NEG_PATH = path.join(root, "fixtures/m12-formation/direct-bargain-table-negative.json");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function blockFor(artifact, revision = artifact.sourceBlockRevision) {
  return {
    id: artifact.sourceBlockId,
    templateId: "M12-1",
    revision,
    status: "USER_ACCEPTED",
    roleBindings: {
      bargainA: artifact.participants.seekerId,
      bargainB: artifact.participants.holderId,
    },
  };
}

function stateWithArtifact(artifact, { blockRevision } = {}) {
  return createProjectStoryState({
    projectId: artifact.projectId,
    mechanismBlocks: [blockFor(artifact, blockRevision ?? artifact.sourceBlockRevision)],
    m12FormationArtifacts: [artifact],
  });
}

/** 用 F2 Builder（state-authoritative）构建 fixture */
function buildViaF2(fixture) {
  const state = createProjectStoryState({
    projectId: fixture.projectId,
    mechanismBlocks: [blockFor(fixture)],
  });
  return buildM12FormationArtifact({
    state,
    sourceBlockId: fixture.sourceBlockId,
    artifactId: fixture.id,
    authoredFormation: {
      stake: fixture.stake,
      nodes: fixture.nodes,
      formation: fixture.formation,
      proof: fixture.proof,
    },
  });
}

function validateMutatedGold(mutate) {
  const gold = loadJson(GOLD_PATH);
  mutate(gold);
  return validateM12Formation({ state: stateWithArtifact(gold), artifactId: gold.id });
}

function expectIssue(result, code) {
  assert.equal(result.decision, "FORMATION_REVIEW_REQUIRED");
  assert.ok(
    result.issues.some((i) => i.code === code),
    `expected ${code}, got: ${JSON.stringify(result.issues.map((i) => i.code))}`,
  );
}

function nodeOf(artifact, id) {
  return artifact.nodes.find((n) => n.id === id);
}

// ── PASS：Gold / Alt ─────────────────────────────────────────────

test("F3 gold artifact → FORMATION_READY with zero issues", () => {
  const result = validateM12Formation({
    state: stateWithArtifact(loadJson(GOLD_PATH)),
    artifactId: "m12f-closed-after-hours-gold",
  });
  assert.equal(result.decision, "FORMATION_READY");
  assert.deepEqual(result.issues, []);
  assert.equal(result.checks.blocked, null);
  // spine 全部验证通过（白绫/周祁不在 guaranteed spine，可拒绝配合而不影响主链）
  assert.equal(result.checks.spine.rejected.length, 0);
  assert.ok(result.checks.spine.verified.includes("N5"));
  // 杠杆/识别/触发证据齐全
  assert.equal(result.checks.leverage.problems.length, 0);
  assert.equal(result.checks.capabilities.NEED_RECOGNITION.supported, true);
  assert.equal(result.checks.capabilities.WORLD_TRIGGER.supported, true);
});

test("F3 alt topology → FORMATION_READY with zero issues", () => {
  const result = validateM12Formation({
    state: stateWithArtifact(loadJson(ALT_PATH)),
    artifactId: "m12f-sealed-room-alt",
  });
  assert.equal(result.decision, "FORMATION_READY");
  assert.deepEqual(result.issues, []);
  // 推断式需求识别（K5 观察 → K6 actionable inference）是合法识别路径
  assert.deepEqual(result.checks.recognition.seekerReachable, { K6: true });
});

// ── 核心实验：能过 F2 的假 Formation 必须 BLOCK ────────────────────

test("F3 direct bargain table passes F2 builder (structurally complete)", () => {
  const built = buildViaF2(loadJson(NEG_PATH));
  assert.equal(built.ok, true, JSON.stringify(built.errors || built).slice(0, 400));
  assert.equal(built.artifact.status, "READY_FOR_VALIDATION");
});

test("F3 direct bargain table → REVIEW_REQUIRED (structure ≠ formation)", () => {
  const built = buildViaF2(loadJson(NEG_PATH));
  assert.equal(built.ok, true);
  const result = validateM12Formation({
    state: stateWithArtifact(built.artifact),
    artifactId: built.artifact.id,
  });
  assert.equal(result.decision, "FORMATION_REVIEW_REQUIRED");
  const codes = result.issues.map((i) => i.code);
  // 至少打出三把刀：识别不可达 / boost 混入 spine / 作者指令 trigger
  assert.ok(codes.includes("FORMATION_NEED_NOT_RECOGNIZABLE"), JSON.stringify(codes));
  assert.ok(codes.includes("FORMATION_SINGLE_POINT_DEPENDENCY"), JSON.stringify(codes));
  assert.ok(codes.includes("FORMATION_META_PROMPT_DEPENDENCY"), JSON.stringify(codes));
  assert.deepEqual(codes.sort(), [
    "FORMATION_META_PROMPT_DEPENDENCY",
    "FORMATION_NEED_NOT_RECOGNIZABLE",
    "FORMATION_SINGLE_POINT_DEPENDENCY",
  ]);
  // 具体证据：D5 只对 holder 可达；D6 是 boost；D7 是作者指令
  assert.deepEqual(result.checks.spine.rejected.map((r) => r.nodeId).sort(), ["D5", "D6"]);
  assert.deepEqual(result.checks.recognition.seekerReachable, { D5: false });
  assert.ok(result.checks.lint.metaPrompt.some((h) => h.nodeId === "D7"));
});

// ── 基础 blocker ─────────────────────────────────────────────────

test("F3 base blocker: unknown artifactId → FORMATION_ARTIFACT_NOT_FOUND", () => {
  const result = validateM12Formation({
    state: stateWithArtifact(loadJson(GOLD_PATH)),
    artifactId: "m12f-does-not-exist",
  });
  assert.equal(result.decision, "FORMATION_REVIEW_REQUIRED");
  assert.equal(result.issues[0].code, "FORMATION_ARTIFACT_NOT_FOUND");
  assert.equal(result.checks.blocked, "FORMATION_ARTIFACT_NOT_FOUND");
});

test("F3 base blocker: stale artifact → FORMATION_ARTIFACT_STALE", () => {
  const gold = loadJson(GOLD_PATH);
  const result = validateM12Formation({
    state: stateWithArtifact(gold, { blockRevision: gold.sourceBlockRevision + 1 }),
    artifactId: gold.id,
  });
  assert.equal(result.issues[0].code, "FORMATION_ARTIFACT_STALE");
  assert.equal(result.checks.blocked, "FORMATION_ARTIFACT_STALE");
});

test("F3 base blocker: DRAFT artifact → FORMATION_ARTIFACT_NOT_READY", () => {
  const gold = loadJson(GOLD_PATH);
  gold.status = "DRAFT";
  const result = validateM12Formation({
    state: stateWithArtifact(gold),
    artifactId: gold.id,
  });
  assert.equal(result.issues[0].code, "FORMATION_ARTIFACT_NOT_READY");
  assert.equal(result.checks.blocked, "FORMATION_ARTIFACT_NOT_READY");
});

test("F3 base blocker: missing state → STATE_MISSING", () => {
  const result = validateM12Formation({ artifactId: "m12f-closed-after-hours-gold" });
  assert.equal(result.issues[0].code, "STATE_MISSING");
  assert.equal(result.checks.blocked, "STATE_MISSING");
});

// ── 只读 / 权威 ──────────────────────────────────────────────────

test("F3 gate is read-only (state and artifact untouched)", () => {
  const state = stateWithArtifact(loadJson(GOLD_PATH));
  const before = JSON.parse(JSON.stringify(state));
  const result = validateM12Formation({ state, artifactId: "m12f-closed-after-hours-gold" });
  assert.equal(result.decision, "FORMATION_READY");
  assert.deepEqual(JSON.parse(JSON.stringify(state)), before);
  // decision 不回写 artifact.status
  assert.equal(state.m12FormationArtifacts[0].status, "READY_FOR_VALIDATION");
});

test("F3 authority: caller-supplied artifact is ignored (state is the only source)", () => {
  const gold = loadJson(GOLD_PATH);
  const alt = loadJson(ALT_PATH);
  const result = validateM12Formation({
    state: stateWithArtifact(gold),
    artifactId: gold.id,
    artifact: alt, // 伪造入口：必须被完全忽略
  });
  assert.equal(result.artifactId, gold.id);
  assert.equal(result.decision, "FORMATION_READY");
  assert.equal(result.sourceBlockId, gold.sourceBlockId);
});

// ── 11 个主错误码的确定性负例（Gold mutation）────────────────────

test("F3 negative: FORMATION_VALUE_UNSOURCED (no seeker-reachable value node)", () => {
  const result = validateMutatedGold((g) => {
    g.proof.guaranteedPathToContactReason = g.proof.guaranteedPathToContactReason.filter(
      (id) => id !== "N1",
    );
    const n2 = nodeOf(g, "N2");
    n2.holderIds = ["P3"];
    n2.visibleToIds = ["P3"];
    n2.acquisition.whoCanAcquireIds = ["P3"];
  });
  expectIssue(result, "FORMATION_VALUE_UNSOURCED");
  assert.equal(result.checks.capabilities.VALUE_SOURCE.supported, false);
});

test("F3 negative: FORMATION_EXISTENCE_UNSOURCED (inference premise unreachable)", () => {
  const result = validateMutatedGold((g) => {
    nodeOf(g, "N3").requiresNodeIds = ["N6"]; // N6 是 CONFIDENCE_BOOST
  });
  expectIssue(result, "FORMATION_EXISTENCE_UNSOURCED");
  assert.equal(result.checks.capabilities.EXISTENCE_SOURCE.supported, false);
});

test("F3 negative: FORMATION_KNOWLEDGE_PATH_MISSING (N4 out of spine)", () => {
  const result = validateMutatedGold((g) => {
    g.proof.guaranteedPathToContactReason = g.proof.guaranteedPathToContactReason.filter(
      (id) => id !== "N4",
    );
  });
  expectIssue(result, "FORMATION_KNOWLEDGE_PATH_MISSING");
  assert.equal(result.checks.capabilities.KNOWLEDGE_PATH.supported, false);
});

test("F3 negative: FORMATION_LOCATOR_PATH_MISSING (N5/N9 out of spine, only boosts left)", () => {
  const result = validateMutatedGold((g) => {
    g.proof.guaranteedPathToContactReason = g.proof.guaranteedPathToContactReason.filter(
      (id) => id !== "N5" && id !== "N9",
    );
  });
  expectIssue(result, "FORMATION_LOCATOR_PATH_MISSING");
  assert.equal(result.checks.capabilities.LOCATOR_PATH.supported, false);
});

test("F3 negative: FORMATION_LEVERAGE_UNSOURCED (leverage not in seeker's hands)", () => {
  const result = validateMutatedGold((g) => {
    const n10 = nodeOf(g, "N10");
    n10.holderIds = ["P2"];
    n10.visibleToIds = ["P2"];
    n10.acquisition.whoCanAcquireIds = ["P2"];
  });
  expectIssue(result, "FORMATION_LEVERAGE_UNSOURCED");
  assert.deepEqual(result.checks.leverage.seekerControlled, { N10: false });
});

test("F3 negative: FORMATION_LEVERAGE_UNSOURCED (empty-shell provenance)", () => {
  const result = validateMutatedGold((g) => {
    const n10 = nodeOf(g, "N10");
    n10.provenance.sourceRefs = [];
    n10.provenance.summary = null;
  });
  expectIssue(result, "FORMATION_LEVERAGE_UNSOURCED");
  assert.deepEqual(result.checks.leverage.provenanceSubstantiated, { N10: false });
});

test("F3 negative: FORMATION_COUNTERPART_NEED_MISSING (no holder need proof)", () => {
  const result = validateMutatedGold((g) => {
    g.proof.bilateralLeverage.holderNeedNodeIds = [];
  });
  expectIssue(result, "FORMATION_COUNTERPART_NEED_MISSING");
});

test("F3 negative: FORMATION_NEED_NOT_RECOGNIZABLE (recognition not seeker-reachable)", () => {
  const result = validateMutatedGold((g) => {
    const n11b = nodeOf(g, "N11b");
    n11b.holderIds = ["P2"];
    n11b.visibleToIds = ["P2"];
    n11b.acquisition.whoCanAcquireIds = ["P2"];
  });
  expectIssue(result, "FORMATION_NEED_NOT_RECOGNIZABLE");
  assert.deepEqual(result.checks.recognition.seekerReachable, { N11b: false });
});

test("F3 negative: FORMATION_TRIGGER_NOT_PERCEIVABLE (trigger invisible to seeker)", () => {
  const result = validateMutatedGold((g) => {
    const n12 = nodeOf(g, "N12");
    n12.visibleToIds = ["P2"];
    n12.acquisition.whoCanAcquireIds = ["P2"];
  });
  expectIssue(result, "FORMATION_TRIGGER_NOT_PERCEIVABLE");
  assert.equal(result.checks.capabilities.WORLD_TRIGGER.supported, false);
});

test("F3 negative: FORMATION_PREWRITTEN_DEAL (completed exchange narrated in node)", () => {
  const result = validateMutatedGold((g) => {
    nodeOf(g, "N8").reveals = ["沈岚已用 N8a 换到白绫的 N7，交换完成"];
  });
  expectIssue(result, "FORMATION_PREWRITTEN_DEAL");
  assert.ok(result.checks.lint.prewrittenDeal.some((h) => h.nodeId === "N8"));
});

test("F3 negative: FORMATION_SINGLE_POINT_DEPENDENCY (boost inside guaranteed spine)", () => {
  const result = validateMutatedGold((g) => {
    g.proof.guaranteedPathToContactReason.push("N7"); // N7 = CONFIDENCE_BOOST
  });
  expectIssue(result, "FORMATION_SINGLE_POINT_DEPENDENCY");
  assert.deepEqual(
    result.checks.spine.rejected,
    [{ nodeId: "N7", reason: "CONFIDENCE_BOOST" }],
  );
});

test("F3 negative: FORMATION_META_PROMPT_DEPENDENCY (designer instruction in trigger)", () => {
  const result = validateMutatedGold((g) => {
    nodeOf(g, "N12").acquisition.how = "现在开始谈判";
  });
  expectIssue(result, "FORMATION_META_PROMPT_DEPENDENCY");
  assert.ok(result.checks.lint.metaPrompt.some((h) => h.nodeId === "N12"));
});

// ── F3 Semantic Hardening：Visible ≠ Owned / 可支配 / Fact ≠ Need ──

test("F3 hardening: OPENING_OWNED visible-only ≠ owned (N10 seen but not held)", () => {
  const result = validateMutatedGold((g) => {
    const n10 = nodeOf(g, "N10");
    n10.holderIds = [];
    n10.visibleToIds = ["P1"]; // 沈岚"知道腕带存在"，但腕带不在她手里
    n10.acquisition.whoCanAcquireIds = [];
  });
  // 杠杆不可支配 + spine 中 N10 失效（单点依赖）同时触发
  expectIssue(result, "FORMATION_LEVERAGE_UNSOURCED");
  assert.deepEqual(result.checks.leverage.seekerControlled, { N10: false });
  expectIssue(result, "FORMATION_SINGLE_POINT_DEPENDENCY");
  assert.deepEqual(
    result.checks.spine.rejected,
    [{ nodeId: "N10", reason: "OPENING_OWNED_NOT_HELD" }],
  );
});

test("F3 hardening: leverage visible-only ≠ controllable (GUARANTEED seen, not acquirable)", () => {
  const result = validateMutatedGold((g) => {
    const n10 = nodeOf(g, "N10");
    n10.acquisition.mode = "GUARANTEED";
    n10.holderIds = [];
    n10.acquisition.whoCanAcquireIds = ["P2"]; // 只有梁赫能拿到
    n10.visibleToIds = ["P1", "P2"]; // 沈岚只是"看得见"
  });
  expectIssue(result, "FORMATION_LEVERAGE_UNSOURCED");
  assert.deepEqual(result.checks.leverage.seekerControlled, { N10: false });
});

test("F3 hardening: Fact ≠ Need (holder need node must be kind=NEED)", () => {
  const result = validateMutatedGold((g) => {
    nodeOf(g, "N11").kind = "FACT"; // 世界事实冒充 holder 需求
  });
  expectIssue(result, "FORMATION_COUNTERPART_NEED_MISSING");
  assert.equal(result.checks.counterpartNeed.allKindNeed, false);
});
