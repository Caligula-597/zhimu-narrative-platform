import {
  boardGameEngineSignature,
  advanceBoardGameRuntime,
  expireBoardGameResponseWindow,
  expireBoardGamePhase,
  executeBoardGameAction
} from "./board-game-engine.js";

export const BOARD_GAME_ONLINE_PROTOCOL_VERSION = 1;

const clone = (value) => structuredClone(value);
const text = (value, max = 160) => String(value ?? "").trim().slice(0, max);
const integer = (value, fallback = 0, min = 0, max = 1_000_000_000) => {
  const parsed = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(parsed) ? Math.round(parsed) : fallback));
};

function projectBoardGameCatalog(designValue = {}) {
  const design = designValue && typeof designValue === "object" ? designValue : {};
  const engine = design.engine && typeof design.engine === "object" ? design.engine : {};
  const actions = Array.isArray(engine.actions) ? engine.actions : [];
  const phases = Array.isArray(engine.phases) ? engine.phases : [];
  const nodes = Array.isArray(engine.map?.nodes) ? engine.map.nodes : [];
  return {
    title: text(design.title, 160),
    designGoal: text(design.designGoal, 2400),
    playerCount: {
      min: integer(design.playerCount?.min, 1, 1, 99),
      max: integer(design.playerCount?.max, 1, 1, 99)
    },
    playTimeMinutes: integer(design.playTimeMinutes, 0, 0, 10080),
    commercialStudy: design.commercialStudy && typeof design.commercialStudy === "object" ? {
      studyId: text(design.commercialStudy.studyId, 120),
      releaseTier: text(design.commercialStudy.releaseTier, 40) || "research",
      sourceGame: text(design.commercialStudy.sourceGame, 160),
      family: text(design.commercialStudy.family, 240),
      coreMechanisms: Array.isArray(design.commercialStudy.coreMechanisms) ? design.commercialStudy.coreMechanisms.map((item) => text(item, 120)).filter(Boolean) : [],
      adaptationBoundary: text(design.commercialStudy.adaptationBoundary, 800),
      acceptanceChecklist: Array.isArray(design.commercialStudy.acceptanceChecklist) ? design.commercialStudy.acceptanceChecklist.map((item) => text(item, 240)).filter(Boolean) : []
    } : null,
    rulebook: design.rulebook && typeof design.rulebook === "object" ? {
      objective: text(design.rulebook.objective, 4000),
      setup: text(design.rulebook.setup, 8000),
      turnStructure: text(design.rulebook.turnStructure, 8000),
      playerActions: text(design.rulebook.playerActions, 8000),
      endCondition: text(design.rulebook.endCondition, 4000),
      tieBreak: text(design.rulebook.tieBreak, 2400),
      notes: text(design.rulebook.notes, 8000)
    } : null,
    components: Array.isArray(design.components) ? design.components.map((component) => ({
      id: text(component?.id, 120),
      type: text(component?.type, 60),
      name: text(component?.name, 160),
      quantity: integer(component?.quantity, 1, 1, 9999),
      description: text(component?.description, 1200),
      playerAction: text(component?.playerAction, 1200)
    })) : [],
    variables: Array.isArray(design.variables) ? design.variables.map((variable) => ({
      id: text(variable?.id, 120),
      label: text(variable?.label || variable?.id, 160),
      scope: text(variable?.scope, 40),
      min: integer(variable?.min, 0, -999999, 999999),
      max: integer(variable?.max, 0, -999999, 999999)
    })) : [],
    phases: phases.map((phase) => ({
      id: text(phase?.id, 120),
      label: text(phase?.label, 160),
      mode: text(phase?.mode, 40),
      description: text(phase?.description, 800),
      actionIds: Array.isArray(phase?.actionIds) ? phase.actionIds.map((id) => text(id, 120)).filter(Boolean) : []
    })),
    actions: actions.map((action) => ({
      id: text(action?.id, 120),
      label: text(action?.label, 160),
      description: text(action?.description, 400),
      kind: text(action?.kind, 60),
      target: text(action?.target, 60),
      deckId: text(action?.deckId, 120),
      draftMode: text(action?.draftMode, 40),
      marketSize: integer(action?.marketSize, 0, 0, 99),
      revealVisibility: text(action?.revealVisibility, 40),
      revealCount: integer(action?.revealCount, 1, 1, 20),
      bidMode: text(action?.bidMode, 40),
      responseActionIds: Array.isArray(action?.responseActionIds) ? action.responseActionIds.map((id) => text(id, 120)).filter(Boolean) : []
    })),
    nodes: nodes.map((node) => ({
      id: text(node?.id, 120),
      label: text(node?.label || node?.name || node?.id, 160),
      kind: text(node?.kind || node?.terrain, 60),
      x: integer(node?.x, 50, 0, 100),
      y: integer(node?.y, 50, 0, 100),
      scoreValue: integer(node?.scoreValue, 0, -999, 999)
    })),
    edges: Array.isArray(engine.map?.edges) ? engine.map.edges.map((edge) => ({
      id: text(edge?.id, 120),
      label: text(edge?.label || edge?.id, 160),
      from: text(edge?.from, 120),
      to: text(edge?.to, 120)
    })) : []
  };
}

function visibleResponseEvents(stateValue, viewerSeatIndex = null) {
  const events = Array.isArray(stateValue?.responseEvents) ? stateValue.responseEvents : [];
  const teamAssignments = Array.isArray(stateValue?.teamAssignments) ? stateValue.teamAssignments : [];
  const viewerTeam = Number.isInteger(viewerSeatIndex) ? teamAssignments[viewerSeatIndex] : null;
  return events.filter((event) => event.visibility === "public" || (
    Number.isInteger(viewerSeatIndex) && event.visibility === "private" && (event.seatIndex === viewerSeatIndex || event.targetSeatIndex === viewerSeatIndex)
  ) || (
    Number.isInteger(viewerSeatIndex) && event.visibility === "team" && (event.teamId || teamAssignments[event.seatIndex]) === viewerTeam
  ));
}

export function createBoardGameDeadline(serverNow = Date.now(), seconds = 15) {
  const startAt = Number.isFinite(Number(serverNow)) ? Number(serverNow) : Date.now();
  return { startedAt: startAt, deadlineAt: startAt + integer(seconds, 15, 1, 3600) * 1000 };
}

export function normalizeBoardGameOnlineCommand(value = {}) {
  return {
    protocolVersion: BOARD_GAME_ONLINE_PROTOCOL_VERSION,
    commandType: ["advance", "timeout"].includes(value.commandType) ? value.commandType : "action",
    commandId: text(value.commandId, 120),
    clientSequence: integer(value.clientSequence, 0, 0, 1_000_000_000),
    designSignature: text(value.designSignature, 20000),
    seatIndex: integer(value.seatIndex, 0, 0, 98),
    actionId: text(value.actionId, 120),
    targetId: text(value.targetId, 120),
    cardId: text(value.cardId, 200),
    bidAmount: integer(value.bidAmount, 0, 0, 999999),
    issuedAt: integer(value.issuedAt, Date.now(), 0, 9_999_999_999_999)
  };
}

export function createBoardGameOnlineCommand(design, input = {}) {
  return normalizeBoardGameOnlineCommand({
    ...input,
    commandId: input.commandId || globalThis.crypto?.randomUUID?.() || `cmd-${Date.now()}`,
    designSignature: input.designSignature || boardGameEngineSignature(design)
  });
}

export function projectBoardGamePublicState(stateValue) {
  const state = clone(stateValue || {});
  state.hands = Array.isArray(state.hands) ? state.hands.map((hand) => ({ count: Array.isArray(hand) ? hand.length : 0 })) : [];
  state.decks = Object.fromEntries(Object.entries(state.decks || {}).map(([deckId, deck]) => {
    const cards = Array.isArray(deck) ? deck : [];
    return [deckId, { count: cards.length, top: cards.at(-1) ? clone(cards.at(-1)) : null }];
  }));
  state.personalDecks = Array.isArray(state.personalDecks)
    ? state.personalDecks.map((decks) => Object.fromEntries(Object.entries(decks || {}).map(([deckId, deck]) => [deckId, { count: Array.isArray(deck) ? deck.length : 0 }])))
    : [];
  state.personalDiscardPiles = Array.isArray(state.personalDiscardPiles)
    ? state.personalDiscardPiles.map((decks) => Object.fromEntries(Object.entries(decks || {}).map(([deckId, deck]) => [deckId, { count: Array.isArray(deck) ? deck.length : 0 }])))
    : [];
  state.draftDecks = Object.fromEntries(Object.entries(state.draftDecks || {}).map(([deckId, ageDecks]) => [
    deckId,
    Array.isArray(ageDecks) ? ageDecks.map((cards) => ({ count: Array.isArray(cards) ? cards.length : 0 })) : []
  ]));
  delete state.privateValues;
  delete state.privateState;
  delete state.hiddenObjectives;
  delete state.objectiveResults;
  delete state.privateRevealed;
  delete state.teamRevealed;
  delete state.responseStack;
  if (state.pendingResponseWindow) {
    const window = state.pendingResponseWindow;
    state.pendingResponseWindow = {
      id: window.id,
      sourceActionId: window.sourceActionId,
      sourceSeatIndex: window.sourceSeatIndex,
      targetId: window.targetId,
      actionIds: Array.isArray(window.actionIds) ? [...window.actionIds] : [],
      eligibleSeatIndexes: Array.isArray(window.eligibleSeatIndexes) ? [...window.eligibleSeatIndexes] : [],
      submittedSeatIndexes: Object.keys(window.submissions || {}).map((seatIndex) => Number(seatIndex)).filter(Number.isInteger),
      depth: Number.isInteger(window.depth) ? window.depth : 0,
      openedAt: window.openedAt,
      deadlineAt: window.deadlineAt,
      timeoutSeconds: window.timeoutSeconds
    };
  }
  if (!state.resolved && state.submissions && typeof state.submissions === "object") {
    state.submissions = Object.fromEntries(Object.entries(state.submissions).map(([seatIndex]) => [seatIndex, { seatIndex: Number(seatIndex), submitted: true }]));
  }
  state.factionState = Array.isArray(state.factionState) ? state.factionState.map((faction) => ({ id: faction?.id || "" })) : [];
  state.responseEvents = visibleResponseEvents(stateValue);
  return state;
}

export function projectBoardGameViewerState(stateValue, seatIndexValue = 0) {
  const state = projectBoardGamePublicState(stateValue);
  const seatIndex = integer(seatIndexValue, 0, 0, Math.max(0, (stateValue?.seatCount || 1) - 1));
  const ownHand = Array.isArray(stateValue?.hands?.[seatIndex]) ? clone(stateValue.hands[seatIndex]) : [];
  const ownTableau = Array.isArray(stateValue?.tableaus?.[seatIndex]) ? clone(stateValue.tableaus[seatIndex]) : [];
  const ownRemovedCards = Array.isArray(stateValue?.removedCards?.[seatIndex]) ? clone(stateValue.removedCards[seatIndex]) : [];
  const ownRevealed = Array.isArray(stateValue?.privateRevealed?.[seatIndex]) ? clone(stateValue.privateRevealed[seatIndex]) : [];
  const teamId = stateValue?.teamAssignments?.[seatIndex];
  const teamRevealed = teamId && Array.isArray(stateValue?.teamRevealed?.[teamId]) ? clone(stateValue.teamRevealed[teamId]) : [];
  state.responseEvents = visibleResponseEvents(stateValue, seatIndex);
  state.viewer = {
    seatIndex,
    hand: ownHand,
    tableau: ownTableau,
    removedCards: ownRemovedCards,
    revealed: [...ownRevealed, ...teamRevealed, ...(Array.isArray(stateValue?.revealed) ? clone(stateValue.revealed) : [])],
    teamId: teamId || `team-${seatIndex + 1}`,
    hiddenObjectives: clone(stateValue?.hiddenObjectives?.[seatIndex] || []),
    objectiveResults: clone(stateValue?.objectiveResults?.[seatIndex] || []),
    faction: clone(stateValue?.factionState?.[seatIndex] || { id: "", flags: {}, counters: {} }),
    personalDecks: clone(stateValue?.personalDecks?.[seatIndex] || {}),
    personalDiscardPiles: clone(stateValue?.personalDiscardPiles?.[seatIndex] || {}),
    responseSubmission: clone(stateValue?.pendingResponseWindow?.submissions?.[String(seatIndex)] || null),
    responseEligible: Boolean(stateValue?.pendingResponseWindow?.eligibleSeatIndexes?.includes(seatIndex))
  };
  return state;
}

export function createBoardGameOnlineSnapshot(design, stateValue, options = {}) {
  const state = clone(stateValue || {});
  const revision = integer(options.revision ?? state.sequence, 0, 0, 1_000_000_000);
  const responseDeadline = state.pendingResponseWindow
    ? { startedAt: state.pendingResponseWindow.openedAt, deadlineAt: state.pendingResponseWindow.deadlineAt }
    : null;
  return {
    protocolVersion: BOARD_GAME_ONLINE_PROTOCOL_VERSION,
    designSignature: boardGameEngineSignature(design),
    catalog: projectBoardGameCatalog(design),
    revision,
    serverNow: integer(options.serverNow, Date.now(), 0, 9_999_999_999_999),
    deadline: responseDeadline || (options.deadline ? clone(options.deadline) : null),
    publicState: projectBoardGamePublicState(state),
    viewerStates: Array.from({ length: state.seatCount || 0 }, (_, seatIndex) => projectBoardGameViewerState(state, seatIndex))
  };
}

export function applyBoardGameOnlineCommand(design, stateValue, commandValue, options = {}) {
  const command = normalizeBoardGameOnlineCommand(commandValue);
  const expectedSignature = boardGameEngineSignature(design);
  if (!command.commandId) return { ok: false, code: "COMMAND_ID_MISSING", message: "同步命令缺少唯一 ID。", state: stateValue };
  if (command.designSignature !== expectedSignature) return { ok: false, code: "DESIGN_SIGNATURE_MISMATCH", message: "命令对应的桌游版本已过期。", state: stateValue };
  const serverNow = Number(options.serverNow ?? Date.now());
  const deadlineAt = Number(options.deadline?.deadlineAt);
  if (command.commandType === "action" && Number.isFinite(deadlineAt) && Number.isFinite(serverNow) && serverNow > deadlineAt) {
    return { ok: false, code: "DEADLINE_EXPIRED", message: "本阶段已超时，命令不能再写入。", state: stateValue };
  }
  if (stateValue?.online?.lastCommandId === command.commandId) {
    return { ok: true, duplicate: true, state: stateValue, snapshot: createBoardGameOnlineSnapshot(design, stateValue, options) };
  }
  const result = command.commandType === "advance"
    ? advanceBoardGameRuntime(design, stateValue)
    : command.commandType === "timeout"
      ? (stateValue?.pendingResponseWindow
        ? expireBoardGameResponseWindow(design, stateValue, serverNow)
        : expireBoardGamePhase(design, stateValue, serverNow))
      : executeBoardGameAction(design, stateValue, { ...command, serverNow });
  if (!result.ok) return { ...result, state: stateValue };
  const state = clone(result.state);
  state.online = {
    protocolVersion: BOARD_GAME_ONLINE_PROTOCOL_VERSION,
    revision: integer(stateValue?.online?.revision, 0, 0, 1_000_000_000) + 1,
    lastCommandId: command.commandId,
    lastClientSequence: command.clientSequence,
    deadline: state.pendingResponseWindow
      ? { startedAt: state.pendingResponseWindow.openedAt, deadlineAt: state.pendingResponseWindow.deadlineAt }
      : stateValue?.online?.deadline || options.deadline || null
  };
  return {
    ok: true,
    state,
    event: { eventId: `${command.commandId}:${state.online.revision}`, commandId: command.commandId, revision: state.online.revision },
    snapshot: createBoardGameOnlineSnapshot(design, state, { ...options, revision: state.online.revision })
  };
}
