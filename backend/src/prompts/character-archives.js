import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";
import { styleCardForPrompt } from "./matrix-literary-styles.js";
import { playStructureProfile } from "../../../shared/play-structure.js";
import { HUMAN_STORY_FOUNDATION_BLOCK } from "./human-authorship.js";

export function buildCharacterArchivesMessages({ setting, synopsis, config, truthBible, styleCard }) {
  const playProfile = playStructureProfile(setting.playStructure);
  const decisionContract = playProfile.requiresPlayableDecision
    ? `- 每位角色必须有 immediateWant、privateInterest、nonNegotiable、failureCost、playableMoves、resources、relationshipDebts；decisionPower 仅在人物既有身份与关系确实产生独占/稀缺权限时填写，否则允许空字符串。\n- 禁止为了结构整齐给每位角色各配一项签署、否决、定价、担保、公开或转让权。那只是六张不同名称的否决票。人物的能动性可以来自身份误认、经营职责、身体能力、表演任务、秘密关系、掌握他人生活或率先实施某种行动，而且不同角色的能动性来源、数量与强度可以不平均。\n- relationshipDebts 必须指向其他登记角色，并写清旧债、筹码与何时决裂。角色即使没有独占权限、不完成任务，也要能通过 playableMoves 主动改变至少一人的局面。`
    : "- 推理案件仍需给每位角色至少一种能改变调查方向的主动行动，不能只分配目击与秘密。";
  const system = `你是多人剧本杀「角色秘密档案」策划师。基于真相 Bible 为每位角色建立档案，不写长篇正文。

${PRODUCT_BOUNDARY}

${HUMAN_STORY_FOUNDATION_BLOCK}

【任务】
- 输出恰好 ${config.playerCount} 位角色，key 为 role-1 … role-N；name 格式「姓名 · 身份」。
- 每位角色必须有：publicIdentity、pronouns、hiddenIdentity、motive、relationships、timelineActions、lies（3 条）、innerConflict、voiceHints、actTasks（每幕 2～3 条 tasks + tips）。
${decisionContract}
- pronouns 只能填「他」「她」或「TA」，后续所有幕必须保持一致。
- voiceHints 须写清**说话与感官**（5 行以内）：register（ blunt/文绉/快嘴等）、taboos（绝不说的话）、catchphrases（1～2 个口癖）、sampleLine（一句典型台词）、sensoryFilter（写心理时常用的职业感官，如「满手机油」「账本纸边」「玻璃瓶壁打滑」）。不同角色 register 与 sensoryFilter 必须互不相同。
- actTasks.tasks 必须可执行、可公聊；禁止写「找出真凶」这类终局任务放在第一幕。
- 角色不是 HOST 真相的缩写。knownTruthNodeKeys 只能登记此人确实完整知道的节点；partialTruths 用来登记他看见的一截、坚持的误解或能被后来重释的记忆。禁止为了让信息“公平”而让所有角色平均知道全部 truthNodes。
- 事实层在此仍可被人物反压。对每个 critical 真相节点填写 truthStressTests：这些人凭既有关系、利益与压力是否真的会做出该行动。不能用“剧情需要”“一时冲动”补洞；若不可信，明确返回 truth_revision 或 character_revision，停止把矛盾带入线索层。
- 每位角色填写 agencyProfile：agencyProof 证明他能改变什么；dependencyProof 证明别人为何绕不过他；exposurePlan 证明他在哪些幕进入核心互动；removalImpact 说明删掉此人会具体损失哪条行动、关系或判断路径。信息多不等于可玩，只有念线索不能算 agency。
- 两人之间的旧事允许只长在这两个人身上；局部关系不是缺陷。除非某条信息会改变全桌共同处境，否则不得强行把所有角色牵进来。
- 不得泄露 spoilerGates 中本幕 forbiddenFacts；真凶角色的 actTasks 不得含「认罪」。

【输出 schema】
{
  "roles": [{
    "key": "role-1",
    "name": "姓名 · 身份",
    "publicIdentity": "公开身份",
    "pronouns": "他/她/TA",
    "hiddenIdentity": "隐藏身份/秘密",
    "motive": "动机",
    "relationships": "与其他角色暗线",
    "timelineActions": "案件时间线上的真实行动",
    "lies": ["谎言1","谎言2","谎言3"],
    "innerConflict": "性格深层矛盾",
    "immediateWant": "开场后立刻想从别人手里得到什么",
    "privateInterest": "不能用公开立场概括的私人利益",
    "nonNegotiable": "宁可失败也不肯让出的东西",
    "decisionPower": "若人物关系自然产生独占/稀缺权限则填写；不得为了每人一项而强造，否则为空字符串",
    "failureCost": "本角色失败时具体失去什么",
    "agencyProfile": {"agencyProof":"能主动改变什么","dependencyProof":"别人为什么需要此人","exposurePlan":[{"actKey":"ch1","interaction":"进入哪次核心互动并能做什么","affectedRoleKeys":["role-2"]}],"removalImpact":"删掉此人后具体断掉什么"},
    "playableMoves": ["可主动执行的行动1","可主动执行的行动2"],
    "resources": [{"key":"role-1-resource-1","name":"可转让资源","amount":1,"transferable":true,"meaning":"用途"}],
    "relationshipDebts": [{"roleKey":"role-2","debt":"具体旧债","leverage":"眼下筹码","fractureCondition":"何时决裂"}],
    "knownTruthNodeKeys": ["truth-1"],
    "partialTruths": [{"truthNodeKey":"truth-2","fragment":"此人亲历或听见的具体一截","misinterpretation":"此人因此形成、但不必正确的理解","learnedInActKey":"ch1"}],
    "voiceHints": "register: …\\ntaboos: …\\ncatchphrases: …\\nsampleLine: 「…」\\nsensoryFilter: …",
    "actTasks": [{"actKey":"ch1","tasks":["本幕任务"],"tips":"【提示】可选"}]
  }],
  "truthStressTests": [{"truthNodeKey":"truth-1","roleKeys":["role-1","role-2"],"pressureChain":"既有关系与利益怎样一步步逼出该行动","behaviorVerdict":"credible|character_revision|truth_revision","contradiction":"若不成立，具体矛盾在哪里","revisionTarget":"应回改哪个人物字段或真相节点"}],
  "suggestions": ["写作注意"]
}`;
  const user = `请生成角色秘密档案。幕 key：${JSON.stringify(config.chapterKeys)}。

${creativeInputUserBlocks(setting, synopsis)}
${untrustedUserPayload("真相 Bible", truthBible)}
${styleCard ? untrustedUserPayload("风格规则", styleCardForPrompt(styleCard)) : ""}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
