import { normalizeBoardGameDesign } from "./board-game-design.js";

const entry = (id, name, description, quantity = 1) => ({ id, name, description, quantity });

function mechanism(id, name, effects, conditions = [], notes = "") {
  return {
    id,
    templateKey: "conditional_bonus",
    name,
    sourceComponentId: "component-archive-board",
    trigger: "打出线索",
    conditionMode: "all",
    conditions: conditions.map((condition, index) => ({ id: `${id}-condition-${index + 1}`, ...condition })),
    effects: effects.map((effect, index) => ({ id: `${id}-effect-${index + 1}`, ...effect })),
    notes
  };
}

export function createEchoArchiveDesign() {
  return normalizeBoardGameDesign({
    version: 4,
    title: "回声档案馆：拼接真相",
    designGoal: "从公共档案牌库中抽取线索，把手中的碎片拼成互相支撑的证据链；判断何时抽牌、何时打出高价值连接决定最终档案声望。",
    playerCount: { min: 2, max: 4 },
    playTimeMinutes: 26,
    seats: [
      { id: "seat-reporter", name: "晨报调查组 · 现场记者", sequence: 1 },
      { id: "seat-curator", name: "旧档案馆 · 文献修复师", sequence: 2 },
      { id: "seat-lawyer", name: "公益律师团 · 证据律师", sequence: 3 },
      { id: "seat-listener", name: "回声电台 · 口述史研究员", sequence: 4 }
    ],
    components: [
      {
        id: "component-archive-board",
        type: "board",
        name: "回声档案桌",
        quantity: 1,
        description: "公共牌库、个人手牌上限、证据链轨和真相进度；所有抽牌与打牌动作进入公开日志。",
        playerAction: "抽取线索、保留手牌、打出普通线索或拼接证据链。",
        stateFields: [
          { id: "archive-deck", label: "公共牌库", key: "deck", initialValue: "24" },
          { id: "archive-truth", label: "真相进度", key: "truth", initialValue: "0 / 8" }
        ],
        entries: [],
        assets: [],
        notes: "牌库数量、手牌数量与每张线索卡实例均在线上执行；抽到的牌、选择的牌和打出的牌都会进入可回放日志。"
      },
      {
        id: "component-clue-deck",
        type: "deck",
        name: "回声线索牌库",
        quantity: 24,
        description: "人物、地点、时间和动机四类公开线索；抽牌消耗公共牌库，打牌推进证据链。",
        playerAction: "抽一张牌加入手牌，或打出手牌获得证据。",
        entries: [
          entry("clue-person", "人物碎片", "确认一个关系节点。", 6),
          entry("clue-place", "地点碎片", "确认一处现场位置。", 6),
          entry("clue-time", "时间碎片", "确认事件顺序。", 6),
          entry("clue-motive", "动机碎片", "确认行动原因。", 6)
        ],
        assets: [],
        notes: "实体版可把普通线索和连接线索混入同一牌堆；线上版保留逐张卡牌、确定性洗牌、手牌私密投影和服务器校验。"
      },
      {
        id: "component-evidence-track",
        type: "track",
        name: "证据链与档案声望",
        quantity: 1,
        description: "证据达到 8 时档案馆完成真相；个人声望决定完成后的胜者。",
        playerAction: "打出线索推进证据链与个人声望。",
        entries: [],
        assets: [],
        notes: "公开证据轨让所有 AI 都能判断领先者与剩余追赶空间。"
      },
      {
        id: "component-archive-token",
        type: "token_pool",
        name: "档案标记",
        quantity: 80,
        description: "用于记录手牌、证据和个人声望。",
        playerAction: "抽取、保留、打出、推进。",
        entries: [entry("evidence", "证据", "共同真相进度。", 32), entry("reputation", "档案声望", "个人胜负分。", 48)],
        assets: [],
        notes: "数字试玩直接用数值轨呈现，避免手牌视觉信息隐藏。"
      }
    ],
    variables: [
      { id: "deck", label: "公共牌库", scope: "global", initialValue: 24, min: 0, max: 24 },
      { id: "truth", label: "真相进度", scope: "global", initialValue: 0, min: 0, max: 8 },
      { id: "hand", label: "手牌", scope: "player", initialValue: 0, min: 0, max: 5 },
      { id: "evidence", label: "证据链", scope: "player", initialValue: 0, min: 0, max: 8 },
      { id: "score", label: "档案声望", scope: "player", initialValue: 0, min: 0, max: 40 }
    ],
    mechanisms: [
      mechanism("mechanism-clue", "整理普通线索", [
        { targetKey: "evidence", operation: "add", value: "1" },
        { targetKey: "truth", operation: "add", value: "1" },
        { targetKey: "score", operation: "add", value: "2" }
      ], [], "普通线索提供 1 证据、1 真相进度和 2 档案声望。"),
      mechanism("mechanism-connection", "拼接证据链", [
        { targetKey: "evidence", operation: "add", value: "2" },
        { targetKey: "truth", operation: "add", value: "2" },
        { targetKey: "score", operation: "add", value: "5" }
      ], [{ sourceKey: "evidence", operator: "gte", value: "2" }], "已有至少 2 条证据时，拼接线索获得更高收益。")
    ],
    engine: {
      version: 1,
      maxRounds: 6,
      map: {
        kind: "area_graph",
        nodes: [{ id: "archive-table", label: "中央档案桌", x: 50, y: 50, terrain: "archive", scoreValue: 4, description: "公开牌库数量、证据链与日志。" }],
        edges: []
      },
      phases: [{ id: "phase-archive", label: "档案行动", mode: "sequential", actionIds: ["action-draw", "action-clue", "action-connection", "action-pass"], description: "按席位顺序抽牌或打出线索；手牌上限为 5。" }],
      actions: [
        { id: "action-draw", label: "抽取线索", kind: "draw", phaseId: "phase-archive", target: "none", resourceKey: "deck", deckId: "component-clue-deck", amount: 1, description: "公共牌库 -1，当前席位手牌 +1。" },
        { id: "action-clue", label: "整理普通线索", kind: "play", phaseId: "phase-archive", target: "none", resourceKey: "hand", amount: 1, mechanismId: "mechanism-clue", description: "消耗 1 手牌，推进证据链。" },
        { id: "action-connection", label: "拼接证据链", kind: "play", phaseId: "phase-archive", target: "none", resourceKey: "hand", amount: 1, mechanismId: "mechanism-connection", description: "消耗 1 手牌；已有至少 2 证据时获得高额收益。" },
        { id: "action-pass", label: "整理档案", kind: "pass", phaseId: "phase-archive", target: "none", description: "保留手牌，等待更合适的拼接时机。" }
      ],
      setup: { unitsPerSeat: 0, startingNodeIds: [], seed: "echo-archive-v1" },
      roundEffects: [],
      endCondition: { type: "rounds", variableKey: "", operator: "gte", value: 6 },
      endConditions: [{ id: "end-truth", variableKey: "truth", operator: "gte", value: 8 }],
      information: "public"
    },
    rulebook: {
      objective: "六轮结束时，档案声望最高者获胜；真相进度达到 8 时提前完成档案并进入结算。",
      setup: "公共牌库有 24 张；每位玩家从 0 手牌、0 证据链和 0 档案声望开始。",
      turnStructure: "每轮按席位顺序进行一次档案行动：抽取线索、整理普通线索、拼接证据链或保留手牌；全部席位完成后进入下一轮。",
      playerActions: "抽牌消耗公共牌库并增加 1 手牌，手牌上限为 5；普通线索消耗 1 手牌并获得 1 证据与 2 声望；拥有至少 2 证据时可拼接证据链，获得 2 证据与 5 声望。",
      endCondition: "完成六轮、公共真相进度达到 8 或牌库耗尽时结束，比较档案声望。",
      tieBreak: "声望相同则比较个人证据链，再比较剩余手牌，仍相同则比较最后一次完成高价值拼接的席位顺序。",
      notes: "抽牌、手牌消耗、普通打牌和条件拼接均由引擎执行；逐张牌面与随机洗牌属于后续扩展，当前版本保持公开可审计。"
    },
    information: "public"
  });
}

export const BOARD_GAME_ARCHIVE_CATALOG = Object.freeze([
  { id: "echo-archive", label: "回声档案馆", summary: "抽牌构筑 · 证据拼接", create: createEchoArchiveDesign }
]);

export function createBoardGameArchivePreset(presetId = "echo-archive") {
  const preset = BOARD_GAME_ARCHIVE_CATALOG.find((item) => item.id === presetId) || BOARD_GAME_ARCHIVE_CATALOG[0];
  return preset.create();
}
