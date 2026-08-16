/**
 * Era / setting presets for matrix pipeline — vocabulary, props, taboos, technology.
 * Combined with literaryStyle + mysteryStyle at design time.
 */
import { cleanText } from "./shared.js";

export const ERA_PRESET_KEYS = [
  "republic-cn",
  "modern-cn",
  "campus-2000s",
  "victorian-uk",
  "edo-jp",
  "lighthouse-industrial",
  "near-future",
  "rural-contemporary"
];

const ERA_ALIASES = {
  民国: "republic-cn",
  当代: "modern-cn",
  现代: "modern-cn",
  校园: "campus-2000s",
  维多利亚: "victorian-uk",
  江户: "edo-jp",
  灯塔: "lighthouse-industrial",
  近未来: "near-future",
  乡土: "rural-contemporary"
};

export const ERA_PRESETS = {
  "republic-cn": {
    label: "民国",
    timeRange: "1920s–1940s",
    vocabulary: "电报、租界、黄包车、旗袍、书局、报馆",
    props: "钢笔、怀表、油灯、电报机、旧式门锁",
    technology: "无手机；通讯靠电报/电话；交通靠火车/轮船",
    socialContext: "阶层分明、家族名望、新式学堂与旧派礼教并存",
    taboos: "禁止出现智能手机、互联网、GPS、现代刑侦 DNA 术语（除非设定明确引入）",
    atmosphere: "纸媒时代、雨夜/neon 初现、封闭宅邸或租界洋楼",
    speechRegister: "称「某先生/某小姐/老师」；略文白，忌网络梗；可「嗯」「罢了」",
    dialogueGood: "「电报局的人刚走。」你把烟掐了，「别在这节骨眼上乱说话。」",
    dialogueBad: "「我认为我们应该冷静地分析一下目前复杂的情况。」"
  },
  "modern-cn": {
    label: "当代中国",
    timeRange: "2010s–今",
    vocabulary: "微信、监控、外卖、写字楼、高铁",
    props: "手机、U 盘、监控截图、电子门锁",
    technology: "移动互联网普及；监控/common 但可因剧情受限",
    socialContext: "都市节奏、职场关系、网络舆论",
    taboos: "避免具体真实政体/品牌；监控须有剧情内解释",
    atmosphere: "都市悬疑、密室/封闭空间、数字痕迹",
    speechRegister: "当代口语；句长随关系和目的变化；忌公文腔、论文句与连续电报式碎句",
    dialogueGood: "「监控那段谁看过？」对方把手机扣桌上，「别@我。」",
    dialogueBad: "「经过我们的深入分析，监控数据呈现出明显的异常趋势。」"
  },
  "campus-2000s": {
    label: "2000s 校园",
    timeRange: "1998–2008",
    vocabulary: "逸夫楼、晚自习、小灵通、网吧、广播站",
    props: "课表、广播、旧式钥匙、日记本、MP3",
    technology: "无智能手机；通讯靠座机/小灵通/面对面",
    socialContext: "封闭校园、集体生活、青春群像",
    taboos: "禁止 smartphone、社交媒体 push；超自然须走变格模式",
    atmosphere: "校舍/操场/旧楼、季节感、集体记忆",
    speechRegister: "少年口语、可怼、可怂；忌机关公文与翻译腔",
    dialogueGood: "「你昨晚去哪了？」他压低声，「广播站那边，别乱传。」",
    dialogueBad: "「我昨晚在广播站进行了一些必要的活动，请你不要传播不实信息。」"
  },
  "victorian-uk": {
    label: "维多利亚英国",
    timeRange: "1860s–1900s",
    vocabulary: "gaslight、butler、estate、telegraph、cab",
    props: "煤气灯、留声机前代、马车、铅封信件",
    technology: "电报；无现代法医；推理靠逻辑与物证",
    socialContext: "阶级礼仪、继承法、殖民贸易背景可提及",
    taboos: "禁止现代通讯与法医术语",
    atmosphere: "雾都、庄园、火车时刻表",
    speechRegister: "礼貌但带刺；可省略主语；称谓 Mr./Mrs. 或中文「夫人」",
    dialogueGood: "「The ledger, if you please.」她没抬头，「I was in the garden.」",
    dialogueBad: "「I believe it would be prudent to conduct a thorough examination of the ledger.」"
  },
  "edo-jp": {
    label: "江户日本",
    timeRange: "江户中后期",
    vocabulary: "町人、番屋、长屋、提灯、下町",
    props: "木屐、纸灯笼、锁链、账本",
    technology: "无电力；夜间靠灯笼；通讯靠口信与飞脚",
    socialContext: "身份等级、町人伦理、藩制背景可淡化处理",
    taboos: "禁止现代日语借词、手机、电灯",
    atmosphere: "雪夜/梅雨、窄巷、能剧式留白",
    speechRegister: "短句、敬语分级；少解释，多留白",
    dialogueGood: "「……昨夜、灯屋へ。」相手は目を逸らした。",
    dialogueBad: "「昨夜私は灯屋に行ったのですが、詳細については後ほど説明いたします。」"
  },
  "lighthouse-industrial": {
    label: "工业时代灯塔/海港",
    timeRange: "1890s–1950s",
    vocabulary: "灯塔、潮位、旋转机构、补给、雾号、电台",
    props: "煤油灯、门闩、工具箱、气象日志、钥匙胚",
    technology: "早期电台/有线电话；电力可不稳定",
    socialContext: "孤岛封闭、值守编制、海事法规",
    taboos: "禁止 GPS、卫星电话；通讯中断须有天气/电缆理由",
    atmosphere: "盐雾、铁锈、潮声、孤立感",
    speechRegister: "海事/工人口语；可粗粝但不机械碎句，句长随现场压力变化；忌文艺腔堆砌",
    dialogueGood: "「潮位表谁动过？」你抹了把脸，「别跟我扯天气。」",
    dialogueBad: "「空气中弥漫着咸涩的海风，你不禁感到一种难以言喻的不安。」"
  },
  "near-future": {
    label: "近未来",
    timeRange: "2030s–2050s",
    vocabulary: "神经接口、离线区、合成口供、区块存证",
    props: "全息日志、生物锁、无人机（可失效）",
    technology: "高科技但须因剧情可失效/不可达",
    socialContext: "技术依赖与断连恐惧",
    taboos: "避免硬科幻百科；技术细节服务谜题",
    atmosphere: "冷色调、系统故障、隔离舱",
    speechRegister: "科技术语点到为止；口语长度随人物目的变化；忌百科解释和字段式问答",
    dialogueGood: "「日志离线了。」她敲了敲屏幕，「别指望云端。」",
    dialogueBad: "「根据区块存证技术的原理，我们可以推断出日志存在离线同步异常。」"
  },
  "rural-contemporary": {
    label: "当代乡土",
    timeRange: "2010s–今",
    vocabulary: "祠堂、族谱、流水席、摩托车、基站",
    props: "族谱、旧照片、农药瓶、祠堂锁",
    technology: "手机信号时有时无",
    socialContext: "熟人社会、面子、族规",
    taboos: "避免猎奇民俗；迷信走变格须 L1 立法",
    atmosphere: "雨村、雾、封闭宗族",
    speechRegister: "方言感可轻点（哎、嘛、咱）；熟人社会、爱绕弯子",
    dialogueGood: "「族里的事，少插嘴。」他把烟袋敲了敲，「你昨儿真在祠堂？」",
    dialogueBad: "「关于宗族事务，我认为我们需要保持谨慎的态度并进行深入讨论。」"
  }
};

export function resolveEraPreset(raw) {
  const key = cleanText(typeof raw === "string" ? raw : raw?.eraPreset || raw?.era, 48).toLowerCase();
  if (ERA_PRESET_KEYS.includes(key)) return key;
  return ERA_ALIASES[cleanText(typeof raw === "string" ? raw : raw?.eraPresetLabel, 24)] || "modern-cn";
}

export function buildEraSettingCard(setting) {
  const key = resolveEraPreset(setting?.eraPreset || setting);
  const preset = ERA_PRESETS[key] || ERA_PRESETS["modern-cn"];
  return {
    eraPreset: key,
    eraLabel: preset.label,
    timeRange: preset.timeRange,
    vocabulary: preset.vocabulary,
    props: preset.props,
    technology: preset.technology,
    socialContext: preset.socialContext,
    taboos: preset.taboos,
    atmosphere: preset.atmosphere,
    speechRegister: preset.speechRegister || "",
    dialogueGood: preset.dialogueGood || "",
    dialogueBad: preset.dialogueBad || "",
    customEraNotes: cleanText(setting?.eraNotes, 800) || null
  };
}

export function formatEraSpeechBlock(eraCard) {
  if (!eraCard?.speechRegister) return "";
  return `【时代语域 · ${eraCard.eraLabel}】${eraCard.speechRegister}`;
}

export function formatEraSettingBlock(eraCard) {
  if (!eraCard) return "";
  const lines = [
    `【时代背景 · ${eraCard.eraLabel}】${eraCard.timeRange || ""}`,
    `氛围：${eraCard.atmosphere}`,
    `常用语汇：${eraCard.vocabulary}`,
    `典型道具：${eraCard.props}`,
    `技术边界：${eraCard.technology}`,
    `社会语境：${eraCard.socialContext}`,
    `禁忌：${eraCard.taboos}`
  ];
  if (eraCard.customEraNotes) lines.push(`作者补充：${eraCard.customEraNotes}`);
  return lines.join("\n");
}

export function listEraPresetOptions() {
  return ERA_PRESET_KEYS.map((key) => ({
    key,
    label: ERA_PRESETS[key].label,
    timeRange: ERA_PRESETS[key].timeRange
  }));
}
