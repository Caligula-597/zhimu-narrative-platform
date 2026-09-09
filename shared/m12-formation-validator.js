/**
 * F3 — M12 Formation Validator / Gate V1（deterministic · 只读 · 不跑 LLM）。
 *
 * 回答的问题（区别于 F2 的「字段齐不齐」）：
 *   这个结构完整的 Artifact，是否真的证明玩家无需作者喊话也能形成这场谈判？
 *
 * 位置（钉死）：
 *   ProjectStoryState → F2 Builder → Artifact(READY_FOR_VALIDATION) → 本 Gate
 *     → decision: FORMATION_READY | FORMATION_REVIEW_REQUIRED →（F4 才接 Integrator）
 *
 * 权威入口（与 F2 一致，不开第二套权威）：
 *   validateM12Formation({ state, artifactId })
 *   只从 ProjectStoryState + artifactId 读取；不接受调用方递入 artifact。
 *
 * Gate 只读：
 *   READY 是 Gate decision，不是 Artifact lifecycle status——
 *   F1 已钉死 Artifact 自己无权宣布 FORMATION_READY，本层不回写。
 *
 * 基础 blocker（基础设施前置，非内容质量）：
 *   STATE_MISSING / FORMATION_ARTIFACT_NOT_FOUND / FORMATION_ARTIFACT_STALE /
 *   FORMATION_ARTIFACT_NOT_READY（DRAFT 等）
 *
 * 11 个主错误码（M12_FORMATION_ISSUE_CODES）与判定算法：
 *   ① guaranteed spine 验证 → FORMATION_SINGLE_POINT_DEPENDENCY
 *      spine 中每个节点必须：存在 + 非 CONFIDENCE_BOOST + 对 seeker 可达
 *      （OPENING_OWNED→seeker 持有/可获得；GUARANTEED→seeker 可见/可获得；
 *        INFERENCE→subject=seeker 且前提递归可达）
 *   ② 玩家侧 capability 支撑（spine ∨ 合法 opening-owned）→
 *      VALUE / EXISTENCE / KNOWLEDGE_PATH / LOCATOR_PATH / TRIGGER 各自错误码
 *   ③ 双边杠杆 → FORMATION_LEVERAGE_UNSOURCED
 *      seekerLeverage ⊆ counterpartLeverage ⊆ leverageProvenance；
 *      杠杆节点 seeker 真实持有/保证可达；provenance 非空壳
 *   ④ 对家需求 → FORMATION_COUNTERPART_NEED_MISSING
 *      holderNeed ⊆ counterpartNeed 且归属 holder（需求本身可 holder 私有）
 *   ⑤ 需求识别 → FORMATION_NEED_NOT_RECOGNIZABLE
 *      seekerRecognition 必须对 seeker 保证可达（与 ④ 分开验证）
 *   ⑥ 预写成交 → FORMATION_PREWRITTEN_DEAL（结构断言 + 窄成交叙述 lint）
 *   ⑦ 作者指令 → FORMATION_META_PROMPT_DEPENDENCY（窄 deterministic lint，
 *      只抓「去找X谈/你可以交换/现在开始谈判」类设计师指令，不做文风审查）
 *
 * 注意（不做错误要求）：
 *   requiresNodeIds ≠ player knowledge dependency。
 *   只有 INFERENCE 的前提要求 seeker 可达（推断是 seeker 的认知行为）；
 *   TRIGGER/NEED/FACT/OBJECT 的 requires 是世界因果依赖，不要求 seeker 读到全部前提。
 */

import { normalizeProjectStoryState } from "./story-mechanism-contracts.js";
import { assertLeverageEdgesAreOpen } from "./m12-formation-contracts.js";

export const M12_FORMATION_GATE_VERSION = 1;

export const M12_FORMATION_GATE_DECISIONS = Object.freeze([
  "FORMATION_READY",
  "FORMATION_REVIEW_REQUIRED",
]);

export const M12_FORMATION_BASE_BLOCKERS = Object.freeze([
  "STATE_MISSING",
  "FORMATION_ARTIFACT_NOT_FOUND",
  "FORMATION_ARTIFACT_STALE",
  "FORMATION_ARTIFACT_NOT_READY",
]);

export const M12_FORMATION_ISSUE_CODES = Object.freeze([
  ...M12_FORMATION_BASE_BLOCKERS,
  "FORMATION_VALUE_UNSOURCED",
  "FORMATION_EXISTENCE_UNSOURCED",
  "FORMATION_KNOWLEDGE_PATH_MISSING",
  "FORMATION_LOCATOR_PATH_MISSING",
  "FORMATION_LEVERAGE_UNSOURCED",
  "FORMATION_COUNTERPART_NEED_MISSING",
  "FORMATION_NEED_NOT_RECOGNIZABLE",
  "FORMATION_TRIGGER_NOT_PERCEIVABLE",
  "FORMATION_PREWRITTEN_DEAL",
  "FORMATION_SINGLE_POINT_DEPENDENCY",
  "FORMATION_META_PROMPT_DEPENDENCY",
]);

/** 窄 lint：只抓明确的设计师指令（玩家可读通道：reveals + acquisition.how） */
export const M12_META_PROMPT_PATTERNS = Object.freeze([
  Object.freeze({ id: "YOU_MAY_EXCHANGE", re: /你可以交换/ }),
  Object.freeze({ id: "GO_FIND_AND_TALK", re: /去找.{0,8}(?:谈|问)/ }),
  Object.freeze({ id: "TALK_WITH_TARGET", re: /和.{0,8}(?:谈判|交换)/ }),
  Object.freeze({ id: "PLEASE_EXCHANGE_WITH", re: /请与.{0,8}交换/ }),
  Object.freeze({ id: "START_NEGOTIATION_NOW", re: /现在开始谈判/ }),
  Object.freeze({ id: "MUST_GO_ASK", re: /必须去问/ }),
]);

/** 窄 lint：只抓明确的预写成交叙述（换到/已成交/交换完成…） */
export const M12_PREWRITTEN_DEAL_PATTERNS = Object.freeze([
  Object.freeze({ id: "EXCHANGED_GOT", re: /换到/ }),
  Object.freeze({ id: "DEAL_CLOSED", re: /已成交/ }),
  Object.freeze({ id: "EXCHANGE_COMPLETED", re: /交换完成/ }),
  Object.freeze({ id: "NEGOTIATION_SUCCEEDED", re: /谈判成功/ }),
  Object.freeze({ id: "AGREEMENT_REACHED", re: /达成(?:交易|协议|交换)/ }),
]);

const PLAYER_CAPABILITY_CHECKS = Object.freeze([
  Object.freeze({
    capability: "VALUE_SOURCE",
    field: "valueSource",
    code: "FORMATION_VALUE_UNSOURCED",
  }),
  Object.freeze({
    capability: "EXISTENCE_SOURCE",
    field: "existenceSource",
    code: "FORMATION_EXISTENCE_UNSOURCED",
  }),
  Object.freeze({
    capability: "KNOWLEDGE_PATH",
    field: "knowledgePath",
    code: "FORMATION_KNOWLEDGE_PATH_MISSING",
  }),
  Object.freeze({
    capability: "LOCATOR_PATH",
    field: "locatorPath",
    code: "FORMATION_LOCATOR_PATH_MISSING",
  }),
  Object.freeze({
    capability: "WORLD_TRIGGER",
    field: "trigger",
    code: "FORMATION_TRIGGER_NOT_PERCEIVABLE",
  }),
]);

function issue(code, message, nodeIds = []) {
  return { code, nodeIds, message };
}

function blockedResult(artifact, artifactId, code, message) {
  return {
    version: M12_FORMATION_GATE_VERSION,
    artifactId: artifactId || null,
    sourceBlockId: artifact?.sourceBlockId || null,
    sourceBlockRevision: artifact?.sourceBlockRevision ?? null,
    decision: "FORMATION_REVIEW_REQUIRED",
    issues: [issue(code, message)],
    checks: { blocked: code },
  };
}

/** seeker 是否「够得着」该节点：持有 / 可见 / 可获得（不含 CONFIDENCE_BOOST） */
function reachesSeeker(node, seekerId) {
  return (
    node.holderIds.includes(seekerId) ||
    node.visibleToIds.includes(seekerId) ||
    node.acquisition.whoCanAcquireIds.includes(seekerId)
  );
}

/**
 * 杠杆可支配性（F3 Semantic Hardening）：Visible ≠ 可支配。
 * OPENING_OWNED → 必须真持有（holderIds）；
 * 其余（GUARANTEED 等）→ 持有 或 保证可获得（whoCanAcquireIds）——仅可见不算。
 */
function seekerControls(node, seekerId) {
  if (node.acquisition.mode === "OPENING_OWNED") {
    return node.holderIds.includes(seekerId);
  }
  return (
    node.holderIds.includes(seekerId) ||
    node.acquisition.whoCanAcquireIds.includes(seekerId)
  );
}

/**
 * seeker 可用性判定（带记忆化 + 环路保护）。
 * usable = 非 boost ∧ (OPENING_OWNED: 真持有（Visible ≠ Owned）
 *                      | INFERENCE: subject=seeker ∧ 前提递归 usable ∧ seeker 够得着
 *                      | 其他: seeker 够得着)
 */
function createSeekerUsability(nodesById, seekerId) {
  const memo = new Map();
  const visiting = new Set();

  function check(nodeId) {
    if (memo.has(nodeId)) return memo.get(nodeId);
    if (visiting.has(nodeId)) return { usable: false, reason: "REQUIRES_CYCLE" };
    const node = nodesById.get(nodeId);
    if (!node) return { usable: false, reason: "NODE_MISSING" };

    visiting.add(nodeId);
    let result;
    if (node.acquisition.mode === "CONFIDENCE_BOOST") {
      result = { usable: false, reason: "CONFIDENCE_BOOST" };
    } else if (node.acquisition.mode === "OPENING_OWNED") {
      // F3 Semantic Hardening：Visible ≠ Owned——开场持有必须真落在 holderIds
      result = node.holderIds.includes(seekerId)
        ? { usable: true }
        : { usable: false, reason: "OPENING_OWNED_NOT_HELD" };
    } else if (node.kind === "INFERENCE") {
      if (node.subjectCharacterId !== seekerId) {
        result = { usable: false, reason: "INFERENCE_NOT_SEEKER_SUBJECT" };
      } else {
        const brokenPremise = node.requiresNodeIds.find((pid) => !check(pid).usable);
        if (brokenPremise != null) {
          result = { usable: false, reason: "INFERENCE_PREMISE_UNREACHABLE", detail: brokenPremise };
        } else {
          result = reachesSeeker(node, seekerId)
            ? { usable: true }
            : { usable: false, reason: "NOT_SEEKER_REACHABLE" };
        }
      }
    } else {
      result = reachesSeeker(node, seekerId)
        ? { usable: true }
        : { usable: false, reason: "NOT_SEEKER_REACHABLE" };
    }
    visiting.delete(nodeId);
    memo.set(nodeId, result);
    return result;
  }

  return check;
}

function lintNodeTexts(node, patterns, hits) {
  const surfaces = node.reveals.map((text, i) => ({ where: `reveals[${i}]`, text }));
  if (node.acquisition && node.acquisition.how) {
    surfaces.push({ where: "acquisition.how", text: node.acquisition.how });
  }
  for (const { where, text } of surfaces) {
    for (const { id, re } of patterns) {
      if (re.test(text)) hits.push({ nodeId: node.id, where, patternId: id });
    }
  }
}

function provenanceSubstantiated(node) {
  if (!node) return false;
  return node.provenance.sourceRefs.length > 0 || String(node.provenance.summary || "").trim().length > 0;
}

/**
 * M12 Formation Gate。
 *
 * @param {{ state: object, artifactId: string }} input
 *   state 权威来源；artifactId 定位 state.m12FormationArtifacts 中的目标。
 *   调用方传入的其他字段（如 artifact）一律忽略——防止第二套权威入口。
 *
 * @returns {{ version, artifactId, sourceBlockId, sourceBlockRevision,
 *             decision: "FORMATION_READY"|"FORMATION_REVIEW_REQUIRED",
 *             issues: Array<{code,nodeIds,message}>, checks: object }}
 *   只读：不修改 state、不修改 artifact、不回写 status。
 */
export function validateM12Formation(input = {}) {
  const raw = input && typeof input === "object" ? input : {};

  // ── 基础 blocker：state ──────────────────────────────────────────
  if (!raw.state || typeof raw.state !== "object") {
    return blockedResult(null, String(raw.artifactId ?? "").trim(), "STATE_MISSING", "缺少 ProjectStoryState（权威来源）");
  }
  const state = normalizeProjectStoryState(raw.state);

  // ── 基础 blocker：artifact 定位（只信 state）──────────────────────
  const artifactId = String(raw.artifactId ?? "").trim();
  const artifact = artifactId
    ? state.m12FormationArtifacts.find((a) => a && a.id === artifactId) || null
    : null;
  if (!artifact) {
    return blockedResult(
      null,
      artifactId,
      "FORMATION_ARTIFACT_NOT_FOUND",
      `state.m12FormationArtifacts 中找不到 artifact（artifactId=${artifactId || "(空)"}）`,
    );
  }

  // ── 基础 blocker：STALE / NOT_READY（normalize 已按当前 blocks 刷新）──
  if (artifact.status === "STALE") {
    return blockedResult(
      artifact,
      artifactId,
      "FORMATION_ARTIFACT_STALE",
      "Artifact 已 STALE（source block revision 已变化或 block 缺失）——回 F2 Builder 重建后再过 Gate",
    );
  }
  if (artifact.status !== "READY_FOR_VALIDATION") {
    return blockedResult(
      artifact,
      artifactId,
      "FORMATION_ARTIFACT_NOT_READY",
      `Artifact 尚未 READY_FOR_VALIDATION（status=${artifact.status}）`,
    );
  }

  const issues = [];
  const seekerId = artifact.participants.seekerId;
  const holderId = artifact.participants.holderId;
  const nodesById = new Map(artifact.nodes.map((n) => [n.id, n]));
  const usable = createSeekerUsability(nodesById, seekerId);
  const spineIds = [...artifact.proof.guaranteedPathToContactReason];
  const spineSet = new Set(spineIds);

  const checks = {
    blocked: null,
    participants: { seekerId, holderId },
    spine: { claimed: spineIds, verified: [], rejected: [] },
    capabilities: {},
    leverage: {},
    counterpartNeed: {},
    recognition: {},
    lint: { metaPrompt: [], prewrittenDeal: [] },
  };

  // ── ① guaranteed spine 验证 → SINGLE_POINT_DEPENDENCY ───────────
  for (const id of spineIds) {
    const verdict = usable(id);
    if (verdict.usable) checks.spine.verified.push(id);
    else checks.spine.rejected.push({ nodeId: id, reason: verdict.reason });
  }
  if (checks.spine.rejected.length) {
    issues.push(
      issue(
        "FORMATION_SINGLE_POINT_DEPENDENCY",
        "guaranteedPathToContactReason 含不可保证节点（缺失 / CONFIDENCE_BOOST / seeker 不可达 / 推断前提不可达）——主形成链依赖自由玩家配合",
        checks.spine.rejected.map((r) => r.nodeId),
      ),
    );
  }

  // ── ② 玩家侧 capability 支撑（usable ∧ (spine ∨ seeker opening-owned)）──
  for (const { capability, field, code } of PLAYER_CAPABILITY_CHECKS) {
    const fieldIds = artifact.formation[field].nodeIds;
    const via = fieldIds.filter((id) => {
      const node = nodesById.get(id);
      if (!node || !usable(id).usable) return false;
      return (
        spineSet.has(id) ||
        (node.acquisition.mode === "OPENING_OWNED" && node.holderIds.includes(seekerId))
      );
    });
    checks.capabilities[capability] = { supported: via.length > 0, via };
    if (!via.length) {
      issues.push(
        issue(
          code,
          `${field} 没有任何落在 guaranteed spine 或 seeker opening-owned 的节点`,
          fieldIds,
        ),
      );
    }
  }

  // ── ③ 双边杠杆 → LEVERAGE_UNSOURCED ─────────────────────────────
  const bilateral = artifact.proof.bilateralLeverage;
  const seekerLeverageIds = bilateral.seekerLeverageNodeIds;
  const counterpartLeverageIds = artifact.formation.counterpartLeverage.nodeIds;
  const leverageProvenanceIds = artifact.formation.leverageProvenance.nodeIds;
  const leverageProblems = [];

  if (!seekerLeverageIds.length) {
    leverageProblems.push({ nodeIds: [], reason: "缺少 seekerLeverageNodeIds（无杠杆证明）" });
  } else {
    const outsideField = seekerLeverageIds.filter((id) => !counterpartLeverageIds.includes(id));
    if (outsideField.length) {
      leverageProblems.push({ nodeIds: outsideField, reason: "seekerLeverage 未落在 counterpartLeverage 字段" });
    }
    const unproven = counterpartLeverageIds.filter((id) => !leverageProvenanceIds.includes(id));
    if (unproven.length) {
      leverageProblems.push({ nodeIds: unproven, reason: "counterpartLeverage 未由 leverageProvenance 支撑" });
    }
    // F3 Semantic Hardening：Visible ≠ 可支配——必须真持有或保证可得
    const notHeld = seekerLeverageIds.filter((id) => {
      const node = nodesById.get(id);
      return !node || !seekerControls(node, seekerId);
    });
    if (notHeld.length) {
      leverageProblems.push({
        nodeIds: notHeld,
        reason: "杠杆节点不在 seeker 手里且无保证获取路径（可见 ≠ 可支配）",
      });
    }
    const shell = seekerLeverageIds.filter((id) => {
      const node = nodesById.get(id);
      return !provenanceSubstantiated(node);
    });
    if (shell.length) {
      leverageProblems.push({ nodeIds: shell, reason: "杠杆 provenance 空壳（无 sourceRefs 且无 summary）" });
    }
  }

  checks.leverage = {
    seekerLeverageNodeIds: seekerLeverageIds,
    inCounterpartLeverage: seekerLeverageIds.every((id) => counterpartLeverageIds.includes(id)),
    inLeverageProvenance: counterpartLeverageIds.every((id) => leverageProvenanceIds.includes(id)),
    seekerControlled: Object.fromEntries(
      seekerLeverageIds.map((id) => {
        const node = nodesById.get(id);
        return [id, node ? seekerControls(node, seekerId) : false];
      }),
    ),
    provenanceSubstantiated: Object.fromEntries(
      seekerLeverageIds.map((id) => [id, provenanceSubstantiated(nodesById.get(id))]),
    ),
    problems: leverageProblems,
  };
  if (leverageProblems.length) {
    issues.push(
      issue(
        "FORMATION_LEVERAGE_UNSOURCED",
        leverageProblems.map((p) => p.reason).join("；"),
        [...new Set(leverageProblems.flatMap((p) => p.nodeIds))],
      ),
    );
  }

  // ── ④ 对家需求 → COUNTERPART_NEED_MISSING（holder 私有合法，但必须真实且归属 holder）──
  const holderNeedIds = bilateral.holderNeedNodeIds;
  const counterpartNeedIds = artifact.formation.counterpartNeed.nodeIds;
  const needProblems = [];

  if (!holderNeedIds.length) {
    needProblems.push("缺少 holderNeedNodeIds（holder 需求未被证明，seeker 可被直接无视）");
  } else {
    const mismatched = holderNeedIds.filter((id) => !counterpartNeedIds.includes(id));
    if (mismatched.length) {
      needProblems.push(`holderNeed 未落在 counterpartNeed 字段：${mismatched.join(", ")}`);
    }
    // F3 Semantic Hardening：Fact ≠ Need——需求节点必须是 kind=NEED
    const wrongKind = holderNeedIds.filter((id) => {
      const node = nodesById.get(id);
      return !node || node.kind !== "NEED";
    });
    if (wrongKind.length) {
      needProblems.push(`需求节点必须 kind=NEED（Fact ≠ Need）：${wrongKind.join(", ")}`);
    }
    const holderOwned = holderNeedIds.filter((id) => {
      const node = nodesById.get(id);
      return Boolean(node && node.holderIds.includes(holderId));
    });
    if (!holderOwned.length) {
      needProblems.push("需求节点不归属 holder（holderIds 均不含 holder）");
    }
    checks.counterpartNeed = {
      holderNeedNodeIds: holderNeedIds,
      matchesCounterpartNeed: holderNeedIds.every((id) => counterpartNeedIds.includes(id)),
      allKindNeed: holderNeedIds.every((id) => {
        const node = nodesById.get(id);
        return Boolean(node && node.kind === "NEED");
      }),
      holderOwned,
    };
  }
  if (needProblems.length) {
    issues.push(issue("FORMATION_COUNTERPART_NEED_MISSING", needProblems.join("；"), holderNeedIds));
  }

  // ── ⑤ 需求识别 → NEED_NOT_RECOGNIZABLE（识别必须落到 seeker；与 ④ 分开）──
  const recognitionIds = bilateral.seekerRecognitionNodeIds;
  const unreachableRecognition = recognitionIds.filter((id) => !usable(id).usable);
  checks.recognition = {
    seekerRecognitionNodeIds: recognitionIds,
    seekerReachable: Object.fromEntries(recognitionIds.map((id) => [id, usable(id).usable])),
  };
  checks.capabilities.NEED_RECOGNITION = {
    supported: recognitionIds.length > 0 && unreachableRecognition.length === 0,
    via: recognitionIds.filter((id) => usable(id).usable),
  };
  if (!recognitionIds.length || unreachableRecognition.length) {
    issues.push(
      issue(
        "FORMATION_NEED_NOT_RECOGNIZABLE",
        !recognitionIds.length
          ? "缺少 seekerRecognitionNodeIds（seeker 无从识别 holder 需求）"
          : "识别节点对 seeker 不可达（holder 需求可私有，但识别路径必须保证落到 seeker）",
        unreachableRecognition,
      ),
    );
  }

  // ── ⑥ 预写成交 → PREWRITTEN_DEAL（结构断言 + 窄成交叙述 lint）────
  for (const structural of assertLeverageEdgesAreOpen(artifact)) {
    checks.lint.prewrittenDeal.push({ nodeId: structural.nodeId, where: "structure", patternId: structural.code });
  }
  for (const node of artifact.nodes) {
    lintNodeTexts(node, M12_PREWRITTEN_DEAL_PATTERNS, checks.lint.prewrittenDeal);
  }
  if (checks.lint.prewrittenDeal.length) {
    issues.push(
      issue(
        "FORMATION_PREWRITTEN_DEAL",
        "检测到预写成交（事件字段 / 非 OPEN resolution / 成交叙述）——现场交换必须留给玩家",
        [...new Set(checks.lint.prewrittenDeal.map((h) => h.nodeId))],
      ),
    );
  }

  // ── ⑦ 作者指令 → META_PROMPT_DEPENDENCY（窄 deterministic lint）──
  for (const node of artifact.nodes) {
    lintNodeTexts(node, M12_META_PROMPT_PATTERNS, checks.lint.metaPrompt);
  }
  if (checks.lint.metaPrompt.length) {
    issues.push(
      issue(
        "FORMATION_META_PROMPT_DEPENDENCY",
        "检测到作者指令式文本（去找X谈 / 你可以交换 / 现在开始谈判…）——Formation 不得依赖作者喊话",
        [...new Set(checks.lint.metaPrompt.map((h) => h.nodeId))],
      ),
    );
  }

  return {
    version: M12_FORMATION_GATE_VERSION,
    artifactId,
    sourceBlockId: artifact.sourceBlockId,
    sourceBlockRevision: artifact.sourceBlockRevision,
    decision: issues.length ? "FORMATION_REVIEW_REQUIRED" : "FORMATION_READY",
    issues,
    checks,
  };
}
