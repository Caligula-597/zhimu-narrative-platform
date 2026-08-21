export const TABLETOP_SYSTEM_VERSION = 2;

export const COMMON_DICE_SIDES = Object.freeze([4, 6, 8, 10, 12, 20, 100]);

export const COMMON_COMBAT_CONDITIONS = Object.freeze([
  "专注",
  "防御",
  "隐匿",
  "中毒",
  "燃烧",
  "眩晕",
  "束缚",
  "倒地"
]);

export const TABLETOP_CHECK_DEGREES = Object.freeze({
  critical_success: Object.freeze({ id: "critical_success", label: "大成功", rank: 3, success: true }),
  strong_success: Object.freeze({ id: "strong_success", label: "强成功", rank: 2, success: true }),
  success: Object.freeze({ id: "success", label: "成功", rank: 1, success: true }),
  failure: Object.freeze({ id: "failure", label: "失败", rank: -1, success: false }),
  severe_failure: Object.freeze({ id: "severe_failure", label: "严重失败", rank: -2, success: false }),
  critical_failure: Object.freeze({ id: "critical_failure", label: "大失败", rank: -3, success: false })
});

export const DEFAULT_COMBAT_STATS = Object.freeze({
  maxHp: 24,
  hp: 24,
  attack: 3,
  defense: 3,
  damage: 5,
  initiative: 2
});

function clamp(value, min, max, fallback = min) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function integer(value, min, max, fallback = min) {
  return Math.round(clamp(value, min, max, fallback));
}

function cleanText(value, fallback = "", max = 120) {
  const text = String(value ?? "").trim();
  return (text || fallback).slice(0, max);
}

function cleanId(value, fallback = "combatant") {
  const id = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return id || fallback;
}

export function classifyTabletopCheck(value = {}) {
  if (value.criticalSuccess) return TABLETOP_CHECK_DEGREES.critical_success;
  if (value.criticalFailure) return TABLETOP_CHECK_DEGREES.critical_failure;
  const margin = integer(value.margin, -9999, 9999, 0);
  if (margin >= 5) return TABLETOP_CHECK_DEGREES.strong_success;
  if (margin >= 0) return TABLETOP_CHECK_DEGREES.success;
  if (margin >= -4) return TABLETOP_CHECK_DEGREES.failure;
  return TABLETOP_CHECK_DEGREES.severe_failure;
}

function uniqueId(candidate, fallback, usedIds) {
  const base = cleanId(candidate, fallback);
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

export function normalizeDiceConfig(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    count: integer(source.count, 1, 10, 1),
    sides: integer(source.sides, 2, 1000, 20),
    modifier: integer(source.modifier, -999, 999, 0),
    defaultTarget: integer(source.defaultTarget, -9999, 9999, 12)
  };
}

export function normalizeCombatantStats(value = {}, defaults = DEFAULT_COMBAT_STATS) {
  const source = value && typeof value === "object" ? value : {};
  const base = defaults && typeof defaults === "object" ? defaults : DEFAULT_COMBAT_STATS;
  const maxHp = integer(source.maxHp, 1, 9999, integer(base.maxHp, 1, 9999, 24));
  return {
    maxHp,
    hp: integer(source.hp, 0, maxHp, Math.min(maxHp, integer(base.hp, 0, maxHp, maxHp))),
    attack: integer(source.attack, -99, 999, integer(base.attack, -99, 999, 3)),
    defense: integer(source.defense, -9, 999, integer(base.defense, -9, 999, 3)),
    damage: integer(source.damage, 1, 999, integer(base.damage, 1, 999, 5)),
    initiative: integer(source.initiative, -99, 999, integer(base.initiative, -99, 999, 2))
  };
}

function normalizeCombatantCondition(value = {}, index = 0) {
  const source = typeof value === "string" ? { label: value } : value && typeof value === "object" ? value : {};
  return {
    id: cleanId(source.id, `status-${index + 1}`),
    label: cleanText(source.label, "状态", 40),
    rounds: integer(source.rounds, 1, 99, 1)
  };
}

function normalizeCombatant(value = {}, fallback = {}, usedIds = new Set(), index = 0, prefix = "npc") {
  const stats = normalizeCombatantStats(value.stats || value, fallback.stats || fallback);
  const conditions = Array.isArray(value.conditions)
    ? value.conditions.slice(0, 8).map(normalizeCombatantCondition)
    : [];
  return {
    id: uniqueId(value.id, fallback.id || `${prefix}-${index + 1}`, usedIds),
    name: cleanText(value.name, fallback.name || `${prefix === "pc" ? "玩家" : "NPC"} ${index + 1}`, 60),
    role: cleanText(value.role, fallback.role || "中立角色", 80),
    notes: cleanText(value.notes, fallback.notes || "", 360),
    conditions,
    ...stats
  };
}

export function createDefaultTabletopSystem() {
  const usedIds = new Set();
  const players = [
    normalizeCombatant({
      id: "party",
      name: "玩家队伍",
      role: "测试角色",
      notes: "用于创作者快速模拟检定与战斗。",
      maxHp: 30,
      hp: 30,
      attack: 4,
      defense: 4,
      damage: 6,
      initiative: 3
    }, {}, usedIds, 0, "pc")
  ];
  return {
    version: TABLETOP_SYSTEM_VERSION,
    dice: normalizeDiceConfig(),
    players,
    player: players[0],
    npcs: [
      normalizeCombatant({ id: "dock-guard", name: "雾港守卫", role: "普通敌对 NPC", maxHp: 18, hp: 18, attack: 3, defense: 2, damage: 4, initiative: 1 }, {}, usedIds, 0, "npc"),
      normalizeCombatant({ id: "fog-priest", name: "雾祭司", role: "精英 NPC", maxHp: 28, hp: 28, attack: 5, defense: 4, damage: 7, initiative: 4 }, {}, usedIds, 1, "npc")
    ],
    combat: {
      targetNpcId: "dock-guard",
      targetId: "dock-guard",
      encounterLocationId: "",
      activeNpcIds: ["dock-guard", "fog-priest"],
      initiativeOrder: [],
      initiativeRolls: {},
      activeIndex: 0,
      started: false,
      outcome: "",
      outcomeApplied: false,
      round: 1,
      turn: "player",
      log: [],
      lastCheck: null
    }
  };
}

function normalizeCheckResult(value) {
  if (!value || typeof value !== "object") return null;
  const rolls = Array.isArray(value.rolls)
    ? value.rolls.slice(0, 10).map((roll) => integer(roll, 1, 1000, 1))
    : [];
  if (!rolls.length) return null;
  const attempts = Array.isArray(value.attempts)
    ? value.attempts.slice(0, 2).map((attempt) => Array.isArray(attempt)
      ? attempt.slice(0, 10).map((roll) => integer(roll, 1, 1000, 1))
      : []).filter((attempt) => attempt.length)
    : [];
  const criticalSuccess = Boolean(value.criticalSuccess);
  const criticalFailure = Boolean(value.criticalFailure);
  const margin = integer(value.margin, -9999, 9999, 0);
  const degree = classifyTabletopCheck({ criticalSuccess, criticalFailure, margin });
  return {
    label: cleanText(value.label, "随机检定", 80),
    rollMode: ["advantage", "disadvantage"].includes(value.rollMode) ? value.rollMode : "normal",
    attempts,
    rolls,
    rawTotal: integer(value.rawTotal, -9999, 9999, 0),
    total: integer(value.total, -9999, 9999, 0),
    target: integer(value.target, -9999, 9999, 0),
    success: degree.success,
    criticalSuccess,
    criticalFailure,
    margin,
    degree: degree.id,
    degreeLabel: degree.label,
    degreeRank: degree.rank
  };
}

export function normalizeTabletopSystem(value = {}) {
  const fallback = createDefaultTabletopSystem();
  const source = value && typeof value === "object" ? value : {};
  const usedIds = new Set();
  const legacyPlayer = source.player && typeof source.player === "object" ? source.player : fallback.player;
  const playerSource = Array.isArray(source.players) && source.players.length
    ? source.players.slice(0, 12)
    : [{ ...legacyPlayer, id: legacyPlayer.id || "party" }];
  const players = playerSource.map((player, index) => normalizeCombatant(
    player,
    index === 0 ? fallback.player : {},
    usedIds,
    index,
    "pc"
  ));
  const player = players[0];
  const npcSource = Array.isArray(source.npcs) ? source.npcs.slice(0, 24) : fallback.npcs;
  const npcs = npcSource.map((npc, index) => normalizeCombatant(npc, fallback.npcs[index] || {}, usedIds, index, "npc"));
  const combatSource = source.combat && typeof source.combat === "object" ? source.combat : {};
  const targetNpcId = npcs.some((npc) => npc.id === combatSource.targetNpcId)
    ? combatSource.targetNpcId
    : npcs[0]?.id || "";
  const participantIds = new Set([...players, ...npcs].map((combatant) => combatant.id));
  const activeNpcIds = [...new Set(Array.isArray(combatSource.activeNpcIds)
    ? combatSource.activeNpcIds.map(String).filter((id) => npcs.some((npc) => npc.id === id))
    : npcs.map((npc) => npc.id))];
  const initiativeOrder = [...new Set(Array.isArray(combatSource.initiativeOrder)
    ? combatSource.initiativeOrder.map(String).filter((id) => participantIds.has(id))
    : [])];
  const activeIndex = initiativeOrder.length
    ? integer(combatSource.activeIndex, 0, initiativeOrder.length - 1, 0)
    : 0;
  const activeId = initiativeOrder[activeIndex] || "";
  const targetId = participantIds.has(combatSource.targetId)
    ? combatSource.targetId
    : targetNpcId || players[0]?.id || "";
  const initiativeRolls = Object.fromEntries(initiativeOrder.map((id) => [
    id,
    integer(combatSource.initiativeRolls?.[id], -9999, 9999, 0)
  ]));
  const log = Array.isArray(combatSource.log)
    ? combatSource.log.slice(-30).map((entry) => ({
      id: cleanText(entry?.id, `log-${Date.now()}`, 80),
      round: integer(entry?.round, 1, 9999, 1),
      text: cleanText(entry?.text, "完成一次行动。", 240),
      tone: ["success", "danger", "neutral"].includes(entry?.tone) ? entry.tone : "neutral"
    }))
    : [];
  return {
    version: TABLETOP_SYSTEM_VERSION,
    dice: normalizeDiceConfig(source.dice),
    players,
    player,
    npcs,
    combat: {
      targetNpcId,
      targetId,
      encounterLocationId: cleanId(combatSource.encounterLocationId, ""),
      activeNpcIds,
      initiativeOrder,
      initiativeRolls,
      activeIndex,
      started: Boolean(combatSource.started && initiativeOrder.length),
      outcome: ["victory", "defeat"].includes(combatSource.outcome) ? combatSource.outcome : "",
      outcomeApplied: Boolean(combatSource.outcomeApplied),
      round: integer(combatSource.round, 1, 9999, 1),
      turn: activeId && npcs.some((npc) => npc.id === activeId)
        ? "npc"
        : combatSource.turn === "npc" ? "npc" : "player",
      log,
      lastCheck: normalizeCheckResult(combatSource.lastCheck)
    }
  };
}

export function rollTabletopCheck(diceConfig, options = {}, random = Math.random) {
  const dice = normalizeDiceConfig(diceConfig);
  const bonus = integer(options.bonus, -999, 999, 0);
  const target = integer(options.target, -9999, 9999, dice.defaultTarget);
  const rollMode = ["advantage", "disadvantage"].includes(options.rollMode) ? options.rollMode : "normal";
  const rollPool = () => Array.from({ length: dice.count }, () => {
    const sample = clamp(random(), 0, 0.999999999, 0);
    return Math.floor(sample * dice.sides) + 1;
  });
  const attempts = Array.from({ length: rollMode === "normal" ? 1 : 2 }, rollPool);
  const rawTotals = attempts.map((attempt) => attempt.reduce((sum, roll) => sum + roll, 0));
  const selectedIndex = rollMode === "advantage"
    ? (rawTotals[1] > rawTotals[0] ? 1 : 0)
    : rollMode === "disadvantage"
      ? (rawTotals[1] < rawTotals[0] ? 1 : 0)
      : 0;
  const rolls = attempts[selectedIndex];
  const rawTotal = rolls.reduce((sum, roll) => sum + roll, 0);
  const total = rawTotal + dice.modifier + bonus;
  const criticalSuccess = dice.count === 1 && rolls[0] === dice.sides;
  const criticalFailure = dice.count === 1 && rolls[0] === 1;
  const success = criticalSuccess || (!criticalFailure && total >= target);
  const margin = total - target;
  const degree = classifyTabletopCheck({ criticalSuccess, criticalFailure, margin });
  return {
    label: cleanText(options.label, "随机检定", 80),
    rollMode,
    attempts,
    rolls,
    rawTotal,
    total,
    target,
    success,
    criticalSuccess,
    criticalFailure,
    margin,
    degree: degree.id,
    degreeLabel: degree.label,
    degreeRank: degree.rank
  };
}

function allCombatants(system) {
  return [...system.players, ...system.npcs];
}

function combatantById(system, id) {
  return allCombatants(system).find((combatant) => combatant.id === id) || null;
}

function isNpc(system, id) {
  return system.npcs.some((npc) => npc.id === id);
}

function pushCombatLog(system, text, tone = "neutral") {
  system.combat.log.push({
    id: `combat-${Date.now()}-${system.combat.log.length + 1}`,
    round: system.combat.round,
    text,
    tone
  });
  system.combat.log = system.combat.log.slice(-30);
}

function activeEncounterNpcs(system) {
  const activeIds = new Set(system.combat.activeNpcIds);
  return system.npcs.filter((npc) => activeIds.has(npc.id));
}

function updateCombatOutcome(system) {
  const encounterNpcs = activeEncounterNpcs(system);
  const previous = system.combat.outcome;
  if (system.players.length && system.players.every((player) => player.hp <= 0)) {
    system.combat.outcome = "defeat";
  } else if (encounterNpcs.length && encounterNpcs.every((npc) => npc.hp <= 0)) {
    system.combat.outcome = "victory";
  } else {
    system.combat.outcome = "";
  }
  if (previous !== system.combat.outcome) system.combat.outcomeApplied = false;
  if (!previous && system.combat.outcome) {
    pushCombatLog(
      system,
      system.combat.outcome === "victory" ? "遭遇结束：玩家队伍获胜。" : "遭遇结束：玩家队伍失去战斗能力。",
      system.combat.outcome === "victory" ? "success" : "danger"
    );
  }
  return system.combat.outcome;
}

function validTargetsFor(system, actorId) {
  if (isNpc(system, actorId)) return system.players.filter((player) => player.hp > 0);
  return activeEncounterNpcs(system).filter((npc) => npc.hp > 0);
}

function syncCombatTarget(system) {
  const activeId = system.combat.initiativeOrder[system.combat.activeIndex] || system.players[0]?.id || "";
  const candidates = validTargetsFor(system, activeId);
  if (!candidates.some((combatant) => combatant.id === system.combat.targetId)) {
    system.combat.targetId = candidates[0]?.id || "";
  }
  const targetNpc = system.npcs.find((npc) => npc.id === system.combat.targetId)
    || activeEncounterNpcs(system).find((npc) => npc.hp > 0)
    || system.npcs[0];
  system.combat.targetNpcId = targetNpc?.id || "";
  system.combat.turn = isNpc(system, activeId) ? "npc" : "player";
}

export function tabletopCombatState(value) {
  const system = normalizeTabletopSystem(value);
  syncCombatTarget(system);
  const order = system.combat.initiativeOrder
    .map((id) => combatantById(system, id))
    .filter(Boolean);
  return {
    system,
    order,
    active: combatantById(system, system.combat.initiativeOrder[system.combat.activeIndex]),
    target: combatantById(system, system.combat.targetId),
    outcome: system.combat.outcome
  };
}

export function startTabletopCombat(value, options = {}, random = Math.random) {
  const system = normalizeTabletopSystem(value);
  const requestedNpcIds = Array.isArray(options.npcIds) ? options.npcIds.map(String) : [];
  const activeNpcIds = requestedNpcIds.length
    ? requestedNpcIds.filter((id) => system.npcs.some((npc) => npc.id === id))
    : system.npcs.map((npc) => npc.id);
  const requestedPlayerIds = Array.isArray(options.playerIds) ? options.playerIds.map(String) : [];
  const players = system.players.filter((player) => !requestedPlayerIds.length || requestedPlayerIds.includes(player.id));
  const npcs = system.npcs.filter((npc) => activeNpcIds.includes(npc.id));
  const availablePlayers = players.filter((combatant) => combatant.hp > 0);
  const availableNpcs = npcs.filter((combatant) => combatant.hp > 0);
  const participants = [...availablePlayers, ...availableNpcs];
  if (!availablePlayers.length || !availableNpcs.length) {
    return { system, started: false };
  }
  const initiativeRolls = Object.fromEntries(participants.map((combatant) => {
    const roll = rollTabletopCheck(system.dice, {
      label: `${combatant.name}先攻`,
      bonus: combatant.initiative,
      target: 0
    }, random);
    return [combatant.id, roll.total];
  }));
  const initiativeOrder = [...participants]
    .sort((a, b) => initiativeRolls[b.id] - initiativeRolls[a.id]
      || b.initiative - a.initiative
      || a.name.localeCompare(b.name, "zh-CN"))
    .map((combatant) => combatant.id);
  system.combat = {
    targetNpcId: npcs[0].id,
    targetId: npcs[0].id,
    encounterLocationId: cleanId(options.locationId, ""),
    activeNpcIds,
    initiativeOrder,
    initiativeRolls,
    activeIndex: 0,
    started: true,
    outcome: "",
    outcomeApplied: false,
    round: 1,
    turn: "player",
    log: [],
    lastCheck: null
  };
  syncCombatTarget(system);
  pushCombatLog(
    system,
    `遭遇开始。先攻顺序：${initiativeOrder.map((id) => `${combatantById(system, id)?.name} ${initiativeRolls[id]}`).join(" → ")}。`
  );
  return { system: normalizeTabletopSystem(system), started: true };
}

export function advanceTabletopTurn(value, { message = "", tone = "neutral" } = {}) {
  const system = normalizeTabletopSystem(value);
  if (!system.combat.started || system.combat.outcome || !system.combat.initiativeOrder.length) return system;
  const activeId = system.combat.initiativeOrder[system.combat.activeIndex];
  const active = combatantById(system, activeId);
  if (message) pushCombatLog(system, message, tone);
  if (active?.conditions?.length) {
    active.conditions = active.conditions
      .map((condition) => ({ ...condition, rounds: condition.rounds - 1 }))
      .filter((condition) => condition.rounds > 0);
  }
  const oldIndex = system.combat.activeIndex;
  let nextIndex = oldIndex;
  for (let step = 1; step <= system.combat.initiativeOrder.length; step += 1) {
    const candidateIndex = (oldIndex + step) % system.combat.initiativeOrder.length;
    const candidate = combatantById(system, system.combat.initiativeOrder[candidateIndex]);
    if (candidate?.hp > 0) {
      nextIndex = candidateIndex;
      break;
    }
  }
  if (nextIndex <= oldIndex) system.combat.round += 1;
  system.combat.activeIndex = nextIndex;
  syncCombatTarget(system);
  return normalizeTabletopSystem(system);
}

export function skipTabletopTurn(value) {
  const state = tabletopCombatState(value);
  if (!state.active) return state.system;
  return advanceTabletopTurn(state.system, { message: `${state.active.name}结束了当前回合。` });
}

export function resolveTabletopAttack(value, attackerId, defenderId, random = Math.random) {
  const system = normalizeTabletopSystem(value);
  const attacker = combatantById(system, attackerId);
  const defender = combatantById(system, defenderId);
  const activeId = system.combat.initiativeOrder[system.combat.activeIndex];
  const invalidTurn = system.combat.started && activeId !== attackerId;
  const sameSide = attacker && defender && isNpc(system, attacker.id) === isNpc(system, defender.id);
  if (!attacker || !defender || attacker.id === defender.id || attacker.hp <= 0 || defender.hp <= 0 || invalidTurn || sameSide) {
    return { system, result: null };
  }
  const target = 10 + defender.defense;
  const check = rollTabletopCheck(system.dice, {
    label: `${attacker.name}攻击${defender.name}`,
    bonus: attacker.attack,
    target
  }, random);
  const degreeBonus = Math.max(0, Math.floor(check.margin / 5));
  const damage = check.success ? Math.max(1, attacker.damage + degreeBonus) * (check.criticalSuccess ? 2 : 1) : 0;
  defender.hp = Math.max(0, defender.hp - damage);
  const defeated = defender.hp <= 0;
  const text = check.success
    ? `${attacker.name}命中 ${defender.name}（${check.degreeLabel}），造成 ${damage} 点伤害${defeated ? "，目标失去战斗能力" : ""}。`
    : `${attacker.name}攻击未命中 ${defender.name}（${check.degreeLabel}）。`;
  const result = {
    attackerId: attacker.id,
    defenderId: defender.id,
    damage,
    defeated,
    defenderHp: defender.hp,
    check,
    text
  };
  system.combat.lastCheck = check;
  pushCombatLog(system, text, check.success ? "success" : "neutral");
  const outcome = updateCombatOutcome(system);
  if (system.combat.started && !outcome) {
    return { system: advanceTabletopTurn(system), result };
  }
  if (!system.combat.started) {
    if (isNpc(system, attacker.id)) {
      system.combat.turn = "player";
      system.combat.round += 1;
    } else {
      system.combat.turn = "npc";
    }
  }
  return { system: normalizeTabletopSystem(system), result };
}

export function applyTabletopHpChange(value, combatantId, delta) {
  const system = normalizeTabletopSystem(value);
  const combatant = combatantById(system, combatantId);
  if (!combatant) return { system, changed: 0 };
  const before = combatant.hp;
  combatant.hp = integer(before + Number(delta || 0), 0, combatant.maxHp, before);
  const changed = combatant.hp - before;
  if (changed) {
    pushCombatLog(
      system,
      changed > 0 ? `${combatant.name}恢复 ${changed} 点 HP。` : `${combatant.name}承受 ${Math.abs(changed)} 点额外伤害。`,
      changed > 0 ? "success" : "danger"
    );
  }
  updateCombatOutcome(system);
  return { system: normalizeTabletopSystem(system), changed };
}

export function addTabletopCondition(value, combatantId, condition = {}) {
  const system = normalizeTabletopSystem(value);
  const combatant = combatantById(system, combatantId);
  if (!combatant) return system;
  const normalized = normalizeCombatantCondition({
    ...condition,
    id: condition.id || `status-${Date.now().toString(36)}`
  }, combatant.conditions.length);
  combatant.conditions = [
    ...combatant.conditions.filter((item) => item.label !== normalized.label),
    normalized
  ].slice(-8);
  pushCombatLog(system, `${combatant.name}获得状态「${normalized.label}」(${normalized.rounds} 回合)。`);
  return normalizeTabletopSystem(system);
}

export function removeTabletopCondition(value, combatantId, conditionId) {
  const system = normalizeTabletopSystem(value);
  const combatant = combatantById(system, combatantId);
  if (!combatant) return system;
  combatant.conditions = combatant.conditions.filter((condition) => condition.id !== conditionId);
  return normalizeTabletopSystem(system);
}

export function resetTabletopCombat(value) {
  const system = normalizeTabletopSystem(value);
  system.players = system.players.map((player) => ({ ...player, hp: player.maxHp, conditions: [] }));
  system.player = system.players[0];
  system.npcs = system.npcs.map((npc) => ({ ...npc, hp: npc.maxHp, conditions: [] }));
  system.combat = {
    targetNpcId: system.npcs[0]?.id || "",
    targetId: system.npcs[0]?.id || "",
    encounterLocationId: "",
    activeNpcIds: system.npcs.map((npc) => npc.id),
    initiativeOrder: [],
    initiativeRolls: {},
    activeIndex: 0,
    started: false,
    outcome: "",
    outcomeApplied: false,
    round: 1,
    turn: "player",
    log: [],
    lastCheck: null
  };
  return normalizeTabletopSystem(system);
}
