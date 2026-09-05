/**
 * Master Outline Integrator Prototype V1 + P5.2 Semantic Bridge
 *
 * 原则：先编排，后写作。禁止把全部积木丢给 LLM 重写大纲。
 * Weave 默认 KEEP_PARALLEL；仅凭 Goal/Action/Target/Requires/Produces 证据升级。
 * 输入：ProjectStoryState（已接受的 StoryMechanismBlock）
 * 输出：MasterOutlineDraft，写回 state.masterOutlineDraft
 */

import {
  createProjectStoryState,
  characterLoadScore,
  detectNarrativeOverload,
} from "./story-mechanism-contracts.js";
import {
  emptyMasterOutlineDraft,
  normalizeMasterOutlineDraft,
  normalizeOutlineBeat,
  normalizeWeaveLink,
  normalizeConflictItem,
  relationQualityForWeaveKind,
} from "./master-outline-contracts.js";
import { isInternalCompletionSummary, ensureScopedBeatSemantics } from "./story-beat-semantics.js";
import {
  planStageTopology,
  materializeTopologyStages,
  distributeBeatsIntoStages,
} from "./master-outline-stage-topology.js";
import {
  matchProducedToRequired,
  targetRefsMatch,
  locationRefsMatch,
  bridgesSatisfy,
  buildBeatPositionIndex,
  positionIsBefore,
  factIdOf,
} from "./semantic-fact.js";
import { resolveBeatOwnerRefs, applyOwnerResolution } from "./beat-owner-authority.js";

const ACCEPTED = new Set(["USER_ACCEPTED", "USER_MODIFIED", "LOCKED"]);

const STAGE_ARC_LABELS = Object.freeze(["铺垫", "加压", "升级", "收束"]);

const SEARCHISH = new Set(["SEARCH", "SECURE", "INVESTIGATE", "PROBE"]);

export class MasterOutlineIntegratorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "MasterOutlineIntegratorError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new MasterOutlineIntegratorError(code, message, details);
}

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function listAcceptedStoryBlocks(projectStoryState) {
  const state = createProjectStoryState(projectStoryState);
  return state.mechanismBlocks.filter((b) => ACCEPTED.has(b.status));
}

function blockById(blocks, id) {
  return blocks.find((b) => b.id === id) || null;
}

function factKeys(list) {
  return (list || [])
    .map((f) => String(f?.factType || f?.kind || f?.factId || f?.id || "").toLowerCase())
    .filter(Boolean);
}

function factMatch(produces, requires, options = {}) {
  return matchProducedToRequired(produces, requires, options);
}

function goalsConflict(sa, sb) {
  if (!sa?.goal || !sb?.goal) return false;
  if (sa.goal === sb.goal) return false;
  const aOpp = factKeys(sa.opposes);
  const bProd = factKeys(sb.produces);
  const bOpp = factKeys(sb.opposes);
  const aProd = factKeys(sa.produces);
  if (aOpp.some((x) => bProd.includes(x) || factKeys(sb.requires).includes(x))) return true;
  if (bOpp.some((x) => aProd.includes(x) || factKeys(sa.requires).includes(x))) return true;
  // Instance target conflict only — generic labels ignored for strong weave
  if (targetRefsMatch(sa.targetRef, sb.targetRef)) {
    const conflictPair =
      (/销毁|掩盖|阻止|隐瞒/.test(sa.goal) && /寻找|洗清|确认|揭穿|公开/.test(sb.goal)) ||
      (/销毁|掩盖|阻止|隐瞒/.test(sb.goal) && /寻找|洗清|确认|揭穿|公开/.test(sa.goal));
    if (conflictPair) return true;
  }
  return false;
}

/**
 * Shared action requires instance locationRef + (shared character | targetRef | bridge).
 * locationHint-only is insufficient for INTERWOVEN.
 */
function sharedActionEvidence(sa, sb, { sharedCharacterIds = [] } = {}) {
  if (!sa || !sb) return null;
  if (sa.independence === "INDEPENDENT" || sb.independence === "INDEPENDENT") return null;
  const kindA = sa.actionKind || "";
  const kindB = sb.actionKind || "";
  if (!kindA || !kindB) return null;
  const kindOk = kindA === kindB || (SEARCHISH.has(kindA) && SEARCHISH.has(kindB));
  if (!kindOk) return null;
  if (!locationRefsMatch(sa.locationRef, sb.locationRef)) return null;
  const extra =
    sharedCharacterIds.length > 0 ||
    targetRefsMatch(sa.targetRef, sb.targetRef);
  if (!extra) return null;
  return {
    kind: kindA === kindB ? kindA : `${kindA}/${kindB}`,
    location: sa.locationRef?.label || sb.locationRef?.label || sa.locationRef?.locationId,
  };
}

function flattenSourceBeats(block, { roleAssignments = [], characters = [] } = {}) {
  const phases = [
    ["setup", 0],
    ["progression", 1],
    ["climax", 2],
    ["resolution", 3],
  ];
  const blockAssignments = asArray(roleAssignments).filter(
    (r) => r.mechanismBlockId === block.id || r.mechanismId === block.mechanismId,
  );
  const out = [];
  for (const [phase, band] of phases) {
    for (const beat of block[phase] || []) {
      const characterIds = [
        ...(beat.semantics?.actorRefs || []),
        ...(beat.involvedRoleKeys || []).map((k) => block.roleBindings?.[k]?.id).filter(Boolean),
      ].filter((id, i, arr) => arr.indexOf(id) === i);

      let semantics = ensureScopedBeatSemantics(beat.semantics, {
        sourceBlockId: block.id,
        sourceBeatId: beat.id,
        characterIds,
      });
      const owner = resolveBeatOwnerRefs({
        semantics,
        roleBindings: block.roleBindings || {},
        roleAssignments: blockAssignments,
        characters,
      });
      semantics = applyOwnerResolution(semantics, owner);

      let summary = beat.summary || `${block.title} · ${phase}`;
      if (isInternalCompletionSummary(summary) && semantics) {
        const actor = semantics.actorLabel || characterIds[0] || "角色";
        summary =
          semantics.goal && semantics.action
            ? `${actor}为了${semantics.goal}，${semantics.action}`
            : `NEEDS_DETAIL：${block.title}收束缺具体行动`;
      }

      out.push(
        normalizeOutlineBeat({
          id: newId("ob"),
          sourceBlockId: block.id,
          sourceBeatId: beat.id,
          familyId: block.familyId,
          templateId: block.templateId,
          blockTitle: block.title,
          summary,
          phaseBand: band,
          stageKey: beat.stageKey,
          characterIds,
          clueIds: beat.clueIds || [],
          semantics,
          needsDetail: Boolean(semantics?.needsDetail),
        }),
      );
    }
  }
  return out;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/** 仅 unlocked / 自动推导幕数时压缩空幕；locked project stages 禁止 collapse */
export function compressEmptyStages(stages, { allowCollapse = true } = {}) {
  if (!allowCollapse) return stages || [];
  const kept = (stages || []).filter((s) => (s.beats || []).length > 0);
  if (!kept.length) return stages || [];
  return kept.map((s, i) => ({
    ...s,
    id: s.id || `outline-stage-${i + 1}`,
    order: i,
    label: STAGE_ARC_LABELS[Math.min(i, STAGE_ARC_LABELS.length - 1)] || `第${i + 1}阶段`,
  }));
}

function sharedChars(a, b) {
  const setB = new Set(b.characterIds || []);
  return (a.characterIds || []).filter((id) => setB.has(id));
}

/**
 * 语义驱动交织：默认 KEEP_PARALLEL；禁止仅凭共享角色 / generic target / locationHint 升到 INTERWOVEN。
 * P8.0.2: fact instance scope + causal producer-before-consumer.
 */
export function proposeWeaveLinks(beats, blocks, { stages = null, factBridges = [] } = {}) {
  const links = [];
  const seen = new Set();
  const blockPairEmitted = new Set();
  const positions = stages ? buildBeatPositionIndex(stages) : null;

  for (let i = 0; i < beats.length; i += 1) {
    for (let j = i + 1; j < beats.length; j += 1) {
      const ba = beats[i];
      const bb = beats[j];
      if (ba.sourceBlockId === bb.sourceBlockId) continue;
      const blockA = blockById(blocks, ba.sourceBlockId);
      const blockB = blockById(blocks, bb.sourceBlockId);
      if (!blockA || !blockB) continue;
      if (Math.abs(ba.phaseBand - bb.phaseBand) > 1) continue;

      const pairKey = [ba.sourceBlockId, bb.sourceBlockId, ba.phaseBand, bb.phaseBand].sort().join("|");
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const sa = ba.semantics;
      const sb = bb.semantics;
      const shared = sharedChars(ba, bb);
      const causalAB = factMatch(sa?.produces, sb?.requires);
      const causalBA = factMatch(sb?.produces, sa?.requires);
      const bridgeAB = (sa?.produces || []).some((p) =>
        (sb?.requires || []).some(
          (r) => bridgesSatisfy(factBridges, factIdOf(p), factIdOf(r)),
        ),
      );
      const bridgeBA = (sb?.produces || []).some((p) =>
        (sa?.requires || []).some(
          (r) => bridgesSatisfy(factBridges, factIdOf(p), factIdOf(r)),
        ),
      );
      const sharedAction = sharedActionEvidence(sa, sb, { sharedCharacterIds: shared });
      const sharedTargetInstance = targetRefsMatch(sa?.targetRef, sb?.targetRef);
      const conflict = goalsConflict(sa, sb);

      let kind = "KEEP_PARALLEL";
      let reason = `${blockA.title} 与 ${blockB.title} 暂无 Goal/Action 证据，保持平行。`;
      let sharedTargets = [];
      let sharedFactKinds = [];

      const causalForwardOk = (producerBeat, consumerBeat) => {
        if (!positions) return true; // no stage map yet — allow; topology re-checked when stages passed
        const p = positions.get(producerBeat.id);
        const c = positions.get(consumerBeat.id);
        return positionIsBefore(p, c);
      };

      if ((causalAB.length || bridgeAB) && causalForwardOk(ba, bb)) {
        kind = "WEAVE_CAUSAL";
        sharedFactKinds = causalAB.length ? causalAB : ["explicit_bridge"];
        reason = bridgeAB && !causalAB.length
          ? `${blockA.title} 经显式 FactBridge 满足 ${blockB.title} 的前置条件`
          : `${blockA.title} 的结果（${sharedFactKinds.join("、")}）满足 ${blockB.title} 的前置条件`;
      } else if ((causalBA.length || bridgeBA) && causalForwardOk(bb, ba)) {
        kind = "WEAVE_CAUSAL";
        sharedFactKinds = causalBA.length ? causalBA : ["explicit_bridge"];
        reason = bridgeBA && !causalBA.length
          ? `${blockB.title} 经显式 FactBridge 满足 ${blockA.title} 的前置条件`
          : `${blockB.title} 的结果（${sharedFactKinds.join("、")}）满足 ${blockA.title} 的前置条件`;
      } else if (sharedTargetInstance && conflict) {
        kind = "WEAVE_STRONG";
        sharedTargets = [sa.targetRef?.label || sa.target, sb.targetRef?.label || sb.target].filter(Boolean);
        reason = `两条剧情争夺同一目标实例「${sa.targetRef?.targetId}」，目标相冲：${sa.goal || "?"} vs ${sb.goal || "?"}`;
      } else if (sharedAction) {
        kind = "WEAVE_SHARED_ACTION";
        reason = `两条剧情在同一场所实例「${sharedAction.location}」执行相近行动（${sharedAction.kind}），且另有角色/目标实例重合`;
      } else if (sharedTargetInstance && sa?.goal && sb?.goal) {
        kind = "WEAVE_STRONG";
        sharedTargets = [sa.targetRef?.label || sa.targetRef?.targetId];
        reason = `共享目标实例「${sa.targetRef?.targetId}」，且目标方向可对齐或对撞`;
      } else if (shared.length && ba.phaseBand === bb.phaseBand) {
        kind = "WEAVE_SHARED_SCENE";
        reason = `同阶段共享角色 ${shared.join("、")}——可同场并列，不算真正交织`;
      } else if (shared.length) {
        kind = "WEAVE_SHARED_CHARACTER";
        reason = `共享角色 ${shared.join("、")}——仅角色重合，保持同场并列而非强制合并`;
      } else {
        const bp = [ba.sourceBlockId, bb.sourceBlockId].sort().join("|");
        if (blockPairEmitted.has(bp)) continue;
        if (!(ba.phaseBand === 1 && bb.phaseBand === 1)) continue;
        blockPairEmitted.add(bp);
        kind = "KEEP_PARALLEL";
        reason = `${blockA.title} 与 ${blockB.title} 缺少共享行动/因果/目标冲突，保持平行`;
      }

      if (kind !== "KEEP_PARALLEL") {
        const bp = [ba.sourceBlockId, bb.sourceBlockId].sort().join("|");
        blockPairEmitted.add(bp);
      }

      links.push(
        normalizeWeaveLink({
          id: newId("wl"),
          kind,
          relationQuality: relationQualityForWeaveKind(kind),
          status: "PROPOSED",
          beatIds: [ba.id, bb.id],
          blockIds: [ba.sourceBlockId, bb.sourceBlockId],
          reason,
          sharedCharacterIds: shared,
          sharedFactKinds,
          sharedTargets,
        }),
      );
    }
  }

  // 诚实平行：若一对积木没有任何真正交织证据，至少记一条 KEEP_PARALLEL
  const interwovenKinds = new Set(["WEAVE_CAUSAL", "WEAVE_STRONG", "WEAVE_SHARED_ACTION"]);
  const hasInterwoven = new Set(
    links.filter((l) => interwovenKinds.has(l.kind)).map((l) => [...l.blockIds].sort().join("|")),
  );
  const hasParallel = new Set(
    links.filter((l) => l.kind === "KEEP_PARALLEL").map((l) => [...l.blockIds].sort().join("|")),
  );
  const blockIds = [...new Set(beats.map((b) => b.sourceBlockId))];
  for (let i = 0; i < blockIds.length; i += 1) {
    for (let j = i + 1; j < blockIds.length; j += 1) {
      const key = [blockIds[i], blockIds[j]].sort().join("|");
      if (hasInterwoven.has(key) || hasParallel.has(key)) continue;
      const ba = beats.find((b) => b.sourceBlockId === blockIds[i] && b.phaseBand === 1) ||
        beats.find((b) => b.sourceBlockId === blockIds[i]);
      const bb = beats.find((b) => b.sourceBlockId === blockIds[j] && b.phaseBand === 1) ||
        beats.find((b) => b.sourceBlockId === blockIds[j]);
      if (!ba || !bb) continue;
      const blockA = blockById(blocks, ba.sourceBlockId);
      const blockB = blockById(blocks, bb.sourceBlockId);
      links.push(
        normalizeWeaveLink({
          id: newId("wl"),
          kind: "KEEP_PARALLEL",
          relationQuality: "PARALLEL",
          status: "PROPOSED",
          beatIds: [ba.id, bb.id],
          blockIds: [ba.sourceBlockId, bb.sourceBlockId],
          reason: `${blockA?.title || "积木A"} 与 ${blockB?.title || "积木B"} 无线索级交织证据，叙事线保持平行（同场/同角不算交织）`,
          sharedCharacterIds: sharedChars(ba, bb),
        }),
      );
    }
  }

  return links;
}

function buildCharacterLoadReport(state, blocks) {
  const acceptedIds = new Set(blocks.map((b) => b.id));
  const byChar = new Map();
  for (const row of state.roleAssignments || []) {
    if (!acceptedIds.has(row.mechanismBlockId)) continue;
    if (!byChar.has(row.characterId)) {
      const ch = state.characters.find((c) => c.id === row.characterId);
      byChar.set(row.characterId, {
        characterId: row.characterId,
        name: ch?.name || row.characterId,
        totalLoad: 0,
        roles: [],
      });
    }
    const entry = byChar.get(row.characterId);
    entry.roles.push({
      blockId: row.mechanismBlockId,
      slotId: row.slotId,
      narrativeRole: row.narrativeRole,
      intensity: row.intensity,
      intentionalOverlap: row.intentionalOverlap,
    });
  }
  for (const entry of byChar.values()) {
    entry.totalLoad = characterLoadScore(
      { roleAssignments: entry.roles.map((r) => ({ ...r, characterId: entry.characterId })) },
      entry.characterId,
    );
  }
  return [...byChar.values()].sort((a, b) => b.totalLoad - a.totalLoad);
}

function buildConflictReport(state, loadReport) {
  const conflicts = [];
  const overload = detectNarrativeOverload(state, { threshold: 3 });
  for (const item of overload) {
    const row = loadReport.find((r) => r.characterId === item.characterId);
    const roles = (row?.roles || [])
      .map((r) => `${r.narrativeRole || r.slotId}${r.intensity >= 2 ? " HIGH" : ""}`)
      .join("、");
    conflicts.push(
      normalizeConflictItem({
        id: newId("cf"),
        type: "ROLE_OVERLOAD",
        severity: item.score >= 6 ? "high" : item.score >= 4 ? "warn" : "info",
        characterId: item.characterId,
        summary: `${row?.name || item.characterId} 当前承担：${roles || "多重职责"}（负载 ${item.score ?? row?.totalLoad}）`,
        suggestions: [
          { id: "keep", label: "保留" },
          { id: "reassign", label: "建议把次要职责换给其他角色" },
          { id: "intentional", label: "标记为有意重叠" },
        ],
        decision: null,
      }),
    );
  }

  const m01 = (state.mechanismBlocks || []).find((b) => b.templateId === "M01-FRAMING" && ACCEPTED.has(b.status));
  const m08 = (state.mechanismBlocks || []).find((b) => b.familyId === "M08" && ACCEPTED.has(b.status));
  if (m01 && m08) {
    const killer = m01.roleBindings?.culprit?.id;
    const lead = m08.roleBindings?.factionLead?.id;
    if (killer && lead && killer === lead) {
      conflicts.push(
        normalizeConflictItem({
          id: newId("cf"),
          type: "INTENTIONAL_OVERLAP_CANDIDATE",
          severity: "info",
          characterId: killer,
          summary: `${m01.roleBindings.culprit.name} 同时是真凶与阵营领袖——可保留为强交织，或拆开降负载。`,
          suggestions: [
            { id: "keep", label: "保留（强交织）" },
            { id: "reassign", label: "将阵营领袖换给其他人" },
            { id: "intentional", label: "标记为有意重叠" },
          ],
          decision: null,
        }),
      );
    }
  }
  return conflicts;
}

function alignInterwovenBeats(stages, weaveLinks, { protectEmptyStages = false } = {}) {
  const interwoven = new Set(["WEAVE_CAUSAL", "WEAVE_STRONG", "WEAVE_SHARED_ACTION"]);
  for (const link of weaveLinks) {
    if (!interwoven.has(link.kind) || link.beatIds.length < 2) continue;
    const [idA, idB] = link.beatIds;
    let stageA = null;
    let stageB = null;
    let beatA = null;
    let beatB = null;
    for (const st of stages) {
      const a = st.beats.find((b) => b.id === idA);
      const b = st.beats.find((b) => b.id === idB);
      if (a) {
        stageA = st;
        beatA = a;
      }
      if (b) {
        stageB = st;
        beatB = b;
      }
    }
    if (!stageA || !stageB || !beatA || !beatB || stageA.id === stageB.id) continue;
    const target = stageA.order <= stageB.order ? stageA : stageB;
    const source = target === stageA ? stageB : stageA;
    const moving = target === stageA ? beatB : beatA;
    if (protectEmptyStages && source.beats.length <= 1) continue;
    source.beats = source.beats.filter((b) => b.id !== moving.id);
    const groupId = newId("wg");
    beatA.weaveGroupId = groupId;
    beatB.weaveGroupId = groupId;
    if (!target.beats.some((b) => b.id === moving.id)) target.beats.push(moving);
  }
}

/**
 * 核心：积木 → 语义分析 → 冲突 → 阶段编排 → 交织候选 → MasterOutlineDraft
 */
export function buildMasterOutlineDraft(projectStoryState, { now = () => new Date().toISOString() } = {}) {
  const state = createProjectStoryState(projectStoryState);
  const blocks = listAcceptedStoryBlocks(state);
  if (blocks.length < 1) {
    fail("OUTLINE_NO_BLOCKS", "至少需要 1 条已接受的剧情积木才能交织", {
      accepted: 0,
    });
  }

  const allBeats = blocks.flatMap((block) =>
    flattenSourceBeats(block, {
      roleAssignments: state.roleAssignments,
      characters: state.characters,
    }),
  );
  const topology = planStageTopology({ projectStages: state.stages, beats: allBeats });
  let stages = materializeTopologyStages(topology);
  distributeBeatsIntoStages(stages, allBeats);

  const weaveLinks = proposeWeaveLinks(allBeats, blocks, { stages });
  alignInterwovenBeats(stages, weaveLinks, { protectEmptyStages: topology.stageCountLocked });

  if (!topology.stageCountLocked) {
    stages = compressEmptyStages(stages, { allowCollapse: true });
    if (stages.length >= 2) {
      const last = stages[stages.length - 1];
      const hasAgency = last.beats.some((b) => b.semantics?.goal && b.semantics?.action && !b.needsDetail);
      if (!hasAgency && last.beats.length > 0 && stages[stages.length - 2].beats.length > 0) {
        stages[stages.length - 2].beats.push(...last.beats);
        stages = compressEmptyStages(stages.slice(0, -1), { allowCollapse: true });
      }
    }
  }

  const characterLoadReport = buildCharacterLoadReport(state, blocks);
  const conflictReport = buildConflictReport(state, characterLoadReport);

  return emptyMasterOutlineDraft({
    id: newId("mod"),
    sourceStoryStateRevision: state.revision || 0,
    sourceBlockIds: blocks.map((b) => b.id),
    createdAt: now(),
    updatedAt: now(),
    status: "DRAFT",
    stages,
    weaveLinks,
    conflictReport,
    characterLoadReport,
  });
}

/** 生成 draft 并写回 ProjectStoryState.masterOutlineDraft */
export function integrateMasterOutline(projectStoryState, options = {}) {
  const state = createProjectStoryState(projectStoryState);
  const draft = buildMasterOutlineDraft(state, options);
  return createProjectStoryState({
    ...state,
    masterOutlineDraft: draft,
  });
}

function requireDraft(draft) {
  const next = normalizeMasterOutlineDraft(draft);
  if (!next) fail("OUTLINE_DRAFT_MISSING", "尚无母稿骨架");
  return next;
}

function findBeatLocation(draft, beatId) {
  for (const stage of draft.stages) {
    const idx = stage.beats.findIndex((b) => b.id === beatId);
    if (idx >= 0) return { stage, idx, beat: stage.beats[idx] };
  }
  return null;
}

export function moveOutlineBeat(draft, beatId, toStageId, toIndex = null) {
  const next = requireDraft(draft);
  const loc = findBeatLocation(next, beatId);
  if (!loc) fail("OUTLINE_BEAT_MISSING", `Unknown beat ${beatId}`, { beatId });
  const target = next.stages.find((s) => s.id === toStageId);
  if (!target) fail("OUTLINE_STAGE_MISSING", `Unknown stage ${toStageId}`, { toStageId });
  loc.stage.beats.splice(loc.idx, 1);
  const insertAt =
    toIndex == null || toIndex < 0 || toIndex > target.beats.length ? target.beats.length : toIndex;
  target.beats.splice(insertAt, 0, loc.beat);
  next.status = "USER_ADJUSTED";
  next.updatedAt = new Date().toISOString();
  return next;
}

export function mergeOutlineBeats(draft, beatIdA, beatIdB) {
  const next = requireDraft(draft);
  const a = findBeatLocation(next, beatIdA);
  const b = findBeatLocation(next, beatIdB);
  if (!a || !b) fail("OUTLINE_BEAT_MISSING", "合并需要两个有效 beat");
  if (a.beat.sourceBlockId === b.beat.sourceBlockId) {
    fail("OUTLINE_MERGE_SAME_BLOCK", "同一积木内的 beat 无需合并场景");
  }
  if (a.stage.id !== b.stage.id) {
    b.stage.beats.splice(b.idx, 1);
    a.stage.beats.splice(a.idx + 1, 0, b.beat);
  } else if (Math.abs(a.idx - b.idx) > 1) {
    const [moved] = b.stage.beats.splice(b.idx, 1);
    const newA = a.stage.beats.findIndex((x) => x.id === beatIdA);
    a.stage.beats.splice(newA + 1, 0, moved);
  }
  const groupId = newId("wg");
  const beatA = findBeatLocation(next, beatIdA).beat;
  const beatB = findBeatLocation(next, beatIdB).beat;
  beatA.weaveGroupId = groupId;
  beatB.weaveGroupId = groupId;
  next.weaveLinks.push(
    normalizeWeaveLink({
      id: newId("wl"),
      kind: "WEAVE_SHARED_SCENE",
      relationQuality: "COLOCATED",
      status: "ACCEPTED",
      beatIds: [beatIdA, beatIdB],
      blockIds: [beatA.sourceBlockId, beatB.sourceBlockId],
      reason: "用户手动合并为同一场景（同场并列，需自行判断是否真正交织）。",
      sharedCharacterIds: sharedChars(beatA, beatB),
    }),
  );
  next.status = "USER_ADJUSTED";
  next.updatedAt = new Date().toISOString();
  return next;
}

export function setConflictDecision(draft, conflictId, decision) {
  const next = requireDraft(draft);
  const item = next.conflictReport.find((c) => c.id === conflictId);
  if (!item) fail("OUTLINE_CONFLICT_MISSING", `Unknown conflict ${conflictId}`);
  if (!["ACCEPT", "ADJUST", "IGNORE"].includes(decision)) {
    fail("OUTLINE_BAD_DECISION", `Invalid decision ${decision}`);
  }
  item.decision = decision;
  next.status = "USER_ADJUSTED";
  next.updatedAt = new Date().toISOString();
  return next;
}

export function splitWeaveLink(draft, linkId) {
  const next = requireDraft(draft);
  const link = next.weaveLinks.find((l) => l.id === linkId);
  if (!link) fail("OUTLINE_WEAVE_MISSING", `Unknown weave ${linkId}`);
  link.status = "SPLIT";
  link.kind = "KEEP_PARALLEL";
  link.relationQuality = "PARALLEL";
  link.reason = `${link.reason}（用户已拆开）`;
  for (const beatId of link.beatIds) {
    const loc = findBeatLocation(next, beatId);
    if (loc) loc.beat.weaveGroupId = null;
  }
  next.status = "USER_ADJUSTED";
  next.updatedAt = new Date().toISOString();
  return next;
}

export function proposeWeaveBetweenBeats(draft, beatIdA, beatIdB) {
  const next = requireDraft(draft);
  const a = findBeatLocation(next, beatIdA);
  const b = findBeatLocation(next, beatIdB);
  if (!a || !b) fail("OUTLINE_BEAT_MISSING", "交织需要两个有效 beat");
  if (a.beat.sourceBlockId === b.beat.sourceBlockId) {
    fail("OUTLINE_WEAVE_SAME_BLOCK", "请选择来自不同积木的节点");
  }
  const proposed = proposeWeaveLinks([a.beat, b.beat], [
    { id: a.beat.sourceBlockId, title: a.beat.blockTitle, familyId: a.beat.familyId },
    { id: b.beat.sourceBlockId, title: b.beat.blockTitle, familyId: b.beat.familyId },
  ]);
  const auto = proposed[0];
  const kind = auto?.kind || "KEEP_PARALLEL";
  const shared = sharedChars(a.beat, b.beat);

  if (["WEAVE_CAUSAL", "WEAVE_STRONG", "WEAVE_SHARED_ACTION"].includes(kind) && a.stage.id !== b.stage.id) {
    b.stage.beats.splice(b.idx, 1);
    a.stage.beats.splice(a.idx + 1, 0, b.beat);
  }
  if (["WEAVE_CAUSAL", "WEAVE_STRONG", "WEAVE_SHARED_ACTION"].includes(kind)) {
    const groupId = newId("wg");
    findBeatLocation(next, beatIdA).beat.weaveGroupId = groupId;
    findBeatLocation(next, beatIdB).beat.weaveGroupId = groupId;
  }

  next.weaveLinks.push(
    normalizeWeaveLink({
      id: newId("wl"),
      kind,
      relationQuality: relationQualityForWeaveKind(kind),
      status: "ACCEPTED",
      beatIds: [beatIdA, beatIdB],
      blockIds: [a.beat.sourceBlockId, b.beat.sourceBlockId],
      reason: auto?.reason || (shared.length ? `用户尝试交织：共享 ${shared.join("、")}` : "用户尝试交织"),
      sharedCharacterIds: shared,
      sharedFactKinds: auto?.sharedFactKinds || [],
      sharedTargets: auto?.sharedTargets || [],
    }),
  );
  next.status = "USER_ADJUSTED";
  next.updatedAt = new Date().toISOString();
  return next;
}

/** 把调整后的 draft 写回 state */
export function writeMasterOutlineDraft(projectStoryState, draft) {
  const state = createProjectStoryState(projectStoryState);
  return createProjectStoryState({
    ...state,
    masterOutlineDraft: requireDraft(draft),
  });
}
