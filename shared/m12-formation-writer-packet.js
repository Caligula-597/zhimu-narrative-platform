/**
 * F3 后受控生成实验 — M12 Formation Preview Writer Packet V1（薄 adapter）。
 *
 * 位置（钉死，本实验替代性地「预演」F4 之后的消费端，不动 F4/Integrator/PMD）：
 *   ProjectStoryState → F2 Builder → F3 Gate(FORMATION_READY) → 本 adapter → Writer 模型
 *
 * 职责（只有一件）：把 F3 已判 READY 的 Artifact + 角色/场景上下文，
 * 按信息可见性严格投射成 Writer Packet。
 *
 * 可见性投射规则（与 F3 Gate 的世界模型一致）：
 *   LEVERAGE_EDGE   → 不进任何角色 packet（设计结构，不是角色知识）
 *   INFERENCE       → 只进 subject 自己的 packet（他的推断，不是 Canon）
 *   CONFIDENCE_BOOST→ 只进持有者自己的 packet（别人必须「问到他」才知道）
 *   OPENING_OWNED / GUARANTEED → 持有 / 可见 / 保证可获得的角色
 *   公共事实（所有角色都可知）→ fixedFacts，任何 packet 都必须如实写进成品
 *
 * 写作纪律（用户锁定，逐条进入 writingRules）：
 *   固定事实必须写进去；角色历史/情绪可丰富表达；信息可见性严格遵守；
 *   Formation 节点转成角色经历/场景事实；不准替玩家决定未来行为；
 *   不准预写成交/相信/联盟；不准写 meta 指令。
 *
 * 本模块不做：F4 Beat 压缩、Integrator、PMD、Writer 本体（都在后续刀）。
 */

import {
  normalizeM12FormationArtifact,
} from "./m12-formation-contracts.js";
import { projectFormationNodeForAudience } from "./m12-formation-role-projection.js";

export const M12_PREVIEW_WRITER_PACKET_VERSION = 1;

export const M12_PREVIEW_WRITING_RULES = Object.freeze([
  Object.freeze({
    id: "FIXED_FACTS_MANDATORY",
    rule: "【固定事实】Packet 中 fixedFacts 与 characterKnowledge 列出的每一条都必须写进成品，不得改动、不得与之矛盾。",
  }),
  Object.freeze({
    id: "EXPRESSION_FREEDOM",
    rule: "【表达自由】角色的心理、语气、历史细节可以在不违反固定事实的前提下合理丰富，写出真实的人。",
  }),
  Object.freeze({
    id: "VISIBILITY_STRICT",
    rule: "【信息可见性】只准写本 Packet 给你的信息。你不知道的其他角色私有信息、世界秘密，一个字都不准编。",
  }),
  Object.freeze({
    id: "FORMATION_AS_EXPERIENCE",
    rule: "【Formation 转写】把知道的事写成角色的经历、见闻、场景事实——用角色的视角语言，不要出现节点编号或数据字段名。",
  }),
  Object.freeze({
    id: "NO_PLAYER_PUPPETEERING",
    rule: "【不准替玩家决定】不准写「你会去和某人谈判/你会交换/你应该去找谁」。角色本只给动机与信息，行动是玩家的。",
  }),
  Object.freeze({
    id: "NO_PREWRITTEN_DEAL",
    rule: "【不准预写结果】成交、相信、结盟、交换的完成一律不准写。现场怎么谈、谈不谈得成，全部留给玩家。",
  }),
  Object.freeze({
    id: "NO_META_INSTRUCTIONS",
    rule: "【不准 meta】不准写「你可以和 X 交换」「现在开始谈判」「作者提示」这类出戏指令。",
  }),
]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/** 该角色是否可知该节点（可见性投射核心） */
function nodeKnownTo(node, characterId) {
  if (node.kind === "LEVERAGE_EDGE") return false; // 设计结构，非角色知识
  if (node.kind === "INFERENCE") {
    return node.subjectCharacterId === characterId;
  }
  if (node.acquisition.mode === "CONFIDENCE_BOOST") {
    return node.holderIds.includes(characterId);
  }
  return (
    node.holderIds.includes(characterId) ||
    node.visibleToIds.includes(characterId) ||
    node.acquisition.whoCanAcquireIds.includes(characterId)
  );
}

/** 公共事实：所有角色都可知 */
function isPublicTo(node, characterIds) {
  return characterIds.length > 0 && characterIds.every((cid) => nodeKnownTo(node, cid));
}

/**
 * factEntry（V1.2 / F4A）：经 role-relative projection 投射后的条目。
 * - projectionType：该信息对此 audience 的语义性质（SELF_KNOWN_* / OWNED_OBJECT / …）
 * - subjectCharacterIds：该事实的主体（仅当 audience 是主体时才附带，供 Writer 视角化）
 * - text：主体受众已剥离 inline 推断；非主体保留原文
 * - provenance 继续跟随节点可见性（V1.1 规则不变）
 */
function factEntry(node, audience) {
  const projection = projectFormationNodeForAudience(node, audience);
  const entry = {
    nodeId: node.id,
    text: projection.text,
    howAcquired: node.acquisition.how || null,
    kind: node.kind,
    projectionType: projection.projectionType,
    provenance: {
      type: node.provenance.type,
      summary: node.provenance.summary,
      sourceRefs: node.provenance.sourceRefs,
    },
  };
  // 主体标记只发给主体本人（不把「谁是主体」泄露给其他受众）
  if (projection.subjectCharacterIds.includes(audience?.audienceId)) {
    entry.subjectCharacterIds = projection.subjectCharacterIds;
  }
  return entry;
}

/**
 * 公共人物目录（V1.1）：只放公开身份。
 * 故意不含 openingGoal / roleInBargain / 私有关系——否则修「身份乱编」时会开新的信息泄露洞。
 */
function publicCastDirectoryOf(characters) {
  return characters.map((c) => ({
    characterId: c.id,
    name: c.name,
    publicIdentity: c.identity,
  }));
}

/**
 * 构建 Preview Writer Packets。
 *
 * @param {{ artifact: object, gateResult: object, context: object,
 *           audiences?: Array<{ type: "CHARACTER", characterId } | { type: "HOST" }> }} input
 *   gateResult 必须是 FORMATION_READY（本实验只喂已成立的 Formation）；
 *   context 为作者已确认的角色/场景上下文（fixtures 数据）；
 *   audiences 缺省 = 全部角色 + HOST。
 *
 * @returns {{ ok: true, packets: Array<object> } | { ok: false, errors: Array<{code,message}> }}
 */
export function buildM12FormationPreviewPackets(input = {}) {
  const raw = input && typeof input === "object" ? input : {};
  const errors = [];

  const gate = record(raw.gateResult);
  if (gate.decision !== "FORMATION_READY") {
    errors.push({
      code: "GATE_NOT_READY",
      message: `Preview Writer 只消费 FORMATION_READY 的 Artifact（当前 decision=${gate.decision || "(无)"}）`,
    });
    return { ok: false, errors };
  }

  const artifact = normalizeM12FormationArtifact(raw.artifact || {});
  if (!artifact.nodes.length) {
    errors.push({ code: "ARTIFACT_EMPTY", message: "Artifact 没有 nodes" });
    return { ok: false, errors };
  }

  const context = record(raw.context);
  const characters = Array.isArray(context.characters) ? context.characters : [];
  const characterById = new Map(characters.map((c) => [c.id, c]));
  const characterIds = characters.map((c) => c.id);
  if (!characterIds.length) {
    errors.push({ code: "CONTEXT_CHARACTERS_MISSING", message: "context.characters 为空" });
    return { ok: false, errors };
  }

  const scene = record(context.scene);
  const publicNodes = artifact.nodes.filter((n) => isPublicTo(n, characterIds));

  const audiences =
    Array.isArray(raw.audiences) && raw.audiences.length
      ? raw.audiences
      : [...characterIds.map((cid) => ({ type: "CHARACTER", characterId: cid })), { type: "HOST" }];

  const packets = [];
  for (const audience of audiences) {
    const type = audience?.type;
    if (type === "HOST") {
      packets.push({
        version: M12_PREVIEW_WRITER_PACKET_VERSION,
        kind: "M12_FORMATION_PREVIEW_WRITER_PACKET",
        audienceType: "HOST",
        projectId: artifact.projectId,
        artifactId: artifact.id,
        gateDecision: "FORMATION_READY",
        scene: {
          title: scene.title || null,
          timeWindow: scene.timeWindow || null,
          publicRules: Array.isArray(scene.publicRules) ? scene.publicRules : [],
        },
        castDirectory: characters.map((c) => ({
          characterId: c.id,
          name: c.name,
          identity: c.identity,
        })),
        fixedFacts: publicNodes.map((n) => factEntry(n, { audienceType: "HOST", audienceId: null })),
        writingRules: M12_PREVIEW_WRITING_RULES.map((r) => r.rule),
        hostDuties: [
          "主持文本只陈述公共规则与时窗，不剧透任何角色的私有信息。",
          "不替玩家安排互动结果；现场交换、谈判、欺骗全部由玩家决定。",
        ],
      });
      continue;
    }

    if (type === "CHARACTER") {
      const character = characterById.get(audience.characterId);
      if (!character) {
        errors.push({
          code: "AUDIENCE_CHARACTER_UNKNOWN",
          message: `audiences 含未知角色（characterId=${audience.characterId}）`,
        });
        continue;
      }
      const cid = character.id;
      const knowledge = artifact.nodes.filter(
        (n) => nodeKnownTo(n, cid) && !isPublicTo(n, characterIds),
      );
      packets.push({
        version: M12_PREVIEW_WRITER_PACKET_VERSION,
        kind: "M12_FORMATION_PREVIEW_WRITER_PACKET",
        audienceType: "CHARACTER",
        projectId: artifact.projectId,
        artifactId: artifact.id,
        gateDecision: "FORMATION_READY",
        audience: {
          characterId: cid,
          name: character.name,
          identity: character.identity,
          roleInBargain: character.roleInBargain || "OTHER",
          openingGoal: character.openingGoal || null,
        },
        scene: {
          title: scene.title || null,
          timeWindow: scene.timeWindow || null,
          publicRules: Array.isArray(scene.publicRules) ? scene.publicRules : [],
        },
        fixedFacts: publicNodes.map((n) => factEntry(n, { audienceType: "CHARACTER", audienceId: cid })),
        characterKnowledge: knowledge.map((n) => factEntry(n, { audienceType: "CHARACTER", audienceId: cid })),
        publicCastDirectory: publicCastDirectoryOf(characters),
        writingRules: M12_PREVIEW_WRITING_RULES.map((r) => r.rule),
      });
      continue;
    }

    errors.push({ code: "AUDIENCE_TYPE_INVALID", message: `audience.type 非法（${type}）` });
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, packets };
}
