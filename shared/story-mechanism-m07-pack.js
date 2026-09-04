/**
 * M07 Story Content Pack V1 — 记忆/身份家族 COMPLETE 数据
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
    familyId: "M07",
  });
}

function variant(spec) {
  return {
    requiredSlots: spec.requiredSlots || ["bearer"],
    preferredSlots: spec.preferredSlots || ["knower"],
    incompatibilities: spec.incompatibilities || [],
    recommendedCluePattern: spec.recommendedCluePattern || ["FORESHADOW", "IDENTITY_HINT", "CONFIRMATION"],
    revealPattern: spec.revealPattern || "staged",
    consequencePattern: spec.consequencePattern || "relation_shift",
    defaults: spec.defaults || {},
    ...spec,
  };
}

/** 形式候选池（不写死角色名/世界观专名）。 */
export const M07_FORM_PRESETS = Object.freeze({
  concealmentReason: Object.freeze([
    "保护他人免受牵连",
    "逃避旧案追责",
    "维持当前身份所依赖的社会位置",
    "等待某项条件成熟才能公开",
    "被胁迫不得说出真相",
  ]),
  memoryLossForm: Object.freeze([
    "创伤性封闭",
    "人为药物/仪式阻断",
    "第三者篡改叙述",
    "自愿选择遗忘以自保",
    "记录被抽走导致无法核对",
  ]),
  identityProofForm: Object.freeze([
    "私人物件",
    "身体特征",
    "家族记录",
    "第三方证词",
    "密信",
    "独有知识",
    "血缘关系证据",
    "行为习惯",
  ]),
  misdirectionForm: Object.freeze([
    "伪造身世文书",
    "栽赃他人身份线索",
    "故意散播错误称谓",
    "用相似外貌制造误认",
    "用半真半假的回忆片段误导",
  ]),
  revealCarrierForm: Object.freeze([
    "物件对读",
    "知情者被迫开口",
    "公开记录被调出",
    "多线索交叉验证",
    "本人在压力下承认",
    "第三方当众指认",
  ]),
  knowerSourceForm: Object.freeze([
    "亲历旧事件",
    "保管关键文书",
    "受人之托保密",
    "偶然目击关键场面",
    "职业权限接触档案",
  ]),
  cognitionConflictForm: Object.freeze([
    "早期行为与后期设定冲突",
    "知情者本应阻止却未阻止",
    "表面关系与真实血缘冲突",
    "权限变化与既有承诺冲突",
  ]),
});

const STAGE = Object.freeze([
  { id: "HIDDEN", stageRole: "HIDDEN", ordering: 0, optional: false, label: "隐藏期" },
  { id: "FIRST_ANOMALY", stageRole: "FIRST_ANOMALY", ordering: 1, optional: false, label: "第一次异常" },
  { id: "PARTIAL_REVEAL", stageRole: "PARTIAL_REVEAL", ordering: 2, optional: false, label: "部分显现" },
  { id: "CONTRADICTION", stageRole: "CONTRADICTION", ordering: 3, optional: true, label: "认知冲突" },
  { id: "CONFIRMATION", stageRole: "CONFIRMATION", ordering: 4, optional: false, label: "确认揭示" },
  { id: "CONSEQUENCE", stageRole: "CONSEQUENCE", ordering: 5, optional: false, label: "揭示后果" },
]);

const CLUES = Object.freeze([
  { id: "FORESHADOW", type: "FORESHADOW", purpose: "早期伏笔", required: true, stageHint: "HIDDEN" },
  { id: "MEMORY_FRAGMENT", type: "MEMORY_FRAGMENT", purpose: "记忆碎片", required: false, stageHint: "PARTIAL_REVEAL" },
  { id: "IDENTITY_HINT", type: "IDENTITY_HINT", purpose: "身份暗示", required: true, stageHint: "FIRST_ANOMALY" },
  { id: "MISDIRECTION", type: "MISDIRECTION", purpose: "误导", required: false, stageHint: "PARTIAL_REVEAL" },
  { id: "CONFIRMATION", type: "CONFIRMATION", purpose: "确认", required: true, stageHint: "CONFIRMATION" },
  { id: "DECISIVE_REVEAL", type: "DECISIVE_REVEAL", purpose: "决定性揭示", required: true, stageHint: "CONFIRMATION" },
]);

const BASE_CONSTRAINTS = Object.freeze([
  { type: "no_early_core_leak", summary: "不得在 HIDDEN 阶段提前泄露核心身份/记忆" },
  { type: "knower_source_required", summary: "知情者必须有成立的信息来源" },
  { type: "reveal_needs_foresight", summary: "关键揭示必须有前置依据（伏笔或碎片）" },
  { type: "reveal_has_consequence", summary: "身份/记忆揭示必须产生剧情后果，不能只是标签变化" },
  { type: "no_impossible_amnesia", summary: "不得出现逻辑上本人不可能不知道却强行失忆" },
  { type: "report_block_conflict", summary: "与其它 STORY block 冲突时明确报告，不得静默覆盖" },
]);

function baseRoles(extra = {}) {
  return {
    bearer: {
      required: true,
      label: "核心身份/记忆承担者",
      allowNpc: false,
      mustDifferFrom: [],
      preferredLoad: "medium",
      allowedOverlap: true,
      narrativeRole: "identity_bearer",
      intensity: 2,
    },
    knower: {
      required: false,
      label: "知情者",
      allowNpc: false,
      mustDifferFrom: ["bearer"],
      preferredLoad: "low",
      allowedOverlap: true,
      narrativeRole: "witness",
      intensity: 1,
    },
    misled: {
      required: false,
      label: "被误导者",
      allowNpc: false,
      mustDifferFrom: ["bearer", "knower"],
      preferredLoad: "low",
      narrativeRole: "misled",
      intensity: 1,
    },
    revealer: {
      required: false,
      label: "揭示推动者",
      allowNpc: false,
      mustDifferFrom: [],
      preferredLoad: "low",
      narrativeRole: "discoverer",
      intensity: 1,
    },
    related: {
      required: false,
      label: "关联人物",
      allowNpc: true,
      mustDifferFrom: ["bearer"],
      preferredLoad: "low",
      narrativeRole: "support",
      intensity: 1,
    },
    ...extra,
  };
}

function basePlots(extra = {}) {
  return {
    surfaceBelief: {
      id: "surfaceBelief",
      label: "表面认知",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["承担者只是普通客人/职员", "众人相信既有公开身世"],
      generationHint: "写开场时众人（或本人）以为的情况",
    },
    hiddenContent: {
      id: "hiddenContent",
      label: "隐藏内容",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["一段被封闭的关键记忆", "一个未公开的真实身份事实"],
      generationHint: "写真正被压住的内容，不要写角色姓名专属世界观梗",
    },
    trueContent: {
      id: "trueContent",
      label: "真实内容",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["可被证据验证的真实版本", "与表面认知冲突的客观事实"],
    },
    concealmentReason: {
      id: "concealmentReason",
      label: "隐藏原因",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: [...M07_FORM_PRESETS.concealmentReason],
    },
    misdirectionForm: {
      id: "misdirectionForm",
      label: "误导方式",
      type: "TEXT_OR_PRESET",
      required: false,
      presets: [...M07_FORM_PRESETS.misdirectionForm],
    },
    firstAnomaly: {
      id: "firstAnomaly",
      label: "第一次异常",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["称谓口误", "对某地过度熟悉", "对某物的异常反应"],
    },
    midFragment: {
      id: "midFragment",
      label: "中期证据/记忆碎片",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["半截旧信", "残缺名册", "与公开身份不符的私人物件"],
    },
    decisiveReveal: {
      id: "decisiveReveal",
      label: "决定性揭示",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: [...M07_FORM_PRESETS.revealCarrierForm],
    },
    revealConsequence: {
      id: "revealConsequence",
      label: "揭示后的影响",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["改变信任关系", "开放新权限或关闭旧权限", "推翻此前一项公开判断"],
    },
    knowerSource: {
      id: "knowerSource",
      label: "知情来源",
      type: "TEXT_OR_PRESET",
      required: false,
      presets: [...M07_FORM_PRESETS.knowerSourceForm],
    },
    identityProofForm: {
      id: "identityProofForm",
      label: "身份证明形式",
      type: "TEXT_OR_PRESET",
      required: false,
      presets: [...M07_FORM_PRESETS.identityProofForm],
    },
    ...extra,
  };
}

const HINTS_DEFAULT = Object.freeze({
  canPrecede: ["M01", "M08"],
  canFollow: ["M10", "M11"],
  sharesFactsWith: ["identity", "memory", "permission"],
  weaveIntent: "在调查/阵营成型前埋下认知差，在结局前兑现揭示后果",
});

function pack(id, title, purpose, description, variants, plotExtra = {}, roleExtra = {}, hintExtra = {}) {
  const roleSlots = baseRoles(roleExtra);
  const plotSlots = basePlots(plotExtra);
  return freezeTemplate({
    id,
    title,
    purpose,
    description,
    roleSlots,
    plotSlots,
    clueSlots: CLUES,
    stagePattern: STAGE,
    variants,
    constraints: BASE_CONSTRAINTS,
    defaultGeneration: { preferredVariantId: variants[0].id },
    integrationHints: { ...HINTS_DEFAULT, ...hintExtra },
  });
}

/* ==================== M07-1 固定阶段开放 ==================== */

const M07_1 = pack(
  "M07-1",
  "固定阶段开放",
  "保证关键记忆/身份相关内容在指定剧情阶段自动到达接收者，建立可控的信息节奏，而不依赖主持临场发挥。",
  "到达指定阶段自动发放既有内容；支持个人、分组与全体。掉线进入待领取箱。不单独计为主要玩法时长。",
  [
    variant({
      id: "V01",
      title: "全体同步到点发放",
      description: "同一阶段对全体发放同一内容，建立共享认知基线。",
      beatPattern: {
        setup: "内容处于隐藏态，仅系统登记接收范围=全体",
        develop: "到达指定阶段，服务器自动发放",
        resolve: "全员持有同一事实片段，后续可公开讨论",
      },
      defaults: {
        surfaceBelief: "众人尚不知晓该段内容",
        hiddenContent: "一份将在中段公开的共享背景事实",
        trueContent: "可验证的共享背景",
        firstAnomaly: "阶段切换提示",
        midFragment: "发放队列中的内容摘要",
        decisiveReveal: "阶段到达后的自动发放",
        revealConsequence: "全员信息同步，调查口径统一",
        concealmentReason: "等待剧情节奏节点",
      },
    }),
    variant({
      id: "V02",
      title: "个人私有到点发放",
      description: "仅承担者在指定阶段收到私有记忆/身份片段。",
      beatPattern: {
        setup: "私有内容绑定承担者",
        develop: "阶段到达仅本人可领",
        resolve: "本人决定公开、隐瞒或误述",
      },
      preferredSlots: ["bearer", "knower"],
      defaults: {
        surfaceBelief: "承担者看似与常人无异",
        hiddenContent: "仅属于承担者的私有记忆层",
        firstAnomaly: "承担者对某细节过度敏感",
        decisiveReveal: "私有内容到点进入其手中",
        revealConsequence: "信息不对称开始倾斜",
      },
    }),
    variant({
      id: "V03",
      title: "分组错峰发放",
      description: "两组在相邻阶段先后收到互补信息。",
      beatPattern: {
        setup: "内容拆成互补两包",
        develop: "A组先到点，B组稍后到点",
        resolve: "合并后才能读出完整意义",
      },
      defaults: {
        hiddenContent: "被拆成两段的完整事实",
        midFragment: "第一组先拿到的半截",
        decisiveReveal: "第二组补全后形成完整叙述",
        revealConsequence: "组间必须交换才能推进",
      },
    }),
    variant({
      id: "V04",
      title: "掉线补领箱结构",
      description: "强调重连补领与不重复触发，保证节奏不被掉线破坏。",
      beatPattern: {
        setup: "登记发放计划与待领取箱",
        develop: "在线者即时领取，掉线者入箱",
        resolve: "重连补领，已发不重复",
      },
      defaults: {
        firstAnomaly: "有人缺席导致领取不同步",
        revealConsequence: "信息最终对齐但不提前泄露",
      },
    }),
    variant({
      id: "V05",
      title: "公开层+私有层同阶段",
      description: "同阶段发放：公开短讯 + 私有详版，制造可控信息差。",
      beatPattern: {
        setup: "双层内容预登记",
        develop: "阶段到达同时发两层",
        resolve: "公开层可谈，私有层可隐瞒",
      },
      defaults: {
        surfaceBelief: "公开层看起来已经说清",
        hiddenContent: "私有层含关键修正",
        misdirectionForm: "公开层故意写得更温和",
      },
    }),
    variant({
      id: "V06",
      title: "阶段门后才允许转述",
      description: "内容到点发放后，另设“可转述”权限节点。",
      beatPattern: {
        setup: "内容先到，转述权未开",
        develop: "持有者不能合法外传",
        resolve: "下一阶段才开放转述权限",
      },
      defaults: {
        revealConsequence: "信息持有与传播权分离",
      },
    }),
    variant({
      id: "V07",
      title: "关键人缺席则延后发放",
      description: "若指定接收者未在场，内容整体延后到其可领，避免被他人代领。",
      beatPattern: {
        setup: "绑定唯一接收者",
        develop: "缺席则阶段标记延后",
        resolve: "本人到场后补发",
      },
      requiredSlots: ["bearer"],
      defaults: {
        concealmentReason: "防止他人代领造成提前泄露",
      },
    }),
    variant({
      id: "V08",
      title: "基础保底包优先",
      description: "先保证最低必要内容到点，附加包可更晚。",
      beatPattern: {
        setup: "区分保底包与附加包",
        develop: "保底包准时发放",
        resolve: "附加包可延后或条件化",
      },
      defaults: {
        hiddenContent: "保底必要事实",
        midFragment: "附加修饰信息",
        revealConsequence: "主线不被附加信息卡住",
      },
    }),
    variant({
      id: "V09",
      title: "阶段回声复核",
      description: "发放后下一短阶段自动复核“是否已领取”，未领再提醒一次。",
      beatPattern: {
        setup: "计划含复核节拍",
        develop: "首次发放",
        resolve: "复核提醒，仍不重复发内容体",
      },
      defaults: {
        firstAnomaly: "有人未打开待领取箱",
      },
    }),
    variant({
      id: "V10",
      title: "与调查节点对齐发放",
      description: "发放阶段刻意对齐某次公开调查节点，形成“刚搜完就出现说明”的体验。",
      beatPattern: {
        setup: "隐藏内容等待调查节点",
        develop: "调查节点触发阶段到达",
        resolve: "说明性内容落地，不替代证据",
      },
      recommendedCluePattern: ["FORESHADOW", "IDENTITY_HINT", "CONFIRMATION"],
      defaults: {
        weaveIntent: "配合 M01 调查节奏",
      },
    }),
  ],
  {
    openStageLabel: {
      id: "openStageLabel",
      label: "计划开放阶段名",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["第二幕末", "第三幕初", "搜证结束后"],
    },
  },
  {},
  { canPrecede: ["M01"], weaveIntent: "为调查提供节奏化信息补给" },
);

/* ==================== M07-2 条件触发开放 ==================== */

const M07_2 = pack(
  "M07-2",
  "条件触发开放",
  "让隐藏内容在正式状态满足时由系统发放，建立“做对事才看到”的认知奖励，同时保证必要内容有超时出口。",
  "条件只能读取正式状态；必要内容必须有超时替代；主持人不得凭表现主观发放。",
  [
    variant({
      id: "V01",
      title: "结算码触发",
      description: "上游机制产出指定结算码后发放。",
      beatPattern: { setup: "登记结算码条件", develop: "等待正式结算", resolve: "码命中则发放" },
      defaults: { firstAnomaly: "结算结果与某人反应异常吻合", decisiveReveal: "结算码触发内容包" },
    }),
    variant({
      id: "V02",
      title: "权限使用触发",
      description: "某人使用预声明权限后触发。",
      beatPattern: { setup: "权限与内容绑定", develop: "权限被合法使用", resolve: "内容发放给指定接收者" },
      preferredSlots: ["bearer", "revealer"],
      defaults: { concealmentReason: "必须先获得行动资格" },
    }),
    variant({
      id: "V03",
      title: "组合完成触发",
      description: "指定线索/组件组合集齐后触发。",
      beatPattern: { setup: "组合条件保密", develop: "玩家集齐组合", resolve: "服务器校验后发放" },
      defaults: { midFragment: "组合中的关键件", decisiveReveal: "组合完成触发记忆包" },
    }),
    variant({
      id: "V04",
      title: "超时替代保底",
      description: "条件长期未满足则走替代路径发放降级版。",
      beatPattern: { setup: "主条件+替代条件", develop: "主条件窗口流逝", resolve: "替代路径发放降级内容" },
      defaults: { revealConsequence: "主线不卡死，但损失完整信息" },
    }),
    variant({
      id: "V05",
      title: "双条件与门",
      description: "必须同时满足两个正式状态。",
      beatPattern: { setup: "登记与门条件", develop: "只满足其一无效", resolve: "两者皆真才发放" },
      defaults: { firstAnomaly: "只完成一半的人空欢喜" },
    }),
    variant({
      id: "V06",
      title: "或门多入口",
      description: "任一合法条件满足即可，路径不同内容相同。",
      beatPattern: { setup: "多入口同内容", develop: "不同玩家走不同入口", resolve: "内容一致，无矛盾版本" },
      defaults: { trueContent: "唯一真实版本", misdirectionForm: "无" },
    }),
    variant({
      id: "V07",
      title: "可选永久未开放",
      description: "非必要包可以永久不触发，作为高风险高回报。",
      beatPattern: { setup: "标记可选包", develop: "条件苛刻", resolve: "未触发不惩罚主线" },
      defaults: { revealConsequence: "主线完整，支线成谜" },
    }),
    variant({
      id: "V08",
      title: "条件满足但延迟展示",
      description: "状态已满足，内容进入冷却后再展示，制造悬念。",
      beatPattern: { setup: "满足即入冷却队列", develop: "冷却期可感知异常", resolve: "冷却结束发放" },
      defaults: { firstAnomaly: "系统提示“有内容待解锁”" },
    }),
    variant({
      id: "V09",
      title: "失败状态也触发",
      description: "失败结算码同样触发另一版本说明（非矛盾事实）。",
      beatPattern: { setup: "成功/失败两包", develop: "结算分流", resolve: "对应包发放，事实不互斥" },
      defaults: { trueContent: "同一客观事件的不同知情角度" },
    }),
    variant({
      id: "V10",
      title: "状态阈值累计触发",
      description: "同一正式计数达到阈值后触发。",
      beatPattern: { setup: "阈值登记", develop: "计数累积", resolve: "达阈发放" },
      defaults: { midFragment: "计数接近阈值的征兆" },
    }),
    variant({
      id: "V11",
      title: "禁止主持主观补发",
      description: "结构上锁定：仅服务器条件，不设主持“觉得够了”入口。",
      beatPattern: { setup: "关闭主观发放口", develop: "只读正式状态", resolve: "条件或超时二选一" },
      defaults: { concealmentReason: "防止信息被临场裁判" },
    }),
  ],
  {
    triggerCondition: {
      id: "triggerCondition",
      label: "正式触发条件",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["获得指定结算码", "使用指定权限", "完成指定组合", "计数达阈值"],
    },
    timeoutFallback: {
      id: "timeoutFallback",
      label: "超时替代路径",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["降级内容包", "公共摘要", "下一阶段强制保底"],
    },
  },
);

/* ==================== M07-3 多路径开放 ==================== */

const M07_3 = pack(
  "M07-3",
  "多路径开放",
  "同一关键内容至少两条真正不同的到达路径，让玩家用调查/交换/拼接/选择等不同方式抵达同一真相，避免单点卡死。",
  "路径可不同，内容版本不得矛盾；记录首次开放路径供分析，不向玩家标最优。",
  [
    variant({
      id: "V01",
      title: "调查路径 vs 交换路径",
      description: "一条靠搜证，一条靠资源交换。",
      beatPattern: { setup: "双路径登记", develop: "两队分头推进", resolve: "先到者开放，内容一致" },
      defaults: { midFragment: "交换所需信物", decisiveReveal: "任一路径完成即开放" },
    }),
    variant({
      id: "V02",
      title: "拼接路径 vs 正式选择",
      description: "组件拼接与公开表决都能打开。",
      beatPattern: { setup: "路径互不依赖", develop: "拼接进度与表决并行", resolve: "首次完成者打开" },
    }),
    variant({
      id: "V03",
      title: "三路径冗余",
      description: "三条结构不同路径，提高可达性。",
      beatPattern: { setup: "三入口", develop: "任一即可", resolve: "附加奖励给多路径完成者" },
      defaults: { revealConsequence: "多路径完成可开附加包" },
    }),
    variant({
      id: "V04",
      title: "先错路径再校正",
      description: "假路径消耗资源后导向真路径入口。",
      beatPattern: { setup: "假入口可见", develop: "走假路径得校正线索", resolve: "校正后进入真路径" },
      recommendedCluePattern: ["MISDIRECTION", "IDENTITY_HINT", "CONFIRMATION"],
      defaults: { misdirectionForm: "伪造入口说明" },
    }),
    variant({
      id: "V05",
      title: "知情者专属旁路",
      description: "知情者可用更短路径，他人走长路径。",
      beatPattern: { setup: "旁路仅知情者可见", develop: "普通路径仍可达", resolve: "内容相同" },
      preferredSlots: ["knower", "bearer"],
      defaults: { knowerSource: "职业权限接触档案" },
    }),
    variant({
      id: "V06",
      title: "竞速首达锁定路径记录",
      description: "记录首次开放路径，不公布给玩家。",
      beatPattern: { setup: "路径埋点", develop: "竞速", resolve: "内容开放+内部记录首达" },
    }),
    variant({
      id: "V07",
      title: "双路径必须都完成才附加",
      description: "主内容单路径可达；附加内容要双路径都完成。",
      beatPattern: { setup: "主/附分离", develop: "单路径开主包", resolve: "双路径开附加包" },
    }),
    variant({
      id: "V08",
      title: "路径互相封锁",
      description: "走 A 会关闭 B 的效率，但仍保留慢速可达。",
      beatPattern: { setup: "互斥效率", develop: "选择牺牲哪条快路径", resolve: "慢路径保底" },
      incompatibilities: ["V03"],
    }),
    variant({
      id: "V09",
      title: "公开路径+隐秘路径",
      description: "公开说明书写一条；另一条藏在物件交互里。",
      beatPattern: { setup: "只公开一条", develop: "隐秘路径靠异常发现", resolve: "殊途同归" },
      defaults: { firstAnomaly: "物件交互出现未记载选项" },
    }),
    variant({
      id: "V10",
      title: "失败也算路径进度",
      description: "某正式失败结果仍推进另一路径计数。",
      beatPattern: { setup: "失败映射", develop: "失败累积", resolve: "达阈开放" },
    }),
  ],
  {
    pathA: {
      id: "pathA",
      label: "路径A形式",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["调查搜证", "资源交换", "内容拼接", "正式选择"],
    },
    pathB: {
      id: "pathB",
      label: "路径B形式",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["资源交换", "正式选择", "权限使用", "条件触发"],
    },
  },
);

/* ==================== M07-4 个人记忆分层 ==================== */

const M07_4 = pack(
  "M07-4",
  "个人记忆分层",
  "为承担者建立不对称的记忆层级：先给最低可玩层，再按本人正式状态递进，制造隐瞒/公开/误述的社交空间。",
  "不追求人均等量；下一层只读本人状态；最低层不得因他人不配合被永久卡住。",
  [
    variant({
      id: "V01",
      title: "两层：保底+终局",
      description: "开场保底层，终局条件开深层。",
      beatPattern: { setup: "保底记忆发放", develop: "本人推进正式状态", resolve: "深层记忆开放" },
    }),
    variant({
      id: "V02",
      title: "三层递进",
      description: "浅/中/深三层，每层改变可公开话术。",
      beatPattern: { setup: "浅层", develop: "中层碎片", resolve: "深层确认" },
      defaults: { midFragment: "中层互相矛盾的两句回忆" },
    }),
    variant({
      id: "V03",
      title: "可误述层",
      description: "中层允许玩家合法误述，平台不纠口语。",
      beatPattern: { setup: "真实层私有", develop: "玩家可选择误述版本", resolve: "证据逼近真实层" },
      defaults: { misdirectionForm: "半真半假的回忆片段误导" },
    }),
    variant({
      id: "V04",
      title: "他人刺激解锁",
      description: "下一层条件包含“与特定角色完成正式互动”。",
      beatPattern: { setup: "缺一块社交条件", develop: "与关联人正式互动", resolve: "层解锁" },
      preferredSlots: ["related", "bearer"],
    }),
    variant({
      id: "V05",
      title: "资源支付加深",
      description: "可用正式资源提前购买下一层预览。",
      beatPattern: { setup: "自然递进存在", develop: "可选付费加速", resolve: "预览或完整层" },
    }),
    variant({
      id: "V06",
      title: "创伤封闭再打开",
      description: "结构上本人曾封闭记忆，条件满足才解封。",
      beatPattern: { setup: "封闭态", develop: "触发物出现", resolve: "解封" },
      defaults: { concealmentReason: "创伤性封闭", ...{ memoryLossFormHint: "创伤性封闭" } },
    }),
    variant({
      id: "V07",
      title: "分层不对齐公开时间",
      description: "不同承担者层数与开放时点刻意不均。",
      beatPattern: { setup: "不对称配置", develop: "有人已深有人仍浅", resolve: "社交盘问压力上升" },
    }),
    variant({
      id: "V08",
      title: "最低层超时保底",
      description: "无论条件如何，最低层在时限后必开。",
      beatPattern: { setup: "最低层保护", develop: "高阶层仍条件化", resolve: "保底不被卡死" },
    }),
    variant({
      id: "V09",
      title: "公开承诺锁层",
      description: "若玩家正式公开某层，则锁定不得再改口为“从未有过”。",
      beatPattern: { setup: "层可隐瞒", develop: "正式公开写入状态", resolve: "后续不得否认曾持有" },
    }),
    variant({
      id: "V10",
      title: "双人交叉层",
      description: "两人各持一半，合并阅读才完整。",
      beatPattern: { setup: "交叉切割", develop: "各自递进", resolve: "自愿交换或对质" },
      requiredSlots: ["bearer", "related"],
    }),
    variant({
      id: "V11",
      title: "假层先于真层",
      description: "先开放被篡改层，后开放校正层。",
      beatPattern: { setup: "假层", develop: "依假层行动", resolve: "校正层推翻解释但不改客观事件" },
      recommendedCluePattern: ["MISDIRECTION", "MEMORY_FRAGMENT", "CONFIRMATION"],
      defaults: { misdirectionForm: "用半真半假的回忆片段误导" },
    }),
  ],
  {
    layerCount: {
      id: "layerCount",
      label: "记忆层数",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["2", "3", "4"],
    },
    memoryLossForm: {
      id: "memoryLossForm",
      label: "记忆缺失/封闭形式",
      type: "TEXT_OR_PRESET",
      required: false,
      presets: [...M07_FORM_PRESETS.memoryLossForm],
    },
  },
);

/* ==================== M07-5 身份权限变化 ==================== */

const M07_5 = pack(
  "M07-5",
  "身份权限变化",
  "先让身份内容显现，再按预声明规则启用界面权限，使“我是谁”转化为“我现在能做什么”，并禁止万能补丁能力。",
  "身份显现与权限变更分字段；新权限必须有来源、范围、次数、失效节点。",
  [
    variant({
      id: "V01",
      title: "本人早知，主动伪装到点揭开",
      description: "承担者一直知道身份，伪装至确认阶段再启用权限。",
      beatPattern: { setup: "伪装态", develop: "异常渗漏", resolve: "揭示+权限启用" },
      defaults: { surfaceBelief: "普通身份", concealmentReason: "维持当前社会位置" },
    }),
    variant({
      id: "V02",
      title: "本人不知，第三者保管",
      description: "知情者掌握真相，承担者被蒙在鼓里直至揭示。",
      beatPattern: { setup: "知情者守秘", develop: "异常指向承担者", resolve: "第三者揭示+权限表生效" },
      requiredSlots: ["bearer", "knower"],
      defaults: { knowerSource: "受人之托保密" },
    }),
    variant({
      id: "V03",
      title: "假身份逐层崩解",
      description: "多层假身份被连续证伪，最后才给真权限。",
      beatPattern: { setup: "假层1", develop: "假层2崩解", resolve: "真身份+受限权限" },
      recommendedCluePattern: ["MISDIRECTION", "IDENTITY_HINT", "DECISIVE_REVEAL"],
    }),
    variant({
      id: "V04",
      title: "双人身份交换结构",
      description: "两名角色的公开身份标签在结构上被对调，揭示后权限归位。",
      beatPattern: { setup: "交换态运行", develop: "错位权限征兆", resolve: "归位与权限重绑" },
      requiredSlots: ["bearer", "related"],
      preferredSlots: ["knower"],
    }),
    variant({
      id: "V05",
      title: "物件逐步验证身份",
      description: "多件证明物分别验证，全部满足才启用权限。",
      beatPattern: { setup: "证明物分散", develop: "逐步收集", resolve: "验证完成启用权限" },
      defaults: { identityProofForm: "私人物件" },
    }),
    variant({
      id: "V06",
      title: "证词揭开+权限短窗",
      description: "第三方证词确认身份后，权限仅短时有效。",
      beatPattern: { setup: "权限表含失效节点", develop: "证词确认", resolve: "短窗权限后收回" },
      defaults: { revealCarrierForm: "第三方证词" },
    }),
    variant({
      id: "V07",
      title: "故意误导身份后校正",
      description: "先让全场相信错误身份，再校正；权限只跟真身份走。",
      beatPattern: { setup: "错误身份流行", develop: "误导加深", resolve: "校正，假权限从不生效" },
      defaults: { misdirectionForm: "故意散播错误称谓" },
    }),
    variant({
      id: "V08",
      title: "揭示改变既有关系边",
      description: "身份确认同时改写一条人物关系边（如监护/仇隙）。",
      beatPattern: { setup: "关系按旧身份运转", develop: "裂痕", resolve: "关系边重写+权限" },
      consequencePattern: "relationship_rewrite",
    }),
    variant({
      id: "V09",
      title: "揭示推翻先前事实解释",
      description: "不改客观事件，只推翻早期解释，并据此开关权限。",
      beatPattern: { setup: "早期解释", develop: "矛盾", resolve: "重释+权限" },
      defaults: { cognitionConflict: "表面关系与真实血缘冲突" },
    }),
    variant({
      id: "V10",
      title: "权限先于公开承认",
      description: "规则表先启用有限权限，公开承认可更晚。",
      beatPattern: { setup: "静默启用", develop: "他人察觉能力异常", resolve: "之后才公开身份叙述" },
    }),
    variant({
      id: "V11",
      title: "禁止万能权限",
      description: "结构约束：新权限不得直接解决无关主线缺口。",
      beatPattern: { setup: "权限白名单预声明", develop: "只开白名单", resolve: "越权请求被拒" },
      defaults: { revealConsequence: "只获得预声明范围内的行动权" },
    }),
    variant({
      id: "V12",
      title: "多知情人互相牵制",
      description: "两名知情者都知道，但只有同时同意才触发公开权限。",
      beatPattern: { setup: "双知情锁", develop: "拉拢/威胁", resolve: "双确认后揭示" },
      requiredSlots: ["bearer", "knower", "related"],
    }),
  ],
  {
    permissionScope: {
      id: "permissionScope",
      label: "新权限范围",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["一次查阅权", "区域通行", "表决加权", "短时否决"],
    },
    permissionExpiry: {
      id: "permissionExpiry",
      label: "权限失效节点",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["本幕结束", "使用一次后", "被公开承认后"],
    },
    cognitionConflict: {
      id: "cognitionConflict",
      label: "认知冲突形式",
      type: "TEXT_OR_PRESET",
      required: false,
      presets: [...M07_FORM_PRESETS.cognitionConflictForm],
    },
  },
  {},
  { canFollow: ["M08", "M10"], weaveIntent: "身份权限常衔接阵营与结局选择" },
);

/* ==================== M07-6 旧事实重新解释 ==================== */

const M07_6 = pack(
  "M07-6",
  "旧事实重新解释",
  "在不改写早期客观动作的前提下，追加后期语境，迫使玩家重估已发生事件的意义，并自动拦截“早该知道却装不知道”的冲突。",
  "同时保存 OBJECTIVE_EVENT / EARLY_INTERPRETATION / LATER_CONTEXT；冲突则暂停。",
  [
    variant({
      id: "V01",
      title: "善意误读被校正",
      description: "早期把行为解释为善意，后期语境显示另有苦衷或算计。",
      beatPattern: { setup: "客观事件+早期善意解读", develop: "新语境出现", resolve: "意义翻转，动作不变" },
    }),
    variant({
      id: "V02",
      title: "仇怨误读被消解",
      description: "早期视为敌对的行为，后期证明是保护。",
      beatPattern: { setup: "敌对解读", develop: "保护证据", resolve: "关系重估" },
    }),
    variant({
      id: "V03",
      title: "知情冲突熔断",
      description: "若后期设定意味着角色早期必知，则结构上暂停并要求改稿。",
      beatPattern: { setup: "三层数据齐全", develop: "冲突检查命中", resolve: "HOLD，不得静默继续" },
      defaults: { cognitionConflict: "早期行为与后期设定冲突" },
    }),
    variant({
      id: "V04",
      title: "旁观者视角补全",
      description: "后期由旁观者语境补全，不改当事人早期所见范围。",
      beatPattern: { setup: "当事人有限知", develop: "旁观语境加入", resolve: "全场重读意义" },
      preferredSlots: ["revealer", "bearer"],
    }),
    variant({
      id: "V05",
      title: "文件语境追加",
      description: "旧事件本身不变，新文件改变动机解读。",
      beatPattern: { setup: "旧事件已公开", develop: "文件出现", resolve: "动机重释" },
    }),
    variant({
      id: "V06",
      title: "双阶段解释并存",
      description: "早期解释保留为历史认知记录，后期解释并行，不删除前者。",
      beatPattern: { setup: "记录早期解释", develop: "追加后期语境", resolve: "两层都可查阅" },
    }),
    variant({
      id: "V07",
      title: "身份揭示触发重释",
      description: "某人身份确认后，自动重释其早期行动意义。",
      beatPattern: { setup: "旧行动", develop: "身份确认", resolve: "行动意义重绑" },
      defaults: { weaveWith: "M07-5" },
    }),
    variant({
      id: "V08",
      title: "现场版本读取触发重释",
      description: "读到旧现场快照后，理解当下叙述的偏差。",
      beatPattern: { setup: "当下叙述", develop: "快照对照", resolve: "偏差显形" },
      integrationNote: "适合与 M11 快照交织",
    }),
    variant({
      id: "V09",
      title: "集体误读崩塌",
      description: "全场曾共享错误解释，后期一次崩塌。",
      beatPattern: { setup: "共享误读", develop: "裂缝", resolve: "集体重估" },
    }),
    variant({
      id: "V10",
      title: "仅主观意义变化",
      description: "客观链完全不动，只改情感/道德意义。",
      beatPattern: { setup: "事实稳定", develop: "情感语境", resolve: "意义变化不影响证据链" },
    }),
  ],
  {
    objectiveEvent: {
      id: "objectiveEvent",
      label: "客观事件（不可改写）",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["某人在某时某地做了某可验证动作"],
    },
    earlyInterpretation: {
      id: "earlyInterpretation",
      label: "早期解释",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["出于善意", "出于敌意", "出于偶然"],
    },
    laterContext: {
      id: "laterContext",
      label: "后期语境",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["保护性隐瞒", "另有交易", "被胁迫"],
    },
    cognitionConflict: {
      id: "cognitionConflict",
      label: "知情冲突形式",
      type: "TEXT_OR_PRESET",
      required: false,
      presets: [...M07_FORM_PRESETS.cognitionConflictForm],
    },
  },
  {},
  { canPrecede: ["M01", "M11"], weaveIntent: "重释常接在调查与现场版本之后" },
);

/* ==================== M07-7 主动选择保留或恢复 ==================== */

const M07_7 = pack(
  "M07-7",
  "主动选择保留或恢复",
  "让玩家在多份既有内容中主动选择优先开放或付费扩选，把“记起什么/公开什么”变成可玩决策，同时保证未选项不含唯一主线钥匙。",
  "2—4 项候选；未选可继续封闭；结算保存所选与永久关闭状态。",
  [
    variant({
      id: "V01",
      title: "二选一记忆",
      description: "两份记忆互为视角，只能先开一份。",
      beatPattern: { setup: "两候选", develop: "选择", resolve: "未选保持封闭" },
    }),
    variant({
      id: "V02",
      title: "三选一，可付费扩到二",
      description: "默认选 1，支付资源可选 2。",
      beatPattern: { setup: "三候选", develop: "付费决策", resolve: "记录关闭项" },
    }),
    variant({
      id: "V03",
      title: "恢复被封闭的真层",
      description: "候选是“保持封闭 / 恢复真层 / 恢复被篡改层”。",
      beatPattern: { setup: "封闭态", develop: "选择恢复哪一版", resolve: "真层优先规则可配置" },
      defaults: { memoryLossForm: "人为药物/仪式阻断" },
    }),
    variant({
      id: "V04",
      title: "集体投票选开放项",
      description: "多人正式表决决定优先开放哪项。",
      beatPattern: { setup: "候选公示", develop: "表决", resolve: "多数项开放" },
    }),
    variant({
      id: "V05",
      title: "个人私选互不可见",
      description: "每人私选，结果互不公示。",
      beatPattern: { setup: "私有候选", develop: "私选", resolve: "信息不对称加深" },
    }),
    variant({
      id: "V06",
      title: "选错代价可逆",
      description: "可支付更高代价在晚段改选一次。",
      beatPattern: { setup: "初选", develop: "后悔窗口", resolve: "改选或永久关闭" },
    }),
    variant({
      id: "V07",
      title: "未选项永闭但非钥匙",
      description: "结构校验：未选项不得含唯一主线事实。",
      beatPattern: { setup: "候选预审", develop: "选择", resolve: "永闭支线" },
    }),
    variant({
      id: "V08",
      title: "选择绑定关系态度",
      description: "选开某项会正式改变对某人的态度标记。",
      beatPattern: { setup: "候选含关系含义", develop: "选择", resolve: "态度标记写入" },
      preferredSlots: ["related"],
    }),
    variant({
      id: "V09",
      title: "限时选择窗",
      description: "超时未选则全部保持封闭（或走保底项）。",
      beatPattern: { setup: "限时窗", develop: "催促", resolve: "超时策略执行" },
    }),
    variant({
      id: "V10",
      title: "双人必须选不同项",
      description: "两人强制分散选择，覆盖更多信息。",
      beatPattern: { setup: "互斥规则", develop: "协商", resolve: "两项开放" },
      requiredSlots: ["bearer", "related"],
    }),
  ],
  {
    candidateCount: {
      id: "candidateCount",
      label: "候选数量",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["2", "3", "4"],
    },
    expandCost: {
      id: "expandCost",
      label: "扩选代价形式",
      type: "TEXT_OR_PRESET",
      required: false,
      presets: ["正式资源", "权限次数", "暴露风险"],
    },
  },
);

/* ==================== M07-8 集合属性探测 ==================== */

const M07_8 = pack(
  "M07-8",
  "集合属性探测",
  "在不点名个人的前提下，用聚合结果压缩身份候选空间，制造谨慎组队与信息预算压力。",
  "只读既有正式字段；同次探测同一时点；默认不揭示个体；需信息预算防止一发解盘。",
  [
    variant({
      id: "V01",
      title: "多数表决式聚合",
      description: "返回组内多数是否具备某正式属性。",
      beatPattern: { setup: "选组", develop: "提交", resolve: "返回多数结果" },
      defaults: { probeOutputMode: "MAJORITY" },
    }),
    variant({
      id: "V02",
      title: "精确计数",
      description: "返回组内具备属性的精确人数。",
      beatPattern: { setup: "选组", develop: "提交", resolve: "返回人数" },
      defaults: { probeOutputMode: "EXACT_COUNT" },
    }),
    variant({
      id: "V03",
      title: "区间计数",
      description: "返回人数所在区间，降低解盘精度。",
      beatPattern: { setup: "选组", develop: "提交", resolve: "返回区间" },
      defaults: { probeOutputMode: "COUNT_RANGE" },
    }),
    variant({
      id: "V04",
      title: "奇偶校验",
      description: "只返回具备属性人数的奇偶。",
      beatPattern: { setup: "选组", develop: "提交", resolve: "返回奇偶" },
      defaults: { probeOutputMode: "PARITY" },
    }),
    variant({
      id: "V05",
      title: "是否全同",
      description: "返回组内该属性是否全部相同。",
      beatPattern: { setup: "选组", develop: "提交", resolve: "ALL_SAME" },
      defaults: { probeOutputMode: "ALL_SAME" },
    }),
    variant({
      id: "V06",
      title: "是否至少一名",
      description: "返回是否至少一名具备属性。",
      beatPattern: { setup: "选组", develop: "提交", resolve: "AT_LEAST_ONE" },
      defaults: { probeOutputMode: "AT_LEAST_ONE" },
    }),
    variant({
      id: "V07",
      title: "阶段锁定快照",
      description: "读取阶段锁定快照而非当前可变状态。",
      beatPattern: { setup: "快照规则=STAGE_LOCKED", develop: "属性可能已变", resolve: "仍读旧快照" },
      defaults: { snapshotRule: "STAGE_LOCKED" },
    }),
    variant({
      id: "V08",
      title: "当前态探测",
      description: "读取 CURRENT，适合动态身份局。",
      beatPattern: { setup: "快照规则=CURRENT", develop: "身份刚变化", resolve: "读到新值" },
      defaults: { snapshotRule: "CURRENT" },
    }),
    variant({
      id: "V09",
      title: "信息预算熔断",
      description: "若单次探测过度收缩候选空间则 HOLD。",
      beatPattern: { setup: "预算检查", develop: "非法高信息请求", resolve: "拒绝并提示" },
      defaults: { revealConsequence: "探测被拒绝，次数不扣或按规则" },
    }),
    variant({
      id: "V10",
      title: "次数稀缺施压",
      description: "全场总次数极少，迫使慎重选组。",
      beatPattern: { setup: "低次数", develop: "协商给谁用", resolve: "聚合结果改变结盟" },
    }),
    variant({
      id: "V11",
      title: "探测后社交清算",
      description: "结果公开后必须立即进行一次正式表态/结盟动作。",
      beatPattern: { setup: "探测", develop: "结果公开", resolve: "强制表态节点" },
      consequencePattern: "forced_stance",
    }),
    variant({
      id: "V12",
      title: "禁止揭示个体",
      description: "结构锁定 reveal_individual=false，任何点名输出非法。",
      beatPattern: { setup: "锁定聚合模式", develop: "提交", resolve: "只出集合信息" },
    }),
  ],
  {
    targetTrait: {
      id: "targetTrait",
      label: "被探测正式属性",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["隐藏阵营标记", "身份权限位", "知情者标记", "已开放记忆层"],
    },
    probeOutputMode: {
      id: "probeOutputMode",
      label: "聚合输出模式",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["MAJORITY", "EXACT_COUNT", "COUNT_RANGE", "PARITY", "ALL_SAME", "AT_LEAST_ONE"],
    },
    snapshotRule: {
      id: "snapshotRule",
      label: "快照规则",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["CURRENT", "STAGE_LOCKED"],
    },
    groupSize: {
      id: "groupSize",
      label: "集合大小",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["2-3", "3", "3-5"],
    },
  },
  {
    probeLead: {
      required: true,
      label: "探测发起者",
      allowNpc: false,
      mustDifferFrom: [],
      narrativeRole: "discoverer",
      intensity: 1,
    },
  },
  { canPrecede: ["M08"], canFollow: ["M01", "M10"], weaveIntent: "聚合验身常服务隐藏阵营与身份候选压缩" },
);

export function buildM07CompleteTemplates() {
  return Object.freeze([M07_1, M07_2, M07_3, M07_4, M07_5, M07_6, M07_7, M07_8]);
}

export const M07_TEMPLATE_IDS = Object.freeze([
  "M07-1",
  "M07-2",
  "M07-3",
  "M07-4",
  "M07-5",
  "M07-6",
  "M07-7",
  "M07-8",
]);

export function m07ContentCoverageMatrix() {
  return buildM07CompleteTemplates().map((t) => ({
    id: t.id,
    title: t.title,
    contentMaturity: t.contentMaturity,
    variantCount: t.variants.length,
    roleSlots: Object.keys(t.roleSlots),
    plotSlots: Object.keys(t.plotSlots),
    clueSlots: t.clueSlots.map((c) => c.id || c),
    stagePattern: t.stagePattern.map((s) => s.id || s),
    integrationHints: t.integrationHints,
  }));
}
