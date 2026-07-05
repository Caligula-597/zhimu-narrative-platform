/**
 * Mainstream literary style presets for matrix pipeline.
 * Replaces free-form tone/styleAnchor as primary style input.
 */
import { cleanText } from "./shared.js";

export const LITERARY_STYLE_KEYS = [
  "light-novel",
  "three-body",
  "game",
  "cinematic",
  "chunqiu",
  "minimal",
  "delicate",
  "web-novel",
  "horror",
  "luxun",
  "comedy",
  "classical"
];

export const MYSTERY_STYLE_KEYS = ["christie", "holmes", "christie-holmes"];

export const LITERARY_STYLE_PRESETS = {
  "light-novel": {
    label: "日式轻小说",
    anchor:
      "对话推进快，内心吐槽短句，场景切换用空行。例：你推开门。走廊里只剩一盏坏掉的灯在闪。——不对，刚才明明有人。",
    rhythm: "短句、口语、适度吐槽；动作与对话交替",
    forbidden: "长篇抒情、文言文、过度严肃说教"
  },
  "three-body": {
    label: "三体文风",
    anchor:
      "冷静、硬科幻质感与历史纵深并置。例：你盯着日志上被涂改的数字，想起三十年前同一座灯塔也曾断联——那时人们还相信事故只是事故。",
    rhythm: "中长句；理性叙述；宏观与微观对照",
    forbidden: "轻佻网络梗、无根据超自然"
  },
  game: {
    label: "游戏文风",
    anchor:
      "目标导向、可交互提示感。例：【当前区域：通讯室】你检查终端，发现三条未发送记录。其中一条时间戳与口供不符。",
    rhythm: "场景标签感、选项暗示、任务驱动",
    forbidden: "打破第四墙的 meta 说明"
  },
  cinematic: {
    label: "电影感文风",
    anchor:
      "镜头语言：景别、光影、声场。例：特写——你的指节扣在门把上。广角——四人散坐大厅，谁也没看谁。画外：潮声像低音提琴。",
    rhythm: "视觉切镜；少解释多呈现；声画对位",
    forbidden: "大段作者旁白总结"
  },
  chunqiu: {
    label: "春秋文风",
    anchor:
      "简练、史笔、微言大义。例：夜雨至，四人登岛。值守者遇不测，门自内阖。各执一词，莫衷一是。",
    rhythm: "四字/短句；省略主语；纪事体",
    forbidden: "现代口语、网络词、心理细描"
  },
  minimal: {
    label: "极简文风",
    anchor: "例：门。雨。四个人。一个不在。",
    rhythm: "极短句；删形容词；留白",
    forbidden: "比喻堆砌、副词链"
  },
  delicate: {
    label: "细腻文风",
    anchor:
      "感官细节层层递进。例：盐雾先尝到，才是铁锈味。你注意到他袖口有一道新磨出的毛边——像刚在粗糙石面擦过。",
    rhythm: "触觉/嗅觉/听觉；慢节奏；细节选点精准",
    forbidden: "空洞堆砌形容词"
  },
  "web-novel": {
    label: "网文文风",
    anchor:
      "节奏快、钩子密、信息密度高。例：你刚踏进灯室，身后「咔哒」一声——门闩落下。下一秒，所有人都在看你。",
    rhythm: "章末悬念；反转提示；对话带刀",
    forbidden: "拖沓铺垫超过三段无事件"
  },
  horror: {
    label: "恐怖文风",
    anchor:
      "未知先于解释。例：你听见第三个人的脚步声。可大厅里只有两把椅子在响。",
    rhythm: "延迟揭示；日常细节异化；留白",
    forbidden: "过早点名怪物/凶手"
  },
  luxun: {
    label: "鲁迅文风",
    anchor:
      "冷峻、讽刺、白描见骨。例：你说是为了公干，众人也点头。只有你知道，那封没寄出的信把夜拉得更长。",
    rhythm: "短句断奏；讽刺而不直骂；象征物",
    forbidden: "甜腻抒情、网梗"
  },
  comedy: {
    label: "搞笑文风",
    anchor:
      "反差与误会，但不破坏推理公平。例：你郑重宣布有重大发现——然后掏出一根完全无关的鞋带。众人沉默。",
    rhythm: "夸张控制在段落级；悬疑内核仍严肃",
    forbidden: "无信息增量的纯烂梗"
  },
  classical: {
    label: "古风文风",
    anchor:
      "半文半白，名物准确。例：你入得通讯室，见案上残卷未干。窗外潮信已变，众人各怀心事，未敢先言。",
    rhythm: "对仗偶用；称谓古雅；忌生造半文言",
    forbidden: "现代网络词、日式轻小说腔"
  }
};

export const MYSTERY_STYLE_PRESETS = {
  christie: {
    label: "阿加莎·克里斯蒂",
    anchor:
      "封闭空间、群像嫌疑、红鲱鱼、终局前不做定论。例：每人都有不在场证明，而证明本身正是破绽。",
    techniques: "公平线索、对话盘问、时间线表格感、误导后收束"
  },
  holmes: {
    label: "福尔摩斯",
    anchor:
      "可观察细节→推理链；例：袖口盐渍、鞋跟磨损、未说出口的半句话，拼成比供词更诚实的地图。",
    techniques: "演绎推理、细节放大、行为反常点、逻辑质问"
  },
  "christie-holmes": {
    label: "阿加莎 + 福尔摩斯",
    anchor: "群像封闭空间 + 细节演绎；盘问中埋线索，结论留到终局。",
    techniques: "公平线索、观察→疑问、时间锚点、禁止提前指凶"
  }
};

export function resolveLiteraryStyleKey(raw) {
  const key = cleanText(raw, 80);
  if (LITERARY_STYLE_KEYS.includes(key)) return key;
  const byLabel = Object.entries(LITERARY_STYLE_PRESETS).find(([, p]) => p.label === key);
  return byLabel ? byLabel[0] : "cinematic";
}

export function resolveMysteryStyleKey(raw) {
  const key = cleanText(raw, 80);
  if (MYSTERY_STYLE_KEYS.includes(key)) return key;
  const byLabel = Object.entries(MYSTERY_STYLE_PRESETS).find(([, p]) => p.label === key);
  if (byLabel) return byLabel[0];
  return "christie-holmes";
}

/** Build style card from setting — presets replace free-form tone/styleAnchor. */
export function buildLiteraryStyleCard(setting = {}) {
  const literaryStyle = resolveLiteraryStyleKey(setting.literaryStyle || setting.stylePreset || "cinematic");
  const mysteryStyle = resolveMysteryStyleKey(setting.mysteryStyle || "christie-holmes");
  const literary = LITERARY_STYLE_PRESETS[literaryStyle];
  const mystery = MYSTERY_STYLE_PRESETS[mysteryStyle];
  return {
    literaryStyle,
    literaryStyleLabel: literary.label,
    mysteryStyle,
    mysteryStyleLabel: mystery.label,
    volumeTier: setting.volumeTier || "standard",
    pov: setting.pov === "first" ? "first" : "second",
    anchor: `${literary.anchor}\n\n【悬疑推理参照】${mystery.label}：${mystery.anchor}`,
    rhythm: literary.rhythm,
    mysteryTechniques: mystery.techniques,
    forbiddenPhrases: cleanText(setting.forbiddenPhrases, 1000),
    styleForbidden: literary.forbidden,
    /** @deprecated legacy fields — do not use in new prompts */
    tone: "",
    styleAnchor: ""
  };
}

export function formatLiteraryStyleBlock(styleCard) {
  if (!styleCard) return "";
  return `【文风预设 · ${styleCard.literaryStyleLabel}】
节奏：${styleCard.rhythm}
范例：${styleCard.anchor.split("\n")[0]}
禁用：${styleCard.styleForbidden || "无"}

【悬疑推理 · ${styleCard.mysteryStyleLabel}】
技法：${styleCard.mysteryTechniques}`;
}

export function listLiteraryStyleOptions() {
  return LITERARY_STYLE_KEYS.map((key) => ({
    key,
    label: LITERARY_STYLE_PRESETS[key].label
  }));
}

export function listMysteryStyleOptions() {
  return MYSTERY_STYLE_KEYS.map((key) => ({
    key,
    label: MYSTERY_STYLE_PRESETS[key].label
  }));
}
