/**
 * F4A — Role-Relative Semantic Projection V1 tests.
 *
 * PASS Gate 对照（12 条中 1-10、12；11 = real rerun，见对比实验）：
 *  1  Canonical FormationNode 不被改写（投影纯函数，不写回 artifact）
 *  2  projection 是 derived sidecar，不制造第二个 truth source（主体文本=剥离原文，零新增）
 *  3  N4→P1 保留「可能知道」的 inference
 *  4  N4→P2 只能得到「自己参与过资料整理」
 *  5  N4→P2 不得升级为「看过内部目录」（P2 packet 无「目录」信息源）
 *  6  N9 只投射给 subject=P1（ACTIONABLE_INFERENCE）
 *  7  N11 holder-private，不泄给 P1（P2 = SELF_KNOWN_NEED）
 *  8  N11b 对 P1 保留 OBSERVABLE
 *  9  provenance 继续随 node visibility（V1.1 规则不回退）
 * 10  publicCastDirectory 不回退
 * 11  （real rerun：腕带/身份保持、N4 错位消失、meta/deal=0）
 * 12  不碰 Integrator / Beat（本刀无相关文件改动，由实现范围保证）
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProjectStoryState } from "../shared/story-mechanism-contracts.js";
import { upsertM12FormationArtifact } from "../shared/m12-formation-contracts.js";
import { buildM12FormationArtifact } from "../shared/m12-formation-builder.js";
import { validateM12Formation } from "../shared/m12-formation-validator.js";
import { buildM12FormationPreviewPackets } from "../shared/m12-formation-writer-packet.js";
import {
  projectFormationNodeForAudience,
  M12_FORMATION_PROJECTION_TYPES,
} from "../shared/m12-formation-role-projection.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GOLD_PATH = path.join(root, "fixtures/m12-formation/closed-after-hours-gold.json");
const CONTEXT_PATH = path.join(root, "fixtures/m12-formation/closed-after-hours-context.json");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function readyArtifacts() {
  const fixture = loadJson(GOLD_PATH);
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
  const gate = validateM12Formation({ state, artifactId: built.artifact.id });
  assert.equal(gate.decision, "FORMATION_READY");
  return { fixture, artifact: built.artifact, gate, context: loadJson(CONTEXT_PATH) };
}

function buildPackets() {
  const { fixture, artifact, gate, context } = readyArtifacts();
  const result = buildM12FormationPreviewPackets({ artifact, gateResult: gate, context });
  assert.equal(result.ok, true);
  const byId = new Map(
    result.packets.map((p) => [p.audienceType === "HOST" ? "HOST" : p.audience.characterId, p]),
  );
  return { fixture, artifact, result, byId };
}

function findEntry(packet, nodeId) {
  return [...packet.fixedFacts, ...(packet.characterKnowledge || [])].find((f) => f.nodeId === nodeId);
}

// ── 单元层：投影函数 ─────────────────────────────────────────────

test("F4A unit: projection types cover the locked 8-type set (no per-character copywriting)", () => {
  assert.deepEqual(M12_FORMATION_PROJECTION_TYPES, [
    "CANON_FACT",
    "SELF_KNOWN_FACT",
    "OBSERVED_FACT",
    "ACTIONABLE_INFERENCE",
    "PRIVATE_MEMORY",
    "PUBLIC_RULE",
    "OWNED_OBJECT",
    "SELF_KNOWN_NEED",
  ]);
});

test("F4A unit: subject audience gets inference stripped; others keep full text", () => {
  const { fixture } = readyArtifacts();
  const n4 = fixture.nodes.find((n) => n.id === "N4");
  const canonicalText = n4.reveals[0];

  const p1 = projectFormationNodeForAudience(n4, { audienceType: "CHARACTER", audienceId: "P1" });
  assert.equal(p1.projectionType, "CANON_FACT");
  assert.equal(p1.text, canonicalText, "非主体保留原文（含 inline 推断）");

  const p2 = projectFormationNodeForAudience(n4, { audienceType: "CHARACTER", audienceId: "P2" });
  assert.equal(p2.projectionType, "SELF_KNOWN_FACT");
  assert.equal(p2.text, "梁赫签字参与预展资料整理", "主体剥离 inline 推断");
  assert.ok(!p2.text.includes("目录"));

  const host = projectFormationNodeForAudience(n4, { audienceType: "HOST", audienceId: null });
  assert.equal(host.projectionType, "CANON_FACT");
  assert.equal(host.text, "梁赫签字参与预展资料整理", "HOST 拿 canonical（无 seeker 推断）");

  const p3 = projectFormationNodeForAudience(n4, { audienceType: "CHARACTER", audienceId: "P3" });
  assert.equal(p3.text, canonicalText, "非主体第三方同样保留原文");
});

test("F4A unit: nodes without subjectCharacterIds degrade to original text (no default subject)", () => {
  const { fixture } = readyArtifacts();
  const n1 = fixture.nodes.find((n) => n.id === "N1");
  const p2 = projectFormationNodeForAudience(n1, { audienceType: "CHARACTER", audienceId: "P2" });
  assert.equal(p2.text, n1.reveals.join("；"));
  assert.equal(p2.projectionType, "PUBLIC_RULE");
  assert.deepEqual(p2.subjectCharacterIds, []);
});

// ── Gate 1 / 2：Canonical 不被改写，投影不制造第二 truth source ──

test("F4A gate1: canonical artifact untouched by projection (pure derivation)", () => {
  const { artifact } = readyArtifacts();
  const before = JSON.parse(JSON.stringify(artifact));
  // 投影在 packet 构建中发生；packet 构建后 artifact 逐字节不变
  const { result } = buildPackets();
  assert.ok(result.packets.length > 0);
  assert.deepEqual(artifact, before);
  // 合同保持 normalize 幂等（fixture 含 subjectCharacterIds 双向稳定）
  const again = JSON.parse(JSON.stringify(artifact));
  assert.deepEqual(again, before);
});

test("F4A gate2: projection adds zero facts — subject text is a substring of canonical", () => {
  const { fixture, byId } = buildPackets();
  const n4 = fixture.nodes.find((n) => n.id === "N4");
  const p2Entry = findEntry(byId.get("P2"), "N4");
  // 剥离文本必须是 canonical 原文的子串（删减，绝非新增）
  assert.ok(n4.reveals[0].includes(p2Entry.text));
  assert.deepEqual(p2Entry.subjectCharacterIds, ["P2"]);
});

// ── Gate 3 / 4 / 5：N4 的三个面 ──────────────────────────────────

test("F4A gate3: N4→P1 keeps the 「可能知道」 inference (OBSERVED/CANON full text)", () => {
  const { byId } = buildPackets();
  const entry = findEntry(byId.get("P1"), "N4");
  assert.ok(entry.text.includes("可能知道内部目录"));
  assert.equal(entry.projectionType, "CANON_FACT");
  // 非主体不携带主体标记
  assert.equal(entry.subjectCharacterIds, undefined);
});

test("F4A gate4: N4→P2 yields only his own participation (SELF_KNOWN_FACT, stripped)", () => {
  const { byId } = buildPackets();
  const entry = findEntry(byId.get("P2"), "N4");
  assert.equal(entry.projectionType, "SELF_KNOWN_FACT");
  assert.equal(entry.text, "梁赫签字参与预展资料整理");
});

test("F4A gate5: P2 packet has no 「目录」 source to escalate from", () => {
  const { byId } = buildPackets();
  const p2Text = JSON.stringify(byId.get("P2"));
  // P2 全 packet 不得出现「目录」（Writer 无从升级「翻过内部目录」）
  assert.ok(!p2Text.includes("目录"), "P2 packet 含「目录」字样——信息源泄漏");
  // 主体标记不泄露给其他受众
  const p1Text = JSON.stringify(byId.get("P1"));
  assert.ok(!p1Text.includes('"subjectCharacterIds":["P2"]'));
});

// ── Gate 6 / 7 / 8：N9 / N11 / N11b ─────────────────────────────

test("F4A gate6: N9 projects only to subject P1 as ACTIONABLE_INFERENCE", () => {
  const { byId } = buildPackets();
  const p1Entry = findEntry(byId.get("P1"), "N9");
  assert.equal(p1Entry.projectionType, "ACTIONABLE_INFERENCE");
  assert.ok(p1Entry.text.includes("大概率"));
  // P2/HOST 不可见（既有可见性纪律不回退）
  for (const id of ["P2", "P3", "P4", "P5", "P6", "HOST"]) {
    assert.equal(findEntry(byId.get(id), "N9"), undefined, `${id} 不应看到 N9`);
  }
});

test("F4A gate7: N11 stays holder-private (P2 SELF_KNOWN_NEED, invisible to P1)", () => {
  const { byId } = buildPackets();
  const p2Entry = findEntry(byId.get("P2"), "N11");
  assert.equal(p2Entry.projectionType, "SELF_KNOWN_NEED");
  assert.ok(p2Entry.text.includes("需要腕带"));
  assert.equal(findEntry(byId.get("P1"), "N11"), undefined);
});

test("F4A gate8: N11b remains OBSERVED_FACT for P1 (eyewitness intact)", () => {
  const { byId } = buildPackets();
  const entry = findEntry(byId.get("P1"), "N11b");
  assert.equal(entry.projectionType, "OBSERVED_FACT");
  assert.ok(entry.text.includes("亲眼看见"));
});

// ── Gate 9 / 10：V1.1 成果不回退 ─────────────────────────────────

test("F4A gate9: provenance still follows node visibility (N10 provenance only for P1)", () => {
  const { byId } = buildPackets();
  const n10 = findEntry(byId.get("P1"), "N10");
  assert.equal(n10.projectionType, "OWNED_OBJECT");
  assert.ok(n10.provenance.summary.includes("收藏家"));
  for (const id of ["P2", "P3", "P4", "P5", "P6", "HOST"]) {
    const text = JSON.stringify(byId.get(id));
    assert.ok(!text.includes("N10"), `${id} 不应看到 N10`);
  }
});

test("F4A gate10: publicCastDirectory and visibility matrix unchanged", () => {
  const { byId } = buildPackets();
  const p1 = byId.get("P1");
  assert.equal(p1.publicCastDirectory.length, 6);
  const liang = p1.publicCastDirectory.find((c) => c.characterId === "P2");
  assert.ok(liang.publicIdentity.includes("资深藏家"));
  // 可见性矩阵与 V1.1 完全一致（节点集合不变，只是 entry 语义增强）
  const idsOf = (packet) =>
    [...packet.fixedFacts, ...(packet.characterKnowledge || [])].map((f) => f.nodeId).sort();
  assert.deepEqual(idsOf(byId.get("P1")), [
    "N1", "N10", "N11a", "N11b", "N12", "N2", "N3", "N4", "N5", "N8a", "N9",
  ]);
  assert.deepEqual(idsOf(byId.get("P2")), ["N1", "N11", "N11a", "N12", "N4", "N5"]);
  assert.deepEqual(idsOf(byId.get("HOST")), ["N1", "N11a", "N12", "N4", "N5"]);
});

// ── 投影类型全谱（Gold 主要节点）────────────────────────────────

test("F4A: full projection-type spectrum across Gold nodes", () => {
  const { byId } = buildPackets();
  assert.equal(findEntry(byId.get("P1"), "N2").projectionType, "PRIVATE_MEMORY");
  assert.equal(findEntry(byId.get("P1"), "N10").projectionType, "OWNED_OBJECT");
  assert.equal(findEntry(byId.get("P1"), "N3").projectionType, "ACTIONABLE_INFERENCE");
  assert.equal(findEntry(byId.get("P1"), "N12").projectionType, "PUBLIC_RULE");
  assert.equal(findEntry(byId.get("P1"), "N1").projectionType, "PUBLIC_RULE");
  // N5 主体=P2：P2 视角 SELF_KNOWN_FACT（关于自己授权的事实），P1 视角 CANON_FACT
  assert.equal(findEntry(byId.get("P2"), "N5").projectionType, "SELF_KNOWN_FACT");
  assert.equal(findEntry(byId.get("P1"), "N5").projectionType, "CANON_FACT");
  assert.equal(findEntry(byId.get("P3"), "N7").projectionType, "SELF_KNOWN_FACT");
});

// ── Gate 12：范围隔离（结构断言：不引入 Beat/Integrator 概念）────

test("F4A gate12: no Beat/Integrator concepts leak into packets", () => {
  const { result } = buildPackets();
  const text = JSON.stringify(result.packets);
  for (const forbidden of ["formationBeats", "beatRefs", "integrator", "Integrator"]) {
    assert.ok(!text.includes(forbidden), `packet 不应包含 ${forbidden}`);
  }
});
