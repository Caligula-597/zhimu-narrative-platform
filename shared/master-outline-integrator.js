/**
 * Master Outline Integrator Prototype V1
 *
 * 原则：先编排，后写作。禁止把全部积木丢给 LLM 重写大纲。
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
} from "./master-outline-contracts.js";

const ACCEPTED = new Set(["USER_ACCEPTED", "USER_MODIFIED", "LOCKED"]);

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

function flattenSourceBeats(block) {
  const phases = [
    ["setup", 0],
    ["progression", 1],
    ["climax", 2],
    ["resolution", 3],
  ];
  const out = [];
  for (const [phase, band] of phases) {
    for (const beat of block[phase] || []) {
      const characterIds = (beat.involvedRoleKeys || [])
        .map((k) => block.roleBindings?.[k]?.id)
        .filter(Boolean);
      out.push(
        normalizeOutlineBeat({
          id: newId("ob"),
          sourceBlockId: block.id,
          sourceBeatId: beat.id,
          familyId: block.familyId,
          templateId: block.templateId,
          blockTitle: block.title,
          summary: beat.summary || `${block.title} · ${phase}`,
          phaseBand: band,
          stageKey: beat.stageKey,
          characterIds,
          clueIds: beat.clueIds || [],
        }),
      );
    }
  }
  return out;
}

function resolveOutlineStages(projectStages, beatCount) {
  const sorted = [...(projectStages || [])].sort((a, b) => a.order - b.order);
  if (sorted.length >= 2) {
    return sorted.map((s, i) => ({
      id: s.id,
      label: s.label || `第${i + 1}阶段`,
      order: Number.isFinite(s.order) ? s.order : i,
      beats: [],
    }));
  }
  const n = Math.max(3, Math.min(5, Math.ceil(beatCount / 2) || 3));
  return Array.from({ length: n }, (_, i) => ({
    id: `outline-stage-${i + 1}`,
    label: `第${i + 1}阶段`,
    order: i,
    beats: [],
  }));
}

function assignBeatToStageIndex(phaseBand, stageCount) {
  if (stageCount <= 1) return 0;
  const t = Math.max(0, Math.min(3, phaseBand)) / 3;
  return Math.min(stageCount - 1, Math.round(t * (stageCount - 1)));
}

function sharedChars(a, b) {
  const setB = new Set(b.characterIds || []);
  return (a.characterIds || []).filter((id) => setB.has(id));
}

function familyHints(block) {
  const h = block?.integrationHints || {};
  return {
    canPrecede: (h.canPrecede || []).map(String),
    canFollow: (h.canFollow || []).map(String),
    sharesFactsWith: (h.sharesFactsWith || []).map(String),
    weaveIntent: String(h.weaveIntent || ""),
  };
}

function causalPair(blockA, blockB) {
  const a = familyHints(blockA);
  const b = familyHints(blockB);
  const fa = blockA.familyId;
  const fb = blockB.familyId;
  if (a.canPrecede.includes(fb) || b.canFollow.includes(fa)) return "A_THEN_B";
  if (b.canPrecede.includes(fa) || a.canFollow.includes(fb)) return "B_THEN_A";
  // consequence → prerequisite soft match by type/kind strings
  const cons = (blockA.consequences || []).map((c) => String(c?.type || c?.summary || "").toLowerCase());
  const pre = (blockB.prerequisites || []).map((c) => String(c?.type || c?.summary || "").toLowerCase());
  if (cons.length && pre.length && cons.some((x) => pre.some((y) => x && y && (x.includes(y) || y.includes(x))))) {
    return "A_THEN_B";
  }
  return null;
}

function factOverlap(blockA, blockB) {
  const a = new Set(familyHints(blockA).sharesFactsWith);
  const b = familyHints(blockB).sharesFactsWith;
  return b.filter((k) => a.has(k));
}

/**
 * 结构分析：为成对 beat 生成交织候选（允许 KEEP_PARALLEL / WEAVE_WEAK）。
 */
export function proposeWeaveLinks(beats, blocks) {
  const links = [];
  const seenPair = new Set();
  for (let i = 0; i < beats.length; i += 1) {
    for (let j = i + 1; j < beats.length; j += 1) {
      const ba = beats[i];
      const bb = beats[j];
      if (ba.sourceBlockId === bb.sourceBlockId) continue;
      const blockA = blockById(blocks, ba.sourceBlockId);
      const blockB = blockById(blocks, bb.sourceBlockId);
      if (!blockA || !blockB) continue;

      // 每个 block 对只在相近 phaseBand 上连一次主边，避免爆炸
      const pairKey = [ba.sourceBlockId, bb.sourceBlockId, ba.phaseBand, bb.phaseBand].sort().join("|");
      if (Math.abs(ba.phaseBand - bb.phaseBand) > 1) continue;
      if (seenPair.has(pairKey)) continue;

      const shared = sharedChars(ba, bb);
      const facts = factOverlap(blockA, blockB);
      const causal = causalPair(blockA, blockB);
      let kind = "KEEP_PARALLEL";
      let reason = "两条线暂无明显共享接口，保持相对独立。";

      if (shared.length && ba.phaseBand === bb.phaseBand) {
        kind = "WEAVE_SHARED_SCENE";
        reason = `同阶段共享角色 ${shared.join("、")}，适合合并为同一场景推进。`;
      } else if (shared.length) {
        kind = "WEAVE_SHARED_CHARACTER";
        reason = `共享角色 ${shared.join("、")}，可弱交织。`;
      } else if (causal) {
        kind = "WEAVE_CAUSAL";
        reason =
          causal === "A_THEN_B"
            ? `${blockA.title} 的后果可衔接到 ${blockB.title}。`
            : `${blockB.title} 的后果可衔接到 ${blockA.title}。`;
      } else if (facts.length) {
        kind = "WEAVE_STRONG";
        reason = `可共享事实接口：${facts.join("、")}。`;
      } else if (ba.phaseBand === bb.phaseBand) {
        kind = "WEAVE_WEAK";
        reason = "同阶段并行，可择机同场，但非强制。";
      }

      if (kind === "KEEP_PARALLEL" && Math.abs(ba.phaseBand - bb.phaseBand) === 0) {
        // still record weak parallel awareness once per block-pair mid band
      }

      seenPair.add(pairKey);
      if (kind === "KEEP_PARALLEL" && !shared.length && !causal && !facts.length) {
        // only emit KEEP_PARALLEL once per block pair at progression band
        if (ba.phaseBand !== 1 || bb.phaseBand !== 1) continue;
        reason = `${blockA.title} 与 ${blockB.title} 目前相对独立。`;
      }

      links.push(
        normalizeWeaveLink({
          id: newId("wl"),
          kind,
          status: "PROPOSED",
          beatIds: [ba.id, bb.id],
          blockIds: [ba.sourceBlockId, bb.sourceBlockId],
          reason,
          sharedCharacterIds: shared,
          sharedFactKinds: facts,
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
        severity: "warn",
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

  // family-level intentional weave reminder when M01+M08 share culprit/lead
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

/**
 * 核心：积木 → 结构分析 → 冲突 → 阶段编排 → 交织候选 → MasterOutlineDraft
 */
export function buildMasterOutlineDraft(projectStoryState, { now = () => new Date().toISOString() } = {}) {
  const state = createProjectStoryState(projectStoryState);
  const blocks = listAcceptedStoryBlocks(state);
  if (blocks.length < 1) {
    fail("OUTLINE_NO_BLOCKS", "至少需要 1 条已接受的剧情积木才能交织", {
      accepted: 0,
    });
  }

  const allBeats = blocks.flatMap(flattenSourceBeats);
  const stages = resolveOutlineStages(state.stages, allBeats.length);

  for (const beat of allBeats) {
    const idx = assignBeatToStageIndex(beat.phaseBand, stages.length);
    stages[idx].beats.push(beat);
  }

  let weaveLinks = proposeWeaveLinks(allBeats, blocks);

  // 共享场景：把成对 beat 拉到同一阶段（取较早阶段）
  for (const link of weaveLinks) {
    if (link.kind !== "WEAVE_SHARED_SCENE" || link.beatIds.length < 2) continue;
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
    source.beats = source.beats.filter((b) => b.id !== moving.id);
    const groupId = newId("wg");
    beatA.weaveGroupId = groupId;
    beatB.weaveGroupId = groupId;
    if (!target.beats.some((b) => b.id === moving.id)) target.beats.push(moving);
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
  // move B next to A in A's stage
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
      status: "ACCEPTED",
      beatIds: [beatIdA, beatIdB],
      blockIds: [beatA.sourceBlockId, beatB.sourceBlockId],
      reason: "用户手动合并为同一场景。",
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
  const shared = sharedChars(a.beat, b.beat);
  const kind = shared.length
    ? a.stage.id === b.stage.id
      ? "WEAVE_SHARED_SCENE"
      : "WEAVE_SHARED_CHARACTER"
    : "WEAVE_WEAK";
  if (kind === "WEAVE_SHARED_SCENE" || a.stage.id !== b.stage.id) {
    // align into A's stage when shared scene or user asked to weave
    if (a.stage.id !== b.stage.id) {
      b.stage.beats.splice(b.idx, 1);
      a.stage.beats.splice(a.idx + 1, 0, b.beat);
    }
  }
  if (kind === "WEAVE_SHARED_SCENE" || shared.length) {
    const groupId = newId("wg");
    findBeatLocation(next, beatIdA).beat.weaveGroupId = groupId;
    findBeatLocation(next, beatIdB).beat.weaveGroupId = groupId;
  }
  next.weaveLinks.push(
    normalizeWeaveLink({
      id: newId("wl"),
      kind,
      status: "ACCEPTED",
      beatIds: [beatIdA, beatIdB],
      blockIds: [a.beat.sourceBlockId, b.beat.sourceBlockId],
      reason: shared.length
        ? `用户尝试交织：共享 ${shared.join("、")}`
        : "用户尝试交织：弱连接同场提示",
      sharedCharacterIds: shared,
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
