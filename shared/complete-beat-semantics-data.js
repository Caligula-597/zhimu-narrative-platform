/**
 * COMPLETE 家族 BeatSemantics 桥接数据（M01-FRAMING + M07×8 + M08×8）
 * 只做数据；Integrator / Engine 不得 if (familyId===...) 硬编码目标。
 * P8.0.5: every require declares sourceKind (never defaulted at runtime).
 */

function phase(spec) {
  return Object.freeze(spec);
}

function bridge(spec) {
  return Object.freeze({
    defaultIndependence: "SHAREABLE",
    defaultLocation: "关键场所",
    ...spec,
    roleGoals: Object.freeze(spec.roleGoals || {}),
    phaseNames: spec.phaseNames ? Object.freeze({ ...spec.phaseNames }) : undefined,
    contextSlots: spec.contextSlots ? Object.freeze({ ...spec.contextSlots }) : undefined,
    phases: Object.freeze(
      Object.fromEntries(
        Object.entries(spec.phases || {}).map(([k, v]) => [k, phase(v)]),
      ),
    ),
  });
}

/** Story-closed fact — earlier producer or ACCEPTED FactBridge required. */
function storyReq(id, summary) {
  return {
    id,
    factType: id,
    kind: id,
    summary,
    sourceKind: "STORY_FACT",
  };
}

function projectReq(id, summary) {
  return {
    id,
    factType: id,
    kind: id,
    summary,
    sourceKind: "PROJECT_PREREQ",
  };
}

function externalReq(id, summary, sourceRef = id) {
  return {
    id,
    factType: id,
    kind: id,
    summary,
    sourceKind: "EXTERNAL_TRIGGER",
    sourceRef,
  };
}

function fact(id, summary) {
  return { id, factType: id, kind: id, summary };
}

const M01 = bridge({
  defaultActorRole: "culprit",
  defaultLocation: "{ctx.crimeScene}",
  phaseNames: Object.freeze({
    0: "setup",
    1: "crime",
    2: "falseDirection",
    3: "contradiction",
    4: "reveal",
  }),
  contextSlots: Object.freeze({
    plantedEvidence: Object.freeze({ kind: "OBJECT", fallbackLabel: "误导证物", required: true }),
    crimeScene: Object.freeze({ kind: "LOCATION", fallbackLabel: "案发现场", required: true }),
    decisiveEvidence: Object.freeze({ kind: "OBJECT", fallbackLabel: "决定性证据", required: true }),
  }),
  roleGoals: {
    culprit: "掩盖罪行并维持嫁祸",
    framedCharacter: "洗清自己的嫌疑",
    discoverer: "找出真正的凶手",
    victim: "（已被害，作为事件焦点）",
  },
  phases: {
    0: {
      primaryRole: "culprit",
      goal: "准备可嫁祸的假象",
      action: "在{ctx.crimeScene}周边布置与{framed}相关的{ctx.plantedEvidence}",
      target: "{ctx.plantedEvidence}",
      actionKind: "PREPARE",
      locationHint: "作案准备地",
      produces: [fact("false_lead", "{ctx.plantedEvidence}已就绪")],
      independence: "DEPENDENT",
    },
    1: {
      primaryRole: "culprit",
      goal: "完成犯行并维持对{framed}的嫁祸条件",
      action: "在{ctx.crimeScene}实施犯罪并留下指向{framed}的{ctx.plantedEvidence}",
      target: "{ctx.plantedEvidence}",
      actionKind: "COMMIT",
      locationHint: "{ctx.crimeScene}",
      requires: [storyReq("false_lead", "误导物")],
      produces: [
        fact("crime_done", "犯行已发生"),
        fact("planted_evidence_available", "{ctx.plantedEvidence}可供发现与解读"),
      ],
      opposes: [fact("clear_framed", "洗清被嫁祸者")],
      independence: "DEPENDENT",
    },
    2: {
      primaryRole: "discoverer",
      goal: "根据当前证据判断案情并形成对{framed}的主要嫌疑",
      action: "发现并解读{ctx.plantedEvidence}，把{framed}视为主要嫌疑人",
      target: "{ctx.plantedEvidence}",
      actionKind: "MISREAD",
      locationHint: "{ctx.crimeScene}",
      requires: [storyReq("planted_evidence_available", "可解读的误导证据")],
      produces: [fact("false_suspicion", "错误嫌疑进入调查")],
      independence: "SHAREABLE",
    },
    3: {
      primaryRole: "discoverer",
      goal: "推翻对{framed}的错误判断",
      action: "对照{ctx.crimeScene}与证物寻找错误嫌疑无法解释的矛盾",
      target: "{ctx.plantedEvidence}",
      actionKind: "INVESTIGATE",
      locationHint: "{ctx.crimeScene}",
      requires: [storyReq("false_suspicion", "错误嫌疑")],
      produces: [fact("contradiction", "反证出现")],
      independence: "SHAREABLE",
    },
    4: {
      primaryRole: "discoverer",
      goal: "锁定真凶{culprit}",
      action: "用{ctx.decisiveEvidence}揭穿嫁祸",
      target: "{ctx.decisiveEvidence}",
      actionKind: "REVEAL",
      requires: [storyReq("contradiction", "反证")],
      produces: [fact("truth_locked", "真凶锁定")],
      independence: "DEPENDENT",
    },
  },
});

function m07Bridge(extra = {}) {
  return bridge({
    defaultActorRole: "bearer",
    defaultLocation: "{ctx.recordLocation}",
    phaseNames: Object.freeze({
      0: "setup",
      1: "progression",
      2: "climax",
      3: "resolution",
    }),
    contextSlots: Object.freeze({
      identityRecord: Object.freeze({ kind: "RECORD", fallbackLabel: "身份记录", required: true }),
      recordLocation: Object.freeze({ kind: "LOCATION", fallbackLabel: "藏有记录的场所", required: true }),
      accessCredential: Object.freeze({ kind: "CREDENTIAL", fallbackLabel: "身份权限" }),
      settlementCode: Object.freeze({ kind: "TRIGGER", fallbackLabel: "结算码" }),
      centralDocument: Object.freeze({ kind: "RECORD", fallbackLabel: "关键文书" }),
      ...(extra.contextSlots || {}),
    }),
    roleGoals: {
      bearer: "确认或保护自己的真实身份",
      knower: "决定是否公开所知身份信息",
      misled: "摆脱错误身份认知",
      revealer: "在合适时机揭示身份真相",
      related: "处理与身份相关的关系后果",
      probeLead: "用不点名的方式压缩身份候选",
      ...(extra.roleGoals || {}),
    },
    phases: {
      0: {
        primaryRole: "bearer",
        goal: "隐藏或维持当前身份表象",
        action: "按伪装/未知状态行动，避免过早暴露",
        target: "身份表象",
        actionKind: "CONCEAL",
        locationHint: "日常活动场所",
        produces: [fact("identity_latent", "身份仍未公开")],
        independence: "INDEPENDENT",
        ...(extra.p0 || {}),
      },
      1: {
        primaryRole: "bearer",
        goal: "寻找能确认身份的{ctx.identityRecord}",
        action: "进入{ctx.recordLocation}搜查{ctx.identityRecord}",
        target: "{ctx.identityRecord}",
        actionKind: "SEARCH",
        locationHint: "{ctx.recordLocation}",
        requires: [projectReq("site_accessible", "{ctx.recordLocation}可进入")],
        produces: [fact("identity_clue", "与{ctx.identityRecord}相关的线索")],
        independence: "SHAREABLE",
        ...(extra.p1 || {}),
      },
      2: {
        primaryRole: "bearer",
        goal: "确认真实身份并决定是否公开",
        action: "核对{ctx.identityRecord}并作出公开或隐瞒选择",
        target: "真实身份",
        actionKind: "CONFIRM",
        requires: [storyReq("identity_clue", "身份线索")],
        produces: [
          fact("identity_confirmed", "身份已确认"),
          fact("family_status", "家族/资格状态"),
        ],
        independence: "DEPENDENT",
        ...(extra.p2 || {}),
      },
      3: {
        primaryRole: "bearer",
        goal: "承受身份公开后的关系后果",
        action: "面对知情者与阵营/调查方的反应",
        target: "关系重组",
        actionKind: "CONSEQUENCE",
        requires: [storyReq("identity_confirmed", "身份确认")],
        produces: [fact("identity_public", "身份进入公开层")],
        independence: "DEPENDENT",
        ...(extra.p3 || {}),
      },
    },
  });
}

function m08Bridge(extra = {}) {
  return bridge({
    defaultActorRole: "factionLead",
    defaultLocation: "{ctx.factionMeetingPlace}",
    phaseNames: Object.freeze({
      0: "setup",
      1: "progression",
      2: "climax",
      3: "resolution",
    }),
    contextSlots: Object.freeze({
      contestedResource: Object.freeze({ kind: "RESOURCE", fallbackLabel: "关键账册或信物", required: true }),
      factionMeetingPlace: Object.freeze({ kind: "LOCATION", fallbackLabel: "阵营会合点" }),
      factionCredential: Object.freeze({ kind: "CREDENTIAL", fallbackLabel: "阵营名单/暗号" }),
      publicTask: Object.freeze({ kind: "TASK", fallbackLabel: "公共任务" }),
      ...(extra.contextSlots || {}),
    }),
    roleGoals: {
      factionLead: "推动阵营目标达成",
      memberA: "完成阵营任务并保护同伴",
      memberB: "完成阵营任务并保护同伴",
      hiddenMember: "在不被识破的前提下执行隐秘任务",
      outsider: "查清或抵抗阵营影响",
      rivalLead: "挫败对立阵营目标",
      defector: "脱离阵营并尽量降低代价",
      recruiter: "把合适的人拉进阵营",
      mediator: "促成或拆解临时合作",
      witness: "掌握并决定是否泄露阵营信息",
      thirdLead: "为第三方阵营争取有利档位",
      ...(extra.roleGoals || {}),
    },
    phases: {
      0: {
        primaryRole: "factionLead",
        goal: "巩固或潜伏阵营结构",
        action: "确认成员知情范围与{ctx.factionCredential}",
        target: "{ctx.factionCredential}",
        actionKind: "ORGANIZE",
        locationHint: "{ctx.factionMeetingPlace}",
        produces: [fact("faction_latent", "阵营结构已成形")],
        independence: "DEPENDENT",
        ...(extra.p0 || {}),
      },
      1: {
        primaryRole: "factionLead",
        goal: "{factionGoal}",
        action: "组织成员夺取或销毁{ctx.contestedResource}",
        target: "{ctx.contestedResource}",
        actionKind: "SECURE",
        locationHint: "关键场所",
        requires: [
          projectReq("site_accessible", "关键场所可进入"),
          storyReq("faction_latent", "阵营已成形"),
        ],
        produces: [fact("faction_pressure", "阵营压力升级")],
        opposes: [fact("truth_locked", "调查真相公开")],
        protects: [fact("faction_secret", "阵营秘密")],
        independence: "SHAREABLE",
        ...(extra.p1 || {}),
      },
      2: {
        primaryRole: "defector",
        goal: "在暴露风险下改归属或保住秘密",
        action: "在关键选择点背叛、退出或清洗异己",
        target: "归属状态",
        actionKind: "SHIFT",
        requires: [storyReq("faction_pressure", "阵营压力")],
        produces: [
          fact("allegiance_changed", "归属已改变"),
          fact("faction_exposure_risk", "暴露风险上升"),
        ],
        independence: "DEPENDENT",
        ...(extra.p2 || {}),
      },
      3: {
        primaryRole: "factionLead",
        goal: "结算阵营目标并承受公开后果",
        action: "公开站队或接受阵营败露后的关系重排",
        target: "阵营胜负条件",
        actionKind: "SETTLE",
        requires: [storyReq("allegiance_changed", "归属变化")],
        produces: [fact("faction_settled", "阵营线结算")],
        independence: "DEPENDENT",
        ...(extra.p3 || {}),
      },
    },
  });
}

export const COMPLETE_BEAT_SEMANTICS = Object.freeze({
  "M01-FRAMING": M01,
  "M07-1": m07Bridge({
    p1: {
      goal: "等到约定阶段再领取被封存的事实",
      action: "等待阶段到达并接收同一事实片段",
      actionKind: "RECEIVE",
      independence: "INDEPENDENT",
    },
  }),
  "M07-2": m07Bridge({
    p1: {
      goal: "用正式动作换取被条件锁住的{ctx.identityRecord}",
      action: "在{ctx.recordLocation}完成登记条件以触发{ctx.identityRecord}开放",
      target: "{ctx.identityRecord}",
      locationHint: "{ctx.recordLocation}",
      requires: [externalReq("formal_trigger", "正式触发条件", "formal_trigger")],
      produces: [fact("identity_clue", "条件开放的{ctx.identityRecord}相关信息")],
    },
  }),
  "M07-3": m07Bridge(),
  "M07-4": m07Bridge({
    roleGoals: { bearer: "逐步恢复被分层封闭的记忆" },
  }),
  "M07-5": m07Bridge({
    roleGoals: { bearer: "在伪装与真相之间控制身份权限" },
    p2: {
      goal: "启用真实身份对应的权限",
      action: "在揭示后启用权限表并验证资格",
      produces: [
        fact("identity_confirmed", "身份已确认"),
        fact("family_status", "资格/权限状态"),
        fact("site_accessible", "场所权限可能开放"),
      ],
    },
  }),
  "M07-6": m07Bridge({
    roleGoals: { bearer: "用新的上下文重新解释旧事实" },
  }),
  "M07-7": m07Bridge({
    roleGoals: { bearer: "选择记起或公开哪一部分" },
  }),
  "M07-8": m07Bridge({
    defaultActorRole: "probeLead",
    roleGoals: { probeLead: "用不点名探测压缩身份候选" },
    p1: {
      primaryRole: "probeLead",
      goal: "压缩隐藏身份候选范围",
      action: "对一组人发起集合属性探测",
      target: "聚合输出",
      actionKind: "PROBE",
      independence: "SHAREABLE",
    },
  }),
  "M08-1": m08Bridge({
    p0: { independence: "INDEPENDENT", goal: "公开亮明阵营归属与目标" },
  }),
  "M08-2": m08Bridge({
    p0: { goal: "维持隐营互认且不被外人察觉", actionKind: "CONCEAL" },
    p1: {
      goal: "在隐秘状态下夺取或销毁会暴露阵营的物证",
      action: "派人潜入{location}处理关键账册",
      target: "关键账册",
      actionKind: "SECURE",
      locationHint: "藏有记录的场所",
      requires: [
        projectReq("site_accessible", "关键场所可进入"),
        storyReq("faction_latent", "阵营已成形"),
      ],
      protects: [fact("faction_secret", "隐营秘密")],
      opposes: [fact("contradiction", "调查反证")],
    },
  }),
  "M08-3": m08Bridge(),
  "M08-4": m08Bridge({
    p1: {
      requires: [
        projectReq("site_accessible", "关键场所可进入"),
        storyReq("faction_latent", "阵营已成形"),
        storyReq("family_status", "具备可改属的资格状态"),
      ],
    },
    p2: {
      primaryRole: "defector",
      goal: "在预设节点改写归属",
      action: "作出站队或改属选择",
      requires: [storyReq("identity_confirmed", "身份确认可触发改属")],
    },
  }),
  "M08-5": m08Bridge({
    roleGoals: { memberA: "在阵营目标上叠加完成个人目标" },
    p1: {
      target: "关键账册或信物",
      requires: [
        projectReq("site_accessible", "关键场所可进入"),
        storyReq("faction_latent", "阵营已成形"),
      ],
      opposes: [fact("clear_framed", "被嫁祸者洗清")],
    },
  }),
  "M08-6": m08Bridge({
    p1: {
      primaryRole: "mediator",
      goal: "促成有时限的临时同盟",
      action: "推动双方确认共享范围与退出成本",
      independence: "SHAREABLE",
    },
  }),
  "M08-7": m08Bridge({
    p1: {
      goal: "按本阵营对{ctx.publicTask}的立场偏好施加影响",
      action: "对{ctx.publicTask}施加正式支援或破坏",
      target: "{ctx.publicTask}",
      actionKind: "INFLUENCE_PUBLIC_TASK",
      produces: [fact("faction_pressure", "{ctx.publicTask}立场压力")],
    },
  }),
  "M08-8": m08Bridge({
    p1: {
      primaryRole: "thirdLead",
      goal: "在多营条件表中争取渔利档",
      action: "利用两营冲突抽取第三方利益",
    },
  }),
});

export function semanticsBridgeForTemplate(templateId) {
  return COMPLETE_BEAT_SEMANTICS[String(templateId)] || null;
}
