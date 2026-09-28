const clone = (value) => structuredClone(value);

const KINGDOM_IDS = Object.freeze([
  "cellar", "chapel", "moat", "harbinger", "merchant", "village", "workshop", "bureaucrat", "gardens", "militia",
  "moneylender", "poacher", "remodel", "smithy", "throne-room", "bandit", "council-room", "festival", "laboratory", "library",
  "market", "mine", "sentry", "vassal", "witch", "artisan"
]);

const CARD_DEFS = Object.freeze({
  copper: { id: "copper", name: "Copper", types: ["treasure"], cost: 0, coins: 1 },
  silver: { id: "silver", name: "Silver", types: ["treasure"], cost: 3, coins: 2 },
  gold: { id: "gold", name: "Gold", types: ["treasure"], cost: 6, coins: 3 },
  estate: { id: "estate", name: "Estate", types: ["victory"], cost: 2, vp: 1 },
  duchy: { id: "duchy", name: "Duchy", types: ["victory"], cost: 5, vp: 3 },
  province: { id: "province", name: "Province", types: ["victory"], cost: 8, vp: 6 },
  curse: { id: "curse", name: "Curse", types: ["curse", "victory"], cost: 0, vp: -1 },
  cellar: { id: "cellar", name: "Cellar", types: ["action"], cost: 2, action: "cellar" },
  chapel: { id: "chapel", name: "Chapel", types: ["action"], cost: 2, action: "chapel" },
  moat: { id: "moat", name: "Moat", types: ["action", "reaction"], cost: 2, action: "moat" },
  harbinger: { id: "harbinger", name: "Harbinger", types: ["action"], cost: 3, action: "harbinger" },
  merchant: { id: "merchant", name: "Merchant", types: ["action"], cost: 3, action: "merchant" },
  village: { id: "village", name: "Village", types: ["action"], cost: 3, action: "village" },
  workshop: { id: "workshop", name: "Workshop", types: ["action"], cost: 3, action: "workshop" },
  bureaucrat: { id: "bureaucrat", name: "Bureaucrat", types: ["action", "attack"], cost: 4, action: "bureaucrat" },
  gardens: { id: "gardens", name: "Gardens", types: ["victory"], cost: 4, vpPerCards: 10 },
  militia: { id: "militia", name: "Militia", types: ["action", "attack"], cost: 4, action: "militia" },
  moneylender: { id: "moneylender", name: "Moneylender", types: ["action"], cost: 4, action: "moneylender" },
  poacher: { id: "poacher", name: "Poacher", types: ["action"], cost: 4, action: "poacher" },
  remodel: { id: "remodel", name: "Remodel", types: ["action"], cost: 4, action: "remodel" },
  smithy: { id: "smithy", name: "Smithy", types: ["action"], cost: 4, action: "smithy" },
  "throne-room": { id: "throne-room", name: "Throne Room", types: ["action"], cost: 4, action: "throne-room" },
  bandit: { id: "bandit", name: "Bandit", types: ["action", "attack"], cost: 5, action: "bandit" },
  "council-room": { id: "council-room", name: "Council Room", types: ["action"], cost: 5, action: "council-room" },
  festival: { id: "festival", name: "Festival", types: ["action"], cost: 5, action: "festival" },
  laboratory: { id: "laboratory", name: "Laboratory", types: ["action"], cost: 5, action: "laboratory" },
  library: { id: "library", name: "Library", types: ["action"], cost: 5, action: "library" },
  market: { id: "market", name: "Market", types: ["action"], cost: 5, action: "market" },
  mine: { id: "mine", name: "Mine", types: ["action"], cost: 5, action: "mine" },
  sentry: { id: "sentry", name: "Sentry", types: ["action"], cost: 5, action: "sentry" },
  vassal: { id: "vassal", name: "Vassal", types: ["action"], cost: 3, action: "vassal" },
  witch: { id: "witch", name: "Witch", types: ["action", "attack"], cost: 5, action: "witch" },
  artisan: { id: "artisan", name: "Artisan", types: ["action"], cost: 6, action: "artisan" }
});

const STARTING_DECK = Object.freeze(["copper", "copper", "copper", "copper", "copper", "copper", "copper", "estate", "estate", "estate"]);

function randomStep(state) {
  state.rng = (Math.imul(state.rng ^ (state.rng >>> 15), state.rng | 1) + 0x6D2B79F5) | 0;
  let value = Math.imul(state.rng ^ (state.rng >>> 7), state.rng | 61);
  value ^= value + Math.imul(value ^ (value >>> 14), 1 | value);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function shuffle(state, cards) {
  const output = cards.slice();
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomStep(state) * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

function card(cardId, uid) {
  const definition = CARD_DEFS[cardId];
  if (!definition) throw new Error(`UNKNOWN_CARD:${cardId}`);
  return { uid, cardId, name: definition.name };
}

function nextUid(state, cardId) {
  state.nextUid += 1;
  return `${cardId}-${state.nextUid}`;
}

function createCards(state, cardId, count) {
  return Array.from({ length: count }, () => card(cardId, nextUid(state, cardId)));
}

function definition(instance) {
  return CARD_DEFS[instance?.cardId] || CARD_DEFS[instance?.id] || null;
}

function hasType(instance, type) {
  return Boolean(definition(instance)?.types?.includes(type));
}

function removeCard(cards, uid) {
  const index = cards.findIndex((item) => item.uid === uid);
  if (index < 0) return null;
  return cards.splice(index, 1)[0];
}

function playerCards(player) {
  return [...player.deck, ...player.discard, ...player.hand, ...player.inPlay, ...player.setAside];
}

function allSupplyCards(state) {
  return Object.values(state.supply).reduce((sum, pile) => sum + pile.count, 0);
}

function emptySupplyPiles(state) {
  return Object.values(state.supply).filter((pile) => pile.count <= 0).length;
}

function drawCards(state, playerIndex, count) {
  const player = state.players[playerIndex];
  const drawn = [];
  for (let index = 0; index < count; index += 1) {
    if (!player.deck.length && player.discard.length) {
      player.deck = shuffle(state, player.discard.splice(0));
      state.log.push({ type: "shuffle", playerIndex });
    }
    if (!player.deck.length) break;
    drawn.push(player.deck.pop());
  }
  player.hand.push(...drawn);
  return drawn;
}

function discardHandCard(state, playerIndex, uid) {
  const player = state.players[playerIndex];
  const selected = removeCard(player.hand, uid);
  if (!selected) return false;
  player.discard.push(selected);
  return true;
}

function trashHandCard(state, playerIndex, uid) {
  const player = state.players[playerIndex];
  const selected = removeCard(player.hand, uid);
  if (!selected) return false;
  state.trash.push(selected);
  return true;
}

function gainCard(state, playerIndex, cardId, destination = "discard") {
  const pile = state.supply[cardId];
  if (!pile || pile.count <= 0) return { ok: false, code: "PILE_EMPTY", message: `牌堆 ${cardId} 已空。` };
  pile.count -= 1;
  const gained = card(cardId, nextUid(state, cardId));
  const player = state.players[playerIndex];
  if (destination === "hand") player.hand.push(gained);
  else if (destination === "deck") player.deck.push(gained);
  else player.discard.push(gained);
  state.log.push({ type: "gain", playerIndex, cardId, destination });
  return { ok: true, card: gained };
}

function createSupply(state, playerCount, kingdomIds) {
  const victoryCount = playerCount === 2 ? 8 : 12;
  const curseCount = playerCount === 2 ? 10 : playerCount === 3 ? 20 : 30;
  const supply = {};
  const add = (cardId, count) => { const def = CARD_DEFS[cardId]; supply[cardId] = { cardId, name: def.name, cost: def.cost, count }; };
  add("copper", 60);
  add("silver", 40);
  add("gold", 30);
  add("estate", victoryCount);
  add("duchy", victoryCount);
  add("province", victoryCount);
  add("curse", curseCount);
  for (const cardId of kingdomIds) add(cardId, 10);
  return supply;
}

function createPlayer(state, playerIndex) {
  const deck = STARTING_DECK.map((cardId) => card(cardId, nextUid(state, cardId)));
  return { playerIndex, deck: shuffle(state, deck), discard: [], hand: [], inPlay: [], setAside: [], turn: 0, actions: 0, buys: 0, coins: 0, phase: "waiting", pending: null, flags: {}, stats: { gained: 0, trashed: 0, actionsPlayed: 0 } };
}

function currentPlayer(state) {
  return state.players[state.activePlayerIndex];
}

function beginTurn(state) {
  const player = currentPlayer(state);
  player.turn += 1;
  player.actions = 1;
  player.buys = 1;
  player.coins = 0;
  player.phase = "action";
  state.phase = "action";
  player.flags = { playedSilver: false, merchantSilverBonus: 0 };
  state.turnNumber += 1;
  state.log.push({ type: "turn-start", playerIndex: player.playerIndex, turn: player.turn });
  return state;
}

function allCardsCount(player) {
  return playerCards(player).length;
}

function scorePlayer(player) {
  const count = allCardsCount(player);
  return playerCards(player).reduce((score, instance) => {
    const def = definition(instance);
    if (!def) return score;
    if (def.vpPerCards) return score + Math.floor(count / def.vpPerCards);
    return score + (def.vp || 0);
  }, 0);
}

function gameEnded(state) {
  return state.supply.province.count <= 0 || emptySupplyPiles(state) >= 3;
}

function finishIfNeeded(state) {
  if (!gameEnded(state)) return false;
  state.ended = true;
  state.phase = "ended";
  state.players.forEach((player) => { player.phase = "ended"; player.score = scorePlayer(player); });
  state.log.push({ type: "game-end", reason: state.supply.province.count <= 0 ? "province-empty" : "three-piles-empty" });
  return true;
}

function beginBuyPhase(state) {
  const player = currentPlayer(state);
  player.phase = "buy";
  state.phase = "buy";
}

function cleanUp(state) {
  const player = currentPlayer(state);
  player.discard.push(...player.hand.splice(0), ...player.inPlay.splice(0));
  player.phase = "waiting";
  state.phase = "waiting";
  if (finishIfNeeded(state)) return state;
  state.activePlayerIndex = (state.activePlayerIndex + 1) % state.players.length;
  beginTurn(state);
  if (!currentPlayer(state).hand.length) drawCards(state, state.activePlayerIndex, 5);
  return state;
}

function setPrompt(state, prompt) {
  const playerIndex = prompt.playerIndex ?? state.activePlayerIndex;
  state.players[playerIndex].pending = prompt;
  state.pendingPrompt = { ...prompt, playerIndex };
}

function clearPrompt(state) {
  if (state.pendingPrompt?.playerIndex !== undefined) state.players[state.pendingPrompt.playerIndex].pending = null;
  state.pendingPrompt = null;
}

function pushContinuation(state, continuation) {
  if (!state.continuations) state.continuations = [];
  state.continuations.push(continuation);
}

function resumeContinuations(state) {
  while (state.continuations?.length && !state.pendingPrompt && !state.attackQueue) {
    const continuation = state.continuations.pop();
    if (continuation.type !== "repeat-action") continue;
    const result = resolveAction(state, continuation.playerIndex, continuation.instance, continuation.action);
    if (!result.ok) return result;
    if (result.paused) {
      if (continuation.remaining > 1) pushContinuation(state, { ...continuation, remaining: continuation.remaining - 1 });
      return result;
    }
    if (continuation.remaining > 1) {
      pushContinuation(state, { ...continuation, remaining: continuation.remaining - 1 });
    }
  }
  return { ok: true, state };
}

function finishLibrary(state, playerIndex) {
  const player = state.players[playerIndex];
  player.discard.push(...player.setAside.splice(0));
  state.log.push({ type: "library-finished", playerIndex });
}

function continueLibrary(state, playerIndex) {
  const player = state.players[playerIndex];
  while (player.hand.length < 7) {
    const drawn = drawCards(state, playerIndex, 1)[0];
    if (!drawn) {
      finishLibrary(state, playerIndex);
      return { ok: true, state };
    }
    if (hasType(drawn, "action") || hasType(drawn, "reaction")) {
      setPrompt(state, { type: "select-library-card", playerIndex, cardId: drawn.uid, choices: ["keep", "set-aside"] });
      return { ok: true, paused: true, state };
    }
  }
  finishLibrary(state, playerIndex);
  return { ok: true, state };
}

function resolvePending(state, command) {
  const prompt = state.pendingPrompt;
  if (!prompt) return { ok: false, code: "NO_PROMPT", message: "当前没有待处理选择。" };
  const playerIndex = prompt.playerIndex;
  const player = state.players[playerIndex];
  const selectedIds = Array.isArray(command.cardIds) ? command.cardIds : command.cardId ? [command.cardId] : [];
  const hasDuplicateSelection = new Set(selectedIds).size !== selectedIds.length;
  if (prompt.type === "select-hand-discard") {
    if (hasDuplicateSelection) return { ok: false, code: "DUPLICATE_CARD_SELECTION", message: "同一张牌不能重复选择。" };
    if (selectedIds.length > prompt.max || (prompt.exact && selectedIds.length !== prompt.max)) return { ok: false, code: "DISCARD_COUNT", message: `需要弃置 ${prompt.max} 张牌。` };
    for (const uid of selectedIds) if (!player.hand.some((item) => item.uid === uid)) return { ok: false, code: "CARD_NOT_IN_HAND", message: "选择的牌不在手牌中。" };
    selectedIds.forEach((uid) => discardHandCard(state, playerIndex, uid));
    if (prompt.drawAfter === "discard-count") drawCards(state, playerIndex, selectedIds.length);
    else if (prompt.drawAfter) drawCards(state, playerIndex, prompt.drawAfter);
  } else if (prompt.type === "select-hand-trash") {
    if (hasDuplicateSelection) return { ok: false, code: "DUPLICATE_CARD_SELECTION", message: "同一张牌不能重复选择。" };
    if (selectedIds.length > prompt.max || (prompt.exact && selectedIds.length !== prompt.max)) return { ok: false, code: "TRASH_COUNT", message: `需要选择 ${prompt.max} 张牌。` };
    for (const uid of selectedIds) if (!player.hand.some((item) => item.uid === uid)) return { ok: false, code: "CARD_NOT_IN_HAND", message: "选择的牌不在手牌中。" };
    let trashedCost = 0;
    selectedIds.forEach((uid) => { const selected = player.hand.find((item) => item.uid === uid); if (selected) trashedCost = definition(selected).cost; if (trashHandCard(state, playerIndex, uid)) player.stats.trashed += 1; });
    if (prompt.remodel && selectedIds.length) { setPrompt(state, { type: "select-supply", maxCost: trashedCost + 2, destination: "discard" }); return { ok: true, state }; }
  } else if (prompt.type === "select-supply") {
    const pile = state.supply[command.cardId];
    if (!pile || pile.count <= 0 || pile.cost > prompt.maxCost) return { ok: false, code: "INVALID_SUPPLY_CHOICE", message: "不能获得这张牌。" };
    if (prompt.treasureOnly && !hasType(pile, "treasure")) return { ok: false, code: "TREASURE_REQUIRED", message: "这里只能获得宝藏牌。" };
    const gained = gainCard(state, playerIndex, command.cardId, prompt.destination || "discard");
    if (!gained.ok) return gained;
    player.stats.gained += 1;
    if (prompt.artisan) { clearPrompt(state); setPrompt(state, { type: "select-card-topdeck", choices: player.hand.map((item) => item.uid).concat("none") }); return { ok: true, state }; }
  } else if (prompt.type === "select-treasure-trash") {
    if (command.cardId === "none") {
      if (prompt.required) return { ok: false, code: "TREASURE_REQUIRED", message: "必须选择一张宝藏牌。" };
    } else {
      const selected = player.hand.find((item) => item.uid === command.cardId);
      if (!selected || !hasType(selected, "treasure") || (prompt.copperOnly && selected.cardId !== "copper")) return { ok: false, code: "TREASURE_REQUIRED", message: prompt.copperOnly ? "这里只能选择 Copper。" : "请选择手牌中的宝藏牌。" };
      const trashedCost = definition(selected).cost;
      trashHandCard(state, playerIndex, selected.uid);
      player.stats.trashed += 1;
      if (prompt.mine) { setPrompt(state, { type: "select-supply", maxCost: trashedCost + 3, destination: "hand", treasureOnly: true }); return { ok: true, state }; }
      if (prompt.moneylender && selected.cardId === "copper") player.coins += 3;
    }
  } else if (prompt.type === "select-card-topdeck") {
    if (command.cardId !== "none") {
      const selected = prompt.source === "discard"
        ? removeCard(player.discard, command.cardId)
        : removeCard(player.discard, command.cardId) || removeCard(player.hand, command.cardId);
      if (!selected) return { ok: false, code: "CARD_NOT_IN_HAND", message: "选择的牌不在手牌中。" };
      player.deck.push(selected);
    }
  } else if (prompt.type === "select-action-card") {
    if (command.cardId !== "none") {
      const selected = player.hand.find((item) => item.uid === command.cardId);
      if (!selected || !hasType(selected, "action")) return { ok: false, code: "ACTION_REQUIRED", message: "请选择手牌中的行动牌。" };
      const result = playAction(state, playerIndex, selected.uid, prompt.times || 1, true);
      if (!result.ok) return result;
    }
  } else if (prompt.type === "select-vassal-action") {
    if (command.cardId === "none") {
      const revealed = removeCard(player.hand, prompt.cardId);
      if (revealed) player.discard.push(revealed);
    } else {
      if (command.cardId !== prompt.cardId) return { ok: false, code: "VASSAL_REVEALED_CARD_REQUIRED", message: "Vassal 只能选择刚刚翻开的行动牌。" };
      const result = playAction(state, playerIndex, prompt.cardId, 1, true);
      if (!result.ok) return result;
    }
  } else if (prompt.type === "select-library-card") {
    if (command.cardId !== prompt.cardId) return { ok: false, code: "LIBRARY_REVEALED_CARD_REQUIRED", message: "请选择当前正在处理的牌。" };
    const selected = removeCard(player.hand, prompt.cardId);
    if (!selected) return { ok: false, code: "CARD_NOT_IN_HAND", message: "这张牌不在手牌中。" };
    if (command.choice === "set-aside") player.setAside.push(selected);
    else if (command.choice === "keep") player.hand.push(selected);
    else return { ok: false, code: "LIBRARY_CHOICE_REQUIRED", message: "请选择保留或暂放。" };
    clearPrompt(state);
    const result = continueLibrary(state, playerIndex);
    if (!result.ok || result.paused) return result;
    const continuationResult = resumeContinuations(state);
    return continuationResult.ok ? { ok: true, state } : continuationResult;
  } else if (prompt.type === "select-sentry-card") {
    const selected = prompt.cards.find((item) => item.uid === command.cardId);
    if (!selected) return { ok: false, code: "CARD_NOT_IN_REVEAL", message: "请选择正在查看的牌。" };
    if (!["trash", "discard", "topdeck"].includes(command.choice)) return { ok: false, code: "SENTRY_CHOICE_REQUIRED", message: "请选择垃圾处理、弃置或放回牌库顶。" };
    const index = prompt.cards.findIndex((item) => item.uid === selected.uid);
    prompt.cards.splice(index, 1);
    removeCard(player.hand, selected.uid);
    if (command.choice === "trash") state.trash.push(selected);
    else if (command.choice === "discard") player.discard.push(selected);
    else {
      prompt.topdeckCards = [...(prompt.topdeckCards || []), selected];
    }
    if (prompt.cards.length) { state.pendingPrompt = prompt; player.pending = prompt; return { ok: true, state }; }
    if (prompt.topdeckCards?.length > 1) {
      setPrompt(state, { type: "select-sentry-order", playerIndex, cards: prompt.topdeckCards });
      return { ok: true, state };
    }
    if (prompt.topdeckCards?.length === 1) player.deck.push(prompt.topdeckCards[0]);
  } else if (prompt.type === "select-sentry-order") {
    if (!Array.isArray(command.cardIds) || command.cardIds.length !== prompt.cards.length || new Set(command.cardIds).size !== command.cardIds.length || command.cardIds.some((uid) => !prompt.cards.some((card) => card.uid === uid))) return { ok: false, code: "INVALID_SENTRY_ORDER", message: "请按显示的牌重新排列。" };
    const ordered = command.cardIds.map((uid) => prompt.cards.find((card) => card.uid === uid));
    player.deck.push(...ordered.reverse());
  } else if (prompt.type === "select-reaction") {
    if (!state.attackQueue?.awaitingReaction || state.attackQueue.awaitingReaction.targetIndex !== playerIndex) return { ok: false, code: "REACTION_NOT_ACTIVE", message: "当前没有等待该玩家的攻击响应。" };
    const revealed = Boolean(command.revealMoat && player.hand.some((item) => item.cardId === "moat"));
    state.attackQueue.awaitingReaction.revealedMoat = revealed;
    state.log.push({ type: revealed ? "moat-reveal" : "attack-resolved", playerIndex });
  } else if (prompt.type === "select-attack-discard") {
    if (hasDuplicateSelection) return { ok: false, code: "DUPLICATE_CARD_SELECTION", message: "同一张牌不能重复选择。" };
    const need = Math.max(0, player.hand.length - prompt.maxHand);
    if (selectedIds.length !== need) return { ok: false, code: "DISCARD_COUNT", message: `需要弃置 ${need} 张牌。` };
    for (const uid of selectedIds) if (!player.hand.some((item) => item.uid === uid)) return { ok: false, code: "CARD_NOT_IN_HAND", message: "选择的牌不在手牌中。" };
    selectedIds.forEach((uid) => discardHandCard(state, playerIndex, uid));
  }
  if (state.pendingPrompt === prompt) clearPrompt(state);
  if (state.attackQueue) {
    const attackResult = continueAttack(state);
    if (!attackResult.ok || attackResult.paused) return { ...attackResult, state };
  }
  const continuationResult = resumeContinuations(state);
  if (!continuationResult.ok || continuationResult.paused) return { ...continuationResult, state };
  return { ok: true, state };
}

function drawAndAddCoins(state, playerIndex, count) {
  const drawn = drawCards(state, playerIndex, count);
  return drawn.length;
}

function continueAttack(state) {
  const attack = state.attackQueue;
  if (!attack) return { ok: true };
  if (attack.awaitingReaction) {
    const reaction = attack.awaitingReaction;
    attack.awaitingReaction = null;
    if (!reaction.revealedMoat) applyAttackEffect(state, attack, reaction.targetIndex);
  }
  while (attack.cursor < attack.targets.length) {
    const targetIndex = attack.targets[attack.cursor];
    const target = state.players[targetIndex];
    if (target.hand.some((item) => item.cardId === "moat")) {
      attack.cursor += 1;
      attack.awaitingReaction = { targetIndex, revealedMoat: false };
      setPrompt(state, { type: "select-reaction", playerIndex: targetIndex, attack: attack.kind, targetIndex, choices: ["reveal", "decline"] });
      return { ok: true, paused: true };
    }
    attack.cursor += 1;
    const effect = applyAttackEffect(state, attack, targetIndex);
    if (effect?.paused) return effect;
  }
  state.attackQueue = null;
  return { ok: true };
}

function applyAttackEffect(state, attack, targetIndex) {
  const target = state.players[targetIndex];
  if (attack.kind === "militia" && target.hand.length > 3) {
    setPrompt(state, { type: "select-attack-discard", playerIndex: targetIndex, maxHand: 3, targetIndex });
    return { ok: true, paused: true };
  }
  if (attack.kind === "witch") gainCard(state, targetIndex, "curse");
  if (attack.kind === "bureaucrat") {
    const victory = target.hand.find((item) => hasType(item, "victory"));
    if (victory) target.deck.push(removeCard(target.hand, victory.uid));
    else state.log.push({ type: "bureaucrat-no-victory", targetIndex });
  }
  if (attack.kind === "bandit") {
    const revealed = [];
    for (let draw = 0; draw < 2; draw += 1) {
      const top = drawCards(state, targetIndex, 1)[0];
      if (top) { removeCard(target.hand, top.uid); revealed.push(top); }
    }
      const treasures = revealed.filter((item) => hasType(item, "treasure") && item.cardId !== "copper");
    const best = treasures.sort((left, right) => (definition(right).coins || 0) - (definition(left).coins || 0))[0];
    if (best) state.trash.push(best);
    target.discard.push(...revealed.filter((item) => item !== best));
  }
  return { ok: true };
}

function attackOpponents(state, attackerIndex, kind) {
  state.attackQueue = { attackerIndex, kind, cursor: 0, targets: Array.from({ length: state.players.length - 1 }, (_, index) => (attackerIndex + index + 1) % state.players.length) };
  return continueAttack(state);
}

function playAction(state, playerIndex, uid, times = 1, free = false) {
  const player = state.players[playerIndex];
  const selected = removeCard(player.hand, uid);
  if (!selected) return { ok: false, code: "CARD_NOT_IN_HAND", message: "行动牌不在手牌中。" };
  const def = definition(selected);
  if (!hasType(selected, "action")) { player.hand.push(selected); return { ok: false, code: "ACTION_REQUIRED", message: "只能打出行动牌。" }; }
  if (!free) {
    if (player.phase !== "action" || player.actions <= 0) { player.hand.push(selected); return { ok: false, code: "NO_ACTION", message: "当前没有可用行动。" }; }
    player.actions -= 1;
  }
  player.inPlay.push(selected);
  player.stats.actionsPlayed += 1;
  for (let repeat = 0; repeat < times; repeat += 1) {
    const result = resolveAction(state, playerIndex, selected, def.action);
    if (!result.ok) return result;
    if (result.paused) {
      if (repeat < times - 1) pushContinuation(state, { type: "repeat-action", playerIndex, instance: selected, action: def.action, remaining: times - repeat - 1 });
      return result;
    }
  }
  return { ok: true, state };
}

function resolveAction(state, playerIndex, instance, action) {
  const player = state.players[playerIndex];
  if (action === "cellar") { player.actions += 1; setPrompt(state, { type: "select-hand-discard", max: player.hand.length, drawAfter: "discard-count", optional: true }); return { ok: true, paused: true }; }
  if (action === "chapel") { setPrompt(state, { type: "select-hand-trash", max: 4, optional: true }); return { ok: true, paused: true }; }
  if (action === "moat") { drawAndAddCoins(state, playerIndex, 2); return { ok: true }; }
  if (action === "harbinger") { drawAndAddCoins(state, playerIndex, 1); player.actions += 1; setPrompt(state, { type: "select-card-topdeck", source: "discard", choices: player.discard.map((item) => item.uid).concat("none") }); return { ok: true, paused: true }; }
  if (action === "merchant") { drawAndAddCoins(state, playerIndex, 1); player.actions += 1; player.flags.merchantSilverBonus += 1; return { ok: true }; }
  if (action === "village") { drawAndAddCoins(state, playerIndex, 1); player.actions += 2; return { ok: true }; }
  if (action === "workshop") { setPrompt(state, { type: "select-supply", maxCost: 4, destination: "discard" }); return { ok: true, paused: true }; }
  if (action === "bureaucrat") {
    const gained = gainCard(state, playerIndex, "silver", "deck");
    if (!gained.ok) return gained;
    return attackOpponents(state, playerIndex, "bureaucrat");
  }
  if (action === "gardens") return { ok: true };
  if (action === "militia") { player.coins += 2; return attackOpponents(state, playerIndex, "militia"); }
  if (action === "moneylender") { setPrompt(state, { type: "select-treasure-trash", required: false, copperOnly: true, moneylender: true }); return { ok: true, paused: true }; }
  if (action === "poacher") { drawAndAddCoins(state, playerIndex, 1); player.actions += 1; player.coins += 1; setPrompt(state, { type: "select-hand-discard", max: emptySupplyPiles(state), exact: true }); return { ok: true, paused: true }; }
  if (action === "remodel") { setPrompt(state, { type: "select-hand-trash", max: 1, exact: true, remodel: true }); return { ok: true, paused: true }; }
  if (action === "smithy") { drawAndAddCoins(state, playerIndex, 3); return { ok: true }; }
  if (action === "throne-room") { setPrompt(state, { type: "select-action-card", times: 2, optional: true }); return { ok: true, paused: true }; }
  if (action === "bandit") { player.coins += 2; return attackOpponents(state, playerIndex, "bandit"); }
  if (action === "council-room") { drawAndAddCoins(state, playerIndex, 4); player.buys += 1; for (let index = 0; index < state.players.length; index += 1) if (index !== playerIndex) drawCards(state, index, 1); return { ok: true }; }
  if (action === "festival") { player.actions += 2; player.buys += 1; player.coins += 2; return { ok: true }; }
  if (action === "laboratory") { drawAndAddCoins(state, playerIndex, 2); player.actions += 1; return { ok: true }; }
  if (action === "library") return continueLibrary(state, playerIndex);
  if (action === "market") { drawAndAddCoins(state, playerIndex, 1); player.actions += 1; player.buys += 1; player.coins += 1; return { ok: true }; }
  if (action === "mine") { setPrompt(state, { type: "select-treasure-trash", required: false, mine: true }); return { ok: true, paused: true }; }
  if (action === "sentry") { drawAndAddCoins(state, playerIndex, 1); player.actions += 1; const cards = []; for (let index = 0; index < 2; index += 1) { const drawn = drawCards(state, playerIndex, 1)[0]; if (drawn) cards.push(drawn); } if (cards.length) { setPrompt(state, { type: "select-sentry-card", cards }); return { ok: true, paused: true }; } return { ok: true }; }
  if (action === "vassal") { player.coins += 2; const revealed = drawCards(state, playerIndex, 1)[0]; if (!revealed) return { ok: true }; if (hasType(revealed, "action")) { setPrompt(state, { type: "select-vassal-action", cardId: revealed.uid, times: 1, optional: true }); } else { removeCard(player.hand, revealed.uid); player.discard.push(revealed); } return { ok: true, paused: hasType(revealed, "action") }; }
  if (action === "witch") { drawAndAddCoins(state, playerIndex, 2); return attackOpponents(state, playerIndex, "witch"); }
  if (action === "artisan") { setPrompt(state, { type: "select-supply", maxCost: 5, destination: "hand", artisan: true }); return { ok: true, paused: true }; }
  return { ok: true };
}

function resolveBuy(state, playerIndex, cardId) {
  const player = state.players[playerIndex];
  const pile = state.supply[cardId];
  const def = CARD_DEFS[cardId];
  if (player.phase !== "buy") return { ok: false, code: "BUY_PHASE_REQUIRED", message: "当前不是购买阶段。" };
  if (!pile || pile.count <= 0) return { ok: false, code: "PILE_EMPTY", message: "该牌堆已经空了。" };
  if (player.buys <= 0) return { ok: false, code: "NO_BUY", message: "没有剩余购买次数。" };
  if (player.coins < def.cost) return { ok: false, code: "COINS_NOT_ENOUGH", message: "金币不足。" };
  player.coins -= def.cost;
  player.buys -= 1;
  const result = gainCard(state, playerIndex, cardId);
  if (!result.ok) return result;
  player.stats.gained += 1;
  return { ok: true, state };
}

export function getDominionCardDefinitions() {
  return clone(CARD_DEFS);
}

export function getDominionKingdomIds() {
  return [...KINGDOM_IDS];
}

export function createDominionStudyGame({ playerCount = 4, kingdomIds = ["cellar", "market", "merchant", "militia", "mine", "moat", "remodel", "smithy", "village", "workshop"], seed = 20260927 } = {}) {
  if (playerCount < 2 || playerCount > 4) throw new Error("PLAYER_COUNT_MUST_BE_2_TO_4");
  if (kingdomIds.length !== 10 || new Set(kingdomIds).size !== 10 || kingdomIds.some((id) => !KINGDOM_IDS.includes(id))) throw new Error("KINGDOM_MUST_HAVE_TEN_UNIQUE_CARDS");
  const state = { version: 1, gameId: `dominion-study-${seed}`, playerCount, kingdomIds: [...kingdomIds], supply: {}, players: [], trash: [], activePlayerIndex: 0, turnNumber: 0, phase: "setup", ended: false, pendingPrompt: null, continuations: [], nextUid: 0, rng: seed | 0, log: [] };
  state.supply = createSupply(state, playerCount, kingdomIds);
  state.players = Array.from({ length: playerCount }, (_, playerIndex) => createPlayer(state, playerIndex));
  state.players.forEach((player) => drawCards(state, player.playerIndex, 5));
  beginTurn(state);
  state.log.push({ type: "game-start", playerCount, kingdomIds: [...kingdomIds] });
  return state;
}

function safePromptProjection(prompt) {
  if (!prompt) return null;
  const { cards, cardId, choices, ...safe } = prompt;
  return safe;
}

function publicAuditLog(logValue, viewerIndex = null) {
  return (logValue || []).map((event) => {
    if (event.type !== "command" || !event.command) return clone(event);
    return { ...event, command: { type: event.command.type }, privateTo: viewerIndex === null || event.playerIndex !== viewerIndex ? undefined : viewerIndex };
  });
}

function publicContinuationProjection(continuations, viewerIndex = null) {
  return (continuations || []).map((continuation) => {
    const projected = { ...continuation };
    if (viewerIndex === null || continuation.playerIndex !== viewerIndex) {
      delete projected.instance;
      delete projected.action;
    }
    return projected;
  });
}

export function dominionPublicState(stateValue) {
  const state = clone(stateValue);
  state.players = state.players.map((player) => ({ playerIndex: player.playerIndex, handCount: player.hand.length, deckCount: player.deck.length, discardCount: player.discard.length, inPlay: player.inPlay.map((item) => item.cardId), turn: player.turn, phase: player.phase, score: scorePlayer(player) }));
  state.trash = state.trash.map((item) => item.cardId);
  state.pendingPrompt = safePromptProjection(state.pendingPrompt);
  state.continuations = publicContinuationProjection(state.continuations);
  state.log = publicAuditLog(state.log);
  delete state.rng;
  delete state.nextUid;
  return state;
}

export function dominionPrivateState(stateValue, playerIndex) {
  const state = clone(stateValue);
  state.players = state.players.map((player, index) => index === playerIndex ? player : { ...player, deck: [], discard: [], hand: [], setAside: [], pending: null });
  if (state.pendingPrompt?.playerIndex !== playerIndex) state.pendingPrompt = safePromptProjection(state.pendingPrompt);
  state.continuations = publicContinuationProjection(state.continuations, playerIndex);
  state.log = publicAuditLog(state.log, playerIndex);
  delete state.rng;
  delete state.nextUid;
  return state;
}

export function legalDominionCommands(stateValue) {
  const state = stateValue;
  if (state.ended) return [];
  if (state.pendingPrompt) {
    const prompt = state.pendingPrompt;
    const player = state.players[prompt.playerIndex];
    if (prompt.type === "select-reaction") return [
      { type: "resolve-prompt", revealMoat: true },
      { type: "resolve-prompt", revealMoat: false }
    ];
    if (prompt.type === "select-vassal-action") return [
      { type: "resolve-prompt", cardId: prompt.cardId },
      { type: "resolve-prompt", cardId: "none" }
    ];
    if (prompt.type === "select-library-card") return [
      { type: "resolve-prompt", cardId: prompt.cardId, choice: "keep" },
      { type: "resolve-prompt", cardId: prompt.cardId, choice: "set-aside" }
    ];
    if (prompt.type === "select-sentry-card") return [
      { type: "resolve-prompt", cardId: prompt.cards[0]?.uid, choice: "trash" },
      { type: "resolve-prompt", cardId: prompt.cards[0]?.uid, choice: "discard" },
      { type: "resolve-prompt", cardId: prompt.cards[0]?.uid, choice: "topdeck" }
    ];
    if (prompt.type === "select-sentry-order") return [
      { type: "resolve-prompt", cardIds: prompt.cards.map((card) => card.uid) },
      { type: "resolve-prompt", cardIds: [...prompt.cards].reverse().map((card) => card.uid) }
    ];
    if (prompt.type === "select-supply") return Object.values(state.supply).filter((pile) => pile.count > 0 && pile.cost <= prompt.maxCost && (!prompt.treasureOnly || hasType(pile, "treasure"))).map((pile) => ({ type: "resolve-prompt", cardId: pile.cardId }));
    if (prompt.type === "select-treasure-trash") return [
      ...player.hand.filter((item) => hasType(item, "treasure") && (!prompt.copperOnly || item.cardId === "copper")).map((item) => ({ type: "resolve-prompt", cardId: item.uid })),
      ...(prompt.required ? [] : [{ type: "resolve-prompt", cardId: "none" }])
    ];
    if (prompt.type === "select-action-card") return [
      ...player.hand.filter((item) => hasType(item, "action")).map((item) => ({ type: "resolve-prompt", cardId: item.uid })),
      ...(prompt.optional ? [{ type: "resolve-prompt", cardId: "none" }] : [])
    ];
    if (prompt.type === "select-card-topdeck") return [
      ...(prompt.source === "discard" ? player.discard : [...player.discard, ...player.hand]).map((item) => ({ type: "resolve-prompt", cardId: item.uid })),
      { type: "resolve-prompt", cardId: "none" }
    ];
    return [{ type: "resolve-prompt", prompt: prompt.type }];
  }
  const player = currentPlayer(state);
  if (player.phase === "action") return [
    ...player.hand.filter((item) => hasType(item, "action")).map((item) => ({ type: "play-action", cardId: item.uid })),
    { type: "end-action" }
  ];
  if (player.phase === "buy") return [
    { type: "play-treasures", cardIds: player.hand.filter((item) => hasType(item, "treasure")).map((item) => item.uid) },
    ...Object.values(state.supply).filter((pile) => pile.count > 0 && pile.cost <= player.coins).map((pile) => ({ type: "buy", cardId: pile.cardId })),
    { type: "end-buy" }
  ];
  return [];
}

export function dispatchDominionCommand(stateValue, command = {}) {
  const state = clone(stateValue);
  if (state.ended) return { ok: false, code: "GAME_ENDED", message: "游戏已经结束。", state: stateValue };
  if (state.pendingPrompt) {
    if (command.type !== "resolve-prompt") return { ok: false, code: "PROMPT_REQUIRED", message: "请先完成当前选择。", state: stateValue };
    const promptPlayerIndex = state.pendingPrompt.playerIndex;
    const result = resolvePending(state, command);
    if (!result.ok) return { ...result, state: stateValue };
    state.log.push({ type: "command", playerIndex: promptPlayerIndex, command: clone(command) });
    return { ...result, state };
  }
  const player = currentPlayer(state);
  const playerIndex = state.activePlayerIndex;
  let result;
  if (command.type === "play-action") result = playAction(state, playerIndex, command.cardId);
  else if (command.type === "end-action") { if (player.phase !== "action") return { ok: false, code: "ACTION_PHASE_REQUIRED", message: "当前不是行动阶段。", state: stateValue }; beginBuyPhase(state); result = { ok: true, state }; }
  else if (command.type === "play-treasures") {
    if (player.phase !== "buy") result = { ok: false, code: "BUY_PHASE_REQUIRED", message: "当前不是购买阶段。" };
    else {
      for (const uid of command.cardIds || []) { const treasure = removeCard(player.hand, uid); if (!treasure || !hasType(treasure, "treasure")) { result = { ok: false, code: "TREASURE_NOT_IN_HAND", message: "选择的宝藏牌不在手牌中。" }; break; } player.inPlay.push(treasure); player.coins += definition(treasure).coins || 0; if (treasure.cardId === "silver" && !player.flags.playedSilver) { player.flags.playedSilver = true; player.coins += player.flags.merchantSilverBonus || 0; } }
      if (!result) result = { ok: true, state };
    }
  } else if (command.type === "buy") result = resolveBuy(state, playerIndex, command.cardId);
  else if (command.type === "end-buy") { if (player.phase !== "buy") result = { ok: false, code: "BUY_PHASE_REQUIRED", message: "当前不是购买阶段。" }; else result = { ok: true, state: cleanUp(state) }; }
  else result = { ok: false, code: "UNKNOWN_COMMAND", message: `未知命令：${command.type}` };
  if (!result?.ok) return { ...result, state: stateValue };
  state.log.push({ type: "command", playerIndex, command: clone(command) });
  return { ok: true, state, message: result.message || "命令已结算。" };
}

export function dominionScore(stateValue) {
  return stateValue.players.map((player) => ({ playerIndex: player.playerIndex, score: scorePlayer(player), turns: player.turn, cards: allCardsCount(player) })).sort((left, right) => right.score - left.score || left.turns - right.turns);
}

export function runDominionReferenceTurn(stateValue, playerIndex = stateValue.activePlayerIndex) {
  let state = clone(stateValue);
  const events = [];
  const submit = (command) => { const result = dispatchDominionCommand(state, command); if (!result.ok) throw new Error(`${result.code}:${result.message}`); state = result.state; events.push({ command, phase: state.players[playerIndex]?.phase, pending: state.pendingPrompt?.type || null }); return state; };
  const resolvePromptReference = () => {
    const prompt = state.pendingPrompt;
    if (!prompt) return;
    const player = state.players[prompt.playerIndex];
    if (prompt.type === "select-hand-discard" || prompt.type === "select-attack-discard") {
      const count = prompt.type === "select-attack-discard" ? Math.max(0, player.hand.length - prompt.maxHand) : Math.min(prompt.max || 0, player.hand.filter((item) => hasType(item, "curse") || item.cardId === "estate").length);
      submit({ type: "resolve-prompt", cardIds: player.hand.slice(0, count).map((item) => item.uid) });
    } else if (prompt.type === "select-hand-trash") {
      const choices = prompt.exact
        ? player.hand.slice(0, prompt.max)
        : player.hand.filter((item) => item.cardId === "curse" || item.cardId === "estate").slice(0, prompt.max);
      submit({ type: "resolve-prompt", cardIds: choices.map((item) => item.uid) });
    }
    else if (prompt.type === "select-supply") { const choice = Object.values(state.supply).filter((pile) => pile.count > 0 && pile.cost <= prompt.maxCost && (!prompt.treasureOnly || hasType(pile, "treasure"))).sort((a, b) => b.cost - a.cost)[0]; submit({ type: "resolve-prompt", cardId: choice?.cardId }); }
    else if (prompt.type === "select-treasure-trash") { const treasure = player.hand.find((item) => hasType(item, "treasure") && (prompt.mine || item.cardId === "copper")); submit({ type: "resolve-prompt", cardId: treasure?.uid || "none" }); }
    else if (prompt.type === "select-card-topdeck") submit({ type: "resolve-prompt", cardId: "none" });
    else if (prompt.type === "select-action-card") { const action = player.hand.find((item) => hasType(item, "action")); submit({ type: "resolve-prompt", cardId: action?.uid || "none" }); }
    else if (prompt.type === "select-vassal-action") submit({ type: "resolve-prompt", cardId: "none" });
    else if (prompt.type === "select-library-card") submit({ type: "resolve-prompt", cardId: prompt.cardId, choice: "set-aside" });
    else if (prompt.type === "select-sentry-card") submit({ type: "resolve-prompt", cardId: prompt.cards[0]?.uid, choice: "discard" });
    else if (prompt.type === "select-sentry-order") submit({ type: "resolve-prompt", cardIds: prompt.cards.map((card) => card.uid) });
    else if (prompt.type === "select-reaction") submit({ type: "resolve-prompt", revealMoat: true });
    else submit({ type: "resolve-prompt", cardId: "none" });
  };
  let guard = 0;
  while (state.activePlayerIndex === playerIndex && !state.ended && guard < 80) {
    guard += 1;
    if (state.pendingPrompt) { resolvePromptReference(); continue; }
    const player = state.players[playerIndex];
    if (player.phase === "action") {
      const action = player.hand.find((item) => ["village", "market", "laboratory", "smithy", "merchant", "festival", "witch", "militia", "workshop", "cellar", "chapel", "mine", "remodel", "throne-room", "sentry", "vassal", "library", "harbinger", "bureaucrat", "bandit", "council-room", "poacher", "moneylender", "artisan", "moat"].includes(item.cardId));
      if (action && player.actions > 0) submit({ type: "play-action", cardId: action.uid });
      else submit({ type: "end-action" });
    } else if (player.phase === "buy") {
      submit({ type: "play-treasures", cardIds: player.hand.filter((item) => hasType(item, "treasure")).map((item) => item.uid) });
      const affordable = Object.values(state.supply).filter((pile) => pile.count > 0 && pile.cost <= state.players[playerIndex].coins).sort((a, b) => b.cost - a.cost)[0];
      if (affordable) submit({ type: "buy", cardId: affordable.cardId });
      submit({ type: "end-buy" });
    } else break;
  }
  return { state, events, guard, score: dominionScore(state) };
}

export function validateDominionState(stateValue) {
  const errors = [];
  if (!stateValue || typeof stateValue !== "object") return { ok: false, errors: ["STATE_MUST_BE_OBJECT"] };
  if (stateValue.version !== 1) errors.push("UNSUPPORTED_VERSION");
  if (!Number.isInteger(stateValue.playerCount) || stateValue.playerCount < 2 || stateValue.playerCount > 4) errors.push("INVALID_PLAYER_COUNT");
  if (!Array.isArray(stateValue.players) || stateValue.players.length !== stateValue.playerCount) errors.push("INVALID_PLAYERS");
  if (!Number.isInteger(stateValue.activePlayerIndex) || stateValue.activePlayerIndex < 0 || stateValue.activePlayerIndex >= (stateValue.players?.length || 0)) errors.push("INVALID_ACTIVE_PLAYER");
  if (!['setup', 'action', 'buy', 'waiting', 'ended'].includes(stateValue.phase)) errors.push("INVALID_PHASE");
  if (!Array.isArray(stateValue.kingdomIds) || stateValue.kingdomIds.length !== 10 || new Set(stateValue.kingdomIds).size !== 10 || stateValue.kingdomIds.some((id) => !KINGDOM_IDS.includes(id))) errors.push("INVALID_KINGDOMS");
  const seen = new Set();
  const inspectZone = (zone, label) => {
    if (!Array.isArray(zone)) { errors.push(`INVALID_ZONE:${label}`); return; }
    for (const instance of zone) {
      if (!instance || !instance.uid || !CARD_DEFS[instance.cardId]) { errors.push(`INVALID_CARD:${label}`); continue; }
      if (seen.has(instance.uid)) errors.push(`DUPLICATE_CARD:${instance.uid}`);
      seen.add(instance.uid);
    }
  };
  for (const [index, player] of (stateValue.players || []).entries()) {
    if (player.playerIndex !== index) errors.push(`PLAYER_INDEX:${index}`);
    if (!['waiting', 'action', 'buy', 'ended'].includes(player.phase)) errors.push(`PLAYER_PHASE:${index}`);
    for (const zone of ['deck', 'discard', 'hand', 'inPlay', 'setAside']) inspectZone(player[zone], `player-${index}-${zone}`);
    for (const counter of ['actions', 'buys', 'coins']) if (!Number.isInteger(player[counter]) || player[counter] < 0) errors.push(`INVALID_COUNTER:${index}:${counter}`);
  }
  inspectZone(stateValue.trash, 'trash');
  for (const [cardId, pile] of Object.entries(stateValue.supply || {})) {
    if (!CARD_DEFS[cardId] || pile.cardId !== cardId || !Number.isInteger(pile.count) || pile.count < 0) errors.push(`INVALID_SUPPLY:${cardId}`);
  }
  if (!Array.isArray(stateValue.log)) errors.push("INVALID_LOG");
  if (stateValue.pendingPrompt && (!Number.isInteger(stateValue.pendingPrompt.playerIndex) || !stateValue.players?.[stateValue.pendingPrompt.playerIndex])) errors.push("INVALID_PROMPT_PLAYER");
  return { ok: errors.length === 0, errors };
}

export function serializeDominionState(stateValue) {
  const validation = validateDominionState(stateValue);
  if (!validation.ok) throw new Error(`INVALID_DOMINION_STATE:${validation.errors.join(',')}`);
  return JSON.stringify(stateValue);
}

export function restoreDominionState(serializedState) {
  let parsed;
  try { parsed = typeof serializedState === "string" ? JSON.parse(serializedState) : clone(serializedState); } catch (error) { throw new Error(`INVALID_DOMINION_SAVE:${error.message}`); }
  if (!parsed.continuations) parsed.continuations = [];
  const validation = validateDominionState(parsed);
  if (!validation.ok) throw new Error(`INVALID_DOMINION_STATE:${validation.errors.join(',')}`);
  return parsed;
}

