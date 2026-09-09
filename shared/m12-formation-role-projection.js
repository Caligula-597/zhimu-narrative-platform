/**
 * F4A — Role-Relative Semantic Projection V1（纯函数 · derived sidecar）。
 *
 * 解决的真实 bug（Preview Run #2 暴露）：
 *   N4 reveals =「梁赫签字参与预展资料整理 → 可能知道内部目录」是 seeker-oriented 文本。
 *   直接发给 P2（梁赫本人）时，Writer 把 inline 推断升级成「我翻过内部目录」。
 *
 * 三原则（钉死）：
 *   1. Canonical truth 只有一份 —— 投影不改写 FormationNode，不落库，不写回 artifact；
 *   2. Audience rendering 可以不同 —— 同一 node 对不同 audience 投射不同 projectionType/文本；
 *   3. Audience rendering 不得新增事实 —— 主体受众只做「推断剥离」（删去 "→" 之后
 *      的 inline 推断），绝不添加任何文本。
 *
 * 投影类型（8 个，确定性推导，不逐角色手写文案）：
 *   CANON_FACT          世界既定事实（对非主体受众的通用投射）
 *   SELF_KNOWN_FACT     关于 audience 自身行为/状态的事实（主体或 holder）
 *   OBSERVED_FACT       audience 亲自观察到的事实（OBSERVABLE）
 *   ACTIONABLE_INFERENCE audience 自己形成的可行动推断（INFERENCE 的 subject）
 *   PRIVATE_MEMORY      audience 的私人记忆（MEMORY 的 holder）
 *   PUBLIC_RULE         世界公共规则（TRIGGER / PUBLIC_WORLD_RULE 公共事实）
 *   OWNED_OBJECT        audience 拥有的物件（OBJECT 的 holder）
 *   SELF_KNOWN_NEED     audience 自己的需求（NEED 的 holder）
 *
 * 文本规则：
 *   - audience 是事实主体（subjectCharacterIds 含 audience）或 HOST → 剥离 inline 推断
 *     （"→" 之后的尾段是观察者的推断，不是主体的已知事实；无 "→" 则原文不变）
 *   - 其他受众 → 原文完整保留（inline 推断对非主体是合法的世界理解，
 *     例如任何翻签名页的人都可能推断「梁赫可能知道目录」）
 *
 * 本模块不做：Beat 压缩、Integrator、PMD（F4B+）。
 */

import { normalizeFormationNode } from "./m12-formation-contracts.js";

export const M12_FORMATION_PROJECTION_TYPES = Object.freeze([
  "CANON_FACT",
  "SELF_KNOWN_FACT",
  "OBSERVED_FACT",
  "ACTIONABLE_INFERENCE",
  "PRIVATE_MEMORY",
  "PUBLIC_RULE",
  "OWNED_OBJECT",
  "SELF_KNOWN_NEED",
]);

/** 剥离 inline 推断：截断首个 "→" 之前的事实部分；无 "→" 或截断后为空则原文返回 */
function stripInlineInference(text) {
  const arrow = text.indexOf("→");
  if (arrow <= 0) return text;
  const stripped = text.slice(0, arrow).trim();
  return stripped || text;
}

/**
 * 对「已确认对该 audience 可见」的节点做视角投影。
 * 可见性判定不在本层（由 packet 层 nodeKnownTo 负责）——本层只做语义投射。
 *
 * @param {object} node — 已 normalize 的 FormationNode
 * @param {{ audienceId?: string|null, audienceType?: "CHARACTER"|"HOST" }} audience
 * @returns {{ nodeId, kind, projectionType, text, subjectCharacterIds } | null}
 */
export function projectFormationNodeForAudience(node, audience = {}) {
  if (!node || !node.id) return null;
  const audienceType = audience.audienceType === "HOST" ? "HOST" : "CHARACTER";
  const isHost = audienceType === "HOST";
  const audienceId = audience.audienceId || null;
  const subjects = Array.isArray(node.subjectCharacterIds) ? node.subjectCharacterIds : [];
  const isSubject = !isHost && audienceId != null && subjects.includes(audienceId);
  const isHolder = !isHost && audienceId != null && node.holderIds.includes(audienceId);

  // ── 投影类型推导（deterministic）────────────────────────────────
  let projectionType;
  if (node.kind === "INFERENCE") projectionType = "ACTIONABLE_INFERENCE";
  else if (node.kind === "NEED") projectionType = "SELF_KNOWN_NEED";
  else if (node.kind === "MEMORY") projectionType = "PRIVATE_MEMORY";
  else if (node.kind === "OBJECT") projectionType = "OWNED_OBJECT";
  else if (node.kind === "OBSERVABLE") projectionType = "OBSERVED_FACT";
  else if (node.kind === "TRIGGER") projectionType = "PUBLIC_RULE";
  else if (isSubject) projectionType = "SELF_KNOWN_FACT";
  else if (isHolder) projectionType = "SELF_KNOWN_FACT";
  else if (!node.holderIds.length && node.provenance?.type === "PUBLIC_WORLD_RULE") {
    projectionType = "PUBLIC_RULE";
  } else projectionType = "CANON_FACT";

  // ── 文本投射：主体/HOST 剥离 inline 推断，其他原文 ───────────────
  const rawText = node.reveals.join("；");
  const text = isSubject || isHost ? stripInlineInference(rawText) : rawText;

  return {
    nodeId: node.id,
    kind: node.kind,
    projectionType,
    text,
    subjectCharacterIds: subjects,
  };
}

/**
 * 对整个节点列表按 audience 投影（便捷入口；仅投射传入的节点，不判可见性）。
 * @returns {Array<{ nodeId, kind, projectionType, text, subjectCharacterIds }>}
 */
export function projectFormationNodesForAudience(nodes, audience = {}) {
  return (Array.isArray(nodes) ? nodes : [])
    .map((n) => (n && n.id ? n : null))
    .filter(Boolean)
    .map((n) => projectFormationNodeForAudience(n, audience))
    .filter(Boolean);
}

/** 便捷：对 normalize 前的原始 node 做投影（内部 normalize，不修改原对象） */
export function projectRawFormationNode(rawNode, audience = {}) {
  const node = normalizeFormationNode(rawNode);
  return node ? projectFormationNodeForAudience(node, audience) : null;
}
