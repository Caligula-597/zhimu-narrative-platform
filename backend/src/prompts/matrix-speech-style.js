/**
 * Matrix 2.0 — speech register, anti-AI dialogue rubrics, voice contract.
 * v5.5: pairs with literaryStyle + eraPreset for human-like player scripts.
 */
import { cleanText } from "./shared.js";
import { formatEraSpeechBlock } from "./matrix-era-setting.js";

export const SPEECH_STYLE_VERSION = "v5.6-expressive";

/** LLM 写心理最省力套路 — 「心中+情绪动词」 */
export const AI_HEART_VERB_PHRASES = [
  "心中冷笑",
  "心中暗惊",
  "心中疑云",
  "心中一紧",
  "心中忐忑",
  "心中暗疑",
  "心中悲愤",
  "心中暗忖",
  "心中却波涛汹涌",
  "心中隐隐不安",
  "心中稍安",
  "心中疑窦",
  "心中冷笑：",
  "你感到众人目光",
  "你内心紧张",
  "你既怕",
  "又疑他"
];

/** High-frequency LLM / 翻译腔 — deAi pass 与 prompt 共用 */
export const AI_CLICHE_PHRASES = [
  "不禁",
  "内心深处",
  "这一刻",
  "原来如此",
  "缓缓",
  "微微",
  "映入眼帘",
  "空气中弥漫着",
  "心中涌起",
  "瞳孔猛然",
  "仿佛时间",
  "与此同时",
  "毋庸置疑",
  "显而易见",
  "不由得",
  "一种说不出的",
  "难以言喻",
  "五味杂陈",
  "百感交集",
  "心头一紧",
  "倒吸一口凉气",
  "气氛瞬间",
  "空气凝固",
  ...AI_HEART_VERB_PHRASES
];

export const AI_DIALOGUE_ANTIPATTERNS = [
  "公聊像论文答辩或主持总结",
  "每人台词长度、句式完全一致",
  "连续三句以「然而/但是/因此」起头",
  "对白过于完整书面语、无省略与打断",
  "角色在对话里自报全名或重复身份介绍",
  "用「我注意到」「我观察到」当每段开头",
  "心理段每句都「感到/意识到/明白」三连"
];

/** 群像快剪 — 连续「A做X，B做Y，C做Z」式作者旁白 */
export const MONTAGE_ANTIPATTERNS = [
  "开篇用分号/逗号链罗列所有在场角色各做一件事",
  "像剧情提要/信息矩阵摘要，不像第一人称或第二人称回忆",
  "公聊场景零引号对白、全是作者替所有人记账",
  "用「惹疑」「行档」等标签词代替具体动作与口语"
];

export function buildKnowledgeBoundaryBlock({ knowledgeSources = [], unknowns = [], volumeTier = "standard" } = {}) {
  const sources = knowledgeSources.slice(0, 8).map((k) => `- ${k.fact}（${k.source}${k.clueId ? ` · ${k.clueId}` : ""}）`);
  const gaps = unknowns.slice(0, 6).map((u) => `- ${u}`);
  const demoNote =
    volumeTier === "demo"
      ? "\n【demo 示范档】目标约 800 字/幕：交付**可玩纲要体**即可（场景顺序 + 短对白 + 任务 + hook），不必文学扩写；禁止为凑字补全 unknowns 或全场快剪。"
      : "";
  return `【知识边界 · 本幕只允许写这些】
${sources.length ? sources.join("\n") : "- （仅 matrixRow 任务与本角色亲身经历）"}
${gaps.length ? `\n【本幕不得写穿 / 尚未知晓】\n${gaps.join("\n")}` : "\n【本幕不得写穿】未在 knowledgeSources 且非亲见的细节，用「不清楚」「后来才知」「听说」留白。"}${demoNote}`;
}

export function buildAntiMontageBlock() {
  return `【禁止群像快剪 · 私人本视角】
- 你是**一个角色读本**，不是全知作者。开篇先写「我/你」在做什么、看见什么，再**顺带**提别人。
- 同一段里**最多点名 2 个其他角色**（不含对话对象）；其余用身份、关系或「有人」等自然指代。
- 禁止开篇句式：「A…，B…，C…，D…惹疑」——这是 AI 在扫 L2 公共池，不是人在回忆。
- 公共场必须有**至少 1 句引号对白**（可以很短）。
- 别人做的事：只写你**亲眼看见 / 亲耳听见**的；没看到的用「听说」「后来才知」一笔带过。
- 不得复用提示词中的示范人物、道具或句子；正文专名只能来自当前故事输入。`;
}

/** Advisory — opening paragraph montage (does not block) */
export function scanMontageAdvisory(text, { roleRosterNames = [] } = {}) {
  const raw = String(text || "").slice(0, 400);
  const hits = [];
  const names = roleRosterNames.filter(Boolean);
  let namedCount = 0;
  for (const name of names) {
    const short = name.split("·")[0]?.trim();
    if (short && raw.includes(short)) namedCount += 1;
  }
  if (namedCount >= 4) hits.push(`开篇点名≥4角色(${namedCount})`);
  if (/[^。！？]{8,}[，；][^。！？]{8,}[，；][^。！？]{8,}[，；]/.test(raw)) {
    hits.push("逗号/分号链过长");
  }
  if (!/「[^」]{1,80}」/.test(raw.slice(0, 280)) && /客厅|大厅|众人|公聊/.test(raw.slice(0, 200))) {
    hits.push("公聊段缺引号对白");
  }
  for (const tag of ["惹疑", "行档", "赫然在目", "各怀心思", "人人"]) {
    if (raw.includes(tag)) hits.push(tag);
  }
  return { passed: hits.length === 0, advisory: true, hits: [...new Set(hits)] };
}

export function buildAntiAiNarrationBlock() {
  return `【去 AI 腔 · 叙述段】
- 少用连接词堆叠（然而/与此同时/毋庸置疑）；一句一事。
- 禁止套话：${AI_CLICHE_PHRASES.slice(0, 14).join("、")}…
- 叙述像**人在回忆**，不是 AI 在写摘要；可省略主语、可半句收尾。
- 环境描写**最多 1～2 处**，且须与当下动作相关，禁止空泛氛围段。`;
}

/**
 * 文学喷漆核心：用感官+动作代替「心中X」情绪标签。
 * The prompt intentionally contains no reusable story-specific sample prose.
 */
export function buildSensoryExpressionBlock(characterArchive = null) {
  const name = cleanText(characterArchive?.name?.split("·")[0], 40);
  const hints = cleanText(characterArchive?.voiceHints, 600);
  const sensoryLine = hints.match(/sensoryFilter:\s*(.+)/i)?.[1]?.trim();
  const filterNote = sensoryLine
    ? `本角色感官滤镜：${sensoryLine}`
    : name
      ? `从 ${name} 的职业/身份选 1～2 种常触感官（触觉/嗅觉/听觉/视觉细节），勿写抽象情绪名。`
      : "每位角色须有不同的感官滤镜，勿全员「心中一紧」。";
  return `【感官替心 · 文学喷漆】
LLM 写心理最省力是「心中+动词」——这是**叙述偷懒**，只标情绪、不让读者看见人。

**硬规则**
- 引号外心理段：**禁止**「心中冷笑/暗惊/疑云/忐忑/一紧/悲愤/暗忖」等标签句。
- 把情绪翻译成：**嗅觉、触觉、听觉、视觉、身体动作**。
- 同一段最多 1 次抽象判断；其余用感官承载。
- ${filterNote}
- 感官必须来自当前角色职业、当前场景和当前动作，禁止照抄通用示范。
- 不得为制造感官描写而新增亲属、地点、药物、工具或案件事实。`;
}

/** 真凶私人本：混沌即兴感，禁止事后复盘式自白 */
export function buildKillerChaosPovBlock({ actIndex = 0, finalActIndex = 0 } = {}) {
  if (actIndex >= finalActIndex) {
    return `【真凶位 · 终幕】可加强张力，但仍禁止 forbiddenFacts 与完整作案手法自白。`;
  }
  return `【真凶位 · 混沌视角（非犯罪报告）】
玩家读本时，凶手自己也处于**不确定、记不清、不敢确认**的即兴状态——不是在读自己的结案陈词。

**禁止**
- 「我确实试图用 X 毒死他，但未成功」式事后复盘
- 「我清楚自己做了什么 / 我杀了他」式冷静总结（私人本可读紧张，但像**当下慌乱**）
- 把计划逐步写全、像向读者交代动机链

**允许**
- 与当前角色和场景一致的身体反应
- 对当前故事既有时间、地点或动作产生记忆缺口
- 用已登记的物证触感暗示，不直说犯罪步骤
- 对外撒谎、甩锅；内心是**慌**不是**稳**`;
}

export function buildAntiAiDialogueBlock() {
  return `【去 AI 腔 · 公聊对白】
- 真人说话：**短、断、有省略**；可打断、可答非所问、可嘴硬。
- 禁止：${AI_DIALOGUE_ANTIPATTERNS.map((p) => `「${p}」`).join("、")}
- 同一场公聊里，不同角色**句长与语气要有差**（参考 voiceHints / 角色档案）。
- 引号内是对外说的；引号外才是你的心思 — **不要**把心理活动写进引号里当台词。
- 不得照抄提示词中的句子；台词必须由当前人物关系与当前冲突自然产生。`;
}

export function buildVoiceContractBlock(characterArchive) {
  if (!characterArchive) return "";
  const hints = cleanText(characterArchive.voiceHints, 800);
  const name = cleanText(characterArchive.name?.split("·")[0], 40);
  if (!hints) {
    return `【角色声线 · ${name || "本角色"}】
档案未写 voiceHints 时：给本角色一个可辨别的说话习惯（句长短、是否 blunt、是否爱反问），并与其它角色区分开。`;
  }
  return `【角色声线 · ${name || "本角色"} — 必须贯穿公聊】
${hints}

写对白时：引号内台词须符合上述 register / 口癖 / 禁忌；其它角色不要用同一套腔调。`;
}

export function formatLiteraryDialogueBlock(styleCard) {
  const d = styleCard?.dialogueGuide;
  if (!d) return "";
  const lines = [`【文风 · 对白节奏 · ${styleCard.literaryStyleLabel || ""}】`];
  if (d.register) lines.push(`语域：${d.register}`);
  return lines.join("\n");
}

/** Combined block for dialogue-channel prompts */
export function buildCombinedSpeechBlock({ styleCard, eraCard, characterArchive } = {}) {
  const parts = [
    buildAntiAiDialogueBlock(),
    formatLiteraryDialogueBlock(styleCard),
    formatEraSpeechBlock(eraCard),
    buildVoiceContractBlock(characterArchive)
  ].filter(Boolean);
  return parts.join("\n\n");
}

/** For deAi pass — narration + dialogue split */
export function buildDeAiRewriteRubric({ styleCard, eraCard, characterArchive, isKiller = false, actIndex = 0, finalActIndex = 0 } = {}) {
  return `${buildSensoryExpressionBlock(characterArchive)}

${isKiller && actIndex < finalActIndex ? buildKillerChaosPovBlock({ actIndex, finalActIndex }) : ""}

${buildAntiAiNarrationBlock()}

${buildAntiAiDialogueBlock()}

${formatLiteraryDialogueBlock(styleCard)}

${formatEraSpeechBlock(eraCard)}

${buildVoiceContractBlock(characterArchive)}

【改写原则 · 感官替心】
- 保留事实、线索、任务与剧透边界；只改**措辞与节奏**。
- **禁止文学抛光时脑补新事实**：不得新增 knowledgeSources 外的机关原理、他人动机、未亲历时间线。
- **逐句扫描**「心中X」「你感到」「你既…又…」→ 换成感官或动作。
- 引号内台词改短、改口语；引号外心理只使用当前角色档案声明的职业与感官滤镜。
- 真凶段：删掉事后复盘句，改成记不清/握不住/不敢确认。`;
}

/** Advisory — 「心中+动词」偷懒心理（does not block） */
export function scanHeartVerbAdvisory(text) {
  const raw = String(text || "");
  const hits = [];
  for (const phrase of AI_HEART_VERB_PHRASES) {
    if (raw.includes(phrase)) hits.push(phrase);
  }
  const regexHits = raw.match(/心中[\u4e00-\u9fa5]{1,6}/g) || [];
  for (const m of regexHits) {
    if (!hits.includes(m)) hits.push(m);
  }
  if (/你既[\u4e00-\u9fa5]{1,12}又/.test(raw)) hits.push("你既…又…");
  if (/试图用.+毒死|但未成功/.test(raw)) hits.push("事后犯罪复盘");
  return {
    passed: hits.length === 0,
    advisory: true,
    hits: [...new Set(hits)].slice(0, 12)
  };
}

/** Advisory scan — does not block generation */
export function scanAiClicheAdvisory(text) {
  const raw = String(text || "");
  const hits = [];
  for (const phrase of AI_CLICHE_PHRASES) {
    if (raw.includes(phrase)) hits.push(phrase);
  }
  const dialogueLines = raw.match(/「[^」]{0,200}」/g) || [];
  const longLines = dialogueLines.filter((line) => line.length > 48);
  if (longLines.length >= 3) hits.push("过长对白≥3处");
  return {
    passed: hits.length === 0,
    advisory: true,
    hits: [...new Set(hits)].slice(0, 12),
    longDialogueCount: longLines.length
  };
}
