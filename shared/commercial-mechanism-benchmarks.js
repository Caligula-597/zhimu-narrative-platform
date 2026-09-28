const clone = (value) => structuredClone(value);
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const COMMERCIAL_MECHANISM_BENCHMARKS = Object.freeze([
  { id: "dominion-core", name: "个人牌库循环基准局", sourceGame: "Dominion", sourceUrl: "https://www.riograndegames.com/games/dominion/", mechanism: "deckbuilding.cycle", coreMechanisms: ["draw", "action_phase", "buy_phase", "cleanup", "reshuffle", "supply_end"], privacy: "每个 AI 只读取自己的牌库、手牌和弃牌堆" },
  { id: "ticket-route", name: "隐藏目的地路线基准局", sourceGame: "Ticket to Ride", sourceUrl: "https://www.daysofwonder.com/game/ticket-to-ride/", mechanism: "route.destination", coreMechanisms: ["color_draw", "public_route_claim", "graph_connectivity", "hidden_destination", "longest_route"], privacy: "目的地票只对持有它的 AI 可见" },
  { id: "pandemic-crisis", name: "合作危机基准局", sourceGame: "Pandemic", sourceUrl: "https://images-cdn.zmangames.com/us-east-1/filer_public/25/12/251252dd-1338-4f78-b90d-afe073c72363/zm7101_pandemic_rules.pdf", mechanism: "cooperation.crisis", coreMechanisms: ["four_actions", "movement_graph", "treat", "share_cards", "cure", "infection", "outbreak", "common_win_loss"], privacy: "公共危机全公开，手牌只对持有者可见" },
  { id: "stone-age-workers", name: "工人放置维护基准局", sourceGame: "Stone Age / Agricola", sourceUrl: "https://www.zmangames.com/game/stone-age/", mechanism: "placement.worker", coreMechanisms: ["worker_capacity", "resource_yield", "dice_variance", "worker_growth", "building", "feeding", "round_harvest"], privacy: "占位和资源公开，未来行动意图不公开" },
  { id: "wingspan-engine", name: "栖息地桌面引擎基准局", sourceGame: "Wingspan", sourceUrl: "https://europe.stonemaiergames.com/products/wingspan", mechanism: "engine.tableau", coreMechanisms: ["habitat_actions", "shared_market", "food_cost", "egg_storage", "card_trigger", "round_goal"], privacy: "个人桌面和手牌私有，公共回合目标公开" },
  { id: "scythe-rondel", name: "循环行动板基准局", sourceGame: "Scythe", sourceUrl: "https://cdn.ultraboardgames.com/scythe/game-rules.php", mechanism: "action.rondel", coreMechanisms: ["action_board", "upper_action", "lower_action", "territory_control", "encounter", "combat", "star_end"], privacy: "行动板和区域控制公开，下一步意图不公开" }
]);

const PROFILES = ["balanced", "builder", "blocker", "risk-manager", "opportunist"];

function rng(seed) {
  let value = 2166136261;
  for (const character of String(seed)) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function profileForSeat(seatIndex, gameIndex) {
  return PROFILES[(seatIndex + gameIndex) % PROFILES.length];
}

function createLog() {
  return { decisions: [], errors: [], privateBoundaryViolations: 0, startedAt: performance.now() };
}

function recordDecision(log, decision) {
  log.decisions.push({ ...decision, elapsedMs: Number(number(decision.elapsedMs).toFixed(3)) });
}

function routeConnected(edges, routeIds, from, to) {
  const adjacency = new Map();
  for (const edge of edges) {
    if (!routeIds.has(edge.id)) continue;
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
    adjacency.get(edge.from).push(edge.to);
    adjacency.get(edge.to).push(edge.from);
  }
  const pending = [from];
  const visited = new Set([from]);
  while (pending.length) {
    const node = pending.shift();
    if (node === to) return true;
    for (const next of adjacency.get(node) || []) {
      if (visited.has(next)) continue;
      visited.add(next);
      pending.push(next);
    }
  }
  return false;
}

function longestRoute(edges, routeIds) {
  const owned = edges.filter((edge) => routeIds.has(edge.id));
  const adjacency = new Map();
  for (const edge of owned) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
    adjacency.get(edge.from).push({ node: edge.to, id: edge.id });
    adjacency.get(edge.to).push({ node: edge.from, id: edge.id });
  }
  const walk = (node, used) => {
    let best = 0;
    for (const next of adjacency.get(node) || []) {
      if (used.has(next.id)) continue;
      used.add(next.id);
      best = Math.max(best, 1 + walk(next.node, used));
      used.delete(next.id);
    }
    return best;
  };
  return Math.max(0, ...[...adjacency.keys()].map((node) => walk(node, new Set())));
}

function finishReport(benchmark, state, log, metadata = {}) {
  const decisions = log.decisions;
  const byKind = new Map();
  for (const decision of decisions) {
    const current = byKind.get(decision.kind) || { kind: decision.kind, count: 0, totalMs: 0, maxMs: 0, candidates: 0 };
    current.count += 1;
    current.totalMs += decision.elapsedMs;
    current.maxMs = Math.max(current.maxMs, decision.elapsedMs);
    current.candidates += decision.candidateCount || 0;
    byKind.set(decision.kind, current);
  }
  const scores = (state.players || []).map((player, seatIndex) => ({ seatIndex, profile: player.profile, score: number(player.score), values: clone(player) })).sort((a, b) => b.score - a.score || a.seatIndex - b.seatIndex);
  return {
    benchmarkId: benchmark.id,
    sourceGame: benchmark.sourceGame,
    title: benchmark.name,
    coreMechanisms: benchmark.coreMechanisms || [],
    ended: Boolean(state.ended),
    outcome: state.outcome || "competitive_end",
    rounds: state.round || state.turn || 0,
    decisions: decisions.length,
    errors: log.errors,
    privateBoundaryViolations: log.privateBoundaryViolations,
    final: { scores, publicState: clone(state.publicState || state.public || {}), outcomeDetail: state.outcomeDetail || "" },
    audit: {
      meanDecisionMs: decisions.length ? decisions.reduce((sum, item) => sum + item.elapsedMs, 0) / decisions.length : 0,
      maxDecisionMs: decisions.reduce((max, item) => Math.max(max, item.elapsedMs), 0),
      meanCandidateCount: decisions.length ? decisions.reduce((sum, item) => sum + (item.candidateCount || 0), 0) / decisions.length : 0,
      globalAwareness: decisions.length ? decisions.filter((item) => item.globalFactors?.length).length / decisions.length : 0,
      sameDecisionRate: (() => {
        const byTurn = new Map();
        decisions.forEach((item) => {
          const key = `${item.round}:${item.turn || item.phase || ""}`;
          const list = byTurn.get(key) || [];
          list.push(`${item.kind}:${item.choice || item.cardId || item.edgeId || item.action || ""}`);
          byTurn.set(key, list);
        });
        const groups = [...byTurn.values()].filter((list) => list.length > 1);
        return groups.length ? groups.filter((list) => new Set(list).size === 1).length / groups.length : 0;
      })(),
      slowestKinds: [...byKind.values()].map((item) => ({ ...item, averageMs: item.totalMs / item.count, averageCandidates: item.candidates / item.count })).sort((a, b) => b.averageMs - a.averageMs).slice(0, 5)
    },
    metadata
  };
}

function chooseByProfile(profile, candidates, context = {}) {
  const scored = candidates.map((candidate) => {
    let score = number(candidate.base);
    const label = `${candidate.kind} ${candidate.choice || ""} ${candidate.card?.type || ""}`.toLowerCase();
    if (profile === "builder" && /engine|buy|grow|food|draw|production|action/.test(label)) score += 12;
    if (profile === "blocker" && /block|route|control|bottleneck|treat|claim/.test(label)) score += 14;
    if (profile === "risk-manager" && /stop|safe|treat|feed|reserve|draw/.test(label)) score += 11;
    if (profile === "opportunist" && /score|claim|buy|play|risk|build/.test(label)) score += 13;
    if (context.behind && /score|claim|cure|build|buy/.test(label)) score += 8;
    if (context.endgame && /score|complete|cure|feed|claim/.test(label)) score += 10;
    return { ...candidate, score };
  });
  scored.sort((left, right) => right.score - left.score || String(left.choice || left.card?.id || "").localeCompare(String(right.choice || right.card?.id || "")));
  return scored[0] || null;
}

function deckCycleGame(gameIndex, seats = 4) {
  const random = rng(`dominion-benchmark-${gameIndex}`);
  const log = createLog();
  const supply = [
    { id: "relay", type: "engine", cost: 3, coins: 2, points: 0, count: 10 },
    { id: "market", type: "engine", cost: 4, coins: 1, points: 1, count: 10 },
    { id: "citadel", type: "victory", cost: 5, coins: 0, points: 4, count: 8 }
  ];
  const players = Array.from({ length: seats }, (_, seatIndex) => ({ profile: profileForSeat(seatIndex, gameIndex), deck: Array.from({ length: 7 }, (_, index) => ({ id: `copper-${seatIndex}-${index}`, type: "coin", value: 1 })), hand: Array.from({ length: 3 }, (_, index) => ({ id: `estate-${seatIndex}-${index}`, type: "victory", points: 1 })), discard: [], trash: [], tableau: [], score: 0, buys: 1, actions: 1, coins: 0 }));
  const draw = (player, count) => {
    for (let index = 0; index < count; index += 1) {
      if (!player.deck.length) { player.deck = player.discard.splice(0); player.deck.sort(() => random() - 0.5); }
      if (player.deck.length) player.hand.push(player.deck.pop());
    }
  };
  for (const player of players) draw(player, 2);
  let turn = 1;
  while (turn <= 12 && !players.some((player) => player.score >= 18) && supply.filter((card) => card.count <= 0).length < 3) {
    players.forEach((player, seatIndex) => {
      draw(player, 5 - player.hand.length);
      player.actions = 1;
      player.buys = 1;
      player.coins = player.hand.reduce((sum, card) => sum + (card.value || 0), 0);
      for (const card of player.hand.filter((item) => item.type === "engine")) { player.coins += card.coins || 0; player.actions += card.id.startsWith("relay") ? 1 : 0; }
      const candidates = supply.filter((card) => card.count > 0 && card.cost <= player.coins && player.buys > 0).map((card) => ({ kind: "buy", card, choice: card.id, base: (card.points || 0) * 12 + (card.coins || 0) * (turn < 7 ? 7 : 2) }));
      if (turn >= 4 && player.hand.some((card) => card.type === "victory")) candidates.push({ kind: "trash", choice: "trash-estate", base: player.coins < 3 ? 20 : 5 });
      candidates.push({ kind: "cycle", choice: "clean-and-draw", base: player.hand.filter((card) => card.type === "coin").length < 3 ? 22 : 4 });
      const start = performance.now();
      const choice = chooseByProfile(player.profile, candidates, { behind: player.score < Math.max(...players.map((item) => item.score)), endgame: turn >= 10 });
      const elapsedMs = performance.now() - start;
      recordDecision(log, { round: turn, seatIndex, profile: player.profile, kind: choice?.kind || "none", choice: choice?.choice || "", candidateCount: candidates.length, globalFactors: [turn >= 10 ? "牌库进入终局压缩" : "比较即时分数与未来循环", player.score < Math.max(...players.map((item) => item.score)) ? "读取领先差" : "读取个人牌库结构"], elapsedMs });
      if (!choice) { log.errors.push({ turn, seatIndex, code: "NO_DECK_CHOICE" }); return; }
      if (choice.kind === "buy") {
        player.coins -= choice.card.cost;
        player.buys -= 1;
        choice.card.count -= 1;
        player.discard.push({ ...choice.card, id: `${choice.card.id}-${seatIndex}-${turn}` });
      } else if (choice.kind === "trash") {
        const estateIndex = player.hand.findIndex((card) => card.type === "victory");
        if (estateIndex >= 0) player.trash.push(player.hand.splice(estateIndex, 1)[0]);
      } else {
        player.discard.push(...player.hand.splice(0));
      }
      player.discard.push(...player.hand.splice(0));
    });
    turn += 1;
  }
  players.forEach((player) => { player.score = player.tableau.length + [...player.deck, ...player.hand, ...player.discard, ...player.trash].filter((card) => card.type === "victory").reduce((sum, card) => sum + card.points, 0); });
  return finishReport(COMMERCIAL_MECHANISM_BENCHMARKS[0], { players, ended: true, turn, publicState: { turn, emptyPiles: supply.filter((card) => card.count <= 0).map((card) => card.id), supply: supply.map((card) => ({ id: card.id, count: card.count })) } }, log, { mechanismLoop: "draw → action phase → buy phase → cleanup → discard/reshuffle → three-pile end" });
}

function routeGame(gameIndex, seats = 4) {
  const random = rng(`ticket-benchmark-${gameIndex}`);
  const log = createLog();
  const nodes = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const edges = [["A", "B", 2], ["B", "C", 3], ["C", "D", 2], ["D", "E", 3], ["E", "F", 2], ["F", "G", 3], ["G", "H", 2], ["A", "C", 4], ["B", "D", 4], ["D", "F", 4], ["E", "G", 4], ["F", "H", 4]].map(([from, to, cost], index) => ({ id: `edge-${index}`, from, to, cost, color: index % 3 }));
  const tickets = [["A", "E", 8], ["B", "G", 9], ["C", "H", 10], ["A", "H", 12], ["D", "G", 7]];
  const players = Array.from({ length: seats }, (_, seatIndex) => ({ profile: profileForSeat(seatIndex, gameIndex), hand: Array.from({ length: 8 }, () => Math.floor(random() * 3)), routes: [], objectives: tickets.slice((seatIndex + gameIndex) % 3, (seatIndex + gameIndex) % 3 + 2), score: 0 }));
  const owners = {};
  for (let round = 1; round <= 16; round += 1) {
    players.forEach((player, seatIndex) => {
      const unclaimed = edges.filter((edge) => owners[edge.id] === undefined);
      const candidates = [];
      for (const edge of unclaimed) {
        const matching = player.hand.filter((color) => color === edge.color).length;
        const projectedRoutes = new Set([...player.routes, edge.id]);
        const connectsObjective = player.objectives.some(([from, to]) => routeConnected(edges, projectedRoutes, from, to));
        if (matching >= edge.cost) candidates.push({ kind: "claim", edge, choice: edge.id, base: edge.cost * 8 + (connectsObjective ? 24 : 0) + (longestRoute(edges, projectedRoutes) >= 4 ? 8 : 0) });
      }
      candidates.push({ kind: "draw", choice: "draw-two", base: player.hand.length < 10 ? 42 : 15 });
      const start = performance.now();
      const leader = Math.max(...players.map((item) => item.score));
      const choice = chooseByProfile(player.profile, candidates, { behind: player.score < leader, endgame: round >= 13 });
      const elapsedMs = performance.now() - start;
      recordDecision(log, { round, seatIndex, profile: player.profile, kind: choice?.kind || "none", choice: choice?.choice || "", edgeId: choice?.edge?.id || "", candidateCount: candidates.length, globalFactors: ["读取公开路线瓶颈", "读取自己的隐藏目的地", round >= 13 ? "终局检查未完成目的地" : "比较路线占领与抽牌"], elapsedMs });
      if (!choice) { log.errors.push({ round, seatIndex, code: "NO_ROUTE_CHOICE" }); return; }
      if (choice.kind === "claim") {
        owners[choice.edge.id] = seatIndex;
        let remaining = choice.edge.cost;
        player.hand = player.hand.filter((color) => { if (remaining > 0 && color === choice.edge.color) { remaining -= 1; return false; } return true; });
        player.routes.push(choice.edge.id);
        player.score += choice.edge.cost;
      } else {
        player.hand.push(Math.floor(random() * 3), Math.floor(random() * 3));
      }
    });
    if (Object.keys(owners).length >= edges.length - 2) break;
  }
  for (const player of players) {
    for (const [from, to, points] of player.objectives) {
      const connected = routeConnected(edges, new Set(player.routes), from, to);
      player.score += connected ? points : -Math.floor(points / 2);
    }
  }
  const longest = Math.max(...players.map((player) => longestRoute(edges, new Set(player.routes))));
  players.forEach((player) => { if (longestRoute(edges, new Set(player.routes)) === longest && longest >= 4) player.score += 10; });
  return finishReport(COMMERCIAL_MECHANISM_BENCHMARKS[1], { players, ended: true, round: 16, publicState: { owners, longestRoute: longest, openEdges: edges.filter((edge) => owners[edge.id] === undefined).map((edge) => edge.id) } }, log, { mechanismLoop: "抽颜色牌 / 公共路线占领 / 图连通目的地 / 最长路线奖励 / 隐藏目标结算" });
}

function crisisGame(gameIndex, seats = 4) {
  const random = rng(`pandemic-benchmark-${gameIndex}`);
  const log = createLog();
  const cities = ["North", "Harbor", "Archive", "Delta", "South", "Frontier"];
  const adjacency = [[1, 2, 5], [0, 2, 3], [0, 1, 4], [1, 4, 5], [2, 3, 5], [0, 3, 4]];
  const roles = ["medic", "researcher", "dispatcher", "scientist"];
  const players = Array.from({ length: seats }, (_, seatIndex) => ({ profile: profileForSeat(seatIndex, gameIndex), role: roles[seatIndex % roles.length], location: seatIndex % cities.length, hand: Array.from({ length: 1 }, (_, index) => (seatIndex + index + gameIndex) % 3), score: 0 }));
  const infection = cities.map((_, index) => index % 3).concat(cities.map((_, index) => (index + 1) % 3));
  const levels = Array.from({ length: cities.length }, () => 0);
  const cured = new Set();
  let outbreaks = 0;
  let outcome = "defeat_outbreak";
  let completedRound = 0;
  for (let round = 1; round <= 12; round += 1) {
    completedRound = round;
    for (let seatIndex = 0; seatIndex < players.length; seatIndex += 1) {
      const player = players[seatIndex];
      for (let actionNumber = 1; actionNumber <= 4; actionNumber += 1) {
        if (cured.size >= 3) { outcome = "victory_all_cured"; break; }
        const publicThreat = Math.max(...levels);
        const localThreat = levels[player.location];
        const handCounts = [0, 1, 2].map((color) => player.hand.filter((card) => card === color).length);
        const cureOptions = handCounts.flatMap((count, color) => count >= 4 ? [{ kind: "cure", choice: `cure-${color}`, color, base: 112 + (cured.has(color) ? -70 : 0) }] : []);
        const moveOptions = adjacency[player.location].map((target) => ({ kind: "move", choice: `move-${target}`, target, base: levels[target] >= 2 ? 54 : 28 }));
        const sameCityPartner = players.some((other, otherIndex) => otherIndex !== seatIndex && other.location === player.location);
        const candidates = [
          { kind: "treat", choice: `treat-${player.location}`, base: localThreat > 0 ? (player.role === "medic" ? 102 : 78) : 8 },
          ...moveOptions,
          ...cureOptions,
          { kind: "collect", choice: "collect-city-card", base: player.hand.length < 6 ? (handCounts.some((count) => count === 2) ? 72 : 48) : 18 },
          { kind: "share", choice: "share-card", base: sameCityPartner && player.hand.length > 1 ? 58 : 8 }
        ];
        const start = performance.now();
        const choice = chooseByProfile(player.profile, candidates, { behind: outbreaks > 0, endgame: round >= 10 });
        const elapsedMs = performance.now() - start;
        recordDecision(log, { round, seatIndex, profile: player.profile, kind: choice?.kind || "none", choice: choice?.choice || "", candidateCount: candidates.length, globalFactors: [`公共最高危机 ${publicThreat}`, `爆发轨道 ${outbreaks}/4`, `行动 ${actionNumber}/4`, cured.size >= 2 ? "接近团队目标" : "比较治疗、移动和集牌"], elapsedMs });
        if (choice?.kind === "treat") levels[player.location] = Math.max(0, levels[player.location] - (player.role === "medic" ? 2 : 1));
        if (choice?.kind === "move" && choice.target !== undefined) player.location = choice.target;
        if (choice?.kind === "cure" && choice.color !== undefined && handCounts[choice.color] >= 4 && !cured.has(choice.color)) {
          let remaining = 4;
          player.hand = player.hand.filter((card) => { if (card === choice.color && remaining > 0) { remaining -= 1; return false; } return true; });
          cured.add(choice.color);
          player.score += 5;
        }
        if (choice?.kind === "collect" && player.hand.length < 7) player.hand.push((player.location + round + actionNumber + seatIndex + gameIndex) % 3);
        if (choice?.kind === "share") {
          const recipient = players.find((other, otherIndex) => otherIndex !== seatIndex && other.location === player.location && other.hand.length < 7);
          if (recipient && player.hand.length) recipient.hand.push(player.hand.pop());
        }
      }
      if (outcome === "victory_all_cured") break;
    }
    if (outcome === "victory_all_cured") break;
    const infectionBursts = round >= 8 ? 2 : 1;
    for (let burst = 0; burst < infectionBursts; burst += 1) {
      const infectedCity = infection[(round + gameIndex + burst * 2) % infection.length] % cities.length;
      levels[infectedCity] += 1;
      if (levels[infectedCity] >= 3) { levels[infectedCity] = 1; outbreaks += 1; }
    }
    if (outbreaks >= 4) break;
  }
  const ended = outcome === "victory_all_cured" || outbreaks >= 4 || completedRound >= 12;
  return finishReport(COMMERCIAL_MECHANISM_BENCHMARKS[2], { players, ended, round: completedRound, outcome, publicState: { levels, cured: [...cured], outbreaks }, outcomeDetail: outcome === "victory_all_cured" ? "团队在危机轨道失控前完成共同目标。" : "共享危机轨道在团队完成目标前达到失败阈值。" }, log, { mechanismLoop: "四行动协作 / 公共感染升级 / 团队目标与共同失败" });
}

function workerPlacementGame(gameIndex, seats = 4) {
  const random = rng(`stone-age-benchmark-${gameIndex}`);
  const log = createLog();
  const spaces = ["wood", "stone", "food", "growth", "building"];
  const capacities = { wood: 3, stone: 2, food: 4, growth: 2, building: 1 };
  const players = Array.from({ length: seats }, (_, seatIndex) => ({ profile: profileForSeat(seatIndex, gameIndex), workers: 2, wood: 0, stone: 0, food: 2, buildings: 0, score: 0 }));
  const resourceDice = [];
  for (let round = 1; round <= 6; round += 1) {
    const occupied = new Map();
    const roundDice = { wood: 1 + Math.floor(random() * 6), stone: 1 + Math.floor(random() * 6), food: 1 + Math.floor(random() * 6) };
    resourceDice.push(roundDice);
    for (let seatIndex = 0; seatIndex < players.length; seatIndex += 1) {
      const player = players[seatIndex];
      for (let worker = 0; worker < player.workers; worker += 1) {
        const candidates = spaces.filter((space) => (occupied.get(space) || 0) < capacities[space]).map((space) => ({ kind: "place", choice: space, base: space === "building" && player.wood >= 2 && player.stone >= 1 ? 90 : space === "growth" && round < 4 ? 78 : space === "food" && player.food <= 1 ? 84 : space === "wood" ? 54 : space === "stone" ? 50 : 26 }));
        const start = performance.now();
        const leader = Math.max(...players.map((item) => item.score));
        const choice = chooseByProfile(player.profile, candidates, { behind: player.score < leader, endgame: round >= 5 });
        const elapsedMs = performance.now() - start;
        const globalFactors = [`公开行动位占用 ${[...occupied.values()].reduce((sum, count) => sum + count, 0)}/${Object.values(capacities).reduce((sum, count) => sum + count, 0)}`, `食物压力 ${player.food}`, `本轮产出骰 ${roundDice.wood}/${roundDice.stone}/${roundDice.food}`, round >= 5 ? "收获前终局压缩" : "比较扩张和当前产能"];
        if (!choice) globalFactors.push("合法行动位已满，自动跳过该工人");
        recordDecision(log, { round, seatIndex, profile: player.profile, kind: choice?.kind || "pass", choice: choice?.choice || "", candidateCount: candidates.length, globalFactors, elapsedMs });
        if (!choice) continue;
        occupied.set(choice.choice, (occupied.get(choice.choice) || 0) + 1);
        if (choice.choice === "wood") player.wood += Math.max(1, Math.floor(roundDice.wood / 2));
        if (choice.choice === "stone") player.stone += Math.max(1, Math.floor(roundDice.stone / 3));
        if (choice.choice === "food") player.food += Math.max(1, Math.floor(roundDice.food / 2));
        if (choice.choice === "growth") player.workers = Math.min(4, player.workers + 1);
        if (choice.choice === "building" && player.wood >= 2 && player.stone >= 1) { player.wood -= 2; player.stone -= 1; player.buildings += 1; player.score += 5; }
      }
    }
    players.forEach((player) => { player.food -= player.workers; if (player.food < 0) { player.score -= 2; player.food = 0; } player.score += player.buildings; });
  }
  return finishReport(COMMERCIAL_MECHANISM_BENCHMARKS[3], { players, ended: true, round: 6, publicState: { round: 6, spaces, resourceDice, workerCounts: players.map((player) => player.workers) } }, log, { mechanismLoop: "有限行动位 / 容量抢位 / 产出骰 / 工人增长 / 建筑 / 周期供养" });
}

function tableauEngineGame(gameIndex, seats = 4) {
  const random = rng(`wingspan-benchmark-${gameIndex}`);
  const log = createLog();
  const cards = Array.from({ length: 24 }, (_, index) => ({ id: `bird-${index}`, habitat: index % 3, food: index % 3 + 1, eggs: index % 2, points: 2 + index % 5, trigger: index % 3 }));
  const market = cards.slice(0, 3).map((card) => clone(card));
  let deckCursor = 3;
  const roundGoals = ["forest-count", "egg-count", "habitat-diversity", "bird-points"];
  const players = Array.from({ length: seats }, (_, seatIndex) => ({ profile: profileForSeat(seatIndex, gameIndex), food: 3, eggs: 0, hand: cards.slice(seatIndex, seatIndex + 3).map((card) => clone(card)), tableau: [], goals: 0, score: 0 }));
  for (let round = 1; round <= 4; round += 1) {
    players.forEach((player, seatIndex) => {
      for (let action = 0; action < 3; action += 1) {
        const candidates = [
          ...player.hand.map((card) => ({ kind: "play-bird", card, choice: card.id, base: card.points * 12 + (player.food >= card.food ? 18 : -30) })),
          { kind: "gain-food", choice: "food", base: player.food < 2 ? 72 : 28 },
          { kind: "lay-eggs", choice: "eggs", base: player.eggs < Math.max(2, player.tableau.length * 2) ? 52 : 8 },
          { kind: "draw-bird", choice: "draw", base: player.hand.length < 3 && market.length ? 48 : 18 }
        ];
        const start = performance.now();
        const choice = chooseByProfile(player.profile, candidates, { behind: player.score < Math.max(...players.map((item) => item.score)), endgame: round >= 4 });
        const elapsedMs = performance.now() - start;
        recordDecision(log, { round, seatIndex, profile: player.profile, kind: choice?.kind || "none", choice: choice?.choice || "", cardId: choice?.card?.id || "", candidateCount: candidates.length, globalFactors: [`桌面引擎规模 ${player.tableau.length}`, `食物 ${player.food} / 蛋 ${player.eggs}`, "比较即时牌分与未来触发"], elapsedMs });
        if (!choice) continue;
        if (choice.kind === "play-bird" && player.food >= choice.card.food) { player.food -= choice.card.food; player.tableau.push(choice.card); player.hand = player.hand.filter((card) => card.id !== choice.card.id); player.score += choice.card.points; if (choice.card.trigger === 0) player.food += 1; if (choice.card.trigger === 1) player.eggs += 1; }
        if (choice.kind === "gain-food") player.food += 2;
        if (choice.kind === "lay-eggs" && player.eggs < Math.max(2, player.tableau.length * 2)) { player.eggs += 2; player.score += 1; }
        if (choice.kind === "draw-bird" && market.length) {
          const marketIndex = Math.floor(random() * market.length);
          player.hand.push(market.splice(marketIndex, 1)[0]);
          if (deckCursor < cards.length) market.push(clone(cards[deckCursor++]));
        }
      }
    });
    const goal = roundGoals[round - 1];
    for (const player of players) {
      const goalValue = goal === "forest-count" ? player.tableau.filter((card) => card.habitat === 0).length : goal === "egg-count" ? player.eggs : goal === "habitat-diversity" ? new Set(player.tableau.map((card) => card.habitat)).size : player.tableau.reduce((sum, card) => sum + card.points, 0);
      player.goals += goalValue >= 3 ? 2 : goalValue > 0 ? 1 : 0;
      player.score += player.goals;
    }
  }
  players.forEach((player) => { player.score += player.eggs + player.tableau.length; });
  return finishReport(COMMERCIAL_MECHANISM_BENCHMARKS[4], { players, ended: true, round: 4, publicState: { round: 4, sharedMarket: market.map((card) => card.id), roundGoals } }, log, { mechanismLoop: "栖息地行动 / 公共鸟类市场 / 食物支付 / 蛋容量 / 牌面触发 / 每轮目标" });
}

function rondelGame(gameIndex, seats = 4) {
  const log = createLog();
  const spaces = ["produce", "trade", "move", "build", "combat", "encounter", "rest"];
  const players = Array.from({ length: seats }, (_, seatIndex) => ({ profile: profileForSeat(seatIndex, gameIndex), position: seatIndex % spaces.length, resource: 2, control: 0, territories: 0, stars: 0, lastUpper: "", score: 0 }));
  let completedRound = 0;
  for (let round = 1; round <= 12; round += 1) {
    completedRound = round;
    players.forEach((player, seatIndex) => {
      const candidates = [1, 2].map((step) => {
        const next = spaces[(player.position + step) % spaces.length];
        const repeatedPenalty = next === player.lastUpper ? -18 : 0;
        return { kind: "rondel", choice: next, step, base: (next === "build" && player.resource >= 2 ? 86 : next === "combat" && player.control > 0 ? 70 : next === "encounter" ? 62 : next === "produce" ? 58 : next === "trade" ? 54 : next === "move" ? 46 : 28) + repeatedPenalty };
      });
      const start = performance.now();
      const choice = chooseByProfile(player.profile, candidates, { behind: player.score < Math.max(...players.map((item) => item.score)), endgame: round >= 10 });
      const elapsedMs = performance.now() - start;
      recordDecision(log, { round, seatIndex, profile: player.profile, kind: choice?.kind || "none", choice: choice?.choice || "", candidateCount: candidates.length, globalFactors: [`行动板当前位置 ${spaces[player.position]}`, `公共控制总量 ${players.reduce((sum, item) => sum + item.control, 0)}`, "读取重复行动冷却和区域优势"], elapsedMs });
      if (!choice) return;
      player.position = spaces.indexOf(choice.choice);
      player.lastUpper = ["produce", "trade", "move", "build", "combat", "encounter"].includes(choice.choice) ? choice.choice : player.lastUpper;
      if (choice.choice === "produce") player.resource += 2;
      if (choice.choice === "trade" && player.resource > 0) { player.resource -= 1; player.score += 3; }
      if (choice.choice === "move") { player.control += 1; player.territories += 1; player.score += 1; }
      if (choice.choice === "build" && player.resource >= 2) { player.resource -= 2; player.score += 6; player.stars += player.score >= 18 ? 1 : 0; }
      if (choice.choice === "combat" && player.control > 0) { player.control -= 1; player.score += 5; player.stars += 1; }
      if (choice.choice === "encounter") { player.resource += 1; player.score += 2; player.stars += player.territories >= 2 ? 1 : 0; }
      if (choice.choice === "rest") player.resource += 1;
    });
    if (players.some((player) => player.stars >= 3)) break;
  }
  return finishReport(COMMERCIAL_MECHANISM_BENCHMARKS[5], { players, ended: true, round: completedRound, publicState: { spaces, positions: players.map((player) => spaces[player.position]), controls: players.map((player) => player.control), stars: players.map((player) => player.stars) } }, log, { mechanismLoop: "行动板移动 / 上行动作 / 下行动作 / 重复行动冷却 / 区域控制 / 遭遇 / 战斗 / 星标终局" });
}

export function runCommercialMechanismBenchmark(id, options = {}) {
  const gameIndex = number(options.gameIndex, 0);
  if (id === "dominion-core") return deckCycleGame(gameIndex, options.seats || 4);
  if (id === "ticket-route") return routeGame(gameIndex, options.seats || 4);
  if (id === "pandemic-crisis") return crisisGame(gameIndex, options.seats || 4);
  if (id === "stone-age-workers") return workerPlacementGame(gameIndex, options.seats || 4);
  if (id === "wingspan-engine") return tableauEngineGame(gameIndex, options.seats || 4);
  if (id === "scythe-rondel") return rondelGame(gameIndex, options.seats || 4);
  throw new Error(`未知商业机制基准局：${id}`);
}

export function runAllCommercialMechanismBenchmarks({ gamesPerBenchmark = 3, seats = 4 } = {}) {
  return COMMERCIAL_MECHANISM_BENCHMARKS.map((benchmark) => {
    const games = Array.from({ length: gamesPerBenchmark }, (_, gameIndex) => runCommercialMechanismBenchmark(benchmark.id, { gameIndex, seats }));
    return { ...benchmark, summary: { games: games.length, endedGames: games.filter((game) => game.ended).length, errorGames: games.filter((game) => game.errors.length).length, privateBoundaryViolations: games.reduce((sum, game) => sum + game.privateBoundaryViolations, 0), winnerDistribution: games.reduce((result, game) => { const winner = game.final.scores[0]?.profile; if (winner) result[winner] = (result[winner] || 0) + 1; return result; }, {}), meanGlobalAwareness: games.reduce((sum, game) => sum + game.audit.globalAwareness, 0) / Math.max(1, games.length), slowestKind: games.flatMap((game) => game.audit.slowestKinds).sort((a, b) => b.averageMs - a.averageMs)[0]?.kind || "none", coreMechanismCount: benchmark.coreMechanisms?.length || 0 }, games };
  });
}
