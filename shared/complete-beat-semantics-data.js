/**
 * COMPLETE 家族 BeatSemantics 桥接数据（M01-FRAMING + M07×8 + M08×8）
 * 只做数据；Integrator / Engine 不得 if (familyId===...) 硬编码目标。
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
    phases: Object.freeze(
      Object.fromEntries(
        Object.entries(spec.phases || {}).map(([k, v]) => [k, phase(v)]),
      ),
    ),
  });
}

const M01 = bridge({
  defaultActorRole: "culprit",
  defaultLocation: "案发现场周边",
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
      action: "布置与{framed}相关的误导物",
      target: "{evidence}",
      actionKind: "PREPARE",
      locationHint: "作案准备地",
      produces: [{ id: "false_lead_ready", kind: "false_lead", summary: "误导物已就绪" }],
      independence: "DEPENDENT",
    },
    1: {
      primaryRole: "culprit",
      goal: "完成犯行并指向{framed}",
      action: "实施犯行并留下指向{framed}的痕迹",
      target: "{evidence}",
      actionKind: "COMMIT",
      locationHint: "案发现场",
      requires: [{ id: "false_lead_ready", kind: "false_lead", summary: "误导物" }],
      produces: [
        { id: "crime_done", kind: "crime", summary: "犯行已发生" },
        { id: "false_suspicion", kind: "suspicion", summary: "错误嫌疑成立" },
      ],
      opposes: [{ id: "clear_framed", kind: "clearance", summary: "洗清被嫁祸者" }],
      independence: "DEPENDENT",
    },
    2: {
      primaryRole: "discoverer",
      goal: "推翻对{framed}的错误判断",
      action: "对照现场与证物寻找矛盾",
      target: "{evidence}",
      actionKind: "INVESTIGATE",
      locationHint: "案发现场",
      requires: [{ id: "false_suspicion", kind: "suspicion", summary: "错误嫌疑" }],
      produces: [{ id: "contradiction", kind: "contradiction", summary: "反证出现" }],
      independence: "SHAREABLE",
    },
    3: {
      primaryRole: "discoverer",
      goal: "锁定真凶{culprit}",
      action: "用决定性证据揭穿嫁祸",
      target: "决定性证据",
      actionKind: "REVEAL",
      requires: [{ id: "contradiction", kind: "contradiction", summary: "反证" }],
      produces: [{ id: "truth_locked", kind: "truth", summary: "真凶锁定" }],
      independence: "DEPENDENT",
    },
  },
});

function m07Bridge(extra = {}) {
  return bridge({
    defaultActorRole: "bearer",
    defaultLocation: "藏有记录的场所",
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
        produces: [{ id: "identity_latent", kind: "identity", summary: "身份仍未公开" }],
        independence: "INDEPENDENT",
        ...(extra.p0 || {}),
      },
      1: {
        primaryRole: "bearer",
        goal: "寻找能确认身份的记录或信物",
        action: "进入{location}搜查身份相关物证",
        target: "身份记录",
        actionKind: "SEARCH",
        locationHint: "藏有记录的场所",
        requires: [{ id: "site_accessible", kind: "access", summary: "关键场所可进入" }],
        produces: [{ id: "identity_clue", kind: "identity_clue", summary: "身份线索" }],
        independence: "SHAREABLE",
        ...(extra.p1 || {}),
      },
      2: {
        primaryRole: "bearer",
        goal: "确认真实身份并决定是否公开",
        action: "核对身份线索并作出公开或隐瞒选择",
        target: "真实身份",
        actionKind: "CONFIRM",
        requires: [{ id: "identity_clue", kind: "identity_clue", summary: "身份线索" }],
        produces: [
          { id: "identity_confirmed", kind: "identity", summary: "身份已确认" },
          { id: "family_status", kind: "status", summary: "家族/资格状态" },
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
        requires: [{ id: "identity_confirmed", kind: "identity", summary: "身份确认" }],
        produces: [{ id: "identity_public", kind: "identity", summary: "身份进入公开层" }],
        independence: "DEPENDENT",
        ...(extra.p3 || {}),
      },
    },
  });
}

function m08Bridge(extra = {}) {
  return bridge({
    defaultActorRole: "factionLead",
    defaultLocation: "阵营关键据点",
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
        action: "确认成员知情范围与联络方式",
        target: "阵营名单/暗号",
        actionKind: "ORGANIZE",
        locationHint: "私下会合点",
        produces: [{ id: "faction_latent", kind: "faction", summary: "阵营结构已成形" }],
        independence: "DEPENDENT",
        ...(extra.p0 || {}),
      },
      1: {
        primaryRole: "factionLead",
        goal: "{factionGoal}",
        action: "组织成员夺取或销毁关键物证/资源",
        target: "关键账册或信物",
        actionKind: "SECURE",
        locationHint: "关键场所",
        requires: [
          { id: "site_accessible", kind: "access", summary: "关键场所可进入" },
          { id: "faction_latent", kind: "faction", summary: "阵营已成形" },
        ],
        produces: [{ id: "faction_pressure", kind: "faction", summary: "阵营压力升级" }],
        opposes: [{ id: "truth_locked", kind: "truth", summary: "调查真相公开" }],
        protects: [{ id: "faction_secret", kind: "secret", summary: "阵营秘密" }],
        independence: "SHAREABLE",
        ...(extra.p1 || {}),
      },
      2: {
        primaryRole: "defector",
        goal: "在暴露风险下改归属或保住秘密",
        action: "在关键选择点背叛、退出或清洗异己",
        target: "归属状态",
        actionKind: "SHIFT",
        requires: [{ id: "faction_pressure", kind: "faction", summary: "阵营压力" }],
        produces: [
          { id: "allegiance_changed", kind: "faction", summary: "归属已改变" },
          { id: "faction_exposure_risk", kind: "exposure", summary: "暴露风险上升" },
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
        requires: [{ id: "allegiance_changed", kind: "faction", summary: "归属变化" }],
        produces: [{ id: "faction_settled", kind: "faction", summary: "阵营线结算" }],
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
      goal: "用正式动作换取被条件锁住的信息",
      action: "完成登记条件以触发内容开放",
      requires: [{ id: "formal_trigger", kind: "trigger", summary: "正式触发条件" }],
      produces: [{ id: "identity_clue", kind: "identity_clue", summary: "条件开放的信息" }],
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
        { id: "identity_confirmed", kind: "identity", summary: "身份已确认" },
        { id: "family_status", kind: "status", summary: "资格/权限状态" },
        { id: "site_accessible", kind: "access", summary: "场所权限可能开放" },
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
        { id: "site_accessible", kind: "access", summary: "关键场所可进入" },
        { id: "faction_latent", kind: "faction", summary: "阵营已成形" },
      ],
      protects: [{ id: "faction_secret", kind: "secret", summary: "隐营秘密" }],
      opposes: [{ id: "contradiction", kind: "contradiction", summary: "调查反证" }],
    },
  }),
  "M08-3": m08Bridge(),
  "M08-4": m08Bridge({
    p1: {
      requires: [
        { id: "site_accessible", kind: "access", summary: "关键场所可进入" },
        { id: "faction_latent", kind: "faction", summary: "阵营已成形" },
        { id: "family_status", kind: "status", summary: "具备可改属的资格状态" },
      ],
    },
    p2: {
      primaryRole: "defector",
      goal: "在预设节点改写归属",
      action: "作出站队或改属选择",
      requires: [{ id: "identity_confirmed", kind: "identity", summary: "身份确认可触发改属" }],
    },
  }),
  "M08-5": m08Bridge({
    roleGoals: { memberA: "在阵营目标上叠加完成个人目标" },
    p1: {
      target: "关键账册或信物",
      requires: [
        { id: "site_accessible", kind: "access", summary: "关键场所可进入" },
        { id: "faction_latent", kind: "faction", summary: "阵营已成形" },
      ],
      opposes: [{ id: "clear_framed", kind: "clearance", summary: "被嫁祸者洗清" }],
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
      goal: "让公共任务按本阵营偏好成功、失败或延迟",
      action: "对公共任务施加正式破坏或支援",
      target: "公共任务状态",
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
