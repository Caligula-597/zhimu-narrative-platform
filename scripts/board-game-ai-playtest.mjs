import {
  advanceBoardGameRuntime,
  compileBoardGameEngine,
  createBoardGameRuntimeState,
  executeBoardGameAction
} from "../shared/board-game-engine.js";
import { createBoardGamePreset } from "../shared/board-game-variant-presets.js";
import { BOARD_GAME_REFERENCE_CATALOG } from "../shared/reference-board-game-presets.js";
import { boardGameAiProfiles, chooseBoardGameAiDecision, projectBoardGameAiState } from "../shared/board-game-ai-policy.js";

const clone = (value) => structuredClone(value);
const now = () => performance.now();
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function scoreOf(design, state, seatIndex) {
  const variable = (design.variables || []).find((item) => item.id === "score" && item.scope === "player");
  if (variable) return number(state.playerValues?.[seatIndex]?.score);
  return number(state.scores?.[seatIndex]);
}

function publicStateSummary(design, state) {
  return {
    round: state.round,
    phaseIndex: state.phaseIndex,
    activeSeatIndex: state.activeSeatIndex,
    scores: Array.from({ length: state.seatCount }, (_, seatIndex) => scoreOf(design, state, seatIndex)),
    publicValues: clone(state.values || {}),
    owners: clone(state.owners || {}),
    routeOwners: clone(state.routeOwners || {}),
    availableRoutes: (design.engine.map?.edges || []).filter((edge) => !Number.isInteger(state.routeOwners?.[edge.id])).length,
    riskProgress: clone(state.riskProgress || [])
  };
}

function profileForSeat(seatIndex, gameIndex) {
  const profiles = boardGameAiProfiles();
  return profiles[(seatIndex + gameIndex) % profiles.length].id;
}

function readAction(design, decision) {
  return design.engine.actions.find((item) => item.id === decision.actionId) || null;
}

function runOneGame(designValue, { gameIndex = 0, seatCount, maxSteps = 2000 } = {}) {
  const design = clone(designValue);
  if (!design.engine.setup) design.engine.setup = {};
  design.engine.setup.seed = `${design.engine.setup.seed || design.title || "board-game"}-ai-${gameIndex + 1}`;
  const count = seatCount || design.playerCount.min;
  const report = compileBoardGameEngine(design, count);
  const startedAt = now();
  if (report.blocking) {
    return { title: design.title, gameIndex, ended: false, blocking: true, compileIssues: report.issues, steps: 0 };
  }
  let state = createBoardGameRuntimeState(design, count);
  const events = [];
  const errors = [];
  const actionStats = new Map();
  const phaseStats = new Map();
  let steps = 0;
  let decisionCount = 0;
  let globalAwareDecisions = 0;
  let totalDecisionMs = 0;
  let maxDecisionMs = 0;
  let totalCandidates = 0;

  while (!state.ended && steps < maxSteps) {
    const before = publicStateSummary(design, state);
    if (state.resolved) {
      const advanceStarted = now();
      const result = advanceBoardGameRuntime(design, state);
      const elapsedMs = now() - advanceStarted;
      steps += 1;
      if (!result.ok) {
        errors.push({ type: "advance", code: result.code, message: result.message, round: state.round, phaseIndex: state.phaseIndex });
        break;
      }
      state = result.state;
      events.push({ type: "advance", round: before.round, phaseIndex: before.phaseIndex, elapsedMs: Number(elapsedMs.toFixed(3)), ended: state.ended });
      continue;
    }

    const seatIndex = state.activeSeatIndex;
    const profile = profileForSeat(seatIndex, gameIndex);
    const decisionStarted = now();
    let decision = chooseBoardGameAiDecision(design, projectBoardGameAiState(state, seatIndex), seatIndex, { profile, searchDepth: 2, maxSearchCandidates: 10 });
    const elapsedMs = now() - decisionStarted;
    decisionCount += 1;
    totalDecisionMs += elapsedMs;
    maxDecisionMs = Math.max(maxDecisionMs, elapsedMs);
    totalCandidates += decision.candidateCount || 0;
    if (decision.globalFactors?.length) globalAwareDecisions += 1;
    let action = readAction(design, decision);
    const phaseKey = `${state.phaseIndex}:${design.engine.phases[state.phaseIndex]?.label || "phase"}`;
    const actionKey = action?.kind || "unknown";
    const actionStat = actionStats.get(actionKey) || { count: 0, totalMs: 0, maxMs: 0, candidates: 0, globalAware: 0 };
    actionStat.count += 1;
    actionStat.totalMs += elapsedMs;
    actionStat.maxMs = Math.max(actionStat.maxMs, elapsedMs);
    actionStat.candidates += decision.candidateCount || 0;
    actionStat.globalAware += decision.globalFactors?.length ? 1 : 0;
    actionStats.set(actionKey, actionStat);
    const phaseStat = phaseStats.get(phaseKey) || { label: phaseKey, count: 0, totalMs: 0, maxMs: 0, candidates: 0 };
    phaseStat.count += 1;
    phaseStat.totalMs += elapsedMs;
    phaseStat.maxMs = Math.max(phaseStat.maxMs, elapsedMs);
    phaseStat.candidates += decision.candidateCount || 0;
    phaseStats.set(phaseKey, phaseStat);
    if (!decision.ok || !action) {
      errors.push({ type: "decision", seatIndex, profile, message: decision.reason || "无可执行行动", round: state.round, phaseIndex: state.phaseIndex });
      break;
    }
    let result = executeBoardGameAction(design, state, {
      actionId: decision.actionId,
      targetId: decision.targetId,
      seatIndex,
      cardId: decision.cardId,
      bidAmount: decision.bidAmount
    });
    steps += 1;
    let retryCount = 0;
    if (!result.ok && result.code === "DRAFT_CONFLICT") {
      const alreadyCommitted = Object.values(state.submissions || {}).map((submission) => submission.cardId).filter(Boolean);
      const retryDecision = chooseBoardGameAiDecision(design, projectBoardGameAiState(state, seatIndex), seatIndex, {
        profile,
        excludeCardIds: [...alreadyCommitted, decision.cardId],
        searchDepth: 2,
        maxSearchCandidates: 10
      });
      if (retryDecision.ok) {
        retryCount = 1;
        decision = retryDecision;
        action = readAction(design, decision);
        result = executeBoardGameAction(design, state, {
          actionId: decision.actionId,
          targetId: decision.targetId,
          seatIndex,
          cardId: decision.cardId,
          bidAmount: decision.bidAmount
        });
        steps += 1;
      }
    }
    if (!result.ok) {
      errors.push({ type: "execute", code: result.code, message: result.message, seatIndex, actionId: action.id, round: state.round, phaseIndex: state.phaseIndex, decision });
      break;
    }
    state = result.state;
    events.push({
      type: "decision",
      seatIndex,
      profile,
      round: before.round,
      phaseIndex: before.phaseIndex,
      actionId: action.id,
      actionKind: action.kind,
      targetId: decision.targetId,
      cardId: decision.cardId,
      availableActionIds: design.engine.phases[state.phaseIndex]?.actionIds || [],
      elapsedMs: Number(elapsedMs.toFixed(3)),
      candidateCount: decision.candidateCount,
      retryCount,
      globalFactors: decision.globalFactors,
      reason: decision.reason,
      before,
      after: publicStateSummary(design, state)
    });
  }

  const scores = Array.from({ length: state.seatCount }, (_, seatIndex) => ({
    seatIndex,
    profile: profileForSeat(seatIndex, gameIndex),
    score: scoreOf(design, state, seatIndex),
    values: clone(state.playerValues?.[seatIndex] || {})
  })).sort((left, right) => right.score - left.score || left.seatIndex - right.seatIndex);
  const actionHotspots = [...actionStats.entries()].map(([actionKind, stat]) => ({ actionKind, ...stat, averageMs: stat.totalMs / Math.max(1, stat.count), averageCandidates: stat.candidates / Math.max(1, stat.count), globalAwareness: stat.globalAware / Math.max(1, stat.count) })).sort((left, right) => right.averageMs - left.averageMs);
  const phaseHotspots = [...phaseStats.values()].map((stat) => ({ ...stat, averageMs: stat.totalMs / Math.max(1, stat.count), averageCandidates: stat.candidates / Math.max(1, stat.count) })).sort((left, right) => right.averageMs - left.averageMs);
  const strategic = {
    globalAwareness: decisionCount ? globalAwareDecisions / decisionCount : 0,
    averageDecisionMs: decisionCount ? totalDecisionMs / decisionCount : 0,
    maxDecisionMs,
    averageCandidateCount: decisionCount ? totalCandidates / decisionCount : 0,
    sameActionRate: (() => {
      const grouped = new Map();
      events.filter((event) => event.type === "decision").forEach((event) => {
        const key = `${event.round}:${event.phaseIndex}`;
        const list = grouped.get(key) || [];
        list.push(event.actionId);
        grouped.set(key, list);
      });
      const groups = [...grouped.values()].filter((list) => list.length > 1);
      return groups.length ? groups.reduce((sum, list) => sum + (new Set(list).size === 1 ? 1 : 0), 0) / groups.length : 0;
    })(),
    sameSelectionRate: (() => {
      const grouped = new Map();
      events.filter((event) => event.type === "decision").forEach((event) => {
        const key = `${event.round}:${event.phaseIndex}`;
        const list = grouped.get(key) || [];
        list.push(`${event.actionId}|${event.targetId}|${event.cardId}`);
        grouped.set(key, list);
      });
      const groups = [...grouped.values()].filter((list) => list.length > 1);
      return groups.length ? groups.reduce((sum, list) => sum + (new Set(list).size === 1 ? 1 : 0), 0) / groups.length : 0;
    })()
  };
  return {
    title: design.title,
    gameIndex,
    ended: Boolean(state.ended),
    blocking: false,
    durationMs: Number((now() - startedAt).toFixed(2)),
    rounds: state.round,
    steps,
    decisionCount,
    errors,
    final: {
      round: state.round,
      phaseIndex: state.phaseIndex,
      publicValues: clone(state.values || {}),
      scores,
      routeOwners: clone(state.routeOwners || {}),
      riskProgress: clone(state.riskProgress || []),
      logTail: (state.log || []).slice(0, 8)
    },
    strategic,
    hotspots: { phases: phaseHotspots.slice(0, 5), actions: actionHotspots.slice(0, 8) },
    events
  };
}

function referenceDesigns() {
  return BOARD_GAME_REFERENCE_CATALOG.map((entry) => entry.create());
}

function variantDesigns() {
  return ["last-lighthouse-standard", "last-lighthouse-black-tide", "last-lighthouse-trade-route", "last-lighthouse-race"].map((id) => createBoardGamePreset(id));
}

function summarizeGames(games) {
  const wins = new Map();
  games.forEach((game) => {
    const winner = game.final.scores[0];
    if (!winner) return;
    const key = winner.profile;
    wins.set(key, (wins.get(key) || 0) + 1);
  });
  const decisionEvents = games.flatMap((game) => game.events.filter((event) => event.type === "decision"));
  return {
    games: games.length,
    endedGames: games.filter((game) => game.ended).length,
    errorGames: games.filter((game) => game.errors.length).length,
    winnerDistribution: Object.fromEntries(wins),
    meanGlobalAwareness: games.reduce((sum, game) => sum + game.strategic.globalAwareness, 0) / Math.max(1, games.length),
    meanDecisionMs: games.reduce((sum, game) => sum + game.strategic.averageDecisionMs, 0) / Math.max(1, games.length),
    slowestDecision: decisionEvents.sort((left, right) => right.elapsedMs - left.elapsedMs).slice(0, 5).map((event) => ({ round: event.round, phaseIndex: event.phaseIndex, seatIndex: event.seatIndex, profile: event.profile, actionKind: event.actionKind, elapsedMs: event.elapsedMs, candidateCount: event.candidateCount, reason: event.reason }))
  };
}

const designs = [...referenceDesigns(), ...variantDesigns()];
const allReports = [];
for (const design of designs) {
  const games = [0, 1, 2].map((gameIndex) => runOneGame(design, { gameIndex, seatCount: Math.min(design.playerCount.max, Math.max(2, design.playerCount.min)) }));
  allReports.push({ title: design.title, summary: summarizeGames(games), games: games.map((game) => ({ ...game, events: game.events.slice(-24) })) });
}

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  contract: "AI full-game playtest: private-view enforcement + candidate enumeration + public situation audit",
  designs: allReports
}, null, 2));
