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
    ownerCharacterIds: (sem?.actorRefs || []).filter(Boolean),
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
  // Final stage is always PAYOFF under target-stage remap (label keywords must not override).
  if (total <= 1) return "SETUP";
  if (index === total - 1) return "PAYOFF";
  if (/铺垫|setup/i.test(label)) return "SETUP";
  if (/收束|payoff|resolution|终局/i.test(label)) return "PAYOFF";
  if (/加压|pressure|发展/i.test(label)) return "PRESSURE";
  if (/升级|escalation/i.test(label)) return "ESCALATION";
  if (index === 0) return "SETUP";
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
    let severity = c.severity || "warn";
    let type = c.type === "ROLE_OVERLOAD" ? "ROLE_OVERLOAD" : "UNRESOLVED_CONFLICT";
    if (c.type === "ROLE_OVERLOAD") {
      const loadMatch = String(c.summary || "").match(/负载\s*(\d+(?:\.\d+)?)/);
      const load = loadMatch ? Number(loadMatch[1]) : Number(c.score) || 3;
      // load 3 → INFO；4–5 → WARN；≥6 → HIGH
      severity = load >= 6 ? "high" : load >= 4 ? "warn" : "info";
    }
    warnings.push({
      id: stableId("warn", "conflict", c.id || c.type),
      type,
      severity,
      message: c.summary || "未处理的冲突项（继承自交织骨架）",
      stageIds: [],
      beatIds: [],
    });
  }

  return warnings;
}

function proposeStructureChanges(stages, warnings, { stageCountLocked = false } = {}) {
  const requests = [];
  for (const w of warnings) {
    if (w.type !== "STAGE_CROWDING") continue;
    const stage = stages.find((s) => s.stageId === w.stageIds[0]);
    if (!stage || stage.beats.length < 2) continue;
    const mid = Math.floor(stage.beats.length / 2);
    const moveCandidates = stage.beats.slice(mid);
    if (stageCountLocked) {
      const later = stages.filter((s) => (s.order ?? 0) > (stage.order ?? 0));
      const targetHint = later.map((s) => s.stageId).join(" / ") || "后续已有阶段";
      requests.push(
        normalizeStructureChangeRequest({
          id: stableId("scr", "rebalance", stage.stageId),
          type: "REBALANCE_STAGE",
          sourceStageIds: [stage.stageId, ...later.map((s) => s.stageId)].slice(0, 4),
          sourceBeatIds: moveCandidates.map((b) => b.sourceOutlineBeatId),
          sourceBlockIds: [...new Set(moveCandidates.map((b) => b.sourceBlockId))],
          reason: w.message,
          severity: "warn",
          proposal: `固定 ${stages.length} 幕约束下，建议将「${stage.title}」后半 ${moveCandidates.length} 个合格 beat 重平衡到 ${targetHint}（保持时间顺序）；P6 仅提议，不自动应用，禁止拆出新幕。`,
          status: "PROPOSED",
        }),
      );
      continue;
    }
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

function uniqueTexts(values) {
  const out = [];
  const seen = new Set();
  for (const raw of values || []) {
    const text = String(raw || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function factLooksMisleading(fact) {
  const blob = `${fact?.kind || ""} ${fact?.id || ""} ${fact?.summary || ""}`;
  return /false|mislead|suspicion|嫁祸|误导/i.test(blob);
}

function clueLooksMisleading({ label, clueId, fromBlock, fromState, beat }) {
  const blob = `${label || ""} ${clueId || ""} ${fromBlock?.slotKey || ""} ${fromBlock?.purpose || ""} ${fromState?.kind || ""}`;
  if (/误导|false.?lead|FALSE_LEAD|planted/i.test(blob)) return true;
  if (fromBlock?.pointsToRoleKey === "framedCharacter" || fromBlock?.pointsToRoleKey === "framed") {
    return true;
  }
  if ((beat?.produces || []).some(factLooksMisleading)) return true;
  return false;
}

function roleInBeatForCharacter(characterId, characterName, beat) {
  const owners = (beat.ownerCharacterIds || []).filter(Boolean);
  if (owners.includes(characterId)) return "OWNER";
  if (!owners.length && beat.actors?.[0]?.id === characterId) return "OWNER";
  const name = String(characterName || "");
  const goal = String(beat.goal || "");
  const target = String(beat.target || "");
  const summary = String(beat.eventSummary || "");
  if (name && (goal.includes(name) || target.includes(name) || summary.includes(name))) {
    if (/锁定|揭穿|嫁祸|嫌疑|指向/.test(`${goal} ${target} ${summary}`)) return "TARGET";
  }
  return "PARTICIPANT";
}

function projectTruthView(stages) {
  const events = [];
  for (const st of stages) {
    for (const b of st.beats) {
      const misleading = (b.produces || []).some(factLooksMisleading);
      const supporting = (b.produces || []).some((p) =>
        /true|decisive|contradiction|identity_confirmed|真相|决定/i.test(
          `${p.kind || ""} ${p.id || ""} ${p.summary || ""}`,
        ),
      );
      const evidenceEffect = misleading ? "MISLEADING" : supporting ? "SUPPORTING" : "NEUTRAL";
      const claimTruth =
        evidenceEffect === "MISLEADING" ? "FALSE" : evidenceEffect === "SUPPORTING" ? "TRUE" : "UNKNOWN";
      events.push({
        beatId: b.sourceOutlineBeatId,
        stageId: st.stageId,
        whatHappened: b.eventSummary,
        who: b.relatedCharacterIds,
        why: b.goal || "UNKNOWN",
        consequence: b.immediateConsequence || "UNKNOWN",
        eventOccurred: true,
        evidenceEffect,
        claimTruth,
        isMisleading: misleading,
        isTruth: true,
        needsDetail: b.needsDetail,
      });
    }
  }
  return { events };
}

function projectCharacterViews(stages) {
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
            contributions: [],
            stageSummary: "",
            knows: "NEEDS_DETAIL",
            goal: "NEEDS_DETAIL",
            action: "NEEDS_DETAIL",
            relationChanges: [],
            gainedInfo: "NEEDS_DETAIL",
            misunderstanding: "NEEDS_DETAIL",
            endChange: "NEEDS_DETAIL",
            needsDetail: false,
          };
          entry.stages.push(stageRow);
        }

        const roleInBeat = roleInBeatForCharacter(actor.id, actor.name, b);
        const isOwner = roleInBeat === "OWNER";
        const gained =
          isOwner && b.produces?.length
            ? b.produces.map((p) => p.summary || p.id).filter(Boolean).join("；")
            : null;

        stageRow.contributions.push({
          sourceBeatId: b.sourceBeatId,
          sourceOutlineBeatId: b.sourceOutlineBeatId,
          sourceBlockId: b.sourceBlockId,
          familyId: b.familyId,
          templateId: b.templateId,
          roleInBeat,
          goal: isOwner ? b.goal || null : null,
          action: isOwner
            ? b.action || null
            : roleInBeat === "TARGET"
              ? `作为对象卷入：${b.action || b.goal || b.eventSummary || "相关剧情"}`
              : `参与（非主导）：${b.eventSummary || b.action || "相关剧情"}`,
          gainedInfo: gained,
          relationQuality: b.relationQuality,
          needsDetail: Boolean(b.needsDetail) && isOwner,
        });

        if (b.relationQuality === "COLOCATED") {
          stageRow.relationChanges.push("同场出现（非因果）");
        }
        if (b.relationQuality === "INTERWOVEN" && isOwner) {
          stageRow.relationChanges.push("参与真正交织行动");
        }
      }
    }
  }

  for (const entry of byChar.values()) {
    for (const stageRow of entry.stages) {
      stageRow.relationChanges = uniqueTexts(stageRow.relationChanges);
      const owners = stageRow.contributions.filter((c) => c.roleInBeat === "OWNER");
      const ownerGoals = uniqueTexts(owners.map((c) => c.goal));
      const ownerActions = uniqueTexts(owners.map((c) => c.action));
      const gainedBits = uniqueTexts(
        stageRow.contributions.map((c) => c.gainedInfo).filter(Boolean),
      );
      stageRow.stageSummary = ownerGoals.length
        ? ownerGoals.join("；")
        : stageRow.contributions.length
          ? "本阶段无独立主目标（仅参与/对象）"
          : "NEEDS_DETAIL";
      stageRow.goal = stageRow.stageSummary;
      stageRow.action = ownerActions.length
        ? ownerActions.join("；")
        : stageRow.contributions.length
          ? "见 contributions（参与/对象）"
          : "NEEDS_DETAIL";
      stageRow.gainedInfo = gainedBits.join("；") || "NEEDS_DETAIL";
      stageRow.endChange = gainedBits.join("；") || stageRow.endChange || "NEEDS_DETAIL";
      stageRow.needsDetail = stageRow.contributions.some((c) => c.needsDetail);
      const knowActions = uniqueTexts(owners.map((c) => c.action).filter(Boolean));
      stageRow.knows = knowActions.length
        ? `本阶段主导行动：${knowActions.join("；")}`
        : stageRow.contributions.length
          ? "本阶段主要为参与/对象，无主导公开行动摘要"
          : "NEEDS_DETAIL";
    }
  }

  return { characters: [...byChar.values()] };
}

function projectClueView(stages, blocks, state) {
  /** @type {Map<string, any>} */
  const byId = new Map();

  for (const st of stages) {
    for (const b of st.beats) {
      const block = blockById(blocks, b.sourceBlockId);
      for (const clueId of b.clueRefs || []) {
        const fromState = (state.clues || []).find((c) => c.id === clueId || c.clueId === clueId);
        const fromBlock = (block?.clueBindings || []).find(
          (c) => c.clueId === clueId || c.id === clueId,
        );
        const label = fromState?.label || fromBlock?.label || clueId;
        const misleading = clueLooksMisleading({ label, clueId, fromBlock, fromState, beat: b });
        const existing = byId.get(clueId);
        if (existing) {
          if (!existing.availableStages.includes(st.stageId)) {
            existing.availableStages.push(st.stageId);
          }
          existing.persists = existing.availableStages.length > 1;
          existing.possibleFinders = [
            ...new Set([...existing.possibleFinders, ...(b.relatedCharacterIds || [])]),
          ];
          if (misleading) existing.isMisleading = true;
          continue;
        }
        byId.set(clueId, {
          clueId,
          label,
          mechanismId: b.sourceBlockId,
          templateId: b.templateId,
          introducedAt: st.stageId,
          availableStages: [st.stageId],
          persists: false,
          stageId: st.stageId,
          possibleFinders: [...(b.relatedCharacterIds || [])],
          supportsFact: fromBlock?.summary || fromState?.summary || "NEEDS_DETAIL",
          isMisleading: misleading,
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
        if (byId.has(syntheticId)) continue;
        byId.set(syntheticId, {
          clueId: syntheticId,
          label: "事实接口（尚无线索实体）",
          mechanismId: b.sourceBlockId,
          templateId: b.templateId,
          introducedAt: st.stageId,
          availableStages: [st.stageId],
          persists: false,
          stageId: st.stageId,
          possibleFinders: [...(b.relatedCharacterIds || [])],
          supportsFact: [...(b.requires || []), ...(b.produces || [])]
            .map((f) => f.summary || f.id)
            .join("；"),
          isMisleading: (b.produces || []).some(factLooksMisleading),
          isDecisive: false,
          missingDetail: true,
          detailNote: "这个剧情 beat 需要关键线索，但模板尚未提供具体线索内容。",
        });
      }
    }
  }
  return { clues: [...byId.values()] };
}

function projectExecutionView(stages) {
  return {
    stages: stages.map((st, i) => {
      const insertionPoints = st.beats.map((b) => ({
        placementId: stableId("game-candidate", b.sourceOutlineBeatId),
        hint: "候选插入点：可在此 beat 后考虑 GAME（非强制每 beat 都要放）",
        afterBeatId: b.sourceOutlineBeatId,
      }));
      return {
        stageId: st.stageId,
        openingState: st.stageStartState,
        stageGoal: st.purpose,
        beatsToAdvance: st.beats.map((b) => b.sourceOutlineBeatId),
        cluesAvailable: st.clueEntries.map((c) => c.clueId || c.label).filter(Boolean),
        charactersInPlay: [
          ...new Set(st.beats.flatMap((b) => b.relatedCharacterIds || [])),
        ],
        candidateGameInsertionPoints: insertionPoints,
        gameMechanismSlots: insertionPoints,
        requiredStateBeforeNext:
          i < stages.length - 1
            ? st.stageEndState || "本阶段 beat 所列后果应已发生（若标 UNKNOWN 则仍缺细节）"
            : "终幕：无强制下一阶段",
      };
    }),
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
      uniqueTexts(
        beats
          .filter((b) => b.goal)
          .map((b) => {
            const owner =
              (b.ownerCharacterIds || [])
                .map((id) => (b.actors || []).find((a) => a.id === id)?.name || id)
                .filter(Boolean)[0] || b.actors[0]?.name || "角色";
            return `${owner}：${b.goal}`;
          }),
      )
        .slice(0, 6)
        .join("；") || "NEEDS_DETAIL：本阶段目标未给出";

    const playerVisibleSummary = uniqueTexts(beats.map((b) => b.playerKnowledge)).join(" / ");
    const hostTruthSummary = uniqueTexts(beats.map((b) => b.hostTruth)).join(" / ");

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
      stageEndState:
        uniqueTexts(
          beats.map((b) => b.immediateConsequence).filter((c) => c && c !== "UNKNOWN"),
        )
          .slice(0, 8)
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
  const stageCountLocked = (state.stages || []).length >= 2;
  const structureChangeRequests = proposeStructureChanges(productionStages, warnings, {
    stageCountLocked,
  });

  const truthView = projectTruthView(productionStages);
  const characterViews = projectCharacterViews(productionStages);
  const clueView = projectClueView(productionStages, blocks, state);

  // attach clueEntries richer for execution
  for (const st of productionStages) {
    st.clueEntries = clueView.clues.filter(
      (c) =>
        c.stageId === st.stageId ||
        c.introducedAt === st.stageId ||
        (c.availableStages || []).includes(st.stageId),
    );
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
  next.characterViews = projectCharacterViews(next.stages);
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
