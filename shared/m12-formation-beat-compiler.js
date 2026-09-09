/**
 * F4B — M12 Formation Beat Compiler V1（deterministic · 只编译，不接 Integrator）。
 *
 * 第一次回答：这些因果节点怎样组成玩家真正经历的几个剧情节拍？
 *
 * 铁律（F4A 冻结备注延续）：本 compiler 不使用 INLINE_ARROW_STRIP 或任何
 * 字符串规则解析语义——audienceViews 全部来自 F4A 投影输出（结构化字段推导）。
 *
 * Node ≠ Beat：Beat 是一次有体验意义的剧情变化，nodeRefs 只是证据来源。
 * 编排规则是族级因果阶段（与 F2 blueprint 的 9 capabilities 对齐），
 * 不含任何 Gold 节点/角色/剧情：
 *   B1 NOTICE_VALUE     ← VALUE_SOURCE + EXISTENCE_SOURCE   （异常浮现）
 *   B2 TRACE_COUNTERPART← KNOWLEDGE_PATH + LOCATOR_PATH     （对手定位）
 *   B3 FORM_LEVERAGE    ← 4×双边能力                        （双边条件形成）
 *   B4 TIME_PRESSURE    ← WORLD_TRIGGER                     （时机闭合）
 * （RECOGNIZE_NEED 为合法 purpose 枚举，V1 不单独成 beat，归 B3。）
 *
 * 三个危险坑（钉死）：
 *   1. Beat = nodes 的编排/聚合/delivery ≠ 新 Canon——零新增文本；
 *   2. optional confidence（CONFIDENCE_BOOST）绝不进 requiredNodeRefs，
 *      也不进 requiresBeatIds 因果——白绫/周祁可拒绝配合；
 *   3. 不生成 NEGOTIATE/EXCHANGE outcome——B3 结尾只是「两边有理由接触」，
 *      Resolution（PROBE→NEGOTIATE→EXCHANGE→AFTERMATH）属于既有 M12 合同。
 *
 * 权威入口（延续 F2/F3）：compileM12FormationBeats({ state, artifactId })；
 * 内部复跑 F3 Gate，只有 FORMATION_READY 才编译。
 *
 * 本刀不做：Integrator / PMD / Writer / Master Outline（F4C+）。
 */

import { normalizeProjectStoryState } from "./story-mechanism-contracts.js";
import { validateM12Formation } from "./m12-formation-validator.js";
import { M12_FORMATION_CAPABILITY_SOURCES } from "./m12-formation-builder.js";
import {
  projectFormationNodeForAudience,
  formationNodeKnownTo,
} from "./m12-formation-role-projection.js";

export const M12_FORMATION_BEAT_VERSION = 1;

export const M12_FORMATION_BEAT_PURPOSES = Object.freeze([
  "NOTICE_VALUE",
  "TRACE_COUNTERPART",
  "FORM_LEVERAGE",
  "RECOGNIZE_NEED",
  "TIME_PRESSURE",
]);

export const M12_FORMATION_BEAT_DELIVERY_MODES = Object.freeze([
  "OPENING_CONTEXT",
  "PUBLIC_DISCOVERY",
  "PRIVATE_KNOWLEDGE",
  "OBSERVED_EVENT",
  "WORLD_TRIGGER",
]);

/** 族级编排规则：Formation 因果阶段 → capability 分组（非 Gold 剧情知识） */
const BEAT_FAMILIES = Object.freeze([
  Object.freeze({
    id: "B1",
    purpose: "NOTICE_VALUE",
    capabilities: Object.freeze(["VALUE_SOURCE", "EXISTENCE_SOURCE"]),
  }),
  Object.freeze({
    id: "B2",
    purpose: "TRACE_COUNTERPART",
    capabilities: Object.freeze(["KNOWLEDGE_PATH", "LOCATOR_PATH"]),
  }),
  Object.freeze({
    id: "B3",
    purpose: "FORM_LEVERAGE",
    capabilities: Object.freeze([
      "COUNTERPART_LEVERAGE",
      "LEVERAGE_PROVENANCE",
      "COUNTERPART_NEED",
      "NEED_RECOGNITION",
    ]),
  }),
  Object.freeze({
    id: "B4",
    purpose: "TIME_PRESSURE",
    capabilities: Object.freeze(["WORLD_TRIGGER"]),
  }),
]);

function err(code, message, extra = {}) {
  return { code, message, ...extra };
}

/** capability → 支撑节点（复用 F2 的单一映射，不造第二份） */
function supportNodeIdsFor(artifact, capability) {
  const source = M12_FORMATION_CAPABILITY_SOURCES[capability];
  if (!source) return [];
  if (source.field) return artifact.formation[source.field].nodeIds;
  let cur = artifact.proof;
  for (const key of source.proofPath || []) {
    cur = cur && typeof cur === "object" ? cur[key] : undefined;
  }
  return Array.isArray(cur) ? cur : [];
}

function unique(list) {
  return [...new Set((Array.isArray(list) ? list : []).filter(Boolean))];
}

/** delivery.mode 推导（deterministic，优先级规则） */
function deriveDeliveryMode(requiredNodes) {
  const kinds = new Set(requiredNodes.map((n) => n.kind));
  if (kinds.has("TRIGGER")) return "WORLD_TRIGGER";
  if (kinds.has("OBSERVABLE")) return "OBSERVED_EVENT";
  // 排除 INFERENCE（seeker 的推断不是传播障碍）后全公共 → 公开探索
  const nonInference = requiredNodes.filter((n) => n.kind !== "INFERENCE");
  const allPublic =
    nonInference.length > 0 && nonInference.every((n) => n.holderIds.length === 0);
  if (allPublic) return "PUBLIC_DISCOVERY";
  if (requiredNodes.some((n) => n.acquisition.mode === "OPENING_OWNED")) {
    return "OPENING_CONTEXT";
  }
  return "PRIVATE_KNOWLEDGE";
}

function stageHintOf(requiredNodes) {
  return unique(requiredNodes.map((n) => n.acquisition.availableStage).filter(Boolean)).sort();
}

/** beat 参与者：私有体验者（holder/subject/边两端）；公共节点不贡献 */
function participantsOf(nodes, seekerId, holderId) {
  const ids = new Set();
  for (const node of nodes) {
    if (node.kind === "LEVERAGE_EDGE") {
      for (const side of [node.sideA, node.sideB]) {
        if (side?.characterId) ids.add(side.characterId);
      }
      continue;
    }
    for (const h of node.holderIds) ids.add(h);
    if (node.kind === "INFERENCE" && node.subjectCharacterId) ids.add(node.subjectCharacterId);
  }
  if (!ids.size) {
    // 无私有参与者（如纯公共 trigger）→ 时窗压力主体
    return [seekerId, holderId].filter(Boolean);
  }
  return [...ids];
}

/**
 * 编译 M12 Formation Beats。
 *
 * @param {{ state: object, artifactId: string }} input
 * @returns {{ ok: true, beats: Array, coverage: object } |
 *            { ok: false, errors: Array<{code,message,...}> }}
 */
export function compileM12FormationBeats(input = {}) {
  const raw = input && typeof input === "object" ? input : {};
  const errors = [];

  // ── 权威定位 + F3 Gate 复跑（只编译 FORMATION_READY）────────────
  const gate = raw.state
    ? validateM12Formation({ state: normalizeProjectStoryState(raw.state), artifactId: String(raw.artifactId ?? "").trim() })
    : { decision: null, issues: [{ code: "STATE_MISSING", message: "缺少 ProjectStoryState" }], checks: { blocked: "STATE_MISSING" } };
  if (gate.decision !== "FORMATION_READY") {
    const code = gate.checks?.blocked || "BEAT_INPUT_NOT_READY";
    errors.push(err(code, "Beat compiler 只编译 FORMATION_READY 的 Artifact", { gateIssues: gate.issues }));
    return { ok: false, errors };
  }

  const state = normalizeProjectStoryState(raw.state);
  const artifactId = String(raw.artifactId ?? "").trim();
  const artifact = state.m12FormationArtifacts.find((a) => a.id === artifactId);
  const nodesById = new Map(artifact.nodes.map((n) => [n.id, n]));
  const seekerId = artifact.participants.seekerId;
  const holderId = artifact.participants.holderId;

  // ── 每 family：直接支撑 / required / optional ────────────────────
  const drafts = BEAT_FAMILIES.map((family) => {
    const directIds = unique(
      family.capabilities.flatMap((cap) => supportNodeIdsFor(artifact, cap)),
    );
    const directNodes = directIds.map((id) => nodesById.get(id)).filter(Boolean);
    const required = directNodes.filter((n) => n.acquisition.mode !== "CONFIDENCE_BOOST");
    const optional = directNodes.filter((n) => n.acquisition.mode === "CONFIDENCE_BOOST");
    return { family, directIds, directNodes, required, optional };
  });

  // 防御：READY 应保证全部 capability 有支撑
  const allDirectIds = new Set(drafts.flatMap((d) => d.directIds));
  for (const draft of drafts) {
    for (const cap of draft.family.capabilities) {
      if (!supportNodeIdsFor(artifact, cap).length) {
        errors.push(err("BEAT_CAPABILITY_UNCOVERED", "family capability 无支撑节点", { capability: cap }));
      }
    }
  }
  if (errors.length) return { ok: false, errors };

  // ── 孤立 LEVERAGE_EDGE：未被任何字段引用的双边杠杆边 → B3 结构证据 ──
  // （双边杠杆边是 FORM_LEVERAGE family 的直接证据；mode=BOOST → optional）
  const b3Draft = drafts.find((d) => d.family.id === "B3");
  for (const node of artifact.nodes) {
    if (node.kind === "LEVERAGE_EDGE" && !allDirectIds.has(node.id)) {
      b3Draft.directIds.push(node.id);
      b3Draft.directNodes.push(node);
      b3Draft.optional.push(node);
      allDirectIds.add(node.id);
    }
  }

  // ── supportNodeRefs：requires 前提 + LEVERAGE_EDGE 成员（排除所有 direct）──
  for (const draft of drafts) {
    const support = new Set();
    for (const node of draft.directNodes) {
      for (const rid of node.requiresNodeIds || []) {
        if (!allDirectIds.has(rid)) support.add(rid);
      }
      if (node.kind === "LEVERAGE_EDGE") {
        for (const side of [node.sideA, node.sideB]) {
          for (const mid of [...(side?.possessesNodeIds || []), ...(side?.wantsNodeIds || [])]) {
            if (!allDirectIds.has(mid)) support.add(mid);
          }
        }
      }
    }
    draft.supportIds = [...support];
  }

  // ── requiresBeatIds（只用 required 的 requires，optional 不构成因果）──
  const directBeatOf = new Map();
  for (const draft of drafts) {
    for (const id of draft.directIds) directBeatOf.set(id, draft.family.id);
  }
  for (const draft of drafts) {
    const refs = new Set();
    for (const node of draft.required) {
      for (const rid of node.requiresNodeIds || []) {
        const beatId = directBeatOf.get(rid);
        if (beatId && beatId !== draft.family.id) refs.add(beatId);
      }
    }
    draft.requiresBeatIds = [...refs].sort();
  }

  // ── 组装 beats ──────────────────────────────────────────────────
  const beats = drafts.map((draft) => {
    const participants = participantsOf(draft.directNodes, seekerId, holderId);
    const evidenceNodes = [...draft.directNodes, ...draft.supportIds.map((id) => nodesById.get(id)).filter(Boolean)];

    const audienceViews = {};
    for (const pid of participants) {
      audienceViews[pid] = evidenceNodes
        .filter((n) => formationNodeKnownTo(n, pid))
        .map((n) => {
          const p = projectFormationNodeForAudience(n, { audienceType: "CHARACTER", audienceId: pid });
          return { nodeId: n.id, projectionType: p.projectionType, text: p.text };
        });
    }

    return {
      version: M12_FORMATION_BEAT_VERSION,
      id: draft.family.id,
      purpose: draft.family.purpose,
      nodeRefs: draft.directIds,
      requiredNodeRefs: draft.required.map((n) => n.id),
      optionalNodeRefs: draft.optional.map((n) => n.id),
      supportNodeRefs: draft.supportIds,
      participants,
      delivery: {
        mode: deriveDeliveryMode(draft.required),
        stageHint: stageHintOf(draft.required),
      },
      audienceViews,
      requiresBeatIds: draft.requiresBeatIds,
      satisfiesCapabilities: draft.family.capabilities,
    };
  });

  // ── Gate 1 强制：全部节点可追踪 ─────────────────────────────────
  const covered = new Set([...allDirectIds, ...drafts.flatMap((d) => d.supportIds)]);
  const uncoveredNodeIds = artifact.nodes.map((n) => n.id).filter((id) => !covered.has(id));
  if (uncoveredNodeIds.length) {
    errors.push(err("BEAT_NODE_UNCOVERED", "存在未被任何 Beat 追踪的节点", { uncoveredNodeIds }));
    return { ok: false, errors };
  }

  return {
    ok: true,
    beats,
    coverage: {
      nodeCount: artifact.nodes.length,
      beatCount: beats.length,
      coveredNodeIds: [...covered].sort(),
      uncoveredNodeIds: [],
    },
  };
}

/** 人工审渲染标签（族级固定映射，非新剧情；渲染层不出现 Node ID） */
const PURPOSE_LABELS_ZH = Object.freeze({
  NOTICE_VALUE: "异常浮现",
  TRACE_COUNTERPART: "对手定位",
  FORM_LEVERAGE: "双边条件形成",
  RECOGNIZE_NEED: "需求识别",
  TIME_PRESSURE: "时机闭合",
});
const DELIVERY_LABELS_ZH = Object.freeze({
  OPENING_CONTEXT: "开场语境",
  PUBLIC_DISCOVERY: "公开探索",
  PRIVATE_KNOWLEDGE: "私有信息",
  OBSERVED_EVENT: "亲历目击",
  WORLD_TRIGGER: "世界时窗",
});
const PROJECTION_LABELS_ZH = Object.freeze({
  CANON_FACT: "既定事实",
  SELF_KNOWN_FACT: "自身事实",
  OBSERVED_FACT: "亲眼所见",
  ACTIONABLE_INFERENCE: "可行动推断",
  PRIVATE_MEMORY: "私人记忆",
  PUBLIC_RULE: "公共规则",
  OWNED_OBJECT: "持有之物",
  SELF_KNOWN_NEED: "自身需求",
});
const CAPABILITY_LABELS_ZH = Object.freeze({
  VALUE_SOURCE: "价值来源",
  EXISTENCE_SOURCE: "存在来源",
  KNOWLEDGE_PATH: "知情人路径",
  LOCATOR_PATH: "定位路径",
  COUNTERPART_LEVERAGE: "对家杠杆",
  LEVERAGE_PROVENANCE: "杠杆来源",
  COUNTERPART_NEED: "对家需求",
  NEED_RECOGNITION: "需求识别",
  WORLD_TRIGGER: "世界时窗",
});

/**
 * 人类审阅渲染（质量 Gate 素材）：隐藏全部 Node ID，看 4 个 Beat 是否是
 * 一条正常的剧情形成过程，而不是后台数据库摘要。
 *
 * @param {{ beats: Array, characterNames?: Record<string,string> }} input
 * @returns {string} markdown
 */
export function renderM12FormationBeatsForReview({ beats, characterNames = {} } = {}) {
  const nameOf = (id) => characterNames[id] || id;
  const lines = [];
  for (const beat of beats) {
    lines.push(`## ${beat.id} ${PURPOSE_LABELS_ZH[beat.purpose] || beat.purpose}`);
    lines.push("");
    lines.push(
      `- **交付**：${DELIVERY_LABELS_ZH[beat.delivery.mode] || beat.delivery.mode} · ${beat.delivery.stageHint.join("/")}`,
    );
    lines.push(
      `- **因果依赖**：${beat.requiresBeatIds.length ? beat.requiresBeatIds.join(" → ") : "无"}`,
    );
    lines.push(
      `- **满足能力**：${beat.satisfiesCapabilities.map((c) => CAPABILITY_LABELS_ZH[c] || c).join("、")}`,
    );
    lines.push(`- **参与者**：${beat.participants.map(nameOf).join("、")}`);
    for (const [pid, views] of Object.entries(beat.audienceViews)) {
      if (!views.length) continue;
      lines.push("");
      lines.push(`### ${nameOf(pid)} 的视角`);
      for (const v of views) {
        lines.push(`- （${PROJECTION_LABELS_ZH[v.projectionType] || v.projectionType}）${v.text}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}
