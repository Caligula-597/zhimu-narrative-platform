import http from "node:http";
import {
  creativeConstitutionCoverage,
  isCreativeConstitutionEmpty,
  normalizeCreativeConstitution
} from "../shared/creative-constitution.js";
import { AI_PLAYER_ARCHETYPES } from "../shared/ai-playtest.js";

const host = "127.0.0.1";
const port = Number(process.env.ZHIMU_BROWSER_FIXTURE_PORT || 4180);
const worldId = "33333333-3333-4333-8444-555555550003";
const releaseId = "44444444-4444-4444-8444-555555550004";
let roomSequence = 2;
let clueSequence = 1;
let ruleSequence = 0;
let qualityReportSequence = 0;
const qualityReports = [];

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
  contentSummary: { counts: { roles: 4, sections: 8, segments: 3 }, hasCoreTrick: true, totalObjects: 28 },
  contentSha256: "a".repeat(64),
  snapshotBytes: 4096,
  createdByUserId: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
  createdByName: "浏览器验收",
  createdAt: "2026-07-23T00:00:00.000Z"
};

const bindingFor = (selectedReleaseId = null) => selectedReleaseId
  ? {
      mode: "release",
      runtimeSource: "live_draft",
      isFrozen: false,
      compatibilityStatus: "awaiting_release_reader",
      release: {
        id: releaseId,
        releaseNumber: 2,
        label: release.label,
        sourceRevision: 7,
        createdAt: release.createdAt
      },
      currentDraftRevision: 8,
      hasNewerDraft: true
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

const rooms = [{
  id: "55555555-5555-4555-8555-555555550001",
  name: "旧版实时草稿房",
  invite_code: "ROOM-LIVE-DRAFT",
  status: "testing",
  public_listing: false,
  member_count: 1,
  role_slot_count: 4,
  is_mine: true,
  contentBinding: bindingFor()
}, {
  id: "55555555-5555-4555-8555-555555550002",
  name: "R2 预绑定房",
  invite_code: "ROOM-RELEASE-02",
  status: "testing",
  public_listing: false,
  member_count: 0,
  role_slot_count: 4,
  is_mine: true,
  contentBinding: bindingFor(releaseId)
}];

const world = {
  id: worldId,
  name: "浏览器验收剧本",
  summary: "只存在于本机进程内的隔离验收数据",
  status: "testing",
  membership_role: "owner",
  content_revision: 8,
  settings: {
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

function sendSse(request, response) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive"
  });
  response.write(`data: ${JSON.stringify({ type: "connected", fixture: true })}\n\n`);
  const heartbeat = setInterval(() => {
    response.write(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`);
  }, 15_000);
  request.once("close", () => clearInterval(heartbeat));
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
    return sendJson(response, 200, { requireAuth: false, demoMode: true, providers: [] });
  }
  if (request.method === "GET" && path === "/api/auth/me") {
    return sendJson(response, 200, {
      id: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
      email: "browser-fixture@getzhimu.local",
      display_name: "浏览器验收",
      email_verified_at: "2026-07-23T00:00:00.000Z"
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
  if (request.method === "GET" && path === "/api/platform/events/stream") {
    return sendSse(request, response);
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
    return sendJson(response, 200, [world]);
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
    return sendJson(response, 200, [release]);
  }
  if (request.method === "GET" && path === `/api/worlds/${worldId}/rules`) {
    return sendJson(response, 200, rules);
  }
  if (request.method === "GET" && path === `/api/worlds/${worldId}/segments`) {
    return sendJson(response, 200, { segments: [] });
  }
  if (request.method === "GET" && path === `/api/worlds/${worldId}/logs`) {
    return sendJson(response, 200, []);
  }
  const roomPathMatch = path.match(/^\/api\/rooms\/([^/]+)(\/.*)$/);
  if (request.method === "GET" && roomPathMatch && roomPathMatch[1] !== "invite") {
    const [, requestedRoomId, suffix] = roomPathMatch;
    const room = rooms.find((item) => item.id === requestedRoomId);
    if (!room) return sendJson(response, 404, { code: "ROOM_NOT_FOUND", error: "Room not found" });
    if (suffix === "/events/stream") return sendSse(request, response);
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
        id: "66666666-6666-4666-8666-555555550001",
        name: "侦探",
        public_profile: "负责梳理现场证据",
        occupied: false,
        occupied_by_current: false
      }]
    });
  }
  if (request.method === "POST" && path === `/api/worlds/${worldId}/rooms`) {
    try {
      const body = await readJson(request);
      const selectedReleaseId = body.releaseId || null;
      if (selectedReleaseId && selectedReleaseId !== releaseId) {
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
      dashboard.counts.rooms = rooms.length;
      return sendJson(response, 201, room);
    } catch (error) {
      return sendJson(response, 400, { code: "VALIDATION_ERROR", error: error.message });
    }
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
