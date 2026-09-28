import { normalizeBoardGameDesign } from "./board-game-design.js";

const seat = (id, name, sequence) => ({ id, name, sequence });

const variable = (id, label, scope, initialValue, min, max) => ({
  id, label, scope, initialValue, min, max
});

const mechanism = (id, name, trigger, conditions, effects, notes) => ({
  id,
  templateKey: "track_change",
  name,
  sourceComponentId: "",
  trigger,
  conditionMode: "all",
  conditions: conditions.map((item, index) => ({ id: `${id}-condition-${index + 1}`, ...item })),
  effects: effects.map((item, index) => ({ id: `${id}-effect-${index + 1}`, ...item })),
  notes
});

const entry = (id, name, description, quantity = 1) => ({ id, name, description, quantity });

/**
 * 《最后灯塔：潮痕纪元》的可执行首版预设。
 * 内容刻意只使用当前桌游引擎已经支持的公共信息能力，载入后可直接进入试玩。
 */
export function createLastLighthouseDesign(title = "最后灯塔：潮痕纪元") {
  return normalizeBoardGameDesign({
    version: 4,
    title,
    designGoal: "4 个航海组织在 8 轮潮汐中争夺路线与声望；共同维持世界稳定度并修复 7 座灯塔，成功后声望最高者获胜。",
    playerCount: { min: 2, max: 4 },
    playTimeMinutes: 75,
    seats: [
      seat("seat-engineers", "工程总会 · 炉心工匠", 1),
      seat("seat-merchants", "流浪商盟 · 远潮商人", 2),
      seat("seat-salvagers", "深潮打捞者 · 黑帆潜客", 3),
      seat("seat-keepers", "灯塔守望者 · 余烬执灯", 4)
    ],
    components: [
      {
        id: "component-map",
        type: "board",
        name: "潮痕群岛地图",
        quantity: 1,
        description: "由 8 个岛屿节点和 12 条双向航线组成的公共地图。节点承担航行、打捞、贸易与灯塔建造的空间语义。",
        playerAction: "移动船只、争夺区域、在目标岛屿执行行动。",
        stateFields: [
          { id: "map-stability", label: "世界稳定度", key: "stability", initialValue: "7 / 10" },
          { id: "map-beacons", label: "已修复灯塔", key: "beacons", initialValue: "0 / 7" }
        ],
        entries: [],
        assets: [],
        notes: "桌面原型建议使用深青色海面、铜金色航线与米白色岛屿牌块。"
      },
      {
        id: "component-tide-deck",
        type: "deck",
        name: "潮汐事件卡",
        quantity: 24,
        description: "每轮翻开 1 张。实体版用于改变地图风险与玩家谈判压力；数字试玩版先将持续潮汐压缩为回合末稳定度结算。",
        playerAction: "翻开、公开、结算、弃置。",
        entries: [
          entry("tide-01", "黑潮提前", "本轮世界稳定度额外 -1；所有玩家可以共同支付 2 个能源抵消。"),
          entry("tide-02", "逆风回流", "本轮所有航行行动额外支付 1 个补给。"),
          entry("tide-03", "沉船带", "指定一条航线暂时阻断；打捞行动获得的材料 +1。"),
          entry("tide-04", "无月之夜", "本轮不能直接争夺无人区域；研究行动额外获得 1 点声望。"),
          entry("tide-05", "灯影重燃", "若本轮修复灯塔，世界稳定度额外 +1。"),
          entry("tide-06", "潮下回声", "拥有最多遗迹线索的组织可以查看下一张潮汐卡。"),
          entry("tide-07", "群岛断裂", "最远的两个岛屿之间的航线本轮阻断。"),
          entry("tide-08", "短暂平潮", "本轮回合末不扣除世界稳定度。")
        ],
        assets: [],
        notes: "建议制作 8 张独特卡各 3 张，共 24 张；正式版再按试玩数据调整事件比例。"
      },
      {
        id: "component-action-deck",
        type: "deck",
        name: "行动卡",
        quantity: 20,
        description: "每轮每位玩家在航行、远征、建设三个阶段各选择 1 张行动。数字试玩界面将其呈现为可点击行动卡。",
        playerAction: "秘密选择、公开、依次结算。",
        entries: [
          entry("action-sail", "航行", "沿一条相邻航线移动；支付 1 补给。", 4),
          entry("action-salvage", "打捞", "获得 2 个材料。", 4),
          entry("action-trade", "贸易", "支付 1 个材料，获得 2 个补给并得 1 声望。", 3),
          entry("action-research", "研究", "获得 1 个能源并得 1 声望。", 3),
          entry("action-build", "修复灯塔", "支付 2 材料与 1 能源，修复 1 座灯塔，稳定度 +1，得 5 声望。", 3),
          entry("action-secure", "稳固航线", "支付 1 影响力，控制一个区域。", 3)
        ],
        assets: [],
        notes: "行动牌的数量是实体版构筑建议；引擎版直接使用同名行动数据。"
      },
      {
        id: "component-resource-pool",
        type: "token_pool",
        name: "资源标记",
        quantity: 160,
        description: "补给、材料、能源、影响力和声望五类资源。",
        playerAction: "获得、支付、交换、放置到个人板。",
        entries: [
          entry("resource-supply", "补给", "支付航行与生存成本。", 40),
          entry("resource-material", "材料", "修复灯塔与进行贸易。", 40),
          entry("resource-energy", "能源", "研究与点亮灯塔。", 30),
          entry("resource-influence", "影响力", "稳固航线与争夺区域。", 30),
          entry("resource-score", "声望", "最终胜利分。", 20)
        ],
        assets: [],
        notes: "原型可用彩色玻璃珠替代：青色补给、铁灰材料、金色能源、紫色影响力、白色声望。"
      },
      {
        id: "component-lighthouse-pool",
        type: "token_pool",
        name: "灯塔标记",
        quantity: 7,
        description: "七座灯塔的公共修复进度。",
        playerAction: "在满足建设条件后放置到地图上的灯塔节点。",
        entries: [
          entry("beacon-01", "北弦灯塔", "最先被黑潮吞没的灯塔。", 1),
          entry("beacon-02", "雾港灯塔", "商贸航线的旧中心。", 1),
          entry("beacon-03", "沉骨灯塔", "沉船带旁的危险灯塔。", 1),
          entry("beacon-04", "月背灯塔", "只有在无月之夜仍会发光。", 1),
          entry("beacon-05", "风眼灯塔", "位于最稳定的海域。", 1),
          entry("beacon-06", "回声灯塔", "可以听见潮下的声音。", 1),
          entry("beacon-07", "最后灯塔", "决定世界是否继续存在。", 1)
        ],
        assets: [],
        notes: "正式版可以为七座灯塔制作不同形状的立体标记。"
      },
      {
        id: "component-faction-objective-cards",
        type: "card",
        name: "阵营与个人目标卡",
        quantity: 16,
        description: "四张阵营卡和十二张个人目标卡；当前单屏试玩公开展示，实体版建议每位玩家秘密抽取 2 张并保留 1 张。",
        playerAction: "选择阵营、保留目标、在结算时公开。",
        entries: [
          entry("faction-engineers", "工程总会", "每轮第一次修复灯塔少支付 1 材料。目标偏向灯塔数量与建设。", 1),
          entry("faction-merchants", "流浪商盟", "贸易行动额外获得 1 补给；与相邻玩家交易不受距离限制。", 1),
          entry("faction-salvagers", "深潮打捞者", "在风暴或沉船区域打捞时额外获得 1 材料，但承受事件风险。", 1),
          entry("faction-keepers", "灯塔守望者", "每轮第一次稳定度下降时可抵消 1 点；最终声望少 2。", 1),
          entry("objective-network", "织起航线", "控制至少 3 个相互连通的区域：+5 声望。", 1),
          entry("objective-beacon", "灯下誓言", "参与修复至少 2 座灯塔：+5 声望。", 1),
          entry("objective-wealth", "潮汐银行家", "游戏结束时拥有至少 6 个补给：+4 声望。", 1),
          entry("objective-knowledge", "记住潮声", "完成至少 2 次研究：+4 声望。", 1)
        ],
        assets: [],
        notes: "阵营能力是实体版的非对称层；当前试玩先以座位名称与规则书呈现，公共核心循环已可运行。"
      }
    ],
    variables: [
      variable("stability", "世界稳定度", "global", 7, 0, 10),
      variable("beacons", "已修复灯塔", "global", 0, 0, 7),
      variable("supply", "补给", "player", 3, 0, 12),
      variable("material", "材料", "player", 1, 0, 12),
      variable("energy", "能源", "player", 0, 0, 8),
      variable("influence", "影响力", "player", 1, 0, 8),
      variable("score", "声望 / 胜利分", "player", 0, 0, 40)
    ],
    mechanisms: [
      mechanism(
        "mechanism-trade",
        "贸易收益",
        "远征阶段",
        [{ sourceKey: "material", operator: "gte", value: "1" }],
        [
          { targetKey: "material", operation: "subtract", value: "1" },
          { targetKey: "supply", operation: "add", value: "2" },
          { targetKey: "score", operation: "add", value: "1" }
        ],
        "贸易将材料转换成更灵活的补给，并给予少量声望。"
      ),
      mechanism(
        "mechanism-research",
        "研究潮声",
        "远征阶段",
        [],
        [
          { targetKey: "energy", operation: "add", value: "1" },
          { targetKey: "score", operation: "add", value: "1" }
        ],
        "研究不消耗行动外的资源，是建设前的准备动作。"
      ),
      mechanism(
        "mechanism-build-beacon",
        "修复灯塔",
        "建设阶段",
        [
          { sourceKey: "material", operator: "gte", value: "2" },
          { sourceKey: "energy", operator: "gte", value: "1" }
        ],
        [
          { targetKey: "material", operation: "subtract", value: "2" },
          { targetKey: "energy", operation: "subtract", value: "1" },
          { targetKey: "beacons", operation: "add", value: "1" },
          { targetKey: "stability", operation: "add", value: "1" },
          { targetKey: "score", operation: "add", value: "5" }
        ],
        "实体版需要检查目标节点是否已有灯塔；数字首版先以公共灯塔计数与目标区域选择呈现。"
      )
    ],
    engine: {
      maxRounds: 8,
      map: {
        kind: "area_graph",
        nodes: [
          { id: "north-spine", label: "北弦岛", x: 18, y: 22, terrain: "reef", scoreValue: 1, description: "北方的礁石岛，通往雾港。" },
          { id: "mist-harbor", label: "雾港", x: 47, y: 18, terrain: "harbor", scoreValue: 2, description: "商贸与谈判的中心。" },
          { id: "moon-back", label: "月背遗迹", x: 80, y: 22, terrain: "ruin", scoreValue: 2, description: "研究潮声的最佳地点。" },
          { id: "echo-cove", label: "回声湾", x: 17, y: 52, terrain: "ruin", scoreValue: 2, description: "潮下回声最清晰的海湾。" },
          { id: "storm-eye", label: "风眼群岛", x: 50, y: 48, terrain: "storm", scoreValue: 3, description: "资源丰富，但航线风险最高。" },
          { id: "bone-sands", label: "沉骨滩", x: 82, y: 52, terrain: "wreck", scoreValue: 3, description: "打捞者争夺的沉船带。" },
          { id: "last-lighthouse", label: "最后灯塔", x: 34, y: 82, terrain: "lighthouse", scoreValue: 5, description: "世界的最后锚点。" },
          { id: "wind-gate", label: "风门", x: 70, y: 82, terrain: "strait", scoreValue: 2, description: "连接南部航线的狭窄水道。" }
        ],
        edges: [
          { id: "route-north-harbor", from: "north-spine", to: "mist-harbor", bidirectional: true, cost: 1 },
          { id: "route-harbor-moon", from: "mist-harbor", to: "moon-back", bidirectional: true, cost: 1 },
          { id: "route-north-echo", from: "north-spine", to: "echo-cove", bidirectional: true, cost: 1 },
          { id: "route-harbor-storm", from: "mist-harbor", to: "storm-eye", bidirectional: true, cost: 1 },
          { id: "route-moon-bone", from: "moon-back", to: "bone-sands", bidirectional: true, cost: 1 },
          { id: "route-echo-storm", from: "echo-cove", to: "storm-eye", bidirectional: true, cost: 1 },
          { id: "route-storm-bone", from: "storm-eye", to: "bone-sands", bidirectional: true, cost: 1 },
          { id: "route-echo-lighthouse", from: "echo-cove", to: "last-lighthouse", bidirectional: true, cost: 1 },
          { id: "route-storm-lighthouse", from: "storm-eye", to: "last-lighthouse", bidirectional: true, cost: 1 },
          { id: "route-storm-wind", from: "storm-eye", to: "wind-gate", bidirectional: true, cost: 1 },
          { id: "route-bone-wind", from: "bone-sands", to: "wind-gate", bidirectional: true, cost: 1 },
          { id: "route-lighthouse-wind", from: "last-lighthouse", to: "wind-gate", bidirectional: true, cost: 1 }
        ]
      },
      phases: [
        { id: "phase-route", label: "航行", mode: "reveal", actionIds: ["action-sail", "action-rest-route"], description: "所有组织同时选择是否移动。" },
        { id: "phase-expedition", label: "远征", mode: "reveal", actionIds: ["action-salvage", "action-trade", "action-research", "action-rest-expedition"], description: "所有组织同时选择资源与研究行动。" },
        { id: "phase-construction", label: "建设", mode: "reveal", actionIds: ["action-build-beacon", "action-secure-route", "action-rest-build"], description: "所有组织同时选择建设、控制或休整。" }
      ],
      actions: [
        { id: "action-sail", label: "航行", kind: "move", phaseId: "phase-route", target: "adjacent_region", resourceKey: "supply", cost: 1, amount: 0, description: "支付 1 补给，移动到相邻区域。" },
        { id: "action-rest-route", label: "观潮", kind: "pass", phaseId: "phase-route", target: "none", description: "不移动，保留补给。" },
        { id: "action-salvage", label: "打捞", kind: "gain", phaseId: "phase-expedition", target: "none", resourceKey: "material", amount: 2, description: "从所在区域获得 2 个材料。" },
        { id: "action-trade", label: "贸易", kind: "mechanism", phaseId: "phase-expedition", target: "none", mechanismId: "mechanism-trade", description: "支付 1 材料，获得 2 补给与 1 声望。" },
        { id: "action-research", label: "研究", kind: "mechanism", phaseId: "phase-expedition", target: "none", mechanismId: "mechanism-research", description: "获得 1 能源与 1 声望。" },
        { id: "action-rest-expedition", label: "整理船舱", kind: "pass", phaseId: "phase-expedition", target: "none", description: "不执行远征行动。" },
        { id: "action-build-beacon", label: "修复灯塔", kind: "mechanism", phaseId: "phase-construction", target: "any_region", mechanismId: "mechanism-build-beacon", description: "支付 2 材料与 1 能源，灯塔 +1、稳定度 +1、声望 +5。" },
        { id: "action-secure-route", label: "稳固航线", kind: "control", phaseId: "phase-construction", target: "unowned_region", resourceKey: "influence", cost: 1, description: "支付 1 影响力，控制一个尚未被占领的区域。" },
        { id: "action-rest-build", label: "守望", kind: "pass", phaseId: "phase-construction", target: "none", description: "不建设，等待下一轮潮汐。" }
      ],
      setup: { unitsPerSeat: 1, startingNodeIds: ["north-spine", "mist-harbor", "echo-cove", "bone-sands"] },
      roundEffects: [{ targetKey: "stability", operation: "subtract", value: "1" }],
      endCondition: { type: "variable_threshold", variableKey: "stability", operator: "lte", value: 0 },
      endConditions: [{ variableKey: "beacons", operator: "gte", value: 7 }],
      information: "public"
    },
    rulebook: {
      objective: "《最后灯塔》是一款 2—4 人半合作航线建设桌游。玩家必须共同维持世界稳定度，并在 8 轮潮汐内修复尽可能多的灯塔；只要世界没有崩溃，最终声望最高者获胜。",
      setup: "铺开八个区域与十二条航线；将世界稳定度放在 7，已修复灯塔放在 0。每位玩家选择一个组织席位，获得 3 补给、1 材料、0 能源、1 影响力与 0 声望，并将自己的船放到对应起始区域。首轮重点是建立航线与研究潮声，第二轮开始进入稳定的修塔窗口。",
      turnStructure: "每轮依次进行航行、远征、建设三个阶段。每个阶段所有玩家各选择一次行动，全部提交后统一公开并按席位顺序结算。三阶段结束后，世界稳定度 -1，进入下一轮。",
      playerActions: "航行：支付 1 补给移动到相邻区域。打捞：获得 2 材料。贸易：支付 1 材料，获得 2 补给与 1 声望。研究：获得 1 能源与 1 声望。修复灯塔：满足材料与能源条件时，公共灯塔 +1、稳定度 +1、声望 +5。稳固航线：支付 1 影响力，控制一个尚未被占领的区域；每轮结算顺序轮换，避免后手永久覆盖。也可以选择观潮、整理船舱或守望。",
      endCondition: "当世界稳定度降到 0，所有玩家共同失败。当第 8 轮结束，或七座灯塔全部修复，游戏结束；若世界仍稳定，则结算声望，最高者获胜。",
      tieBreak: "平分时依次比较：参与修复灯塔数量、控制区域数量、剩余能源、剩余补给。仍相同则共同获胜。",
      notes: "实体版应加入潮汐事件卡、阵营能力和个人目标卡；数字首版优先验证公共地图、同时选择、资源闭环、稳定度压力与声望竞赛。"
    },
    updatedAt: null
  });
}

