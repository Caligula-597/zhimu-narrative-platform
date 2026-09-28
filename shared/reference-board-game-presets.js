import { normalizeBoardGameDesign } from "./board-game-design.js";
import { NEW_BOARD_GAME_CATALOG, createEmberAuctionDesign, createMosaicFrontierDesign, createTideCrisisDesign } from "./new-board-game-presets.js";

const entry = (id, name, description, quantity = 1, effects = [], tags = []) => ({ id, name, description, quantity, effects, tags });

export function createRouteNetworkDesign() {
  return normalizeBoardGameDesign({
    version: 4,
    title: "星港商路：群岛路权",
    designGoal: "用有限的轨道资源抢占群岛航线；长路线给分更高，但会把资源锁在公共网络上，迫使玩家判断扩张与阻断的时机。",
    playerCount: { min: 2, max: 4 },
    playTimeMinutes: 24,
    seats: [
      { id: "seat-north", name: "北弦航运 · 深蓝船队", sequence: 1 },
      { id: "seat-south", name: "南潮商会 · 铜色船队", sequence: 2 },
      { id: "seat-east", name: "东屿邮局 · 金色船队", sequence: 3 },
      { id: "seat-west", name: "西湾测绘 · 紫色船队", sequence: 4 }
    ],
    components: [
      {
        id: "component-route-map",
        type: "board",
        name: "群岛航线图",
        quantity: 1,
        description: "八座港口由多条不同长度的双向航线连接；占领路线后，其他席位不能再使用该段路权。",
        playerAction: "观察未占路线，支付轨道资源占领路线，并按照路线长度获得声望。",
        stateFields: [
          { id: "route-count", label: "已占路线", key: "routes", initialValue: "个人轨道" },
          { id: "route-score", label: "群岛声望", key: "score", initialValue: "个人轨道" }
        ],
        entries: [],
        assets: [],
        notes: "线上版把实体路线木条变为带 owner 的公共边，路线归属和长度计分都进入事件日志。"
      },
      {
        id: "component-rail-pool",
        type: "token_pool",
        name: "轨道资源",
        quantity: 72,
        description: "每席开局拥有 14 个轨道资源；路线长度越长，支付越多，但一次获得的声望也越高。",
        playerAction: "占领路线时支付与路线长度相等的轨道资源。",
        entries: [entry("rail", "轨道资源", "占领群岛航线的公共建设资源。", 72)],
        assets: [],
        notes: "全部资源公开，避免线上 AI 通过隐藏状态获得额外信息。"
      },
      {
        id: "component-route-contracts",
        type: "card",
        name: "商路契约",
        quantity: 12,
        description: "线上首版把契约目标收束为公开路线长度与路权数量，先验证路线竞速和阻断是否有趣。",
        playerAction: "通过路线长度、占领数量和剩余资源争夺声望。",
        entries: [
          entry("contract-long-haul", "远潮长线", "占领至少一条长度 3 航线。", 4, [], ["长线"]),
          entry("contract-network", "港口织网", "占领至少 4 条路线。", 4, [], ["网络"]),
          entry("contract-reserve", "稳健储备", "结束时保留至少 5 个轨道资源。", 4, [], ["储备"])
        ],
        assets: [],
        notes: "契约条目保留在设计数据中，数字首版用公开目标和结算说明呈现，不伪装成隐藏任务。"
      }
    ],
    variables: [
      { id: "rail", label: "轨道资源", scope: "player", initialValue: 14, min: 0, max: 24 },
      { id: "routes", label: "已占路线", scope: "player", initialValue: 0, min: 0, max: 12 },
      { id: "score", label: "群岛声望", scope: "player", initialValue: 0, min: 0, max: 40 }
    ],
    mechanisms: [],
    engine: {
      maxRounds: 6,
      map: {
        kind: "area_graph",
        nodes: [
          { id: "north-port", label: "北弦港", x: 20, y: 22, terrain: "port", scoreValue: 1, description: "北方航线的起点。" },
          { id: "mist-port", label: "雾港", x: 50, y: 18, terrain: "port", scoreValue: 2, description: "贸易与传讯中心。" },
          { id: "sun-port", label: "日轮港", x: 82, y: 24, terrain: "port", scoreValue: 3, description: "长线航路的终点。" },
          { id: "echo-port", label: "回声湾", x: 18, y: 58, terrain: "port", scoreValue: 2, description: "旧航图收藏地。" },
          { id: "glass-port", label: "玻璃屿", x: 50, y: 52, terrain: "port", scoreValue: 3, description: "最适合截断对手的中继港。" },
          { id: "south-port", label: "南潮港", x: 82, y: 60, terrain: "port", scoreValue: 2, description: "南部补给港。" },
          { id: "last-port", label: "终潮港", x: 34, y: 84, terrain: "port", scoreValue: 4, description: "所有远潮路线都想抵达的终点。" },
          { id: "wind-port", label: "风门", x: 70, y: 84, terrain: "port", scoreValue: 3, description: "南北航线交汇处。" }
        ],
        edges: [
          { id: "route-north-mist", from: "north-port", to: "mist-port", bidirectional: true, cost: 2, label: "北弦—雾港" },
          { id: "route-mist-sun", from: "mist-port", to: "sun-port", bidirectional: true, cost: 3, label: "雾港—日轮" },
          { id: "route-north-echo", from: "north-port", to: "echo-port", bidirectional: true, cost: 1, label: "北弦—回声" },
          { id: "route-mist-glass", from: "mist-port", to: "glass-port", bidirectional: true, cost: 2, label: "雾港—玻璃" },
          { id: "route-sun-south", from: "sun-port", to: "south-port", bidirectional: true, cost: 2, label: "日轮—南潮" },
          { id: "route-echo-glass", from: "echo-port", to: "glass-port", bidirectional: true, cost: 2, label: "回声—玻璃" },
          { id: "route-glass-south", from: "glass-port", to: "south-port", bidirectional: true, cost: 1, label: "玻璃—南潮" },
          { id: "route-echo-last", from: "echo-port", to: "last-port", bidirectional: true, cost: 3, label: "回声—终潮" },
          { id: "route-glass-last", from: "glass-port", to: "last-port", bidirectional: true, cost: 2, label: "玻璃—终潮" },
          { id: "route-glass-wind", from: "glass-port", to: "wind-port", bidirectional: true, cost: 2, label: "玻璃—风门" },
          { id: "route-south-wind", from: "south-port", to: "wind-port", bidirectional: true, cost: 1, label: "南潮—风门" },
          { id: "route-last-wind", from: "last-port", to: "wind-port", bidirectional: true, cost: 3, label: "终潮—风门" }
        ]
      },
      phases: [{ id: "phase-route-claim", label: "路线争夺", mode: "sequential", actionIds: ["action-claim-route", "action-pass"], description: "按轮转顺序占领一条未被占用的路线，或暂时保留资源。" }],
      actions: [
        { id: "action-claim-route", label: "占领路线", kind: "claim_route", phaseId: "phase-route-claim", target: "any_route", resourceKey: "rail", description: "支付与路线长度相等的轨道资源，取得路线并按长度获得声望。" },
        { id: "action-pass", label: "保留资源", kind: "pass", phaseId: "phase-route-claim", target: "none", description: "本轮不占路线，保留轨道资源等待更高价值线路。" }
      ],
      setup: { unitsPerSeat: 0, startingNodeIds: [], rotateFirstSeat: true },
      roundEffects: [],
      endCondition: { type: "rounds", variableKey: "", operator: "gte", value: 6 },
      endConditions: [{ id: "end-route-limit", variableKey: "routes", operator: "gte", value: 8 }],
      information: "public"
    },
    rulebook: {
      objective: "六轮结束时，路线声望最高者获胜；路线长度越长声望越高。",
      setup: "铺开八座港口与十二条航线；每位玩家获得 14 个轨道资源、0 条路线和 0 声望。按席位顺序开始。",
      turnStructure: "每轮每位玩家按轮转顺序执行一次路线争夺或保留资源；所有路线归属和剩余资源公开。",
      playerActions: "占领一条未被占用的路线，支付等于路线长度的轨道资源并获得同等声望；资源不足或路线已被占用时不能选择。",
      endCondition: "完成六轮，或任一玩家占领八条路线时结束，比较路线声望。",
      tieBreak: "声望相同则比较占领的路线总长度，再比较剩余轨道资源，仍相同则共同获胜。",
      notes: "本作复刻路线争夺、公开网络阻断和长度计分的核心乐趣，使用原创群岛与契约内容，不复制商业桌游的地图、文案或图形。"
    },
    information: "public"
  });
}

export function createSkylineDraftDesign() {
  return normalizeBoardGameDesign({
    version: 4,
    title: "天穹城：星港轮抽",
    designGoal: "每轮从公共市场同时挑选一张城市模块，组合能源、贸易与科研符号，形成能持续增长的个人城市引擎。",
    playerCount: { min: 2, max: 4 },
    playTimeMinutes: 26,
    seats: [
      { id: "seat-orbit", name: "轨道总署 · 高空规划师", sequence: 1 },
      { id: "seat-lumen", name: "光塔财团 · 能源投资者", sequence: 2 },
      { id: "seat-archive", name: "旧星档案馆 · 科研建筑师", sequence: 3 },
      { id: "seat-market", name: "环城商盟 · 贸易调度员", sequence: 4 }
    ],
    components: [
      {
        id: "component-skyline-board",
        type: "board",
        name: "天穹城公共市场",
        quantity: 1,
        description: "公共市场同时展示四张城市模块；每轮所有席位秘密选择不同卡牌，结算后补满市场。",
        playerAction: "观察市场缺口，秘密选择一张城市模块并加入个人城市。",
        stateFields: [{ id: "market-round", label: "轮次", key: "round", initialValue: "1 / 6" }],
        entries: [],
        assets: [],
        notes: "市场、选择冲突、补牌和个人收藏都由线上状态直接记录。"
      },
      {
        id: "component-city-deck",
        type: "deck",
        name: "城市模块牌库",
        quantity: 24,
        description: "能源、科研、贸易和居住四类模块；每张卡都有公开卡面效果，构筑方向由玩家自行组合。",
        playerAction: "从公共市场选择一张卡，执行卡面效果并公开加入个人城市。",
        entries: [
          entry("module-solar", "浮空光塔", "城市接入稳定能源。", 6, [{ targetKey: "energy", operation: "add", value: "2" }, { targetKey: "score", operation: "add", value: "1" }], ["能源"]),
          entry("module-lab", "回声实验室", "把科研投入转化为长期声望。", 6, [{ targetKey: "research", operation: "add", value: "2" }, { targetKey: "score", operation: "add", value: "1" }], ["科研"]),
          entry("module-market", "环城集市", "让城市获得稳定的贸易流。", 6, [{ targetKey: "trade", operation: "add", value: "2" }, { targetKey: "score", operation: "add", value: "1" }], ["贸易"]),
          entry("module-habitat", "云端居所", "扩大城市人口与终局声望。", 6, [{ targetKey: "score", operation: "add", value: "3" }], ["居住"])
        ],
        assets: [],
        notes: "牌库按条目数量展开为逐张实例；线上市场不会泄露未公开牌堆顺序。"
      }
    ],
    variables: [
      { id: "energy", label: "能源", scope: "player", initialValue: 0, min: 0, max: 18 },
      { id: "research", label: "科研", scope: "player", initialValue: 0, min: 0, max: 18 },
      { id: "trade", label: "贸易", scope: "player", initialValue: 0, min: 0, max: 18 },
      { id: "score", label: "城市声望", scope: "player", initialValue: 0, min: 0, max: 40 }
    ],
    mechanisms: [],
    engine: {
      maxRounds: 6,
      map: { kind: "area_graph", nodes: [{ id: "skyline-center", label: "天穹中央", x: 50, y: 50, terrain: "market", scoreValue: 0, description: "公共市场与个人城市构筑的汇合点。" }], edges: [] },
      phases: [{ id: "phase-city-draft", label: "城市轮抽", mode: "reveal", actionIds: ["action-draft-module"], description: "所有席位同时从四张公开模块中选择一张，选择完成后统一公开。" }],
      actions: [{ id: "action-draft-module", label: "选择城市模块", kind: "draft", phaseId: "phase-city-draft", target: "none", deckId: "component-city-deck", marketSize: 4, description: "从公共市场选择一张模块；若多人选择同一张，必须重新选择。" }],
      setup: { unitsPerSeat: 0, startingNodeIds: [], marketSize: 4, seed: "skyline-draft-v1" },
      roundEffects: [],
      endCondition: { type: "rounds", variableKey: "", operator: "gte", value: 6 },
      endConditions: [],
      information: "public"
    },
    rulebook: {
      objective: "六轮轮抽结束时，城市声望最高者获胜；能源、科研和贸易会成为声望的公开成长轨迹。",
      setup: "洗混 24 张城市模块，公开四张组成公共市场；每位玩家从 0 声望、0 能源、0 科研和 0 贸易开始。",
      turnStructure: "每轮所有席位同时秘密选择一张市场卡；全部提交后统一公开，卡牌进入个人城市并补满市场。",
      playerActions: "只能选择仍在市场中的卡牌；若多名玩家选择同一张，整轮选择无效并要求重新提交。取得卡牌后立即执行卡面效果。",
      endCondition: "完成六轮轮抽后结束，比较城市声望。",
      tieBreak: "声望相同则比较能源、科研、贸易三项发展值之和，仍相同则共同获胜。",
      notes: "本作复刻同时选牌、选择冲突和引擎构筑的核心节奏，卡面与城市背景全部原创。"
    },
    information: "public"
  });
}

export function createStormClimbDesign() {
  return normalizeBoardGameDesign({
    version: 4,
    title: "风暴峰线：再掷一步",
    designGoal: "每次掷骰都让登峰进度更高，也让爆裂风险更近；玩家必须在继续挑战和安全结算之间反复选择。",
    playerCount: { min: 2, max: 4 },
    playTimeMinutes: 18,
    seats: [
      { id: "seat-climber", name: "雪线测绘队 · 先锋", sequence: 1 },
      { id: "seat-rescue", name: "风暴救援队 · 锚手", sequence: 2 },
      { id: "seat-weather", name: "云层观测站 · 气象员", sequence: 3 },
      { id: "seat-guide", name: "旧路向导 · 领攀者", sequence: 4 }
    ],
    components: [
      {
        id: "component-mountain-board",
        type: "board",
        name: "风暴峰垂直路线",
        quantity: 1,
        description: "每位席位有独立的风险进度与公开声望；掷骰推进风险，停手把风险转为分数，爆裂则本轮进度全部丢失。",
        playerAction: "掷骰、观察风险、选择继续或停手。",
        stateFields: [{ id: "storm-risk", label: "当前风险", key: "risk", initialValue: "席位个人" }],
        entries: [],
        assets: [],
        notes: "线上版用确定性随机保存每次骰面，爆裂和停手都写入日志，方便公平性复盘。"
      },
      {
        id: "component-dice-pool",
        type: "dice",
        name: "风暴骰",
        quantity: 4,
        description: "每次挑战掷两枚六面骰；风险达到 18 时爆裂，当前轮风险归零。",
        playerAction: "掷骰推进风险，或停手结算当前风险。",
        entries: [entry("d6", "六面风暴骰", "每面 1—6，使用服务器种子生成。", 4)],
        assets: [],
        notes: "随机结果由服务器权威生成，客户端不能自行改骰面。"
      }
    ],
    variables: [{ id: "score", label: "登峰声望", scope: "player", initialValue: 0, min: 0, max: 60 }],
    mechanisms: [],
    engine: {
      maxRounds: 8,
      map: { kind: "area_graph", nodes: [{ id: "storm-peak", label: "风暴峰顶", x: 50, y: 38, terrain: "peak", scoreValue: 0, description: "越接近峰顶，风险越高。" }], edges: [] },
      phases: [{ id: "phase-storm-turn", label: "风暴挑战", mode: "sequential", actionIds: ["action-roll-storm", "action-stop-storm"], description: "当前席位可以继续掷骰，也可以安全停手；爆裂会失去本轮未结算风险。" }],
      actions: [
        { id: "action-roll-storm", label: "继续掷骰", kind: "roll", phaseId: "phase-storm-turn", target: "none", rollCount: 2, rollSides: 6, bustThreshold: 18, keepTurn: true, description: "掷两枚六面骰，把点数加入当前风险；风险达到 18 时爆裂。" },
        { id: "action-stop-storm", label: "安全停手", kind: "stop", phaseId: "phase-storm-turn", target: "none", description: "把当前风险安全结算为登峰声望，并轮到下一席。" }
      ],
      setup: { unitsPerSeat: 0, startingNodeIds: [], rotateFirstSeat: true, seed: "storm-climb-v1" },
      roundEffects: [],
      endCondition: { type: "rounds", variableKey: "", operator: "gte", value: 8 },
      endConditions: [{ id: "end-score", variableKey: "score", operator: "gte", value: 30 }],
      information: "public"
    },
    rulebook: {
      objective: "八轮风暴结束时，登峰声望最高者获胜；先达到 30 声望的席位立即触发终局检查。",
      setup: "每位玩家从 0 登峰声望和 0 当前风险开始；服务器建立确定性风暴骰种子。",
      turnStructure: "当前席位反复选择继续掷骰或安全停手；继续掷骰不会换人，停手或爆裂后轮到下一席。",
      playerActions: "继续掷骰会把两枚骰子的总点数加入个人风险；风险达到 18 时爆裂，本轮风险归零。安全停手则把当前风险全部转为声望。",
      endCondition: "完成八轮，或任一席位达到 30 声望时结束。",
      tieBreak: "声望相同则比较最后一次安全停手时的结算风险，仍相同则比较爆裂次数少者。",
      notes: "本作复刻风险推进、继续/停手和爆裂归零的核心机制，使用原创登峰主题与数字骰面记录。"
    },
    information: "public"
  });
}

export function createDawnRingDraftDesign() {
  const card = (id, name, description, age, effects, tags = []) => ({ ...entry(id, name, description, 5, effects, [...tags, `时代${age}`]), age });
  const cards = [
    card("dawn-power", "晨环蓄能站", "把第一缕日潮压入城市核心。", 1, [{ targetKey: "energy", operation: "add", value: 2 }, { targetKey: "score", operation: "add", value: 1 }], ["能源"]),
    card("dawn-market", "浮桥集市", "让两座卫星城之间开始流通。", 1, [{ targetKey: "trade", operation: "add", value: 2 }, { targetKey: "coins", operation: "add", value: 1 }], ["贸易"]),
    card("dawn-archive", "回声档案舱", "记录旧纪元的星图和算法。", 1, [{ targetKey: "science", operation: "add", value: 2 }, { targetKey: "score", operation: "add", value: 1 }], ["科学"]),
    card("dawn-shield", "边界信标", "为相邻聚落架起第一层防线。", 1, [{ targetKey: "military", operation: "add", value: 2 }, { targetKey: "score", operation: "add", value: 1 }], ["防卫"]),
    card("dawn-forum", "晨议广场", "把分散的居民组织成共同体。", 1, [{ targetKey: "score", operation: "add", value: 3 }], ["民生"]),
    card("dawn-relay", "双轨中继", "能源和贸易在同一条轨道上相互增益。", 1, [{ targetKey: "energy", operation: "add", value: 1 }, { targetKey: "trade", operation: "add", value: 1 }], ["复合"]),
    card("dawn-garden", "悬空花园", "城市获得一处可持续的公共空间。", 1, [{ targetKey: "score", operation: "add", value: 2 }, { targetKey: "coins", operation: "add", value: 2 }], ["民生"]),
    card("mid-exchange", "棱镜兑换所", "把储备的能量转成更灵活的财富。", 2, [{ targetKey: "coins", operation: "add", value: 4 }, { targetKey: "trade", operation: "add", value: 2 }], ["贸易"]),
    card("mid-lab", "共振实验室", "让档案中的理论开始产生新的技术。", 2, [{ targetKey: "science", operation: "add", value: 3 }, { targetKey: "score", operation: "add", value: 2 }], ["科学"]),
    card("mid-fleet", "巡航护壁", "城市边界向外推进一圈。", 2, [{ targetKey: "military", operation: "add", value: 3 }, { targetKey: "score", operation: "add", value: 2 }], ["防卫"]),
    card("mid-foundry", "垂直铸造层", "用更高效的方式制造城市骨架。", 2, [{ targetKey: "energy", operation: "add", value: 3 }, { targetKey: "score", operation: "add", value: 2 }], ["能源"]),
    card("mid-council", "环城议会", "让城市获得一份稳定的公共声望。", 2, [{ targetKey: "score", operation: "add", value: 5 }], ["民生"]),
    card("mid-archive", "相位资料库", "科研与能源开始形成长期协作。", 2, [{ targetKey: "science", operation: "add", value: 1 }, { targetKey: "energy", operation: "add", value: 2 }], ["复合"]),
    card("mid-conduit", "贸易导管", "把邻近城市的流量引入本城。", 2, [{ targetKey: "trade", operation: "add", value: 3 }, { targetKey: "coins", operation: "add", value: 3 }], ["贸易"]),
    card("late-treasury", "恒星金库", "把三时代的积累转成终局储备。", 3, [{ targetKey: "coins", operation: "add", value: 6 }, { targetKey: "score", operation: "add", value: 4 }], ["终局"]),
    card("late-archive", "深层记忆库", "文明终于理解旧时代留下的完整模型。", 3, [{ targetKey: "science", operation: "add", value: 5 }, { targetKey: "score", operation: "add", value: 5 }], ["科学", "终局"]),
    card("late-frontier", "远界舰队", "把防卫力量变成跨区域影响力。", 3, [{ targetKey: "military", operation: "add", value: 5 }, { targetKey: "score", operation: "add", value: 5 }], ["防卫", "终局"]),
    card("late-core", "天穹中枢", "能源和贸易在最后阶段汇成一颗核心。", 3, [{ targetKey: "energy", operation: "add", value: 5 }, { targetKey: "trade", operation: "add", value: 4 }, { targetKey: "score", operation: "add", value: 3 }], ["复合", "终局"]),
    card("late-forum", "终环大剧场", "整个城市在最后一个时代留下公共遗产。", 3, [{ targetKey: "score", operation: "add", value: 8 }], ["民生", "终局"]),
    card("late-vault", "记忆穹窖", "用知识和财富保存文明的全部成果。", 3, [{ targetKey: "science", operation: "add", value: 3 }, { targetKey: "coins", operation: "add", value: 5 }], ["复合", "终局"]),
    card("late-treaty", "边界协约", "贸易网络与防卫体系共同完成收束。", 3, [{ targetKey: "trade", operation: "add", value: 4 }, { targetKey: "military", operation: "add", value: 3 }, { targetKey: "score", operation: "add", value: 4 }], ["复合", "终局"])
  ];
  return normalizeBoardGameDesign({
    version: 4,
    title: "暮环城：裂隙议会",
    designGoal: "在三次城市时代中同时轮抽、传递和建设；每张模块会改变个人城市的成长轨道，议会席位提供不同的起始倾向，但任何路线都不是唯一答案。",
    playerCount: { min: 3, max: 5 },
    playTimeMinutes: 30,
    seats: [
      { id: "seat-dawn", name: "晨环议会 · 能源规划师", sequence: 1 },
      { id: "seat-tide", name: "潮汐议会 · 贸易调度员", sequence: 2 },
      { id: "seat-memory", name: "记忆议会 · 科研 archivist", sequence: 3 },
      { id: "seat-border", name: "边界议会 · 防卫统筹者", sequence: 4 },
      { id: "seat-civic", name: "公共议会 · 城市协调员", sequence: 5 }
    ],
    components: [{
      id: "component-dawn-ring-cards",
      type: "deck",
      name: "暮环城市模块",
      quantity: cards.length * 5,
      description: "三个时代的原创城市模块牌；每个时代提供能源、贸易、科学、防卫、民生和复合方向。",
      playerAction: "从私有手牌中秘密选择一张模块，统一公开后加入自己的城市。",
      entries: cards,
      assets: [],
      notes: "这是轮抽机制验证牌包，卡牌文字、数值和世界观均为本项目原创。"
    }],
    variables: [
      { id: "energy", label: "能源", scope: "player", initialValue: 0, min: 0, max: 99 },
      { id: "trade", label: "贸易", scope: "player", initialValue: 0, min: 0, max: 99 },
      { id: "science", label: "科研", scope: "player", initialValue: 0, min: 0, max: 99 },
      { id: "military", label: "防卫", scope: "player", initialValue: 0, min: 0, max: 99 },
      { id: "coins", label: "金币", scope: "player", initialValue: 3, min: 0, max: 99 },
      { id: "score", label: "城市声望", scope: "player", initialValue: 0, min: 0, max: 99 }
    ],
    mechanisms: [],
    engine: {
      maxRounds: 18,
      map: { kind: "area_graph", nodes: [{ id: "dawn-ring-center", label: "暮环中央议会", x: 50, y: 46, terrain: "civic", scoreValue: 0, description: "轮抽和城市结算的公共中枢。" }], edges: [] },
      phases: [{ id: "phase-dawn-ring-draft", label: "城市轮抽", mode: "reveal", actionIds: ["action-dawn-ring-draft"], description: "全桌从私有手牌秘密选择一个城市模块，统一公开并把剩余手牌传给邻居。" }],
      actions: [{ id: "action-dawn-ring-draft", label: "选择城市模块", kind: "draft", draftMode: "hand", phaseId: "phase-dawn-ring-draft", target: "none", deckId: "component-dawn-ring-cards", description: "从当前手牌选择一张模块；所有席位提交后统一结算，并按当前时代方向传递剩余手牌。" }],
      setup: {
        unitsPerSeat: 0,
        startingNodeIds: [],
        handSize: 7,
        draftTurnsPerAge: 6,
        draftAgeCount: 3,
        draftPassDirections: ["right", "left", "right"],
        playerInitialValues: [{ energy: 1 }, { trade: 1 }, { science: 1 }, { military: 1 }, { coins: 5 }],
        seed: "dawn-ring-council-v1"
      },
      roundEffects: [],
      endCondition: { type: "rounds", variableKey: "", operator: "gte", value: 18 },
      endConditions: [],
      information: "private"
    },
    rulebook: {
      objective: "三时代轮抽结束后，城市声望最高者获胜；能源、贸易、科研、防卫和金币记录玩家的成长方向。",
      setup: "选择 3—5 个议会席位；每个席位获得对应的起始倾向和 3 枚金币；每个时代发放 7 张原创城市模块手牌。",
      turnStructure: "每个时代进行 6 次同步轮抽；所有玩家秘密选一张，统一公开后加入自己的城市，剩余手牌按时代方向传递。第 7 张牌作为时代末保底金币处理。",
      playerActions: "当前阶段只能从自己的私有手牌选择一张模块；选择后立即公开并触发卡面效果。不要把未选择手牌内容展示给其他席位。",
      endCondition: "三时代共 18 次轮抽完成后结束，比较城市声望；金币和四项成长值用于平局裁决和审计。",
      tieBreak: "声望相同则比较能源、贸易、科研、防卫四项成长值之和，再比较金币，仍相同则共同获胜。",
      notes: "本作只抽象成熟轮抽游戏的机制骨架，使用暮环城原创世界观和内容；后续可继续加入资源支付、奇观阶段、邻桌交易、路线阻断和多种终局计分。"
    },
    information: "private"
  });
}

export const BOARD_GAME_REFERENCE_CATALOG = Object.freeze([
  { id: "route-network", label: "星港商路", summary: "路线争夺 · 长度计分", create: createRouteNetworkDesign },
  { id: "skyline-draft", label: "天穹城", summary: "公开轮抽 · 引擎构筑", create: createSkylineDraftDesign },
  { id: "storm-climb", label: "风暴峰线", summary: "风险推进 · 继续停手", create: createStormClimbDesign },
  { id: "dawn-ring-draft", label: "暮环城", summary: "私有手牌轮抽 · 三时代 · 非对称议会", create: createDawnRingDraftDesign },
  ...NEW_BOARD_GAME_CATALOG
]);

export function createBoardGameReferencePreset(presetId = "route-network") {
  return (BOARD_GAME_REFERENCE_CATALOG.find((item) => item.id === presetId) || BOARD_GAME_REFERENCE_CATALOG[0]).create();
}
