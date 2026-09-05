/**
 * M08 Story Content Pack V1 — 阵营家族 COMPLETE 数据
 *
 * 仅数据：不新增专用 producer。ID/名称对齐设计库 V2.1 与 catalog-v2。
 * contentMaturity = COMPLETE
 */

function editableFromSlots(roleSlots, plotSlots) {
  return [
    ...Object.entries(roleSlots).map(([id, slot]) => ({
      id,
      key: id,
      label: slot.label || id,
      type: "CHARACTER",
      kind: "role",
      actions: ["SWAP", "EDIT"],
      locked: false,
    })),
    ...Object.entries(plotSlots).map(([id, slot]) => ({
      id,
      key: id,
      label: slot.label || id,
      type: slot.type || "TEXT_OR_PRESET",
      kind: "plot",
      actions: ["SWAP", "EDIT", "REGENERATE"],
      locked: false,
    })),
  ];
}

function freezeTemplate(tpl) {
  return Object.freeze({
    ...tpl,
    roleSlots: Object.freeze(tpl.roleSlots),
    plotSlots: Object.freeze(tpl.plotSlots),
    clueSlots: Object.freeze(tpl.clueSlots),
    stagePattern: Object.freeze(tpl.stagePattern),
    variants: Object.freeze(tpl.variants.map((v) => Object.freeze(v))),
    constraints: Object.freeze(tpl.constraints || []),
    defaultGeneration: Object.freeze(tpl.defaultGeneration || { preferredVariantId: tpl.variants[0]?.id }),
    editableSlots: Object.freeze(editableFromSlots(tpl.roleSlots, tpl.plotSlots)),
    integrationHints: Object.freeze(tpl.integrationHints || {}),
    contentMaturity: "COMPLETE",
    familyId: "M08",
  });
}

function variant(spec) {
  return {
    requiredSlots: spec.requiredSlots || ["factionLead", "memberA"],
    preferredSlots: spec.preferredSlots || ["memberB"],
    incompatibilities: spec.incompatibilities || [],
    recommendedCluePattern: spec.recommendedCluePattern || ["FACTION_FORESHADOW", "MEMBERSHIP_HINT", "FACTION_EXPOSURE"],
    revealPattern: spec.revealPattern || "staged_exposure",
    consequencePattern: spec.consequencePattern || "allegiance_shift",
    membershipPattern: spec.membershipPattern || "PRIVATE",
    informationPattern: spec.informationPattern || "MEMBERS_MUTUAL",
    pressurePattern: spec.pressurePattern || "loyalty_test",
    defaults: spec.defaults || {},
    ...spec,
  };
}

export const M08_FORM_PRESETS = Object.freeze({
  "formationReason": [
    "共同敌人",
    "共同利益",
    "血缘或组织归属",
    "被迫合作",
    "共同秘密",
    "资源依赖",
    "共同罪责",
    "外部威胁"
  ],
  "recruitmentMethod": [
    "私下邀请",
    "任务考验",
    "信物确认",
    "利益交换",
    "威胁胁迫",
    "共同秘密绑定",
    "第三方引荐"
  ],
  "betrayalTrigger": [
    "利益冲突",
    "身份揭露",
    "重要人物死亡",
    "隐藏目标曝光",
    "被牺牲",
    "道德底线",
    "外部策反",
    "阵营失败预期"
  ],
  "exposureMethod": [
    "物证",
    "证词",
    "行为矛盾",
    "密信",
    "暗号",
    "公开选择",
    "失败行动",
    "成员互相指认"
  ],
  "secrecyRule": [
    "成员互认全名单",
    "只认领袖",
    "只认直接联系人",
    "不知完整名单",
    "不对称知情"
  ],
  "goalVisibility": [
    "公开目标",
    "成员共享秘密目标",
    "每人理解不同",
    "领导层隐藏真正目标"
  ]
});

const STAGE = Object.freeze([
  {
    "id": "LATENT",
    "stageRole": "LATENT",
    "ordering": 0,
    "optional": false,
    "label": "潜伏/未成形"
  },
  {
    "id": "CONTACT",
    "stageRole": "CONTACT",
    "ordering": 1,
    "optional": true,
    "label": "接触"
  },
  {
    "id": "FORMATION",
    "stageRole": "FORMATION",
    "ordering": 2,
    "optional": false,
    "label": "成形"
  },
  {
    "id": "RECRUITMENT",
    "stageRole": "RECRUITMENT",
    "ordering": 3,
    "optional": true,
    "label": "招募扩张"
  },
  {
    "id": "SUSPICION",
    "stageRole": "SUSPICION",
    "ordering": 4,
    "optional": true,
    "label": "怀疑"
  },
  {
    "id": "PRESSURE",
    "stageRole": "PRESSURE",
    "ordering": 5,
    "optional": false,
    "label": "压力"
  },
  {
    "id": "SPLIT",
    "stageRole": "SPLIT",
    "ordering": 6,
    "optional": true,
    "label": "裂变"
  },
  {
    "id": "BETRAYAL",
    "stageRole": "BETRAYAL",
    "ordering": 7,
    "optional": true,
    "label": "叛变"
  },
  {
    "id": "EXPOSURE",
    "stageRole": "EXPOSURE",
    "ordering": 8,
    "optional": false,
    "label": "暴露"
  },
  {
    "id": "CONFRONTATION",
    "stageRole": "CONFRONTATION",
    "ordering": 9,
    "optional": true,
    "label": "对峙"
  },
  {
    "id": "RESOLUTION",
    "stageRole": "RESOLUTION",
    "ordering": 10,
    "optional": false,
    "label": "结算"
  },
  {
    "id": "CONSEQUENCE",
    "stageRole": "CONSEQUENCE",
    "ordering": 11,
    "optional": false,
    "label": "后果"
  }
]);

const CLUES = Object.freeze([
  {
    "id": "FACTION_FORESHADOW",
    "type": "FACTION_FORESHADOW",
    "purpose": "阵营伏笔",
    "required": true,
    "stageHint": "LATENT"
  },
  {
    "id": "MEMBERSHIP_HINT",
    "type": "MEMBERSHIP_HINT",
    "purpose": "成员暗示",
    "required": true,
    "stageHint": "CONTACT"
  },
  {
    "id": "SECRET_SIGNAL",
    "type": "SECRET_SIGNAL",
    "purpose": "秘密信号",
    "required": false,
    "stageHint": "FORMATION"
  },
  {
    "id": "RECRUITMENT_EVIDENCE",
    "type": "RECRUITMENT_EVIDENCE",
    "purpose": "招募证据",
    "required": false,
    "stageHint": "RECRUITMENT"
  },
  {
    "id": "LOYALTY_TEST",
    "type": "LOYALTY_TEST",
    "purpose": "忠诚考验",
    "required": false,
    "stageHint": "PRESSURE"
  },
  {
    "id": "BETRAYAL_HINT",
    "type": "BETRAYAL_HINT",
    "purpose": "背叛暗示",
    "required": false,
    "stageHint": "BETRAYAL"
  },
  {
    "id": "INTERNAL_CONFLICT",
    "type": "INTERNAL_CONFLICT",
    "purpose": "内部冲突",
    "required": false,
    "stageHint": "SPLIT"
  },
  {
    "id": "HIDDEN_GOAL_HINT",
    "type": "HIDDEN_GOAL_HINT",
    "purpose": "隐藏目标暗示",
    "required": true,
    "stageHint": "PRESSURE"
  },
  {
    "id": "MEMBERSHIP_CONFIRMATION",
    "type": "MEMBERSHIP_CONFIRMATION",
    "purpose": "归属确认",
    "required": true,
    "stageHint": "EXPOSURE"
  },
  {
    "id": "FACTION_EXPOSURE",
    "type": "FACTION_EXPOSURE",
    "purpose": "阵营暴露",
    "required": true,
    "stageHint": "EXPOSURE"
  }
]);

const BASE_CONSTRAINTS = Object.freeze([
  { type: "faction_not_static_label", summary: "阵营必须带来剧情压力或变化，不能只是静态标签" },
  { type: "membership_source_clear", summary: "归属与知情范围必须可叙述、可核对" },
  { type: "change_is_event", summary: "加入/退出/叛变/暴露必须是有触发与后果的剧情事件" },
  { type: "no_number_and_info_both_sides", summary: "不得让人数优势方同时拥有信息与数值双重碾压" },
  { type: "report_block_conflict", summary: "与其它 STORY block 冲突时明确报告" },
  { type: "role_assignments_only", summary: "阵营职责只写入 roleAssignments，不新增专用全局字段" },
]);

const ROLE_DEFS = Object.freeze({
  factionLead: {
    required: true,
    label: "阵营领袖",
    allowNpc: false,
    mustDifferFrom: [],
    preferredLoad: "high",
    allowedOverlap: true,
    narrativeRole: "faction_lead",
    intensity: 2,
    cardinality: "single",
  },
  memberA: {
    required: true,
    label: "核心成员甲",
    allowNpc: false,
    mustDifferFrom: ["factionLead"],
    preferredLoad: "medium",
    allowedOverlap: true,
    narrativeRole: "member",
    intensity: 1,
    cardinality: "single",
  },
  memberB: {
    required: false,
    label: "核心成员乙",
    allowNpc: false,
    mustDifferFrom: ["factionLead", "memberA"],
    preferredLoad: "medium",
    allowedOverlap: true,
    narrativeRole: "member",
    intensity: 1,
    cardinality: "single",
  },
  outsider: {
    required: false,
    label: "局外观察者",
    allowNpc: false,
    mustDifferFrom: ["factionLead", "memberA"],
    preferredLoad: "low",
    allowedOverlap: true,
    narrativeRole: "outsider",
    intensity: 1,
    cardinality: "single",
  },
  hiddenMember: {
    required: false,
    label: "潜伏成员",
    allowNpc: false,
    mustDifferFrom: ["factionLead"],
    preferredLoad: "high",
    allowedOverlap: true,
    narrativeRole: "hidden_member",
    intensity: 2,
    cardinality: "single",
  },
  rivalLead: {
    required: false,
    label: "对立阵营领袖",
    allowNpc: false,
    mustDifferFrom: ["factionLead", "memberA", "memberB"],
    preferredLoad: "high",
    allowedOverlap: true,
    narrativeRole: "rival_lead",
    intensity: 2,
    cardinality: "single",
  },
  defector: {
    required: false,
    label: "叛离/摇摆者",
    allowNpc: false,
    mustDifferFrom: [],
    preferredLoad: "high",
    allowedOverlap: true,
    narrativeRole: "defector",
    intensity: 2,
    cardinality: "single",
  },
  recruiter: {
    required: false,
    label: "招募者",
    allowNpc: false,
    mustDifferFrom: [],
    preferredLoad: "medium",
    allowedOverlap: true,
    narrativeRole: "recruiter",
    intensity: 1,
    cardinality: "single",
  },
  mediator: {
    required: false,
    label: "调停者",
    allowNpc: false,
    mustDifferFrom: ["factionLead", "rivalLead"],
    preferredLoad: "low",
    allowedOverlap: true,
    narrativeRole: "mediator",
    intensity: 1,
    cardinality: "single",
  },
  witness: {
    required: false,
    label: "知情见证者",
    allowNpc: true,
    mustDifferFrom: [],
    preferredLoad: "low",
    allowedOverlap: true,
    narrativeRole: "witness",
    intensity: 1,
    cardinality: "single",
  },
  thirdLead: {
    required: false,
    label: "第三方阵营领袖",
    allowNpc: false,
    mustDifferFrom: ["factionLead", "rivalLead", "memberA"],
    preferredLoad: "high",
    allowedOverlap: true,
    narrativeRole: "faction_lead",
    intensity: 2,
    cardinality: "single",
  },
});

/** 各子型共用核心槽；扩展槽经 roleKeys 按需并入，避免一次填满角色池。 */
function baseRoles(roleKeys = [], extra = {}) {
  const out = {
    factionLead: ROLE_DEFS.factionLead,
    memberA: ROLE_DEFS.memberA,
    memberB: ROLE_DEFS.memberB,
  };
  for (const key of roleKeys) {
    if (ROLE_DEFS[key]) out[key] = ROLE_DEFS[key];
  }
  return { ...out, ...extra };
}

function basePlots(extra = {}) {
  return {
    factionIdentity: { id: "factionIdentity", label: "阵营身份/名义", type: "TEXT_OR_PRESET", required: true, presets: ["公开同盟", "隐秘结社", "临时同盟", "非对称阵线"] },
    factionGoal: { id: "factionGoal", label: "阵营真实目标", type: "TEXT_OR_PRESET", required: true, presets: ["夺取关键资源", "保全共同秘密", "推翻既有秩序", "护送关键人物"] },
    publicGoal: { id: "publicGoal", label: "公开宣称目标", type: "TEXT_OR_PRESET", required: false, presets: ["维护秩序", "追查真相", "保全利益", "共同自保"] },
    hiddenGoal: { id: "hiddenGoal", label: "隐藏目标", type: "TEXT_OR_PRESET", required: false, presets: ["公开目标","成员共享秘密目标","每人理解不同","领导层隐藏真正目标"] },
    formationReason: { id: "formationReason", label: "成形原因", type: "TEXT_OR_PRESET", required: true, presets: ["共同敌人","共同利益","血缘或组织归属","被迫合作","共同秘密","资源依赖","共同罪责","外部威胁"] },
    recruitmentMethod: { id: "recruitmentMethod", label: "招募方式", type: "TEXT_OR_PRESET", required: false, presets: ["私下邀请","任务考验","信物确认","利益交换","威胁胁迫","共同秘密绑定","第三方引荐"] },
    joiningCondition: { id: "joiningCondition", label: "加入条件", type: "TEXT_OR_PRESET", required: false, presets: ["完成考验", "交出信物", "共享秘密", "利益交换"] },
    leavingCondition: { id: "leavingCondition", label: "退出条件", type: "TEXT_OR_PRESET", required: false, presets: ["支付代价", "公开切割", "被驱逐", "节点自动解散"] },
    loyaltyConflict: { id: "loyaltyConflict", label: "忠诚冲突", type: "TEXT_OR_PRESET", required: false, presets: ["个人目标冲突", "道德底线", "被牺牲风险"] },
    betrayalTrigger: { id: "betrayalTrigger", label: "背叛触发", type: "TEXT_OR_PRESET", required: false, presets: ["利益冲突","身份揭露","重要人物死亡","隐藏目标曝光","被牺牲","道德底线","外部策反","阵营失败预期"] },
    betrayalCost: { id: "betrayalCost", label: "背叛代价", type: "TEXT_OR_PRESET", required: false, presets: ["失去资源", "失去庇护", "暴露身份", "关系破裂"] },
    exposureRisk: { id: "exposureRisk", label: "暴露风险", type: "TEXT_OR_PRESET", required: false, presets: ["行动失败", "信物流失", "证词", "行为矛盾"] },
    secrecyRule: { id: "secrecyRule", label: "保密/互认规则", type: "TEXT_OR_PRESET", required: true, presets: ["成员互认全名单","只认领袖","只认直接联系人","不知完整名单","不对称知情"] },
    communicationRule: { id: "communicationRule", label: "沟通规则", type: "TEXT_OR_PRESET", required: false, presets: ["仅领袖串联", "点对点", "公开协调", "暗号"] },
    membershipVisibility: { id: "membershipVisibility", label: "归属可见性", type: "TEXT_OR_PRESET", required: true, presets: ["PUBLIC", "PRIVATE", "PARTIAL", "UNKNOWN_TO_MEMBER", "ASYMMETRIC"] },
    decisiveChoice: { id: "decisiveChoice", label: "决定性选择", type: "TEXT_OR_PRESET", required: false, presets: ["公开站队", "牺牲同伴", "交出目标", "撕毁同盟"] },
    consequence: { id: "consequence", label: "剧情后果", type: "TEXT_OR_PRESET", required: true, presets: ["阵营公开", "阵营分裂", "目标易手", "关系重排"] },
    ...extra,
  };
}

function pack(id, title, purpose, description, variants, plotExtra = {}, roleKeys = [], hintExtra = {}) {
  return freezeTemplate({
    id,
    title,
    purpose,
    description,
    roleSlots: baseRoles(roleKeys),
    plotSlots: basePlots(plotExtra),
    clueSlots: CLUES,
    stagePattern: STAGE,
    variants: variants.map(variant),
    constraints: BASE_CONSTRAINTS,
    defaultGeneration: { preferredVariantId: variants[0].id },
    integrationHints: {
      canPrecede: ["M01", "M07"],
      canFollow: ["M10", "M11"],
      weaveIntent: "阵营结构可与追凶、身份揭示、结局条件交织",
      ...hintExtra,
    },
  });
}


const M08_1 = pack(
  "M08-1",
  "固定公开阵营",
  "开场即公开归属与目标，用可观察行动差异制造阵营博弈与公共任务张力。",
  "开场公布归属、目标和能力；人数与能力差异分开平衡。公共任务可多方式结算。",
  [
    variant({"id":"V01","title":"开局全员互认公开阵营","description":"归属公开，成员彼此知道完整名单，围绕公开目标竞争。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PUBLIC","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"membershipVisibility":"PUBLIC","secrecyRule":"成员互认全名单","formationReason":"共同利益"}}),
    variant({"id":"V02","title":"公开阵营但手段冲突","description":"目标相同，两派公开却因手段路线冲突濒临分裂。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"internal_method_conflict","defaults":{"loyaltyConflict":"手段冲突","consequence":"阵营分裂"}}),
    variant({"id":"V03","title":"公开阵营掩护隐秘小组","description":"大阵营公开，内部另有未公布的执行小组。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PARTIAL","informationPattern":"LEAD_ONLY_FULL_LIST","pressurePattern":"loyalty_test","defaults":{"membershipVisibility":"PARTIAL","hiddenGoal":"领导层隐藏真正目标"}}),
    variant({"id":"V04","title":"公开阵营加公共任务赛道","description":"阵营围绕同一公共任务竞速或竞质，失败方付出可见代价。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"public_task_race","defaults":{"publicGoal":"维护秩序","factionGoal":"夺取关键资源"}}),
    variant({"id":"V05","title":"人数劣势信息补偿","description":"人数少的一方拥有信息优势，禁止双边双碾压。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"secrecyRule":"不对称知情","membershipVisibility":"PUBLIC"}}),
    variant({"id":"V06","title":"公开阵营中途洗牌站队","description":"公开归属在预设节点因选择改写，旧贡献按当时阵营解释。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"reassignment_node","defaults":{"leavingCondition":"节点自动解散","joiningCondition":"公开站队"}}),
    variant({"id":"V07","title":"双公开阵营对峙","description":"两公开阵营领袖对峙，局外者被迫选边。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA","rivalLead"],"preferredSlots":["outsider","memberB"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"decisiveChoice":"公开站队"}}),
    variant({"id":"V08","title":"公开同盟后目标曝光","description":"开场同盟友好，隐藏目标曝光后公开决裂。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"hidden_goal_leak","defaults":{"betrayalTrigger":"隐藏目标曝光","exposureRisk":"证词"}}),
    variant({"id":"V09","title":"公开阵营内部清洗","description":"领袖发动清洗，忠诚考验决定去留。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["defector","witness"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"betrayalTrigger":"被牺牲","consequence":"关系重排"}}),
    variant({"id":"V10","title":"公开阵营服务追凶节奏","description":"公开阵营立场影响谁被优先怀疑。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","HIDDEN_GOAL_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"formationReason":"共同敌人"}})
  ],
  {},
  ["outsider", "rivalLead"],
  {"canPrecede":["M01"],"weaveIntent":"公开阵营为调查提供可见对立面与掩护结构"},
);

const M08_2 = pack(
  "M08-2",
  "固定隐藏阵营",
  "归属固定但仅本人可见；必须存在可观察行动差异，而非只能猜身份。",
  "归属固定但仅本人可见；专属行动可隐去行动者但保留结果。",
  [
    variant({"id":"V01","title":"开局秘密成团且互认","description":"成员彼此互认，外人不知。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"membershipVisibility":"PRIVATE","secrecyRule":"成员互认全名单"}}),
    variant({"id":"V02","title":"秘密成团不知全名单","description":"每人只知直接联系人或领袖。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"DIRECT_CONTACT_ONLY","pressurePattern":"loyalty_test","defaults":{"secrecyRule":"只认直接联系人","membershipVisibility":"ASYMMETRIC"}}),
    variant({"id":"V03","title":"只认领袖的隐营","description":"成员互不相识，仅通过领袖串联。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"LEAD_ONLY","pressurePattern":"loyalty_test","defaults":{"secrecyRule":"只认领袖","communicationRule":"仅领袖串联"}}),
    variant({"id":"V04","title":"可观察专属行动差异","description":"隐营通过可观察结果暴露存在，而不点名行动者。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"observable_action_diff","defaults":{"exposureRisk":"行为矛盾"}}),
    variant({"id":"V05","title":"隐营掩护真凶","description":"隐营目标是掩护或转移调查。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"factionGoal":"保全共同秘密","hiddenGoal":"掩护关键人物"}}),
    variant({"id":"V06","title":"隐营中潜伏第三方","description":"两边隐营之外还有第三方潜伏者。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA","hiddenMember","rivalLead"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"membershipVisibility":"ASYMMETRIC"}}),
    variant({"id":"V07","title":"暗号逐步暴露","description":"通过暗号或信物链式暴露成员。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"recruitmentMethod":"信物确认"}}),
    variant({"id":"V08","title":"失败行动泄露","description":"专属行动失败导致暴露风险上升。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"failed_secret_action","defaults":{"exposureRisk":"行动失败","betrayalCost":"暴露身份"}}),
    variant({"id":"V09","title":"结算前不得泄数量","description":"不得提前泄露阵营数量。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"secrecyRule":"不知完整名单"}}),
    variant({"id":"V10","title":"身份揭示打乱隐营","description":"身份揭示改变隐营归属预期。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["defector","witness"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"betrayalTrigger":"身份揭露"}}),
    variant({"id":"V11","title":"证词对撞","description":"两名知情者以证词互相指认。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["witness","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"exposureRisk":"证词"}})
  ],
  {},
  ["hiddenMember", "outsider", "rivalLead", "defector", "witness"],
  {},
);

const M08_3 = pack(
  "M08-3",
  "非对称阵营",
  "各阵营不同操作接口、资源与成功条件；允许同时成功或同时失败。",
  "各阵营拥有不同操作接口、资源和成功条件；每个阵营至少一种能影响共同状态的有效行动。",
  [
    variant({"id":"V01","title":"双线非对称目标","description":"一方保全一方夺取，可同成同败。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","rivalLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"factionGoal":"保全共同秘密"}}),
    variant({"id":"V02","title":"信息营对行动营","description":"一方信息强、一方执行强，互相依赖又互忌。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"info_vs_action","defaults":{"secrecyRule":"不对称知情"}}),
    variant({"id":"V03","title":"公开条件表结算","description":"用条件表结算，不比人数比达成路径。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"publicGoal":"共同自保","consequence":"目标易手"}}),
    variant({"id":"V04","title":"共享状态争夺","description":"双方行动都写入同一共同状态。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"shared_state_contest","defaults":{"decisiveChoice":"交出目标"}}),
    variant({"id":"V05","title":"非对称招募权","description":"仅一方拥有招募接口。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["recruiter","memberB"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"recruitmentMethod":"私下邀请"}}),
    variant({"id":"V06","title":"同时成功窗口","description":"存在双方可同时达成的窄窗口。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"joiningCondition":"利益交换","consequence":"关系重排"}}),
    variant({"id":"V07","title":"同时失败惩罚","description":"双方失败触发共同灾难后果。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"mutual_failure","defaults":{"betrayalCost":"失去庇护"}}),
    variant({"id":"V08","title":"第三方渔利","description":"非对称对峙中局外者可抽成。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["outsider","mediator"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"decisiveChoice":"公开站队"}}),
    variant({"id":"V09","title":"接口解锁节奏","description":"非对称能力按阶段解锁。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"formationReason":"资源依赖"}}),
    variant({"id":"V10","title":"身份门槛接口","description":"某接口需要特定身份资格。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"joiningCondition":"完成考验","betrayalTrigger":"身份揭露"}})
  ],
  {"rivalGoal":{"id":"rivalGoal","label":"对立阵营目标","type":"TEXT_OR_PRESET","required":true,"presets":["夺取关键资源","公开真相","阻止保全"]},"asymmetricInterface":{"id":"asymmetricInterface","label":"非对称接口差异","type":"TEXT_OR_PRESET","required":true,"presets":["信息接口","行动接口","否决接口"]}},
  ["rivalLead", "outsider", "recruiter", "mediator"],
  {},
);

const M08_4 = pack(
  "M08-4",
  "动态阵营",
  "只在预设节点因选择、结算或身份恢复改变归属；保存历史归属，旧贡献按当时阵营解释。",
  "只在预设节点改变归属；变化后此前行动仍按当时阵营解释，不能追溯重算。",
  [
    variant({"id":"V01","title":"节点选择改归属","description":"关键选择节点改写归属。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"node_choice","defaults":{"leavingCondition":"节点自动解散","joiningCondition":"公开站队"}}),
    variant({"id":"V02","title":"结算码改归属","description":"正式结算码触发改属。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"betrayalTrigger":"利益冲突"}}),
    variant({"id":"V03","title":"身份恢复改归属","description":"身份揭示后自动改属。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"betrayalTrigger":"身份揭露"}}),
    variant({"id":"V04","title":"历史归属保留","description":"保存历史与当前归属双轨。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"consequence":"关系重排","secrecyRule":"不对称知情"}}),
    variant({"id":"V05","title":"旧贡献不可追溯","description":"变化后旧行动解释冻结。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"consequence":"阵营公开"}}),
    variant({"id":"V06","title":"临时改属后回流","description":"改属有时限，到期回流或锁定。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"leavingCondition":"支付代价","joiningCondition":"节点自动解散"}}),
    variant({"id":"V07","title":"强制改属压力","description":"外部威胁强制改属。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"formationReason":"外部威胁","betrayalCost":"失去庇护"}}),
    variant({"id":"V08","title":"双向挖角","description":"对立阵营在节点互相挖人。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","rivalLead","defector","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"recruitmentMethod":"利益交换"}}),
    variant({"id":"V09","title":"改属知情范围分层","description":"有人立刻知道，有人延后知道。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"ASYMMETRIC","informationPattern":"ASYMMETRIC","pressurePattern":"loyalty_test","defaults":{"membershipVisibility":"ASYMMETRIC"}}),
    variant({"id":"V10","title":"改属触发调查转向","description":"改属改变谁被怀疑。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"consequence":"关系重排"}})
  ],
  {"changeNode":{"id":"changeNode","label":"预设改变节点","type":"TEXT_OR_PRESET","required":true,"presets":["中期选择","结算后","身份揭示后","危机事件后"]},"historyRule":{"id":"historyRule","label":"历史归属规则","type":"TEXT_OR_PRESET","required":true,"presets":["保存双轨","旧贡献冻结","知情分层"]}},
  ["rivalLead", "defector", "outsider"],
  {},
);

const M08_5 = pack(
  "M08-5",
  "个人目标叠加阵营目标",
  "阵营与个人分别结算，可同时成败；个人目标不要求全部背叛阵营。",
  "每人零到两项个人目标；个人结算只读正式状态。",
  [
    variant({"id":"V01","title":"个人与阵营可同成","description":"两条线独立结算。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"loyaltyConflict":"个人目标冲突","factionGoal":"夺取关键资源"}}),
    variant({"id":"V02","title":"个人目标不必然叛变","description":"完成个人不必背叛。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"betrayalTrigger":"道德底线","betrayalCost":"关系破裂"}}),
    variant({"id":"V03","title":"个人目标诱惑叛变","description":"个人线提供可选叛变收益。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["defector"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"betrayalTrigger":"利益冲突"}}),
    variant({"id":"V04","title":"领袖隐瞒个人目标","description":"领袖个人目标与阵营冲突。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"hiddenGoal":"领导层隐藏真正目标"}}),
    variant({"id":"V05","title":"成员间个人目标互斥","description":"两成员个人目标对立。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA","memberB"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"loyaltyConflict":"个人目标冲突"}}),
    variant({"id":"V06","title":"个人目标公开化压力","description":"暴露个人目标引发清洗。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"exposureRisk":"密信","consequence":"阵营分裂"}}),
    variant({"id":"V07","title":"双结算仪表","description":"分开展示阵营与个人结果。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"publicGoal":"追查真相","hiddenGoal":"成员共享秘密目标"}}),
    variant({"id":"V08","title":"个人目标绑定身份","description":"个人目标依赖身份资格。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"joiningCondition":"完成考验"}}),
    variant({"id":"V09","title":"个人目标影响结局","description":"个人达成写入结局条件提示。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"consequence":"目标易手"}}),
    variant({"id":"V10","title":"零个人目标成员","description":"允许部分人无额外个人目标。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"formationReason":"共同敌人"}})
  ],
  {"personalGoal":{"id":"personalGoal","label":"个人叠加目标","type":"TEXT_OR_PRESET","required":true,"presets":["保全某人","取得信物","隐藏罪责","换取逃离"]},"personalSettleRule":{"id":"personalSettleRule","label":"个人结算规则","type":"TEXT_OR_PRESET","required":true,"presets":["只读正式状态","可与阵营同成同败","不强制背叛"]}},
  ["defector", "outsider"],
  {},
);

const M08_6 = pack(
  "M08-6",
  "临时联盟",
  "规定节点双确认建立联盟；设持续时间、共享范围与退出成本；不自动共享私人内容。",
  "联盟需双确认；零成本反复进出应被禁止。",
  [
    variant({"id":"V01","title":"危机临时结盟","description":"共同危机触发结盟窗口。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"formationReason":"被迫合作","leavingCondition":"支付代价"}}),
    variant({"id":"V02","title":"双确认契约","description":"双方确认才生效。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","rivalLead","mediator"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"joiningCondition":"利益交换"}}),
    variant({"id":"V03","title":"限时共享资源","description":"只共享合同规定资源。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"communicationRule":"公开协调","consequence":"关系重排"}}),
    variant({"id":"V04","title":"退出付费","description":"退出必须付成本。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"leavingCondition":"支付代价","betrayalCost":"失去资源"}}),
    variant({"id":"V05","title":"表面同盟隐藏胜利","description":"同盟下各有隐藏胜利条件。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PARTIAL","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"hiddenGoal":"每人理解不同","membershipVisibility":"PARTIAL"}}),
    variant({"id":"V06","title":"同盟后被迫拆伙","description":"节点到期强制解散。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"leavingCondition":"节点自动解散"}}),
    variant({"id":"V07","title":"第三方撮合联盟","description":"调停者促成。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["mediator","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"recruitmentMethod":"第三方引荐"}}),
    variant({"id":"V08","title":"禁止零成本刷盟","description":"规则禁止反复进出。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"joiningCondition":"共享秘密","leavingCondition":"公开切割"}}),
    variant({"id":"V09","title":"同盟不共享私人本","description":"明确不自动共享私密内容。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"secrecyRule":"不对称知情","communicationRule":"点对点"}}),
    variant({"id":"V10","title":"同盟服务共同任务","description":"先共同任务后各自算账。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"publicGoal":"共同自保","factionGoal":"保全共同秘密"}})
  ],
  {"allianceDuration":{"id":"allianceDuration","label":"联盟持续时间","type":"TEXT_OR_PRESET","required":true,"presets":["一阶段","至危机解除","至任务完成","固定回合"]},"shareScope":{"id":"shareScope","label":"共享范围","type":"TEXT_OR_PRESET","required":true,"presets":["仅资源","仅行动结果","有限情报","不含私人内容"]},"exitCost":{"id":"exitCost","label":"退出成本","type":"TEXT_OR_PRESET","required":true,"presets":["失去资源","暴露部分归属","关系惩罚","任务减益"]}},
  ["rivalLead", "mediator", "outsider"],
  {},
);

const M08_7 = pack(
  "M08-7",
  "阵营影响公共任务",
  "先定义独立可运行的公共任务，再定义各阵营希望其成功、失败、延迟或换方案；破坏须有次数与成本。",
  "先结算公共任务客观状态，再分别检查阵营条件；拒绝参与不能成为稳定必胜。",
  [
    variant({"id":"V01","title":"希望任务成功","description":"阵营收益绑定公共成功。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"publicGoal":"维护秩序","factionGoal":"夺取关键资源"},"semanticOverrides":{"phases":{"progression":{"goal":"确保{ctx.publicTask}成功","action":"组织成员推动{ctx.publicTask}完成","target":"{ctx.publicTask}","actionKind":"SUPPORT_PUBLIC_TASK","produces":[{"id":"public_task_success_pressure","factType":"public_task_success_pressure","kind":"public_task_success_pressure","summary":"{ctx.publicTask}成功压力"}]}}},"semanticExpectations":{"requiredGoalTokens":["成功"],"forbiddenGoalTokens":["失败","延迟","成功、失败或延迟"],"requiredActionKind":"SUPPORT_PUBLIC_TASK","requiredFactTypes":["public_task_success_pressure"]}}),
    variant({"id":"V02","title":"希望任务失败","description":"阵营有正式破坏动作。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"betrayalTrigger":"利益冲突","exposureRisk":"行动失败"},"semanticOverrides":{"phases":{"progression":{"goal":"阻止{ctx.publicTask}完成","action":"干扰{ctx.publicTask}的关键步骤或资源","target":"{ctx.publicTask}","actionKind":"SABOTAGE_PUBLIC_TASK","produces":[{"id":"public_task_failure_pressure","factType":"public_task_failure_pressure","kind":"public_task_failure_pressure","summary":"{ctx.publicTask}失败压力"}]}}},"semanticExpectations":{"requiredGoalTokens":["阻止"],"forbiddenGoalTokens":["确保公共任务成功","成功、失败或延迟"],"requiredActionKind":"SABOTAGE_PUBLIC_TASK","requiredFactTypes":["public_task_failure_pressure"]}}),
    variant({"id":"V03","title":"希望延迟","description":"拖到节点后结算更有利。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"decisiveChoice":"撕毁同盟"}}),
    variant({"id":"V04","title":"希望换方案","description":"推动公共任务改用另一方案。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"loyaltyConflict":"手段冲突"}}),
    variant({"id":"V05","title":"先公共后阵营结算","description":"客观状态先落盘。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"public_then_faction","defaults":{"consequence":"目标易手"}}),
    variant({"id":"V06","title":"破坏有配额","description":"破坏动作有次数与成本。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"betrayalCost":"失去资源","exposureRisk":"失败行动"}}),
    variant({"id":"V07","title":"拒绝参与非必胜","description":"拒绝不能稳定通关。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"formationReason":"共同罪责"}}),
    variant({"id":"V08","title":"双阵营相反偏好","description":"一方要成一方要败。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","rivalLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"formationReason":"共同敌人"}}),
    variant({"id":"V09","title":"公共失败引发叛变","description":"公共失败触发叛变窗口。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["defector"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"betrayalTrigger":"阵营失败预期"}}),
    variant({"id":"V10","title":"任务现场权限","description":"地点权限只对某阵营开放。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"joiningCondition":"交出信物"}})
  ],
  {"publicTask":{"id":"publicTask","label":"公共任务","type":"TEXT_OR_PRESET","required":true,"presets":["护送","搜证","封印","拍卖","投票决议"]},"stancePreference":{"id":"stancePreference","label":"阵营立场偏好","type":"TEXT_OR_PRESET","required":true,"presets":["希望成功","希望失败","希望延迟","希望换方案"]},"sabotageRule":{"id":"sabotageRule","label":"正式破坏规则","type":"TEXT_OR_PRESET","required":true,"presets":["有次数","有成本","可观察后果","失败反噬"]}},
  ["rivalLead", "defector", "outsider"],
  {},
);

const M08_8 = pack(
  "M08-8",
  "多阵营并存",
  "推荐三阵营非对称；条件表结算，不强制单一冠军；须防两盟永久无成本压制第三方。",
  "阵营数不得接近玩家数；允许多档结果并存。",
  [
    variant({"id":"V01","title":"三营条件表","description":"三阵营并行，条件表多档。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","rivalLead","memberA","memberB"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"membershipVisibility":"PUBLIC"}}),
    variant({"id":"V02","title":"两盟压制第三方风险","description":"设计上阻止无成本永久压制。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["outsider","mediator"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"formationReason":"共同敌人"}}),
    variant({"id":"V03","title":"三角临时结盟轮换","description":"任意两方短盟后解散。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"leavingCondition":"节点自动解散","joiningCondition":"利益交换"}}),
    variant({"id":"V04","title":"第三方渔利档","description":"第三方以部分成功档位渔利。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"consequence":"目标易手"}}),
    variant({"id":"V05","title":"隐一公二","description":"两公开一隐藏。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PARTIAL","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"membershipVisibility":"PARTIAL","secrecyRule":"不对称知情"}}),
    variant({"id":"V06","title":"三隐营互不知全貌","description":"三方皆隐，信息碎片化。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"DIRECT_CONTACT_ONLY","pressurePattern":"loyalty_test","defaults":{"membershipVisibility":"PRIVATE"}}),
    variant({"id":"V07","title":"多档并存结算","description":"允许多档结果并存。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"consequence":"关系重排"}}),
    variant({"id":"V08","title":"阵营数远小于人数","description":"强调分组粒度。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"formationReason":"共同利益"}}),
    variant({"id":"V09","title":"身份揭示重洗三营","description":"身份揭示触发三营重排。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["defector","hiddenMember"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"betrayalTrigger":"身份揭露"}}),
    variant({"id":"V10","title":"追凶归属落在某营","description":"真凶归属改变三营局势。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"factionGoal":"保全共同秘密","hiddenGoal":"掩护关键人物"}}),
    variant({"id":"V11","title":"结局条件读三营档","description":"为结局映射预留条件表接口。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"decisiveChoice":"公开站队"}}),
    variant({"id":"V12","title":"世界变化逼站队","description":"世界或现场变化迫使重站队。","beatPattern":{"setup":"阵营关系进入可观察状态","develop":"压力与信息差推动成员选择","resolve":"归属或目标变化产生剧情后果"},"requiredSlots":["factionLead","memberA"],"preferredSlots":["memberB","outsider"],"incompatibilities":[],"recommendedCluePattern":["FACTION_FORESHADOW","MEMBERSHIP_HINT","FACTION_EXPOSURE"],"revealPattern":"staged_exposure","consequencePattern":"allegiance_shift","membershipPattern":"PRIVATE","informationPattern":"MEMBERS_MUTUAL","pressurePattern":"loyalty_test","defaults":{"formationReason":"外部威胁","consequence":"阵营公开"}})
  ],
  {"conditionTable":{"id":"conditionTable","label":"多营条件表摘要","type":"TEXT_OR_PRESET","required":true,"presets":["三档并存","两成一败","部分成功渔利","防双盟永久压制"]},"campCountRule":{"id":"campCountRule","label":"阵营数约束","type":"TEXT_OR_PRESET","required":true,"presets":["远小于玩家数","推荐三营","禁止接近人数"]}},
  ["rivalLead", "thirdLead", "outsider", "hiddenMember", "mediator", "defector"],
  {"canFollow":["M10","M11"],"weaveIntent":"多营条件表直接服务结局映射与世界变化站队"},
);

export function buildM08CompleteTemplates() {
  return Object.freeze([M08_1, M08_2, M08_3, M08_4, M08_5, M08_6, M08_7, M08_8]);
}

export const M08_TEMPLATE_IDS = Object.freeze([
  "M08-1",
  "M08-2",
  "M08-3",
  "M08-4",
  "M08-5",
  "M08-6",
  "M08-7",
  "M08-8",
]);

export function m08ContentCoverageMatrix() {
  return buildM08CompleteTemplates().map((t) => ({
    id: t.id,
    title: t.title,
    contentMaturity: t.contentMaturity,
    variantCount: t.variants.length,
    roleSlots: Object.keys(t.roleSlots),
    plotSlots: Object.keys(t.plotSlots),
    clueSlots: t.clueSlots.map((c) => c.id || c),
    stagePattern: t.stagePattern.map((s) => s.id || s),
    membershipPatterns: [...new Set(t.variants.map((v) => v.membershipPattern).filter(Boolean))],
    informationPatterns: [...new Set(t.variants.map((v) => v.informationPattern).filter(Boolean))],
    integrationHints: t.integrationHints,
  }));
}
