import { PRODUCT_BOUNDARY, cleanText, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";
import {
  actIndex,
  buildMatrixScriptPromptBundle,
  formatPromptBlock,
  resolveKillerRoleKey
} from "./matrix-prompt-engine.js";
import { buildDeAiRewriteRubric } from "./matrix-speech-style.js";
import { styleCardForPrompt } from "./matrix-literary-styles.js";
import { buildPlayerPovBlock, HUMAN_PROSE_BLOCK, HUMAN_STORY_FOUNDATION_BLOCK } from "./human-authorship.js";
import { SOURCE_ADAPTATION_CONTINUITY_BLOCK } from "./source-adaptation-fidelity.js";
import { TERMINOLOGY_GROUNDING_BLOCK } from "./matrix-terminology-grounding.js";

export function buildMatrixPlayerScriptMessages({
  setting,
  synopsis,
  config,
  styleCard,
  truthBible,
  characterArchive,
  characterArchives,
  matrixRow,
  infoMatrix,
  actKey,
  roleKey,
  targetWords,
  pov = "second",
  existingScripts
}) {
  const povRule = pov === "first"
    ? "使用第一人称「我」；第一人称只改变叙述位置，不允许角色替作者解释自己。"
    : "使用第二人称「你」；第二人称只贴近角色经历，不允许旁白替玩家规定理解。";
  const povBlock = buildPlayerPovBlock(pov);
  const bundle = buildMatrixScriptPromptBundle({
    truthBible,
    infoMatrix,
    characterArchives: characterArchives || { roles: characterArchive ? [characterArchive] : [] },
    config,
    actKey,
    roleKey,
    matrixRow,
    existingScripts,
    setting,
    synopsis,
    styleCard,
    characterArchive,
    actMaterials: (infoMatrix?.clues || []).filter((clue) => clue.actKey === actKey && clue.physicalForm)
  });
  const actIdx = actIndex(config, actKey);
  const tasksFromMatrix = bundle.authoritativeTasks;
  const killerKey = resolveKillerRoleKey(truthBible, characterArchives || { roles: characterArchive ? [characterArchive] : [] });
  const isKillerBeforeFinal =
    killerKey === roleKey && actIdx < (config?.chapterKeys?.length || 1) - 1;
  const continuityNote = bundle.roleContinuity?.hasPrevious
    ? "本幕须承接 roleContinuity：开头呼应上一幕 closingHook，保持连续阅读体验。"
    : "";
  const killerBlock = isKillerBeforeFinal
    ? `
【真凶位专属 — 本幕写作模式（最高优先级）】
- 你是真凶，但本幕正文**不能**出现 spoilerContract.forbiddenFacts 所含的作案步骤、物证专名或等价暗示。
- 回忆只可使用当前角色档案与矩阵已登记的冲突事实；禁止新增受害者、地点、工具或致死动作。
- 内心独白只表现被怀疑的压力与当前角色已有矛盾，禁止复盘尚未解锁的具体手法。
- 对他人可撒谎、转移怀疑、强调自己的公开身份；禁止公开认罪。
- 若 matrixRow.newClueIds 为空，不得独自发现推理关键物；最多描述当前公共场景中的已登记表象。`
    : "";

  const system = `你是线上剧本杀私人本主笔。你只写**一位角色、一个幕**的玩家阅读正文。
${killerBlock}

${PRODUCT_BOUNDARY}

${HUMAN_STORY_FOUNDATION_BLOCK}

${HUMAN_PROSE_BLOCK}

${TERMINOLOGY_GROUNDING_BLOCK}

${povBlock}

${SOURCE_ADAPTATION_CONTINUITY_BLOCK}

【硬性规则 — 幕间衔接（同角色连续阅读）】
${bundle.roleContinuity?.continuityRules?.map((r) => `- ${r}`).join("\n") || "- 第一幕建立基调。"}
${continuityNote}

【硬性规则 — 剧透安全】
- ${povRule}
- 目标约 ${targetWords} 字（可 ±15%）。
- 严格遵守 spoilerContract.forbiddenFacts：不得出现等价表述、同义改写或暗示。
- 遵守 misdirectionPreservation：未到收束幕的误导线不得写穿。
- 真凶位在终幕前不得内心认罪；非真凶不得全知真凶身份。
- 第一幕 closingHook 只许「怀疑方向」，禁止点名凶手或核心手法。

【硬性规则 — 公平推理】
- 禁止「独家关键事实」：推理必需的信息必须来自 newClueIds 线索卡、公开讨论或本角色亲身经历的可观察行为。
- 禁止写其它玩家本里才会出现的独占目击。公共连续性只看 actContract 与 publicEnvironment，不读取或猜测其他玩家的私人本。
- 角色名必须与 roleRoster 一致。

【结构与输出】
- body：沉浸式正文。误导、秘密和心理挣扎只能在本幕处境中自然发生，禁止按数量配发“2处怀疑+1处挣扎”的模板段落。
- tasks：与 authoritativeTasks **完全一致**（条目数、语义一致；仅可微调措辞）。
- body 不得逐条包装或复述 tasks；玩家应先因关系、债务、羞耻、误解或眼前利益产生行动理由，任务另列供执行。
- closingHook：一句悬念；不得剧透 forbiddenFacts。
- 禁止 Markdown；输出 JSON。

【输出 schema】
{
  "roleKey": "${roleKey}",
  "actKey": "${actKey}",
  "title": "分幕标题",
  "body": "正文",
  "tasks": ${JSON.stringify(tasksFromMatrix.length ? tasksFromMatrix : ["本幕任务1", "本幕任务2"])},
  "closingHook": "结尾悬念",
  "suggestions": ["自检：是否违反 spoilerContract / fairnessContract"]
}`;

  const user = `请撰写 ${roleKey} 在 ${actKey}（第 ${actIdx + 1} 幕）的私人本。

${creativeInputUserBlocks(setting, synopsis)}
${formatPromptBlock("roleRoster", bundle.roleRoster)}
${bundle.roleContinuity?.hasPrevious
  ? formatPromptBlock("roleContinuity（同一角色已写的前序幕，本幕必须衔接）", bundle.roleContinuity)
  : formatPromptBlock("roleContinuity", bundle.roleContinuity)}
${formatPromptBlock("spoilerContract", bundle.spoilerContract)}
${formatPromptBlock("fairnessContract", bundle.fairnessContract)}
${formatPromptBlock("misdirectionPreservation", bundle.misdirectionPreservation)}
${formatPromptBlock("clueLedger", bundle.clueLedger)}
${formatPromptBlock("terminologyGroundingContract（专业词唯一来源表）", bundle.terminologyGroundingContract)}
${formatPromptBlock("私人信息隔离", "不会提供其它角色剧本摘要；不得补写他人独占目击或秘密")}
${untrustedUserPayload("角色档案", characterArchive)}
${untrustedUserPayload("本幕信息矩阵行", matrixRow)}
${styleCard ? untrustedUserPayload("风格规则", styleCardForPrompt(styleCard)) : ""}

写完后自检：① 开头是否承接上一幕 ② 是否违反 forbiddenFacts ③ 是否出现独家关键事实 ④ tasks 是否与 matrixRow.tasks 一致。

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

/**
 * Killer pre-final act: innocent channel — LLM plays witness, not guilty killer.
 * Contradictions are injected post-hoc by pipeline-matrix-killer-innocent.js.
 */
export function buildMatrixInnocentKillerScriptMessages({
  setting,
  synopsis,
  config,
  styleCard,
  truthBible,
  characterArchive,
  characterArchives,
  matrixRow,
  infoMatrix,
  actKey,
  roleKey,
  targetWords,
  pov = "second",
  existingScripts,
  innocentAlibi
}) {
  const povRule = pov === "first"
    ? "使用第一人称「我」；第一人称只改变叙述位置，不允许角色替作者解释自己。"
    : "使用第二人称「你」；第二人称只贴近角色经历，不允许旁白替玩家规定理解。";
  const povBlock = buildPlayerPovBlock(pov);
  const bundle = buildMatrixScriptPromptBundle({
    truthBible,
    infoMatrix,
    characterArchives: characterArchives || { roles: characterArchive ? [characterArchive] : [] },
    config,
    actKey,
    roleKey,
    matrixRow,
    existingScripts,
    setting,
    synopsis,
    styleCard,
    characterArchive,
    actMaterials: (infoMatrix?.clues || []).filter((clue) => clue.actKey === actKey && clue.physicalForm)
  });
  const actIdx = actIndex(config, actKey);
  const tasksFromMatrix = bundle.authoritativeTasks;

  const system = `你是线上剧本杀私人本主笔。你只写**一位角色、一个幕**的玩家阅读正文。

${PRODUCT_BOUNDARY}

${HUMAN_STORY_FOUNDATION_BLOCK}

${HUMAN_PROSE_BLOCK}

${TERMINOLOGY_GROUNDING_BLOCK}

${povBlock}

${SOURCE_ADAPTATION_CONTINUITY_BLOCK}

【innocent_witness 模式 — 最高优先级】
- 该角色在本幕按**无辜目击者**书写，**不知道**自己是凶手，**禁止**内心认罪或担心「杀人败露」。
- 只写公开行动、可观察现象、与他人的表面互动；心理活动限于「被怀疑的焦虑」「对死者的震惊」。
- 禁止写 spoilerContract.forbiddenFacts 所含的动机、手法、专名和等价暗示。
- 「说谎」由系统事后注入，你只需写**看似诚实**的叙述；对外口径见 innocentAlibi.outwardClaims。
- 不要写「我必须隐瞒真相」—— innocents 没有需要隐瞒的命案。

【幕间衔接】
${bundle.roleContinuity?.continuityRules?.map((r) => `- ${r}`).join("\n") || "- 第一幕建立基调。"}

【剧透与公平】
- ${povRule}；目标约 ${targetWords} 字（±15%）。
- 严格遵守 spoilerContract.forbiddenFacts。
- 禁止独家发现 host_confirm 线索；最多模糊感知已登记的公共异常。
- tasks 与 authoritativeTasks 完全一致。

【输出 schema】
{
  "roleKey": "${roleKey}",
  "actKey": "${actKey}",
  "title": "分幕标题",
  "body": "正文",
  "tasks": ${JSON.stringify(tasksFromMatrix.length ? tasksFromMatrix : ["本幕任务1", "本幕任务2"])},
  "closingHook": "一句悬念（方向性，不剧透）",
  "suggestions": []
}`;

  const user = `请撰写 ${roleKey} 在 ${actKey}（第 ${actIdx + 1} 幕）的私人本 — **innocent_witness 模式**。

${creativeInputUserBlocks(setting, synopsis)}
${formatPromptBlock("innocentAlibi", innocentAlibi)}
${formatPromptBlock("roleRoster", bundle.roleRoster)}
${bundle.roleContinuity?.hasPrevious
  ? formatPromptBlock("roleContinuity", bundle.roleContinuity)
  : formatPromptBlock("roleContinuity", bundle.roleContinuity)}
${formatPromptBlock("spoilerContract", bundle.spoilerContract)}
${formatPromptBlock("fairnessContract", bundle.fairnessContract)}
${formatPromptBlock("clueLedger", bundle.clueLedger)}
${formatPromptBlock("terminologyGroundingContract（专业词唯一来源表）", bundle.terminologyGroundingContract)}
${untrustedUserPayload("角色档案（公开面）", {
  name: characterArchive?.name,
  publicIdentity: characterArchive?.publicIdentity,
  voiceHints: characterArchive?.voiceHints
})}
${untrustedUserPayload("本幕信息矩阵行", matrixRow)}
${styleCard ? untrustedUserPayload("风格规则", styleCardForPrompt(styleCard)) : ""}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

/** Post-generation rewrite when killer guard detects violations (legacy mode). */
export function buildMatrixKillerSanitizeMessages({
  body,
  styleCard,
  targetWords,
  spoilerContract,
  violations,
  matrixRow,
  actKey,
  roleKey,
  pov = "second",
  terminologyGroundingContract = null
}) {
  const violationList = (violations || []).map((v) => v.match || v.fact).filter(Boolean);
  const system = `你是剧本杀「真凶位剧透修复」编辑。任务：删除/模糊化违规表述，**不改变**可保留的情节骨架与字数规模。

${PRODUCT_BOUNDARY}

${buildPlayerPovBlock(pov)}

${TERMINOLOGY_GROUNDING_BLOCK}

【必须删除或改写的语义】
- spoilerContract.forbiddenFacts 中尚未解锁的作案手法、物证、动作与其同义改写
- 内心认罪、担心杀人败露的具体细节
- forbiddenFacts 列表中的任何等价表述

【保留】
- 与 matrixRow.tasks 一致的任务导向情节
- 对外撒谎、转移怀疑、与死者有过节的**模糊**回忆（不含致死动作）
- 已锁定的人称与沉浸式语气、closingHook 悬念方向

【禁止】
- 不得新增 forbiddenFacts
- 不得把真凶改成无辜
- 不得大幅缩短正文

输出 JSON：{"body":"修复后正文","removedPhrases":["…"],"suggestions":[]}`;

  const user = `请修复 ${roleKey} / ${actKey} 真凶本，移除以下违规片段（含同义改写）：

${untrustedUserPayload("违规命中", violationList)}
${formatPromptBlock("spoilerContract", spoilerContract)}
${terminologyGroundingContract ? formatPromptBlock("terminologyGroundingContract（修复时仍须遵守）", terminologyGroundingContract) : ""}
${untrustedUserPayload("本幕矩阵行", matrixRow)}
${untrustedUserPayload("待修复正文", { body: cleanText(body, 12000) })}
${styleCard ? untrustedUserPayload("风格规则", styleCardForPrompt(styleCard)) : ""}

目标字数约 ${targetWords}（±15%）。只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function buildMatrixDeAiPassMessages({
  body,
  styleCard,
  targetWords,
  spoilerContract,
  characterArchive = null,
  roleRoster = null,
  truthConsistency = null,
  terminologyGroundingContract = null,
  isKiller = false,
  actIndex = 0,
  finalActIndex = 0,
  repairFeedback = []
}) {
  const rubric = buildDeAiRewriteRubric({
    styleCard,
    eraCard: styleCard?.era,
    characterArchive,
    isKiller,
    actIndex,
    finalActIndex
  });
  const system = `你是中文剧本杀结构性文字编辑。执行「真人化叙述编辑」：删解释、打破论证与对称节奏、恢复潜台词，不改变情节事实与信息边界。

${PRODUCT_BOUNDARY}

${rubric}

${buildPlayerPovBlock(styleCard?.pov || "second")}

${TERMINOLOGY_GROUNDING_BLOCK}

- 保持长度约 ${targetWords} 字（±10%）。
- 只允许使用 roleRoster 与当前输入中已经登记的人名、地点、组织和物件；禁止新造人物或嫁接别的故事素材。
- 不得重复已有段落，不得输出「规定疑惑」「规定情绪」或任何内部状态字段。
- 引号外叙述必须遵守上方的人称合同，不得在「你」与「我」之间切换；若原正文已经混用，以 styleCard.pov 为准统一重写。
- 删除第一人称里的事后动机分析不能算丢失剧情事实；不要把“我之所以……是因为……”换成另一句更漂亮的自我总结。
- 若提供 truthConsistency，不得把其中锁定事实改写成相反记忆；未解锁手法仍不得在公聊台词中说穿。
- 改写前先在内部逐个核对正文中的行业词、工序词、部件词、制度简称和旧规矩；凡不能在 terminologyGroundingContract 或原输入中逐字定位的，一律改回可见的普通动作。不得输出这份内部清单。
- suggestions 必须诚实：若发现命题先行、人物只是观点席位或正文只是任务包装，写入 "upstream_rebuild: 具体问题"，供上游重构。
- 若提供“机械门禁命中”，必须逐条消除命中结构；不要只替换触发词，也不要用另一句心理结论代替。
- 输出 JSON：{"body":"改写后正文","removedPhrases":["删掉的套话或解释句"],"suggestions":[]}`;
  const repairBlock = (repairFeedback || []).length
    ? untrustedUserPayload("机械门禁命中（必须修复后再复检）", repairFeedback.map((issue) => ({
        paragraph: issue.paragraph,
        evidence: issue.evidence,
        message: issue.message,
        action: issue.action,
        rewriteMode: issue.rewriteMode
      })))
    : "";
  const user = `请执行结构性真人化编辑，并口语化确有必要的公聊对白：

${untrustedUserPayload("正文", { body: cleanText(body, 12000) })}
${repairBlock}
${spoilerContract ? formatPromptBlock("spoilerContract（改写时仍须遵守）", spoilerContract) : ""}
${roleRoster ? formatPromptBlock("roleRoster（唯一可用玩家姓名）", roleRoster) : ""}
${truthConsistency ? untrustedUserPayload("角色事实一致性约束", truthConsistency) : ""}
${terminologyGroundingContract ? formatPromptBlock("terminologyGroundingContract（不得新增表外专业词）", terminologyGroundingContract) : ""}
${characterArchive ? untrustedUserPayload("角色声线", { voiceHints: characterArchive.voiceHints, name: characterArchive.name }) : ""}
${styleCard ? untrustedUserPayload("风格规则", styleCardForPrompt(styleCard)) : ""}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
