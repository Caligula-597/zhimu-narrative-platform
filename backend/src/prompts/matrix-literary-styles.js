/**
 * Mainstream literary style presets for matrix pipeline.
 * Replaces free-form tone/styleAnchor as primary style input.
 * v5.5: each preset includes dialogueGuide for speech naturalness.
 */
import { cleanText } from "./shared.js";
import { buildEraSettingCard } from "./matrix-era-setting.js";

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
    forbidden: "长篇抒情、文言文、过度严肃说教",
    dialogue: {
      register: "轻快口语、可内心一句吐槽；对白短于叙述",
      good: "「等等，这不对吧？」你嘀咕。灯还在闪。",
      bad: "「我敏锐地察觉到环境中存在某种不寻常的异常。」"
    }
  },
  "three-body": {
    label: "三体文风",
    anchor:
      "冷静、硬科幻质感与历史纵深并置。例：你盯着日志上被涂改的数字，想起三十年前同一座灯塔也曾断联——那时人们还相信事故只是事故。",
    rhythm: "中长句；理性叙述；宏观与微观对照",
    forbidden: "轻佻网络梗、无根据超自然",
    dialogue: {
      register: "冷静陈述；少感叹号；对白像汇报事实",
      good: "「日志少了一页。」对方沉默两秒，「你看过原件？」",
      bad: "「这一刻，你不禁感到命运齿轮正在悄然转动。」"
    }
  },
  game: {
    label: "游戏文风",
    anchor:
      "目标导向、可交互提示感。例：【当前区域：通讯室】你检查终端，发现三条未发送记录。其中一条时间戳与口供不符。",
    rhythm: "场景标签感、选项暗示、任务驱动",
    forbidden: "打破第四墙的 meta 说明",
    dialogue: {
      register: "任务感、短指令；像 UI 提示但不写【】进引号",
      good: "「终端还能进吗？」你问。对方：「试最后一次。」",
      bad: "「根据当前任务进度，我建议我们前往通讯室进行调查。」"
    }
  },
  cinematic: {
    label: "电影感文风",
    anchor:
      "使用景别、光影与声场组织叙述；感官细节必须来自当前故事，不提供可直接复用的示范句。",
    rhythm: "视觉切镜；少解释多呈现；声画对位",
    forbidden: "大段作者旁白总结",
    dialogue: {
      register: "对白克制但完整；句长随关系、遮掩和争执变化，潜台词大于字面，不把信息压成电报式短答",
      good: "「你当时在哪儿？」镜头外，雨声盖过回答。",
      bad: "「让我详细解释一下我当时完整的行动轨迹和时间线。」"
    }
  },
  chunqiu: {
    label: "春秋文风",
    anchor:
      "简练、史笔、微言大义。例：夜雨至，四人登岛。值守者遇不测，门自内阖。各执一词，莫衷一是。",
    rhythm: "四字/短句；省略主语；纪事体",
    forbidden: "现代口语、网络词、心理细描",
    dialogue: {
      register: "史笔对白；可省略；忌白话长篇",
      good: "「雨夜，未至。」对方答。",
      bad: "「我觉得那天晚上下雨的时候我应该没有去过那里。」"
    }
  },
  minimal: {
    label: "极简文风",
    anchor: "例：门。雨。四个人。一个不在。",
    rhythm: "极短句；删形容词；留白",
    forbidden: "比喻堆砌、副词链",
    dialogue: {
      register: "能省则省；对白可单词成句",
      good: "「谁？」「不知道。」",
      bad: "「我对此感到困惑并想要进一步了解情况。」"
    }
  },
  delicate: {
    label: "细腻文风",
    anchor:
      "感官细节层层递进。例：盐雾先尝到，才是铁锈味。你注意到他袖口有一道新磨出的毛边——像刚在粗糙石面擦过。",
    rhythm: "触觉/嗅觉/听觉；慢节奏；细节选点精准",
    forbidden: "空洞堆砌形容词",
    dialogue: {
      register: "感官触发后再说话；对白可慢半拍",
      good: "你闻到铁锈味，才开口：「这扇门，刚才关上过？」",
      bad: "「空气中弥漫着一种令人不安的气息。」"
    }
  },
  "web-novel": {
    label: "网文文风",
    anchor:
      "节奏快、钩子密、信息密度高。例：你刚踏进灯室，身后「咔哒」一声——门闩落下。下一秒，所有人都在看你。",
    rhythm: "章末悬念；反转提示；对话带刀",
    forbidden: "拖沓铺垫超过三段无事件",
    dialogue: {
      register: "对白带钩；可挑衅、可装傻；节奏快",
      good: "「行啊，你先说。」你把证据按桌上，「我看你怎么圆。」",
      bad: "「让我们系统地梳理一下目前掌握的所有信息。」"
    }
  },
  horror: {
    label: "恐怖文风",
    anchor:
      "未知先于解释。例：你听见第三个人的脚步声。可大厅里只有两把椅子在响。",
    rhythm: "延迟揭示；日常细节异化；留白",
    forbidden: "过早点名怪物/凶手",
    dialogue: {
      register: "问半句、停；忌解释型对白",
      good: "「……你听见了吗？」对方声音发紧。",
      bad: "「我感觉到一种超自然的恐怖力量正在逼近。」"
    }
  },
  luxun: {
    label: "鲁迅文风",
    anchor:
      "冷峻、讽刺、白描见骨。例：你说是为了公干，众人也点头。只有你知道，那封没寄出的信把夜拉得更长。",
    rhythm: "短句断奏；讽刺而不直骂；象征物",
    forbidden: "甜腻抒情、网梗",
    dialogue: {
      register: "冷讽、短句；对白可戳破面子",
      good: "「公干？」你笑了一下，「公干到这份上？」",
      bad: "「我内心深处充满了复杂的情感波动。」"
    }
  },
  comedy: {
    label: "搞笑文风",
    anchor:
      "反差与误会，但不破坏推理公平。例：你郑重宣布有重大发现——然后掏出一根完全无关的鞋带。众人沉默。",
    rhythm: "夸张控制在段落级；悬疑内核仍严肃",
    forbidden: "无信息增量的纯烂梗",
    dialogue: {
      register: "反差可夸张；但台词仍要像人说话",
      good: "「重大发现！」你举起一根鞋带。全场安静。",
      bad: "「这是一个令人捧腹的误会，然而真相往往比喜剧更加复杂。」"
    }
  },
  classical: {
    label: "古风文风",
    anchor:
      "半文半白，名物准确。例：你入得通讯室，见案上残卷未干。窗外潮信已变，众人各怀心事，未敢先言。",
    rhythm: "对仗偶用；称谓古雅；忌生造半文言",
    forbidden: "现代网络词、日式轻小说腔",
    dialogue: {
      register: "半文半白；称谓准确；忌白话长篇论辩",
      good: "「阁下昨夜可曾离席？」你拱手，「某不敢妄言。」",
      bad: "「我认为我们需要理性地讨论一下昨晚发生的所有事情。」"
    }
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
  const era = buildEraSettingCard(setting);
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
    dialogueGuide: literary.dialogue || null,
    era,
    forbiddenPhrases: cleanText(setting.forbiddenPhrases, 1000),
    styleForbidden: literary.forbidden,
    /** @deprecated legacy fields — do not use in new prompts */
    tone: "",
    styleAnchor: ""
  };
}

export function formatLiteraryStyleBlock(styleCard) {
  if (!styleCard) return "";
  const dialogueRegister = styleCard.dialogueGuide?.register || "";
  return `【文风预设 · ${styleCard.literaryStyleLabel}】
节奏：${styleCard.rhythm}
禁用：${styleCard.styleForbidden || "无"}
${dialogueRegister ? `对白语域：${dialogueRegister}` : ""}

【悬疑推理 · ${styleCard.mysteryStyleLabel}】
技法：${styleCard.mysteryTechniques}`;
}

/** Prompt-safe style payload: rules only, never reusable prose examples. */
export function styleCardForPrompt(styleCard) {
  if (!styleCard) return null;
  return {
    literaryStyle: styleCard.literaryStyle,
    literaryStyleLabel: styleCard.literaryStyleLabel,
    mysteryStyle: styleCard.mysteryStyle,
    mysteryStyleLabel: styleCard.mysteryStyleLabel,
    volumeTier: styleCard.volumeTier,
    pov: styleCard.pov,
    rhythm: styleCard.rhythm,
    mysteryTechniques: styleCard.mysteryTechniques,
    dialogueRegister: styleCard.dialogueGuide?.register || "",
    forbiddenPhrases: styleCard.forbiddenPhrases,
    styleForbidden: styleCard.styleForbidden,
    era: styleCard.era
      ? {
          eraPreset: styleCard.era.eraPreset,
          eraLabel: styleCard.era.eraLabel,
          timeRange: styleCard.era.timeRange,
          vocabulary: styleCard.era.vocabulary,
          props: styleCard.era.props,
          technology: styleCard.era.technology,
          socialContext: styleCard.era.socialContext,
          taboos: styleCard.era.taboos,
          atmosphere: styleCard.era.atmosphere,
          speechRegister: styleCard.era.speechRegister,
          customEraNotes: styleCard.era.customEraNotes
        }
      : null
  };
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
