/** Neutral story-outline protocol vocabulary shared by generation and acceptance stages. */

export const OUTLINE_VERSION = 2;
export const OUTLINE_REVISION = "2.2";
export const OUTLINE_REVISIONS = new Set(["2.2", "2.3", "2.4"]);
export const GENERIC_FINGERPRINT = /调查旧案|缺失记录|恢复记录|机构阴谋|企业阴谋|政府阴谋|公开真相|揭露真相|隐瞒真相|销毁真相|真相与利益|真相与谎言|真相与稳定|稳定与真相|人性抉择|道德抉择|资源与道德|选择人性|玩家中的设计者/iu;
export const GENERIC_ENDING_TITLE = /^(?:真相大白|悬而未决|沉默的代价|未竟之事|默认结局|开放结局|新的开始|最后的选择|艰难抉择|代价|和解|救赎)$/iu;
export const STATE_OPERATIONS = new Set(["set", "increment", "decrement", "add", "remove"]);
export const RESOURCE_OPERATIONS = new Set(["gain", "lose", "set", "transfer"]);
export const ENTITY_TYPES = new Set(["npc", "organization", "system", "device", "physicalObject", "location", "group"]);
export const RESPONSIBILITY_TYPES = new Set(["cause", "escalation", "maintenance", "resolution"]);
export const AUTHORIZATION_STATUSES = new Set(["authorized", "exceeded", "forged", "not-required"]);
export const OPTION_EFFECT_TARGET_TYPES = new Set(["state", "resource", "evidence", "event"]);
export const OPTION_EFFECT_OPERATIONS = {
  state: STATE_OPERATIONS,
  resource: RESOURCE_OPERATIONS,
  evidence: new Set(["lock", "unlock"]),
  event: new Set(["trigger"])
};
export const RESOURCE_VALUE_TYPES = new Set(["integer", "number"]);
export const RESOURCE_OWNER_TYPES = new Set(["group", "player", "entity"]);
export const INTERNAL_CHOICE_LANGUAGE = /(?:state-|resource-|chapter-\d+|写入状态|本章立即写入|后续权限、材料与结局路线|\b(?:verified|contested|broken|unlocked|locked|pending|eligible|ineligible)\b)/iu;
export const INTERNAL_NARRATIVE_LANGUAGE = /(?:state-|resource-|chapter-\d+|role-\d+|写入状态|后续路线|\b(?:verified|contested|broken|unlocked|locked)\b)/iu;
export const SOURCE_SHELL_ENTITY = /(?:^source[-_]?(?:\d|outline)|来源\s*\d+(?:[-—·.]\d+)?|原始来源(?:\s|$)|独立保存并提供.*原始信息|原始载体与来源链的登记实体)/iu;
export const GENERIC_RESPONSIBILITY_ACTION = /^(?:(?:玩家|角色|他|她)\s*)?(?:协助|帮助|参与|处理|解决|调查|寻找|提供|支持|推进)(?:危机|问题|事件|真相|线索|证据|行动|计划)?[。.!！]?$/iu;
export const GENERIC_RESPONSIBILITY_EFFECT = /^(?:使|让|导致|从而)?(?:危机|问题|事件|局势|调查|剧情|真相)?(?:继续|持续|升级|推进|变化|受到影响|得到解决)[。.!！]?$/iu;
export const MISDIRECTION_KINDS = {
  mystery: new Set(["suspicion", "evidence"]),
  emotional: new Set(["memory", "relationship"]),
  political: new Set(["alliance", "authority"]),
  variety: new Set(["publicNarrative", "task"]),
  survival: new Set(["risk", "resource"]),
  hybrid: new Set(["suspicion", "evidence", "memory", "relationship", "alliance", "authority", "publicNarrative", "task", "risk", "resource"])
};
export const BATCH_FINGERPRINT_FIELDS = [
  "storyEngine",
  "antagonistType",
  "finalChoiceType",
  "themeExpression",
  "mysteryObjectType",
  "truthRevealMethod",
  "playerRelationshipTopology",
  "chapterCausalPattern",
  "evidenceModalityMix",
  "powerStructure",
  "endingMechanism",
  "existenceStatusMechanism",
  "truthKnowledgeDistribution"
];
export const CAUSAL_RESPONSIBILITY_TYPES = new Set(["cause", "escalation", "maintenance"]);

export function inferEntityTypesFromName(name) {
  if (/(?:委员会|管理局|公司|法院|医院|学校|研究所|协会|俱乐部|赛事联盟|联盟|机构|王国|议会)$/u.test(name)) return new Set(["organization"]);
  if (/(?:医疗组|建设组|行动组|居民组|工作组|团队|队伍|班组|剧团成员|嘉宾群体|战队|人员|成员)$/u.test(name)) return new Set(["group"]);
  if (/(?:室|房间|大厅|站台|舱室|球场|温室|林场|机房)$/u.test(name)) return new Set(["location"]);
  if (/(?:母带|原件|样本|画作|铜镜|红门|底片|便签|皮箱|墓志铭|冰芯|纸本|遗物|纸质协议|补充协议|签署文件|诊断书)$/u.test(name)) return new Set(["physicalObject"]);
  if (/(?:数据库|控制主机|服务器|平台|系统|算法|云端|档案系统|主机|数字日志|服务器日志|分配日志|授权链|监测站|控制站|签名服务|认证服务|数据服务)$/u.test(name)) return new Set(["system", "device"]);
  if (/(?:录音机|摄像机|终端|传感器|冷柜|扫描仪|门禁机|设备|记录板)$/u.test(name)) return new Set(["device", "system"]);
  return null;
}

export function isSourceTypeCompatible(sourceType, entityType) {
  if (/(?:独立证词|口供|人物证词)/u.test(sourceType)) return ["npc", "group"].includes(entityType);
  if (/(?:设备日志|系统日志|机器日志)/u.test(sourceType)) return ["device", "system"].includes(entityType);
  if (/(?:制度记录|机构记录|司法记录)/u.test(sourceType)) return ["system", "organization", "physicalObject"].includes(entityType);
  if (/(?:物理痕迹|物理检验|物证)/u.test(sourceType)) return ["physicalObject", "device", "location"].includes(entityType);
  return true;
}
