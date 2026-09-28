import { normalizeBoardGameDesign } from "./board-game-design.js";

const entry = (id, name, description, quantity = 1) => ({ id, name, description, quantity });

function mechanism(id, name, effects, conditions = [], notes = "") {
  return {
    id,
    templateKey: "resource_gain",
    name,
    sourceComponentId: "component-workshop-board",
    trigger: "工位结算",
    conditionMode: "all",
    conditions: conditions.map((condition, index) => ({ id: `${id}-condition-${index + 1}`, ...condition })),
    effects: effects.map((effect, index) => ({ id: `${id}-effect-${index + 1}`, ...effect })),
    notes
  };
}

export function createSeasonWorkshopDesign() {
  return normalizeBoardGameDesign({
    version: 4,
    title: "四季工坊：城建订单",
    designGoal: "轮流把工人放入木场、熔炉和订单台，把木材转成铁料，再把铁料转成城市订单与声望。",
    playerCount: { min: 2, max: 4 },
    playTimeMinutes: 28,
    seats: [
      { id: "seat-woodwright", name: "木匠同盟 · 森林采集者", sequence: 1 },
      { id: "seat-smith", name: "赤炉工会 · 铸造师", sequence: 2 },
      { id: "seat-builder", name: "城建署 · 项目承包人", sequence: 3 },
      { id: "seat-caravan", name: "四季商队 · 订单经纪人", sequence: 4 }
    ],
    components: [
      {
        id: "component-workshop-board",
        type: "board",
        name: "四季工坊板",
        quantity: 1,
        description: "五个工位与一个公共营地；每轮按席位顺序放置工人，空置工位形成短暂阻断。",
        playerAction: "选择空置工位，执行资源生产或订单转换。",
        stateFields: [
          { id: "workshop-season", label: "当前季节", key: "season", initialValue: "1 / 6" },
          { id: "workshop-orders", label: "完成订单", key: "orders", initialValue: "个人轨道" }
        ],
        entries: [],
        assets: [],
        notes: "数字版用区域占用检测工人放置冲突；实体版可替换为木制工人和工位板块。"
      },
      {
        id: "component-order-deck",
        type: "deck",
        name: "城市订单牌",
        quantity: 18,
        description: "订单牌提供生产链终点与分数目标。V1 将订单奖励压缩为固定的个人结算效果。",
        playerAction: "完成订单、收取声望、记录订单数量。",
        entries: [
          entry("order-bridge", "雾桥订单", "支付铁料建造桥梁，获得 5 声望。", 6),
          entry("order-market", "集市订单", "支付铁料扩建集市，获得 5 声望。", 6),
          entry("order-gate", "城门订单", "支付铁料修复城门，获得 5 声望。", 6)
        ],
        assets: [],
        notes: "订单牌按实际卡牌实例从牌库取得；当前三类订单共享 2 铁料换 5 声望的核心成本，卡面仍会进入个人收藏与回放日志。"
      },
      {
        id: "component-resource-pool",
        type: "token_pool",
        name: "木材与铁料",
        quantity: 100,
        description: "个人木材和铁料组成可追踪的生产链资源。",
        playerAction: "生产、支付、转换。",
        entries: [entry("wood", "木材", "木场生产，熔炉消耗。", 50), entry("iron", "铁料", "熔炉生产，订单消耗。", 50)],
        assets: [],
        notes: "所有资源在席位面板公开，避免因手牌或隐藏储备造成不可审计的优势。"
      },
      {
        id: "component-worker-pool",
        type: "token_pool",
        name: "工人标记",
        quantity: 4,
        description: "每位席位一名工人；每次放置都会占用一个工位并解除上一位置。",
        playerAction: "放置到空置工位。",
        entries: [entry("worker", "工人", "执行一次工位行动。", 4)],
        assets: [],
        notes: "简化版每轮每位玩家放置一次；正式版可增加工人数量与轮次。"
      }
    ],
    variables: [
      { id: "season", label: "季节", scope: "global", initialValue: 1, min: 1, max: 6 },
      { id: "wood", label: "木材", scope: "player", initialValue: 0, min: 0, max: 12 },
      { id: "iron", label: "铁料", scope: "player", initialValue: 0, min: 0, max: 12 },
      { id: "orders", label: "完成订单", scope: "player", initialValue: 0, min: 0, max: 6 },
      { id: "score", label: "工坊声望", scope: "player", initialValue: 0, min: 0, max: 40 }
    ],
    mechanisms: [
      mechanism("mechanism-wood", "木场生产", [{ targetKey: "wood", operation: "add", value: "2" }], [], "木场生产 2 木材。"),
      mechanism("mechanism-forge", "熔炉锻造", [
        { targetKey: "wood", operation: "subtract", value: "1" },
        { targetKey: "iron", operation: "add", value: "2" }
      ], [{ sourceKey: "wood", operator: "gte", value: "1" }], "熔炉消耗 1 木材，生产 2 铁料。"),
      mechanism("mechanism-order", "完成城市订单", [
        { targetKey: "iron", operation: "subtract", value: "2" },
        { targetKey: "orders", operation: "add", value: "1" },
        { targetKey: "score", operation: "add", value: "5" }
      ], [{ sourceKey: "iron", operator: "gte", value: "2" }], "订单消耗 2 铁料，获得 1 订单与 5 声望。")
    ],
    engine: {
      version: 1,
      maxRounds: 6,
      map: {
        kind: "area_graph",
        nodes: [
          { id: "camp", label: "公共营地", x: 50, y: 88, terrain: "camp", scoreValue: 0, description: "工人初始位置。" },
          { id: "wood-yard", label: "木场", x: 18, y: 30, terrain: "forest", scoreValue: 2, description: "生产木材。" },
          { id: "wood-yard-2", label: "南林木场", x: 18, y: 60, terrain: "forest", scoreValue: 2, description: "生产木材。" },
          { id: "forge", label: "熔炉", x: 50, y: 22, terrain: "forge", scoreValue: 3, description: "木材转铁料。" },
          { id: "order-bridge", label: "雾桥订单台", x: 82, y: 30, terrain: "order", scoreValue: 5, description: "消耗铁料完成订单。" },
          { id: "order-market", label: "集市订单台", x: 26, y: 60, terrain: "order", scoreValue: 5, description: "消耗铁料完成订单。" },
          { id: "order-gate", label: "城门订单台", x: 74, y: 60, terrain: "order", scoreValue: 5, description: "消耗铁料完成订单。" }
        ],
        edges: []
      },
      phases: [{ id: "phase-worker-placement", label: "工人放置", mode: "sequential", actionIds: ["place-wood", "place-forge", "place-order", "action-pass"], description: "按席位顺序把工人放入空置工位并立即结算。" }],
      actions: [
        { id: "place-wood", label: "放置到木场", kind: "place", phaseId: "phase-worker-placement", target: "any_region", targetTerrain: "forest", mechanismId: "mechanism-wood", description: "放置工人并生产 2 木材。" },
        { id: "place-forge", label: "放置到熔炉", kind: "place", phaseId: "phase-worker-placement", target: "any_region", targetTerrain: "forge", mechanismId: "mechanism-forge", description: "消耗 1 木材，生产 2 铁料。" },
        { id: "place-order", label: "放置到订单台", kind: "place", phaseId: "phase-worker-placement", target: "any_region", targetTerrain: "order", deckId: "component-order-deck", mechanismId: "mechanism-order", description: "消耗 2 铁料，取得一张订单牌并完成订单，获得 5 声望。" },
        { id: "action-pass", label: "暂不放置", kind: "pass", phaseId: "phase-worker-placement", target: "none", description: "暂时不占用工位，保留资源。" }
      ],
      setup: { unitsPerSeat: 1, startingNodeIds: ["camp"], rotateFirstSeat: true },
      roundEffects: [{ id: "season-tick", targetKey: "season", operation: "add", value: "1" }],
      endCondition: { type: "rounds", variableKey: "", operator: "gte", value: 6 },
      endConditions: [{ id: "end-orders", variableKey: "orders", operator: "gte", value: 4 }],
      information: "public"
    },
    rulebook: {
      objective: "六季结束时，工坊声望最高者获胜；完成四份订单会提前进入结算。",
      setup: "每位玩家获得一名工人、0 木材、0 铁料、0 订单和 0 声望。所有工人放在公共营地。",
      turnStructure: "每季按席位顺序放置一名工人到空置区域，立即执行对应工位效果；所有席位完成后进入下一季。",
      playerActions: "可选择木场生产 2 木材、熔炉消耗 1 木材生产 2 铁料，或订单台消耗 2 铁料获得 1 订单和 5 声望。目标区域必须为空置。",
      endCondition: "完成六季或任一席位完成四份订单时结束，比较工坊声望。",
      tieBreak: "声望相同则比较完成订单数，再比较剩余铁料，仍相同则本季更早完成最后订单者优先。",
      notes: "工人放置通过真实空位占用检测执行；生产链通过资源条件和效果执行。后续可增加多工人、订单牌差异和阻断奖励。"
    },
    information: "public"
  });
}

export const BOARD_GAME_WORKSHOP_CATALOG = Object.freeze([
  { id: "season-workshop", label: "四季工坊", summary: "工人放置 · 生产链", create: createSeasonWorkshopDesign }
]);

export function createBoardGameWorkshopPreset(presetId = "season-workshop") {
  const preset = BOARD_GAME_WORKSHOP_CATALOG.find((item) => item.id === presetId) || BOARD_GAME_WORKSHOP_CATALOG[0];
  return preset.create();
}
