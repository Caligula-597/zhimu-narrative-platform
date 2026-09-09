/**
 * F2 — M12 Formation Builder V1（deterministic，不接真实 LLM）。
 *
 * 分层（钉死）：
 *   pack formationBlueprint = 族级能力约束：只说 M12 要形成什么，零剧情内容；
 *   ProjectStoryState       = 项目事实唯一权威（projectId / M12 block / roleBindings / revision）；
 *   Builder                 = 把「作者已确认内容」实例化为 F1 M12FormationArtifact；
 *   Gate（F3）              = 语义裁决（FORMATION_* 错误码、FORMATION_READY/REVIEW）。
 *
 * 输入（Authority Hardening 后的唯一形状）：
 *   state             — ProjectStoryState（authoritative）
 *   sourceBlockId     — state.mechanismBlocks 中目标 M12-1 block 的 id
 *   authoredFormation — { stake, nodes, formation, proof }（作者已确认内容）
 *   artifactId        — 可选，默认 m12f-<projectId>-<sourceBlockId>
 *
 * 调用方无权另行提供：projectId / block / revision / participants —— 一律取自 state。
 *   Builder 只能从真正的项目状态里拿项目事实，不相信调用方自己声明的「项目现状」。
 *
 * 装配级职责：
 *   1. sourceBlockId 必须命中 state.mechanismBlocks（STATE_BLOCK_NOT_FOUND）；
 *   2. block 必须是 accepted M12-1（USER_ACCEPTED / USER_MODIFIED / LOCKED）；
 *   3. participants ← block.roleBindings（bargainA=seeker / bargainB=holder）；
 *   4. sourceBlockRevision ← block.revision（STALE 刷新由 F1 逻辑负责）；
 *   5. projectId ← state.projectId；
 *   6. 缺失不补全（F1 Hardening 原则）：mode / type / proof 布尔缺失或非法 → 拒绝；
 *   7. 预写成交原文（gave/received/tradeCompleted/exchangeResult、非 OPEN resolution）→ 拒绝，
 *      不允许借 normalize「洗白」后混进 Artifact；
 *   8. Blueprint 能力覆盖：requiredCapabilities 每项必须落到具体节点/引用；
 *   9. 复用 F1 断言：INFERENCE 不污染 Canon、LEVERAGE_EDGE 保持 OPEN；
 *   10. 输出最多 READY_FOR_VALIDATION，永不 FORMATION_READY（那是 F3 的权力）。
 *
 * 不做的事（钉死）：
 *   🚫 不接真实 LLM；🚫 不做 F3 Validator；🚫 不进 Integrator；🚫 不动 Writer；
 *   🚫 不抽跨族 schema；🚫 不假装消费 contextProfile（等真正生成内容时再接入）。
 *
 * forbiddenSemantics 与本层的结构层对应（语义深判仍属 F3）：
 *   PREWRITTEN_DEAL    → 拒绝显式事件字段 / 非 OPEN resolution 输入；
 *   UNSOURCED_ANSWER   → INFERENCE 必须有 requiresNodeIds + subjectCharacterId；
 *   UNSOURCED_LEVERAGE → provenance.type 必须显式（内容深判属 F3）。
 *
 * 持久化：产物经 F1 upsertM12FormationArtifact 入 ProjectStoryState，本层不重复。
 */

import { buildM12CompleteTemplates } from "./story-mechanism-m12-pack.js";
import { normalizeProjectStoryState } from "./story-mechanism-contracts.js";
import {
  normalizeM12FormationArtifact,
  assertNoCanonPollutionFromInferences,
  assertLeverageEdgesAreOpen,
  FORMATION_FIELD_KEYS,
  FORMATION_NODE_KINDS,
  FORMATION_ACQUISITION_MODES,
  FORMATION_PROVENANCE_TYPES,
} from "./m12-formation-contracts.js";

export const M12_FORMATION_TEMPLATE_ID = "M12-1";

/** Blueprint 能力 → Artifact 内必须被实例化的位置（能力约束的落地映射） */
export const M12_FORMATION_CAPABILITY_SOURCES = Object.freeze({
  VALUE_SOURCE: { field: "valueSource" },
  EXISTENCE_SOURCE: { field: "existenceSource" },
  KNOWLEDGE_PATH: { field: "knowledgePath" },
  LOCATOR_PATH: { field: "locatorPath" },
  COUNTERPART_LEVERAGE: { field: "counterpartLeverage" },
  LEVERAGE_PROVENANCE: { field: "leverageProvenance" },
  COUNTERPART_NEED: { field: "counterpartNeed" },
  NEED_RECOGNITION: { proofPath: ["bilateralLeverage", "seekerRecognitionNodeIds"] },
  WORLD_TRIGGER: { field: "trigger" },
});

/** accepted 状态集合：DRAFT 不算已接受 */
const ACCEPTED_BLOCK_STATUSES = new Set(["USER_ACCEPTED", "USER_MODIFIED", "LOCKED"]);

const LEVERAGE_EDGE_EVENT_FIELDS = ["gave", "received", "tradeCompleted", "exchangeResult"];

function err(code, message, extra = {}) {
  return { code, message, ...extra };
}

/** 八字段输入既接受 ["N1","N2"] 也接受 { nodeIds: ["N1","N2"] } */
function fieldNodeIds(value) {
  if (Array.isArray(value)) {
    return value.map((x) => String(x ?? "").trim()).filter(Boolean);
  }
  if (value && typeof value === "object" && Array.isArray(value.nodeIds)) {
    return value.nodeIds.map((x) => String(x ?? "").trim()).filter(Boolean);
  }
  return [];
}

function proofIds(artifact, proofPath) {
  let cur = artifact.proof;
  for (const key of proofPath) {
    cur = cur && typeof cur === "object" ? cur[key] : undefined;
  }
  return Array.isArray(cur) ? cur : [];
}

/**
 * 构建 M12FormationArtifact。
 *
 * 项目事实（projectId / block / revision / participants）全部取自 state；
 * 作者只提供 Formation 内容本身（authoredFormation）。
 *
 * @returns {{ ok: true, artifact: object } | { ok: false, errors: Array<{code,message,...}> }}
 *   全有或全无：存在任何装配错误即不产出 Artifact（不部分成功、不默认补洞）。
 */
export function buildM12FormationArtifact(input = {}) {
  const errors = [];
  const raw = input && typeof input === "object" ? input : {};

  // ── 1. state：ProjectStoryState 是项目事实唯一权威 ────────────────
  const state =
    raw.state && typeof raw.state === "object" ? normalizeProjectStoryState(raw.state) : null;
  if (!state) {
    errors.push(err("STATE_MISSING", "缺少 ProjectStoryState（项目事实唯一权威来源）"));
  }

  // ── 2. sourceBlockId 必须命中 state.mechanismBlocks ───────────────
  const sourceBlockId = String(raw.sourceBlockId ?? "").trim();
  const block =
    state && sourceBlockId
      ? state.mechanismBlocks.find((b) => b && b.id === sourceBlockId) || null
      : null;
  if (!sourceBlockId) {
    errors.push(err("SOURCE_BLOCK_ID_MISSING", "缺少 sourceBlockId"));
  } else if (state && !block) {
    errors.push(
      err("STATE_BLOCK_NOT_FOUND", "sourceBlockId 不在 state.mechanismBlocks 中", {
        sourceBlockId,
      }),
    );
  }

  // ── 3. block 必须是已接受的 M12-1 ───────────────────────────────
  if (block) {
    if (block.templateId !== M12_FORMATION_TEMPLATE_ID) {
      errors.push(
        err("BLOCK_NOT_M12_1", `block.templateId 必须是 ${M12_FORMATION_TEMPLATE_ID}`, {
          templateId: block.templateId,
        }),
      );
    }
    if (!ACCEPTED_BLOCK_STATUSES.has(block.status)) {
      errors.push(err("BLOCK_NOT_ACCEPTED", `block 尚未被接受（status=${block.status}）`));
    }
  }

  // ── 4. roleBindings：bargainA=seeker / bargainB=holder（权威=state 内 block）──
  const seekerId = block?.roleBindings?.bargainA?.id || null;
  const holderId = block?.roleBindings?.bargainB?.id || null;
  if (block && (!seekerId || !holderId)) {
    errors.push(err("ROLE_BINDING_MISSING", "block.roleBindings 缺少 bargainA/bargainB"));
  } else if (seekerId && holderId && seekerId === holderId) {
    errors.push(err("ROLE_BINDING_IDENTICAL", "seeker 与 holder 不得为同一角色"));
  }

  // ── 5. authoredFormation：作者已确认内容 ────────────────────────
  const authored =
    raw.authoredFormation && typeof raw.authoredFormation === "object"
      ? raw.authoredFormation
      : {};

  const stake = authored.stake && typeof authored.stake === "object" ? authored.stake : {};
  if (!String(stake.ref ?? "").trim() && !String(stake.label ?? "").trim()) {
    errors.push(err("STAKE_MISSING", "缺少 stake（ref / label 至少一项）"));
  }

  // ── 6. Blueprint：必须从 pack 读取（Builder 不自带副本）──────────
  const template = buildM12CompleteTemplates().find((t) => t.id === M12_FORMATION_TEMPLATE_ID);
  const blueprint = template?.formationBlueprint;
  if (!blueprint || !Array.isArray(blueprint.requiredCapabilities)) {
    errors.push(err("BLUEPRINT_MISSING", "pack M12-1 缺少 formationBlueprint"));
  }

  // ── 7. 原始 nodes：显式性 + 预写成交原文（缺失不补全）────────────
  const rawNodes = Array.isArray(authored.nodes) ? authored.nodes : [];
  if (!rawNodes.length) {
    errors.push(err("NODES_MISSING", "缺少 nodes（作者已确认事实）"));
  }
  const nodeIds = new Set();
  for (const node of rawNodes) {
    const id = String(node?.id ?? "").trim();
    if (!id) {
      errors.push(err("NODE_INVALID", "node 缺少 id"));
      continue;
    }
    if (nodeIds.has(id)) {
      errors.push(err("NODE_DUPLICATE_ID", "node id 重复", { nodeId: id }));
      continue;
    }
    nodeIds.add(id);

    if (!FORMATION_NODE_KINDS.includes(node.kind)) {
      errors.push(err("NODE_KIND_INVALID", "node.kind 非法", { nodeId: id, kind: node.kind }));
    }
    const acq = node.acquisition || node.acquire;
    if (!acq || !FORMATION_ACQUISITION_MODES.includes(acq.mode)) {
      errors.push(
        err("NODE_ACQUISITION_UNRESOLVED", "acquisition.mode 缺失或非法（不得默认 GUARANTEED）", {
          nodeId: id,
        }),
      );
    }
    const prov = node.provenance;
    if (!prov || !FORMATION_PROVENANCE_TYPES.includes(prov.type)) {
      errors.push(
        err("NODE_PROVENANCE_UNRESOLVED", "provenance.type 缺失或非法（不得默认 LOCKED_FACT）", {
          nodeId: id,
        }),
      );
    }
    if (node.kind === "LEVERAGE_EDGE") {
      for (const field of LEVERAGE_EDGE_EVENT_FIELDS) {
        if (node[field] != null) {
          errors.push(
            err("LEVERAGE_EDGE_INPUT_PREWRITTEN", "LEVERAGE_EDGE 含成交事件字段（禁止预写成交）", {
              nodeId: id,
              field,
            }),
          );
        }
      }
      if (node.resolution != null && node.resolution !== "OPEN") {
        errors.push(
          err("LEVERAGE_EDGE_INPUT_PREWRITTEN", "LEVERAGE_EDGE.resolution 必须是 OPEN", {
            nodeId: id,
            field: "resolution",
            value: node.resolution,
          }),
        );
      }
    }
  }

  // ── 8. proof 显式性：布尔必须显式（缺失 ≠ 成立）─────────────────
  const rawProof = authored.proof && typeof authored.proof === "object" ? authored.proof : {};
  const hasNoUnsourcedAnswer =
    typeof rawProof.noUnsourcedAnswer === "boolean" ||
    typeof rawProof.noUnsourcedAnswerAtStart === "boolean";
  if (typeof rawProof.noPreWrittenDeal !== "boolean" || !hasNoUnsourcedAnswer) {
    errors.push(
      err("PROOF_FLAG_UNRESOLVED", "proof.noPreWrittenDeal / noUnsourcedAnswer 必须显式 boolean"),
    );
  }

  // ── 9. formation 八字段：非空 + 无悬空引用 ──────────────────────
  const rawFormation =
    authored.formation && typeof authored.formation === "object" ? authored.formation : {};
  for (const key of FORMATION_FIELD_KEYS) {
    const ids = fieldNodeIds(rawFormation[key]);
    if (!ids.length) {
      errors.push(err("FORMATION_FIELD_EMPTY", "formation 字段为空", { field: key }));
      continue;
    }
    for (const id of ids) {
      if (!nodeIds.has(id)) {
        errors.push(
          err("FORMATION_FIELD_DANGLING_REF", "formation 字段引用了不存在的 node", {
            field: key,
            nodeId: id,
          }),
        );
      }
    }
  }

  if (errors.length) return { ok: false, errors };

  // ── 10. 装配：项目事实全部来自 state 权威（调用方无可伪造入口）───
  const projectId = state.projectId || "project";
  const artifactId = String(raw.artifactId ?? "").trim() || `m12f-${projectId}-${sourceBlockId}`;

  const artifact = normalizeM12FormationArtifact({
    id: artifactId,
    projectId,
    sourceBlockId,
    sourceBlockRevision: block.revision,
    templateId: M12_FORMATION_TEMPLATE_ID,
    participants: { seekerId, holderId },
    stake,
    formation: rawFormation,
    nodes: rawNodes,
    proof: rawProof,
    status: "READY_FOR_VALIDATION",
    revision: 1,
  });

  // ── 11. 装配后断言（复用 F1）────────────────────────────────────
  for (const issue of assertNoCanonPollutionFromInferences(artifact)) {
    errors.push(err(issue.code, "INFERENCE 结构不完整（不得污染 Canon）", issue));
  }
  for (const issue of assertLeverageEdgesAreOpen(artifact)) {
    errors.push(err(issue.code, "LEVERAGE_EDGE 必须保持 OPEN 关系边", issue));
  }

  // INFERENCE 必须有依据：无 requires 的推断 = 无来源答案（结构层 UNSOURCED_ANSWER）
  for (const node of artifact.nodes) {
    if (node.kind === "INFERENCE" && !node.requiresNodeIds.length) {
      errors.push(
        err("INFERENCE_UNSOURCED", "INFERENCE 缺少 requiresNodeIds（无依据推断=无来源答案）", {
          nodeId: node.id,
        }),
      );
    }
  }

  // ── 12. Blueprint 能力覆盖：每个能力必须落到具体节点/引用 ────────
  if (blueprint) {
    for (const capability of blueprint.requiredCapabilities) {
      const source = M12_FORMATION_CAPABILITY_SOURCES[capability];
      if (!source) {
        errors.push(
          err("CAPABILITY_MAPPING_MISSING", "Blueprint 能力缺少落地映射", { capability }),
        );
        continue;
      }
      const ids = source.field
        ? artifact.formation[source.field].nodeIds
        : proofIds(artifact, source.proofPath);
      if (!ids.length) {
        errors.push(
          err("BLUEPRINT_CAPABILITY_UNCOVERED", "Blueprint 能力未被实例化（Blueprint 是能力约束）", {
            capability,
          }),
        );
      }
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, artifact };
}
