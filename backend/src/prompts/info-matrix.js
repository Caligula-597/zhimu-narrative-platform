import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";
import {
  buildMatrixModeProfile,
  formatMatrixCreativePromptBlock,
  isLayerEnabled
} from "./matrix-2-mode.js";
import { playStructureProfile } from "../../../shared/play-structure.js";
import { HUMAN_STORY_FOUNDATION_BLOCK } from "./human-authorship.js";

export function buildInfoMatrixMessages({ setting, synopsis, config, truthBible, characterArchives, clueNetwork, styleCard }) {
  const modeProfile = buildMatrixModeProfile(setting);
  const creativeBlock = formatMatrixCreativePromptBlock(setting, styleCard);
  const l4 = isLayerEnabled(modeProfile, "L4");
  const playProfile = playStructureProfile(setting.playStructure);
  const playableContract = playProfile.requiresPlayableDecision
    ? `【公共幕合同 — 阵营/机制/混合结构必填】
- 先为每幕建立 actContracts，再写任何角色 row。每幕至少两个持续场景；所有角色本和主持手册以后只能投影这里，禁止各自发明现场。线索已由上一层独立建网，本层只安排出现时间和接收者，绝不新增、改写或把局部线索变成全员线索。
- 每幕必须填写 temporarySharedGoal 与 cooperationPayoff，并至少包含一个 exploration / cooperation / recovery 场景：玩家要先探索、交换能力或完成一个共同目标，私人矛盾才有继续发作的现实条件。合作不等于和解，也不要求所有人获利相同。
- decisions 每幕恰好一个必须结算的公共决定，至少两个都有人会真实选择的选项；必须写 deadline、无人行动时的 defaultEffect，以及该后果真实改变的 defaultAxisEffects。
- 每个公共决定至少有一个会制造明确受益者、受损者与反制窗口的尖锐选项。其他选项可以用于探索、合作或保留退路，但必须填写 tradeoff，写清选择它会放弃什么；禁止把“折中处理”写成显然优于其他方案的标准答案。
- 公平审查只检查玩家是否理解规则、是否有可执行反制、关键事实是否可获得；不得为了公平把资源、收益、损失、戏份和结局配平。
- 每个选项都必须通过 axisEffects 改变至少一个 truthBible.endingAxes，且不同选项不能写出完全相同的状态变化；否则该幕对结局无效。
- roleEpilogues 只读取这些既有 endingAxes：公共流程不得为照顾某个角色尾声临时新增专属积分，也不得保证每个人都得到对称回报。
- defaultAxisEffects 也必须改变至少一个结局轴；禁止出现“文字上已经拍卖、失去资格或完成出售，运行状态却不变化”的假默认后果。
- rows 必须完整覆盖 ${config.playerCount} 位角色 × ${config.chapterKeys.length} 幕；每格任务只能使用角色档案已有 decisionPower、playableMoves、resources 和 relationshipDebts。
- sceneSequence 每场必须有可观察变化，但不要求都发生显性胜负。changeMode 可为 conflict、misunderstanding、missed_connection、mutual_restraint、cooperation、false_victory 或 quiet_revaluation；只有 conflict 才强制 conflictObject。mode 为 exploration/cooperation 时，explorationChoices 或 cooperationRequirement 必填；仅“众人争论、气氛紧张、交换观点”不算变化。
- 每个多人场景填写 observableBeats，锁定双方都可能看见或听见的动作、原话、物件与先后。memoryAgreement=shared 的事实各角色本必须一致；disputed/partial 只允许解释和记忆不同，不允许连谁进门、谁碰物件都互相矛盾。私人心理不得写进此表。
- branchOpenings 写本幕后因为玩家做法不同而真正打开或关闭的支线，不得只重复结局轴。`
    : "【公共幕合同】推理案件可保留 actContracts / decisions；若填写，同样是主持和所有角色本的唯一公共现场。";

  const system = `你是剧本杀「信息矩阵 · Matrix 2.0」设计师。设计 L2 公共池 + 角色 rows +（可选）L4 触发器。

${PRODUCT_BOUNDARY}

${creativeBlock}

${HUMAN_STORY_FOUNDATION_BLOCK}

${playableContract}

【L2 线索调度 — 上一层已锁定】
- clueNetwork 是唯一线索源。本层输出不得包含 clues 字段，不得发明新的 clue key，也不得修改玩家可见描述与 HOST 含义。
- 发放契约：当某幕的机制行动在主持端完成结算时，系统把该幕 rows.newClueIds 中 grantMode=auto 的线索幂等发给对应 roleKey；host_confirm 仍须主持人手动确认，不得自动发放。
- private/pair/group/bridge/texture 线索只进入明确 holder 的 row；public_anchor 才允许全桌公共出现。grantMode=auto 只表示自动发给既定 holder，绝不等于全员公开。
- publicEnvironmentByAct：每幕 80～200 字公共环境描写，只能引用 clueNetwork.publicAnchorKeys；不得把 hostMeaning、真相节点或私人线索写进公共环境。
- scenes（可选）：{ key, name, actKey, clueIds[] } 场景调查点；clueIds 必须来自 clueNetwork，且场景与 clue.acquisition 相符。

【推理面包屑 — 本格必填】
- 终幕定案用的物证/目击，须在前幕已有 L2 公共锚点或 row 可观察行为铺垫（递进怀疑链，禁止终幕「天降铁证」如突然指纹/DNA）。
- 同一推理链按幕递进：ch1 公共疑点 → ch2 角色感知/目击 → ch3 交叉验证收束。
- rows.tasks 中每个「是否…/解释…/去过…」动词，须在对应幕有可写进剧本的物理动作（推门、翻箱、对质某人）。

【L3/L5 在 rows 中的映射】
- rows.tasks = L5 **表层目标**（对质/公开/辩护；禁止「收集 N 条线索」）。
- rows.misbeliefs / suspicion = 可圆的红鲱鱼方向。
- rows.newClueIds = 本幕该角色**新获知**的 L2 线索（不是独家推理必需事实）。
- rows.forbidden = 本幕不可写的结论（对齐 spoilerGates）。
- rows.notYetInferred = 客观信息已经在附近，但本角色此时还没有完成的推论；rows.forbiddenConclusions = 即使模型能从结构猜到也不得替玩家说出的结论；allowedSuspicionRange = 本幕允许怀疑到哪一步、必须停在哪里。

${l4 ? `【L4 机制触发器 — 变格必填】
- mechanicalTriggers: [{ key, actKey, if: "条件", then: "unlock_clue|activate_segment|state_change", hostNote }]
` : "【L4】本格模式 mechanicalTriggers 留空数组 []。"}

【输出 schema】
{
  "actTitles": {"ch1":"幕标题"},
  "actSummaries": {"ch1":"幕摘要"},
  "publicEnvironmentByAct": {"ch1":"公共环境描写"},
  "scenes": [{"key":"scene-1","name":"灯室","actKey":"ch2","clueIds":["clue-5"]}],
  "decisions": [{"key":"decision-1","actKey":"ch1","question":"全桌本幕必须决定的具体事项","deadline":"何时截止","defaultEffect":"无人行动的后果","defaultAxisEffects":[{"axisKey":"axis-1","delta":-1}],"options":[{"key":"option-a","label":"可执行选项","immediateEffect":"立即变化","benefitingRoleKeys":["role-1"],"harmedRoleKeys":["role-2"],"counterplayRoleKeys":["role-2"],"counterplay":"role-2 在何时能执行什么反制","tradeoff":"若不是对抗选项，写选择它会放弃什么","axisEffects":[{"axisKey":"axis-1","delta":1}]}]}],
  "actContracts": [{"actKey":"ch1","title":"幕标题","publicSituation":"所有人此刻共同面对什么","temporarySharedGoal":"本幕必须暂时合作完成什么","cooperationPayoff":"完成后全桌获得何种继续行动/判断的条件","deadline":"本幕期限","mandatoryDecisionKey":"decision-1","entryState":"入幕时已成立的状态","exitState":"结算后不可逆的新状态","resourceChanges":["资源变化"],"branchOpenings":["本幕玩法会开启或关闭的具体支线"],"sceneSequence":[{"sceneKey":"ch1-s1","mode":"exploration|cooperation|negotiation|confrontation|recovery","changeMode":"conflict|misunderstanding|missed_connection|mutual_restraint|cooperation|false_victory|quiet_revaluation","location":"具体地点","timeWindow":"时间窗口","presentRoleKeys":["role-1","role-2"],"entryAction":"可见开场动作","conflictObject":"仅 conflict 必填","explorationChoices":[{"action":"玩家可选探索动作","gain":"获得什么","risk":"承担什么风险"}],"cooperationRequirement":"需要哪些人交出什么能力或资源才能完成","roleDemands":[{"roleKey":"role-1","demand":"当场诉求"}],"observableBeats":[{"key":"ch1-s1-b1","actorRoleKey":"role-1","actionOrLine":"双方都能看见的动作或听见的原话","object":"涉及物件","sequence":1,"memoryAgreement":"shared|disputed|partial","interpretationFreedom":"允许各自怎样误读，不写私人真相"}],"stateChange":"可以是现实、关系、认知位置或行动机会的可观察变化"}]}],
  "mechanicalTriggers": [],
  "rows": [{
    "roleKey":"role-1","actKey":"ch1",
    "newClueIds":["clue-1"],
    "misbeliefs":"误解",
    "suspicion":"怀疑方向",
    "forbidden":"本幕不可知",
    "notYetInferred":["本幕尚未自行推到的结论"],
    "forbiddenConclusions":["即使结构可猜也不得由作者替玩家完成的推论"],
    "allowedSuspicionRange":"允许怀疑的对象、依据与停止位置",
    "lies":["对外谎言"],
    "tasks":["表层任务：说明…/是否公开…"]
  }],
  "suggestions": ["矩阵复核建议"]
}`;

  const user = `请生成 Matrix 2.0 信息矩阵。角色 keys：${JSON.stringify((characterArchives.roles || []).map((r) => r.key))}；幕 keys：${JSON.stringify(config.chapterKeys)}。

${creativeInputUserBlocks(setting, synopsis)}
${untrustedUserPayload("L1 真相 Bible", {
  playStructure: truthBible.playStructure,
  summary: truthBible.summary,
  centralQuestion: truthBible.centralQuestion,
  publicCrisis: truthBible.publicCrisis,
  irreversibleDeadline: truthBible.irreversibleDeadline,
  objectiveFacts: truthBible.objectiveFacts,
  truthNodes: truthBible.truthNodes,
  sharedObjective: truthBible.sharedObjective,
  endingAxes: truthBible.endingAxes,
  endingRoutes: truthBible.endingRoutes,
  roleEpilogues: truthBible.roleEpilogues,
  settlementPrinciple: truthBible.settlementPrinciple,
  killer: truthBible.killer,
  method: truthBible.method,
  misdirections: truthBible.misdirections,
  spoilerGates: truthBible.spoilerGates,
  supernaturalRules: truthBible.supernaturalRules
})}
${untrustedUserPayload("角色可玩权限（不得擅自补权）", (characterArchives.roles || []).map((r) => ({ key: r.key, name: r.name, immediateWant: r.immediateWant, privateInterest: r.privateInterest, nonNegotiable: r.nonNegotiable, decisionPower: r.decisionPower, failureCost: r.failureCost, playableMoves: r.playableMoves, resources: r.resources, relationshipDebts: r.relationshipDebts, lies: r.lies })))}
${untrustedUserPayload("已锁定线索网络（只能调度，不得改写；hostMeaning 不得进入公共环境或玩家任务）", {
  publicAnchorKeys: clueNetwork.publicAnchorKeys,
  clues: (clueNetwork.clues || []).map((clue) => ({
    key: clue.key,
    name: clue.name,
    actKey: clue.actKey,
    scope: clue.scope,
    involvedRoleKeys: clue.involvedRoleKeys,
    holderRoleKeys: clue.holderRoleKeys,
    grantMode: clue.grantMode,
    source: clue.source,
    acquisition: clue.acquisition,
    physicalForm: clue.physicalForm,
    affordances: clue.affordances
  }))
})}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
