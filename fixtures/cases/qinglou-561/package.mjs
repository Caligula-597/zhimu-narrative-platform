import { compileMechanismPackage } from "../../../shared/mechanism-package.js";
import {
  caseId as id,
  chapter,
  clue,
  edge,
  point,
  role,
  scene,
  section,
  wrapPackage,
} from "../case-package-helpers.mjs";

const NS = "b2222222-c222-4222-8222";

const roles = [
  role(id(NS, 1), "花魁阿月", "青楼头牌，掌控花名册。", "掌握拍卖底价与假账；需要双主持之一确认拍卖。", 1),
  role(id(NS, 2), "账房先生", "管银票与酒水账。", "货币分配者；可发现伪造令牌。", 2),
  role(id(NS, 3), "捕快老沈", "明面查案，暗持衙门令。", "可发起一次毁证；需协管签字。", 3),
  role(id(NS, 4), "龟公老周", "管搜证令牌与厢房钥匙。", "搜证耗尽规则执行人。", 4),
  role(id(NS, 5), "清倌人小桃", "新来的清倌，持私人手札。", "手札是平行物料册，不可拆成零散线索。", 5),
  role(id(NS, 6), "客人公子", "掷重金竞拍的外客。", "竞价与人情交换的核心。", 6),
];

const chapters = [
  chapter(id(NS, 101), "开场 · 花魁夜", "宴开，银票入场。", 1),
  chapter(id(NS, 102), "中场 · 搜厢与拍卖", "搜证耗尽与竞价并行。", 2),
  chapter(id(NS, 103), "终局 · 衙门令", "毁证/伪造与宣判。", 3),
];

const sections = roles.flatMap((entry, index) =>
  chapters.map((ch, day) =>
    section(
      id(NS, 200 + index * 10 + day + 1),
      entry.id,
      ch.id,
      `${entry.name} · ${ch.title}`,
      [
        `【${entry.name} · ${ch.title}】`,
        entry.private_profile,
        day === 0
          ? "你带着银票与秘密入场。注意谁在记账。"
          : day === 1
            ? "厢房可搜次数有限；拍卖开始后银票会快速消耗。"
            : "衙门令可毁一张账本。伪造被识破时原件与伪件同时公开。",
      ].join("\n"),
      day + 1,
    ),
  ),
);

const scenes = [
  scene(id(NS, 301), chapters[0].id, "花厅", "公开宴席。", "记录银票流向。"),
  scene(id(NS, 302), chapters[1].id, "东厢", "可搜证区域。", "最多有效搜查 2 次；耗尽后只剩残页。"),
  scene(id(NS, 303), chapters[1].id, "拍卖台", "竞价席位。", "协管盯账，主主持宣布成交。"),
  scene(id(NS, 304), chapters[2].id, "公堂角", "可宣读衙门令。", "毁证/伪造必须留审计。"),
];

const clues = [
  clue(id(NS, 401), "花名册封面", "当晚待客名单。", "公共"),
  clue(id(NS, 402), "东厢残账", "银票进出不符。", "搜证：东厢"),
  clue(id(NS, 403), "假令印痕", "印泥颜色不对。", "伪造识破路径"),
  clue(id(NS, 404), "手札摘录", "小桃手札中的一页。", "平行物料册摘录"),
  clue(id(NS, 405), "拍卖成交条", "密信被第二高价换走残页。", "竞价结果"),
  clue(id(NS, 406), "双主持备忘", "主主持管宣判；协管管拍卖账与搜证令牌。", "主持"),
  clue(id(NS, 407), "真账副本", "主持手册中的真账摘要。", "可被衙门令毁去公开件"),
  clue(id(NS, 408), "伪造令残页", "用衙门令资源伪造后留下的痕迹。", "伪造路径"),
];

const points = [
  point(id(NS, 501), scenes[1].id, clues[1].id, "搜查东厢", "消耗 1 枚搜证令牌。", "得到东厢残账。", 1, {
    maxUses: 2,
    costResourceKey: "search-token",
  }),
  point(id(NS, 502), scenes[2].id, clues[4].id, "旁听竞价", "记录成交，消耗银票旁听。", "得到拍卖成交条。", 1, {
    maxUses: 1,
    costResourceKey: "currency",
    costAmount: 2,
  }),
  point(id(NS, 503), scenes[3].id, clues[6].id, "宣读毁证", "消耗衙门令，毁去已公开账。", "真账公开件被毁，假令印痕可核对。", 1, {
    maxUses: 1,
    costResourceKey: "yamen-order",
    costAmount: 1,
  }),
];

const roleArchives = roles.map((entry) => ({
  roleSlotId: entry.id,
  externalGoal: "在花魁夜活下来并拿到对自己有利的账",
  secret: entry.private_profile,
  appearanceStates: [{ phaseLabel: "夜宴", appearance: entry.name, notes: "公开身份" }],
}));

const materialBooklets = [
  {
    packageSourceId: id(NS, 601),
    kind: "diary",
    title: "小桃手札",
    summary: "完整私人册，局内只发摘录页。",
    ownerRoleSlotId: roles[4].id,
    phaseLabel: "夜宴-宣判",
    visibility: "owner_role",
    pages: [
      { title: "封面", body: "勿拆散阅读。" },
      { title: "夜宴", body: "有人用假令换走真账。" },
      { title: "拍卖", body: "第二高价换走的残页写着「假印」。" },
    ],
    linkedClueIds: [clues[3].id],
    sequence: 1,
  },
  {
    packageSourceId: id(NS, 602),
    kind: "manual",
    title: "双主持手册",
    summary: "青楼双 DM 分工与毁证规则。",
    visibility: "host_only",
    pages: [
      { title: "分工", body: "主主持：宣判与身份。协管：拍卖账本与搜证令牌。" },
      { title: "毁证", body: "衙门令可毁一张已公开账；真账仍留主持手册。" },
      { title: "伪造", body: "伪造令被识破时，原件与伪件同时公开。" },
    ],
    linkedClueIds: [clues[5].id, clues[6].id],
    sequence: 2,
  },
  {
    packageSourceId: id(NS, 603),
    kind: "catalog",
    title: "酒水价目",
    summary: "经济循环参考。",
    visibility: "public_table",
    pages: [{ title: "价目", body: "清酒 2 银，花酒 5 银，包厢 10 银。" }],
    linkedClueIds: [],
    sequence: 3,
  },
  {
    packageSourceId: id(NS, 604),
    kind: "catalog",
    title: "花名册对照",
    summary: "花魁与清倌对照，共享给相关角色。",
    visibility: "shared_roles",
    pages: [
      { title: "当晚", body: "阿月坐头牌；小桃为新清倌。" },
      { title: "禁忌", body: "花名册不可私下涂改。" },
    ],
    linkedClueIds: [clues[0].id],
    sequence: 4,
  },
];

const mechanismPackage = compileMechanismPackage({
  semanticConstitution: {
    facts: [],
    authorizationGrants: [],
    branchEvents: [],
    worldRules: [
      { key: "search-depletion", statement: "搜证令牌耗尽后只能拿到残页" },
      { key: "auction-currency", statement: "银票用于拍卖与旁听" },
      { key: "yamen-order-once", statement: "衙门令可毁证或伪造一次，须协管确认" },
    ],
  },
  causalTimeline: [],
  entities: [
    { key: "flower-hall", type: "location", name: "花厅" },
    { key: "east-room", type: "location", name: "东厢" },
    { key: "auction-stage", type: "location", name: "拍卖台" },
    { key: "yamen-corner", type: "location", name: "公堂角" },
  ],
  resources: [
    {
      key: "search-token",
      name: "搜证令牌",
      valueType: "integer",
      initialValue: 8,
      minimum: 0,
      maximum: 99,
    },
    {
      key: "currency",
      name: "银票",
      valueType: "integer",
      initialValue: 20,
      minimum: 0,
    },
    {
      key: "yamen-order",
      name: "衙门令",
      valueType: "integer",
      initialValue: 1,
      minimum: 0,
      maximum: 1,
    },
  ],
  players: roles.map((entry) => ({ key: entry.id, name: entry.name })),
  evidenceGraph: {
    evidence: [
      {
        key: "east-ledger",
        label: "东厢残账",
        availableChapterKey: "banquet",
        obtainedBy: "搜查",
        methodOperation: "翻找",
        artifactProduced: "残账",
        originRootKeys: ["east-room"],
        storageEntityKey: "east-room",
        maxUses: 2,
        costResourceKey: "search-token",
        costAmount: 1,
      },
      {
        key: "auction-slip",
        label: "拍卖成交条",
        availableChapterKey: "auction",
        obtainedBy: "旁听",
        methodOperation: "记录",
        artifactProduced: "成交条",
        originRootKeys: ["auction-stage"],
        storageEntityKey: "auction-stage",
        maxUses: 1,
        costResourceKey: "currency",
        costAmount: 2,
      },
      {
        key: "destroy-ledger",
        label: "毁去公开账",
        availableChapterKey: "verdict",
        obtainedBy: "衙门令",
        methodOperation: "毁证",
        artifactProduced: "毁证记录",
        originRootKeys: ["yamen-corner"],
        storageEntityKey: "yamen-corner",
        maxUses: 1,
        costResourceKey: "yamen-order",
        costAmount: 1,
      },
      {
        key: "forge-order",
        label: "伪造令残页",
        availableChapterKey: "verdict",
        obtainedBy: "衙门令",
        methodOperation: "伪造",
        artifactProduced: "伪令痕迹",
        originRootKeys: ["yamen-corner"],
        storageEntityKey: "yamen-corner",
        maxUses: 1,
        costResourceKey: "yamen-order",
        costAmount: 1,
      },
    ],
    conclusions: [],
  },
  chapterBeats: [
    {
      chapterKey: "banquet",
      title: "花魁夜",
      stateReads: [],
      stateWrites: [],
      resourceDeltas: [],
      evidenceKeys: ["east-ledger"],
      unlocksEvidenceKeys: [],
      locksEvidenceKeys: [],
    },
    {
      chapterKey: "auction",
      title: "搜厢与拍卖",
      stateReads: [],
      stateWrites: [],
      resourceDeltas: [],
      evidenceKeys: ["auction-slip"],
      unlocksEvidenceKeys: [],
      locksEvidenceKeys: [],
    },
    {
      chapterKey: "verdict",
      title: "衙门令",
      stateReads: [],
      stateWrites: [],
      resourceDeltas: [],
      evidenceKeys: ["destroy-ledger", "forge-order"],
      unlocksEvidenceKeys: [],
      locksEvidenceKeys: [],
    },
  ],
  endingLogic: {
    stateVariables: [],
    routes: [
      {
        key: "ending-default",
        title: "花魁夜落幕",
        priority: 0,
        isDefault: true,
        requirements: [],
      },
    ],
    roleEpilogues: [],
    defaultRouteKey: "ending-default",
    conflictResolution: "",
  },
  misdirections: [],
});

const miniGameTemplates = [
  {
    id: "qinglou-lock",
    pluginKey: "zhimu_lock",
    title: "账房柜锁",
    prompt: "输入四位柜锁密码。",
    hint: "花魁夜编号。",
    answer: "5610",
    length: 4,
    maxAttempts: 3,
    allowRecovery: true,
  },
  {
    id: "qinglou-sequence",
    pluginKey: "zhimu_sequence",
    title: "酒水上菜顺序",
    prompt: "按正确顺序提交上菜步骤（逗号分隔）。",
    hint: "先清后花，再点心结账。",
    answer: "清酒,花酒,点心,结账",
    maxAttempts: 3,
    allowRecovery: true,
  },
];

const data = {
  world: {
    name: "561青楼（结构化导入）",
    summary:
      "双主持、拍卖经济、搜证耗尽、毁证伪造与平行手札。PDF 扫描件不直接 OCR；本包提供可导入体验结构。",
  },
  roles,
  chapters,
  sections,
  scenes,
  clues,
  investigationPoints: points,
  edges: [
    edge("scene", scenes[1].id, "clue", clues[1].id),
    edge("scene", scenes[2].id, "clue", clues[4].id),
    edge("scene", scenes[3].id, "clue", clues[6].id),
  ],
  rules: [],
  items: [],
  roleArchives,
  materialBooklets,
  mechanismPackage,
  miniGameTemplates,
  hostNotes: {
    dualHost: "主主持管宣判与身份；协管管拍卖账与搜证令牌。毁证/伪造须协管签字。",
    economy: "银票初始 20；拍卖流拍则入公共池。",
  },
};

export const qinglouCasePackage = wrapPackage(data, {
  caseKey: "qinglou-561",
  title: "561青楼",
  sourceFolder: "案例/561青楼",
});

export default qinglouCasePackage;
