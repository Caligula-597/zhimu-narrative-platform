import { normalizeBoardGameDesign } from "./board-game-design.js";

const clone = (value) => structuredClone(value);
const entry = (id, name, description, quantity, effects = [], tags = []) => ({ id, name, description, quantity, effects, tags });
const seats = (names) => names.map((name, index) => ({ id: `seat-${index + 1}`, name, sequence: index + 1 }));
const board = (id, name, description, nodes, edges = [], notes = "") => ({
  id,
  type: "board",
  name,
  quantity: 1,
  description,
  playerAction: "观察公开棋盘和其他席位的已结算状态，选择当前合法行动。",
  stateFields: [],
  entries: [],
  assets: [],
  notes,
  nodes,
  edges
});

export function createEmberAuctionDesign() {
  const cards = [
    entry("ember-core", "余烬核心", "把拍卖所得转化为城市声望。", 4, [{ targetKey: "score", operation: "add", value: "4" }], ["能源"]),
    entry("glass-orbit", "玻璃轨道", "为后续竞价保留灵活的交易储备。", 4, [{ targetKey: "coins", operation: "add", value: "2" }, { targetKey: "score", operation: "add", value: "2" }], ["贸易"]),
    entry("archive-seal", "档案封印", "以知识换取稳定的终局分数。", 4, [{ targetKey: "score", operation: "add", value: "6" }], ["科研"]),
    entry("dawn-engine", "晨曦引擎", "稀有的高价值遗物，值得一次激进出价。", 4, [{ targetKey: "coins", operation: "add", value: "1" }, { targetKey: "score", operation: "add", value: "8" }], ["终局"])
  ];
  return normalizeBoardGameDesign({
    version: 4,
    title: "余烬集市：密封遗物局",
    designGoal: "通过同时密封竞价争夺公共遗物，在短期得分与保留货币之间做出可审计的风险选择。",
    playerCount: { min: 3, max: 4 },
    playTimeMinutes: 20,
    seats: seats(["北环收藏家", "潮汐经纪人", "灰塔鉴定师", "边界投机客"]),
    components: [
      board("component-ember-board", "余烬拍卖台", "每轮公开一件遗物，所有席位同时提交密封出价。", [{ id: "ember-market", label: "余烬拍卖台", x: 50, y: 45, terrain: "market", scoreValue: 0, description: "公共遗物在这里结算。" }], [], "出价内容只在统一结算时公开，结算日志记录所有出价和第二价格。"),
      { id: "component-ember-deck", type: "deck", name: "遗物牌库", quantity: cards.length * 4, description: "四类原创遗物，价值分布覆盖稳健、成长和终局爆发。", playerAction: "拍卖胜出后取得牌并立即执行卡面效果。", stateFields: [], entries: cards, assets: [], notes: "牌面与数值为原创配置；线上运行时牌库顺序由房间种子确定。" }
    ],
    variables: [
      { id: "coins", label: "铸币", scope: "player", initialValue: 10, min: 0, max: 30 },
      { id: "score", label: "遗物声望", scope: "player", initialValue: 0, min: 0, max: 99 }
    ],
    mechanisms: [],
    engine: {
      maxRounds: 8,
      map: { kind: "area_graph", nodes: [{ id: "ember-market", label: "余烬拍卖台", x: 50, y: 45, terrain: "market", scoreValue: 0, description: "每轮遗物从这里进入竞价。" }], edges: [] },
      phases: [{ id: "phase-ember-auction", label: "密封竞价", mode: "reveal", actionIds: ["action-ember-bid"], description: "所有席位同时为本轮遗物提交一份密封出价。" }],
      actions: [{ id: "action-ember-bid", label: "密封出价", kind: "bid", phaseId: "phase-ember-auction", target: "none", resourceKey: "coins", deckId: "component-ember-deck", bidMode: "second_price", description: "提交不高于自己铸币储备的出价；最高者以第二高价取得遗物。" }],
      setup: { unitsPerSeat: 0, startingNodeIds: [], seed: "ember-auction-v1" },
      roundEffects: [],
      endCondition: { type: "rounds", variableKey: "", operator: "gte", value: 8 },
      endConditions: [],
      information: "private"
    },
    rulebook: {
      objective: "八轮拍卖结束后，遗物声望最高者获胜；铸币只用于出价，不直接计分。",
      setup: "将遗物牌洗成公共牌库；每位玩家获得 10 枚铸币，所有人从第一轮同时出价。",
      turnStructure: "每轮翻开牌库顶端遗物，所有席位秘密提交出价；统一公开后最高出价者以第二高价支付并取得遗物。",
      playerActions: "出价必须是 0 到当前铸币数之间的整数；没有必要为了每件遗物耗尽储备。卡面效果在胜出后立即结算。",
      endCondition: "完成八轮拍卖后结束；若牌库提前耗尽，则立即结束。",
      tieBreak: "声望相同则比较剩余铸币，再比较获得遗物数量，仍相同则共同获胜。",
      notes: "本作验证密封竞价、第二价格和公开审计；主题、牌名、数值与牌库均为原创，不复制商业作品的具体内容。"
    },
    information: "private"
  });
}

export function createTideCrisisDesign() {
  return normalizeBoardGameDesign({
    version: 4,
    title: "潮汐议会：最后警报",
    designGoal: "在有限回合中共同填满救援公共池，同时保留个人声望差异，测试合作目标与个人竞争的张力。",
    playerCount: { min: 3, max: 4 },
    playTimeMinutes: 22,
    seats: seats(["潮汐观测员", "港口医师", "风暴工程师", "远岸联络员"]),
    components: [
      board("component-tide-board", "最后警报棋盘", "公共救援池、危机轨道和每席的公开声望共同构成局面。", [{ id: "tide-basin", label: "救援公共池", x: 50, y: 42, terrain: "crisis", scoreValue: 0, description: "所有席位可以把补给投入这里。" }], [], "公共池和危机日志始终公开，个人剩余补给也公开，方便线上复盘合作决策。"),
      { id: "component-tide-track", type: "track", name: "潮汐危机轨", quantity: 1, description: "危机轨记录离终局目标还差多少公共投入。", playerAction: "在自己的行动窗口把补给投入救援池，或暂缓投入保存资源。", stateFields: [{ id: "pool", label: "救援池", key: "rescuePool", initialValue: "0 / 24" }], entries: [], assets: [], notes: "公共池使用引擎 sharedPools 原语记录，所有投入带有席位和时间戳。" },
      { id: "component-tide-alerts", type: "deck", name: "潮汐警报牌", quantity: 4, description: "四张原创危机牌记录不同的公共压力与救援议题。", playerAction: "主持端可在回合开始时公开当前议题，玩家据此决定是否投入补给。", stateFields: [], entries: [
        entry("alert-breakwater", "堤岸裂口", "公共池低于 8 时，所有席位都必须重新评估投入节奏。", 1, [], ["基础危机"]),
        entry("alert-lantern", "失联灯塔", "公共池达到 8 后公开，提示团队进入中段协作。", 1, [], ["中段危机"]),
        entry("alert-floodline", "回潮线", "公共池达到 16 后公开，提醒剩余回合有限。", 1, [], ["终局压力"]),
        entry("alert-dawn", "黎明窗口", "公共池达到 24 时，救援议会完成共同目标。", 1, [], ["终局"])
      ], assets: [], notes: "警报牌暂作为主持端议题包接入，公共池、投放和终局仍由引擎权威结算。" }
    ],
    variables: [
      { id: "supply", label: "补给", scope: "player", initialValue: 5, min: 0, max: 20 },
      { id: "score", label: "救援声望", scope: "player", initialValue: 0, min: 0, max: 60 },
      { id: "rescuePool", label: "救援公共池", scope: "global", initialValue: 0, min: 0, max: 24 }
    ],
    mechanisms: [],
    engine: {
      maxRounds: 6,
      map: { kind: "area_graph", nodes: [{ id: "tide-basin", label: "救援公共池", x: 50, y: 42, terrain: "crisis", scoreValue: 0, description: "公共救援目标。" }], edges: [] },
      phases: [{ id: "phase-tide-response", label: "救援响应", mode: "sequential", deckId: "component-tide-alerts", actionIds: ["action-tide-contribute", "action-tide-pass"], description: "每席每轮选择投入一份补给或暂缓；回合开始公开一张潮汐警报。" }],
      actions: [
        { id: "action-tide-contribute", label: "投入救援补给", kind: "contribute", phaseId: "phase-tide-response", target: "none", resourceKey: "supply", amount: 1, contributionPoolKey: "rescue", description: "支付 1 补给并投入公共救援池，获得 1 点个人声望。" },
        { id: "action-tide-pass", label: "暂缓响应", kind: "pass", phaseId: "phase-tide-response", target: "none", description: "本次不投入补给，保留资源等待更紧急的回合。" }
      ],
      setup: { unitsPerSeat: 0, startingNodeIds: [], seed: "tide-crisis-v1" },
      roundEffects: [],
      endCondition: { type: "rounds", variableKey: "", operator: "gte", value: 6 },
      endConditions: [{ id: "end-rescue", variableKey: "rescuePool", operator: "gte", value: 24 }],
      information: "public"
    },
    rulebook: {
      objective: "六轮内让救援公共池达到 24；若达成，按个人救援声望排名，若未达成则全体承担失败并比较投入贡献。",
      setup: "每位玩家获得 5 补给和 0 救援声望；公共救援池从 0 开始，所有席位的补给与投入历史公开。",
      turnStructure: "每轮按席位顺序各执行一次投入或暂缓；投入会增加公共池与个人声望，暂缓不改变公共池。",
      playerActions: "只有补给不少于 1 时才能投入；投入属于公共目标但个人声望仍然记录该席位的贡献。",
      endCondition: "公共池达到 24 或完成六轮时结束；达到 24 后立即进入终局审计。",
      tieBreak: "合作成功时声望相同比较个人投入次数；合作失败时比较投入次数，再比较剩余补给，仍相同则共同排名。",
      notes: "本作把合作危机、公共池和个人贡献放进一个可直接运行的原创短局；线上版本会显示危机进度与每次投入的完整响应。"
    },
    information: "public"
  });
}

export function createMosaicFrontierDesign() {
  const tileEntries = [
    entry("mosaic-forest", "雾林地块", "与相邻绿洲连接时获得生态分。", 8, [{ targetKey: "score", operation: "add", value: "2" }], ["森林"]),
    entry("mosaic-river", "回声河湾", "把两个方向的聚落连成连续网络。", 8, [{ targetKey: "score", operation: "add", value: "2" }], ["河流"]),
    entry("mosaic-quarry", "赤岩采场", "承担扩张风险，但提供更高的建设分。", 8, [{ targetKey: "score", operation: "add", value: "3" }], ["矿脉"]),
    entry("mosaic-garden", "悬空花园", "在终局为拥有最多地块的席位提供奖励。", 8, [{ targetKey: "score", operation: "add", value: "3" }], ["花园"])
  ];
  const nodes = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      nodes.push({ id: `mosaic-${row}-${column}`, label: `${row + 1}-${column + 1}`, x: 18 + column * 22, y: 20 + row * 30, gridX: column, gridY: row, terrain: "frontier", scoreValue: 1, description: "可放置一张边境地块。" });
    }
  }
  return normalizeBoardGameDesign({
    version: 4,
    title: "马赛克边境：连片纪元",
    designGoal: "从个人地块手牌中选择位置，逐步扩大相邻版图并在连通、数量和地块质量之间取得平衡。",
    playerCount: { min: 2, max: 4 },
    playTimeMinutes: 25,
    seats: seats(["北境测绘队", "河谷建设局", "赤岩工坊", "云上园艺师"]),
    components: [
      board("component-mosaic-board", "马赛克边境", "十二个六角格位构成共享版图；已放置地块和归属公开。", nodes, [], "首版先验证相邻放置、私有地块手牌和公共版图审计，边缘匹配可在此基础上继续打开。"),
      { id: "component-mosaic-tiles", type: "deck", name: "边境地块牌", quantity: tileEntries.length * 8, description: "每位席位拥有一套私有地块手牌，放置后公开进入共享版图。", playerAction: "从自己的私有手牌选择一张地块并放入空置的相邻格。", stateFields: [], entries: tileEntries, assets: [], notes: "地块牌内容原创；线上状态只向本人返回未打出的私有手牌。" }
    ],
    variables: [
      { id: "hand", label: "地块手牌", scope: "player", initialValue: 4, min: 0, max: 8 },
      { id: "score", label: "边境声望", scope: "player", initialValue: 0, min: 0, max: 99 },
      { id: "tiles", label: "已放地块", scope: "player", initialValue: 0, min: 0, max: 12 }
    ],
    mechanisms: [],
    engine: {
      maxRounds: 4,
      map: { kind: "hex", nodes, edges: [] },
      phases: [{ id: "phase-mosaic-placement", label: "边境拼接", mode: "sequential", actionIds: ["action-mosaic-place", "action-mosaic-pass"], description: "每席从自己的私有手牌放置一块地块，或暂缓。" }],
      actions: [
        { id: "action-mosaic-place", label: "放置边境地块", kind: "place_tile", phaseId: "phase-mosaic-placement", target: "empty_tile", deckId: "component-mosaic-tiles", deckScope: "personal", tileRequireAdjacent: true, description: "从自己的私有手牌选择一块地块放入空置且相邻的格位。" },
        { id: "action-mosaic-pass", label: "暂缓拼接", kind: "pass", phaseId: "phase-mosaic-placement", target: "none", description: "本次不放置地块，保留当前私有手牌。" }
      ],
      setup: { unitsPerSeat: 0, startingNodeIds: [], seed: "mosaic-frontier-v1", personalDecks: [{ deckId: "component-mosaic-tiles", initialHandSize: 4, cardLimit: 8 }], tileTopology: { requireAdjacent: true, gridAdjacency: true } },
      roundEffects: [],
      endCondition: { type: "rounds", variableKey: "", operator: "gte", value: 4 },
      endConditions: [],
      information: "private"
    },
    rulebook: {
      objective: "四轮结束后，边境声望最高者获胜；每块地块都会提供基础声望，持续扩张比单次高分更重要。",
      setup: "铺开 3×4 的共享六角格；每位玩家从自己的地块牌库抽取 4 张私有手牌，所有人从 0 声望开始。",
      turnStructure: "每轮按席位顺序各放置一块地块或暂缓；第一块地块可以落在任意空格，之后必须与已有地块相邻。",
      playerActions: "放置行动只读取当前席位的私有手牌，放置成功后地块归属和卡面效果公开；没有可放位置时只能暂缓。",
      endCondition: "完成四轮放置后结束；版图、地块数量、公开响应和连通关系进入终局审计。",
      tieBreak: "声望相同比较已放地块数量，再比较剩余手牌，仍相同则共同获胜。",
      notes: "本作验证拓扑拼图、私有手牌、公开版图和连通扩张的线上组合；不复制商业地图、图形或具体牌面。"
    },
    information: "private"
  });
}

export const NEW_BOARD_GAME_CATALOG = Object.freeze([
  { id: "ember-auction", label: "余烬集市", summary: "密封竞价 · 第二价格 · 遗物构筑", create: createEmberAuctionDesign },
  { id: "tide-crisis", label: "潮汐议会", summary: "合作公共池 · 个人贡献 · 危机终局", create: createTideCrisisDesign },
  { id: "mosaic-frontier", label: "马赛克边境", summary: "私有地块 · 相邻放置 · 连片扩张", create: createMosaicFrontierDesign }
]);

export function createNewBoardGamePreset(presetId = "ember-auction") {
  return clone((NEW_BOARD_GAME_CATALOG.find((item) => item.id === presetId) || NEW_BOARD_GAME_CATALOG[0]).create());
}
