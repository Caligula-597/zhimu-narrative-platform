/**
 * Generate a matrix-pipeline pilot example into examples/pending-review/.
 * NOT imported to OFFICIAL_EXAMPLE_WORLD_ID — for author review only.
 *
 * Usage:
 *   node backend/scripts/generate-matrix-pilot-example.mjs
 *   node backend/scripts/generate-matrix-pilot-example.mjs --offline   # skip API, write curated fixture
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deepseekConfig, resolveCreativePipeline } from "../src/deepseek.js";
import { renderHumanReviewFiles } from "./matrix-pilot-review-render.mjs";
import {
  buildPipelineImportPackage,
  createPipelineCharacterArchives,
  createPipelineHostRunbooksAll,
  createPipelineInfoMatrix,
  createPipelineMatrixEvaluation,
  createPipelineMatrixPlayerScript,
  createPipelineTruthBible
} from "../src/pipeline-matrix-deepseek.js";
import { buildProposalFromMatrix } from "../src/pipeline-matrix-model.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const backendRoot = join(root, "backend");
const slug = "雾港回声";
const outDir = join(root, "examples", "pending-review", slug);

for (const file of [join(backendRoot, ".env"), join(root, ".env"), join(root, ".env.staging")]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const offline = process.argv.includes("--offline");

const baseInput = {
  setting: {
    theme: "雾港回声",
    playerCount: 4,
    chapterCount: 3,
    wordsPerChapter: 2400,
    volumeTier: "demo",
    pov: "second",
    tone: "潮湿、克制、本格推理；少形容词堆砌",
    styleAnchor:
      "你推开那扇漆皮起皱的门，盐雾立刻灌进肺里。走廊尽头有人低声说话，你听不清内容，只看见灯芯在风里抖。\n\n他把证物袋放在桌上，没有急着开口。你注意到他指节发白——不是紧张，是冻的。",
    forbiddenPhrases: "不禁\n不由得\n原来如此\n真相大白\n细思极恐",
    extraConflicts: "四人彼此有旧怨，但都不是冲动型凶手；禁止超自然解释。"
  },
  synopsis: {
    body:
      "暴雨夜，离岸灯塔「回声站」与大陆失联。值守员周沉在灯室被发现坠亡，门从内反锁。四名临时登岛者各持登岛理由：补给员、气象记录员、电台检修工、遗产律师。潮声掩盖了作案时间，而真正的手法藏在灯塔旋转机构与旧日志之间。",
    charactersSketch: "周沉（死者）与律师有未结遗嘱；检修工曾与死者争执频率干扰；记录员掌握一份被涂改的气象表；补给员携带多余的一枚钥匙胚。",
    truthSketch: "凶手利用灯体旋转间隙制造「不可能坠点」，并非推落而是诱使死者自行踏入检修暗格。",
    redHerringsSketch: "碎裂的护目镜、被撕页的气象日志、错误的潮位表。"
  }
};

function writeJson(rel, data) {
  const path = join(outDir, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeText(rel, text) {
  const path = join(outDir, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

async function step(label, fn) {
  const started = Date.now();
  process.stdout.write(`\n▶ ${label} … `);
  const result = await fn();
  console.log(`OK (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  return result;
}

function offlineFixture() {
  const { setting, synopsis, config } = resolveCreativePipeline(baseInput);
  const truthBible = {
    summary:
      "周沉并非被推落灯室，而是被诱导进入旋转机构下方的检修暗格。凶手提前调整灯体转速计数，使「整点巡视」与真实时间错位；当死者按习惯在错误时刻独自上灯室，地板暗格在旋转间隙打开，死者坠入下方货仓并因头撞锚链昏迷，随后被补刀。真凶是电台检修工方策：周沉掌握其私自改频、向走私船发暗号的证据，方策以「修天线」为由骗死者测试旋转机构。律师顾晚、记录员林潮、补给员唐野均非凶手，但各自隐瞒了登岛当夜的私会。",
    victim: "灯塔值守员周沉",
    killer: "role-3",
    method: "利用灯塔旋转机构暗格与时间错位，诱使死者自行坠入后补刀",
    motive: "灭口以掩盖私自改频向走私船发暗号",
    timeline: [
      { id: "t-1", time: "19:40", event: "暴雨切断海底电缆，四人登岛", participants: ["role-1", "role-2", "role-3", "role-4"] },
      { id: "t-2", time: "21:10", event: "周沉与方策在灯室争执频率干扰", participants: ["role-3"] },
      { id: "t-3", time: "22:05", event: "林潮涂改气象表页被周沉撞见", participants: ["role-2"] },
      { id: "t-4", time: "23:30", event: "周沉按错误表盘时间独自上灯室", participants: [] },
      { id: "t-5", time: "23:33", event: "暗格开启，周沉坠入货仓", participants: [] },
      { id: "t-6", time: "23:40", event: "方策以检修名义进入货仓补刀", participants: ["role-3"] }
    ],
    misdirections: [
      { layer: 1, surface: "护目镜碎在栏杆旁", misleading: "像扭打推落", resolution: "碎于 earlier 检修，被方策移置" },
      { layer: 2, surface: "气象表被撕页", misleading: "林潮灭迹", resolution: "林潮只改潮位掩盖私会，未杀人" },
      { layer: 3, surface: "反锁门", misleading: "密室他杀", resolution: "死者入内时自锁，暗格坠落后门仍内锁" }
    ],
    spoilerGates: [
      { actKey: "ch1", forbiddenFacts: ["暗格存在", "方策改频", "真实死亡时间在23:33"] },
      { actKey: "ch2", forbiddenFacts: ["补刀", "走私暗号"] },
      { actKey: "ch3", forbiddenFacts: [] }
    ],
    hostNotes: "第一幕只给物理线索；第二幕开放时间矛盾；第三幕允许还原手法。",
    suggestions: ["复核四人私会是否与玩家任务冲突"]
  };
  const characterArchives = {
    roles: [
      {
        key: "role-1",
        name: "顾晚",
        publicIdentity: "遗产律师，受家属委托清点灯塔资产",
        hiddenIdentity: "曾与周沉有婚约破裂史，登岛当夜去档案室取旧信",
        motive: "避免遗嘱不利条目曝光",
        relationships: "与唐野有业务往来；不信任方策",
        timelineActions: "21:00-21:40 档案室，22:20 与唐野甲板私会",
        innerConflict: "想查真相又怕私情曝光",
        voiceHints: "措辞精确，少情绪词",
        lies: ["称整晚未离开过起居室"],
        actTasks: [
          { actKey: "ch1", tasks: ["整理周沉遗物清单", "询问三人登岛目的"], tips: "别主动提婚约" },
          { actKey: "ch2", tasks: ["核对遗嘱与时间线", "指出气象表异常"], tips: "可怀疑林潮但无实锤" },
          { actKey: "ch3", tasks: ["在投票前说明档案室见闻"], tips: "第三幕可公开私会" }
        ]
      },
      {
        key: "role-2",
        name: "林潮",
        publicIdentity: "气象记录员，补录失联前72小时数据",
        hiddenIdentity: "涂改潮位以掩盖与外部联络人接货",
        motive: "保护接货窗口",
        relationships: "被周沉掌握涂改证据",
        timelineActions: "20:50 改表，22:50 放潮位假条",
        innerConflict: "怕担刑责",
        voiceHints: "句子短，常用数据词",
        lies: ["声称气象表完整无缺页"],
        actTasks: [
          { actKey: "ch1", tasks: ["提交72小时气象摘要", "解释撕页为潮雾侵蚀"], tips: "坚持非人为撕毁" },
          { actKey: "ch2", tasks: ["对比灯室表盘与记录表", "提出时间错位假设"], tips: "可转向机械故障" },
          { actKey: "ch3", tasks: ["公开涂改原因（接货，与命案无关）"], tips: "强调未进灯室" }
        ]
      },
      {
        key: "role-3",
        name: "方策",
        publicIdentity: "电台检修工，检修备用天线",
        hiddenIdentity: "私自改频向走私船发暗号；真凶",
        motive: "灭口",
        relationships: "与周沉技术争执",
        timelineActions: "21:10 争执，23:35 货仓补刀，23:50 洗净工具",
        innerConflict: "必须维持技术权威形象",
        voiceHints: "爱用专业术语，回避情感",
        lies: ["称23:00后一直在电台室"],
        actTasks: [
          { actKey: "ch1", tasks: ["说明频率干扰来自旧天线", "提供检修记录"], tips: "引导怀疑设备老化" },
          { actKey: "ch2", tasks: ["演示旋转机构「安全」", "暗示死者操作失误"], tips: "勿提前提暗格" },
          { actKey: "ch3", tasks: ["若被指控，先否认再要求证据链"], tips: "真凶位，保持冷静" }
        ]
      },
      {
        key: "role-4",
        name: "唐野",
        publicIdentity: "补给员，运送燃料与淡水",
        hiddenIdentity: "多带一枚钥匙胚，计划偷换燃料账本",
        motive: "账本造假牟利",
        relationships: "与顾晚甲板私会",
        timelineActions: "22:20 甲板私会，23:10 库房",
        innerConflict: "贪利但不杀人",
        voiceHints: "口语化，带码头俚语",
        lies: ["否认与顾晚单独见过面"],
        actTasks: [
          { actKey: "ch1", tasks: ["清点补给单", "解释钥匙胚为备用"], tips: "钥匙非灯室钥匙" },
          { actKey: "ch2", tasks: ["协助搜查货仓", "报告闻到柴油味"], tips: "可牵出方策工具箱" },
          { actKey: "ch3", tasks: ["说明私会为账本，与命案无关"], tips: "可作时间证人" }
        ]
      }
    ],
    suggestions: ["方策 task 勿写「你是凶手」"]
  };
  const infoMatrix = {
    clues: [
      { key: "clue-1", name: "碎裂护目镜", description: "栏杆旁有新鲜玻璃渣，与灯室备用护目镜型号不符", actKey: "ch1", grantMode: "auto" },
      { key: "clue-2", name: "撕页气象表", description: "潮位记录缺22:00-23:00一页，边缘有指甲刮痕", actKey: "ch1", grantMode: "auto" },
      { key: "clue-3", name: "旋转计数差", description: "灯体机械计数比表盘慢6分钟", actKey: "ch2", grantMode: "host_confirm" },
      { key: "clue-4", name: "货仓锚链血渍", description: "锚链下部有擦拭痕迹，柴油味掩盖", actKey: "ch2", grantMode: "explore" },
      { key: "clue-5", name: "改频日志", description: "电台备份日志显示非授权频率发射23:12", actKey: "ch3", grantMode: "host_confirm" },
      { key: "clue-6", name: "暗格机关", description: "灯室地板下有与旋转联动的检修暗格", actKey: "ch3", grantMode: "host_confirm" }
    ],
    rows: [
      { roleKey: "role-1", actKey: "ch1", newClueIds: ["clue-1"], suspicion: "方策与死者争执", forbidden: "婚约细节", lies: ["整晚在起居室"], tasks: ["整理遗物"], misbeliefs: "以为是普通坠亡" },
      { roleKey: "role-2", actKey: "ch1", newClueIds: ["clue-2"], suspicion: "顾晚进过档案室", forbidden: "涂改真实原因", lies: ["表页自然脱落"], tasks: ["提交气象摘要"], misbeliefs: "以为撕页会被当成凶手" },
      { roleKey: "role-3", actKey: "ch1", newClueIds: [], suspicion: "林潮改数据", forbidden: "改频与暗格", lies: ["23:00后在电台室"], tasks: ["解释频率干扰"], misbeliefs: "认为暗格不会被发现" },
      { roleKey: "role-4", actKey: "ch1", newClueIds: [], suspicion: "林潮接货", forbidden: "账本造假", lies: ["未与顾晚单独见面"], tasks: ["清点补给"], misbeliefs: "钥匙胚会被当成凶器" },
      { roleKey: "role-1", actKey: "ch2", newClueIds: ["clue-3"], suspicion: "机械故障说法", forbidden: "23:40前不在场证明", lies: [], tasks: ["对比表盘"], misbeliefs: "" },
      { roleKey: "role-2", actKey: "ch2", newClueIds: [], suspicion: "方策演示机构", forbidden: "", lies: [], tasks: ["提出时间错位"], misbeliefs: "" },
      { roleKey: "role-3", actKey: "ch2", newClueIds: ["clue-4"], suspicion: "唐野进过货仓", forbidden: "补刀", lies: [], tasks: ["演示旋转安全"], misbeliefs: "" },
      { roleKey: "role-4", actKey: "ch2", newClueIds: [], suspicion: "方策工具箱", forbidden: "", lies: [], tasks: ["报告柴油味"], misbeliefs: "" },
      { roleKey: "role-1", actKey: "ch3", newClueIds: ["clue-5", "clue-6"], suspicion: "方策改频", forbidden: "", lies: [], tasks: ["汇总证据链"], misbeliefs: "" },
      { roleKey: "role-2", actKey: "ch3", newClueIds: [], suspicion: "", forbidden: "", lies: [], tasks: ["说明涂改与命案无关"], misbeliefs: "" },
      { roleKey: "role-3", actKey: "ch3", newClueIds: [], suspicion: "", forbidden: "直接认罪", lies: [], tasks: ["要求完整证据"], misbeliefs: "" },
      { roleKey: "role-4", actKey: "ch3", newClueIds: [], suspicion: "", forbidden: "", lies: [], tasks: ["说明甲板私会时间"], misbeliefs: "" }
    ],
    actTitles: { ch1: "风暴登岛", ch2: "错位时刻", ch3: "灯下的暗格" },
    actSummaries: {
      ch1: "发现周沉坠亡，四人互相试探",
      ch2: "时间线与机械疑点浮现",
      ch3: "还原改频、暗格与补刀链"
    },
    suggestions: ["host 第二幕后再发 clue-3"]
  };
  const hostRunbooks = [
    {
      actKey: "ch1",
      title: "风暴登岛",
      flow: "1. 宣读登岛背景 2. 发现尸体 3. 发放 clue-1/2 4. 私聊任务",
      hostTruth: "死者已死，真凶方策在场。勿透露暗格。",
      clueGrants: [{ clueId: "clue-1", when: "搜检栏杆后" }, { clueId: "clue-2", when: "讨论气象表后" }],
      fallbacks: ["若冷场，让补给员报告钥匙胚"]
    },
    {
      actKey: "ch2",
      title: "错位时刻",
      flow: "1. 公聊时间线 2. 方策演示机构 3. 发放 clue-3/4",
      hostTruth: "计数差6分钟是关键。",
      clueGrants: [{ clueId: "clue-3", when: "争论表盘后" }, { clueId: "clue-4", when: "搜查货仓后" }],
      fallbacks: ["若指认林潮，提醒涂改≠杀人"]
    },
    {
      actKey: "ch3",
      title: "灯下的暗格",
      flow: "1. 还原投票 2. 发放 clue-5/6 3. 复盘",
      hostTruth: "完整链：改频灭口+暗格+补刀。",
      clueGrants: [{ clueId: "clue-5", when: "电台日志环节" }, { clueId: "clue-6", when: "灯室复现" }],
      fallbacks: ["若证据不足，提示柴油味与工具箱"]
    }
  ];
  const scriptBody = (roleName, actTitle, paragraphs) => ({
    title: `${actTitle} · ${roleName}私人本`,
    body: paragraphs.join("\n\n"),
    tasks: [`本幕：${actTitle}`],
    closingHook: "灯声又响了一次。"
  });
  const scripts = {
    "role-1": {
      ch1: scriptBody("顾晚", "风暴登岛", [
        "你踏上回声站时，鞋里还夹着码头的机油味。周沉的名字在律师公文里出现过太多次，你原以为只是清点资产，直到他的尸体在灯室下方被抬出来。",
        "你保持在场证明：19:40登岛，21:00至21:40在档案室。你知道方策与周沉吵过，但不想先提婚约——那会让所有人看你。",
        "你捡到护目镜碎渣时，指节发凉。那不是周沉常戴的那副。"
      ]),
      ch2: scriptBody("顾晚", "错位时刻", [
        "表盘比机械计数快六分钟。你反复核对，这不是记录员的小错误，而是有人动过灯体。",
        "唐野在甲板上的私会你必须在第三幕前守住；账本的事与命案无关，却足够毁掉你的信誉。",
        "方策演示旋转机构时语气温和，你注意到他避开「暗格」这个词。"
      ]),
      ch3: scriptBody("顾晚", "灯下的暗格", [
        "电台日志把方策钉在23:12。你把这些交给众人，要求完整链条，而不是情绪投票。",
        "你公开了档案室与甲板私会——为账本，不为杀人。",
        "灯室地板下的暗格打开时，你终于明白：周沉是走进陷阱，不是被推。"
      ])
    },
    "role-2": {
      ch1: scriptBody("林潮", "风暴登岛", [
        "你负责补录72小时数据。潮位表缺的一页在你口袋里，边缘还有你的指甲痕。",
        "周沉撞见你改表时，你只说是潮雾侵蚀——谎话已出口，就收不回。",
        "护目镜碎渣让你想起下午货仓有人经过，但你没看清脸。"
      ]),
      ch2: scriptBody("林潮", "错位时刻", [
        "计数差六分钟。你的专业直觉告诉你：时间被机械偷走。",
        "你提出假设时，方策立刻用「操作失误」封住讨论。你记下这一反应。",
        "货仓锚链上的柴油味不对，像有人刚擦过什么。"
      ]),
      ch3: scriptBody("林潮", "灯下的暗格", [
        "你承认涂改潮位，为掩盖接货窗口——与命案无关，但让你失去信任。",
        "改频日志与暗格机关把方策锁进证据链。",
        "你最后说：我改的是数据，不是人命。"
      ])
    },
    "role-3": {
      ch1: scriptBody("方策", "风暴登岛", [
        "你以检修名义登岛。21:10与周沉在灯室争执——他握有你改频的证据，你握有旋转机构的秘密。",
        "你23:00后声称在电台室，实际23:35进过货仓。工具洗净，柴油味却留了一瞬。",
        "护目镜碎渣是你移的，引他们往「推落」想。"
      ]),
      ch2: scriptBody("方策", "错位时刻", [
        "你演示旋转机构，强调安全闭锁。暗格不会出现在演示里。",
        "林潮谈时间错位时，你把话头引向死者操作失误。",
        "唐野报告柴油味，你心跳快了一拍，仍说：那是补给泄漏。"
      ]),
      ch3: scriptBody("方策", "灯下的暗格", [
        "改频日志出现时，你要求「完整证据链」——这是你最后一道盾。",
        "暗格复现，你知道游戏结束，仍保持技术人员的冷静。",
        "你没有认罪台词；只有沉默，等他们说完。"
      ])
    },
    "role-4": {
      ch1: scriptBody("唐野", "风暴登岛", [
        "补给单上有你的手脚，多一枚钥匙胚是为了换账本——贪，但不杀人。",
        "22:20与顾晚甲板私会，你否认过，心里骂自己蠢。",
        "发现尸体时你在库房，23:10才出来，时间够别人做文章。"
      ]),
      ch2: scriptBody("唐野", "错位时刻", [
        "货仓柴油味你第一个闻出来。方策的工具箱就在锚链旁。",
        "你帮搜货仓，想洗清私会嫌疑。",
        "计数差你听懂了：有人骗周沉早六分钟上灯。"
      ]),
      ch3: scriptBody("唐野", "灯下的暗格", [
        "你公开私会：账本，不是情杀。",
        "方策改频时你在库房，听不见，但你能作证23:10后灯室仍亮。",
        "投票前你说：我贪利，没沾血。"
      ])
    }
  };
  return { setting, synopsis, config, truthBible, characterArchives, infoMatrix, hostRunbooks, scripts };
}

async function generateOnline() {
  let payload = { ...baseInput };
  const truthResult = await step("② 真相 Bible", () => createPipelineTruthBible(payload));
  payload = { ...payload, ...truthResult };
  writeJson("layers/02-truth-bible.json", payload.truthBible);

  const charResult = await step("③ 角色档案", () => createPipelineCharacterArchives(payload));
  payload.characterArchives = charResult.characterArchives;
  writeJson("layers/03-character-archives.json", payload.characterArchives);

  const matrixResult = await step("④ 信息矩阵", () => createPipelineInfoMatrix(payload));
  payload.infoMatrix = matrixResult.infoMatrix;
  writeJson("layers/04-info-matrix.json", payload.infoMatrix);

  const hostResult = await step("⑤ 主持手册", () => createPipelineHostRunbooksAll({ ...payload, allActs: true }));
  payload.hostRunbooks = hostResult.runbooks;
  writeJson("layers/05-host-runbooks.json", payload.hostRunbooks);

  payload.scripts = {};
  const roles = payload.characterArchives.roles;
  const keys = payload.config.chapterKeys;
  let n = 0;
  const total = roles.length * keys.length;
  for (const role of roles) {
    payload.scripts[role.key] = {};
    for (const actKey of keys) {
      n += 1;
      const label = `⑥ 剧本 ${n}/${total} · ${role.name}/${actKey}`;
      const scriptResult = await step(label, () =>
        createPipelineMatrixPlayerScript({ ...payload, roleKey: role.key, actKey, deAiPass: true })
      );
      payload.scripts[role.key][actKey] = scriptResult.script;
      writeJson(`layers/06-scripts/${role.key}_${actKey}.json`, scriptResult.script);
    }
  }

  try {
    const evalResult = await step("⑦ 矩阵评判", () => createPipelineMatrixEvaluation(payload));
    payload.evaluation = evalResult.evaluation;
    writeJson("layers/07-evaluation.json", payload.evaluation);
  } catch (error) {
    console.warn(`\n⚠ 评判跳过: ${error.message}`);
  }
  return payload;
}

function persistAll(payload, source) {
  mkdirSync(outDir, { recursive: true });
  for (const sub of ["scripts", "scripts-by-role", "truth", "tasks", "layers/06-scripts"]) {
    const p = join(outDir, sub);
    if (existsSync(p)) {
      for (const f of readdirSync(p)) {
        if (f.endsWith(".md") || f.endsWith(".json")) unlinkSync(join(p, f));
      }
    }
  }
  writeJson("layers/01-setup.json", { setting: payload.setting, synopsis: payload.synopsis, config: payload.config });
  writeJson("layers/02-truth-bible.json", payload.truthBible);
  writeJson("layers/03-character-archives.json", payload.characterArchives);
  writeJson("layers/04-info-matrix.json", payload.infoMatrix);
  writeJson("layers/05-host-runbooks.json", payload.hostRunbooks);
  for (const [roleKey, acts] of Object.entries(payload.scripts || {})) {
    for (const [actKey, script] of Object.entries(acts || {})) {
      writeJson(`layers/06-scripts/${roleKey}_${actKey}.json`, script);
    }
  }
  renderHumanReviewFiles(payload, writeText);
  if (payload.evaluation) writeJson("layers/07-evaluation.json", payload.evaluation);

  const session = {
    setting: payload.setting,
    synopsis: payload.synopsis,
    config: payload.config,
    truthBible: payload.truthBible,
    characterArchives: payload.characterArchives,
    infoMatrix: payload.infoMatrix,
    hostRunbooks: payload.hostRunbooks,
    scripts: payload.scripts,
    evaluation: payload.evaluation || null,
    proposal: null,
    locks: {
      setup: true,
      truth: true,
      characters: true,
      matrix: true,
      host: true,
      scripts: true,
      evaluate: Boolean(payload.evaluation),
      sync: false
    },
    activeLayer: "sync"
  };
  session.proposal = buildProposalFromMatrix({
    setting: payload.setting,
    config: payload.config,
    truthBible: payload.truthBible,
    infoMatrix: payload.infoMatrix
  });
  const importPackage = buildPipelineImportPackage(session);
  writeJson("session.json", session);
  writeJson("import-package.json", importPackage);
  writeJson("manifest.json", {
    slug,
    title: payload.setting.theme,
    status: "pending_review",
    source,
    generatedAt: new Date().toISOString(),
    playerCount: payload.config.playerCount,
    chapterKeys: payload.config.chapterKeys,
    volumeTier: payload.setting.volumeTier,
    notPublished: true,
    promptVersion: "matrix-v5-structured-log",
    compareBaseline: "../雾港回声-对比基准",
    previousVersion: "../雾港回声-v2",
    note: "未写入 OFFICIAL_EXAMPLE_WORLD_ID / 公开剧本库，需人工审核后再导入世界"
  });
  writeText(
    "README.md",
    `# ${payload.setting.theme}（待审核示例）

> **状态**：\`pending_review\` — 仅供团队本地审核，**未**进入公开剧本库（\`OFFICIAL_EXAMPLE_WORLD_ID\`）。

## 文件说明

| 文件 | 用途 |
|------|------|
| \`manifest.json\` | 元数据与审核状态 |
| \`session.json\` | 完整矩阵瀑布流 session（可回填 AI 向导草稿） |
| \`import-package.json\` | \`buildPipelineImportPackage\` 输出，审核通过后用于 \`importDeepseekPipeline\` |
| \`truth/TRUTH-god-view.md\` | **上帝视角**真相总览（时间线/凶手/误导/剧透门禁） |
| \`truth/HOST-runbook.md\` | 主持分幕流程 + 每幕 hostTruth |
| \`tasks/TASKS-all-roles.md\` | 全员分幕任务一览 |
| \`layers/02-truth-bible.json\` | 真相 Bible 结构化源数据 |
| \`layers/05-host-runbooks.json\` | 主持手册 JSON 源数据 |
| \`scripts-by-role/*-连贯本.md\` | **同角色 ch1→ch3 串联**（demo 连续阅读） |
| \`scripts/*.md\` | 单幕私人本（正文 + 末尾任务） |

## 审核通过后如何入库

1. 本地启动栈，进入目标世界的「AI 剧本创作」或调用 \`POST .../deepseek/pipeline/import\`
2. 使用 \`import-package.json\` 作为请求体（或从 \`session.json\` 在向导 ⑧ 步确认后上传）
3. **不要**修改 \`OFFICIAL_EXAMPLE_WORLD_ID\`，除非产品确认替换官方示例

## 生成方式

- 来源：\`${source}\`
- 架构：矩阵瀑布流 8 步（见 commit 9b777c9 后 wizard）

生成命令：

\`\`\`bash
node backend/scripts/generate-matrix-pilot-example.mjs          # DeepSeek 在线
node backend/scripts/generate-matrix-pilot-example.mjs --offline  # 本地 curated fixture
\`\`\`
`
  );
  console.log(`\n✓ 已写入 ${outDir}`);
}

async function main() {
  const config = deepseekConfig();
  if (offline || !config.configured) {
    if (!offline && !config.configured) console.warn("DEEPSEEK_API_KEY 未配置，使用 offline curated fixture");
    const payload = offlineFixture();
    persistAll(payload, offline ? "offline-curated" : "offline-fallback");
    return;
  }
  console.log(`Matrix pilot example · model=${config.model} · out=${outDir} · prompt=v5-structured-log`);
  console.log("提示：如需保留旧版，生成前请手动复制 examples/pending-review/雾港回声 → 雾港回声-v2");
  mkdirSync(outDir, { recursive: true });
  const payload = await generateOnline();
  persistAll(payload, "deepseek-matrix-pipeline");
}

main().catch((error) => {
  console.error("\n✗", error.message || error);
  process.exit(1);
});
