import { normalizeBoardGameDesign } from "./board-game-design.js";

const entry = (id, name, description, quantity = 1, effects = [], tags = []) => ({ id, name, description, quantity, effects, tags });

const mechanism = {
  id: "mechanism-win-relic",
  templateKey: "track_change",
  name: "赢得遗物契约",
  sourceComponentId: "component-auction-hall",
  trigger: "竞价结算",
  conditionMode: "all",
  conditions: [],
  effects: [
    { id: "win-relic-lot", targetKey: "lot", operation: "add", value: "1" }
  ],
  notes: "最高出价者支付金币，获得一张实际遗物卡并执行卡面效果。"
};

export function createRuinsAuctionDesign() {
  return normalizeBoardGameDesign({
    version: 4,
    title: "遗迹拍卖所：失落契约",
    designGoal: "在公开可见的金币与收藏分之间做秘密竞价：每轮最高出价者取得一件遗物，但过度出价会让后续轮次失去议价能力。",
    playerCount: { min: 2, max: 4 },
    playTimeMinutes: 25,
    seats: [
      { id: "seat-archaeologist", name: "考古学会 · 石碑解读者", sequence: 1 },
      { id: "seat-merchant", name: "黑曜商会 · 契约投机客", sequence: 2 },
      { id: "seat-cartographer", name: "远征测绘局 · 失落路线专家", sequence: 3 },
      { id: "seat-collector", name: "私人收藏馆 · 王室赞助人", sequence: 4 }
    ],
    components: [
      {
        id: "component-auction-hall",
        type: "board",
        name: "遗迹拍卖厅",
        quantity: 1,
        description: "一张只展示当前拍品、金币公开储备和收藏分的中央拍卖桌；不使用空间移动，选择的张力来自价格与时机。",
        playerAction: "观察拍品价值，秘密提交金币，公开比较并收取遗物。",
        stateFields: [
          { id: "auction-lot", label: "已售遗物", key: "lot", initialValue: "0 / 6" },
          { id: "auction-round", label: "竞价轮次", key: "round", initialValue: "1 / 6" }
        ],
        entries: [],
        assets: [],
        notes: "实体版可将中央拍品替换为遗物卡；数字版先以每轮 1 件遗物和公开日志验证竞价公平性。"
      },
      {
        id: "component-relic-deck",
        type: "deck",
        name: "失落遗物牌堆",
        quantity: 18,
        description: "六类遗物价值不同：稳定得分、回扣金币、连胜奖励与末局套组分。",
        playerAction: "公开当前遗物，竞价结束后由赢家取得。",
        entries: [
          entry("relic-jade-beetle", "青玉甲虫", "稳定的 4 收藏分。", 3, [{ targetKey: "score", operation: "add", value: "4" }], ["稳定"]),
          entry("relic-sun-disc", "太阳圆盘", "高价值的 6 收藏分，会诱发激烈出价。", 3, [{ targetKey: "score", operation: "add", value: "6" }], ["高价值"]),
          entry("relic-echo-mask", "回声面具", "3 收藏分，并为持有者带来 2 信誉。", 3, [{ targetKey: "score", operation: "add", value: "3" }, { targetKey: "reputation", operation: "add", value: "2" }], ["信誉"]),
          entry("relic-royal-seal", "王室印玺", "5 收藏分与 1 信誉，适合末局争胜。", 3, [{ targetKey: "score", operation: "add", value: "5" }, { targetKey: "reputation", operation: "add", value: "1" }], ["王室"]),
          entry("relic-amber-eye", "琥珀之眼", "4 收藏分与 1 信誉，平滑分差。", 3, [{ targetKey: "score", operation: "add", value: "4" }, { targetKey: "reputation", operation: "add", value: "1" }], ["追赶"]),
          entry("relic-void-shard", "虚空碎片", "7 收藏分，但不会提供信誉，适合高风险竞价。", 3, [{ targetKey: "score", operation: "add", value: "7" }], ["高风险"])
        ],
        assets: [],
        notes: "每张遗物都展开为可追踪的线上卡牌实例；竞价结算后进入赢家的公开收藏区并立即执行卡面效果。"
      },
      {
        id: "component-coin-pool",
        type: "token_pool",
        name: "金币储备",
        quantity: 80,
        description: "每位席位从 12 金币开始；金币既是竞价资源，也是公开可读的威慑信息。",
        playerAction: "秘密提交、公开扣除、保留到下一轮。",
        entries: [entry("coin", "金币", "出价与支付遗物的唯一货币。", 80)],
        assets: [],
        notes: "数字界面会公开所有剩余金币，避免 AI 或玩家依赖不可见信息。"
      },
      {
        id: "component-score-track",
        type: "track",
        name: "收藏分与信誉轨",
        quantity: 1,
        description: "收藏分决定胜负，信誉用于记录连续赢得高价值拍品的长期优势。",
        playerAction: "获得遗物时推进收藏分与信誉。",
        entries: [],
        assets: [],
        notes: "信誉目前是公开辅助指标，避免复杂隐藏信息遮蔽竞价测试。"
      }
    ],
    variables: [
      { id: "lot", label: "已售遗物", scope: "global", initialValue: 0, min: 0, max: 6 },
      { id: "coins", label: "金币", scope: "player", initialValue: 12, min: 0, max: 30 },
      { id: "reputation", label: "信誉", scope: "player", initialValue: 0, min: 0, max: 12 },
      { id: "score", label: "收藏分", scope: "player", initialValue: 0, min: 0, max: 40 }
    ],
    mechanisms: [mechanism],
    engine: {
      version: 1,
      maxRounds: 6,
      map: {
        kind: "area_graph",
        nodes: [
          { id: "auction-stage", label: "中央拍卖台", x: 50, y: 50, terrain: "relic", scoreValue: 4, description: "本轮公开遗物与所有已提交出价。" }
        ],
        edges: []
      },
      phases: [{ id: "phase-sealed-auction", label: "密封竞价", mode: "reveal", actionIds: ["action-bid", "action-pass"], description: "所有席位同时提交出价，之后统一公开比较。" }],
      actions: [
        { id: "action-bid", label: "秘密出价", kind: "bid", phaseId: "phase-sealed-auction", target: "none", resourceKey: "coins", amount: 0, deckId: "component-relic-deck", mechanismId: "mechanism-win-relic", description: "输入本轮愿意支付的金币；最高价赢得当前遗物并执行卡面效果。" },
        { id: "action-pass", label: "保留金币", kind: "pass", phaseId: "phase-sealed-auction", target: "none", resourceKey: "", amount: 0, description: "放弃本轮竞价，保留全部金币等待后续拍品。" }
      ],
      setup: { unitsPerSeat: 0, startingNodeIds: [] },
      roundEffects: [],
      endCondition: { type: "rounds", variableKey: "", operator: "gte", value: 6 },
      endConditions: [{ id: "end-all-relics", variableKey: "lot", operator: "gte", value: 6 }],
      information: "public"
    },
    rulebook: {
      objective: "六轮结束时，收藏分最高者获胜；若同分，信誉高者获胜，再同分则剩余金币多者获胜。",
      setup: "每位玩家获得 12 金币、0 收藏分和 0 信誉。公开第一张遗物牌。",
      turnStructure: "每轮所有人同时秘密提交竞价或保留金币；全部提交后按本轮轮转顺序公开，最高出价者支付金币并取得遗物，然后进入下一轮。",
      playerActions: "秘密出价时可输入 0 至当前金币；保留金币不会改变资源。所有出价在结算日志中公开，任何席位都不能看到未公开的选择。",
      endCondition: "完成六轮或提前售出六件遗物时结束。收藏分最高者胜出。",
      tieBreak: "同价时采用本轮轮转顺序裁决，轮转起点按轮次变化，不让固定席位持续拥有先手优势；最终同分比较信誉，再比较剩余金币。",
      notes: "这是一款用来检测竞价公平性的最小可玩机制原型。公共资源、公开支付和完整日志优先于复杂牌面。"
    },
    information: "public"
  });
}

export const BOARD_GAME_MECHANISM_CATALOG = Object.freeze([
  { id: "ruins-auction", label: "遗迹拍卖所", summary: "密封竞价 · 资源投机", create: createRuinsAuctionDesign }
]);

export function createBoardGameMechanismPreset(presetId = "ruins-auction") {
  const preset = BOARD_GAME_MECHANISM_CATALOG.find((item) => item.id === presetId) || BOARD_GAME_MECHANISM_CATALOG[0];
  return preset.create();
}
