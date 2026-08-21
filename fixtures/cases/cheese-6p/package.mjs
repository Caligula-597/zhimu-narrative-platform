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

const NS = "a1111111-b111-4111-8111";

const roles = [
  role(id(NS, 1), "哑巴姑娘", "不善言辞的姑娘，总盯着镜中人。", "真身在第三日才会显露；日记写满对「镜」的恐惧。", 1),
  role(id(NS, 2), "小女孩", "活泼的孩子，手里总有花草标本。", "掌握花草目录的私人注解；知道谁换过外形。", 2),
  role(id(NS, 3), "小男孩", "爱唱歌的男孩，口袋里有半截歌单。", "歌谜答案持有者之一；第一日外形不是他本人。", 3),
  role(id(NS, 4), "胡子叔叔", "稳重的中年人，自称照看孩子们。", "组织者手册关键页持有者；知道换身规则。", 4),
  role(id(NS, 5), "金发少女", "明艳的少女，喜欢照镜子。", "镜目录私人页；与哑巴姑娘外形有交叉日。", 5),
  role(id(NS, 6), "黑发少女", "安静的少女，日记字迹与封面不同。", "日记被调包过；真身线索在第三日。", 6),
];

const chapters = [
  chapter(id(NS, 101), "第一日 · 初遇奶酪", "众人发现奶酪失踪，外形尚未错乱。", 1),
  chapter(id(NS, 102), "第二日 · 换身疑云", "外形错位，日记与镜目录成为关键。", 2),
  chapter(id(NS, 103), "第三日 · 歌谜与真相", "歌谜机关与真身对质。", 3),
];

const sections = roles.flatMap((entry, index) =>
  chapters.map((ch, day) =>
    section(
      id(NS, 200 + index * 10 + day + 1),
      entry.id,
      ch.id,
      `${entry.name} · ${ch.title}`,
      [
        `【${entry.name} 第${day + 1}日私人剧本】`,
        entry.private_profile,
        day === 0
          ? "你记得自己醒来时外形仍是「自己」。奶酪不在原处。"
          : day === 1
            ? "你发现镜中人的五官与昨日不同。请对照外形表与日记。"
            : "今日必须决定是否公开真身。歌谜可能换回关键信物。",
      ].join("\n"),
      day + 1,
    ),
  ),
);

const scenes = [
  scene(id(NS, 301), chapters[0].id, "起居厅", "众人的公共讨论区。", "核对外形表；不要提前公开真身。"),
  scene(id(NS, 302), chapters[0].id, "花园", "可以搜证的户外区域。", "搜证次数有限；耗尽后只剩残页。"),
  scene(id(NS, 303), chapters[1].id, "镜廊", "挂着多面镜子的走廊。", "发放镜目录页；注意外形错位。"),
  scene(id(NS, 304), chapters[2].id, "琴房", "可启动歌谜小游戏。", "启动歌猜；失败可恢复一次。"),
];

const clues = [
  clue(id(NS, 401), "奶酪空盘", "托盘空了，只剩齿痕。", "公共开场线索"),
  clue(id(NS, 402), "花园残叶", "叶子背面有泥指纹。", "搜证：花园"),
  clue(id(NS, 403), "镜目录·残页", "目录写着「D2 金发」。", "来自镜目录物料册摘录"),
  clue(id(NS, 404), "日记·调包页", "字迹与封面主人不符。", "来自黑发少女日记摘录"),
  clue(id(NS, 405), "歌单半截", "副歌缺了三个字。", "歌谜提示"),
  clue(id(NS, 406), "组织者备忘", "换身以日结算；真身仅主持与本人可见。", "主持提示"),
  clue(id(NS, 407), "花草目录·注释", "某朵花只在换身夜开放。", "来自花草目录"),
  clue(id(NS, 408), "琴房密码条", "四位数字来自收据末位。", "密码锁提示"),
];

const points = [
  point(id(NS, 501), scenes[1].id, clues[1].id, "翻找花圃", "消耗 1 次搜证，翻找花园。", "找到花园残叶。", 1, { maxUses: 2 }),
  point(id(NS, 502), scenes[2].id, clues[2].id, "核对镜目录", "消耗 1 次搜证，查阅镜廊目录。", "得到镜目录残页。", 1, { maxUses: 2 }),
  point(id(NS, 503), scenes[3].id, clues[4].id, "整理歌单", "在琴房寻找歌单碎片。", "得到歌单半截。", 1, { maxUses: 1 }),
];

const roleArchives = roles.map((entry, index) => ({
  roleSlotId: entry.id,
  externalGoal: "找回奶酪并弄清换身真相",
  secret: entry.private_profile,
  appearanceStates: [
    { phaseLabel: "D1", appearance: `${entry.name}（本貌）`, notes: "第一日外形稳定" },
    { phaseLabel: "D2", appearance: roles[(index + 2) % roles.length].name, notes: "第二日外形错位" },
    { phaseLabel: "D3", appearance: roles[(index + 4) % roles.length].name, notes: "第三日需对质真身" },
  ],
}));

const materialBooklets = [
  {
    packageSourceId: id(NS, 601),
    kind: "diary",
    title: "哑巴姑娘的日记",
    summary: "平行日记册，局内按页发放摘录。",
    ownerRoleSlotId: roles[0].id,
    phaseLabel: "D1-D3",
    visibility: "owner_role",
    pages: [
      { title: "封面", body: "日记本封面写着「不要照镜子」。" },
      { title: "D1", body: "奶酪还在。我不敢说话。" },
      { title: "D2", body: "镜中人不是我。" },
    ],
    linkedClueIds: [clues[3].id],
    sequence: 1,
  },
  {
    packageSourceId: id(NS, 602),
    kind: "catalog",
    title: "镜目录",
    summary: "外形对照图鉴。",
    visibility: "host_only",
    pages: [
      { title: "用法", body: "按日对照谁看起来像谁。" },
      { title: "D2 记录", body: "金发栏被涂改过。" },
    ],
    linkedClueIds: [clues[2].id],
    sequence: 2,
  },
  {
    packageSourceId: id(NS, 603),
    kind: "catalog",
    title: "花草目录",
    summary: "小女孩的标本册。",
    ownerRoleSlotId: roles[1].id,
    visibility: "owner_role",
    pages: [{ title: "夜开花", body: "只在换身夜开放。" }],
    linkedClueIds: [clues[6].id],
    sequence: 3,
  },
  {
    packageSourceId: id(NS, 604),
    kind: "manual",
    title: "组织者手册",
    summary: "主持双人分工与换身规则。",
    visibility: "host_only",
    pages: [
      { title: "双主持", body: "主主持管外形表与宣判；协管管搜证次数与歌谜。" },
      { title: "换身", body: "真身固定；外形按日变化。玩家只看见当日外形。" },
    ],
    linkedClueIds: [clues[5].id],
    sequence: 4,
  },
];

const mechanismPackage = compileMechanismPackage({
  semanticConstitution: {
    facts: [],
    authorizationGrants: [],
    branchEvents: [],
    worldRules: [
      { key: "body-swap-by-day", statement: "换身以日结算" },
      { key: "search-depletion", statement: "搜证次数耗尽后只能拿到残页" },
    ],
  },
  causalTimeline: [],
  entities: [
    { key: "hall", type: "location", name: "起居厅" },
    { key: "garden", type: "location", name: "花园" },
    { key: "mirror-hall", type: "location", name: "镜廊" },
    { key: "music-room", type: "location", name: "琴房" },
  ],
  resources: [
    {
      key: "search-token",
      name: "搜证次数",
      valueType: "integer",
      initialValue: 6,
      minimum: 0,
      maximum: 99,
    },
    {
      key: "currency",
      name: "点心券",
      valueType: "integer",
      initialValue: 0,
      minimum: 0,
    },
  ],
  players: roles.map((entry) => ({ key: entry.id, name: entry.name })),
  evidenceGraph: {
    evidence: [
      {
        key: "garden-leaf",
        label: "花园残叶",
        availableChapterKey: "day1",
        obtainedBy: "搜查",
        methodOperation: "翻找",
        artifactProduced: "残叶",
        originRootKeys: ["garden"],
        storageEntityKey: "garden",
        maxUses: 2,
        costResourceKey: "search-token",
        costAmount: 1,
      },
      {
        key: "mirror-page",
        label: "镜目录残页",
        availableChapterKey: "day2",
        obtainedBy: "搜查",
        methodOperation: "核对",
        artifactProduced: "残页",
        originRootKeys: ["mirror-hall"],
        storageEntityKey: "mirror-hall",
        maxUses: 2,
        costResourceKey: "search-token",
        costAmount: 1,
      },
    ],
    conclusions: [],
  },
  chapterBeats: [
    {
      chapterKey: "day1",
      title: "第一日",
      stateReads: [],
      stateWrites: [],
      resourceDeltas: [],
      evidenceKeys: ["garden-leaf"],
      unlocksEvidenceKeys: [],
      locksEvidenceKeys: [],
    },
    {
      chapterKey: "day2",
      title: "第二日",
      stateReads: [],
      stateWrites: [],
      resourceDeltas: [],
      evidenceKeys: ["mirror-page"],
      unlocksEvidenceKeys: [],
      locksEvidenceKeys: [],
    },
    {
      chapterKey: "day3",
      title: "第三日",
      stateReads: [],
      stateWrites: [],
      resourceDeltas: [],
      evidenceKeys: [],
      unlocksEvidenceKeys: [],
      locksEvidenceKeys: [],
    },
  ],
  endingLogic: {
    stateVariables: [],
    routes: [
      {
        key: "ending-default",
        title: "奶酪真相",
        priority: 0,
        isDefault: true,
        requirements: [],
      },
    ],
    roleEpilogues: [],
  },
});

const miniGameTemplates = [
  {
    id: "cheese-song-guess",
    pluginKey: "zhimu_guess",
    title: "奶酪歌谜",
    prompt: "根据副歌缺字，猜出曲名。",
    hint: "缺的三个字与「镜子」有关。",
    answer: "镜中人",
    maxAttempts: 3,
    allowRecovery: true,
    successText: "歌谜解开，可发放镜片线索。",
    failureText: "歌谜暂未解开，请等待主持恢复。",
  },
  {
    id: "cheese-lock",
    pluginKey: "zhimu_lock",
    title: "琴房柜锁",
    prompt: "输入四位密码。",
    hint: "收据末位。",
    answer: "2517",
    length: 4,
    maxAttempts: 3,
    allowRecovery: true,
  },
];

const data = {
  world: {
    name: "谁动了我的奶酪（结构化导入）",
    summary:
      "6 人换身本。扫描件 JPG 留作线下物料；本包提供角色分幕、外形矩阵、平行物料册、搜证耗尽、歌谜与双主持说明，可导入后直接开房体验。",
  },
  roles,
  chapters,
  sections,
  scenes,
  clues,
  investigationPoints: points,
  edges: [
    edge("scene", scenes[1].id, "clue", clues[1].id),
    edge("scene", scenes[2].id, "clue", clues[2].id),
    edge("scene", scenes[3].id, "clue", clues[4].id),
  ],
  rules: [],
  items: [],
  roleArchives,
  materialBooklets,
  mechanismPackage,
  miniGameTemplates,
  hostNotes: {
    dualHost: "主主持：外形表、真身对质、宣判。协管：搜证次数、歌谜/密码锁、物料册发放。",
    opening: "先发公共奶酪空盘，再按角色发放日记封面。",
  },
};

export const cheeseCasePackage = wrapPackage(data, {
  caseKey: "cheese-6p",
  title: "谁动了我的奶酪",
  sourceFolder: "案例/谁动了我的奶酪 6人",
});

export default cheeseCasePackage;
