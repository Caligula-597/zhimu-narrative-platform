/**
 * M12 Formation Preview Writer Packet + 运行器测试。
 *
 * 核心断言：信息可见性严格投射（每个角色只拿到他该拿的信息）+ 写作纪律进入
 * Packet + 非 READY 的 Formation 不喂 Writer + mock 端到端链路。
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
import { runM12PreviewWriter, MockPreviewWriterLlm } from "../shared/m12-formation-preview-writer.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GOLD_PATH = path.join(root, "fixtures/m12-formation/closed-after-hours-gold.json");
const CONTEXT_PATH = path.join(root, "fixtures/m12-formation/closed-after-hours-context.json");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** 完整链路前半段：fixture → state → builder → gate(READY) */
function readyArtifactAndGate() {
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
  return { artifact: built.artifact, gate };
}

function packetNodeIds(packet) {
  return {
    fixedFacts: packet.fixedFacts.map((f) => f.nodeId).sort(),
    characterKnowledge: (packet.characterKnowledge || []).map((f) => f.nodeId).sort(),
  };
}

// ── 可见性矩阵（Gold《闭馆之后》）────────────────────────────────

test("preview packet visibility matrix: every character sees exactly their layer", () => {
  const { artifact, gate } = readyArtifactAndGate();
  const context = loadJson(CONTEXT_PATH);
  const result = buildM12FormationPreviewPackets({ artifact, gateResult: gate, context });
  assert.equal(result.ok, true);

  const byId = new Map(result.packets.map((p) => [p.audienceType === "HOST" ? "HOST" : p.audience.characterId, p]));

  // 公共事实（全员可知，必须写进任何成品）
  const publicIds = ["N1", "N11a", "N12", "N4", "N5"];
  // 沈岚（seeker）：私有记忆/推断/筹码/目击
  assert.deepEqual(packetNodeIds(byId.get("P1")), {
    fixedFacts: publicIds,
    characterKnowledge: ["N10", "N11b", "N2", "N3", "N8a", "N9"],
  });
  // 梁赫（holder）：只有他自己的需求是私有的
  assert.deepEqual(packetNodeIds(byId.get("P2")), {
    fixedFacts: publicIds,
    characterKnowledge: ["N11"],
  });
  // 白绫：她的目击（boost）与她的动机
  assert.deepEqual(packetNodeIds(byId.get("P3")), {
    fixedFacts: publicIds,
    characterKnowledge: ["N7", "N8b"],
  });
  // 周祁：授权疑点只在他那里
  assert.deepEqual(packetNodeIds(byId.get("P4")), {
    fixedFacts: publicIds,
    characterKnowledge: ["N6"],
  });
  // 无关角色：只见公共层
  assert.deepEqual(packetNodeIds(byId.get("P5")), {
    fixedFacts: publicIds,
    characterKnowledge: [],
  });
  // HOST：只有公共层 + 人物目录，无私有信息
  const host = byId.get("HOST");
  assert.deepEqual(packetNodeIds(host), {
    fixedFacts: publicIds,
    characterKnowledge: [],
  });
  assert.equal(host.castDirectory.length, 6);
});

test("preview packet: LEVERAGE_EDGE (design structure) never enters any packet", () => {
  const { artifact, gate } = readyArtifactAndGate();
  const context = loadJson(CONTEXT_PATH);
  const result = buildM12FormationPreviewPackets({ artifact, gateResult: gate, context });
  for (const packet of result.packets) {
    const all = [...packet.fixedFacts, ...(packet.characterKnowledge || [])];
    assert.ok(!all.some((f) => f.nodeId === "N8"), "N8 是设计结构，不是角色知识");
  }
});

test("preview packet: writer does not receive counterpart private knowledge", () => {
  const { artifact, gate } = readyArtifactAndGate();
  const context = loadJson(CONTEXT_PATH);
  const result = buildM12FormationPreviewPackets({ artifact, gateResult: gate, context });
  const byId = new Map(
    result.packets
      .filter((p) => p.audienceType === "CHARACTER")
      .map((p) => [p.audience.characterId, p]),
  );

  // 沈岚的 packet：绝不含梁赫的私有需求 N11 原文
  const p1Text = JSON.stringify(byId.get("P1"));
  assert.ok(!p1Text.includes("梁赫要核验的藏品"));
  // 梁赫的 packet：绝不含沈岚的私有筹码/推断原文
  const p2Text = JSON.stringify(byId.get("P2"));
  assert.ok(!p2Text.includes("腕带已在沈岚处"));
  assert.ok(!p2Text.includes("目录册大概率在梁赫手里"));
  // 白绫的目击不会直接进沈岚 packet（必须现场问到）
  assert.ok(!p1Text.includes("白绫看见梁赫离库时夹走一份文件"));
});

test("preview packet: writing rules carry all seven disciplines", () => {
  const { artifact, gate } = readyArtifactAndGate();
  const context = loadJson(CONTEXT_PATH);
  const result = buildM12FormationPreviewPackets({ artifact, gateResult: gate, context });
  const rules = result.packets[0].writingRules.join("\n");
  for (const keyword of ["固定事实", "信息可见性", "不准替玩家决定", "不准预写结果", "不准 meta"]) {
    assert.ok(rules.includes(keyword), `writingRules 缺少纪律：${keyword}`);
  }
});

test("preview packet: gate not READY is refused (no writer feeding)", () => {
  const { artifact } = readyArtifactAndGate();
  const context = loadJson(CONTEXT_PATH);
  const refused = buildM12FormationPreviewPackets({
    artifact,
    gateResult: { decision: "FORMATION_REVIEW_REQUIRED" },
    context,
  });
  assert.equal(refused.ok, false);
  assert.equal(refused.errors[0].code, "GATE_NOT_READY");
});

// ── Packet V1.1 Fidelity Patch（provenance 投射 + publicCastDirectory）──

test("V1.1: P1's N10 entry carries the correct provenance", () => {
  const { artifact, gate } = readyArtifactAndGate();
  const context = loadJson(CONTEXT_PATH);
  const result = buildM12FormationPreviewPackets({ artifact, gateResult: gate, context });
  const p1 = result.packets.find((p) => p.audience.characterId === "P1");
  const n10 = p1.characterKnowledge.find((f) => f.nodeId === "N10");
  assert.ok(n10, "N10 应在沈岚的 characterKnowledge");
  assert.equal(n10.provenance.type, "CHARACTER_HISTORY");
  assert.ok(n10.provenance.summary.includes("收藏家"));
  assert.ok(n10.provenance.summary.includes("腕带"));
  assert.deepEqual(n10.provenance.sourceRefs, ["gold:N10"]);
});

test("V1.1: P2/HOST do NOT receive N10's private provenance (visibility unchanged)", () => {
  const { artifact, gate } = readyArtifactAndGate();
  const context = loadJson(CONTEXT_PATH);
  const result = buildM12FormationPreviewPackets({ artifact, gateResult: gate, context });
  for (const packet of result.packets) {
    const id = packet.audienceType === "HOST" ? "HOST" : packet.audience.characterId;
    if (id === "P1") continue;
    const text = JSON.stringify(packet);
    // N10 整个节点（含 provenance）对 P2/P3/P4/P5/P6/HOST 不可见
    assert.ok(!text.includes("N10"), `${id} 不应看到 N10`);
    assert.ok(!text.includes("缺席收藏家委托"), `${id} 不应看到 N10 来源`);
  }
});

test("V1.1: every character packet has publicCastDirectory with public identities only", () => {
  const { artifact, gate } = readyArtifactAndGate();
  const context = loadJson(CONTEXT_PATH);
  const result = buildM12FormationPreviewPackets({ artifact, gateResult: gate, context });
  const characterPackets = result.packets.filter((p) => p.audienceType === "CHARACTER");
  assert.equal(characterPackets.length, 6);
  for (const packet of characterPackets) {
    assert.equal(packet.publicCastDirectory.length, 6);
    for (const entry of packet.publicCastDirectory) {
      assert.deepEqual(Object.keys(entry).sort(), ["characterId", "name", "publicIdentity"]);
    }
  }
  const p1 = characterPackets.find((p) => p.audience.characterId === "P1");
  const liang = p1.publicCastDirectory.find((c) => c.characterId === "P2");
  assert.equal(liang.name, "梁赫");
  // 公开身份以 context 为准（identity 中的附加说明均为公共事实，如 N4 签名页）
  assert.ok(liang.publicIdentity.includes("资深藏家"), liang.publicIdentity);
  // 公共目录不得携带私有信息（openingGoal / roleInBargain）
  const dirText = JSON.stringify(p1.publicCastDirectory);
  assert.ok(!dirText.includes("openingGoal"));
  assert.ok(!dirText.includes("roleInBargain"));
  assert.ok(!dirText.includes("核验"));
});

test("V1.1→F4A: N4 role-relative rendering now projected (control variable resolved)", () => {
  const { artifact, gate } = readyArtifactAndGate();
  const context = loadJson(CONTEXT_PATH);
  const result = buildM12FormationPreviewPackets({ artifact, gateResult: gate, context });
  const p2 = result.packets.find((p) => p.audience.characterId === "P2");
  const n4 = p2.fixedFacts.find((f) => f.nodeId === "N4");
  // F4A：主体受众剥离 inline 推断（对照变量已由 role-projection 收口）
  assert.equal(n4.text, "梁赫签字参与预展资料整理");
  assert.equal(n4.projectionType, "SELF_KNOWN_FACT");
});

test("mock end-to-end: READY artifact → packets → deterministic writer output", async () => {
  const { artifact, gate } = readyArtifactAndGate();
  const context = loadJson(CONTEXT_PATH);
  const packets = buildM12FormationPreviewPackets({
    artifact,
    gateResult: gate,
    context,
    audiences: [{ type: "CHARACTER", characterId: "P1" }, { type: "HOST" }],
  });
  assert.equal(packets.ok, true);

  const llm = new MockPreviewWriterLlm();
  const p1 = packets.packets.find((p) => p.audience.characterId === "P1");
  const p1Result = await runM12PreviewWriter({ packet: p1, llm });
  assert.equal(p1Result.ok, true);
  assert.equal(p1Result.output.kind, "CHARACTER_SHEET");
  const headings = p1Result.output.sections.map((s) => s.heading);
  for (const h of ["你是谁", "开场时你知道的事", "你的目标"]) {
    assert.ok(headings.includes(h), `缺章节：${h}`);
  }
  // 私有筹码确实进入沈岚的「你知道的事」
  const knowledgeText = p1Result.output.sections.find((s) => s.heading === "开场时你知道的事").body;
  assert.ok(knowledgeText.includes("腕带已在沈岚处"));
  // 梁赫私有需求没有进
  assert.ok(!knowledgeText.includes("梁赫要核验的藏品"));
  // 自检：无 meta、无预写成交
  assert.deepEqual(p1Result.diagnostics.metaPromptHits, []);
  assert.deepEqual(p1Result.diagnostics.prewrittenDealHits, []);

  const hostResult = await runM12PreviewWriter({
    packet: packets.packets.find((p) => p.audienceType === "HOST"),
    llm,
  });
  assert.equal(hostResult.ok, true);
  assert.equal(hostResult.output.kind, "HOST_SHEET");
  const hostText = JSON.stringify(hostResult.output);
  assert.ok(!hostText.includes("腕带已在沈岚处"), "HOST 手册不得包含任何私有信息");
});

test("mock writer output passes lint on every Gold audience", async () => {
  const { artifact, gate } = readyArtifactAndGate();
  const context = loadJson(CONTEXT_PATH);
  const packets = buildM12FormationPreviewPackets({ artifact, gateResult: gate, context });
  const llm = new MockPreviewWriterLlm();
  for (const packet of packets.packets) {
    const result = await runM12PreviewWriter({ packet, llm });
    assert.equal(result.ok, true);
    assert.deepEqual(result.diagnostics.metaPromptHits, [], packet.audience?.characterId || "HOST");
    assert.deepEqual(result.diagnostics.prewrittenDealHits, [], packet.audience?.characterId || "HOST");
  }
});
