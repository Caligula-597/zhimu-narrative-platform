/**
 * P9.1 Context Preset data — generic packs, never caseId-keyed.
 */

export const CONTEXT_PRESET_IDS = Object.freeze([
  "CONTEMPORARY_URBAN",
  "ANCIENT_COURT",
  "SCI_FI_FACILITY",
  "CAMPUS_REALISTIC",
  "GENERIC_FANTASY",
]);

function binding(kind, label, entityKey) {
  return Object.freeze({
    entityId: `ctx:${entityKey}`,
    kind,
    label,
    source: "PRESET",
  });
}

export const CONTEXT_PRESETS = Object.freeze({
  CONTEMPORARY_URBAN: Object.freeze({
    id: "CONTEMPORARY_URBAN",
    settingTags: Object.freeze(["CONTEMPORARY", "MODERN", "当代", "现代", "都市"]),
    genreAffinity: Object.freeze(["现代", "现实", "都市", "封闭推凶", "公共任务"]),
    forbiddenLeakTokens: Object.freeze(["玉佩", "宫籍", "内廷", "密令", "时辰簿", "验印"]),
    bindings: Object.freeze({
      identityRecord: binding("RECORD", "住户登记档案", "identity-record"),
      recordLocation: binding("LOCATION", "物业档案室", "record-location"),
      accessCredential: binding("CREDENTIAL", "门禁权限", "access-credential"),
      settlementCode: binding("TRIGGER", "物业核验码", "settlement-code"),
      plantedEvidence: binding("OBJECT", "关键误导证物", "planted-evidence"),
      crimeScene: binding("LOCATION", "案发现场", "crime-scene"),
      decisiveEvidence: binding("OBJECT", "关键突破证物", "decisive-evidence"),
      contestedResource: binding("RESOURCE", "关键账册", "contested-resource"),
      factionMeetingPlace: binding("LOCATION", "私下会合点", "faction-meeting"),
      factionCredential: binding("CREDENTIAL", "成员暗号", "faction-credential"),
      publicTask: binding("TASK", "公共应急任务", "public-task"),
      centralDocument: binding("RECORD", "关键私人文书", "central-document"),
    }),
  }),

  ANCIENT_COURT: Object.freeze({
    id: "ANCIENT_COURT",
    settingTags: Object.freeze(["ANCIENT", "古代", "宫廷"]),
    genreAffinity: Object.freeze(["古风", "宫廷", "权谋"]),
    forbiddenLeakTokens: Object.freeze(["芯片", "终端", "数据库", "二维码"]),
    bindings: Object.freeze({
      identityRecord: binding("RECORD", "宫籍名录", "identity-record"),
      recordLocation: binding("LOCATION", "内廷档库", "record-location"),
      accessCredential: binding("CREDENTIAL", "腰牌通行权", "access-credential"),
      settlementCode: binding("TRIGGER", "验印密令", "settlement-code"),
      plantedEvidence: binding("OBJECT", "栽赃信物", "planted-evidence"),
      crimeScene: binding("LOCATION", "案发之处", "crime-scene"),
      decisiveEvidence: binding("OBJECT", "铁证", "decisive-evidence"),
      contestedResource: binding("RESOURCE", "印信或账簿", "contested-resource"),
      factionMeetingPlace: binding("LOCATION", "暗阁", "faction-meeting"),
      factionCredential: binding("CREDENTIAL", "暗记", "faction-credential"),
      publicTask: binding("TASK", "公门差事", "public-task"),
      centralDocument: binding("RECORD", "密信", "central-document"),
    }),
  }),

  SCI_FI_FACILITY: Object.freeze({
    id: "SCI_FI_FACILITY",
    settingTags: Object.freeze(["SCI_FI", "近未来", "空间站", "科幻"]),
    genreAffinity: Object.freeze(["科幻", "身份权限", "设施", "空间站"]),
    forbiddenLeakTokens: Object.freeze(["玉佩", "宫籍", "内廷", "密令", "时辰簿"]),
    bindings: Object.freeze({
      identityRecord: binding("RECORD", "舰员身份认证日志", "identity-record"),
      recordLocation: binding("LOCATION", "权限档案终端", "record-location"),
      accessCredential: binding("CREDENTIAL", "三级舱段授权", "access-credential"),
      settlementCode: binding("TRIGGER", "维修区结算授权码", "settlement-code"),
      plantedEvidence: binding("OBJECT", "误导传感记录", "planted-evidence"),
      crimeScene: binding("LOCATION", "事件舱段", "crime-scene"),
      decisiveEvidence: binding("OBJECT", "完整审计链", "decisive-evidence"),
      contestedResource: binding("RESOURCE", "反应堆维护权限表", "contested-resource"),
      factionMeetingPlace: binding("LOCATION", "私密通讯频道节点", "faction-meeting"),
      factionCredential: binding("CREDENTIAL", "私密通讯频道成员表", "faction-credential"),
      publicTask: binding("TASK", "关键系统维稳任务", "public-task"),
      centralDocument: binding("RECORD", "未发送的舰内报文", "central-document"),
    }),
  }),

  CAMPUS_REALISTIC: Object.freeze({
    id: "CAMPUS_REALISTIC",
    settingTags: Object.freeze(["CONTEMPORARY", "MODERN", "校园", "同学"]),
    genreAffinity: Object.freeze(["校园", "同学", "群像", "现实"]),
    forbiddenLeakTokens: Object.freeze(["玉佩", "宫籍", "内廷", "芯片舱段"]),
    bindings: Object.freeze({
      identityRecord: binding("RECORD", "学籍与社团登记", "identity-record"),
      recordLocation: binding("LOCATION", "旧教学楼档案柜", "record-location"),
      accessCredential: binding("CREDENTIAL", "活动室钥匙权限", "access-credential"),
      settlementCode: binding("TRIGGER", "活动签到码", "settlement-code"),
      plantedEvidence: binding("OBJECT", "误导物证", "planted-evidence"),
      crimeScene: binding("LOCATION", "事件现场", "crime-scene"),
      decisiveEvidence: binding("OBJECT", "关键突破物证", "decisive-evidence"),
      contestedResource: binding("RESOURCE", "社团账本", "contested-resource"),
      factionMeetingPlace: binding("LOCATION", "天台会合点", "faction-meeting"),
      factionCredential: binding("CREDENTIAL", "小团体暗号", "faction-credential"),
      publicTask: binding("TASK", "晚会供电与舞台任务", "public-task"),
      centralDocument: binding("RECORD", "未寄出的信", "central-document"),
    }),
  }),

  GENERIC_FANTASY: Object.freeze({
    id: "GENERIC_FANTASY",
    settingTags: Object.freeze(["FANTASY", "奇幻", "CUSTOM"]),
    genreAffinity: Object.freeze(["奇幻", "冒险"]),
    forbiddenLeakTokens: Object.freeze([]),
    bindings: Object.freeze({
      identityRecord: binding("RECORD", "血脉名册", "identity-record"),
      recordLocation: binding("LOCATION", "藏书密室", "record-location"),
      accessCredential: binding("CREDENTIAL", "通行符印", "access-credential"),
      settlementCode: binding("TRIGGER", "契约符文", "settlement-code"),
      plantedEvidence: binding("OBJECT", "误导信物", "planted-evidence"),
      crimeScene: binding("LOCATION", "事发之地", "crime-scene"),
      decisiveEvidence: binding("OBJECT", "决定性证物", "decisive-evidence"),
      contestedResource: binding("RESOURCE", "圣物或权柄", "contested-resource"),
      factionMeetingPlace: binding("LOCATION", "隐秘据点", "faction-meeting"),
      factionCredential: binding("CREDENTIAL", "盟约印记", "faction-credential"),
      publicTask: binding("TASK", "公共危局任务", "public-task"),
      centralDocument: binding("RECORD", "未送达的书信", "central-document"),
    }),
  }),
});

export function getContextPreset(presetId) {
  return CONTEXT_PRESETS[String(presetId || "")] || null;
}

export function listContextPresets() {
  return CONTEXT_PRESET_IDS.map((id) => CONTEXT_PRESETS[id]);
}
