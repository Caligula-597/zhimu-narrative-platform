/**
 * STORY TemplateDefinition 注册数据
 *
 * 规则：具体机制差异只存在于此数据中；引擎不得再为子型写专用 generateXxx。
 * contentMaturity: FOUNDATION | PARTIAL | COMPLETE
 */

import { M01_FRAMING_VARIANTS, M01_PLOT_CANDIDATES } from "./story-mechanism-m01-framing-data.js";
import { buildM07CompleteTemplates } from "./story-mechanism-m07-pack.js";
import { buildM08CompleteTemplates } from "./story-mechanism-m08-pack.js";
import { semanticsBridgeForTemplate } from "./complete-beat-semantics-data.js";
import { attachCreationMetadata } from "./creation-catalog-metadata.js";

export const CONTENT_MATURITY = Object.freeze({
  FOUNDATION: "FOUNDATION",
  PARTIAL: "PARTIAL",
  COMPLETE: "COMPLETE",
});

/** catalog 中全部 37 个 STORY ID（与 mechanism-catalog-v2 对齐，不含生产专用 M01-FRAMING）。 */
export const CATALOG_STORY_TEMPLATE_IDS = Object.freeze([
  "M01-1", "M01-2", "M01-3", "M01-4", "M01-5", "M01-6", "M01-7", "M01-8", "M01-9", "M01-10",
  "M07-1", "M07-2", "M07-3", "M07-4", "M07-5", "M07-6", "M07-7", "M07-8",
  "M08-1", "M08-2", "M08-3", "M08-4", "M08-5", "M08-6", "M08-7", "M08-8",
  "M10-1", "M10-2", "M10-3", "M10-4", "M10-5", "M10-6",
  "M11-1", "M11-2", "M11-3", "M11-4", "M11-5",
]);

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

/**
 * 合法最小模板（FOUNDATION）：保证 Registry 对齐与通用引擎可跑，不伪造详细设计。
 */
export function foundationStoryTemplate({
  id,
  familyId,
  title,
  purpose,
  description = "",
  roleSlots,
  plotSlots,
  clueSlots,
  stagePattern,
  variants,
  contentMaturity = CONTENT_MATURITY.FOUNDATION,
}) {
  const roles = roleSlots || {
    focusCharacter: {
      required: true,
      label: "焦点角色",
      allowNpc: false,
      mustDifferFrom: [],
      preferredLoad: "low",
      narrativeRole: "focus",
    },
    supportingCharacter: {
      required: false,
      label: "关联角色",
      allowNpc: false,
      mustDifferFrom: ["focusCharacter"],
      preferredLoad: "low",
      narrativeRole: "support",
    },
  };
  const plots = plotSlots || {
    coreReveal: {
      id: "coreReveal",
      label: "核心揭示",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["关键信息在中段公开", "关键信息在终局公开"],
      generationHint: "写一条可被玩家验证的揭示",
    },
    dramaticQuestion: {
      id: "dramaticQuestion",
      label: "戏剧问题",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["谁在隐瞒关键事实？", "今晚必须做出什么选择？"],
    },
  };
  const clues = clueSlots || [
    { id: "HOOK", type: "HOOK", purpose: "引入", required: true, stageHint: "SETUP" },
    { id: "PAYOFF", type: "PAYOFF", purpose: "回收", required: true, stageHint: "RESOLVE" },
  ];
  const stages = stagePattern || [
    { id: "SETUP", stageRole: "SETUP", ordering: 0, optional: false, label: "铺垫" },
    { id: "DEVELOP", stageRole: "DEVELOP", ordering: 1, optional: false, label: "推进" },
    { id: "RESOLVE", stageRole: "RESOLVE", ordering: 2, optional: false, label: "收束" },
  ];
  const vars =
    variants ||
    [
      {
        id: "V1",
        title: "标准推进",
        description: "按模板默认阶段推进",
        beatPattern: {
          setup: "建立本机制关注点",
          develop: "推进冲突与信息",
          resolve: "给出可验证收束",
        },
        requiredSlots: ["focusCharacter", "coreReveal"],
        preferredSlots: [],
        incompatibilities: [],
        defaults: {
          coreReveal: plots.coreReveal?.presets?.[0] || "关键信息公开",
          dramaticQuestion: plots.dramaticQuestion?.presets?.[0] || "谁在隐瞒？",
        },
      },
      {
        id: "V2",
        title: "延迟揭示",
        description: "把关键揭示压到更晚阶段",
        beatPattern: {
          setup: "只给表面线索",
          develop: "加深误读",
          resolve: "晚段翻转",
        },
        requiredSlots: ["focusCharacter"],
        preferredSlots: ["supportingCharacter"],
        incompatibilities: [],
        defaults: {
          coreReveal: plots.coreReveal?.presets?.[1] || "终局揭示",
          dramaticQuestion: "表象之下还有一层真相吗？",
        },
      },
    ];

  return Object.freeze({
    id,
    familyId,
    title,
    purpose,
    description: description || purpose,
    contentMaturity,
    roleSlots: Object.freeze(roles),
    plotSlots: Object.freeze(plots),
    clueSlots: Object.freeze(clues),
    stagePattern: Object.freeze(stages),
    variants: Object.freeze(vars.map((v) => Object.freeze(v))),
    constraints: Object.freeze([]),
    defaultGeneration: Object.freeze({ preferredVariantId: vars[0]?.id || "V1" }),
    editableSlots: Object.freeze(editableFromSlots(roles, plots)),
    integrationHints: Object.freeze({
      canPrecede: [],
      canFollow: [],
      sharesFactsWith: [],
    }),
  });
}

/** catalog 元数据种子：只写已知设计名与用途，不编造未有细节。 */
const CATALOG_SEEDS = [
  ["M01-1", "M01", "行为人判断", "对谁实施了决定性行为作出可验证判断"],
  ["M01-2", "M01", "真实原因判断", "对表面结果的真实原因作判断"],
  ["M01-3", "M01", "决定性行为判断", "判断哪一行为是决定性的"],
  ["M01-4", "M01", "行动顺序判断", "重建关键行动顺序"],
  ["M01-5", "M01", "意图判断", "在证据允许范围内判断意图类别"],
  ["M01-6", "M01", "责任划分", "划分可验证的责任归属"],
  ["M01-7", "M01", "公开说法核验", "核验公开说法与既有事实是否一致"],
  ["M01-8", "M01", "单幕追凶", "单幕内完成一次可结算的追凶判断"],
  ["M01-9", "M01", "贯穿式追凶", "多幕贯穿的追凶结构"],
  ["M01-10", "M01", "动态现场调查", "读取可变现场后的调查判断"],
  ["M07-1", "M07", "固定阶段开放", "按固定阶段开放记忆/信息"],
  ["M07-2", "M07", "条件触发开放", "条件满足后开放内容"],
  ["M07-3", "M07", "多路径开放", "不同路径开放不同内容"],
  ["M07-4", "M07", "个人记忆分层", "个人记忆分层递进"],
  ["M07-5", "M07", "身份权限变化", "身份变化带来权限变化"],
  ["M07-6", "M07", "旧事实重新解释", "旧事实在新信息下被重释"],
  ["M07-7", "M07", "主动选择保留或恢复", "玩家主动选择保留/恢复内容"],
  ["M07-8", "M07", "集合属性探测", "聚合验身式集合探测"],
  ["M08-1", "M08", "固定公开阵营", "开局公开的固定阵营"],
  ["M08-2", "M08", "固定隐藏阵营", "隐藏但固定的阵营"],
  ["M08-3", "M08", "非对称阵营", "目标非对称的阵营结构"],
  ["M08-4", "M08", "动态阵营", "局中可变化的阵营"],
  ["M08-5", "M08", "个人目标叠加阵营", "个人目标与阵营目标并存"],
  ["M08-6", "M08", "临时联盟", "阶段性临时联盟"],
  ["M08-7", "M08", "阵营影响公共任务", "阵营状态影响公共任务"],
  ["M08-8", "M08", "多阵营并存", "多于双阵营并存"],
  ["M10-1", "M10", "单项正式选择", "单项正式选择映射结局"],
  ["M10-2", "M10", "多项优先级选择", "多项按优先级映射"],
  ["M10-3", "M10", "成对或分组问答", "成对/分组问答映射"],
  ["M10-4", "M10", "条件式结局矩阵", "条件矩阵决定结局"],
  ["M10-5", "M10", "个人与公共结果并行", "个人结果与公共结果并行"],
  ["M10-6", "M10", "延迟结算", "选择与结算分离"],
  ["M11-1", "M11", "可变现场", "现场可被改写但不改客观历史"],
  ["M11-2", "M11", "有源伪造", "新增与篡改对象须有来源"],
  ["M11-3", "M11", "剧情状态传播", "正式状态改变后续可行动作"],
  ["M11-4", "M11", "现场快照与版本读取", "时点见证与版本读取"],
  ["M11-5", "M11", "世界状态恢复", "合法复原可变状态"],
];

function familyRoleSlots(familyId) {
  if (familyId === "M01") {
    return {
      investigator: {
        required: true,
        label: "主调查者",
        allowNpc: false,
        mustDifferFrom: [],
        narrativeRole: "investigator",
      },
      subject: {
        required: true,
        label: "判断对象相关人",
        allowNpc: true,
        mustDifferFrom: ["investigator"],
        narrativeRole: "subject",
      },
    };
  }
  if (familyId === "M07") {
    return {
      bearer: {
        required: true,
        label: "记忆/身份承载者",
        allowNpc: false,
        mustDifferFrom: [],
        narrativeRole: "identity_bearer",
      },
      witness: {
        required: false,
        label: "知情者",
        allowNpc: false,
        mustDifferFrom: ["bearer"],
        narrativeRole: "witness",
      },
    };
  }
  if (familyId === "M08") {
    return {
      factionLeadA: {
        required: true,
        label: "阵营A代表",
        allowNpc: false,
        mustDifferFrom: [],
        narrativeRole: "faction_lead",
      },
      factionLeadB: {
        required: true,
        label: "阵营B代表",
        allowNpc: false,
        mustDifferFrom: ["factionLeadA"],
        narrativeRole: "faction_lead",
      },
    };
  }
  if (familyId === "M10") {
    return {
      decisionMaker: {
        required: true,
        label: "关键抉择者",
        allowNpc: false,
        mustDifferFrom: [],
        narrativeRole: "decision_maker",
      },
    };
  }
  return {
    actor: {
      required: true,
      label: "状态作用角色",
      allowNpc: false,
      mustDifferFrom: [],
      narrativeRole: "actor",
    },
    observer: {
      required: false,
      label: "见证者",
      allowNpc: false,
      mustDifferFrom: ["actor"],
      narrativeRole: "observer",
    },
  };
}

function familyPlotSlots(familyId, title) {
  if (familyId === "M01") {
    return {
      judgmentQuestion: {
        id: "judgmentQuestion",
        label: "待判断问题",
        type: "TEXT_OR_PRESET",
        required: true,
        presets: [`关于「${title}」的核心问题`, "谁做了决定性的事？"],
      },
      trueAnswer: {
        id: "trueAnswer",
        label: "客观答案要点",
        type: "TEXT_OR_PRESET",
        required: true,
        presets: ["由既有事实路径支持的答案", "可被两条路径验证的结论"],
      },
      falseLead: {
        id: "falseLead",
        label: "误导方向",
        type: "TEXT_OR_PRESET",
        required: false,
        presets: ["表面动机误导", "时间窗误导"],
      },
    };
  }
  if (familyId === "M07") {
    return {
      hiddenContent: {
        id: "hiddenContent",
        label: "隐藏内容",
        type: "TEXT_OR_PRESET",
        required: true,
        presets: ["一段被封闭的记忆", "一个未公开的身份事实"],
      },
      openCondition: {
        id: "openCondition",
        label: "开放条件",
        type: "TEXT_OR_PRESET",
        required: true,
        presets: ["到达指定阶段", "完成某正式结算"],
      },
    };
  }
  if (familyId === "M08") {
    return {
      publicGoal: {
        id: "publicGoal",
        label: "公开目标",
        type: "TEXT_OR_PRESET",
        required: true,
        presets: ["控制某个公共资源", "推动某项表决"],
      },
      hiddenTension: {
        id: "hiddenTension",
        label: "隐藏张力",
        type: "TEXT_OR_PRESET",
        required: false,
        presets: ["同阵营内部分歧", "跨阵营临时合作诱惑"],
      },
    };
  }
  if (familyId === "M10") {
    return {
      choicePrompt: {
        id: "choicePrompt",
        label: "抉择题干",
        type: "TEXT_OR_PRESET",
        required: true,
        presets: ["是否公开真相", "是否放过某人"],
      },
      endingA: {
        id: "endingA",
        label: "结局分支A",
        type: "TEXT_OR_PRESET",
        required: true,
        presets: ["公开后的共同体结局", "保守沉默的结局"],
      },
      endingB: {
        id: "endingB",
        label: "结局分支B",
        type: "TEXT_OR_PRESET",
        required: true,
        presets: ["对抗升级结局", "和解代价结局"],
      },
    };
  }
  return {
    stateChange: {
      id: "stateChange",
      label: "可变状态变化",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["物件被移动", "现场被部分毁坏"],
    },
    immutableBoundary: {
      id: "immutableBoundary",
      label: "不可改写边界",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["客观死亡事实不可改", "既成时间戳不可改"],
    },
  };
}

export function buildCatalogFoundationTemplates() {
  return CATALOG_SEEDS.map(([id, familyId, title, purpose]) =>
    foundationStoryTemplate({
      id,
      familyId,
      title,
      purpose,
      roleSlots: familyRoleSlots(familyId),
      plotSlots: familyPlotSlots(familyId, title),
      contentMaturity: CONTENT_MATURITY.FOUNDATION,
    }),
  );
}

/** 生产专用完整模板：嫁祸型（不在 37 catalog ID 内，额外注册）。 */
export function buildM01FramingTemplate() {
  const roleSlots = {
    victim: {
      required: true,
      label: "死者/被害关联",
      allowNpc: true,
      mustDifferFrom: [],
      narrativeRole: "victim",
      intensity: 2,
    },
    culprit: {
      required: true,
      label: "真凶",
      allowNpc: false,
      mustDifferFrom: ["victim"],
      narrativeRole: "killer",
      intensity: 3,
    },
    framedCharacter: {
      required: true,
      label: "被嫁祸者",
      allowNpc: false,
      mustDifferFrom: ["culprit", "victim"],
      narrativeRole: "framed",
      intensity: 2,
    },
    discoverer: {
      required: false,
      label: "发现异常者",
      allowNpc: false,
      mustDifferFrom: ["culprit"],
      narrativeRole: "discoverer",
      intensity: 1,
    },
  };
  const plotSlots = {
    trueMotive: {
      id: "trueMotive",
      label: "真实动机",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: [...M01_PLOT_CANDIDATES.trueMotive],
    },
    trueMethod: {
      id: "trueMethod",
      label: "真实手法",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: [...M01_PLOT_CANDIDATES.trueMethod],
    },
    plantedEvidence: {
      id: "plantedEvidence",
      label: "栽赃/误导物",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: [...M01_PLOT_CANDIDATES.plantedEvidence],
    },
    apparentConclusion: {
      id: "apparentConclusion",
      label: "第一层错误判断",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: ["被嫁祸者进入过现场并与死者起过冲突"],
    },
    contradiction: {
      id: "contradiction",
      label: "反证",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: [],
    },
    decisiveEvidence: {
      id: "decisiveEvidence",
      label: "关键突破",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: [],
    },
    concealmentMethod: {
      id: "concealmentMethod",
      label: "掩饰方式",
      type: "TEXT_OR_PRESET",
      required: true,
      presets: [],
    },
  };
  const variants = M01_FRAMING_VARIANTS.map((v) => ({
    id: v.id,
    title: v.name,
    description: v.summary,
    beatPattern: {
      setup: v.beatOutline.setup,
      crime: v.beatOutline.crime,
      falseDirection: v.beatOutline.falseDirection,
      contradiction: v.beatOutline.contradiction,
      reveal: v.beatOutline.reveal,
    },
    requiredSlots: ["victim", "culprit", "framedCharacter"],
    preferredSlots: ["discoverer"],
    incompatibilities: [],
    defaults: {
      trueMotive: M01_PLOT_CANDIDATES.trueMotive[0],
      apparentConclusion: "被嫁祸者进入过现场并与死者起过冲突",
      ...v.defaults,
    },
  }));

  return Object.freeze({
    id: "M01-FRAMING",
    familyId: "M01",
    title: "嫁祸型追凶",
    purpose:
      "让玩家先形成一个有证据支撑的错误嫌疑，再通过反证推翻嫁祸并锁定真凶。",
    description: "M01 族生产结构模板（嫁祸）。catalog 子型之外的创作骨架。",
    contentMaturity: CONTENT_MATURITY.COMPLETE,
    roleSlots: Object.freeze(roleSlots),
    plotSlots: Object.freeze(plotSlots),
    clueSlots: Object.freeze([
      { id: "FALSE_LEAD", type: "FALSE_LEAD", purpose: "误导", required: true, stageHint: "FALSE_DIRECTION" },
      { id: "CONTRADICTION", type: "CONTRADICTION", purpose: "反证", required: true, stageHint: "CONTRADICTION" },
      { id: "TRUE_EVIDENCE", type: "TRUE_EVIDENCE", purpose: "真手法", required: true, stageHint: "TRUTH_REVEAL" },
      { id: "DECISIVE_EVIDENCE", type: "DECISIVE_EVIDENCE", purpose: "突破", required: true, stageHint: "TRUTH_REVEAL" },
    ]),
    stagePattern: Object.freeze([
      { id: "SETUP", stageRole: "SETUP", ordering: 0, optional: false, label: "铺垫" },
      { id: "CRIME_DISCOVERY", stageRole: "CRIME", ordering: 1, optional: false, label: "案发发现" },
      { id: "FALSE_DIRECTION", stageRole: "MISLEAD", ordering: 2, optional: false, label: "错误方向" },
      { id: "CONTRADICTION", stageRole: "TURN", ordering: 3, optional: false, label: "反证出现" },
      { id: "TRUTH_REVEAL", stageRole: "RESOLVE", ordering: 4, optional: false, label: "真相揭示" },
    ]),
    variants: Object.freeze(variants.map((v) => Object.freeze(v))),
    constraints: Object.freeze([
      { type: "distinct_roles", slots: ["culprit", "framedCharacter", "victim"] },
    ]),
    defaultGeneration: Object.freeze({ preferredVariantId: "V02" }),
    editableSlots: Object.freeze(editableFromSlots(roleSlots, plotSlots)),
    integrationHints: Object.freeze({
      canPrecede: ["M07", "M08"],
      canFollow: ["M10"],
      sharesFactsWith: ["death", "culprit", "frame"],
    }),
  });
}

function attachSemanticsBridge(template) {
  const bridge = semanticsBridgeForTemplate(template.id);
  const withBridge = bridge ? Object.freeze({ ...template, semanticsBridge: bridge }) : template;
  return attachCreationMetadata(withBridge);
}

export function buildAllStoryTemplates() {
  const m07 = buildM07CompleteTemplates().map(attachSemanticsBridge);
  const m08 = buildM08CompleteTemplates().map(attachSemanticsBridge);
  const completeIds = new Set([...m07, ...m08].map((t) => t.id));
  const foundations = buildCatalogFoundationTemplates().filter((t) => !completeIds.has(t.id));
  return Object.freeze([attachSemanticsBridge(buildM01FramingTemplate()), ...m07, ...m08, ...foundations]);
}
