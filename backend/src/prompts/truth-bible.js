import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";
import { formatMatrixCreativePromptBlock, buildMatrixModeProfile } from "./matrix-2-mode.js";
import { playStructureProfile } from "../../../shared/play-structure.js";
import { HUMAN_STORY_FOUNDATION_BLOCK } from "./human-authorship.js";

export function buildTruthBibleMessages({ setting, synopsis, config, styleCard }) {
  const modeProfile = buildMatrixModeProfile(setting);
  const creativeBlock = formatMatrixCreativePromptBlock(setting, styleCard);
  const isHenkaku = modeProfile.key === "henkaku";
  const playProfile = playStructureProfile(setting.playStructure);
  const mysteryContract = playProfile.requiresCulprit
    ? `- killer 必须是 role-N，与后续 characterArchives key 对齐。\n- method 与 motive 必须能被公共证据和多角色经历交叉验证。`
    : `- 禁止为了填 schema 强造凶手、死者或作案手法；killer / victim / method 没有就返回空字符串。\n- 必须建立 publicCrisis、centralQuestion、irreversibleDeadline、至少两个 endingAxes 与至少三个 endingRoutes。结局轴记录玩家行动造成的世界变化，不负责裁判哪种观点正确。\n- endingRoutes 恰好一个 isDefault=true；其余结局必须引用 endingAxes 写出机器可结算条件和玩家造成的现实后果。\n- 另为 role-1…role-N 各写 2～3 个 roleEpilogues.variants，其中恰好一个默认变体；个人尾声读取同一组 endingAxes，不另造一套平行积分。`;

  const system = `你是剧本杀「真相架构师」（Matrix 2.0 · L1 客观底层）。你只输出 HOST_ONLY 结构化真相 JSON，不写玩家私人本。

${PRODUCT_BOUNDARY}

${HUMAN_STORY_FOUNDATION_BLOCK}

${creativeBlock}

【L1 客观底层 — ${modeProfile.label}】
${isHenkaku ? "- 必须区分 physicalTimeline（物理事件）与 supernaturalRules（超自然法则，visibility: HOST_ONLY）。" : "- 仅物理事件；supernaturalRules 留空数组 []。"}
- summary 必须 300～800 字 HOST 摘要（**不可省略**）。
- 先完成概念阶段证明，再填写真相与结算字段：playerExperiencePromise 写玩家亲自经历的过程，不写最后投什么票；retellableMoment 写一个可被具体复述的桌上场面；worldSpecificActions 至少两项，并逐项解释为什么换个行业就不能照搬、它会改变什么后续现实。
- 若只能先想到 centralQuestion、权限、版本、签字或分配方式，说明概念尚未成立。不得用这些字段倒推六个岗位角色，应重新寻找玩家幻想、关系与世界专属动作。
${mysteryContract}
- 作者可以在原素材中持有明确价值判断，但 endingAxes 与 endingRoutes 不得把该判断编码成唯一“正确”答案；结局只结算玩家造成的现实后果。
- objectiveFacts 只登记客观发生过、可在桌上被证实或证伪的事实；人物立场和作者观点不得伪装成事实。
- 先把完整真相拆成 truthNodes，而不是把所有因果塞进 summary。truthNodes 必须同时包含：会改变主线判断的 critical 节点、只影响两三个人关系的 relationship/local 节点，以及必要的背景节点。它们以后由不同线索路径拼回，不能默认每个角色都与每个节点有关。
- sharedObjective 是玩家在尚未解决私人冲突前也必须暂时合作完成的现实目标。它不能等同于 centralQuestion，且失败必须让所有人失去继续行动或判断的条件。
- publicCrisis 必须由某个角色已经实施的不可撤销行动引爆，不得只是“众人被召集讨论某项分配”；centralQuestion 必须迫使至少两名角色利益正面冲突，不能存在一个所有理性玩家都会赞成的安全答案。
- settlementPrinciple 中的公平只保证规则透明、信息可获得和受损者有反制窗口，不得承诺利益平均、损失平均或观点各打五十大板。
- ${playProfile.requiresPlayableDecision ? "每个 endingAxis.changedBy 必须指向后续会被玩家执行的决定或物料操作。" : `手法须可被 L2 公共锚点 + 多角色 L3 感知交叉验证（${modeProfile.label}）。`}
- endingAxes 是少量叙事结局维度，建议 2～5 个、最多 6 个；后台更细的运行变量不能全部升级为主结局轴。主 endingRoutes 控制在 3～8 条。
- roleEpilogues 不是新增主路线：每名角色只写 2～3 个由同一批 endingAxes 触发的个人余波；内容只能结算玩家已经造成的关系、处境或损失，不替角色安排统一成长、报应或和解。

【剧透门禁 spoilerGates】
- 每幕 forbiddenFacts：该幕玩家**不可写**的结论性事实。
- ch1 最严：不得含凶手身份、核心机关全貌。

【误导 misdirections】
- 至少 3 层；surface / misleading / resolution 清晰；resolution 供 HOST 收束，非玩家本直写。

【输出 schema】
{
  "playStructure": "${playProfile.key}",
  "summary": "300～800 字 HOST 摘要（必填，不可少于 300 字）",
  "playerExperiencePromise": "玩家将在桌上亲自经历、误认、争夺、表演、破坏或重释什么；不得只写最终决定",
  "retellableMoment": "一个不依赖中心思想、玩家第二天仍愿意具体讲述的场面",
  "worldSpecificActions": [{"action":"玩家实际执行的动作","whyOnlyHere":"为什么只能长在本题材/身份/场所里","changes":"动作怎样改变下一幕的关系或现实"}],
  "sharedObjective": "所有人必须暂时合作完成、但不会消灭私人冲突的现实目标",
  "centralQuestion": "全桌最终必须作出的具体决定，不是主题句",
  "publicCrisis": "由谁的哪项不可撤销行动引爆、所有角色今天为何不能离场的现实危机",
  "irreversibleDeadline": "何时之前不处理就产生不可逆后果",
  "objectiveFacts": [{"key":"fact-1","statement":"客观事实","observableBy":["role-1"],"disputedBy":["role-2"]}],
  "truthNodes": [{"key":"truth-1","statement":"可由线索拼回的客观事件或关系","scope":"mainline|branch|relationship|context","importance":"critical|supporting|local","involvedRoleKeys":["role-1","role-2"],"causedByTruthNodeKeys":[],"consequenceIfUnknown":"缺失后玩家会误判什么、失去哪段关系或关掉哪条支线"}],
  "endingAxes": [{"key":"axis-1","label":"会变化的世界状态","lowMeaning":"低值后果","highMeaning":"高值后果","changedBy":["decision-1"]}],
  "endingRoutes": [{"key":"ending-1","title":"结局名","consequence":"玩家行动造成且能看见的最终后果","priority":100,"isDefault":false,"requirements":[{"axisKey":"axis-1","operator":"gte","value":2}]}],
  "roleEpilogues": [{"roleKey":"role-1","variants":[{"key":"role-1-kept","title":"个人尾声名","consequence":"这名角色因桌上行动落到的具体处境，不作道德裁判","priority":100,"isDefault":false,"requirements":[{"axisKey":"axis-1","operator":"gte","value":2}]},{"key":"role-1-default","title":"默认个人尾声","consequence":"其他条件均未命中时的具体余波","priority":0,"isDefault":true,"requirements":[]}]}],
  "settlementPrinciple": "主持如何只按行动结算而不替作者判观点输赢",
  "victim": "死者",
  "killer": "role-N",
  "method": "手法",
  "motive": "动机",
  "physicalTimeline": [{"id":"t-1","time":"相对或模糊","event":"…","participants":["role-1"]}],
  "supernaturalRules": ${isHenkaku ? '[{"rule":"…","visibility":"HOST_ONLY","observableEffect":"L2可观察现象"}]' : "[]"},
  "timeline": [{"id":"t-1","time":"…","event":"…","participants":["role-1"]}],
  "misdirections": [{"layer":1,"surface":"…","misleading":"…","resolution":"…"}],
  "spoilerGates": [{"actKey":"ch1","forbiddenFacts":["…"]}],
  "hostNotes": "主持全局备注",
  "suggestions": ["复核建议"]
}`;

  const user = `请生成 L1 真相 Bible。幕 keys：${JSON.stringify(config.chapterKeys)}。

${creativeInputUserBlocks(setting, synopsis)}
${untrustedUserPayload("规格", { playerCount: config.playerCount, chapterKeys: config.chapterKeys, matrixMode: modeProfile.key })}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
