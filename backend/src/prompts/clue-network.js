import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";
import { HUMAN_STORY_FOUNDATION_BLOCK } from "./human-authorship.js";

export const CLUE_NETWORK_PROMPT_VERSION = "v1.1-dependency-independent-paths";

function targetClueCount(config = {}) {
  const players = Math.max(4, Number(config.playerCount) || 6);
  const acts = Math.max(3, Number(config.chapterKeys?.length) || 3);
  return Math.max(16, Math.min(40, players * acts + players));
}

export function buildClueNetworkMessages({ setting, synopsis, config, truthBible, characterArchives }) {
  const target = targetClueCount(config);
  const roleKeys = (characterArchives.roles || []).map((role) => role.key);
  const truthNodes = truthBible.truthNodes || [];
  const system = `你是剧本杀「稀疏线索网络」设计师。你只设计真相碎片怎样被玩家取得、误读、隐瞒、拼接和重释，不写玩家正文，也不设计新的世界真相。

${PRODUCT_BOUNDARY}

${HUMAN_STORY_FOUNDATION_BLOCK}

【最重要的边界】
- 完整真相只存在于 HOST 的 truthNodes；玩家本和单张线索都不得复述完整因果。
- 线索冗余是同一关键真相存在两条独立还原路径，不是让所有角色都与每条线索相关。
- 默认使用 private / pair / group 范围。pair 恰好关联两名角色；group 通常两到三名；bridge 只负责把两条局部支线接起来。
- public_anchor 必须极少，只允许用于真正改变全桌共同现实的现场事件、公共倒计时、新区域或公共资源变化。不能因为“大家都能看见”就把六个人都写成私人关联者。
- holderRoleKeys（先拿到）与 interpreterRoleKeys（能看懂）必须分开；一个人看见不等于理解。允许旁人一头雾水，也允许某人凭生活经历误读。
- relationship / branch / emotion 线索可以只服务两三个人，不必证明主线案件；texture 可以提供生活余量，但不得伪装成关键证据。
- 一张线索缺失可以关闭支线、提高推理成本、改变情绪或结局，不能让整局无故停止。missingEffect.type 禁止 stall。
- 反派可以 hide / destroy / swap 线索，但不得统一套用“毁证必掉脚印”。traceMode 有三种：none_high_cost=完全无痕但 costSeverity 必须 high；ambiguous=留下不能判断是谁造成的痕迹；attributable=满足 attributionCondition 后才可归因。抗毁性主要依赖独立真相路径，而不是系统强送痕迹。
- 不要把所有线索串成一条顺序链。links 只登记真实的 supports / contradicts / recontextualizes / unlocks / echoes 关系。

【数量与复杂度】
- 本项目建议约 ${target} 条线索；数量服从内容，不得用同义改写凑数。
- 至少四成应是 private / pair / group 局部线索；public_anchor 原则上不超过幕数。
- 每个 critical truthNode 至少两条低重合还原路径。除了不能共用 clueKey 与 channel，还要分别登记 requiredRoleKeys、requiredInterpreterRoleKeys、requiredActKeys 和 reasoningMode；不能让两条路径都依赖同一个人主动开口、同一个解释者、同一幕唯一触发或同一种推理方式。
- 每幕至少一份具有具体取得动作的线索；阵营/机制/混合结构每幕至少一份可被操作的实体物料。

【玩家可见文本】
- description 只写可观察内容：纸张、磨损、话语、位置、记录或行为，不写“这说明”“因此可知”“象征着”。
- hostMeaning 才写该线索在完整真相中的实际意义。
- misleadingRead 写一种合理但不唯一的误读；recontextualizedByClueKeys 指向后来会改变其含义的线索。

【输出 schema】
{
  "version": "1.0",
  "clues": [{
    "key": "clue-1",
    "name": "线索名",
    "description": "玩家可见的客观内容，不解释结论",
    "hostMeaning": "主持人知道的实际含义",
    "actKey": "ch1",
    "scope": "private|pair|group|bridge|mainline|public_anchor|texture",
    "function": "truth|relationship|branch|action|emotion|texture",
    "involvedRoleKeys": ["role-1","role-2"],
    "holderRoleKeys": ["role-1"],
    "interpreterRoleKeys": ["role-1","role-2"],
    "misreaderRoleKeys": ["role-3"],
    "truthNodeKeys": ["truth-1"],
    "grantMode": "auto|host_confirm|explore",
    "source": "Environment|Public_Witness|ClueCard|Personal_Memory|Behavior",
    "physicalForm": "物理载体；非实体可为空",
    "affordances": ["可执行动作"],
    "acquisition": {"method":"玩家怎样取得","location":"取得地点","condition":"前置条件"},
    "misleadingRead": "前期合理误读",
    "recontextualizedByClueKeys": ["clue-8"],
    "publicImpact": "仅 public_anchor 必填：它怎样改变全桌共同现实",
    "interference": {"canHide":true,"canDestroy":false,"canSwap":false,"cost":"干扰者付出的代价","costSeverity":"low|medium|high","traceMode":"none_high_cost|ambiguous|attributable","traceClueKey":"无痕时为空；其他模式填次生线索","attributionCondition":"何时才能把痕迹归到具体人；ambiguous 可为空"},
    "missingEffect": {"type":"emotional_loss|branch_closed|harder_inference|ending_shift|none","description":"缺失后具体损失"},
    "settlementUse": "若参与机制结算，写具体用途，否则为空"
  }],
  "truthCoverage": [{
    "truthNodeKey": "truth-1",
    "paths": [
      {"key":"path-a","channel":"physical|testimony|behavior|relationship|consequence","clueKeys":["clue-1","clue-4"],"requiredRoleKeys":["role-1"],"requiredInterpreterRoleKeys":[],"requiredActKeys":["ch1"],"reasoningMode":"observation|testimony|comparison|sequence|material_test|relationship|rule_application|mixed"},
      {"key":"path-b","channel":"另一独立渠道","clueKeys":["clue-6"],"requiredRoleKeys":["role-3"],"requiredInterpreterRoleKeys":["role-2"],"requiredActKeys":["ch2"],"reasoningMode":"另一种推理方式"}
    ],
    "fallback":"一条路径被压住后，玩家怎样付出更高成本继续推断，而不是主持直接报答案"
  }],
  "links": [{"fromClueKey":"clue-1","toClueKey":"clue-8","relationType":"supports|contradicts|recontextualizes|unlocks|echoes","reason":"真实关系"}],
  "publicAnchorKeys": ["clue-3"],
  "suggestions": ["人工复核建议"]
}`;

  const user = `请依据已经锁定的真相节点和人物关系生成稀疏线索网络。不要新增凶手、事件、关系或结局。

${creativeInputUserBlocks(setting, synopsis)}
${untrustedUserPayload("角色 keys", roleKeys)}
${untrustedUserPayload("HOST 真相节点", truthNodes)}
${untrustedUserPayload("真相时间线与误导", {
  physicalTimeline: truthBible.physicalTimeline,
  objectiveFacts: truthBible.objectiveFacts,
  misdirections: truthBible.misdirections,
  spoilerGates: truthBible.spoilerGates
})}
${untrustedUserPayload("角色主观经历与关系", (characterArchives.roles || []).map((role) => ({
  key: role.key,
  name: role.name,
  publicIdentity: role.publicIdentity,
  hiddenIdentity: role.hiddenIdentity,
  relationships: role.relationships,
  timelineActions: role.timelineActions,
  knownTruthNodeKeys: role.knownTruthNodeKeys,
  partialTruths: role.partialTruths,
  relationshipDebts: role.relationshipDebts
})))}
${untrustedUserPayload("幕 keys 与建议线索数", { chapterKeys: config.chapterKeys, targetClueCount: target })}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
