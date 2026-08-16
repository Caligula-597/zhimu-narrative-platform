import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { formatPromptBlock } from "./matrix-prompt-engine.js";
import { buildWritingStyleBlock } from "./matrix-writing-style.js";
import { formatLiteraryStyleBlock } from "./matrix-literary-styles.js";
import { formatEraSettingBlock } from "./matrix-era-setting.js";
import { buildCombinedSpeechBlock, buildAntiMontageBlock, buildKnowledgeBoundaryBlock } from "./matrix-speech-style.js";
import { buildPlayerPovBlock, HUMAN_PROSE_BLOCK, HUMAN_STORY_FOUNDATION_BLOCK } from "./human-authorship.js";
import { TERMINOLOGY_GROUNDING_BLOCK } from "./matrix-terminology-grounding.js";

export function buildSceneContractMessages({
  publicActionBrief,
  roleKey,
  actKey,
  targetWords,
  expectedSceneCount,
  sharedActContract = null,
  actDecision = null,
  actMaterials = [],
  spoilerContract,
  roleRoster,
  entityUnlockContract,
  styleCard = null,
  characterArchive = null,
  actOutline = null,
  truthConsistency = null,
  terminologyGroundingContract = null
}) {
  const literaryBlock = styleCard ? formatLiteraryStyleBlock(styleCard) : "";
  const eraBlock = styleCard?.era ? formatEraSettingBlock(styleCard.era) : "";
  const system = `你是剧本杀私人本的场景设计师。此步禁止写正文，只建立可执行的“场景合同”，后续主笔只能依合同落笔。

${PRODUCT_BOUNDARY}

${HUMAN_STORY_FOUNDATION_BLOCK}

${TERMINOLOGY_GROUNDING_BLOCK}

${literaryBlock}
${eraBlock}

【场景合同不是剧情摘要】
- 为约 ${targetWords} 字正文设计 ${expectedSceneCount} 个持续场景。每场必须发生在具体地点和时间窗口内，并产生玩家能观察到的变化；变化可以来自冲突，也可以来自误解、错过、共同克制、合作、假胜利或安静的重新判断。
- changeMode=conflict 时，必须写清双方诉求、不可兼得、期限与当场损失。其他模式不得硬塞一组索取—拒绝，应填写 changeMechanism：原有压力、真正转折、可见差别以及仍未封死的问题。只有“互相怀疑、气氛紧张、讨论线索”不算变化。
- beats 只准写摄像机能拍到或录音能听到的动作、原话和反应；“意识到、明白、感受到、陷入回忆、体现了”不是 action。
- 专有名词和生活细节不能冒充场景。机器、旧账、票据、杯子只有被人物拿来办事、拒绝或伤害关系时才可进入 beat。
- 每个 beat 的 stateChange 必须说明该动作之后，谁失去了什么退路、谁得到新的筹码、哪句原本能说的话变得不能说。
- relationshipPressure 与 withheldMeanings 是作者后台信息，后续正文只能让玩家从行为中推断，绝不允许原句写给玩家。
- scheduledTasks 只是约束：把它变成自然发生的行为，不得设计“角色想起自己的任务”或“接下来你需要”。
- 不得新增 roleRoster 以外的有名人物，不得写穿 forbiddenFacts 和 unknowns。
${sharedActContract ? `- infoMatrix.sharedActContract 是已经锁定的公共现场。scenes 必须逐场使用其中 sceneKey、location、timeWindow 与共同 stateChange；只投影本角色在场时看见、想要和做出的部分，不得改地点、改期限、改公共决定或另造高潮。
- observableBeats 是共享交互合同。memoryAgreement=shared 的 beat 必须原样保持人物、物件和先后，并把 key 写入 sharedBeatKeys；disputed/partial 只能改变本角色的注意和解释，不能改写发生了什么。
- actDecision 是本幕必须实际结算的决定；actMaterials 是可操作物料。至少一个 beat 必须让物料发生签署、转让、隐藏、公开、质押、销毁或其他已登记 affordance，不能只“看到并理解”。` : ""}

【输出 JSON】
{
  "scenes": [{
    "sceneKey": "s1",
    "timeWindow": "相对时间",
    "location": "具体地点",
    "presentCharacters": ["登记角色名"],
    "entryAction": "开场第一个可见动作，不解释意义",
    "changeMode": "conflict|misunderstanding|missed_connection|mutual_restraint|cooperation|false_victory|quiet_revaluation",
    "immediateConflict": {
      "roleDemand": "仅 conflict 必填：本角色现在要对方做什么",
      "counterDemand": "仅 conflict 必填：对方反过来要求什么",
      "whyCannotBothWin": "仅 conflict 必填：不可兼得之处",
      "deadline": "仅 conflict 必填：何时之前不处理就涨价",
      "failureCost": "仅 conflict 必填：本场内可见的损失"
    },
    "changeMechanism": {
      "pressure": "非 conflict 必填：进入场景前已有的现实或关系压力",
      "turn": "非 conflict 必填：动作、错过、合作或误读怎样使局面转弯",
      "observableDifference": "非 conflict 必填：离开时摄像机能拍到的差别",
      "openQuestion": "变化以后仍由玩家解释的部分"
    },
    "relationshipPressure": {
      "oldAccount": "具体旧账",
      "statusAsymmetry": "谁能让谁付代价",
      "unsaidFact": "只能由玩家推断、正文不可直说"
    },
    "sharedBeatKeys": ["本角色场景中兑现的公共 observableBeat key"],
    "beats": [{"actor":"谁","action":"可见动作或原话","object":"涉及对象","reaction":"别人如何应对","stateChange":"行动后的局面变化"}],
    "exitChange": "离场时已经不可逆的变化"
  }],
  "continuityBridge": "这些场景如何承接并递进",
  "withheldMeanings": ["正文不得直接解释的含义"],
  "forbiddenNarratorClaims": ["你一直这样告诉自己", "你终于明白", "不是……你只是……"]
}`;
  const user = `请为 ${roleKey} / ${actKey} 建立场景合同。

${formatPromptBlock("publicActionBrief", publicActionBrief)}
${sharedActContract ? formatPromptBlock("sharedActContract（公共幕唯一事实源）", sharedActContract) : ""}
${actDecision ? formatPromptBlock("actDecision（本幕必须结算）", actDecision) : ""}
${actMaterials?.length ? formatPromptBlock("actMaterials（只能使用已登记操作）", actMaterials) : ""}
${characterArchive ? untrustedUserPayload("角色档案", characterArchive) : ""}
${actOutline ? untrustedUserPayload("本幕可玩纲要", actOutline) : ""}
${formatPromptBlock("roleRoster", roleRoster)}
${formatPromptBlock("spoilerContract", spoilerContract)}
${entityUnlockContract ? formatPromptBlock("entityUnlockContract", { promptBlock: entityUnlockContract.promptBlock }) : ""}
${truthConsistency ? untrustedUserPayload("事实一致性约束", truthConsistency) : ""}
${terminologyGroundingContract ? formatPromptBlock("terminologyGroundingContract（专业词唯一来源表）", terminologyGroundingContract) : ""}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function buildActionLogMessages({
  publicActionBrief,
  sceneContract,
  roleKey,
  actKey,
  targetWords,
  spoilerContract,
  roleRoster,
  entityUnlockContract,
  isKiller = false,
  actIndex = 0,
  finalActIndex = 0,
  styleCard = null,
  killerAwareness = "self-aware",
  actOutline = null,
  characterArchive = null,
  truthConsistency = null,
  pov = "second",
  terminologyGroundingContract = null
}) {
  const styleBlock = buildWritingStyleBlock({
    channel: "action",
    isKiller,
    actIndex,
    finalActIndex,
    killerAwareness,
    characterArchive
  });
  const literaryBlock = styleCard ? formatLiteraryStyleBlock(styleCard) : "";
  const eraBlock = styleCard?.era ? formatEraSettingBlock(styleCard.era) : "";
  const knowledgeBlock = buildKnowledgeBoundaryBlock({
    knowledgeSources: actOutline?.knowledgeSources || publicActionBrief?.knowledgeSources,
    unknowns: actOutline?.unknowns || publicActionBrief?.unknowns,
    notYetInferred: actOutline?.notYetInferred || publicActionBrief?.notYetInferred,
    forbiddenConclusions: actOutline?.forbiddenConclusions || publicActionBrief?.forbiddenConclusions,
    allowedSuspicionRange: actOutline?.allowedSuspicionRange || publicActionBrief?.allowedSuspicionRange,
    volumeTier: styleCard?.volumeTier
  });
  const povBlock = buildPlayerPovBlock(pov);
  const system = `你是剧本杀「私人本 · 经历段」主笔。写本幕角色亲历的内容，像可读的玩家剧本，不是监控日志。

${PRODUCT_BOUNDARY}

${literaryBlock}
${eraBlock}

${knowledgeBlock}

${styleBlock}

${povBlock}

${TERMINOLOGY_GROUNDING_BLOCK}

【硬性禁止 — 仅剧透/公平】
- 禁止 forbiddenFacts、作案手法自白、公开认罪
- **非凶手（isKiller=false）终幕禁止完整杀人供述**：不可写「我注射/投毒/通过机关杀害/密室是我所设」；仅可承认与己相关的隐瞒或蠢事（偷物、私会、非致死安眠药等），并明确否认杀人
- 禁止未授权物证专名 — 严格遵循 entityUnlockContract（未解锁用指代）

${entityUnlockContract?.promptBlock || ""}

【时间 — 不要写死】
- 用先后：随后 / 这时 / 回大厅后 / 入夜后 — **不要**每句一个 HH:MM 钟点
- 全幕至多 1～2 个模糊时间锚点；entries.time 可填「入夜后」等相对词，勿填 21:05 流水账
- 引号外叙述严格遵守人称合同。
- 若提供 truthConsistency，只用于避免把锁定事实写反；经历段不要复述尚未解锁的具体手法。

【任务-行为咬合 — 必填】
- matrixRow.tasks 中每个任务（「解释是否去过…」「是否公开…」）须在 entries/narrative 有对应物理动作或对白，禁止任务写仓库/书房而正文无相关行动。

【场景合同 — 正文根基】
- 严格按 sceneContract.scenes 的顺序推进；每场从 entryAction 开始，让 beats 的动作确实造成 stateChange，抵达 exitChange。
- relationshipPressure、withheldMeanings、forbiddenNarratorClaims 属于作者后台，禁止原句或换一种结论写进 narrative。
- 此处只完成可观察经历材料，不替角色总结动机、性格、主题或“真正明白了什么”。

【允许】
- 场景、动作、环境、他人可见行为
- 句长服从动作与注意力；长短可以变化，禁止为了“文学性”机械拆成一句一段。心理细节主要放在公聊段

输出 JSON：
{
  "entries": [{"time":"入夜后","action":"随众人退回大厅"}],
  "narrative": "${pov === "first" ? "我" : "你"}随众人退回大厅……（约 ${Math.round(targetWords * 0.4)} 字，相对顺序，少钟点）"
}`;

  const user = `角色 ${roleKey} / ${actKey} 经历段。

${formatPromptBlock("publicActionBrief", publicActionBrief)}
${formatPromptBlock("sceneContract（唯一场面施工图）", sceneContract)}
${formatPromptBlock("spoilerContract", spoilerContract)}
${entityUnlockContract ? formatPromptBlock("entityUnlockContract", { promptBlock: entityUnlockContract.promptBlock }) : ""}
${formatPromptBlock("roleRoster", roleRoster)}
${truthConsistency ? untrustedUserPayload("角色事实一致性约束", truthConsistency) : ""}
${terminologyGroundingContract ? formatPromptBlock("terminologyGroundingContract（专业词唯一来源表）", terminologyGroundingContract) : ""}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function buildDialogueLogMessages({
  publicActionBrief,
  sceneContract,
  actionLog,
  feelingsPack,
  truthConsistency,
  roleKey,
  actKey,
  targetWords,
  spoilerContract,
  roleRoster,
  clueLedger,
  entityUnlockContract,
  peerScriptDigest,
  isKiller = false,
  actIndex = 0,
  finalActIndex = 0,
  styleCard = null,
  killerAwareness = "self-aware",
  characterArchive = null,
  actOutline = null,
  pov = "second",
  terminologyGroundingContract = null
}) {
  const styleBlock = buildWritingStyleBlock({
    channel: "dialogue",
    isKiller,
    actIndex,
    finalActIndex,
    killerAwareness,
    characterArchive
  });
  const literaryBlock = styleCard ? formatLiteraryStyleBlock(styleCard) : "";
  const eraBlock = styleCard?.era ? formatEraSettingBlock(styleCard.era) : "";
  const speechBlock = buildCombinedSpeechBlock({
    styleCard,
    eraCard: styleCard?.era,
    characterArchive
  });
  const knowledgeBlock = buildKnowledgeBoundaryBlock({
    knowledgeSources: actOutline?.knowledgeSources || publicActionBrief?.knowledgeSources,
    unknowns: actOutline?.unknowns || publicActionBrief?.unknowns,
    notYetInferred: actOutline?.notYetInferred || publicActionBrief?.notYetInferred,
    forbiddenConclusions: actOutline?.forbiddenConclusions || publicActionBrief?.forbiddenConclusions,
    allowedSuspicionRange: actOutline?.allowedSuspicionRange || publicActionBrief?.allowedSuspicionRange,
    volumeTier: styleCard?.volumeTier
  });
  const feelingGuidance = {
    questions: (feelingsPack?.puzzles || []).map((line) => String(line).replace(/^\[规定疑惑\]\s*/, "")),
    emotions: (feelingsPack?.emotions || []).map((line) => String(line).replace(/^\[规定情绪\]\s*/, ""))
  };
  const povBlock = buildPlayerPovBlock(pov);
  const system = `你是剧本杀「私人本 · 公聊与心理段」主笔。写公开对话 + **当前视角人物当时的心思**；多人向私人本可以有心理描写，但心理不是人物自我分析报告。

${PRODUCT_BOUNDARY}

${literaryBlock}
${eraBlock}

${speechBlock}

${knowledgeBlock}

${buildAntiMontageBlock()}

${styleBlock}

${povBlock}

${TERMINOLOGY_GROUNDING_BLOCK}

【硬性禁止 — 仅剧透/公平】
- 禁止 forbiddenFacts、独家关键事实（「只有我看见…」）
- 禁止未在 clueLedger 公开的物证专名 — 遵循 entityUnlockContract

${entityUnlockContract?.promptBlock || ""}
- 禁止写死「X 就是凶手」的定论（第三幕前）

【允许 — 私人本常态】
- 对话（引号）须**像这个人物说话**：长度随关系、遮掩和冲突变化；允许省略与打断，但禁止把所有台词压成短句（见 voiceHints）
- 对话（引号）+ 当前视角听见后的即时想法、怀疑、不安、误判；心理不得升级成对自己的完整人物分析
- 对他人的观察与推理疑问；相对时间（「刚才」「回大厅后」）

【与经历段衔接】
- actionLog 已经写过本幕经历；本段只能承接其结果，禁止换句话重述同一组动作、环境和信息。
- 开头直接进入新的对话、反应或判断，不要重新介绍场景和在场人物。
- 引号外叙述严格遵守人称合同；引号内角色台词不受此限制。
- 若提供 truthConsistency，只用于避免把锁定事实写反；未解锁的手法仍不得在公聊台词中说穿。
- 对话必须服务 sceneContract.changeMode：冲突场可以索取、拒绝、改口、打断、试探或抬价；误解、错过、克制、合作、假胜利或安静重估场应靠答非所问、未说出口、行动配合、错误归因和事后差别推进。禁止轮流完整陈述观点，也禁止把所有场景改写成争吵。
- 不得说出 relationshipPressure.unsaidFact 与 withheldMeanings；它们只能通过答非所问、动作和后果被玩家猜到。

输出 JSON：
{
  "dialogues": [{"speaker":"姓名","line":"公开台词"}],
  "observations": [{"target":"姓名","note":"可见行为或你的疑问"}],
  "narrative": "串联公聊与心理（约 ${Math.round(targetWords * 0.55)} 字；可写心想、怀疑，相对时间）"
}`;

  const user = `角色 ${roleKey} / ${actKey} 公聊与心理段。

${characterArchive ? untrustedUserPayload("角色档案（voiceHints 必用于对白）", { name: characterArchive.name, voiceHints: characterArchive.voiceHints }) : ""}
${formatPromptBlock("publicActionBrief", publicActionBrief)}
${formatPromptBlock("sceneContract（对白必须在这些场景内发生）", sceneContract)}
${actionLog ? untrustedUserPayload("已完成经历段（只承接，不复述）", { narrative: actionLog.narrative, entries: actionLog.entries }) : ""}
${untrustedUserPayload("心理方向（自然融入正文，禁止输出字段名或方括号标签）", feelingGuidance)}
${truthConsistency ? untrustedUserPayload("角色事实一致性约束（不得在内心否认这些既定事实，也不得原句复述）", truthConsistency) : ""}
${formatPromptBlock("spoilerContract", spoilerContract)}
${formatPromptBlock("roleRoster", roleRoster)}
${formatPromptBlock("clueLedger", clueLedger)}
${entityUnlockContract ? formatPromptBlock("entityUnlockContract", { actKey: entityUnlockContract.actKey, schedule: entityUnlockContract.schedule?.slice(0, 12) }) : ""}
${terminologyGroundingContract ? formatPromptBlock("terminologyGroundingContract（专业词唯一来源表）", terminologyGroundingContract) : ""}
${formatPromptBlock("私人信息隔离", "不会提供其它角色剧本摘要；公共连续性仅以幕合同和公共环境为准")}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function buildSceneCompositionMessages({
  sceneContract,
  actionLog,
  dialogueLog,
  feelingsPack,
  publicActionBrief,
  roleKey,
  actKey,
  targetWords,
  spoilerContract,
  roleRoster,
  styleCard = null,
  characterArchive = null,
  truthConsistency = null,
  isKiller = false,
  actIndex = 0,
  finalActIndex = 0,
  killerAwareness = "self-aware",
  pov = "second",
  terminologyGroundingContract = null
}) {
  const literaryBlock = styleCard ? formatLiteraryStyleBlock(styleCard) : "";
  const eraBlock = styleCard?.era ? formatEraSettingBlock(styleCard.era) : "";
  const styleBlock = buildWritingStyleBlock({
    channel: "dialogue",
    isKiller,
    actIndex,
    finalActIndex,
    killerAwareness,
    characterArchive
  });
  const speechBlock = buildCombinedSpeechBlock({ styleCard, eraCard: styleCard?.era, characterArchive });
  const povBlock = buildPlayerPovBlock(pov);
  const system = `你是剧本杀私人本主笔。现在根据已经验收的场景合同和事实素材，第一次写出完整正文；这不是把两份材料机械拼接，也不是事后“去 AI 润色”。

${PRODUCT_BOUNDARY}

${HUMAN_STORY_FOUNDATION_BLOCK}

${HUMAN_PROSE_BLOCK}

${TERMINOLOGY_GROUNDING_BLOCK}

${povBlock}

${literaryBlock}
${eraBlock}
${speechBlock}
${styleBlock}

【成稿方法】
- 按 sceneContract.scenes 的时间顺序写，每场从 entryAction 进入，将 actionLog 与 dialogueLog 交错在同一现场；禁止先写完一大段经历，再罗列“某某说”。
- 每场按 changeMode 完成一次“原有压力 → 具体转折 → 可见差别”。只有 conflict 使用 demand → resistance → changed state；其他场景不能为了显得有戏而强塞索取、拒绝和倒计时。动作、对白、误解和代价互相推动，不写“大家讨论了一番”。
- relationshipPressure、withheldMeanings、feelingsPack 是后台方向，不得复制、释义或总结给玩家。心理只能依附当下注意、误判、改口和不肯做的动作。
- 禁止用具体行业名词伪装真实感。细节若不改变人物下一步，就删除。
- 禁止在动作或对白后补“这意味着/这说明/你其实/你终于明白/你一直这样告诉自己”；停在人物做出的选择及其后果上。
- 不写 Markdown 标题、任务清单、利弊分析、作者评语和总结金句。tasks 另有字段，正文不得复述。
- 引号外严格遵守人称合同；角色台词允许符合自己的口气。只使用 roleRoster 登记姓名，遵守 spoilerContract 与 truthConsistency。
- 目标约 ${targetWords} 字（±12%）。

输出 JSON：{"body":"完整玩家正文","sceneCoverage":[{"sceneKey":"s1","usedBeats":3}],"withheldMeaningsCopied":false,"suggestions":[]}`;
  const user = `请写 ${roleKey} / ${actKey} 的完整私人本正文。

${formatPromptBlock("sceneContract（必须逐场兑现）", sceneContract)}
${untrustedUserPayload("动作事实素材（不是可直接拼接的正文）", actionLog)}
${untrustedUserPayload("对白与观察素材（不是台词清单成稿）", dialogueLog)}
${untrustedUserPayload("心理方向（只能转成潜台词）", feelingsPack)}
${formatPromptBlock("publicActionBrief", publicActionBrief)}
${formatPromptBlock("roleRoster", roleRoster)}
${formatPromptBlock("spoilerContract", spoilerContract)}
${truthConsistency ? untrustedUserPayload("事实一致性约束", truthConsistency) : ""}
${terminologyGroundingContract ? formatPromptBlock("terminologyGroundingContract（成稿不得越界）", terminologyGroundingContract) : ""}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
