import http from "node:http";

const host = "127.0.0.1";
const port = Number(process.env.ZHIMU_BROWSER_FIXTURE_PORT || 4180);
const worldId = "33333333-3333-4333-8444-555555550003";
const releaseId = "44444444-4444-4444-8444-555555550004";
let roomSequence = 2;
let clueSequence = 1;
let ruleSequence = 0;

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
  settings: {}
};

const rules = [];
const workspacePreview = {
  world,
  chapters: [{ id: "chapter-1", title: "第一章", sequence: 1 }],
  roles: [{ id: "role-1", name: "侦探", sequence: 1 }],
  sections: [{ id: "section-1", role_slot_id: "role-1", title: "序幕", sequence: 1, publication_status: "testing" }],
  scenes: [{ id: "scene-1", name: "大厅" }],
  clues: [{
    id: "clue-1",
    name: "信件",
    public_text: "一封被雨水打湿的匿名信。",
    host_text: "用于引出第一幕的失踪线索。",
    visibility: "role",
    clue_kind: "general",
    metadata: { clueType: "text", grantMode: "auto", importance: "normal" }
  }],
  items: [],
  investigationPoints: [],
  edges: [],
  rooms
};

const dashboard = {
  counts: { chapters: 1, roles: 1, sections: 1, scenes: 1, clues: 1, rooms: rooms.length },
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
