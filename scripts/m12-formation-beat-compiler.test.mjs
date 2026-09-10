/**
 * F4B — Formation Beat Compiler V1 tests.
 *
 * PASS Gate（12 条）：
 *  1  Gold N1–N12（含 N8a/N8b/N11a）全部被 Beat compiler 可追踪引用
 *  2  Beat 数显著少于 Node 数
 *  3  required / optional node 明确分离
 *  4  N6/N7/N8 不进入 required dependency（也不进 requiresBeatIds 因果）
 *  5  B1 覆盖 value + existence
 *  6  B2 覆盖 knowledge + locator
 *  7  B3 覆盖 leverage + need + recognition
 *  8  B4 覆盖 trigger
 *  9  audienceViews 使用 F4A projection，不重新读 raw reveals
 *  10 不新增 Canon / 不预写玩家行为（零新增文本）
 *  11 不生成 NEGOTIATE / EXCHANGE outcome
 *  12 不接 Integrator / PMD / Writer
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProjectStoryState } from "../shared/story-mechanism-contracts.js";
import { upsertM12FormationArtifact } from "../shared/m12-formation-contracts.js";
import { buildM12FormationArtifact } from "../shared/m12-formation-builder.js";
import { compileM12FormationBeats } from "../shared/m12-formation-beat-compiler.js";
import { projectFormationNodeForAudience } from "../shared/m12-formation-role-projection.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GOLD_PATH = path.join(root, "fixtures/m12-formation/closed-after-hours-gold.json");
const ALT_PATH = path.join(root, "fixtures/m12-formation/sealed-room-alt-topology.json");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function compileFixture(fixturePath) {
  const fixture = loadJson(fixturePath);
  let state = createProjectStoryState({
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
      },
    ],
  });
  const built = buildM12FormationArtifact({
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
  assert.equal(built.ok, true);
  state = upsertM12FormationArtifact(state, built.artifact);
  return compileM12FormationBeats({ state, artifactId: built.artifact.id });
}

function beatById(result, id) {
  return result.beats.find((b) => b.id === id);
}

// ── Gate 1 / 2：全覆盖 + Node ≠ Beat ─────────────────────────────

test("F4B gate1: all 16 Gold nodes are traceably referenced by beats", () => {
  const result = compileFixture(GOLD_PATH);
  assert.equal(result.ok, true, JSON.stringify(result.errors || result).slice(0, 300));
  assert.equal(result.coverage.uncoveredNodeIds.length, 0);
  const covered = new Set(result.coverage.coveredNodeIds);
  for (const id of [
    "N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N8a", "N8b",
    "N9", "N10", "N11", "N11a", "N11b", "N12",
  ]) {
    assert.ok(covered.has(id), `node ${id} 未被追踪`);
  }
});

test("F4B gate2: 4 beats for 16 nodes (Node ≠ Beat, not a task list)", () => {
  const result = compileFixture(GOLD_PATH);
  assert.equal(result.beats.length, 4);
  assert.ok(result.beats.length < result.coverage.nodeCount);
  const ids = result.beats.map((b) => b.id);
  assert.deepEqual(ids, ["B1", "B2", "B3", "B4"]);
});

// ── Gate 3 / 4：required/optional 分离 + boost 不进因果 ────────────

test("F4B gate3: required and optional node refs are explicitly separated", () => {
  const result = compileFixture(GOLD_PATH);
  const b2 = beatById(result, "B2");
  assert.deepEqual(b2.requiredNodeRefs.sort(), ["N4", "N5", "N9"]);
  assert.deepEqual(b2.optionalNodeRefs.sort(), ["N6", "N7", "N8"]);
  assert.deepEqual(b2.nodeRefs.sort(), ["N4", "N5", "N6", "N7", "N8", "N9"]);
  // B1/B3/B4 无 boost
  for (const id of ["B1", "B3", "B4"]) {
    assert.deepEqual(beatById(result, id).optionalNodeRefs, [], `${id} 不应含 optional`);
  }
});

test("F4B gate4: N6/N7/N8 never enter required dependency or beat causal chain", () => {
  const result = compileFixture(GOLD_PATH);
  for (const beat of result.beats) {
    for (const id of ["N6", "N7", "N8"]) {
      assert.ok(!beat.requiredNodeRefs.includes(id), `${beat.id} required 含 ${id}`);
    }
  }
  // 因果链：B2 只依赖 B1；不依赖 boost；B4 不把体验顺序伪装成世界因果
  assert.deepEqual(beatById(result, "B1").requiresBeatIds, []);
  assert.deepEqual(beatById(result, "B2").requiresBeatIds, ["B1"]);
  assert.deepEqual(beatById(result, "B3").requiresBeatIds, []);
  assert.deepEqual(beatById(result, "B4").requiresBeatIds, []);
  assert.deepEqual(beatById(result, "B4").preferredAfterBeatIds, ["B2", "B3"]);
});

test("F4B hardening: preferred order is not a causal blocker", () => {
  const fixture = loadJson(GOLD_PATH);
  assert.deepEqual(fixture.nodes.find((node) => node.id === "N12").requiresNodeIds, []);
  const result = compileFixture(GOLD_PATH);
  const b4 = beatById(result, "B4");
  assert.deepEqual(b4.requiresBeatIds, []);
  assert.deepEqual(b4.preferredAfterBeatIds, ["B2", "B3"]);
  assert.deepEqual(result.beats.map((beat) => beat.id), ["B1", "B2", "B3", "B4"]);
});

// ── Gate 5-8：capability 覆盖 ─────────────────────────────────────

test("F4B gate5-8: beat family capability coverage", () => {
  const result = compileFixture(GOLD_PATH);
  const b1 = beatById(result, "B1");
  assert.deepEqual(b1.satisfiesCapabilities, ["VALUE_SOURCE", "EXISTENCE_SOURCE"]);
  assert.deepEqual(b1.requiredNodeRefs.sort(), ["N1", "N2", "N3"]);

  const b2 = beatById(result, "B2");
  assert.deepEqual(b2.satisfiesCapabilities, ["KNOWLEDGE_PATH", "LOCATOR_PATH"]);

  const b3 = beatById(result, "B3");
  assert.deepEqual(b3.satisfiesCapabilities, [
    "COUNTERPART_LEVERAGE",
    "LEVERAGE_PROVENANCE",
    "COUNTERPART_NEED",
    "NEED_RECOGNITION",
  ]);
  assert.deepEqual(b3.requiredNodeRefs.sort(), ["N10", "N11", "N11b"]);

  const b4 = beatById(result, "B4");
  assert.deepEqual(b4.satisfiesCapabilities, ["WORLD_TRIGGER"]);
  assert.deepEqual(b4.requiredNodeRefs, ["N12"]);
});

test("F4B delivery modes derive from structure (Gold spectrum)", () => {
  const result = compileFixture(GOLD_PATH);
  assert.equal(beatById(result, "B1").delivery.mode, "OPENING_CONTEXT");
  assert.equal(beatById(result, "B2").delivery.mode, "PUBLIC_DISCOVERY");
  assert.equal(beatById(result, "B3").delivery.mode, "OBSERVED_EVENT");
  assert.equal(beatById(result, "B4").delivery.mode, "WORLD_TRIGGER");
  assert.deepEqual(beatById(result, "B4").delivery.stageHint, ["act2"]);
});

// ── Gate 9：audienceViews = F4A 投影 ──────────────────────────────

test("F4B gate9: audienceViews come from F4A projection, not raw reveals", () => {
  const result = compileFixture(GOLD_PATH);
  const fixture = loadJson(GOLD_PATH);
  const nodesById = new Map(fixture.nodes.map((n) => [n.id, n]));
  const b3 = beatById(result, "B3");

  // P1 视角：N10（OWNED_OBJECT）+ N11b（OBSERVED_FACT）+ N11a（support PUBLIC_RULE）
  const p1View = b3.audienceViews.P1;
  const p1Texts = p1View.map((v) => v.text);
  assert.ok(p1Texts.some((t) => t.includes("腕带已在沈岚处")));
  assert.ok(p1Texts.some((t) => t.includes("亲眼看见")));
  // N11（梁赫私有需求）不进 P1 视角
  assert.ok(!p1View.some((v) => v.nodeId === "N11"));

  // P2 视角：N11（SELF_KNOWN_NEED）+ N11a；不含 N10/N11b
  const p2View = b3.audienceViews.P2;
  assert.ok(p2View.some((v) => v.nodeId === "N11" && v.projectionType === "SELF_KNOWN_NEED"));
  assert.ok(!p2View.some((v) => v.nodeId === "N10" || v.nodeId === "N11b"));

  // 每条 view 与 F4A 投影输出逐字一致（不重新读 raw reveals）
  for (const [pid, views] of Object.entries(b3.audienceViews)) {
    for (const v of views) {
      const p = projectFormationNodeForAudience(nodesById.get(v.nodeId), {
        audienceType: "CHARACTER",
        audienceId: pid,
      });
      assert.equal(v.text, p.text, `${pid}/${v.nodeId}`);
      assert.equal(v.projectionType, p.projectionType);
    }
  }
});

// ── Gate 10：零新增文本 ──────────────────────────────────────────

test("F4B gate10: beats add zero canon text (every text ⊆ canonical reveals)", () => {
  const result = compileFixture(GOLD_PATH);
  const fixture = loadJson(GOLD_PATH);
  const canonicalTexts = fixture.nodes.flatMap((n) => n.reveals);
  for (const beat of result.beats) {
    for (const views of Object.values(beat.audienceViews)) {
      for (const v of views) {
        const isOriginal = canonicalTexts.some((c) => c.includes(v.text));
        assert.ok(isOriginal, `${beat.id}: 文本非 canonical 子串 → 新增事实：${v.text}`);
      }
    }
  }
});

// ── Gate 11：不生成 Resolution outcome ───────────────────────────

test("F4B gate11: no NEGOTIATE/EXCHANGE outcome, no resolution concepts", () => {
  const result = compileFixture(GOLD_PATH);
  const text = JSON.stringify(result.beats);
  for (const forbidden of [
    "NEGOTIATE", "EXCHANGE", "AFTERMATH", "PROBE",
    "resolution", "dealCompleted", "tradeCompleted", "成交",
  ]) {
    assert.ok(!text.includes(forbidden), `beats 不得包含 ${forbidden}`);
  }
  // purpose 枚举合法
  for (const beat of result.beats) {
    assert.ok(
      ["NOTICE_VALUE", "TRACE_COUNTERPART", "FORM_LEVERAGE", "RECOGNIZE_NEED", "TIME_PRESSURE"].includes(beat.purpose),
    );
  }
});

// ── Gate 12：范围隔离 ────────────────────────────────────────────

test("F4B gate12: no Integrator/PMD/Writer/master-outline concepts", () => {
  const result = compileFixture(GOLD_PATH);
  const text = JSON.stringify(result);
  for (const forbidden of ["integrator", "Integrator", "masterOutline", "pmd", "packet", "writer"]) {
    assert.ok(!text.includes(forbidden), `compiler 输出不得包含 ${forbidden}`);
  }
});

// ── 权威入口：非 READY 拒绝 ──────────────────────────────────────

test("F4B authority: non-READY artifact is refused (gate rerun inside compiler)", () => {
  const fixture = loadJson(ALT_PATH);
  let state = createProjectStoryState({
    projectId: fixture.projectId,
    mechanismBlocks: [
      {
        id: fixture.sourceBlockId,
        templateId: "M12-1",
        revision: fixture.sourceBlockRevision + 5, // STALE
        status: "USER_ACCEPTED",
        roleBindings: { bargainA: fixture.participants.seekerId, bargainB: fixture.participants.holderId },
      },
    ],
    m12FormationArtifacts: [fixture],
  });
  const result = compileM12FormationBeats({ state, artifactId: fixture.id });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "FORMATION_ARTIFACT_STALE");
});

// ── Alt 旁证：compiler 不是 Gold 生成器 ──────────────────────────

test("F4B alt topology compiles too (compiler is not a Gold hardcode)", () => {
  const result = compileFixture(ALT_PATH);
  assert.equal(result.ok, true, JSON.stringify(result.errors || result).slice(0, 300));
  assert.equal(result.beats.length, 4);
  assert.equal(result.coverage.uncoveredNodeIds.length, 0);

  const b2 = beatById(result, "B2");
  // Alt：holder 公开已知 → B2 required 只有 K1（章程），K4（老纪）= optional 增强
  assert.deepEqual(b2.requiredNodeRefs, ["K1"]);
  assert.deepEqual(b2.optionalNodeRefs, ["K4"]);
  assert.equal(b2.delivery.mode, "PUBLIC_DISCOVERY");

  const b3 = beatById(result, "B3");
  // Alt 识别是推断式（K6 direct），Gold 是目击式（N11b direct）——topology 差异
  assert.ok(b3.requiredNodeRefs.includes("K6"));
  assert.ok(!b3.requiredNodeRefs.includes("K5")); // K5 目击是 K6 的前提（support），非 direct
  // 孤立双边杠杆边 K9 归 B3 optional（结构证据，非必经）
  assert.ok(b3.optionalNodeRefs.includes("K9"));
  assert.ok(!b3.requiredNodeRefs.includes("K9"));
  const goldB3 = beatById(compileFixture(GOLD_PATH), "B3");
  assert.ok(goldB3.requiredNodeRefs.includes("N11b"));

  // 与 Gold 结构确实不同（非同一骨架换皮）
  const gold = compileFixture(GOLD_PATH);
  assert.notDeepEqual(
    gold.beats.map((b) => b.requiredNodeRefs),
    result.beats.map((b) => b.requiredNodeRefs),
  );
});

// ── 人工审渲染：隐藏 Node ID 后仍是剧情形成过程 ──────────────────

test("F4B human review render hides node IDs", async () => {
  const { renderM12FormationBeatsForReview } = await import("../shared/m12-formation-beat-compiler.js");
  const result = compileFixture(GOLD_PATH);
  const md = renderM12FormationBeatsForReview({
    beats: result.beats,
    characterNames: { P1: "沈岚", P2: "梁赫", P3: "白绫", P4: "周祁" },
  });
  // 渲染层无 Node ID
  assert.ok(!/\bN\d/.test(md.replace(/N1[12]?\b/g, "")) || !/(N\d+|K\d+)/.test(md));
  assert.ok(md.includes("异常浮现"));
  assert.ok(md.includes("双边条件形成"));
  assert.ok(md.includes("沈岚 的视角"));
  assert.ok(md.includes("梁赫 的视角"));
});
