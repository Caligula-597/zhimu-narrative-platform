/**
 * P6.0 Master Draft Expander V1 — Deterministic First
 *
 * 忠实展开 MasterOutlineDraft → ProductionMasterDraft。
 * 禁止 LLM、禁止静默改结构、禁止伪造因果/交织。
 */

import { createProjectStoryState } from "./story-mechanism-contracts.js";
import { normalizeMasterOutlineDraft } from "./master-outline-contracts.js";
import { listAcceptedStoryBlocks } from "./master-outline-integrator.js";
import {
  emptyProductionMasterDraft,
  normalizeProductionMasterDraft,
  normalizeStructureChangeRequest,
  outlineStructureRevision,
  refreshProductionDraftStaleStatus,
} from "./production-master-draft-contracts.js";

export class ProductionMasterDraftError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ProductionMasterDraftError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new ProductionMasterDraftError(code, message, details);
}

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 确定性 id：同样输入 → 同样 id（fidelity / repeat） */
function stableId(prefix, ...parts) {
  const raw = parts.map((p) => String(p ?? "").replace(/[^a-zA-Z0-9_-]/g, "")).join("-");
  return `${prefix}-${raw || "x"}`.slice(0, 120);
}

function blockById(blocks, id) {
  return blocks.find((b) => b.id === id) || null;
}

function charName(state, id) {
  const ch = (state.characters || []).find((c) => c.id === id);
  return ch?.name || id || "某人";
}

function actorList(beat, state) {
  const fromSem = beat.semantics?.actorRefs || [];
  const ids = [...new Set([...(fromSem || []), ...(beat.characterIds || [])])].filter(Boolean);
  if (beat.semantics?.actorLabel && ids.length === 1) {
    return [{ id: ids[0], name: beat.semantics.actorLabel }];
  }
  if (beat.semantics?.actorLabel && !ids.length) {
    return [{ id: "unknown", name: beat.semantics.actorLabel }];
  }
  return ids.map((id) => ({ id, name: charName(state, id) }));
}

/** 确定性中文展开：忠实、可读、不新增事实 */
export function expandBeatProse({ actors, goal, action, target, fallbackSummary, needsDetail }) {
  const actor = actors?.[0]?.name || "某人";
  if (goal && action) {
    const targetBit = target ? `（目标：${target}）` : "";
    return `${actor}为了${goal}，${action}${targetBit}`;
  }
  if (needsDetail) {
    return `NEEDS_DETAIL：${fallbackSummary || "缺角色目标或行动，无法展开具体剧情"}`;
  }
  return fallbackSummary || `${actor}推进相关剧情。`;
}

function consequenceFromSemantics(sem) {
  const produces = sem?.produces || [];
  if (!produces.length) return "UNKNOWN";
  return produces.map((p) => p.summary || p.id || p.kind).filter(Boolean).join("；") || "UNKNOWN";
}

function playerKnowledgeLine(sem, relationQuality) {
  if (!sem?.action) return "NEEDS_DETAIL：玩家可见行动未给出";
  if (relationQuality === "PARALLEL") {
    return `玩家可见：${sem.action}（本线与其他线保持平行，不暗示因果）`;
  }
  if (relationQuality === "COLOCATED") {
    return `玩家可见：${sem.action}（仅同场，不暗示因果）`;
  }
  return `玩家可见：${sem.action}`;
}

function hostTruthLine(sem, prose) {
  if (!sem?.goal && !sem?.action) return "NEEDS_DETAIL：主持真相缺目标/行动";
  return `主持真相：${prose}`;
}

function linksForBeat(outline, beatId) {
  return (outline.weaveLinks || []).filter(
    (l) => l.status !== "SPLIT" && (l.beatIds || []).includes(beatId),
  );
}

function primaryRelation(links) {
  const order = ["INTERWOVEN", "COLOCATED", "PARALLEL"];
  let best = null;
  for (const l of links) {
    const q = l.relationQuality || (l.kind === "KEEP_PARALLEL" ? "PARALLEL" : "COLOCATED");
    if (!best || order.indexOf(q) < order.indexOf(best.q)) best = { q, link: l };
  }
  return best;
}

/** COLOCATED / PARALLEL 不得写成假因果 */
export function relationNotesForBeat(links) {
  const notes = [];
  for (const l of links) {
    const q = l.relationQuality || "PARALLEL";
    if (q === "INTERWOVEN") {
      notes.push(`【真正交织】${l.reason || l.kind}`);
    } else if (q === "COLOCATED") {
      notes.push(`【同场并列】${l.reason || l.kind}`);
    } else {
      notes.push(`【保持平行】${l.reason || l.kind}`);
    }
  }
  return notes;
}

function expandOneBeat(outlineBeat, outline, state, blocks, stageId) {
  const block = blockById(blocks, outlineBeat.sourceBlockId);
  const sem = outlineBeat.semantics || null;
  const actors = actorList(outlineBeat, state);
  const links = linksForBeat(outline, outlineBeat.id);
  const primary = primaryRelation(links);
  const relationQuality = primary?.q;
  const needsDetail = Boolean(
    outlineBeat.needsDetail || sem?.needsDetail || !sem?.goal || !sem?.action,
  );
  const eventSummary = expandBeatProse({
    actors,
    goal: sem?.goal,
    action: sem?.action,
    target: sem?.target,
    fallbackSummary: outlineBeat.summary,
    needsDetail,
  });
  const setupContext =
    sem?.locationHint || (block ? `来自积木「${block.title}」` : "来源积木未知");
  const immediateConsequence = consequenceFromSemantics(sem);
  const clueRefs = [...(outlineBeat.clueIds || [])];
  if (!clueRefs.length && (sem?.requires?.length || sem?.produces?.length)) {
    // 不伪造线索 id；仅在缺失时由 warning / clueView 标注
  }

  return {
    id: stableId("pbeat", outlineBeat.id),
    sourceBeatId: outlineBeat.sourceBeatId,
    sourceOutlineBeatId: outlineBeat.id,
    sourceBlockId: outlineBeat.sourceBlockId,
    sourceMechanismId: outlineBeat.sourceBlockId,
    templateId: outlineBeat.templateId || block?.templateId,
    familyId: outlineBeat.familyId || block?.familyId,
    actors,
    goal: sem?.goal,
    action: sem?.action,
    target: sem?.target,
    setupContext,
    eventSummary,
    immediateConsequence,
    requires: sem?.requires || [],
    produces: sem?.produces || [],
    playerKnowledge: playerKnowledgeLine(sem, relationQuality),
    hostTruth: hostTruthLine(sem, eventSummary),
    clueRefs,
    relatedCharacterIds: (actors.map((a) => a.id).filter(Boolean).length
      ? actors.map((a) => a.id)
      : outlineBeat.characterIds || []
    ).filter((id) => id && id !== "unknown"),
    relationQuality,
    weaveLinkIds: links.map((l) => l.id),
    relationNotes: relationNotesForBeat(links),
    needsDetail,
    detailReason: needsDetail
      ? "缺完整 actor/goal/action，或源 beat 已标 NEEDS_DETAIL"
      : undefined,
    contentConfirmed: false,
    _stageId: stageId,
  };
}

function stageRoleOf(label, index, total) {
  if (/铺垫|setup/i.test(label)) return "SETUP";
  if (/加压|pressure/i.test(label)) return "PRESSURE";
  if (/升级|escalation/i.test(label)) return "ESCALATION";
  if (/收束|payoff|resolution/i.test(label)) return "PAYOFF";
  if (total <= 1) return "SETUP";
  if (index === 0) return "SETUP";
  if (index === total - 1) return "PAYOFF";
  if (index === 1) return "PRESSURE";
  return "ESCALATION";
}

function buildWarnings(outline, stages, state) {
  const warnings = [];
  const CROWD = 6;
  for (const st of stages) {
    if (st.beats.length >= CROWD) {
      warnings.push({
        id: stableId("warn", "crowd", st.stageId),
        type: "STAGE_CROWDING",
        severity: "warn",
        message: `「${st.title}」包含 ${st.beats.length} 个剧情 beat，当前阶段密度偏高。P6 未自动迁移 beat，请返回交织骨架调整。`,
        stageIds: [st.stageId],
        beatIds: st.beats.map((b) => b.sourceOutlineBeatId),
      });
    }
  }

  const activeWeaves = (outline.weaveLinks || []).filter((l) => l.status !== "SPLIT");
  const interwoven = activeWeaves.filter((l) => l.relationQuality === "INTERWOVEN").length;
  const parallel = activeWeaves.filter(
    (l) => l.relationQuality === "PARALLEL" || l.kind === "KEEP_PARALLEL",
  ).length;
  const totalBeats = stages.reduce((n, s) => n + s.beats.length, 0);
  if (totalBeats >= 6 && interwoven <= 1) {
    warnings.push({
      id: stableId("warn", "low-weave"),
      type: "LOW_WEAVE_DENSITY",
      severity: "info",
      message:
        "整本存在较少真正交织关系；当前母稿主要由平行剧情 + 同场并列构成。P6 未伪造额外因果。",
      stageIds: stages.map((s) => s.stageId),
      beatIds: [],
    });
  }
  if (parallel >= 1 && interwoven === 0) {
    warnings.push({
      id: stableId("warn", "parallel-heavy"),
      type: "PARALLEL_HEAVY",
      severity: "info",
      message: "当前结构以平行线为主；这是诚实输出，不是失败。若需交织请在交织骨架提出调整。",
      stageIds: [],
      beatIds: [],
    });
  }

  for (const st of stages) {
    for (const b of st.beats) {
      if (b.needsDetail) {
        warnings.push({
          id: stableId("warn", "detail", b.sourceOutlineBeatId),
          type: "NEEDS_DETAIL",
          severity: "info",
          message: `「${b.eventSummary}」仍缺具体细节。`,
          stageIds: [st.stageId],
          beatIds: [b.sourceOutlineBeatId],
        });
      }
      if ((!b.clueRefs || !b.clueRefs.length) && (b.requires?.length || b.produces?.length)) {
        warnings.push({
          id: stableId("warn", "clue", b.sourceOutlineBeatId),
          type: "MISSING_CLUE_DETAIL",
          severity: "info",
          message: `该剧情 beat 需要/产生事实接口，但模板尚未绑定具体线索内容。`,
          stageIds: [st.stageId],
          beatIds: [b.sourceOutlineBeatId],
        });
      }
    }
  }

  for (const c of outline.conflictReport || []) {
    if (c.decision) continue;
    warnings.push({
      id: stableId("warn", "conflict", c.id || c.type),
      type: c.type === "ROLE_OVERLOAD" ? "ROLE_OVERLOAD" : "UNRESOLVED_CONFLICT",
      severity: c.severity || "warn",
      message: c.summary || "未处理的冲突项（继承自交织骨架）",
      stageIds: [],
      beatIds: [],
    });
  }

  return warnings;
}

function proposeStructureChanges(stages, warnings) {
  const requests = [];
  for (const w of warnings) {
    if (w.type !== "STAGE_CROWDING") continue;
    const stage = stages.find((s) => s.stageId === w.stageIds[0]);
    if (!stage || stage.beats.length < 2) continue;
    const mid = Math.floor(stage.beats.length / 2);
    const moveCandidates = stage.beats.slice(mid);
    requests.push(
      normalizeStructureChangeRequest({
        id: stableId("scr", "split", stage.stageId),
        type: "SPLIT_STAGE",
        sourceStageIds: [stage.stageId],
        sourceBeatIds: moveCandidates.map((b) => b.sourceOutlineBeatId),
        sourceBlockIds: [...new Set(moveCandidates.map((b) => b.sourceBlockId))],
        reason: w.message,
        severity: "warn",
        proposal: `建议将「${stage.title}」后半 ${moveCandidates.length} 个 beat 拆到后续阶段；P6 仅提议，不自动应用。`,
        status: "PROPOSED",
      }),
    );
  }
  return requests;
}

function projectTruthView(stages) {
  const events = [];
  for (const st of stages) {
    for (const b of st.beats) {
      const misleading = (b.produces || []).some((p) =>
        /false|mislead|suspicion|嫁祸|误导/i.test(String(p.kind || p.id || p.summary || "")),
      );
      events.push({
        beatId: b.sourceOutlineBeatId,
        stageId: st.stageId,
        whatHappened: b.eventSummary,
        who: b.relatedCharacterIds,
        why: b.goal || "UNKNOWN",
        consequence: b.immediateConsequence || "UNKNOWN",
        isMisleading: misleading,
        isTruth: !misleading,
        needsDetail: b.needsDetail,
      });
    }
  }
  return { events };
}

function projectCharacterViews(stages, state) {
  const byChar = new Map();
  for (const st of stages) {
    for (const b of st.beats) {
      for (const actor of b.actors || []) {
        if (!actor.id || actor.id === "unknown") continue;
        if (!byChar.has(actor.id)) {
          byChar.set(actor.id, { characterId: actor.id, name: actor.name, stages: [] });
        }
        const entry = byChar.get(actor.id);
        let stageRow = entry.stages.find((s) => s.stageId === st.stageId);
        if (!stageRow) {
          stageRow = {
            stageId: st.stageId,
            knows: "NEEDS_DETAIL",
            goal: "NEEDS_DETAIL",
            action: "NEEDS_DETAIL",
            relationChanges: [],
            gainedInfo: "NEEDS_DETAIL",
            misunderstanding: "NEEDS_DETAIL",
            endChange: "NEEDS_DETAIL",
            needsDetail: true,
          };
          entry.stages.push(stageRow);
        }
        if (b.goal) stageRow.goal = b.goal;
        if (b.action) stageRow.action = b.action;
        if (b.produces?.length) {
          stageRow.gainedInfo = b.produces.map((p) => p.summary || p.id).join("；");
        }
        if (b.relationQuality === "COLOCATED") {
          stageRow.relationChanges.push("同场出现（非因果）");
        }
        if (b.relationQuality === "INTERWOVEN") {
          stageRow.relationChanges.push("参与真正交织行动");
        }
        stageRow.endChange = b.immediateConsequence !== "UNKNOWN" ? b.immediateConsequence : "NEEDS_DETAIL";
        stageRow.needsDetail = stageRow.goal === "NEEDS_DETAIL" || stageRow.action === "NEEDS_DETAIL";
        // 不编造「知道什么」
        if (b.playerKnowledge && !/NEEDS_DETAIL/.test(b.playerKnowledge)) {
          stageRow.knows = `本阶段可见行动相关：${b.action || "（见正文）"}`;
        }
      }
    }
  }
  // 补全未出场但存在于 state 的角色？——不主动编造阶段条目
  return { characters: [...byChar.values()] };
}

function projectClueView(stages, blocks, state) {
  const clues = [];
  const seen = new Set();
  for (const st of stages) {
    for (const b of st.beats) {
      const block = blockById(blocks, b.sourceBlockId);
      for (const clueId of b.clueRefs || []) {
        const key = `${clueId}@${st.stageId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const fromState = (state.clues || []).find((c) => c.id === clueId || c.clueId === clueId);
        const fromBlock = (block?.clueBindings || []).find((c) => c.clueId === clueId || c.id === clueId);
        const label = fromState?.label || fromBlock?.label || clueId;
        clues.push({
          clueId,
          label,
          mechanismId: b.sourceBlockId,
          templateId: b.templateId,
          stageId: st.stageId,
          possibleFinders: b.relatedCharacterIds,
          supportsFact: fromBlock?.summary || fromState?.summary || "NEEDS_DETAIL",
          isMisleading: Boolean(fromBlock?.pointsToRoleKey === "framedCharacter"),
          isDecisive: /decisive|决定/i.test(String(label)),
          missingDetail: !fromState && !fromBlock,
          detailNote:
            !fromState && !fromBlock
              ? "剧情 beat 引用了线索 id，但具体内容尚未提供"
              : undefined,
        });
      }
      if ((!b.clueRefs || !b.clueRefs.length) && (b.requires?.length || b.produces?.length)) {
        const syntheticId = `fact-interface:${b.sourceOutlineBeatId}`;
        if (seen.has(syntheticId)) continue;
        seen.add(syntheticId);
        clues.push({
          clueId: syntheticId,
          label: "事实接口（尚无线索实体）",
          mechanismId: b.sourceBlockId,
          templateId: b.templateId,
          stageId: st.stageId,
          possibleFinders: b.relatedCharacterIds,
          supportsFact: [...(b.requires || []), ...(b.produces || [])]
            .map((f) => f.summary || f.id)
            .join("；"),
          isMisleading: false,
          isDecisive: false,
          missingDetail: true,
          detailNote: "这个剧情 beat 需要关键线索，但模板尚未提供具体线索内容。",
        });
      }
    }
  }
  return { clues };
}

function projectExecutionView(stages) {
  return {
    stages: stages.map((st, i) => ({
      stageId: st.stageId,
      openingState: st.stageStartState,
      stageGoal: st.purpose,
      beatsToAdvance: st.beats.map((b) => b.sourceOutlineBeatId),
      cluesAvailable: st.clueEntries.map((c) => c.clueId || c.label).filter(Boolean),
      charactersInPlay: [
        ...new Set(st.beats.flatMap((b) => b.relatedCharacterIds || [])),
      ],
      gameMechanismSlots: st.beats.map((b) => ({
        placementId: stableId("game-slot", b.sourceOutlineBeatId),
        hint: "预留：可在此 beat 后插入 GAME mechanism（本轮不接 runtime）",
        afterBeatId: b.sourceOutlineBeatId,
      })),
      requiredStateBeforeNext:
        i < stages.length - 1
          ? st.stageEndState || "本阶段 beat 所列后果应已发生（若标 UNKNOWN 则仍缺细节）"
          : "终幕：无强制下一阶段",
    })),
  };
}

/**
 * 核心：MasterOutlineDraft → ProductionMasterDraft（确定性）
 */
export function expandProductionMasterDraft(projectStoryState, options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const state = createProjectStoryState(projectStoryState);
  const outline = normalizeMasterOutlineDraft(state.masterOutlineDraft);
  if (!outline) {
    fail("EXPAND_NO_OUTLINE", "需要先有交织骨架（MasterOutlineDraft）才能展开详细母稿");
  }
  const blocks = listAcceptedStoryBlocks(state);
  const sortedStages = [...(outline.stages || [])].sort((a, b) => a.order - b.order);

  const productionStages = sortedStages.map((st, index) => {
    const beats = (st.beats || []).map((ob) =>
      expandOneBeat(ob, outline, state, blocks, st.id),
    );
    const unresolvedDetails = beats.filter((b) => b.needsDetail).map((b) => b.detailReason || b.eventSummary);
    const characterEntries = [
      ...new Map(
        beats.flatMap((b) => b.actors || []).map((a) => [a.id, a]),
      ).values(),
    ];
    const clueEntries = beats.flatMap((b) =>
      (b.clueRefs || []).map((id) => ({ clueId: id, stageId: st.id })),
    );
    const purpose =
      beats
        .filter((b) => b.goal)
        .slice(0, 3)
        .map((b) => `${b.actors[0]?.name || "角色"}：${b.goal}`)
        .join("；") || "NEEDS_DETAIL：本阶段目标未给出";

    const playerVisibleSummary = beats.map((b) => b.playerKnowledge).join(" / ");
    const hostTruthSummary = beats.map((b) => b.hostTruth).join(" / ");

    return {
      stageId: st.id,
      stageRole: stageRoleOf(st.label, index, sortedStages.length),
      title: st.label || `第${index + 1}阶段`,
      order: st.order ?? index,
      purpose,
      beats,
      playerVisibleSummary,
      hostTruthSummary,
      stageStartState:
        index === 0
          ? "开局：各线按积木 setup 状态进入（不新增前提）"
          : `承接上一阶段已声明后果；未声明者标 UNKNOWN`,
      stageEndState: beats
        .map((b) => b.immediateConsequence)
        .filter((c) => c && c !== "UNKNOWN")
        .slice(0, 5)
        .join("；") || "UNKNOWN",
      clueEntries,
      characterEntries,
      unresolvedDetails,
      warnings: [],
    };
  });

  // strip internal
  for (const st of productionStages) {
    for (const b of st.beats) delete b._stageId;
  }

  const warnings = buildWarnings(outline, productionStages, state);
  const structureChangeRequests = proposeStructureChanges(productionStages, warnings);

  const truthView = projectTruthView(productionStages);
  const characterViews = projectCharacterViews(productionStages, state);
  const clueView = projectClueView(productionStages, blocks, state);

  // attach clueEntries richer for execution
  for (const st of productionStages) {
    st.clueEntries = clueView.clues.filter((c) => c.stageId === st.stageId);
    st.warnings = warnings.filter((w) => w.stageIds.includes(st.stageId));
  }

  const executionView = projectExecutionView(productionStages);

  const premiseBits = [
    state.premise?.genre,
    state.premise?.era,
    ...(state.premise?.tone || []),
  ].filter(Boolean);

  return emptyProductionMasterDraft({
    id: options.preserveId || stableId("pmd", outline.id || state.projectId),
    projectId: state.projectId,
    sourceStoryStateRevision: state.revision || 0,
    sourceMasterOutlineId: outline.id,
    sourceMasterOutlineRevision: outlineStructureRevision(outline),
    title: options.title || "生产母稿（详细展开）",
    premiseSummary: premiseBits.length ? premiseBits.join(" · ") : undefined,
    stages: productionStages,
    truthView,
    characterViews,
    clueView,
    executionView,
    warnings,
    structureChangeRequests,
    status: "DRAFT",
    revision: Number(options.revision) || 0,
    updatedAt: typeof now === "function" ? now() : now,
  });
}

export function expandAndWriteProductionMasterDraft(projectStoryState, options = {}) {
  const state = createProjectStoryState(projectStoryState);
  const draft = expandProductionMasterDraft(state, options);
  return createProjectStoryState({
    ...state,
    productionMasterDraft: draft,
  });
}

export function writeProductionMasterDraft(projectStoryState, draft) {
  const state = createProjectStoryState(projectStoryState);
  return createProjectStoryState({
    ...state,
    productionMasterDraft: normalizeProductionMasterDraft(draft),
  });
}

/** CONTENT_EDIT：只改正文类字段，不改源 outline */
export function applyContentEdit(draft, beatId, patch = {}) {
  const next = normalizeProductionMasterDraft(draft);
  if (!next) fail("DRAFT_MISSING", "尚无生产母稿");
  let found = false;
  for (const st of next.stages) {
    const beat = st.beats.find((b) => b.id === beatId || b.sourceOutlineBeatId === beatId);
    if (!beat) continue;
    found = true;
    if (patch.eventSummary != null) beat.eventSummary = String(patch.eventSummary).slice(0, 800);
    if (patch.playerKnowledge != null) beat.playerKnowledge = String(patch.playerKnowledge).slice(0, 400);
    if (patch.hostTruth != null) beat.hostTruth = String(patch.hostTruth).slice(0, 400);
    if (patch.setupContext != null) beat.setupContext = String(patch.setupContext).slice(0, 400);
    if (patch.contentConfirmed != null) beat.contentConfirmed = Boolean(patch.contentConfirmed);
    // 禁止通过 content edit 改 goal/action/requires/produces/relation
    break;
  }
  if (!found) fail("BEAT_MISSING", `Unknown production beat ${beatId}`);
  next.revision = (next.revision || 0) + 1;
  next.updatedAt = new Date().toISOString();
  // 内容编辑后重投影视图（仍同源 beats）
  next.truthView = projectTruthView(next.stages);
  next.characterViews = projectCharacterViews(next.stages, { characters: [] });
  next.clueView = next.clueView;
  next.executionView = projectExecutionView(next.stages);
  return next;
}

/** STRUCTURE_EDIT：只生成 PROPOSED request，不 APPLY */
export function proposeStructureEdit(draft, request) {
  const next = normalizeProductionMasterDraft(draft);
  if (!next) fail("DRAFT_MISSING", "尚无生产母稿");
  const item = normalizeStructureChangeRequest({
    ...request,
    status: "PROPOSED",
    id: request?.id || newId("scr"),
  });
  next.structureChangeRequests = [...next.structureChangeRequests, item];
  next.revision = (next.revision || 0) + 1;
  next.updatedAt = new Date().toISOString();
  return next;
}

export function markProductionDraftStaleIfNeeded(projectStoryState) {
  const state = createProjectStoryState(projectStoryState);
  if (!state.productionMasterDraft) return state;
  const refreshed = refreshProductionDraftStaleStatus(state.productionMasterDraft, {
    storyRevision: state.revision,
    outline: state.masterOutlineDraft,
  });
  return createProjectStoryState({
    ...state,
    productionMasterDraft: refreshed,
  });
}

export {
  outlineStructureRevision,
  refreshProductionDraftStaleStatus,
};
