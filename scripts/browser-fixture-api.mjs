import http from "node:http";
import {
  creativeConstitutionCoverage,
  isCreativeConstitutionEmpty,
  normalizeCreativeConstitution
} from "../shared/creative-constitution.js";
import { AI_PLAYER_ARCHETYPES } from "../shared/ai-playtest.js";
import { projectRuntimePresentation } from "../shared/runtime-presentation.js";

const host = "127.0.0.1";
const port = Number(process.env.ZHIMU_BROWSER_FIXTURE_PORT || 4180);
const verificationAuthFixture = process.env.ZHIMU_BROWSER_FIXTURE_AUTH === "verification";
const emptyAccountFixture = process.env.ZHIMU_BROWSER_FIXTURE_EMPTY_ACCOUNT === "true";
const verificationChallengeId = "7f5f69b2-5330-4cc9-9497-5a6c751c80e8";
let verificationFixtureAuthenticated = false;
const fixtureUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const portalProfiles = {
  creator: {
    portal: "creator",
    displayName: "浏览器主创",
    avatarUrl: null,
    hasCustomAvatar: false,
    nameChangedAt: null,
    nextNameChangeAt: null,
    canChangeName: true,
    avatarUpdatedAt: null
  },
  host: {
    portal: "host",
    displayName: "浏览器主持",
    avatarUrl: null,
    hasCustomAvatar: false,
    nameChangedAt: null,
    nextNameChangeAt: null,
    canChangeName: true,
    avatarUpdatedAt: null
  },
  player: {
    portal: "player",
    displayName: "浏览器玩家",
    avatarUrl: null,
    hasCustomAvatar: false,
    nameChangedAt: null,
    nextNameChangeAt: null,
    canChangeName: true,
    avatarUpdatedAt: null
  }
};
const worldId = "33333333-3333-4333-8444-555555550003";
const releaseId = "44444444-4444-4444-8444-555555550004";
let releaseSequence = 2;
let roomSequence = 2;
let clueSequence = 1;
let ruleSequence = 0;
let qualityReportSequence = 0;
const qualityReports = [];
const opsFixtureUserId = "77777777-7777-4777-8777-777777770001";
let opsFixtureUsers = [{
  id: opsFixtureUserId,
  email: "pending-browser-test@example.invalid",
  displayName: "待验证浏览器测试",
  userKind: "registered",
  emailVerified: false,
  verificationStatus: "pending",
  hasActiveVerification: true,
  verificationLastSentAt: "2026-07-27T12:00:00.000Z",
  planCode: "free",
  ownedWorlds: 0,
  collaboratorWorlds: 0,
  assetCount: 0,
  activeSessions: 0,
  createdAt: "2026-07-27T11:58:00.000Z",
  updatedAt: "2026-07-27T12:00:00.000Z",
  protectedOperationsAccount: false
}];

const release = {
  id: releaseId,
  worldId,
  releaseNumber: 2,
  label: "浏览器验收版",
  sourceRevision: 7,
  snapshotSchemaVersion: 1,
  narrativeProfile: {
    creationType: "murder_mystery",
    runtimeShape: "one_shot",
    characterMode: "fixed_roles",
    rulesetFamily: "narrative"
  },
  readinessSummary: { errorCount: 0, warningCount: 1, successCount: 6 },
  contentSummary: {
    counts: { roles: 4, sections: 8, segments: 3 },
    hasCoreTrick: true,
    hasMechanismPackage: true,
    totalObjects: 29
  },
  contentSha256: "a".repeat(64),
  snapshotBytes: 4096,
  createdByUserId: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
  createdByName: "浏览器验收",
  createdAt: "2026-07-23T00:00:00.000Z"
};

const releases = [release];

const bindingFor = (selectedReleaseId = null) => {
  const selectedRelease = releases.find((item) => item.id === selectedReleaseId) || null;
  return selectedRelease
    ? {
      mode: "release",
      runtimeSource: "release_snapshot",
      isFrozen: true,
      compatibilityStatus: "frozen_release",
      release: {
        id: selectedRelease.id,
        releaseNumber: selectedRelease.releaseNumber,
        label: selectedRelease.label,
        sourceRevision: selectedRelease.sourceRevision,
        createdAt: selectedRelease.createdAt
      },
      currentDraftRevision: 8,
      hasNewerDraft: 8 > selectedRelease.sourceRevision
    }
    : {
      mode: "live_draft",
      runtimeSource: "live_draft",
      isFrozen: false,
      compatibilityStatus: "legacy_live_draft",
      release: null,
      currentDraftRevision: 8,
      hasNewerDraft: false
    };
};

const playerRoleId = "66666666-6666-4666-8666-555555550001";

const fixtureSegments = [{
  id: "88888888-8888-4888-8888-555555550011",
  segment_key: "arrival-check",
  title: "进入联盟隔离区",
  sequence: 1,
  chapter_id: "chapter-1",
  story: {
    beatPlan: {
      goal: "让玩家确认比赛数据与现实身份已经被隔离。",
      playerContent: "你们抵达联盟隔离服务器，入口只接受赛事身份凭证。",
      dmTasks: "说明入口规则，并确认所有玩家已经进入语音。",
      advanceCondition: "玩家完成身份核验并进入审查室。",
      estimatedMinutes: 8
    }
  },
  operations: {
    title: "进入联盟隔离区",
    flow: "核验身份 → 说明隔离规则 → 开放审查室",
    hostTruth: "入口日志不会直接证明授权范围。",
    playerTips: ["先核对自己的身份凭证", "留意训练权限与比赛权限的差别"],
    playerTasks: ["全员进入审查室并确认身份"]
  }
}, {
  id: "88888888-8888-4888-8888-555555550012",
  segment_key: "authorization-review",
  title: "核对代理授权",
  sequence: 2,
  chapter_id: "chapter-2",
  story: {
    beatPlan: {
      goal: "让玩家形成对授权边界的共同判断。",
      playerContent: "联盟审查已进入授权边界核对。你们需要判断训练授权是否覆盖正式比赛。",
      dmTasks: "分别询问授权签发者与实际使用者，再汇总全桌倾向。",
      openClues: "代理授权原始记录",
      advanceCondition: "全桌提交授权边界结论。",
      estimatedMinutes: 16
    }
  },
  operations: {
    title: "核对代理授权",
    flow: "公开记录 → 分组核对 → 汇总判断",
    hostTruth: "正式比赛授权从未完成签署。",
    fallbacks: ["若讨论停滞，公开训练授权的有效期。"],
    playerTips: ["对照原始授权记录", "区分身份真实与授权有效"],
    playerTasks: ["讨论授权是否覆盖正式比赛"]
  }
}, {
  id: "88888888-8888-4888-8888-555555550013",
  segment_key: "appeal-route",
  title: "资格冻结与申诉",
  sequence: 3,
  chapter_id: "chapter-3",
  story: {
    beatPlan: {
      goal: "把授权判断转化为可执行的结局路线。",
      playerContent: "联盟已经冻结代理资格。你们需要决定由谁提交申诉证据。",
      dmTasks: "确认申诉代表和公开证据，不提前宣布最终裁定。",
      advanceCondition: "玩家确认申诉代表与证据清单。",
      estimatedMinutes: 12
    }
  },
  operations: {
    title: "资格冻结与申诉",
    flow: "冻结资格 → 选择代表 → 提交申诉",
    hostTruth: "裁定仍由条件判断器根据证据与信誉值决定。",
    playerTips: ["先决定谁来承担申诉风险", "只提交能够公开验证的证据"],
    playerTasks: ["选出申诉代表", "整理公开证据清单"]
  }
}];

const fixtureTabletopMapDesign = {
  title: "联盟隔离服务器",
  locations: [{
    id: "server-lobby",
    name: "身份验证大厅",
    type: "安全入口",
    description: "漂浮的身份凭证在入口闸机前逐一亮起。",
    hostNotes: "若玩家遗漏凭证差异，提示日志时间比比赛开始早七分钟。",
    segmentKey: "arrival-check",
    x: 0.18,
    y: 0.66,
    z: 1,
    encounterNpcIds: []
  }, {
    id: "review-room",
    name: "授权审查室",
    type: "调查场景",
    description: "授权原始记录与赛事报名记录并排投射在环形屏幕上。",
    hostNotes: "隐藏事实：正式比赛授权缺少签发者的二次确认。",
    segmentKey: "authorization-review",
    x: 0.5,
    y: 0.34,
    z: 2,
    encounterNpcIds: ["npc-auditor"],
    checks: [{
      id: "verify-authorization",
      label: "核验二次授权",
      instruction: "说明如何比对签发记录与赛事报名时间。",
      target: 14,
      bonus: 1,
      rollMode: "normal",
      successText: "你确认了二次授权缺失。",
      failureText: "日志链不完整，但仍可提交人工复核。",
      successEffects: { trust: 2 },
      failureEffects: { trust: -4 }
    }]
  }, {
    id: "appeal-terminal",
    name: "联盟申诉终端",
    type: "结局节点",
    description: "终端只接受一名代表和一组可公开验证的证据。",
    hostNotes: "不要提前显示结局阈值；由条件判断器在提交后结算。",
    segmentKey: "appeal-route",
    x: 0.82,
    y: 0.64,
    z: 3,
    encounterNpcIds: ["npc-auditor"]
  }],
  routes: [["server-lobby", "review-room"], ["review-room", "appeal-terminal"]],
  variables: [{ id: "trust", label: "联盟信誉", value: 6, min: 0, max: 10 }],
  endings: [{
    id: "appeal-approved",
    name: "申诉通过",
    summary: "联盟接受公开证据并恢复参赛资格。",
    tone: "resolve",
    priority: 5,
    logic: "all",
    conditions: [{ id: "trust-high", variableId: "trust", operator: ">=", value: 7 }]
  }, {
    id: "appeal-rejected",
    name: "维持冻结",
    summary: "联盟暂不接受申诉，队伍需要承担后续代价。",
    tone: "cost",
    priority: 5,
    logic: "all",
    conditions: [{ id: "trust-low", variableId: "trust", operator: "<=", value: 3 }]
  }],
  system: {
    players: [{ id: playerRoleId, name: "小满", role: "职业选手", hp: 9, maxHp: 12 }],
    npcs: [{ id: "npc-auditor", name: "审查官赫兹", role: "联盟审查官", hp: 14, maxHp: 14 }],
    dice: { count: 1, sides: 20, modifier: 2, defaultTarget: 12 }
  }
};

const rooms = [{
  id: "55555555-5555-4555-8555-555555550001",
  name: "旧版实时草稿房",
  invite_code: "ROOM-LIVE-DRAFT",
  status: "testing",
  public_listing: false,
  member_count: 1,
  role_slot_count: 4,
  is_mine: true,
  contentBinding: bindingFor(),
  settings: {
    runtimePresentation: {
      activeSegmentKey: "authorization-review",
      activeLocationId: "review-room",
      revealedLocationIds: ["server-lobby", "review-room"],
      mapVisible: true,
      updatedAt: "2026-08-10T08:00:00.000Z"
    }
  }
}, {
  id: "55555555-5555-4555-8555-555555550002",
  name: "R2 预绑定房",
  invite_code: "ROOM-RELEASE-02",
  status: "testing",
  public_listing: false,
  member_count: 0,
  role_slot_count: 4,
  is_mine: true,
  contentBinding: bindingFor(releaseId),
  settings: {
    runtimePresentation: {
      activeSegmentKey: "authorization-review",
      activeLocationId: "review-room",
      revealedLocationIds: ["server-lobby", "review-room"],
      mapVisible: true,
      updatedAt: "2026-08-10T08:00:00.000Z"
    }
  }
}];

const playerSectionId = "77777777-7777-4777-8777-555555550001";

const mechanismDecision = {
  key: "authorization-scope",
  question: "小满的训练授权是否可以被扩大为正式比赛授权？",
  interaction: {
    kind: "group_choice",
    inputMode: "single_choice",
    resolutionMode: "host_confirmed",
    submissionMode: "advisory_choice",
    label: "公开抉择",
    playerInstruction: "讨论方案后，把全桌决定交给主持人。",
    hostInstruction: "汇总玩家倾向后，由主持人确认最终结算。",
    deadlineSeconds: 0,
    defaultOptionKey: "",
    allocationTotal: 0,
    allocationUnitLabel: "点"
  },
  options: [{
    key: "expand-authorization",
    choiceText: "认可扩大授权",
    presentation: { eyebrow: "讨论 01", publicPreview: "代理资格继续生效" }
  }, {
    key: "authorization-overreach",
    choiceText: "认定使用范围越权",
    presentation: { eyebrow: "讨论 02", publicPreview: "冻结代理资格并进入申诉" }
  }]
};

const mechanismRuntimes = new Map();

function newFixtureMechanismRuntime({ initialized = false } = {}) {
  const now = new Date().toISOString();
  return {
    initialized,
    revision: initialized ? 3 : 0,
    status: initialized ? "running" : "not_started",
    initializedAt: initialized ? now : null,
    roundStartedAt: initialized ? now : null,
    updatedAt: now,
    resolvedOptionKey: null,
    grantedClue: false,
    submissions: new Map(),
    history: []
  };
}

function mechanismGrantedClues(room) {
  const runtime = mechanismRuntimeFor(room);
  if (!runtime?.grantedClue) return [];
  return [{
    id: "99999999-9999-4999-8999-555555550001",
    name: "代理授权原始记录",
    public_text: "原始记录确认：小满只授权数字孪生用于训练。",
    acquired_at: runtime.updatedAt,
    read_at: null,
    is_owner: true,
    owner_role_slot_id: playerRoleId,
    owner_role_name: "小满"
  }];
}

for (const room of rooms) {
  mechanismRuntimes.set(room.id, newFixtureMechanismRuntime({ initialized: true }));
}

function mechanismRuntimeFor(room, { create = true } = {}) {
  if (!mechanismRuntimes.has(room.id) && create) {
    mechanismRuntimes.set(room.id, newFixtureMechanismRuntime());
  }
  return mechanismRuntimes.get(room.id) || null;
}

function mechanismSubmissionSummary(runtime) {
  if (!runtime?.submissions?.size) return [];
  const optionCounts = new Map();
  const roles = [];
  for (const [roleSlotId, submission] of runtime.submissions) {
    optionCounts.set(
      submission.optionKey,
      (optionCounts.get(submission.optionKey) || 0) + 1
    );
    roles.push({
      roleSlotId,
      roleName: "小满",
      optionKey: submission.optionKey,
      answer: { type: "single_choice", optionKey: submission.optionKey },
      updatedAt: submission.updatedAt
    });
  }
  return [{
    decisionKey: mechanismDecision.key,
    inputMode: "single_choice",
    total: runtime.submissions.size,
    options: [...optionCounts].map(([optionKey, count]) => ({
      optionKey,
      count,
      score: 0,
      firstPlaceCount: 0,
      allocated: 0
    })),
    roles
  }];
}

function browserHostMechanismRuntime(room, extra = {}) {
  const runtime = mechanismRuntimeFor(room);
  const base = {
    initialized: Boolean(runtime?.initialized),
    roomId: room.id,
    worldId,
    contentBinding: room.contentBinding,
    stale: false,
    submissionSummary: mechanismSubmissionSummary(runtime),
    state: null,
    history: runtime?.history || []
  };
  if (!runtime?.initialized) return { ...base, ...extra };
  return {
    ...base,
    state: {
      revision: runtime.revision,
      initializedAt: runtime.initializedAt,
      roundStartedAt: runtime.roundStartedAt,
      updatedAt: runtime.updatedAt,
      status: runtime.status,
      currentRoundKey: "authorization-review",
      currentRoundSequence: 1,
      currentRound: {
        sequence: 1,
        title: "核对代理授权",
        goal: "确认身份凭证真实，并不等于授权范围覆盖正式比赛。",
        playerAction: "讨论授权边界，并向主持人提交全桌共同意见",
        genreMechanicUse: "赛事认证复核"
      },
      currentBranch: "review",
      currentVariantKey: "league-audit",
      states: {
        authorizationVerdict: runtime.resolvedOptionKey || "pending"
      },
      resources: { reviewSlots: runtime.resolvedOptionKey ? 2 : 3 },
      evidence: { auditTrailVerified: true },
      availableDecisions: runtime.resolvedOptionKey ? [] : [mechanismDecision],
      availableInvestigations: [],
      ending: runtime.status === "completed" ? {
        resolvedRouteKey: "appeal-route",
        matchedRouteKeys: ["appeal-route"],
        title: "联盟申诉裁定",
        summary: "授权越权已被确认，代理资格冻结并进入申诉流程。"
      } : null,
      reachability: {
        truncated: false,
        endingProspects: [{
          key: "appeal-route",
          title: "联盟申诉",
          reachable: true,
          unmetRequirements: []
        }]
      }
    },
    ...extra
  };
}

function browserPlayerCurrentState(room) {
  const runtime = mechanismRuntimeFor(room);
  const ownSubmission = runtime?.submissions?.get(playerRoleId) || null;
  const publicOptionHandle = ownSubmission?.optionKey === mechanismDecision.options[1].key
    ? "option-2"
    : ownSubmission
      ? "option-1"
      : "";
  return {
    audience: "player",
    roomId: room.id,
    worldId,
    phase: { key: "playing", label: "剧情进行中", detail: "核对代理授权" },
    suggestedActions: [{
      key: "follow_mechanism_round",
      label: "讨论授权是否覆盖正式比赛",
      priority: 1,
      target: "home",
      reason: "确认数字代理的授权范围"
    }],
    blockers: [],
    currentBeat: browserCurrentBeat(room, "player"),
    presentation: browserRuntimePresentation(room, "player"),
    mechanism: {
      initialized: Boolean(runtime?.initialized),
      stale: false,
      revision: runtime?.revision || 0,
      status: runtime?.status || "not_started",
      totalRounds: 5,
      currentRound: runtime?.initialized ? {
        sequence: 2,
        title: "核对代理授权",
        goal: "确认身份凭证真实，并不等于授权范围覆盖正式比赛。",
        playerAction: "讨论授权边界，并向主持人提交全桌共同意见",
        genreMechanicUse: "赛事认证复核"
      } : null,
      decisions: runtime?.initialized && !runtime.resolvedOptionKey ? [{
        key: "choice-1",
        question: mechanismDecision.question,
        interaction: {
          kind: "group_choice",
          inputMode: "single_choice",
          resolutionMode: "host_confirmed",
          submissionMode: "advisory_choice",
          label: "公开抉择",
          playerInstruction: "讨论方案后，把全桌决定交给主持人。",
          deadlineSeconds: 0,
          defaultOptionKey: "",
          allocationTotal: 0,
          allocationUnitLabel: "点"
        },
        submission: ownSubmission ? {
          optionKey: publicOptionHandle,
          answer: { type: "single_choice", optionKey: publicOptionHandle },
          submittedAt: ownSubmission.updatedAt
        } : null,
        options: mechanismDecision.options.map((option, index) => ({
          key: `option-${index + 1}`,
          choiceText: option.choiceText,
          presentation: option.presentation
        }))
      }] : [],
      ending: runtime?.status === "completed" ? {
        resolvedRouteKey: "appeal-route",
        matchedRouteKeys: ["appeal-route"],
        title: "联盟申诉裁定",
        summary: "授权越权已被确认，代理资格冻结并进入申诉流程。"
      } : null,
      waitingForHost: Boolean(runtime?.initialized && runtime.status === "running"),
      updatedAt: runtime?.updatedAt || null
    },
    syncState: {
      status: "synced",
      runtimeSource: room.contentBinding?.runtimeSource || "live_draft",
      isFrozen: Boolean(room.contentBinding?.isFrozen),
      serverCursor: roomEventCursor,
      generatedAt: new Date().toISOString()
    },
    metrics: {
      joinedPlayers: 1,
      totalRoles: 4,
      pendingHostEvents: 0,
      pendingPrivateActions: 0,
      openVotes: 0,
      activeGame: false
    }
  };
}

function browserCurrentBeat(room, audience = "player") {
  const requestedKey = String(room.settings?.runtimePresentation?.activeSegmentKey || "");
  const segment = fixtureSegments.find((item) => item.segment_key === requestedKey) || fixtureSegments[0];
  const position = Math.max(1, fixtureSegments.indexOf(segment) + 1);
  const beat = segment.story?.beatPlan || {};
  const operations = segment.operations || {};
  return {
    id: segment.id,
    key: segment.segment_key,
    title: segment.title,
    sequence: segment.sequence,
    position,
    total: fixtureSegments.length,
    source: "host_control",
    player: {
      content: beat.playerContent || "",
      tips: operations.playerTips || [],
      tasks: operations.playerTasks || []
    },
    host: audience === "player" ? null : {
      goal: beat.goal || "",
      flow: operations.flow || "",
      hostTruth: operations.hostTruth || "",
      dmTasks: beat.dmTasks || "",
      openClues: beat.openClues || "",
      privateChatHints: beat.privateChatHints || "",
      advanceCondition: beat.advanceCondition || "",
      fallbacks: operations.fallbacks || [],
      estimatedMinutes: beat.estimatedMinutes ?? null
    }
  };
}

function browserRuntimePresentation(room, audience = "player") {
  return projectRuntimePresentation({
    world,
    roomSettings: room.settings || {},
    currentBeat: browserCurrentBeat(room, audience),
    audience
  });
}

function browserHostCurrentState(room) {
  const playerState = browserPlayerCurrentState(room);
  return {
    ...playerState,
    audience: "host",
    currentBeat: browserCurrentBeat(room, "host"),
    presentation: browserRuntimePresentation(room, "host"),
    suggestedActions: [{
      key: "create_checkpoint",
      label: "创建当前进度存档",
      priority: 3,
      target: "checkpoint",
      reason: "关键推进后保存恢复点"
    }]
  };
}

function browserPlayerHomeCore(room) {
  return {
    room: {
      id: room.id,
      worldId,
      name: room.name,
      status: room.status,
      contentBinding: room.contentBinding
    },
    role: {
      id: playerRoleId,
      name: "小满",
      public_profile: "职业选手，因伤缺席决胜局。",
      private_profile: "你只授权数字孪生用于训练，从未授权它参加正式比赛。"
    },
    sections: [{
      id: playerSectionId,
      title: "第五局之后",
      body: "服务器显示比赛已经完成，但你从未进入客户端。",
      sequence: 1,
      completed: true,
      completed_at: "2026-08-06T09:55:00.000Z"
    }],
    notes: [],
    clues: mechanismGrantedClues(room),
    sharedClues: [],
    roomMembers: [],
    suspicions: [],
    testimonies: [],
    privateActions: [],
    voiceRooms: [],
    inventory: [],
    hostConfirm: null,
    currentGame: null,
    activeVotes: [],
    roleState: null,
    currentActKey: "ch1",
    tasks: [],
    segments: [],
    contentRevision: 8
  };
}

function browserPlayerHomeSocial(room) {
  const grantedClues = mechanismGrantedClues(room);
  return {
    notes: [],
    clues: grantedClues,
    sharedClues: [],
    roomMembers: [{
      role_slot_id: playerRoleId,
      role_name: "小满",
      display_name: "浏览器玩家",
      online: true
    }],
    suspicions: [],
    testimonies: [],
    privateActions: [],
    voiceRooms: [],
    inventory: [],
    hostConfirm: null,
    currentGame: null,
    activeVotes: [],
    roleState: null,
    tasks: [],
    knowledge: {
      summary: {
        availableSections: 1,
        completedSections: 1,
        ownedClues: grantedClues.length,
        sharedClues: 0,
        investigations: 0,
        notes: 0
      }
    },
    currentState: browserPlayerCurrentState(room)
  };
}

const world = {
  id: worldId,
  name: "浏览器验收剧本",
  summary: "只存在于本机进程内的隔离验收数据",
  status: "testing",
  membership_role: "owner",
  content_revision: 8,
  settings: {
    tabletopMapDesign: fixtureTabletopMapDesign,
    creativeConstitution: {
      version: 1,
      theme: "错误时间顺序如何制造偏见",
      intendedEmotion: "玩家从确信转为愧疚，并重新理解每个人的沉默。",
      experiencePromise: "玩家在最后三十分钟逐步意识到，他们一直在用错误的时间顺序理解案件。",
      revealEmotion: "不是单纯震惊，而是对自己早先判断产生迟来的愧疚。",
      inviolablePrinciples: [
        "真相揭晓前至少出现三条可验证证据。",
        "不能依靠失忆、双胞胎或未登场人物完成反转。"
      ],
      fairPuzzlePromises: ["案发时间必须能由游戏内物证推出。"],
      pacingPrinciples: ["第二幕不新增世界观，只加速旧线索碰撞。"],
      voicePrinciples: ["角色本避免全知视角和作者式结论。"],
      forbiddenTropes: ["失忆", "双胞胎", "未登场人物完成反转"],
      supernatural: {
        policy: "forbidden",
        rules: "可以出现无法解释的感知，但不能用超自然力量改变物证。"
      },
      desiredDebates: "隐瞒真相是否必然等于背叛。",
      avoidMisunderstandings: "沉默不等于有罪，情感选择也不能替代物证。",
      roleHighlights: {
        "role-1": "只有侦探能决定是否公开停摆时钟，并承担误导全场的后果。",
        "role-2": "记者必须决定是否公开被篡改的采访记录。",
        "role-3": "医生能用专业判断推翻错误死亡时间。",
        "role-4": "继承人决定是否承认自己隐瞒了停电原因。"
      },
      fairness: { minimumEvidence: 3, requireIndependentPaths: true }
    }
  }
};

const rules = [];
const workspacePreview = {
  world,
  chapters: [
    { id: "chapter-1", title: "停摆", sequence: 1 },
    { id: "chapter-2", title: "错序", sequence: 2 },
    { id: "chapter-3", title: "迟到的二十二点十五分", sequence: 3 }
  ],
  roles: [
    { id: "role-1", name: "侦探", sequence: 1 },
    { id: "role-2", name: "记者", sequence: 2 },
    { id: "role-3", name: "医生", sequence: 3 },
    { id: "role-4", name: "继承人", sequence: 4 }
  ],
  sections: [
    { id: "section-1", role_slot_id: "role-1", chapter_id: "chapter-1", title: "停摆时钟", sequence: 1, publication_status: "testing" },
    { id: "section-2", role_slot_id: "role-2", chapter_id: "chapter-1", title: "被改过的采访记录", sequence: 1, publication_status: "testing" },
    { id: "section-3", role_slot_id: "role-3", chapter_id: "chapter-1", title: "尸温证词", sequence: 1, publication_status: "testing" },
    { id: "section-4", role_slot_id: "role-4", chapter_id: "chapter-1", title: "停电前的争执", sequence: 1, publication_status: "testing" }
  ],
  scenes: [
    { id: "scene-1", name: "大厅" },
    { id: "scene-2", name: "钟表室" },
    { id: "scene-3", name: "档案室" }
  ],
  clues: [{
    id: "clue-1",
    name: "信件",
    public_text: "一封被雨水打湿的匿名信。",
    host_text: "用于引出第一幕的失踪线索。",
    visibility: "role",
    clue_kind: "general",
    metadata: { clueType: "text", grantMode: "auto", importance: "normal" }
  }, {
    id: "clue-2",
    name: "采访记录",
    public_text: "日期栏存在二次覆盖的压痕。",
    host_text: "与停摆时钟共同证明时间顺序被重排。",
    visibility: "role",
    role_slot_id: "role-2",
    clue_kind: "general",
    metadata: { clueType: "text", grantMode: "manual", importance: "key" }
  }, {
    id: "clue-3",
    name: "尸温记录",
    public_text: "记录显示死亡早于停电。",
    host_text: "用于排除停电即案发的直觉判断。",
    visibility: "role",
    role_slot_id: "role-3",
    clue_kind: "general",
    metadata: { clueType: "text", grantMode: "manual", importance: "key" }
  }],
  items: [],
  investigationPoints: [{ id: "point-1", name: "检查停摆时钟", scene_id: "scene-2" }],
  edges: [],
  segments: fixtureSegments,
  rooms
};

const dashboard = {
  counts: { chapters: 3, roles: 4, sections: 4, scenes: 3, clues: 3, rooms: rooms.length },
  checks: [],
  readiness: { label: "可内测", productionPercent: 72 },
  production: []
};

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers
  });
  response.end(JSON.stringify(payload));
}

function revisionHeaders() {
  return { "x-world-revision": String(world.content_revision) };
}

function bumpRevision(payload = {}) {
  world.content_revision += 1;
  return { ...payload, content_revision: world.content_revision };
}

const sseClients = new Set();
let roomEventCursor = 12;

function broadcastRoomEvent(roomId, payload) {
  roomEventCursor += 1;
  const message = `id: ${roomEventCursor}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    if (client.roomId === roomId && !client.response.destroyed) {
      client.response.write(message);
    }
  }
}

function sendSse(request, response, roomId) {
  const resumeCursor = Number(request.headers["last-event-id"]);
  if (Number.isSafeInteger(resumeCursor) && resumeCursor > roomEventCursor) {
    roomEventCursor = resumeCursor;
  }
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive"
  });
  response.socket?.setNoDelay(true);
  response.flushHeaders();
  response.write(`data: ${JSON.stringify({ type: "connected", fixture: true })}\n\n`);
  const client = { roomId, response };
  sseClients.add(client);
  const heartbeat = setInterval(() => {
    response.write(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`);
  }, 15_000);
  response.once("close", () => {
    sseClients.delete(client);
    clearInterval(heartbeat);
  });
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function buildFixturePlaytestReport(body = {}) {
  const profiles = Array.isArray(body.profiles) ? body.profiles.slice(0, 8) : [];
  const players = profiles.map((profile, index) => {
    const role = workspacePreview.roles.find((item) => item.id === profile.roleSlotId) || workspacePreview.roles[index % workspacePreview.roles.length];
    const archetype = AI_PLAYER_ARCHETYPES[profile.archetype] || AI_PLAYER_ARCHETYPES.logical;
    const isSilent = profile.archetype === "silent";
    const isDominant = profile.archetype === "dominant";
    const isSkimmer = profile.archetype === "skimmer";
    return {
      seatId: profile.seatId || `seat-${index + 1}`,
      role: { type: "role", id: role.id, label: role.name },
      archetype: profile.archetype,
      archetypeLabel: archetype.label,
      objectiveUnderstanding: index === 3
        ? "保护停电秘密，同时判断时钟是否被人为拨停。"
        : "确认 22:15 是否是真实案发时间，并找出记录被修改的原因。",
      timeline: [{
        stageId: "chapter-1",
        stageLabel: "停摆",
        belief: isSkimmer ? "停摆时钟直接等于案发时间。" : "22:15 是最强假设，但还需要独立物证。",
        confidence: isSkimmer ? 82 : 58,
        evidenceUsed: [{ type: "clue", id: "clue-1", label: "匿名信" }],
        evidenceIgnored: isSkimmer ? [{ type: "clue", id: "clue-2", label: "采访记录" }] : [],
        action: "检查钟表室并询问谁最后看见时钟正常走动。",
        communication: isSilent ? "记录在私人笔记中，没有主动分享。" : "把时钟假设公开给全桌。",
        confusion: "",
        hostHelp: false
      }, {
        stageId: "chapter-2",
        stageLabel: "错序",
        belief: isSilent ? "采访记录可能被改过，但不确定能否公开。" : "停电与死亡不是同一时间点。",
        confidence: isSilent ? 64 : 76,
        evidenceUsed: [{ type: "clue", id: "clue-2", label: "采访记录" }],
        evidenceIgnored: [],
        action: isSilent ? "继续观察其他人，没有发起交换。" : "要求医生用尸温记录核验时间。",
        communication: isSilent ? "关键信息仍未共享。" : "把采访记录和尸温记录拼合。",
        confusion: isSilent ? "不知道公开私人记录会不会破坏角色目标。" : "",
        hostHelp: isSilent
      }, {
        stageId: "chapter-3",
        stageLabel: "迟到的二十二点十五分",
        belief: "大家一直按错误顺序理解停电、死亡和时钟停摆。",
        confidence: isDominant ? 94 : 88,
        evidenceUsed: [
          { type: "clue", id: "clue-2", label: "采访记录" },
          { type: "clue", id: "clue-3", label: "尸温记录" }
        ],
        evidenceIgnored: [],
        action: "重建三条时间记录并公开最终顺序。",
        communication: "全桌形成共识。",
        confusion: "",
        hostHelp: false
      }],
      finalBelief: "死亡早于停电，时钟在事后被拨停到 22:15。",
      truthConfidence: isSilent ? 82 : 91,
      stalledAt: isSilent ? "错序" : "",
      earlySolve: isDominant,
      hostInterventions: isSilent ? 1 : 0,
      highlight: `${role.name}用自己的专属信息改变了全桌判断。`,
      frustration: isSilent ? "缺少不破坏私人目标的分享理由。" : "第二幕缺少可立即执行的新行动。",
      missedRefs: isSkimmer ? [{ type: "clue", id: "clue-2", label: "采访记录" }] : []
    };
  });
  return {
    version: 1,
    promptVersion: "multi-agent-playtest-v1",
    generatedAt: new Date().toISOString(),
    depth: body.depth === "deep" ? "deep" : "quick",
    focus: String(body.focus || ""),
    constitutionConfigured: true,
    headline: "时间错序能够被推回，但沉默玩家仍可能让第二幕失速",
    summary: "四类玩家最终都能重建时间线。沉默型席位在公开采访记录前明显卡住，抢话型席位则可能过早把时钟假设定为全桌共识。",
    score: 78,
    truthSolved: true,
    consensusStage: "迟到的二十二点十五分",
    hostInterventions: players.reduce((sum, player) => sum + player.hostInterventions, 0),
    metrics: {
      clarity: 84,
      fairness: 81,
      agency: 73,
      pacing: 68,
      communication: 62,
      intentAlignment: 88
    },
    groupTimeline: [{
      stageId: "chapter-1",
      stageLabel: "停摆",
      consensus: "大多数人把 22:15 当作案发时间。",
      split: "逻辑型保留假设，跳读型直接定案。",
      momentum: "显眼的停摆时钟快速建立共同议题。"
    }, {
      stageId: "chapter-2",
      stageLabel: "错序",
      consensus: "采访记录可能被修改，但尚未确认修改目的。",
      split: "沉默型持有压痕信息却没有分享。",
      momentum: "全桌首次停滞，需要一次主持追问。"
    }, {
      stageId: "chapter-3",
      stageLabel: "迟到的二十二点十五分",
      consensus: "停电、死亡和拨停时钟的顺序被故意重排。",
      split: "对隐瞒真相是否等于背叛仍有价值判断分歧。",
      momentum: "采访记录与尸温记录拼合后完成反转。"
    }],
    players,
    issues: [{
      id: "playtest-issue-1",
      severity: "danger",
      category: "communication",
      title: "沉默型玩家不分享时，第二幕出现交流单点",
      detail: "持有采访记录的席位没有明确的角色内分享理由，其他玩家无法独立验证时钟。",
      recommendation: "增加一个无需公开私人动机的日期核验入口，或给记者一个必须交换记录的行动目标。",
      refs: [
        { type: "clue", id: "clue-2", label: "采访记录" },
        { type: "script_section", id: "section-2", label: "被改过的采访记录" }
      ],
      seatIds: players.filter((player) => player.archetype === "silent").map((player) => player.seatId)
    }, {
      id: "playtest-issue-2",
      severity: "warning",
      category: "pacing",
      title: "第二幕完成核验后缺少立即可执行动作",
      detail: "非社交型玩家在等待他人共享尸温记录期间会产生一段空转。",
      recommendation: "在钟表室加入可并行完成的机械检查，让等待者仍有推进动作。",
      refs: [
        { type: "chapter", id: "chapter-2", label: "错序" },
        { type: "investigation_point", id: "point-1", label: "检查停摆时钟" }
      ],
      seatIds: players.map((player) => player.seatId)
    }, {
      id: "playtest-issue-3",
      severity: "info",
      category: "intent",
      title: "目标情绪在最终拼合后成立",
      detail: "玩家先确信 22:15，再因自己早先的判断产生迟来的愧疚，符合创作宪法。",
      recommendation: "保留终局前由玩家亲手重排三条记录的动作。",
      refs: [{ type: "chapter", id: "chapter-3", label: "迟到的二十二点十五分" }],
      seatIds: players.map((player) => player.seatId)
    }],
    constitutionChecks: [{
      principle: "真相揭晓前至少出现三条可验证证据。",
      status: "pass",
      evidence: "匿名信、采访记录与尸温记录在终局前均已被读取。"
    }, {
      principle: "玩家在最后三十分钟意识到自己使用了错误时间顺序。",
      status: "pass",
      evidence: "所有席位都在第三阶段重新排列了停电、死亡和拨钟顺序。"
    }, {
      principle: "每个角色都拥有不可替代的高光。",
      status: "risk",
      evidence: "继承人承担了选择，但医生的高光仍主要是提供信息。"
    }],
    missedClues: [{
      ref: { type: "clue", id: "clue-2", label: "采访记录" },
      seatIds: players.filter((player) => player.archetype === "skimmer").map((player) => player.seatId),
      reason: "跳读型玩家忽略了日期栏的二次覆盖压痕。"
    }],
    inactiveRoles: [{
      ref: { type: "role", id: "role-3", label: "医生" },
      seatIds: [],
      reason: "第二幕后半段主要等待他人提出核验请求。"
    }],
    dominantRoles: [],
    summaryCounts: {
      players: players.length,
      danger: 1,
      warning: 1,
      earlySolves: players.filter((player) => player.earlySolve).length,
      stalledPlayers: players.filter((player) => player.stalledAt).length
    },
    limitations: [
      "AI 试跑用于压力测试理解与交互路径，不能替代真实玩家的情绪、社交关系和现场行为。",
      "浏览器验收报告使用固定模型响应，只验证完整产品交互与呈现。"
    ]
  };
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${host}:${port}`);
  const path = url.pathname;

  if (request.method === "GET" && path === "/api/health") {
    return sendJson(response, 200, { ok: true, fixture: true });
  }
  if (request.method === "GET" && path === "/api/auth/config") {
    return sendJson(response, 200, verificationAuthFixture
      ? {
          requireAuth: true,
          demoMode: false,
          requireEmailVerification: true,
          email: { configured: true, provider: "fixture" },
          oauth: []
        }
        : { requireAuth: false, demoMode: true, providers: [] });
  }
  if (verificationAuthFixture && request.method === "POST" && path === "/api/test/reset-verification") {
    verificationFixtureAuthenticated = false;
    return sendJson(response, 200, { ok: true });
  }
  if (request.method === "GET" && path === "/api/auth/me") {
    if (verificationAuthFixture && !verificationFixtureAuthenticated) {
      return sendJson(response, 401, { code: "AUTH_REQUIRED", error: "Authentication required" });
    }
    return sendJson(response, 200, {
      id: fixtureUserId,
      email: "browser-fixture@getzhimu.local",
      display_name: "浏览器验收",
      email_verified_at: "2026-07-23T00:00:00.000Z"
    });
  }
  if (request.method === "GET" && path === "/api/account/portal-profiles") {
    return sendJson(response, 200, { profiles: Object.values(portalProfiles) });
  }
  const portalProfileMatch = path.match(/^\/api\/account\/portal-profiles\/(creator|host|player)$/);
  if (request.method === "GET" && portalProfileMatch) {
    return sendJson(response, 200, portalProfiles[portalProfileMatch[1]]);
  }
  const portalAvailabilityMatch = path.match(
    /^\/api\/account\/portal-profiles\/(creator|host|player)\/name-availability$/
  );
  if (request.method === "GET" && portalAvailabilityMatch) {
    const displayName = String(url.searchParams.get("displayName") || "").trim();
    return sendJson(response, 200, {
      displayName,
      available: displayName !== "已占用昵称",
      currentUserOwnsName: displayName === portalProfiles[portalAvailabilityMatch[1]].displayName
    });
  }
  const portalNameMatch = path.match(
    /^\/api\/account\/portal-profiles\/(creator|host|player)\/name$/
  );
  if (request.method === "PUT" && portalNameMatch) {
    const body = await readJson(request);
    const displayName = String(body.displayName || "").trim();
    if (displayName === "已占用昵称") {
      return sendJson(response, 409, {
        code: "PORTAL_PROFILE_NAME_TAKEN",
        error: "该端昵称已被使用"
      });
    }
    const profile = portalProfiles[portalNameMatch[1]];
    const changedAt = new Date().toISOString();
    profile.displayName = displayName;
    profile.nameChangedAt = changedAt;
    profile.nextNameChangeAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    profile.canChangeName = false;
    return sendJson(response, 200, profile);
  }
  const portalAvatarDeleteMatch = path.match(
    /^\/api\/account\/portal-profiles\/(creator|host|player)\/avatar$/
  );
  if (request.method === "DELETE" && portalAvatarDeleteMatch) {
    const profile = portalProfiles[portalAvatarDeleteMatch[1]];
    profile.avatarUrl = null;
    profile.hasCustomAvatar = false;
    profile.avatarUpdatedAt = new Date().toISOString();
    return sendJson(response, 200, profile);
  }
  if (verificationAuthFixture && request.method === "POST" && path === "/api/auth/register") {
    const body = await readJson(request);
    return sendJson(response, 201, {
      user: {
        id: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
        email: String(body.email || "browser-fixture@example.invalid"),
        display_name: String(body.displayName || "浏览器验收"),
        emailVerified: false
      },
      pendingEmailVerification: true,
      verificationEmailSent: true,
      verificationChallenge: {
        id: verificationChallengeId,
        maskedEmail: "br*************@example.invalid",
        codeLength: 6,
        expiresInSeconds: 600,
        resendAfterSeconds: 0
      }
    });
  }
  if (verificationAuthFixture && request.method === "POST" && path === "/api/auth/login") {
    const body = await readJson(request);
    return sendJson(response, 200, {
      token: "browser-fixture-pending-token",
      user: {
        id: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
        email: String(body.email || "browser-fixture@example.invalid"),
        display_name: "浏览器验收",
        emailVerified: false
      },
      pendingEmailVerification: true,
      verificationChallenge: {
        id: verificationChallengeId,
        maskedEmail: "br*************@example.invalid",
        codeLength: 6,
        expiresInSeconds: 600,
        resendAfterSeconds: 0
      }
    });
  }
  if (verificationAuthFixture && request.method === "POST" && path === "/api/auth/verify-email") {
    const body = await readJson(request);
    if (body.token !== "fixture-link-token") {
      return sendJson(response, 400, {
        code: "EMAIL_VERIFICATION_INVALID",
        error: "Email verification link is invalid or expired"
      });
    }
    verificationFixtureAuthenticated = true;
    return sendJson(response, 200, {
      token: "browser-fixture-link-token",
      user: {
        id: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
        email: "browser-fixture@example.invalid",
        display_name: "浏览器验收",
        emailVerified: true
      },
      acceptedInvites: []
    });
  }
  if (verificationAuthFixture && request.method === "POST" && path === "/api/auth/verify-email-code") {
    const body = await readJson(request);
    if (body.challengeId !== verificationChallengeId || body.code !== "246810") {
      return sendJson(response, 400, {
        code: "EMAIL_VERIFICATION_CODE_INVALID",
        error: "Email verification code is invalid or expired"
      });
    }
    verificationFixtureAuthenticated = true;
    return sendJson(response, 200, {
      token: "browser-fixture-verified-token",
      user: {
        id: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
        email: "browser-fixture@example.invalid",
        display_name: "浏览器验收",
        emailVerified: true
      },
      acceptedInvites: []
    });
  }
  if (verificationAuthFixture && request.method === "POST" && path === "/api/auth/resend-verification-code") {
    return sendJson(response, 200, {
      ok: true,
      verificationChallenge: {
        id: verificationChallengeId,
        maskedEmail: "br*************@example.invalid",
        codeLength: 6,
        expiresInSeconds: 600,
        resendAfterSeconds: 60
      }
    });
  }
  if (request.method === "POST" && path === "/api/auth/guest") {
    const body = await readJson(request);
    return sendJson(response, 200, {
      token: "browser-fixture-token",
      user: {
        id: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
        email: null,
        display_name: String(body.displayName || "浏览器验收"),
        user_kind: "guest",
        email_verified_at: null
      }
    });
  }
  if (request.method === "GET" && path === "/api/platform/site") {
    return sendJson(response, 200, { officialExample: { configured: false } });
  }
  if (request.method === "GET" && path === "/api/platform/public-rooms") {
    return sendJson(response, 200, { total: 0, items: [] });
  }
  if (request.method === "GET" && path === "/api/ops/status") {
    return sendJson(response, 200, {
      ok: true,
      ready: true,
      nodeEnv: "fixture",
      uptimeSeconds: 120,
      features: {
        email: { configured: true },
        oauth: { enabledProviders: ["google"] },
        stripe: { configured: false },
        uploadScan: { enabled: true },
        telemetry: { enabled: true },
        alerts: { configured: true },
        roomEventsBus: "memory"
      },
      productionTrust: { passed: 7, total: 7, ready: true, gates: [] }
    });
  }
  if (request.method === "GET" && path === "/api/ops/plan-upgrade/requests") {
    return sendJson(response, 200, { items: [], total: 0, limit: 20, offset: 0 });
  }
  if (request.method === "GET" && path === "/api/ops/audit-log") {
    return sendJson(response, 200, { items: [], total: 0, limit: 50, offset: 0 });
  }
  if (request.method === "GET" && path === "/api/ops/feedback") {
    return sendJson(response, 200, { items: [], total: 0, limit: 20, offset: 0 });
  }
  if (request.method === "GET" && path === "/api/ops/feedback/stats") {
    return sendJson(response, 200, []);
  }
  if (request.method === "GET" && path === "/api/ops/users") {
    const search = String(url.searchParams.get("search") || "").trim().toLowerCase();
    const verification = url.searchParams.get("verification") || "all";
    const items = opsFixtureUsers.filter((user) => {
      const matchesSearch = !search
        || user.email.toLowerCase().includes(search)
        || user.displayName.toLowerCase().includes(search);
      const matchesVerification = verification === "all"
        || user.verificationStatus === verification;
      return matchesSearch && matchesVerification;
    });
    return sendJson(response, 200, { items, total: items.length, limit: 20, offset: 0 });
  }
  const opsDeletePreviewMatch = path.match(/^\/api\/ops\/users\/([0-9a-f-]+)\/delete-preview$/i);
  if (request.method === "GET" && opsDeletePreviewMatch) {
    const target = opsFixtureUsers.find((user) => user.id === opsDeletePreviewMatch[1]);
    if (!target) return sendJson(response, 404, { code: "USER_NOT_FOUND", error: "User not found" });
    return sendJson(response, 200, {
      target,
      canResetRegistration: !target.emailVerified,
      canDeleteAccount: true,
      deletion: {
        canDelete: true,
        blockers: [],
        summary: {
          ownedWorlds: [],
          collaboratorWorlds: 0,
          hostedRooms: 0,
          assetCount: 0,
          assetBytes: 0
        }
      }
    });
  }
  const opsResendMatch = path.match(/^\/api\/ops\/users\/([0-9a-f-]+)\/resend-verification$/i);
  if (request.method === "POST" && opsResendMatch) {
    const target = opsFixtureUsers.find((user) => user.id === opsResendMatch[1]);
    if (!target) return sendJson(response, 404, { code: "USER_NOT_FOUND", error: "User not found" });
    target.verificationLastSentAt = new Date().toISOString();
    target.hasActiveVerification = true;
    return sendJson(response, 200, { ok: true, verificationRequired: true, auditRecorded: true });
  }
  const opsDeleteMatch = path.match(/^\/api\/ops\/users\/([0-9a-f-]+)\/delete$/i);
  if (request.method === "POST" && opsDeleteMatch) {
    const body = await readJson(request);
    const target = opsFixtureUsers.find((user) => user.id === opsDeleteMatch[1]);
    if (!target) return sendJson(response, 404, { code: "USER_NOT_FOUND", error: "User not found" });
    if (!body.acknowledged || body.confirmationEmail !== target.email) {
      return sendJson(response, 400, {
        code: "ACCOUNT_DELETE_CONFIRMATION_INVALID",
        error: "Confirmation email does not match the target account"
      });
    }
    opsFixtureUsers = opsFixtureUsers.filter((user) => user.id !== target.id);
    return sendJson(response, 200, {
      ok: true,
      mode: body.mode,
      deletedAt: new Date().toISOString(),
      storagePending: false,
      auditRecorded: true
    });
  }
  if (request.method === "GET" && path === "/api/platform/events/stream") {
    return sendSse(request, response);
  }
  if (request.method === "GET" && path === "/api/auth/sessions") {
    return sendJson(response, 200, { sessions: [] });
  }
  if (request.method === "GET" && path === "/api/account/entitlements") {
    return sendJson(response, 200, {
      usage: {
        planCode: "internal_beta",
        planLabel: "内测版",
        planDescription: "内测期间基础创作功能已开通。",
        isInternalBeta: true,
        usedBytes: 0,
        maxBytes: 1073741824,
        remainingBytes: 1073741824,
        storagePercent: 0,
        usedWorlds: 0,
        maxWorlds: 10,
        remainingWorlds: 10,
        worldsPercent: 0,
        maxSingleFileBytes: 52428800
      },
      publicPlans: [],
      upgrade: null,
      pricing: { mode: "internal_beta" },
      credits: null
    });
  }
  if (request.method === "GET" && path === "/api/account/llm") {
    return sendJson(response, 200, {
      encryptionReady: true,
      presets: {
        deepseek: {
          label: "DeepSeek",
          baseUrl: "https://api.deepseek.com",
          defaultModel: "deepseek-v4-flash",
          models: ["deepseek-v4-flash", "deepseek-v4-pro"]
        },
        openai: {
          label: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          defaultModel: "gpt-4o-mini",
          models: ["gpt-4o-mini", "gpt-4o"]
        },
        openrouter: {
          label: "OpenRouter",
          baseUrl: "https://openrouter.ai/api/v1",
          defaultModel: "~openai/gpt-latest",
          models: ["~openai/gpt-latest"]
        },
        qwen: {
          label: "阿里云百炼（Qwen）",
          baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
          defaultModel: "qwen-plus",
          models: ["qwen-plus", "qwen3.7-plus"]
        },
        zhipu: {
          label: "智谱开放平台（GLM）",
          baseUrl: "https://open.bigmodel.cn/api/paas/v4",
          defaultModel: "glm-5.2",
          models: ["glm-5.2"]
        },
        siliconflow: {
          label: "硅基流动",
          baseUrl: "https://api.siliconflow.cn/v1",
          defaultModel: "deepseek-ai/DeepSeek-V3.2",
          models: ["deepseek-ai/DeepSeek-V3.2"]
        },
        openai_compatible: {
          label: "自定义 OpenAI 兼容接口",
          baseUrl: "https://api.openai.com/v1",
          defaultModel: "",
          models: []
        }
      },
      preferences: { routingMode: "own_only", updatedAt: null },
      connections: [],
      activeConnectionId: null,
      platform: {
        available: false,
        model: null,
        note: "平台 AI 池暂不面向用户开放；创作调用只使用您保存的 API。"
      }
    });
  }
  if (request.method === "GET" && path === "/api/worlds") {
    return sendJson(response, 200, emptyAccountFixture ? [] : [world]);
  }
  if (request.method === "GET" && path === "/api/worlds/catalog") {
    return sendJson(response, 200, []);
  }
  if (request.method === "GET" && path === `/api/worlds/${worldId}/creator-bootstrap`) {
    return sendJson(response, 200, {
      dashboard,
      workspacePreview,
      bibleSummary: null,
      segments: [],
      truthClaims: [],
      roleRelationships: []
    }, { "x-world-revision": "8" });
  }
  if (request.method === "GET" && path === `/api/worlds/${worldId}/studio`) {
    return sendJson(response, 200, workspacePreview, { "x-world-revision": "8" });
  }
  if (request.method === "GET" && path === `/api/worlds/${worldId}/story-assistant/deepseek/status`) {
    return sendJson(response, 200, {
      configured: false,
      source: "none",
      model: null,
      connectionName: null,
      routingMode: "own_only",
      platformAvailable: false
    });
  }
  if (request.method === "GET" && path === `/api/worlds/${worldId}/quality-reports`) {
    return sendJson(response, 200, { reports: qualityReports });
  }
  if (request.method === "POST" && path === `/api/worlds/${worldId}/story-assistant/ai-playtest/run`) {
    try {
      const body = await readJson(request);
      if (!Array.isArray(body.profiles) || body.profiles.length < 2) {
        return sendJson(response, 422, { code: "VALIDATION_ERROR", error: "至少需要两个测试席位" });
      }
      const playtest = buildFixturePlaytestReport(body);
      qualityReportSequence += 1;
      const stored = {
        id: `77777777-7777-4777-8777-${String(qualityReportSequence).padStart(12, "0")}`,
        worldId,
        source: "playtest",
        promptVersion: "multi-agent-playtest-v1",
        report: playtest,
        issueCount: playtest.issues.length,
        score: playtest.score,
        createdAt: playtest.generatedAt
      };
      qualityReports.unshift(stored);
      const payload = bumpRevision({ report: stored });
      return sendJson(response, 201, payload, revisionHeaders());
    } catch (error) {
      return sendJson(response, 400, { code: "VALIDATION_ERROR", error: error.message });
    }
  }
  if (request.method === "GET" && path === `/api/worlds/${worldId}/story-diagnostics`) {
    const diagnosticStandard = url.searchParams.get("standard") || "classic";
    const diagnosticStandardLabel = {
      classic: "本格公平",
      emotional: "情感还原",
      mechanism: "机制推理",
      narrative: "叙事诡计",
      open: "开放调查",
      sandbox: "跑团沙盒"
    }[diagnosticStandard] || "本格公平";
    const rawConstitution = world.settings?.creativeConstitution;
    const constitution = normalizeCreativeConstitution(rawConstitution);
    const constitutionConfigured = !isCreativeConstitutionEmpty(rawConstitution);
    const constitutionCoverage = creativeConstitutionCoverage(rawConstitution, workspacePreview.roles);
    const defaultMinEvidence = ["classic", "mechanism", "narrative"].includes(diagnosticStandard) ? 2 : 1;
    const minimumEvidence = constitutionConfigured
      ? constitution.fairness.minimumEvidence
      : defaultMinEvidence;
    const intentIssues = constitutionConfigured
      ? []
      : [{
          id: "intent.no_constitution",
          category: "intent",
          severity: "warning",
          title: "尚未建立创作宪法",
          detail: "当前诊断只能套用通用类型标准。",
          rationale: "",
          recommendation: "写明体验承诺与不可破坏原则。",
          refs: [{ type: "constitution", id: "creative-constitution", label: "创作宪法" }],
          path: []
        }];
    const fixtureIssues = [...intentIssues, {
      id: "information.single_point_clue",
      category: "information",
      severity: "warning",
      title: "关键线索只有一个显式获得入口",
      detail: "如果玩家错过这封信，后续推理可能失去支点。",
      rationale: "",
      recommendation: "增加一个独立的补偿获得路径。",
      refs: [{
        type: "clue",
        id: workspacePreview.clues[0].id,
        label: workspacePreview.clues[0].name
      }],
      path: []
    }];
    return sendJson(response, 200, {
      worldId,
      generatedAt: new Date().toISOString(),
      version: 2,
      standard: {
        id: diagnosticStandard,
        label: diagnosticStandardLabel,
        description: "浏览器验收结构诊断",
        minEvidence: minimumEvidence,
        defaultMinEvidence,
        constitutionOverride: constitutionConfigured && minimumEvidence !== defaultMinEvidence
      },
      scope: { events: 1, eventType: "scene", roles: 1, clues: 1, truthClaims: 0, authoredEdges: 0, rules: 0 },
      scores: {
        causal: 64,
        information: 48,
        fairness: 0,
        intent: constitutionCoverage.score,
        overall: constitutionConfigured ? 58 : 37
      },
      status: "review",
      summary: {
        danger: 0,
        warning: fixtureIssues.length,
        info: 0,
        issueCount: fixtureIssues.length,
        headline: constitutionConfigured ? "线索获得路径仍需加固" : "先建立创作宪法，再校准结构"
      },
      issues: fixtureIssues,
      constitution: {
        configured: constitutionConfigured,
        score: constitutionCoverage.score,
        filled: constitutionCoverage.filled,
        total: constitutionCoverage.total,
        missing: constitutionCoverage.missing,
        roleHighlights: constitutionCoverage.roles,
        theme: constitution.theme,
        experiencePromise: constitution.experiencePromise,
        inviolableCount: constitution.inviolablePrinciples.length,
        forbiddenTropesCount: constitution.forbiddenTropes.length,
        minimumEvidence,
        requireIndependentPaths: constitution.fairness.requireIndependentPaths
      },
      causal: { eventType: "scene", events: [], chains: [], orphanEvents: [], removableCandidates: [] },
      information: {
        knowledgeTimelines: [],
        informationIslands: [],
        communicationNeeds: [],
        singlePointClues: [],
        unreachableClues: [],
        earlyLeaks: []
      },
      fairness: {
        claims: [],
        minimumEvidence,
        supportedClaims: 0,
        weakClaims: 0,
        keyClues: 0,
        keyCluesUsedAsEvidence: 0
      },
      limitations: ["浏览器验收数据只验证诊断页面渲染。"]
    });
  }
  if (request.method === "GET" && path === `/api/worlds/${worldId}/rooms`) {
    return sendJson(response, 200, rooms);
  }
  if (request.method === "GET" && path === `/api/worlds/${worldId}/releases`) {
    return sendJson(response, 200, releases);
  }
  if (request.method === "POST" && path === `/api/worlds/${worldId}/releases`) {
    const body = await readJson(request);
    releaseSequence += 1;
    const createdAt = new Date().toISOString();
    const created = {
      ...release,
      id: `44444444-4444-4444-8444-${String(releaseSequence).padStart(12, "0")}`,
      releaseNumber: releaseSequence,
      label: String(body.label || `浏览器验收 R${releaseSequence}`),
      sourceRevision: world.content_revision,
      contentSummary: {
        ...release.contentSummary,
        hasMechanismPackage: Boolean(world.settings?.mechanismDesign?.status === "confirmed")
      },
      createdAt
    };
    releases.unshift(created);
    return sendJson(response, 201, created, revisionHeaders());
  }
  if (request.method === "GET" && path === `/api/worlds/${worldId}/rules`) {
    return sendJson(response, 200, rules);
  }
  if (request.method === "GET" && path === `/api/worlds/${worldId}/segments`) {
    return sendJson(response, 200, { segments: fixtureSegments });
  }
  if (request.method === "GET" && path === `/api/worlds/${worldId}/logs`) {
    return sendJson(response, 200, []);
  }
  const roomSettingsMatch = path.match(/^\/api\/rooms\/([^/]+)\/settings$/);
  if (request.method === "PATCH" && roomSettingsMatch) {
    const room = rooms.find((item) => item.id === roomSettingsMatch[1]);
    if (!room) return sendJson(response, 404, { code: "ROOM_NOT_FOUND", error: "Room not found" });
    const body = await readJson(request);
    const incomingSettings = body.settings || {};
    const incomingPresentation = incomingSettings.runtimePresentation;
    room.settings = {
      ...(room.settings || {}),
      ...incomingSettings,
      ...(incomingPresentation ? {
        runtimePresentation: {
          ...(room.settings?.runtimePresentation || {}),
          ...incomingPresentation
        }
      } : {})
    };
    const presentation = room.settings.runtimePresentation || {};
    broadcastRoomEvent(room.id, {
      type: "room.presentation_updated",
      activeSegmentKey: presentation.activeSegmentKey || "",
      activeLocationId: presentation.activeLocationId || "",
      revealedLocationIds: presentation.revealedLocationIds || [],
      mapVisible: Boolean(presentation.mapVisible),
      checkStatus: presentation.activeCheck?.status || "cleared",
      checkLabel: presentation.activeCheck?.label || "",
      encounterStatus: presentation.activeEncounter?.status || "cleared",
      encounterLocationId: presentation.activeEncounter?.locationId || "",
      updatedAt: presentation.updatedAt || new Date().toISOString()
    });
    return sendJson(response, 200, { ok: true, settings: room.settings });
  }
  const roomPathMatch = path.match(/^\/api\/rooms\/([^/]+)(\/.*)$/);
  if (request.method === "GET" && roomPathMatch && roomPathMatch[1] !== "invite") {
    const [, requestedRoomId, suffix] = roomPathMatch;
    const room = rooms.find((item) => item.id === requestedRoomId);
    if (!room) return sendJson(response, 404, { code: "ROOM_NOT_FOUND", error: "Room not found" });
    if (suffix === "/events/stream") return sendSse(request, response, room.id);
    if (suffix === "/runtime-content") {
      return sendJson(response, 200, {
        room: { id: room.id, worldId, name: room.name, status: room.status },
        contentBinding: room.contentBinding,
        content: { ...workspacePreview, segments: fixtureSegments }
      });
    }
    if (suffix === "/player-home/core") return sendJson(response, 200, browserPlayerHomeCore(room));
    if (suffix === "/player-home/social") return sendJson(response, 200, browserPlayerHomeSocial(room));
    if (suffix === "/current-state") return sendJson(response, 200, browserPlayerCurrentState(room));
    if (suffix === "/host/current-state") return sendJson(response, 200, browserHostCurrentState(room));
    if (suffix === "/exploration") {
      return sendJson(response, 200, {
        scenes: [{
          id: "88888888-8888-4888-8888-555555550001",
          name: "联盟隔离服务器",
          public_text: "数字孪生对局已完成，授权记录仍在等待复核。",
          investigation_points: []
        }]
      });
    }
    if (suffix === "/host/players") return sendJson(response, 200, { players: [], stuckCount: 0 });
    if (suffix === "/host-events") return sendJson(response, 200, []);
    if (suffix === "/host/clue-matrix") {
      return sendJson(response, 200, { roles: [], clues: [], cells: [] });
    }
    if (suffix === "/host/audit-log") return sendJson(response, 200, { entries: [] });
    if (suffix === "/host/testimonies") return sendJson(response, 200, { items: [] });
    if (suffix === "/host/segment-remedies") return sendJson(response, 200, { items: [] });
    if (suffix === "/host/votes") return sendJson(response, 200, { votes: [] });
    if (suffix === "/host/private-actions") return sendJson(response, 200, { actions: [] });
    if (suffix === "/host/mini-games") return sendJson(response, 200, { games: [] });
    if (suffix === "/host/mechanism-runtime") {
      return sendJson(response, 200, browserHostMechanismRuntime(room));
    }
  }
  if (request.method === "GET" && path.startsWith("/api/rooms/invite/")) {
    const code = decodeURIComponent(path.slice("/api/rooms/invite/".length));
    const room = rooms.find((item) => item.invite_code === code);
    if (!room) return sendJson(response, 404, { code: "ROOM_NOT_FOUND", error: "Room not found" });
    return sendJson(response, 200, {
      room: {
        id: room.id,
        name: room.name,
        status: room.status,
        contentBinding: room.contentBinding
      },
      world: { id: worldId, name: world.name },
      current_role_slot_id: null,
      roles: [{
        id: playerRoleId,
        name: "侦探",
        public_profile: "负责梳理现场证据",
        occupied: false,
        occupied_by_current: false
      }]
    });
  }
  if (request.method === "POST" && path === "/api/rooms/join") {
    const body = await readJson(request);
    const room = rooms.find((item) => item.invite_code === body.inviteCode);
    if (!room || body.roleSlotId !== playerRoleId) {
      return sendJson(response, 404, { code: "ROOM_NOT_FOUND", error: "Room or role not found" });
    }
    return sendJson(response, 200, {
      roomId: room.id,
      roleSlotId: playerRoleId,
      contentBinding: room.contentBinding
    });
  }
  if (request.method === "POST" && path === `/api/worlds/${worldId}/rooms`) {
    try {
      const body = await readJson(request);
      const selectedReleaseId = body.releaseId || null;
      if (selectedReleaseId && !releases.some((item) => item.id === selectedReleaseId)) {
        return sendJson(response, 404, { code: "WORLD_RELEASE_NOT_FOUND", error: "Release not found" });
      }
      roomSequence += 1;
      const room = {
        id: `55555555-5555-4555-8555-${String(roomSequence).padStart(12, "0")}`,
        name: String(body.name || "浏览器验收房"),
        invite_code: `ROOM-QA-${String(roomSequence).padStart(4, "0")}`,
        status: "testing",
        public_listing: Boolean(body.publicListing),
        member_count: 0,
        role_slot_count: 4,
        is_mine: true,
        contentBinding: bindingFor(selectedReleaseId)
      };
      rooms.unshift(room);
      mechanismRuntimes.set(room.id, newFixtureMechanismRuntime());
      dashboard.counts.rooms = rooms.length;
      return sendJson(response, 201, room);
    } catch (error) {
      return sendJson(response, 400, { code: "VALIDATION_ERROR", error: error.message });
    }
  }
  const playerMechanismSubmissionMatch = path.match(
    /^\/api\/rooms\/([^/]+)\/player\/mechanism-decisions\/([^/]+)\/submissions$/
  );
  if (request.method === "POST" && playerMechanismSubmissionMatch) {
    const [, requestedRoomId, publicDecisionKey] = playerMechanismSubmissionMatch;
    const room = rooms.find((item) => item.id === requestedRoomId);
    if (!room) return sendJson(response, 404, { code: "ROOM_NOT_FOUND", error: "Room not found" });
    const runtime = mechanismRuntimeFor(room);
    const body = await readJson(request);
    if (!runtime.initialized) {
      return sendJson(response, 409, {
        code: "MECHANISM_RUNTIME_NOT_INITIALIZED",
        error: "Mechanism runtime is not initialized"
      });
    }
    if (Number(body.expectedRevision) !== runtime.revision) {
      return sendJson(response, 409, {
        code: "MECHANISM_RUNTIME_REVISION_CONFLICT",
        error: "Mechanism runtime revision conflict",
        currentRevision: runtime.revision
      });
    }
    const publicOptions = new Map([
      ["option-1", mechanismDecision.options[0].key],
      ["option-2", mechanismDecision.options[1].key]
    ]);
    const publicOptionKey = String(body.answer?.optionKey || body.optionKey || "");
    const internalOptionKey = publicOptions.get(publicOptionKey);
    const validAnswer = !body.answer || body.answer.type === "single_choice";
    if (publicDecisionKey !== "choice-1" || !internalOptionKey || !validAnswer || runtime.resolvedOptionKey) {
      return sendJson(response, 409, {
        code: "MECHANISM_DECISION_SUBMISSION_CLOSED",
        error: "Mechanism decision submission is closed"
      });
    }
    const submittedAt = new Date().toISOString();
    runtime.submissions.set(playerRoleId, {
      optionKey: internalOptionKey,
      updatedAt: submittedAt
    });
    runtime.updatedAt = submittedAt;
    broadcastRoomEvent(room.id, {
      type: "room.mechanism_submission_updated",
      decisionKey: mechanismDecision.key,
      submissionCount: runtime.submissions.size
    });
    return sendJson(response, 200, {
      decisionKey: publicDecisionKey,
      optionKey: publicOptionKey,
      answer: { type: "single_choice", optionKey: publicOptionKey },
      revision: runtime.revision,
      submittedAt
    });
  }
  const hostMechanismInitializeMatch = path.match(
    /^\/api\/rooms\/([^/]+)\/host\/mechanism-runtime\/initialize$/
  );
  if (request.method === "POST" && hostMechanismInitializeMatch) {
    const room = rooms.find((item) => item.id === hostMechanismInitializeMatch[1]);
    if (!room) return sendJson(response, 404, { code: "ROOM_NOT_FOUND", error: "Room not found" });
    let runtime = mechanismRuntimeFor(room);
    if (runtime.initialized) {
      return sendJson(response, 200, browserHostMechanismRuntime(room, { replayed: true }));
    }
    runtime = newFixtureMechanismRuntime({ initialized: true });
    runtime.revision = 1;
    runtime.history.unshift({
      actionType: "initialize",
      revisionBefore: 0,
      revisionAfter: 1,
      changes: [],
      createdAt: runtime.updatedAt
    });
    mechanismRuntimes.set(room.id, runtime);
    broadcastRoomEvent(room.id, {
      type: "room.mechanism_state_updated",
      action: "initialize",
      revision: runtime.revision,
      status: runtime.status,
      roundSequence: 1,
      roundTitle: "核对代理授权"
    });
    return sendJson(response, 201, browserHostMechanismRuntime(room, { replayed: false }));
  }
  const hostMechanismActionMatch = path.match(
    /^\/api\/rooms\/([^/]+)\/host\/mechanism-runtime\/actions$/
  );
  if (request.method === "POST" && hostMechanismActionMatch) {
    const room = rooms.find((item) => item.id === hostMechanismActionMatch[1]);
    if (!room) return sendJson(response, 404, { code: "ROOM_NOT_FOUND", error: "Room not found" });
    const runtime = mechanismRuntimeFor(room);
    const body = await readJson(request);
    if (!runtime.initialized) {
      return sendJson(response, 409, {
        code: "MECHANISM_RUNTIME_NOT_INITIALIZED",
        error: "Mechanism runtime is not initialized"
      });
    }
    if (Number(body.expectedRevision) !== runtime.revision) {
      return sendJson(response, 409, {
        code: "MECHANISM_RUNTIME_REVISION_CONFLICT",
        error: "Mechanism runtime revision conflict",
        currentRevision: runtime.revision
      });
    }
    const action = body.action || {};
    const revisionBefore = runtime.revision;
    const changes = [];
    const contentGrants = [];
    if (action.type === "decision") {
      const validOption = mechanismDecision.options.some((option) => option.key === action.optionKey);
      if (action.decisionKey !== mechanismDecision.key || !validOption || runtime.resolvedOptionKey) {
        return sendJson(response, 409, {
          code: "MECHANISM_ACTION_INVALID",
          error: "Mechanism decision is unavailable"
        });
      }
      runtime.resolvedOptionKey = action.optionKey;
      runtime.grantedClue = true;
      changes.push({
        targetType: "state",
        targetKey: "authorizationVerdict",
        before: "pending",
        after: action.optionKey
      }, {
        targetType: "resource",
        targetKey: "reviewSlots",
        before: 3,
        after: 2
      }, {
        targetType: "clue",
        targetKey: "clue-authorization-source",
        roleKey: "role-xiaoman",
        operation: "grant",
        before: null,
        after: "granted"
      });
      contentGrants.push({
        contentType: "clue",
        clueId: "99999999-9999-4999-8999-555555550001",
        clueName: "代理授权原始记录",
        roleSlotId: playerRoleId,
        roleName: "小满",
        status: "granted",
        acquiredAt: new Date().toISOString()
      });
    } else if (action.type === "advance") {
      if (!runtime.resolvedOptionKey || runtime.status === "completed") {
        return sendJson(response, 409, {
          code: "MECHANISM_ACTION_BLOCKED",
          error: "Resolve the current decision before advancing"
        });
      }
      runtime.status = "completed";
      changes.push({
        targetType: "state",
        targetKey: "mechanismStatus",
        before: "running",
        after: "completed"
      });
    } else {
      return sendJson(response, 400, {
        code: "MECHANISM_ACTION_INVALID",
        error: "Fixture supports decision and advance actions"
      });
    }
    runtime.revision += 1;
    runtime.updatedAt = new Date().toISOString();
    runtime.history.unshift({
      actionType: action.type,
      actionKey: action.decisionKey || null,
      optionKey: action.optionKey || null,
      revisionBefore,
      revisionAfter: runtime.revision,
      changes,
      metadata: { contentGrants },
      createdAt: runtime.updatedAt
    });
    if (contentGrants.length) {
      broadcastRoomEvent(room.id, {
        type: "room.clue_granted",
        clueId: contentGrants[0].clueId,
        clueName: contentGrants[0].clueName,
        roleSlotId: playerRoleId,
        source: "mechanism_settlement"
      });
    }
    broadcastRoomEvent(room.id, {
      type: "room.mechanism_state_updated",
      action: action.type,
      revision: runtime.revision,
      status: runtime.status,
      roundSequence: runtime.status === "completed" ? null : 1,
      roundTitle: runtime.status === "completed" ? null : "核对代理授权"
    });
    return sendJson(response, 200, browserHostMechanismRuntime(room, {
      appliedAction: action,
      changes,
      contentGrants
    }));
  }
  if (request.method === "PATCH" && path === `/api/worlds/${worldId}`) {
    const body = await readJson(request);
    if (body.settings && typeof body.settings === "object") world.settings = body.settings;
    return sendJson(response, 200, bumpRevision({ ...world }), revisionHeaders());
  }
  if (request.method === "POST" && path === `/api/worlds/${worldId}/clues`) {
    const body = await readJson(request);
    clueSequence += 1;
    const clue = {
      id: `clue-${clueSequence}`,
      name: String(body.name || ""),
      public_text: String(body.publicText || ""),
      host_text: String(body.hostText || ""),
      visibility: body.visibility || "role",
      clue_kind: body.clueKind || "general",
      metadata: body.metadata || {}
    };
    workspacePreview.clues.unshift(clue);
    dashboard.counts.clues = workspacePreview.clues.length;
    return sendJson(response, 201, bumpRevision(clue), revisionHeaders());
  }
  const cluePathMatch = path.match(new RegExp(`^/api/worlds/${worldId}/clues/([^/]+)$`));
  if (request.method === "PATCH" && cluePathMatch) {
    const clue = workspacePreview.clues.find((item) => item.id === cluePathMatch[1]);
    if (!clue) return sendJson(response, 404, { code: "CLUE_NOT_FOUND", error: "Clue not found" });
    const body = await readJson(request);
    Object.assign(clue, {
      name: String(body.name ?? clue.name),
      public_text: String(body.publicText ?? clue.public_text ?? ""),
      host_text: String(body.hostText ?? clue.host_text ?? ""),
      visibility: body.visibility || clue.visibility,
      clue_kind: body.clueKind || clue.clue_kind,
      metadata: body.metadata || clue.metadata || {}
    });
    return sendJson(response, 200, bumpRevision(clue), revisionHeaders());
  }
  if (request.method === "POST" && path === `/api/worlds/${worldId}/rules/validate-body`) {
    return sendJson(response, 200, { ok: true, errors: [] });
  }
  if (request.method === "POST" && path === `/api/worlds/${worldId}/rules`) {
    const body = await readJson(request);
    ruleSequence += 1;
    const rule = {
      id: `rule-${ruleSequence}`,
      room_id: body.roomId || null,
      name: String(body.name || ""),
      mode: body.mode || "automatic",
      priority: Number(body.priority) || 100,
      enabled: body.enabled !== false,
      conditions: body.conditions || {},
      actions: body.actions || [],
      metadata: body.metadata || {}
    };
    rules.unshift(rule);
    return sendJson(response, 201, bumpRevision(rule), revisionHeaders());
  }
  const rulePathMatch = path.match(new RegExp(`^/api/worlds/${worldId}/rules/([^/]+)$`));
  if (request.method === "PUT" && rulePathMatch) {
    const rule = rules.find((item) => item.id === rulePathMatch[1]);
    if (!rule) return sendJson(response, 404, { code: "RULE_NOT_FOUND", error: "Rule not found" });
    const body = await readJson(request);
    Object.assign(rule, {
      room_id: body.roomId || null,
      name: String(body.name ?? rule.name),
      mode: body.mode || rule.mode,
      priority: Number(body.priority) || 100,
      enabled: body.enabled !== false,
      conditions: body.conditions || rule.conditions,
      actions: body.actions || rule.actions,
      metadata: body.metadata || rule.metadata || {}
    });
    return sendJson(response, 200, bumpRevision(rule), revisionHeaders());
  }

  return sendJson(response, 404, { code: "FIXTURE_ROUTE_NOT_FOUND", error: `No fixture for ${request.method} ${path}` });
});

server.listen(port, host, () => {
  console.log(`Browser fixture API listening on http://${host}:${port}`);
});
