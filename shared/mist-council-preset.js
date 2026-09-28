import { normalizeBoardGameDesign } from "./board-game-design.js";

const entry = (id, name, description, quantity = 1) => ({ id, name, description, quantity });

function mechanism(id, name, effects, notes) {
  return {
    id,
    templateKey: "track_change",
    name,
    sourceComponentId: "component-council-chamber",
    trigger: "议案结算",
    conditionMode: "all",
    conditions: [],
    effects: effects.map((effect, index) => ({ id: `${id}-effect-${index + 1}`, ...effect })),
    notes
  };
}

export function createMistCouncilDesign() {
  return normalizeBoardGameDesign({
    version: 4,
    title: "雾中议会：灰烬法案",
    designGoal: "在六次公开表决中维持城市稳定并积累政治资本；每个席位根据自身判断支持或否决法案，AI 的倾向与公开局势同步变化。",
    playerCount: { min: 2, max: 4 },
    playTimeMinutes: 22,
    seats: [
      { id: "seat-civic", name: "民政院 · 城市修复派", sequence: 1 },
      { id: "seat-industrial", name: "铸炉会 · 扩张派", sequence: 2 },
      { id: "seat-watch", name: "雾灯监察署 · 风险派", sequence: 3 },
      { id: "seat-guild", name: "旧商公会 · 交易派", sequence: 4 }
    ],
    components: [
      {
        id: "component-council-chamber",
        type: "board",
        name: "雾中议会厅",
        quantity: 1,
        description: "中央议案台、城市稳定轨和法案进度轨；每轮所有席位同时提交支持或反对。",
        playerAction: "读取稳定度与法案进度，公开提交政治立场，并承担通过或否决的共同后果。",
        stateFields: [
          { id: "council-stability", label: "城市稳定", key: "stability", initialValue: "6 / 10" },
          { id: "council-laws", label: "通过法案", key: "laws", initialValue: "0 / 4" }
        ],
        entries: [],
        assets: [],
        notes: "这款原型先使用公开信息与公开表决验证多数机制；隐藏身份属于后续扩展，不在当前试玩中伪装实现。"
      },
      {
        id: "component-proposal-deck",
        type: "deck",
        name: "灰烬法案牌",
        quantity: 12,
        description: "实体版可为每轮提供不同议案语境；数字 V1 用同一议案流程测试表决和稳定度反馈。",
        playerAction: "公开议案、讨论、秘密提交立场、统一结算。",
        entries: [
          entry("proposal-water", "净水法案", "优先改善民生，降低短期扩张收益。", 2),
          entry("proposal-furnace", "铸炉法案", "提高生产能力，但增加城市压力。", 2),
          entry("proposal-watch", "雾灯法案", "提高监察能力，延缓危机。", 2),
          entry("proposal-guild", "商路法案", "用交易换取稳定与政治资本。", 2)
        ],
        assets: [],
        notes: "V1 先固定通过与否的公共效果；后续可将法案牌逐张接入不同机制。"
      },
      {
        id: "component-influence-pool",
        type: "token_pool",
        name: "政治资本标记",
        quantity: 60,
        description: "政治资本是个人分数，公开表决本身不消耗资源，避免投票权被单一资源垄断。",
        playerAction: "参与有效表决后获得政治资本，最终比较个人分数。",
        entries: [entry("influence", "政治资本", "法案通过时所有参与者获得的个人分数。", 60)],
        assets: [],
        notes: "后续扩展可以让提案者消耗政治资本改变议程。"
      },
      {
        id: "component-council-track",
        type: "track",
        name: "稳定与法案轨",
        quantity: 1,
        description: "稳定归零代表议会失败；通过四件法案代表城市进入新秩序。",
        playerAction: "根据每轮表决结果推进公共轨道。",
        entries: [],
        assets: [],
        notes: "公共轨道让所有席位看到同一局势，方便检测 AI 是否真的因局势改变立场。"
      }
    ],
    variables: [
      { id: "stability", label: "城市稳定", scope: "global", initialValue: 6, min: 0, max: 10 },
      { id: "laws", label: "通过法案", scope: "global", initialValue: 0, min: 0, max: 6 },
      { id: "influence", label: "政治资本", scope: "player", initialValue: 0, min: 0, max: 30 },
      { id: "score", label: "议会声望", scope: "player", initialValue: 0, min: 0, max: 30 }
    ],
    mechanisms: [
      mechanism("mechanism-law-pass", "法案通过", [
        { targetKey: "laws", operation: "add", value: "1" },
        { targetKey: "stability", operation: "add", value: "1" }
      ], "多数支持，城市获得一个新法案并恢复稳定。"),
      mechanism("mechanism-law-fail", "法案否决", [
        { targetKey: "stability", operation: "subtract", value: "1" }
      ], "平票或多数反对，议会失去时间并承受稳定损失。")
    ],
    engine: {
      version: 1,
      maxRounds: 6,
      map: {
        kind: "area_graph",
        nodes: [{ id: "council-floor", label: "议会中央席", x: 50, y: 50, terrain: "council", scoreValue: 1, description: "公开议案、立场与统一表决结果。" }],
        edges: []
      },
      phases: [{
        id: "phase-council-vote",
        label: "公开表决",
        mode: "reveal",
        deckId: "component-proposal-deck",
        actionIds: ["action-support", "action-oppose"],
        votePassMechanismId: "mechanism-law-pass",
        voteFailMechanismId: "mechanism-law-fail",
        description: "所有席位同时选择支持或反对，提交完成后公开统计。"
      }],
      actions: [
        { id: "action-support", label: "支持法案", kind: "vote", phaseId: "phase-council-vote", target: "none", amount: 1, description: "投出一票支持；若支持票严格多于反对票，法案通过。" },
        { id: "action-oppose", label: "反对法案", kind: "vote", phaseId: "phase-council-vote", target: "none", amount: -1, description: "投出一票反对；平票也视为法案否决。" }
      ],
      setup: { unitsPerSeat: 0, startingNodeIds: [] },
      roundEffects: [],
      endCondition: { type: "rounds", variableKey: "", operator: "gte", value: 6 },
      endConditions: [
        { id: "end-laws", variableKey: "laws", operator: "gte", value: 4 },
        { id: "end-collapse", variableKey: "stability", operator: "lte", value: 0 }
      ],
      information: "public"
    },
    rulebook: {
      objective: "六轮结束时，个人议会声望最高者获胜；若城市稳定归零，所有人先共同失败，再由声望最高者记录为危机中贡献最大者。",
      setup: "城市稳定从 6 开始；每位玩家拥有 0 政治资本与 0 议会声望；公开第一张灰烬法案。",
      turnStructure: "每轮公开当前议案与公共轨道，所有席位同时提交支持或反对；全部提交后统一统计，支持严格多于反对则通过，否则否决，然后进入下一轮。",
      playerActions: "玩家只能在每轮提交一个公开可验证的支持或反对立场。支持法案会推进公共进度，反对或平票会降低稳定。",
      endCondition: "完成六轮、通过四件法案或城市稳定归零时结束。",
      tieBreak: "多数票严格领先才算通过，平票自动否决；最终个人声望相同则比较政治资本，再比较最后一次改变公共稳定的表决记录。",
      notes: "当前版本是公开信息表决原型，不包含隐藏身份或私密手牌；这些能力必须等信息隔离层完成后再接入。"
    },
    information: "public"
  });
}

export const BOARD_GAME_COUNCIL_CATALOG = Object.freeze([
  { id: "mist-council", label: "雾中议会", summary: "公开表决 · 多数结算", create: createMistCouncilDesign }
]);

export function createBoardGameCouncilPreset(presetId = "mist-council") {
  const preset = BOARD_GAME_COUNCIL_CATALOG.find((item) => item.id === presetId) || BOARD_GAME_COUNCIL_CATALOG[0];
  return preset.create();
}
